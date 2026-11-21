export function pesapalBaseUrl() {
  return process.env.PESAPAL_ENVIRONMENT === "production"
    ? "https://pay.pesapal.com/v3"
    : "https://cybqa.pesapal.com/pesapalv3";
}

export function requirePesapalConfig() {
  const consumerKey = process.env.PESAPAL_CONSUMER_KEY;
  const consumerSecret = process.env.PESAPAL_CONSUMER_SECRET;
  const ipnId = process.env.PESAPAL_IPN_ID;
  const callbackUrl = process.env.PESAPAL_CALLBACK_URL;

  if (!consumerKey || !consumerSecret || !ipnId || !callbackUrl) {
    throw new Error("Pesapal environment variables are not configured.");
  }

  return { consumerKey, consumerSecret, ipnId, callbackUrl };
}

export async function getPesapalToken() {
  const { consumerKey, consumerSecret } = requirePesapalConfig();
  const response = await fetch(`${pesapalBaseUrl()}/api/Auth/RequestToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ consumer_key: consumerKey, consumer_secret: consumerSecret }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Pesapal token request failed with status ${response.status}.`);
  }

  const data = await response.json();
  if (!data.token) throw new Error("Pesapal did not return an access token.");
  return data.token as string;
}

export async function checkPesapalTransaction(token: string, orderTrackingId: string) {
  const response = await fetch(
    `${pesapalBaseUrl()}/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(orderTrackingId)}`,
    {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Pesapal status request failed with status ${response.status}.`);
  }

  return response.json();
}
