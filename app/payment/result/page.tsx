"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function PaymentResultPage() {
  const [status, setStatus] = useState("Checking payment status...");
  const [error, setError] = useState("");

  useEffect(() => {
    async function checkStatus() {
      const params = new URLSearchParams(window.location.search);
      const orderTrackingId =
        params.get("OrderTrackingId")?.trim() ||
        params.get("orderTrackingId")?.trim();

      if (!orderTrackingId) {
        setStatus("Payment status unavailable");
        setError("The payment reference is missing.");
        return;
      }

      try {
        const response = await fetch(
          `/api/payments/pesapal/status?orderTrackingId=${encodeURIComponent(orderTrackingId)}`,
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to check payment status.");
        setStatus(data.payment_status_description || data.status || "Payment status received");
      } catch (statusError) {
        setError(statusError instanceof Error ? statusError.message : "Unable to check payment status.");
        setStatus("Payment status unavailable");
      }
    }

    checkStatus();
  }, []);

  return (
    <main className="payment-result">
      <section>
        <p className="section-kicker">Payment status</p>
        <h1>{status}</h1>
        {error && <p role="alert">{error}</p>}
        <Link className="button button-purple" href="/">Return to Kayabula Kids Centre</Link>
      </section>
    </main>
  );
}
