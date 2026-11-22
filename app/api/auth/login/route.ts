import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { accountApprovalGracePeriodMs, suspendExpiredUnapprovedAccounts } from "@/lib/account-approval";
import { createAuthSession, isSameOrigin, sessionCookieName, sessionLifetimeSeconds } from "@/lib/auth";
import { getPrismaClient } from "@/lib/prisma";

const loginSchema = z.object({
	email: z.email().trim().toLowerCase().max(160),
	password: z.string().min(1).max(128),
});

export async function POST(request: Request) {
	if (!isSameOrigin(request)) {
		return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
	}

	try {
		const parsed = loginSchema.safeParse(await request.json());
		if (!parsed.success) {
			return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
		}

		const user = await getPrismaClient().user.findUnique({
			where: { email: parsed.data.email },
		});
		if (!user || !(await compare(parsed.data.password, user.passwordHash))) {
			return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
		}
		if (
			user.approvalStatus === "PENDING" &&
			user.createdAt.getTime() <= Date.now() - accountApprovalGracePeriodMs
		) {
			await suspendExpiredUnapprovedAccounts([user.id]);
			return NextResponse.json({ error: "This account was suspended because it was not approved within five days." }, { status: 403 });
		}
		if (user.status !== "ACTIVE") {
			return NextResponse.json({ error: "This account is suspended. Contact an administrator for help." }, { status: 403 });
		}

		const [, session] = await Promise.all([
			getPrismaClient().user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
			createAuthSession(user.id),
		]);
		const response = NextResponse.json({
			user: {
				id: user.id,
				name: user.name,
				email: user.email,
				phone: user.phone,
				location: user.location,
				category: user.category,
				role: user.role,
				approvalStatus: user.approvalStatus,
			},
		});
		response.cookies.set(sessionCookieName, session.token, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			path: "/",
			expires: session.expiresAt,
			maxAge: sessionLifetimeSeconds,
		});
		return response;
	} catch (error) {
		if (error instanceof SyntaxError) {
			return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
		}
		console.error("Account login failed.", error);
		return NextResponse.json({ error: "Unable to log in right now." }, { status: 500 });
	}
}
