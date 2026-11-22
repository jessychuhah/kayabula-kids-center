import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { getCurrentUserFromRequest, isSameOrigin } from "@/lib/auth";
import { getPrismaClient } from "@/lib/prisma";

const messageSchema = z.object({ message: z.string().trim().min(1).max(2000) });

export async function GET(request: Request) {
	try {
		const user = await getCurrentUserFromRequest(request);
		if (!user) return NextResponse.json({ error: "Log in to use support chat." }, { status: 401 });

		const conversation = await getPrismaClient().supportConversation.findUnique({
			where: { userId: user.id },
			include: {
				messages: {
					orderBy: { createdAt: "asc" },
					take: 100,
					select: { id: true, senderRole: true, body: true, createdAt: true },
				},
			},
		});
		return NextResponse.json({ conversationId: conversation?.id ?? null, messages: conversation?.messages ?? [] });
	} catch (error) {
		unstable_rethrow(error);
		console.error("Unable to load support chat.", error);
		return NextResponse.json({ error: "Unable to load support chat right now." }, { status: 503 });
	}
}

export async function POST(request: Request) {
	if (!isSameOrigin(request)) {
		return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
	}

	try {
		const user = await getCurrentUserFromRequest(request);
		if (!user) return NextResponse.json({ error: "Log in to use support chat." }, { status: 401 });
		const parsed = messageSchema.safeParse(await request.json());
		if (!parsed.success) return NextResponse.json({ error: "Enter a message of up to 2,000 characters." }, { status: 400 });

		const message = await getPrismaClient().$transaction(async (transaction) => {
			const conversation = await transaction.supportConversation.upsert({
				where: { userId: user.id },
				create: { userId: user.id },
				update: { updatedAt: new Date() },
			});
			return transaction.supportMessage.create({
				data: { conversationId: conversation.id, senderRole: "USER", body: parsed.data.message },
				select: { id: true, senderRole: true, body: true, createdAt: true },
			});
		});
		return NextResponse.json({ message }, { status: 201 });
	} catch (error) {
		unstable_rethrow(error);
		if (error instanceof SyntaxError) {
			return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
		}
		console.error("Unable to send support chat message.", error);
		return NextResponse.json({ error: "Unable to send your message right now." }, { status: 503 });
	}
}
