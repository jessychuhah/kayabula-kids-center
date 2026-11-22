import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { getCurrentUserFromRequest } from "@/lib/auth";
import { getPrismaClient } from "@/lib/prisma";

export async function GET(request: Request) {
	try {
		const user = await getCurrentUserFromRequest(request);
		if (!user) return NextResponse.json({ error: "Please log in to continue." }, { status: 401 });

		const notifications = await getPrismaClient().userNotification.findMany({
			where: { userId: user.id },
			orderBy: { createdAt: "desc" },
			take: 20,
			select: { id: true, title: true, message: true, readAt: true, createdAt: true },
		});
		return NextResponse.json({ notifications });
	} catch (error) {
		unstable_rethrow(error);
		console.error("Unable to load account notifications.", error);
		return NextResponse.json({ error: "Unable to load account notifications right now." }, { status: 503 });
	}
}
