import { NextResponse } from "next/server";
import { deliverPendingApprovalEmails } from "@/lib/approval-email";
import { suspendExpiredUnapprovedAccounts } from "@/lib/account-approval";
import { safeSecretMatch } from "@/lib/auth";

export async function GET(request: Request) {
	const expectedSecret = process.env.CRON_SECRET;
	const authorization = request.headers.get("authorization") ?? "";
	const providedSecret = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
	if (!expectedSecret) {
		return NextResponse.json({ error: "The scheduled job secret is not configured." }, { status: 503 });
	}
	if (!safeSecretMatch(providedSecret, expectedSecret)) {
		return NextResponse.json({ error: "Scheduled job authorization failed." }, { status: 401 });
	}

	try {
		const suspendedAccounts = await suspendExpiredUnapprovedAccounts();
		const emailDelivery = await deliverPendingApprovalEmails(20);
		return NextResponse.json({ suspendedAccounts, emailDelivery });
	} catch (error) {
		console.error("Scheduled account maintenance failed.", error);
		return NextResponse.json({ error: "Scheduled account maintenance failed." }, { status: 503 });
	}
}
