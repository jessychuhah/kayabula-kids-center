import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { getCurrentUserFromRequest, isSameOrigin } from "@/lib/auth";
import { getPrismaClient } from "@/lib/prisma";

const messageSchema = z.object({ message: z.string().trim().min(1).max(2000) });

export async function GET(request: Request) {
	try {
		const user = await getCurrentUserFromRequest(request);
		if (!user) return NextResponse.json({ error: "Log in to use the community channel." }, { status: 401 });
		const messages = await getPrismaClient().communityMessage.findMany({
			orderBy: { createdAt: "desc" },
			take: 100,
			include: { sender: { select: { name: true, role: true } } },
		});
		return NextResponse.json({ messages: messages.reverse() });
	} catch (error) {
		unstable_rethrow(error);
		console.error("Unable to load the community channel.", error);
		return NextResponse.json({ error: "Unable to load the community channel right now." }, { status: 503 });
	}
}

export async function POST(request: Request) {
	if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
	try {
		const user = await getCurrentUserFromRequest(request);
		if (!user) return NextResponse.json({ error: "Log in to use the community channel." }, { status: 401 });
		const parsed = messageSchema.safeParse(await request.json());
		if (!parsed.success) return NextResponse.json({ error: "Enter a message of up to 2,000 characters." }, { status: 400 });
		const message = await getPrismaClient().communityMessage.create({
			data: { senderId: user.id, body: parsed.data.message },
			include: { sender: { select: { name: true, role: true } } },
		});
		return NextResponse.json({ message }, { status: 201 });
	} catch (error) {
		unstable_rethrow(error);
		if (error instanceof SyntaxError) return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
		console.error("Unable to send a community message.", error);
		return NextResponse.json({ error: "Unable to send the community message right now." }, { status: 503 });
	}
}
