import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getPrismaClient } from "@/lib/prisma";

export const sessionCookieName = "kayabula_session";
export const sessionLifetimeSeconds = 60 * 60 * 24 * 30;

export type AuthUser = {
	id: string;
	name: string;
	email: string;
	phone: string;
	role: string;
};

export function newSessionToken() {
	return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string) {
	return createHash("sha256").update(token).digest("hex");
}

export function safeSecretMatch(provided: string, expected: string | undefined) {
	if (!expected) return false;
	const providedBytes = Buffer.from(provided);
	const expectedBytes = Buffer.from(expected);
	return (
		providedBytes.length === expectedBytes.length &&
		timingSafeEqual(providedBytes, expectedBytes)
	);
}

export function isSameOrigin(request: Request) {
	const origin = request.headers.get("origin");
	return origin !== null && origin === new URL(request.url).origin;
}

export async function getCurrentUserForToken(token: string | undefined): Promise<AuthUser | null> {
	if (!token) return null;

	const db = getPrismaClient();
	const session = await db.authSession.findUnique({
		where: { tokenHash: hashSessionToken(token) },
		include: { user: true },
	});

	if (!session) return null;
	if (session.expiresAt <= new Date()) {
		await db.authSession.deleteMany({ where: { id: session.id } });
		return null;
	}

	return {
		id: session.user.id,
		name: session.user.name,
		email: session.user.email,
		phone: session.user.phone,
		role: session.user.role,
	};
}

export async function getCurrentUser(): Promise<AuthUser | null> {
	const token = (await cookies()).get(sessionCookieName)?.value;
	return getCurrentUserForToken(token);
}

export function getSessionTokenFromRequest(request: Request) {
	const cookie = request.headers
		.get("cookie")
		?.split(";")
		.map((part) => part.trim())
		.find((part) => part.startsWith(`${sessionCookieName}=`));
	return cookie?.slice(sessionCookieName.length + 1);
}

export async function getCurrentUserFromRequest(request: Request): Promise<AuthUser | null> {
	return getCurrentUserForToken(getSessionTokenFromRequest(request));
}

export async function createAuthSession(userId: string) {
	const token = newSessionToken();
	const expiresAt = new Date(Date.now() + sessionLifetimeSeconds * 1000);
	await getPrismaClient().authSession.create({
		data: { tokenHash: hashSessionToken(token), userId, expiresAt },
	});
	return { token, expiresAt };
}
