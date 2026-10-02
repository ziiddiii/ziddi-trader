import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Is crypto deposit configured on the server? */
export const cryptoStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { nowPaymentsConfig } = await import("@/lib/nowpayments.server");
  return { ready: nowPaymentsConfig().ready };
});

/**
 * Open a pending crypto deposit and return the NOWPayments deposit address the
 * user pays manually. The IPN callback credits the balance once it confirms.
 */
export const startCryptoDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { amount: number; coin?: string }) => input)
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as { supabase: any; userId: string };
    const { nowPaymentsConfig, createPayment } = await import("@/lib/nowpayments.server");
    const { resolveCallbackBase } = await import("@/lib/mpesa.server");

    const cfg = nowPaymentsConfig();
    if (!cfg.ready) return { ok: false as const, message: "Crypto deposits are not configured yet." };

    const amount = Math.round(Number(data.amount));
    if (!Number.isFinite(amount) || amount < 1) return { ok: false as const, message: "Enter a valid amount" };

    const coin = (data.coin || "usdttrc20").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!coin) return { ok: false as const, message: "Choose a coin/network" };

    const { data: settings } = await ctx.supabase
      .from("deposit_settings")
      .select("min_deposit, max_deposit, crypto_enabled, crypto_kes_per_usd")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (settings && settings.crypto_enabled === false) {
      return { ok: false as const, message: "Crypto deposits are currently switched off." };
    }
    const min = Number(settings?.min_deposit ?? 0);
    const max = Number(settings?.max_deposit ?? 0);
    if (min && amount < min) return { ok: false as const, message: `Minimum deposit is KES ${min.toLocaleString()}` };
    if (max && amount > max) return { ok: false as const, message: `Maximum deposit is KES ${max.toLocaleString()}` };

    const rate = Number(settings?.crypto_kes_per_usd ?? 130) || 130;
    const amountUsd = Math.max(1, Number((amount / rate).toFixed(2)));

    const { data: row, error } = await ctx.supabase
      .from("deposits")
      .insert({
        user_id: ctx.userId,
        amount,
        phone: "crypto",
        channel: "crypto",
        status: "pending",
      })
      .select("id")
      .single();
    if (error || !row) return { ok: false as const, message: error?.message || "Could not open the deposit" };

    // The IPN looks the deposit up by this reference.
    await ctx.supabase.from("deposits").update({ checkout_request_id: row.id }).eq("id", row.id);

    // NOWPayments accepts the live custom domain, so callbacks point at it directly
    // (M-PESA keeps its own base because Daraja rejects the custom domain).
    const base = (process.env["CRYPTO_CALLBACK_BASE_URL"] || "https://ziiditraders.online")
      .trim()
      .replace(/\/+$/, "") || resolveCallbackBase();
    const res = await createPayment({
      amountUsd,
      payCurrency: coin,
      orderId: row.id,
      orderDescription: `ZiiDi deposit KES ${amount.toLocaleString()}`,
      ipnCallbackUrl: `${base}/api/public/pay/crypto-ipn`,
    });

    const payAddress = typeof res.json["pay_address"] === "string" ? (res.json["pay_address"] as string) : "";
    if (!res.ok || !payAddress) {
      await ctx.supabase
        .from("deposits")
        .update({ status: "failed", admin_note: String(res.json["message"] ?? "Crypto payment failed") })
        .eq("id", row.id);
      return { ok: false as const, message: String(res.json["message"] ?? "Could not create the crypto deposit address") };
    }

    return {
      ok: true as const,
      depositId: row.id as string,
      payAddress,
      payAmount: Number(res.json["pay_amount"] ?? 0),
      payCurrency: String(res.json["pay_currency"] ?? coin).toUpperCase(),
      payinExtraId: res.json["payin_extra_id"] == null ? "" : String(res.json["payin_extra_id"]),
      paymentId: res.json["payment_id"] == null ? "" : String(res.json["payment_id"]),
      amountUsd,
      rate,
      message: "Deposit address ready — send the exact amount to be credited",
    };
  });