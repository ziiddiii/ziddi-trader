// Server-only Daraja (M-PESA) helpers. Never import from client code.
import { getRequestUrl } from "@tanstack/react-start/server";

/**
 * Daraja validates the callback URL: it must be public HTTPS, on a host that
 * actually resolves, with no reserved words (mpesa/safaricom) in the path.
 * Use the custom domain for Daraja callbacks. Ensure the host resolves and is
 * registered in the Daraja portal.
 */
const DEFAULT_CALLBACK_BASE = "https://ziiditraders.online";

export function resolveCallbackBase(): string {
  const explicit = (process.env["MPESA_CALLBACK_BASE_URL"] || "").trim().replace(/\/+$/, "");
  if (explicit) {
    try {
      const u = new URL(explicit);
      const host = u.hostname.toLowerCase();
      const usable =
        u.protocol === "https:" &&
        host.includes(".") &&
        !host.endsWith(".local") &&
        host !== "localhost" &&
        !host.startsWith("id-preview--") &&
        !host.endsWith(".lovableproject.com");
      if (usable) return `${u.protocol}//${u.host}`;
    } catch {
      /* fall through to the default */
    }
  }
  try {
    const url = getRequestUrl();
    const host = url.hostname.toLowerCase();
    if (
      url.protocol === "https:" &&
      host.includes(".") &&
      host !== "localhost" &&
      !host.startsWith("id-preview--") &&
      !host.endsWith(".lovableproject.com")
    ) {
      return `${url.protocol}//${url.host}`;
    }
  } catch {
    /* not in a request context */
  }
  return DEFAULT_CALLBACK_BASE;
}

type Env = "sandbox" | "production";

function cfg() {
  const env = ((process.env["MPESA_ENV"] || "sandbox").toLowerCase() as Env) === "production" ? "production" : "sandbox";
  const consumerKey = process.env["MPESA_CONSUMER_KEY"];
  const consumerSecret = process.env["MPESA_CONSUMER_SECRET"];
  const shortcode = process.env["MPESA_SHORTCODE"];
  const initiator = process.env["MPESA_INITIATOR_NAME"];
  const credential = process.env["MPESA_SECURITY_CREDENTIAL"];
  const missing = [
    !consumerKey && "MPESA_CONSUMER_KEY",
    !consumerSecret && "MPESA_CONSUMER_SECRET",
    !shortcode && "MPESA_SHORTCODE",
    !initiator && "MPESA_INITIATOR_NAME",
    !credential && "MPESA_SECURITY_CREDENTIAL",
  ].filter(Boolean) as string[];
  if (missing.length) {
    throw new Error(`M-PESA is not configured yet. Missing: ${missing.join(", ")}`);
  }
  const base = env === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
  return {
    env,
    base,
    consumerKey: consumerKey!,
    consumerSecret: consumerSecret!,
    shortcode: shortcode!,
    initiator: initiator!,
    credential: credential!,
  };
}

async function accessToken(): Promise<{ token: string; base: string; c: ReturnType<typeof cfg> }> {
  const c = cfg();
  const auth = btoa(`${c.consumerKey}:${c.consumerSecret}`);
  const res = await fetch(`${c.base}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Daraja auth failed (${res.status}): ${text.slice(0, 300)}`);
  const json = JSON.parse(text) as { access_token?: string };
  if (!json.access_token) throw new Error("Daraja auth returned no access token");
  return { token: json.access_token, base: c.base, c };
}

/** Normalise 07.., +2547.., 7.. into 2547XXXXXXXX */
export function normalisePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  if (digits.length === 9) return `254${digits}`;
  return digits;
}

export function isValidKenyanMsisdn(msisdn: string): boolean {
  return /^254(7|1)\d{8}$/.test(msisdn);
}

