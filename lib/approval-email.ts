import "server-only";
import { getPrismaClient } from "@/lib/prisma";

function escapeHtml(value: string) {
	return value.replace(/[&<>"']/g, (character) => ({
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		'"': "&quot;",
		"'": "&#39;",
	})[character] ?? character);
}

export async function deliverPendingApprovalEmails(limit = 10, notificationId?: string) {
	const apiKey = process.env.RESEND_API_KEY;
	const from = process.env.EMAIL_FROM;
	if (!apiKey || !from) return { sent: 0, failed: 0, configured: false };

	const db = getPrismaClient();
	const retryBefore = new Date(Date.now() - 15 * 60 * 1000);
	await db.userNotification.updateMany({
		where: { emailStatus: "SENDING", emailLastAttemptAt: { lt: retryBefore } },
		data: { emailStatus: "PENDING" },
	});
	const notifications = await db.userNotification.findMany({
		where: {
			kind: "ACCOUNT_APPROVED",
			emailStatus: "PENDING",
			...(notificationId ? { id: notificationId } : {}),
		},
		include: { user: { select: { name: true, email: true } } },
		orderBy: { createdAt: "asc" },
		take: limit,
	});

	let sent = 0;
	let failed = 0;
	for (const notification of notifications) {
		const attemptAt = new Date();
		const claimed = await db.userNotification.updateMany({
			where: { id: notification.id, emailStatus: "PENDING" },
			data: {
				emailStatus: "SENDING",
				emailAttempts: { increment: 1 },
				emailLastAttemptAt: attemptAt,
				emailError: null,
			},
		});
		if (!claimed.count) continue;

		try {
			const name = escapeHtml(notification.user.name);
			const response = await fetch("https://api.resend.com/emails", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${apiKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					from,
					to: [notification.user.email],
					subject: notification.title,
					text: `${notification.user.name},\n\n${notification.message}\n\nKayabula Kids Centre`,
					html: `<p>${name},</p><p>${escapeHtml(notification.message)}</p><p>Kayabula Kids Centre</p>`,
				}),
				signal: AbortSignal.timeout(10_000),
			});
			const responseText = await response.text();
			if (!response.ok) throw new Error(`Resend returned ${response.status}: ${responseText.slice(0, 300)}`);
			await db.userNotification.update({
				where: { id: notification.id },
				data: { emailStatus: "SENT", emailSentAt: new Date(), emailError: null },
			});
			sent += 1;
		} catch (error) {
			const message = error instanceof Error ? error.message : "Email delivery failed.";
			await db.userNotification.update({
				where: { id: notification.id },
				data: { emailStatus: "PENDING", emailError: message.slice(0, 500) },
			});
			console.error("Approval email delivery failed.", { notificationId: notification.id, error });
			failed += 1;
		}
	}

	return { sent, failed, configured: true };
}
