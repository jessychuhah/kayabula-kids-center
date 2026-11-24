import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { getCurrentUserFromRequest, isSameOrigin, isStaffUser } from "@/lib/auth";
import { getPrismaClient } from "@/lib/prisma";
import { getR2Client } from "@/lib/r2";

const attachmentSchema = z.object({
	url: z.url().refine((value) => value.startsWith("https://")),
	key: z.string().startsWith("communications/team/").max(260),
});

export async function GET(request: Request) {
	try {
		const user = await getCurrentUserFromRequest(request);
		if (!user || !isStaffUser(user)) return NextResponse.json({ error: "Administrator access is required." }, { status: 401 });
		const messages = await getPrismaClient().staffMessage.findMany({
			orderBy: { createdAt: "desc" },
			take: 100,
		});
		return NextResponse.json({ messages: messages.reverse() });
	} catch (error) {
		unstable_rethrow(error);
		console.error("Unable to load the private staff channel.", error);
		return NextResponse.json({ error: "Unable to load the team channel right now." }, { status: 503 });
	}
}

export async function POST(request: Request) {
	if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });

	try {
		const user = await getCurrentUserFromRequest(request);
		if (!user || !isStaffUser(user)) return NextResponse.json({ error: "Administrator access is required." }, { status: 401 });
		const parsed = z.object({
			message: z.string().trim().max(2000).optional().default(""),
			attachment: attachmentSchema.nullable().optional(),
		}).safeParse(await request.json());
		if (!parsed.success || (!parsed.data.message && !parsed.data.attachment)) {
			return NextResponse.json({ error: "Write a message or attach an image." }, { status: 400 });
		}

		const message = await getPrismaClient().staffMessage.create({
			data: {
				senderId: user.id,
				senderName: user.name,
				senderRole: user.role,
				body: parsed.data.message || null,
				imageUrl: parsed.data.attachment?.url ?? null,
				imageKey: parsed.data.attachment?.key ?? null,
			},
		});
		return NextResponse.json({ message }, { status: 201 });
	} catch (error) {
		unstable_rethrow(error);
		if (error instanceof SyntaxError) return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
		console.error("Unable to send a staff message.", error);
		return NextResponse.json({ error: "Unable to send the team message right now." }, { status: 503 });
	}
}

export async function DELETE(request: Request) {
	if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });

	try {
		const user = await getCurrentUserFromRequest(request);
		if (!user || !isStaffUser(user)) return NextResponse.json({ error: "Administrator access is required." }, { status: 401 });
		const parsed = z.object({ id: z.string().min(1) }).safeParse(await request.json());
		if (!parsed.success) return NextResponse.json({ error: "A valid message ID is required." }, { status: 400 });
		const db = getPrismaClient();
		const message = await db.staffMessage.findUnique({ where: { id: parsed.data.id } });
		if (!message) return NextResponse.json({ error: "That message no longer exists." }, { status: 404 });
		if (message.senderId !== user.id && user.role !== "OWNER") {
			return NextResponse.json({ error: "You can delete only your own messages." }, { status: 403 });
		}
		await db.staffMessage.delete({ where: { id: message.id } });
		let mediaCleanupWarning = false;
		if (message.imageKey) {
			try {
				const { client, bucket } = getR2Client();
				if (!bucket) throw new Error("R2 bucket name is not configured.");
				await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: message.imageKey }));
			} catch (cleanupError) {
				mediaCleanupWarning = true;
				console.error("Deleted a staff message but could not remove its R2 image.", { messageId: message.id, error: cleanupError });
			}
		}
		return NextResponse.json({ success: true, mediaCleanupWarning });
	} catch (error) {
		unstable_rethrow(error);
		if (error instanceof SyntaxError) return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
		console.error("Unable to delete a staff message.", error);
		return NextResponse.json({ error: "Unable to delete the team message right now." }, { status: 503 });
	}
}
