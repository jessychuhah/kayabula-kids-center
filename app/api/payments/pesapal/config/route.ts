import { NextResponse } from "next/server";

export async function GET() {
  const configured = Boolean(
    process.env.PESAPAL_CONSUMER_KEY &&
      process.env.PESAPAL_CONSUMER_SECRET &&
      process.env.PESAPAL_IPN_ID &&
      process.env.PESAPAL_CALLBACK_URL,
  );

  return NextResponse.json({ configured });
}
