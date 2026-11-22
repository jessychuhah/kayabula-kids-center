import { NextResponse } from "next/server";
import { checkPesapalTransaction, getPesapalToken } from "@/lib/pesapal";
import { saveVerifiedDonationStatus } from "@/lib/donation-status";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orderTrackingId = searchParams.get("orderTrackingId")?.trim();

  if (!orderTrackingId) {
    return NextResponse.json({ error: "orderTrackingId is required." }, { status: 400 });
  }

  try {
    const token = await getPesapalToken();
    const data = await checkPesapalTransaction(token, orderTrackingId);
    await saveVerifiedDonationStatus(orderTrackingId, data);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to check payment status.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
