import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserFromRequest, isSameOrigin } from "@/lib/auth";
import { getPesapalToken, pesapalBaseUrl, requirePesapalConfig } from "@/lib/pesapal";
import { getPrismaClient } from "@/lib/prisma";

const donationSchema = z.object({
  amount: z.coerce.number().int().min(1000).max(100000000),
  currency: z.enum(["UGX", "USD", "EUR", "GBP", "KES", "TZS", "RWF"]),
  method: z.enum(["MTN MoMo", "Airtel Money", "Visa card"]),
  name: z.string().trim().min(2).max(100),
  email: z.email().max(160),
  phone: z.string().trim().min(5).max(40),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  }

  let reference: string | undefined;
  try {
    const body = donationSchema.parse(await request.json());
    const { ipnId, callbackUrl } = requirePesapalConfig();
    const token = await getPesapalToken();
    const user = await getCurrentUserFromRequest(request);
    const donor = user
      ? { name: user.name, email: user.email, phone: user.phone }
      : { name: body.name, email: body.email, phone: body.phone };
    const db = getPrismaClient();
    reference = `KAYABULA-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

    await db.donation.create({
      data: {
        reference,
        amount: body.amount,
        currency: body.currency,
        method: body.method,
        status: "PENDING",
        customerName: donor.name,
        customerEmail: donor.email,
        customerPhone: donor.phone,
        userId: user?.id,
      },
    });

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
          email_address: donor.email,
          phone_number: donor.phone,
          country_code: "UG",
          first_name: donor.name,
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

    await db.donation.update({
      where: { reference },
      data: { providerRef: data.order_tracking_id },
    });

    return NextResponse.json({
      redirectUrl: data.redirect_url,
      reference,
      orderTrackingId: data.order_tracking_id,
    });
  } catch (error) {
    if (reference) {
      try {
        await getPrismaClient().donation.updateMany({
          where: { reference, status: "PENDING", providerRef: null },
          data: { status: "FAILED" },
        });
      } catch (updateError) {
        console.error("Unable to mark the failed donation attempt.", updateError);
      }
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Enter valid donation and contact details." }, { status: 400 });
    }
    console.error("Unable to initiate a donation.", error);
    return NextResponse.json({ error: "Unable to start checkout. Please try again later." }, { status: 502 });
  }
}
