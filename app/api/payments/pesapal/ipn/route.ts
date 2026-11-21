import { NextResponse } from "next/server";
import { checkPesapalTransaction, getPesapalToken } from "@/lib/pesapal";

async function handleNotification(request: Request) {
  const url = new URL(request.url);
  const orderTrackingId =
    url.searchParams.get("OrderTrackingId")?.trim() ||
    url.searchParams.get("orderTrackingId")?.trim();

  if (!orderTrackingId) {
    return NextResponse.json({ error: "Missing order tracking ID." }, { status: 400 });
  }

  try {
    const token = await getPesapalToken();
    const status = await checkPesapalTransaction(token, orderTrackingId);

    // Return 200 to acknowledge the provider callback.
    // Persist status in PostgreSQL in the reconciliation layer.
    return NextResponse.json({ orderTrackingId, status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to verify notification.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export function GET(request: Request) {
  return handleNotification(request);
}

export function POST(request: Request) {
  return handleNotification(request);
}
