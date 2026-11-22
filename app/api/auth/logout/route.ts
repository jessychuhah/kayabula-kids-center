import { NextResponse } from "next/server";
import { getSessionTokenFromRequest, hashSessionToken, isSameOrigin, sessionCookieName } from "@/lib/auth";
import { getPrismaClient } from "@/lib/prisma";

export async function POST(request: Request) {
	if (!isSameOrigin(request)) {
		return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
	}

	try {
		const token = getSessionTokenFromRequest(request);
		if (token) {
			await getPrismaClient().authSession.deleteMany({
				where: { tokenHash: hashSessionToken(token) },
			});
		}

		const response = NextResponse.json({ success: true });
		response.cookies.set(sessionCookieName, "", {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			path: "/",
			maxAge: 0,
		});
		return response;
	} catch (error) {
		console.error("Account logout failed.", error);
		return NextResponse.json({ error: "Unable to log out right now. " }, { status: 500 });
	}
}
