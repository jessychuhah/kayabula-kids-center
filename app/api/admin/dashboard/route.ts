import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { getCurrentUserForToken, getSessionTokenFromRequest } from "@/lib/auth";
import { getPrismaClient } from "@/lib/prisma";

export async function GET(request: Request) {
	const token = getSessionTokenFromRequest(request);
	try {
		const user = await getCurrentUserForToken(token);
		if (!user) {
			return NextResponse.json({ error: "Please log in to continue." }, { status: 401 });
		}
		if (user.role !== "ADMIN") {
			return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
		}

		const db = getPrismaClient();
		const [successful, pendingCount, userCount, pendingApprovalCount, recentDonations, siteSettings] = await Promise.all([
			db.donation.aggregate({
				where: { status: "SUCCESSFUL", currency: "UGX" },
				_sum: { amount: true },
				_count: { _all: true },
			}),
			db.donation.count({ where: { status: "PENDING" } }),
			db.user.count(),
			db.user.count({ where: { approvalStatus: "PENDING" } }),
			db.donation.findMany({
				orderBy: { createdAt: "desc" },
				take: 8,
				select: {
					id: true,
					reference: true,
					customerName: true,
					amount: true,
					currency: true,
					method: true,
					status: true,
					createdAt: true,
				},
			}),
			db.siteSettings.findUnique({ where: { id: "default" } }),
		]);
		if (!siteSettings) throw new Error("SITE_SETTINGS_NOT_INITIALIZED");

		return NextResponse.json({
			user: { name: user.name, email: user.email },
			summary: {
				successfulAmount: successful._sum.amount ?? 0,
				successfulCount: successful._count._all,
				pendingCount,
				userCount,
				pendingApprovalCount,
				youthSupported: siteSettings.youthSupported,
			},
			recentDonations,
		});
	} catch (error) {
		unstable_rethrow(error);
		console.error("Unable to load the administrator dashboard.", error);
		return NextResponse.json({ error: "Unable to load dashboard data right now." }, { status: 503 });
	}
}
