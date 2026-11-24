import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { getCurrentUserFromRequest, isSameOrigin, isStaffUser } from "@/lib/auth";
import { getR2Client } from "@/lib/r2";

const maximumUploadBytes = 100 * 1024 * 1024;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm"]);
const r2AdObjectKey = z.string().max(260).refine((value) =>
	value.startsWith("ads/") && !value.includes("\\") && !value.split("/").includes(".."),
);

const uploadSchema = z.object({
	fileName: z.string().min(1).max(160),
	contentType: z.string().refine((type) => allowedTypes.has(type)),
	size: z.number().int().positive().max(maximumUploadBytes),
});

async function requireAdministrator(request: Request) {
	const user = await getCurrentUserFromRequest(request);
	if (!user) return { response: NextResponse.json({ error: "Please log in to continue." }, { status: 401 }) };
	if (!isStaffUser(user)) return { response: NextResponse.json({ error: "Administrator access is required." }, { status: 403 }) };
	return { user };
}

export async function POST(request: Request) {
	if (!isSameOrigin(request)) {
		return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
	}

	try {
		const auth = await requireAdministrator(request);
		if ("response" in auth) return auth.response;
		if (auth.user.role !== "ADMIN") {
			return NextResponse.json({ error: "Only administrators can upload advertisement media." }, { status: 403 });
		}
		const parsed = uploadSchema.safeParse(await request.json());
		if (!parsed.success) {
			return NextResponse.json({ error: "Choose an image or video file no larger than 100 MB." }, { status: 400 });
		}
		const { client, bucket, publicBaseUrl } = getR2Client();
		if (!bucket || !publicBaseUrl.startsWith("https://")) {
			return NextResponse.json({ error: "R2 bucket name and HTTPS public asset URL are not configured." }, { status: 503 });
		}

		const safeName = parsed.data.fileName.replace(/[^\w.-]/g, "_");
		const key = `ads/${randomUUID()}-${safeName}`;
		const uploadUrl = await getSignedUrl(
			client,
			new PutObjectCommand({
				Bucket: bucket,
				Key: key,
				ContentType: parsed.data.contentType,
				ContentLength: parsed.data.size,
			}),
			{ expiresIn: 300 },
		);
		return NextResponse.json({
			uploadUrl,
			key,
			publicUrl: `${publicBaseUrl}/${key}`,
			mediaType: parsed.data.contentType.startsWith("video/") ? "VIDEO" : "IMAGE",
		});
	} catch (error) {
		unstable_rethrow(error);
		if (error instanceof SyntaxError) {
			return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
		}
		console.error("Unable to prepare Cloudflare R2 upload.", error);
		return NextResponse.json({ error: "Unable to prepare the media upload. Check the Cloudflare R2 configuration." }, { status: 503 });
	}
}

export async function DELETE(request: Request) {
	if (!isSameOrigin(request)) {
		return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
	}

	try {
		const auth = await requireAdministrator(request);
		if ("response" in auth) return auth.response;
		const parsed = z.object({ key: r2AdObjectKey }).safeParse(await request.json());
		if (!parsed.success) return NextResponse.json({ error: "A valid advertisement object key is required." }, { status: 400 });
		const { client, bucket } = getR2Client();
		if (!bucket) return NextResponse.json({ error: "R2 bucket name is not configured." }, { status: 503 });
		await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: parsed.data.key }));
		return NextResponse.json({ success: true });
	} catch (error) {
		unstable_rethrow(error);
		if (error instanceof SyntaxError) {
			return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
		}
		console.error("Unable to delete Cloudflare R2 advertisement media.", error);
		return NextResponse.json({ error: "Unable to remove the media from Cloudflare R2." }, { status: 503 });
	}
}
