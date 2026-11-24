import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { getCurrentUserFromRequest, isSameOrigin, isStaffUser } from "@/lib/auth";
import { getPrismaClient } from "@/lib/prisma";
import { getR2Client } from "@/lib/r2";

const updateMediaSchema = z.array(z.object({
	url: z.url().refine((value) => value.startsWith("https://")),
	key: z.string().startsWith("communications/updates/").max(260),
})).max(8);

export async function GET(request: Request) {
	try {
		const user = await getCurrentUserFromRequest(request);
		if (!user) return NextResponse.json({ error: "Please sign in to view centre updates." }, { status: 401 });
		const updates = await getPrismaClient().siteUpdate.findMany({
			orderBy: { createdAt: "desc" },
			take: 100,
			include: { media: { orderBy: { sortOrder: "asc" } } },
		});
		return NextResponse.json({ updates });
	} catch (error) {
		unstable_rethrow(error);
		console.error("Unable to load signed-in centre updates.", error);
		return NextResponse.json({ error: "Unable to load centre updates right now." }, { status: 503 });
	}
}

export async function POST(request: Request) {
	if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });

	try {
		const user = await getCurrentUserFromRequest(request);
		if (!user || !isStaffUser(user)) return NextResponse.json({ error: "Administrator access is required." }, { status: 401 });
		const parsed = z.object({
			title: z.string().trim().min(2).max(120),
			body: z.string().trim().min(1).max(4000),
			media: updateMediaSchema.default([]),
		}).safeParse(await request.json());
		if (!parsed.success) return NextResponse.json({ error: "Enter a title, update text, and up to eight images." }, { status: 400 });
		if (new Set(parsed.data.media.map((item) => item.key)).size !== parsed.data.media.length) {
			return NextResponse.json({ error: "Each update image must be unique." }, { status: 400 });
		}

		const update = await getPrismaClient().siteUpdate.create({
			data: {
				authorId: user.id,
				authorName: user.name,
				title: parsed.data.title,
				body: parsed.data.body,
				media: { create: parsed.data.media.map((item, sortOrder) => ({ url: item.url, objectKey: item.key, sortOrder })) },
			},
			include: { media: { orderBy: { sortOrder: "asc" } } },
		});
		return NextResponse.json({ update }, { status: 201 });
	} catch (error) {
		unstable_rethrow(error);
		if (error instanceof SyntaxError) return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
		console.error("Unable to publish a centre update.", error);
		return NextResponse.json({ error: "Unable to publish the update right now." }, { status: 503 });
	}
}

export async function DELETE(request: Request) {
	if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });

	try {
		const user = await getCurrentUserFromRequest(request);
		if (!user || !isStaffUser(user)) return NextResponse.json({ error: "Administrator access is required." }, { status: 401 });
		const parsed = z.object({ id: z.string().min(1) }).safeParse(await request.json());
		if (!parsed.success) return NextResponse.json({ error: "A valid update ID is required." }, { status: 400 });
		const db = getPrismaClient();
		const update = await db.siteUpdate.findUnique({ where: { id: parsed.data.id }, include: { media: true } });
		if (!update) return NextResponse.json({ error: "That update no longer exists." }, { status: 404 });
		if (update.authorId !== user.id && user.role !== "OWNER") {
			return NextResponse.json({ error: "You can delete only your own updates." }, { status: 403 });
		}
		const mediaKeys = update.media.flatMap((item) => item.objectKey ? [item.objectKey] : []);
		await db.siteUpdate.delete({ where: { id: update.id } });
		let mediaCleanupWarning = false;
		if (mediaKeys.length) {
			try {
				const { client, bucket } = getR2Client();
				if (!bucket) throw new Error("R2 bucket name is not configured.");
				await Promise.all(mediaKeys.map((Key) => client.send(new DeleteObjectCommand({ Bucket: bucket, Key }))));
			} catch (cleanupError) {
				mediaCleanupWarning = true;
				console.error("Deleted a centre update but could not remove its R2 images.", { updateId: update.id, error: cleanupError });
			}
		}
		return NextResponse.json({ success: true, mediaCleanupWarning });
	} catch (error) {
		unstable_rethrow(error);
		if (error instanceof SyntaxError) return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
		console.error("Unable to delete a centre update.", error);
		return NextResponse.json({ error: "Unable to delete the update right now." }, { status: 503 });
	}
}
