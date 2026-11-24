import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { getCurrentUserFromRequest, isStaffUser } from "@/lib/auth";
import { getPrismaClient } from "@/lib/prisma";

export async function GET(request: Request) {
	try {
		const user = await getCurrentUserFromRequest(request);
		if (!user) return NextResponse.json({ error: "Please log in to continue." }, { status: 401 });
		if (!isStaffUser(user)) return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });

		const url = new URL(request.url);
		const conversationId = url.searchParams.get("conversationId");
		const db = getPrismaClient();
		const conversations = await db.supportConversation.findMany({
			orderBy: { updatedAt: "desc" },
			include: {
				user: { select: { id: true, name: true, email: true } },
				messages: {
					orderBy: { createdAt: "desc" },
					take: 1,
					select: { body: true, createdAt: true, senderRole: true },
				},
			},
		});
		const conversation = conversationId
			? await db.supportConversation.findUnique({
				where: { id: conversationId },
				include: {
					messages: {
						orderBy: { createdAt: "asc" },
						take: 100,
						select: { id: true, senderRole: true, body: true, createdAt: true },
					},
				},
			})
			: null;
		return NextResponse.json({ conversations, conversation });
	} catch (error) {
		unstable_rethrow(error);
		console.error("Unable to load administrator support inbox.", error);
		return NextResponse.json({ error: "Unable to load the support inbox right now." }, { status: 503 });
	}
}
