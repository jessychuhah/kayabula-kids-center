import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { getCurrentUserFromRequest, isSameOrigin, isStaffUser } from "@/lib/auth";
import { getPrismaClient } from "@/lib/prisma";
import { getR2Client } from "@/lib/r2";

const maximumImageBytes = 10 * 1024 * 1024;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const objectKeySchema = z.string().max(260).refine((key) =>
	(key.startsWith("communications/team/") || key.startsWith("communications/updates/")) &&
	!key.includes("\\") && !key.split("/").includes(".."),
);

export async function POST(request: Request) {
	if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
	try {
		const user = await getCurrentUserFromRequest(request);
		if (!user || !isStaffUser(user)) return NextResponse.json({ error: "Administrator access is required." }, { status: 401 });
		const parsed = z.object({
			scope: z.enum(["team", "updates"]),
			fileName: z.string().min(1).max(160),
			contentType: z.string().refine((type) => allowedTypes.has(type)),
			size: z.number().int().positive().max(maximumImageBytes),
		}).safeParse(await request.json());
		if (!parsed.success) return NextResponse.json({ error: "Choose an image no larger than 10 MB." }, { status: 400 });
		const { client, bucket, publicBaseUrl } = getR2Client();
		if (!bucket || !publicBaseUrl.startsWith("https://")) {
			return NextResponse.json({ error: "R2 bucket name and HTTPS public asset URL are not configured." }, { status: 503 });
		}
		const safeName = parsed.data.fileName.replace(/[^\w.-]/g, "_");
		const key = `communications/${parsed.data.scope}/${randomUUID()}-${safeName}`;
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
		console.error("Unable to prepare a communications image upload.", error);
		return NextResponse.json({ error: "Unable to prepare the image upload. Check Cloudflare R2 configuration." }, { status: 503 });
	}
}

export async function DELETE(request: Request) {
	if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
	try {
		const user = await getCurrentUserFromRequest(request);
		if (!user || !isStaffUser(user)) return NextResponse.json({ error: "Administrator access is required." }, { status: 401 });
		const parsed = z.object({ key: objectKeySchema }).safeParse(await request.json());
		if (!parsed.success) return NextResponse.json({ error: "A valid communications image key is required." }, { status: 400 });
		const db = getPrismaClient();
		const key = parsed.data.key;
		const linked = key.startsWith("communications/team/")
			? await db.staffMessage.findFirst({ where: { imageKey: key }, select: { id: true } })
			: await db.siteUpdateMedia.findFirst({ where: { objectKey: key }, select: { id: true } });
		if (linked) return NextResponse.json({ error: "This image is attached to a saved message or update." }, { status: 409 });
		const { client, bucket } = getR2Client();
		if (!bucket) return NextResponse.json({ error: "R2 bucket name is not configured." }, { status: 503 });
		await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
		return NextResponse.json({ success: true });
	} catch (error) {
		unstable_rethrow(error);
		if (error instanceof SyntaxError) return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
		console.error("Unable to remove a communications image.", error);
		return NextResponse.json({ error: "Unable to remove the image from Cloudflare R2." }, { status: 503 });
	}
}
