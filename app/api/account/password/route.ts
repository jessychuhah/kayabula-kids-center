import { compare, hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserFromRequest, hashSessionToken, isSameOrigin, isStaffUser, getSessionTokenFromRequest } from "@/lib/auth";
import { getPrismaClient } from "@/lib/prisma";

const passwordSchema = z.object({
	currentPassword: z.string().min(1).max(128),
	newPassword: z.string().min(12).max(128),
});

export async function POST(request: Request) {
	if (!isSameOrigin(request)) {
		return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
	}

	try {
		const user = await getCurrentUserFromRequest(request);
		if (!user || !isStaffUser(user)) {
			return NextResponse.json({ error: "Sign in as an administrator or owner to change this password." }, { status: 401 });
		}
		const parsed = passwordSchema.safeParse(await request.json());
		if (!parsed.success) {
			return NextResponse.json({ error: "Enter your current password and a new password of at least 12 characters." }, { status: 400 });
		}
		const sessionToken = getSessionTokenFromRequest(request);
		if (!sessionToken) return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
		const db = getPrismaClient();
		const account = await db.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
		if (!account || !(await compare(parsed.data.currentPassword, account.passwordHash))) {
			return NextResponse.json({ error: "Your current password is incorrect." }, { status: 400 });
		}
		if (await compare(parsed.data.newPassword, account.passwordHash)) {
			return NextResponse.json({ error: "Choose a new password different from your current password." }, { status: 400 });
		}

		const passwordHash = await hash(parsed.data.newPassword, 12);
		const tokenHash = hashSessionToken(sessionToken);
		await db.$transaction([
			db.user.update({ where: { id: user.id }, data: { passwordHash } }),
			db.authSession.deleteMany({ where: { userId: user.id, tokenHash: { not: tokenHash } } }),
		]);
		return NextResponse.json({ success: true });
	} catch (error) {
		if (error instanceof SyntaxError) {
			return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
		}
		console.error("Unable to change dashboard password.", error);
		return NextResponse.json({ error: "Unable to change your password right now." }, { status: 503 });
	}
}
