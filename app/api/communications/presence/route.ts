import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { getCurrentUserFromRequest, isSameOrigin, isStaffUser } from "@/lib/auth";
import { getPrismaClient } from "@/lib/prisma";

export async function POST(request: Request) {
	if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
	try {
		const user = await getCurrentUserFromRequest(request);
		if (!user) return NextResponse.json({ error: "Please log in to continue." }, { status: 401 });
		if (!isStaffUser(user)) return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
		await getPrismaClient().user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } });
		return NextResponse.json({ success: true });
	} catch (error) {
		unstable_rethrow(error);
		console.error("Unable to update staff presence.", error);
		return NextResponse.json({ error: "Unable to update your online status." }, { status: 503 });
	}
}
