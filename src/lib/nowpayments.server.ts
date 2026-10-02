// Server-only NOWPayments helpers. Never import from client code.
import { createHmac } from "crypto";

const API = "https://api.nowpayments.io/v1";

export function nowPaymentsConfig() {
  const apiKey = (process.env["NOWPAYMENTS_API_KEY"] || "").trim();
  const ipnSecret = (process.env["NOWPAYMENTS_IPN_SECRET"] || "").trim();
  return { apiKey, ipnSecret, ready: apiKey.length > 0 };
}

async function npFetch(path: string, init?: RequestInit) {
  const { apiKey } = nowPaymentsConfig();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, json };
}

/** Create a hosted crypto invoice the user can pay with any supported coin. */
export async function createInvoice(args: {
  amountUsd: number;
  orderId: string;
  orderDescription: string;
  ipnCallbackUrl: string;
  successUrl: string;
  cancelUrl: string;
}) {
  return npFetch("/invoice", {
    method: "POST",
    body: JSON.stringify({
      price_amount: Number(args.amountUsd.toFixed(2)),
      price_currency: "usd",
      order_id: args.orderId,
      order_description: args.orderDescription,
      ipn_callback_url: args.ipnCallbackUrl,
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
    }),
  });
}

/**
 * Create a direct payment: NOWPayments returns a deposit address the user
 * pays manually (no hosted checkout redirect).
 */
export async function createPayment(args: {
  amountUsd: number;
  payCurrency: string;
  orderId: string;
  orderDescription: string;
  ipnCallbackUrl: string;
}) {
  return npFetch("/payment", {
    method: "POST",
    body: JSON.stringify({
      price_amount: Number(args.amountUsd.toFixed(2)),
      price_currency: "usd",
      pay_currency: args.payCurrency.toLowerCase(),
      order_id: args.orderId,
      order_description: args.orderDescription,
      ipn_callback_url: args.ipnCallbackUrl,
    }),
  });
}

/** Sort object keys recursively — NOWPayments signs the sorted JSON body. */
function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object") {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(src).sort()) out[key] = sortDeep(src[key]);
    return out;
  }
  return value;
}

/** Verify the x-nowpayments-sig HMAC (sha512 over the sorted JSON payload). */
export function verifyIpnSignature(payload: unknown, signature: string | null): boolean {
  const { ipnSecret } = nowPaymentsConfig();
  if (!ipnSecret || !signature) return false;
  const expected = createHmac("sha512", ipnSecret)
    .update(JSON.stringify(sortDeep(payload)))
    .digest("hex");
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}