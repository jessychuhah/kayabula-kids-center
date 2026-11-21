import { NextResponse } from "next/server";
import { z } from "zod";
import { getPesapalToken, pesapalBaseUrl, requirePesapalConfig } from "@/lib/pesapal";

const donationSchema = z.object({
  amount: z.coerce.number().positive().max(100000000),
  currency: z.enum(["UGX", "USD", "EUR", "GBP", "KES", "TZS", "RWF"]),
  name: z.string().trim().min(2).max(100).default("Kayabula supporter"),
  email: z.string().email().max(160).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional(),
});

export async function POST(request: Request) {
  try {
    const body = donationSchema.parse(await request.json());
    const { ipnId, callbackUrl } = requirePesapalConfig();
    const token = await getPesapalToken();
    const reference = `KAYABULA-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

    const response = await fetch(`${pesapalBaseUrl()}/api/Transactions/SubmitOrderRequest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        id: reference,
        currency: body.currency,
        amount: body.amount,
        description: "Donation to Kayabula Kids Centre",
        callback_url: callbackUrl,
        notification_id: ipnId,
        billing_address: {
          email_address: body.email || "",
          phone_number: body.phone || "",
          country_code: "UG",
          first_name: body.name,
          last_name: "",
          line_1: "Sanyu Road, Kampala",
          city: "Kampala",
          state: "Kampala",
        },
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Pesapal order request failed with status ${response.status}.`);
    }

    const data = await response.json();
    if (!data.redirect_url || !data.order_tracking_id) {
      throw new Error("Pesapal did not return a redirect URL or tracking ID.");
    }

    return NextResponse.json({
      redirectUrl: data.redirect_url,
      reference,
      orderTrackingId: data.order_tracking_id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to initiate payment.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
