import { NextResponse } from "next/server";
import { getCurrentUserForToken, getSessionTokenFromRequest } from "@/lib/auth";

export async function GET(request: Request) {
	const token = getSessionTokenFromRequest(request);
	try {
		return NextResponse.json({ user: await getCurrentUserForToken(token) });
	} catch (error) {
		console.error("Unable to load the current account.", error);
		return NextResponse.json({ error: "Unable to load your account right now." }, { status: 503 });
	}
}
