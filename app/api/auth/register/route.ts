import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthSession, isSameOrigin, sessionCookieName, sessionLifetimeSeconds } from "@/lib/auth";
import { getPrismaClient } from "@/lib/prisma";

const registerSchema = z.object({
	name: z.string().trim().min(2).max(100),
	email: z.email().trim().toLowerCase().max(160),
	phone: z.string().trim().min(5).max(40),
	location: z.string().trim().max(120).optional().default(""),
	category: z.enum(["SUPPORTER", "VOLUNTEER", "YOUTH_MEMBER"]).optional(),
	password: z.string().min(10).max(128),
});

export async function POST(request: Request) {
	if (!isSameOrigin(request)) {
		return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
	}

	try {
		const parsed = registerSchema.safeParse(await request.json());
		if (!parsed.success) {
			return NextResponse.json({ error: "Check your name, email, phone and password." }, { status: 400 });
		}

		const { name, email, phone, location, category, password } = parsed.data;
		const passwordHash = await hash(password, 12);
		const db = getPrismaClient();
		const user = await db.user.create({
			data: {
				name,
				email,
				phone,
				location: location || null,
				category,
				passwordHash,
				role: "USER",
				approvalStatus: "PENDING",
			},
			select: {
				id: true,
				name: true,
				email: true,
				phone: true,
				location: true,
				category: true,
				profileImageUrl: true,
				role: true,
				approvalStatus: true,
			},
		});

		const session = await createAuthSession(user.id);
		const response = NextResponse.json({ user }, { status: 201 });
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
		if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
			return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
		}

		console.error("Account registration failed.", error);
		return NextResponse.json({ error: "Unable to create the account right now." }, { status: 500 });
	}
}
