import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { getCurrentUserFromRequest, isSameOrigin } from "@/lib/auth";
import { getPrismaClient } from "@/lib/prisma";

const replySchema = z.object({
	conversationId: z.string().min(1),
	message: z.string().trim().min(1).max(2000),
});

export async function POST(request: Request) {
	if (!isSameOrigin(request)) {
		return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
	}

	try {
		const user = await getCurrentUserFromRequest(request);
		if (!user) return NextResponse.json({ error: "Please log in to continue." }, { status: 401 });
		if (user.role !== "ADMIN") return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
		const parsed = replySchema.safeParse(await request.json());
		if (!parsed.success) return NextResponse.json({ error: "Enter a message of up to 2,000 characters." }, { status: 400 });

		const db = getPrismaClient();
		const conversation = await db.supportConversation.findUnique({
			where: { id: parsed.data.conversationId },
			select: { id: true },
		});
		if (!conversation) return NextResponse.json({ error: "That conversation no longer exists." }, { status: 404 });

		const message = await db.$transaction(async (transaction) => {
			await transaction.supportConversation.update({
				where: { id: conversation.id },
				data: { updatedAt: new Date() },
			});
			return transaction.supportMessage.create({
				data: { conversationId: conversation.id, senderRole: "ADMIN", body: parsed.data.message },
				select: { id: true, senderRole: true, body: true, createdAt: true },
			});
		});
		return NextResponse.json({ message }, { status: 201 });
	} catch (error) {
		unstable_rethrow(error);
		if (error instanceof SyntaxError) {
			return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
		}
		console.error("Unable to send administrator reply.", error);
		return NextResponse.json({ error: "Unable to send your reply right now." }, { status: 503 });
	}
}