export async function darajaB2C(opts: {
  msisdn: string;
  amount: number;
  remarks: string;
  occasion?: string;
  callbackBase: string;
}) {
  const { token, base, c } = await accessToken();
  const body = {
    OriginatorConversationID: crypto.randomUUID(),
    InitiatorName: c.initiator,
    SecurityCredential: c.credential,
    CommandID: "BusinessPayment",
    Amount: Math.round(opts.amount),
    PartyA: c.shortcode,
    PartyB: opts.msisdn,
    Remarks: opts.remarks.slice(0, 100),
    QueueTimeOutURL: `${opts.callbackBase}/api/public/pay/b2c-timeout`,
    ResultURL: `${opts.callbackBase}/api/public/pay/b2c-result`,
    Occasion: (opts.occasion || "").slice(0, 100),
  };
  const res = await fetch(`${base}/mpesa/b2c/v3/paymentrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    json = { raw: text.slice(0, 500) };
  }
  return { ok: res.ok, status: res.status, json, originatorConversationId: body.OriginatorConversationID };
}

export async function darajaAccountBalance(opts: { callbackBase: string }) {
  const { token, base, c } = await accessToken();
  const body = {
    OriginatorConversationID: crypto.randomUUID(),
    Initiator: c.initiator,
    SecurityCredential: c.credential,
    CommandID: "AccountBalance",
    PartyA: c.shortcode,
    IdentifierType: "4",
    Remarks: "Balance check",
    QueueTimeOutURL: `${opts.callbackBase}/api/public/pay/balance-timeout`,
    ResultURL: `${opts.callbackBase}/api/public/pay/balance-result`,
  };
  const res = await fetch(`${base}/mpesa/accountbalance/v1/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    json = { raw: text.slice(0, 500) };
  }
  return { ok: res.ok, status: res.status, json, originatorConversationId: body.OriginatorConversationID };
}

/** Turn Daraja ResultParameters into a flat record. */
export function stkConfig() {
  const env = ((process.env["MPESA_ENV"] || "sandbox").toLowerCase() === "production" ? "production" : "sandbox") as Env;
  const consumerKey = process.env["MPESA_CONSUMER_KEY"];
  const consumerSecret = process.env["MPESA_CONSUMER_SECRET"];
  const shortcode = process.env["MPESA_STK_SHORTCODE"] || process.env["MPESA_SHORTCODE"];
  const passkey = process.env["MPESA_PASSKEY"];
  const missing = [
    !consumerKey && "MPESA_CONSUMER_KEY",
    !consumerSecret && "MPESA_CONSUMER_SECRET",
    !shortcode && "MPESA_STK_SHORTCODE",
    !passkey && "MPESA_PASSKEY",
  ].filter(Boolean) as string[];
  const type = (process.env["MPESA_STK_TYPE"] || "paybill").toLowerCase() === "till" ? "till" : "paybill";
  return {
    ready: missing.length === 0,
    missing,
    env,
    base: env === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke",
    consumerKey: consumerKey ?? "",
    consumerSecret: consumerSecret ?? "",
    shortcode: shortcode ?? "",
    passkey: passkey ?? "",
    partyB: process.env["MPESA_STK_PARTY_B"] || shortcode || "",
    type,
  };
}

