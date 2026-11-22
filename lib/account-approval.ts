import "server-only";
import { getPrismaClient } from "@/lib/prisma";

export const accountApprovalGracePeriodMs = 5 * 24 * 60 * 60 * 1000;

export async function suspendExpiredUnapprovedAccounts(userIds?: string[]) {
	const now = new Date();
	const cutoff = new Date(now.getTime() - accountApprovalGracePeriodMs);
	const db = getPrismaClient();
	const expiredUsers = await db.user.findMany({
		where: {
			...(userIds ? { id: { in: userIds } } : {}),
			status: "ACTIVE",
			approvalStatus: "PENDING",
			createdAt: { lte: cutoff },
		},
		select: { id: true },
	});
	if (!expiredUsers.length) return 0;

	return db.$transaction(async (transaction) => {
		const stillExpired = await transaction.user.findMany({
			where: {
				id: { in: expiredUsers.map((user) => user.id) },
				status: "ACTIVE",
				approvalStatus: "PENDING",
				createdAt: { lte: cutoff },
			},
			select: { id: true },
		});
		if (!stillExpired.length) return 0;

		const expiredIds = stillExpired.map((user) => user.id);
		await transaction.user.updateMany({
			where: { id: { in: expiredIds } },
			data: { status: "SUSPENDED" },
		});
		await transaction.authSession.deleteMany({ where: { userId: { in: expiredIds } } });
		return expiredIds.length;
	});
}
