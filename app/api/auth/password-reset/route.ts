import { randomInt } from "node:crypto";
import { compare, hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { isSameOrigin } from "@/lib/auth";
import { getPrismaClient } from "@/lib/prisma";

const requestSchema = z.object({
	action: z.literal("request"),
	email: z.email().trim().toLowerCase().max(160),
});
const resetSchema = z.object({
	action: z.literal("reset"),
	email: z.email().trim().toLowerCase().max(160),
	code: z.string().regex(/^\d{6}$/),
	password: z.string().min(10).max(128),
});
const genericResponse = {
	message: "If an account exists for that email, a verification code has been sent.",
};
const resendCooldownMs = 60 * 1000;
const codeLifetimeMs = 10 * 60 * 1000;

async function sendResetCode(email: string, code: string) {
	const apiKey = process.env.RESEND_API_KEY;
	const from = process.env.EMAIL_FROM;
	if (!apiKey || !from) throw new Error("Password reset email is not configured.");
	const response = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			from,
			to: [email],
			subject: "Your Kayabula password reset code",
			text: `Your password reset code is ${code}. It expires in 10 minutes. If you did not request this, you can ignore this email.`,
			html: `<p>Your Kayabula password reset code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:5px">${code}</p><p>This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>`,
		}),
		signal: AbortSignal.timeout(10_000),
	});
	const responseText = await response.text();
	if (!response.ok) throw new Error(`Resend returned ${response.status}: ${responseText.slice(0, 300)}`);
}

export async function POST(request: Request) {
	if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
	try {
		const payload: unknown = await request.json();
		const requestData = requestSchema.safeParse(payload);
		const resetData = resetSchema.safeParse(payload);
		if (!requestData.success && !resetData.success) {
			return NextResponse.json({ error: "Check the email, verification code and new password." }, { status: 400 });
		}

		const db = getPrismaClient();
		if (requestData.success) {
			const { email } = requestData.data;
			const user = await db.user.findUnique({ where: { email }, select: { id: true } });
			if (!user) return NextResponse.json(genericResponse);

			const now = new Date();
			const code = randomInt(100_000, 1_000_000).toString();
			const codeHash = await hash(code, 12);
			const existing = await db.passwordResetOtp.findUnique({ where: { email } });
			if (existing && existing.sentAt.getTime() > now.getTime() - resendCooldownMs) {
				return NextResponse.json(genericResponse);
			}
			if (existing) {
				const updated = await db.passwordResetOtp.updateMany({
					where: { id: existing.id, sentAt: { lte: new Date(now.getTime() - resendCooldownMs) } },
					data: { codeHash, expiresAt: new Date(now.getTime() + codeLifetimeMs), attempts: 0, sentAt: now },
				});
				if (!updated.count) return NextResponse.json(genericResponse);
			} else {
				try {
					await db.passwordResetOtp.create({
						data: { email, codeHash, expiresAt: new Date(now.getTime() + codeLifetimeMs), sentAt: now },
					});
				} catch (createError) {
					if (createError && typeof createError === "object" && "code" in createError && createError.code === "P2002") {
						return NextResponse.json(genericResponse);
					}
					throw createError;
				}
			}

			let notificationId: string | null = null;
			try {
				const notification = await db.userNotification.create({
					data: {
						userId: user.id,
						kind: "PASSWORD_RESET_CODE_SENT",
						title: "Password reset code sent",
						message: "A password reset verification code was sent to your email address. It expires in 10 minutes.",
						emailStatus: "SENT",
						emailSentAt: new Date(),
					},
					select: { id: true },
				});
				notificationId = notification.id;
				await sendResetCode(email, code);
			} catch (deliveryError) {
				if (notificationId) await db.userNotification.deleteMany({ where: { id: notificationId } });
				await db.passwordResetOtp.deleteMany({ where: { email, codeHash } });
				console.error("Unable to deliver password reset code.", { email, error: deliveryError });
				return NextResponse.json({ error: "Unable to send a verification code right now. Please try again later." }, { status: 503 });
			}
			return NextResponse.json(genericResponse);
		}

		if (!resetData.success) {
			return NextResponse.json({ error: "Check the email, verification code and new password." }, { status: 400 });
		}
		const { email, code, password } = resetData.data;
		const otp = await db.passwordResetOtp.findUnique({ where: { email } });
		if (!otp || otp.expiresAt <= new Date() || otp.attempts >= 5 || !(await compare(code, otp.codeHash))) {
			if (otp && otp.expiresAt > new Date() && otp.attempts < 5) {
				await db.passwordResetOtp.updateMany({
					where: { id: otp.id, attempts: { lt: 5 } },
					data: { attempts: { increment: 1 } },
				});
			}
			return NextResponse.json({ error: "The verification code is invalid or expired. Request a new code and try again." }, { status: 400 });
		}

		const passwordHash = await hash(password, 12);
		const changed = await db.$transaction(async (transaction) => {
			const claimed = await transaction.passwordResetOtp.deleteMany({
				where: {
					id: otp.id,
					codeHash: otp.codeHash,
					attempts: otp.attempts,
					expiresAt: { gt: new Date() },
				},
			});
			if (!claimed.count) return false;
			await transaction.user.update({ where: { email }, data: { passwordHash } });
			await transaction.authSession.deleteMany({ where: { user: { email } } });
			return true;
		});
		if (!changed) return NextResponse.json({ error: "The verification code has already been used or expired. Request a new code." }, { status: 400 });
		return NextResponse.json({ success: true, message: "Your password has been reset. You can now sign in." });
	} catch (error) {
		unstable_rethrow(error);
		if (error instanceof SyntaxError) return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
		console.error("Password reset failed.", error);
		return NextResponse.json({ error: "Unable to reset your password right now." }, { status: 503 });
	}
}