function stkTimestamp(d = new Date()): string {
  // Daraja expects Nairobi (UTC+3) local time as YYYYMMDDHHmmss
  const t = new Date(d.getTime() + 3 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getUTCFullYear()}${p(t.getUTCMonth() + 1)}${p(t.getUTCDate())}${p(t.getUTCHours())}${p(t.getUTCMinutes())}${p(t.getUTCSeconds())}`;
}

async function stkAccessToken(c: ReturnType<typeof stkConfig>): Promise<string> {
  const auth = btoa(`${c.consumerKey}:${c.consumerSecret}`);
  const res = await fetch(`${c.base}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Daraja auth failed (${res.status}): ${text.slice(0, 300)}`);
  const json = JSON.parse(text) as { access_token?: string };
  if (!json.access_token) throw new Error("Daraja auth returned no access token");
  return json.access_token;
}

/** M-PESA Express (STK push) — prompts the customer on their phone. */
export async function darajaStkPush(opts: {
  msisdn: string;
  amount: number;
  accountReference: string;
  description: string;
  callbackBase: string;
}) {
  const c = stkConfig();
  if (!c.ready) throw new Error(`M-PESA STK push is not configured yet. Missing: ${c.missing.join(", ")}`);
  const token = await stkAccessToken(c);
  const timestamp = stkTimestamp();
  const password = btoa(`${c.shortcode}${c.passkey}${timestamp}`);
  // Use the custom domain for STK callbacks; it must be registered in Daraja.
  const callbackUrl = `${DEFAULT_CALLBACK_BASE}/api/public/pay/stk-callback`;

  const baseBody = {
    BusinessShortCode: c.shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: c.type === "till" ? "CustomerBuyGoodsOnline" : "CustomerPayBillOnline",
    Amount: Math.round(opts.amount),
    PartyA: opts.msisdn,
    PartyB: c.partyB,
    PhoneNumber: opts.msisdn,
    AccountReference: opts.accountReference.slice(0, 12),
    TransactionDesc: opts.description.slice(0, 13),
  };

  const res = await fetch(`${c.base}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...baseBody, CallBackURL: callbackUrl }),
  });
  let json: Record<string, any> = {};
  const text = await res.text();
  try {
    json = JSON.parse(text) as Record<string, any>;
  } catch {
    json = { raw: text.slice(0, 500) };
  }
  return {
    ok: res.ok && String(json["ResponseCode"] ?? "") === "0",
    status: res.status,
    json,
    callbackUrl,
    checkoutRequestId: (json["CheckoutRequestID"] as string | undefined) ?? null,
    merchantRequestId: (json["MerchantRequestID"] as string | undefined) ?? null,
    message:
      (json["CustomerMessage"] as string | undefined) ||
      (json["errorMessage"] as string | undefined) ||
      (json["ResponseDescription"] as string | undefined) ||
      "M-PESA request failed",
  };
}

/** STK query — confirms the final state of a push if the callback is delayed. */
export async function darajaStkQuery(checkoutRequestId: string) {
  const c = stkConfig();
  if (!c.ready) throw new Error(`M-PESA STK push is not configured yet. Missing: ${c.missing.join(", ")}`);
  const token = await stkAccessToken(c);
  const timestamp = stkTimestamp();
  const password = btoa(`${c.shortcode}${c.passkey}${timestamp}`);
  const res = await fetch(`${c.base}/mpesa/stkpushquery/v1/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      BusinessShortCode: c.shortcode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    }),
  });
  const text = await res.text();
  let json: Record<string, any> = {};
  try {
    json = JSON.parse(text) as Record<string, any>;
  } catch {
    json = { raw: text.slice(0, 500) };
  }
  return {
    resultCode: String(json["ResultCode"] ?? ""),
    resultDesc: String(json["ResultDesc"] ?? json["errorMessage"] ?? ""),
    json,
  };
}

/** Turn Daraja ResultParameters into a flat record. */
export function flattenResultParams(result: any): Record<string, string> {
  const out: Record<string, string> = {};
  const items = result?.ResultParameters?.ResultParameter;
  const arr = Array.isArray(items) ? items : items ? [items] : [];
  for (const it of arr) {
    if (it?.Key != null) out[String(it.Key)] = String(it.Value ?? "");
  }
  return out;
}

/**
 * Account balance comes back as a pipe-delimited string, e.g.
 * "Working Account|KES|1000.00|1000.00|0.00|0.00&Utility Account|KES|..."
 */
export function parseBalanceString(value: string) {
  const accounts = value.split("&").map((chunk) => chunk.split("|"));
  const utility = accounts.find((a) => /utility/i.test(a[0] ?? "")) ?? accounts[0];
  const working = accounts.find((a) => /working/i.test(a[0] ?? "")) ?? accounts[0];
  const num = (v?: string) => (v == null || v === "" ? null : Number(v));
  return {
    working_balance: num(working?.[2]),
    available_balance: num(utility?.[3] ?? utility?.[2]),
    reserved_balance: num(utility?.[4]),
    uncleared_balance: num(utility?.[5]),
  };
}