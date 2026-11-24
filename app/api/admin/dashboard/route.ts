import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { getCurrentUserForToken, getSessionTokenFromRequest, isStaffUser } from "@/lib/auth";
import { getPrismaClient } from "@/lib/prisma";

export async function GET(request: Request) {
	const token = getSessionTokenFromRequest(request);
	try {
		const user = await getCurrentUserForToken(token);
		if (!user) {
			return NextResponse.json({ error: "Please log in to continue." }, { status: 401 });
		}
		if (!isStaffUser(user)) {
			return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
		}

		const db = getPrismaClient();
		const chartStart = new Date();
		chartStart.setUTCDate(1);
		chartStart.setUTCHours(0, 0, 0, 0);
		chartStart.setUTCMonth(chartStart.getUTCMonth() - 5);
		const [successful, pendingCount, userCount, pendingApprovalCount, recentDonations, siteSettings, chartDonations, donationStatuses] = await Promise.all([
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
			db.donation.findMany({
				where: { currency: "UGX", createdAt: { gte: chartStart } },
				select: { amount: true, status: true, createdAt: true },
			}),
			db.donation.groupBy({
				by: ["status"],
				_count: { _all: true },
			}),
		]);
		if (!siteSettings) throw new Error("SITE_SETTINGS_NOT_INITIALIZED");

		const monthlyDonations = Array.from({ length: 6 }, (_, index) => {
			const month = new Date(chartStart);
			month.setUTCMonth(chartStart.getUTCMonth() + index);
			return {
				label: month.toLocaleString("en", { month: "short", timeZone: "UTC" }),
				amount: chartDonations
					.filter((donation) => donation.status === "SUCCESSFUL" && donation.createdAt.getUTCMonth() === month.getUTCMonth() && donation.createdAt.getUTCFullYear() === month.getUTCFullYear())
					.reduce((total, donation) => total + donation.amount, 0),
			};
		});

		return NextResponse.json({
			user: { name: user.name, email: user.email, role: user.role, profileImageUrl: user.profileImageUrl },
			summary: {
				successfulAmount: successful._sum.amount ?? 0,
				successfulCount: successful._count._all,
				pendingCount,
				userCount,
				pendingApprovalCount,
				youthSupported: siteSettings.youthSupported,
				familiesSupported: siteSettings.familiesSupported,
				villagesReached: siteSettings.villagesReached,
			},
			recentDonations,
			analytics: {
				monthlyDonations,
				donationStatuses: donationStatuses.map((status) => ({ status: status.status, count: status._count._all })),
			},
		});
	} catch (error) {
		unstable_rethrow(error);
		console.error("Unable to load the administrator dashboard.", error);
		return NextResponse.json({ error: "Unable to load dashboard data right now." }, { status: 503 });
	}
}
