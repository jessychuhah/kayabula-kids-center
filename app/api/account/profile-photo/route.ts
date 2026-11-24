import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { getCurrentUserFromRequest, isSameOrigin } from "@/lib/auth";
import { getPrismaClient } from "@/lib/prisma";
import { getR2Client } from "@/lib/r2";

const maximumImageBytes = 5 * 1024 * 1024;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function isProfileKey(key: string, userId: string) {
	return key.startsWith(`profiles/${userId}/`) && !key.includes("\\") && !key.split("/").includes("..");
}

export async function POST(request: Request) {
	if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
	try {
		const user = await getCurrentUserFromRequest(request);
		if (!user) return NextResponse.json({ error: "Please sign in to upload a profile photo." }, { status: 401 });
		const parsed = z.object({
			fileName: z.string().min(1).max(160),
			contentType: z.string().refine((type) => allowedTypes.has(type)),
			size: z.number().int().positive().max(maximumImageBytes),
		}).safeParse(await request.json());
		if (!parsed.success) return NextResponse.json({ error: "Choose a JPG, PNG, GIF or WebP image no larger than 5 MB." }, { status: 400 });

		const { client, bucket, publicBaseUrl } = getR2Client();
		if (!bucket || !publicBaseUrl.startsWith("https://")) {
			return NextResponse.json({ error: "R2 bucket name and HTTPS public asset URL are not configured." }, { status: 503 });
		}
		const safeName = parsed.data.fileName.replace(/[^\w.-]/g, "_");
		const key = `profiles/${user.id}/${randomUUID()}-${safeName}`;
		const uploadUrl = await getSignedUrl(client, new PutObjectCommand({
			Bucket: bucket,
			Key: key,
			ContentType: parsed.data.contentType,
			ContentLength: parsed.data.size,
		}), { expiresIn: 300 });
		return NextResponse.json({ uploadUrl, key, publicUrl: `${publicBaseUrl}/${key}` });
	} catch (error) {
		unstable_rethrow(error);
		if (error instanceof SyntaxError) return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
		console.error("Unable to prepare a profile photo upload.", error);
		return NextResponse.json({ error: "Unable to prepare the profile photo upload. Check Cloudflare R2 configuration." }, { status: 503 });
	}
}

export async function PATCH(request: Request) {
	if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
	try {
		const user = await getCurrentUserFromRequest(request);
		if (!user) return NextResponse.json({ error: "Please sign in to update your profile photo." }, { status: 401 });
		const payload: unknown = await request.json();
		const remove = z.object({ remove: z.literal(true) }).safeParse(payload);
		const photo = z.object({
			key: z.string().min(1).max(300),
			url: z.url().refine((value) => value.startsWith("https://")),
		}).safeParse(payload);
		if (!remove.success && !photo.success) return NextResponse.json({ error: "Choose a valid profile photo or request photo removal." }, { status: 400 });

		const db = getPrismaClient();
		const existing = await db.user.findUnique({
			where: { id: user.id },
			select: { profileImageKey: true },
		});
		if (!existing) return NextResponse.json({ error: "That account no longer exists." }, { status: 404 });

		let profileImageUrl: string | null = null;
		let profileImageKey: string | null = null;
		if (photo.success) {
			if (!isProfileKey(photo.data.key, user.id)) {
				return NextResponse.json({ error: "That profile image does not belong to your account." }, { status: 403 });
			}
			const { client, bucket, publicBaseUrl } = getR2Client();
			if (!bucket || photo.data.url !== `${publicBaseUrl}/${photo.data.key}`) {
				return NextResponse.json({ error: "The profile image URL does not match the configured R2 asset domain." }, { status: 400 });
			}
			const uploaded = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: photo.data.key }));
			if (!uploaded.ContentLength || uploaded.ContentLength > maximumImageBytes || !allowedTypes.has(uploaded.ContentType ?? "")) {
				return NextResponse.json({ error: "The uploaded file is not a supported profile image or exceeds the 5 MB limit." }, { status: 400 });
			}
			profileImageUrl = photo.data.url;
			profileImageKey = photo.data.key;
		}

		await db.user.update({
			where: { id: user.id },
			data: { profileImageUrl, profileImageKey },
		});

		let mediaCleanupWarning = false;
		if (existing.profileImageKey && existing.profileImageKey !== profileImageKey) {
			try {
				const { client, bucket } = getR2Client();
				if (!bucket) throw new Error("R2 bucket name is not configured.");
				await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: existing.profileImageKey }));
			} catch (cleanupError) {
				mediaCleanupWarning = true;
				console.error("Updated profile photo but could not remove the previous R2 image.", { userId: user.id, error: cleanupError });
			}
		}
		return NextResponse.json({ profileImageUrl, mediaCleanupWarning });
	} catch (error) {
		unstable_rethrow(error);
		if (error instanceof SyntaxError) return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
		console.error("Unable to update the profile photo.", error);
		return NextResponse.json({ error: "Unable to update the profile photo right now." }, { status: 503 });
	}
}

export async function DELETE(request: Request) {
	if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
	try {
		const user = await getCurrentUserFromRequest(request);
		if (!user) return NextResponse.json({ error: "Please sign in to clean up an unused profile photo." }, { status: 401 });
		const parsed = z.object({ key: z.string().min(1).max(300) }).safeParse(await request.json());
		if (!parsed.success || !isProfileKey(parsed.data.key, user.id)) {
			return NextResponse.json({ error: "A valid profile image belonging to your account is required." }, { status: 400 });
		}
		const db = getPrismaClient();
		const linked = await db.user.findFirst({ where: { profileImageKey: parsed.data.key }, select: { id: true } });
		if (linked) return NextResponse.json({ error: "This profile photo is currently in use." }, { status: 409 });
		const { client, bucket } = getR2Client();
		if (!bucket) return NextResponse.json({ error: "R2 bucket name is not configured." }, { status: 503 });
		await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: parsed.data.key }));
		return NextResponse.json({ success: true });
	} catch (error) {
		unstable_rethrow(error);
		if (error instanceof SyntaxError) return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
		console.error("Unable to remove an unused profile photo.", error);
		return NextResponse.json({ error: "Unable to remove the unused profile photo." }, { status: 503 });
	}
}
