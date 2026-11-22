import { getPrismaClient } from "@/lib/prisma";

type ProviderStatus = {
	payment_status_code?: string | number;
	payment_status_description?: string;
	status?: string;
};

export function toDonationStatus(providerStatus: ProviderStatus) {
	const code = String(providerStatus.payment_status_code ?? "").toUpperCase();
	const description = `${providerStatus.payment_status_description ?? ""} ${providerStatus.status ?? ""}`.toUpperCase();

	if (code === "1" || description.includes("COMPLETED") || description.includes("SUCCESS")) {
		return "SUCCESSFUL";
	}
	if (code === "2" || description.includes("FAILED")) return "FAILED";
	if (code === "3" || description.includes("REVERSED")) return "REVERSED";
	return "PENDING";
}

export async function saveVerifiedDonationStatus(
	orderTrackingId: string,
	providerStatus: ProviderStatus,
) {
	return getPrismaClient().donation.updateMany({
		where: { providerRef: orderTrackingId },
		data: { status: toDonationStatus(providerStatus) },
	});
}
