import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden: admin access required");
}

export const sendMpesaPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { phone: string; amount: number; remarks?: string; occasion?: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { normalisePhone, isValidKenyanMsisdn, darajaB2C, resolveCallbackBase } = await import("@/lib/mpesa.server");
    const callbackBase = resolveCallbackBase;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const msisdn = normalisePhone(data.phone);
    if (!isValidKenyanMsisdn(msisdn)) throw new Error("Enter a valid Safaricom number, e.g. 0712345678");
    const amount = Math.round(Number(data.amount));
    if (!Number.isFinite(amount) || amount < 1) throw new Error("Enter a valid amount");

    const remarks = (data.remarks || "Payout").trim() || "Payout";
    const { data: row, error: insertError } = await supabaseAdmin
      .from("mpesa_payouts")
      .insert({
        phone: msisdn,
        amount,
        remarks,
        occasion: data.occasion ?? null,
        status: "pending",
        created_by: (context as any).userId,
      })
      .select("id")
      .single();
    if (insertError || !row) throw new Error(insertError?.message || "Could not record the payout");

    try {
      const res = await darajaB2C({
        msisdn,
        amount,
        remarks,
        occasion: data.occasion,
        callbackBase: callbackBase(),
      });
      const json = res.json as Record<string, any>;
      const accepted = res.ok && String(json?.["ResponseCode"] ?? "") === "0";
      await supabaseAdmin
        .from("mpesa_payouts")
        .update({
          status: accepted ? "queued" : "failed",
          conversation_id: json?.["ConversationID"] ?? null,
          originator_conversation_id: json?.["OriginatorConversationID"] ?? res.originatorConversationId,
          result_desc: json?.["ResponseDescription"] ?? json?.["errorMessage"] ?? null,
          result_code: json?.["ResponseCode"] ?? json?.["errorCode"] ?? null,
          raw_response: json,
        })
        .eq("id", row.id);

      if (!accepted) {
        return {
          ok: false as const,
          id: row.id,
          message: String(json?.["errorMessage"] ?? json?.["ResponseDescription"] ?? "M-PESA rejected the request"),
        };
      }
      return { ok: true as const, id: row.id, message: "Payout sent to M-PESA for processing" };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Payout failed";
      await supabaseAdmin.from("mpesa_payouts").update({ status: "failed", result_desc: message }).eq("id", row.id);
      return { ok: false as const, id: row.id, message };
    }
  });

export const checkMpesaBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as any);
    const { darajaAccountBalance, resolveCallbackBase } = await import("@/lib/mpesa.server");
    const callbackBase = resolveCallbackBase;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error: insertError } = await supabaseAdmin
      .from("mpesa_balance_checks")
      .insert({ status: "pending", requested_by: (context as any).userId })
      .select("id")
      .single();
    if (insertError || !row) throw new Error(insertError?.message || "Could not start the balance check");

    try {
      const res = await darajaAccountBalance({ callbackBase: callbackBase() });
      const json = res.json as Record<string, any>;
      const accepted = res.ok && String(json?.["ResponseCode"] ?? "") === "0";
      await supabaseAdmin
        .from("mpesa_balance_checks")
        .update({
          status: accepted ? "queued" : "failed",
          conversation_id: json?.["ConversationID"] ?? null,
          originator_conversation_id: json?.["OriginatorConversationID"] ?? res.originatorConversationId,
          result_code: json?.["ResponseCode"] ?? json?.["errorCode"] ?? null,
          result_desc: json?.["ResponseDescription"] ?? json?.["errorMessage"] ?? null,
          raw_response: json,
        })
        .eq("id", row.id);
      return {
        ok: accepted,
        id: row.id,
        message: accepted
          ? "Balance requested — M-PESA will report it in a few seconds"
          : String(json?.["errorMessage"] ?? json?.["ResponseDescription"] ?? "M-PESA rejected the request"),
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Balance check failed";
      await supabaseAdmin.from("mpesa_balance_checks").update({ status: "failed", result_desc: message }).eq("id", row.id);
      return { ok: false, id: row.id, message };
    }
  });

/** Is STK push configured? Used by the deposit page to pick the flow. */
export const mpesaStkStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { stkConfig } = await import("@/lib/mpesa.server");
  const c = stkConfig();
  return { ready: c.ready, env: c.env, type: c.type };
});

/** Trigger an STK push for the signed-in user and open a pending deposit. */
export const startStkDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { amount: number; phone: string }) => input)
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as { supabase: any; userId: string };
    const { normalisePhone, isValidKenyanMsisdn, darajaStkPush, stkConfig, resolveCallbackBase } = await import(
      "@/lib/mpesa.server"
    );
    const callbackBase = resolveCallbackBase;

    const cfg = stkConfig();
    if (!cfg.ready) {
      return { ok: false, configured: false, message: "Instant M-PESA push is not configured yet." };
    }

    const msisdn = normalisePhone(String(data.phone ?? ""));
    if (!isValidKenyanMsisdn(msisdn)) {
      return { ok: false, configured: true, message: "Enter a valid Safaricom number, e.g. 0712345678" };
    }

    const amount = Math.round(Number(data.amount));
    if (!Number.isFinite(amount) || amount < 1) {
      return { ok: false, configured: true, message: "Enter a valid amount" };
    }

    // Enforce the admin-configured deposit range server-side.
    const { data: settings } = await ctx.supabase
      .from("deposit_settings")
      .select("min_deposit, max_deposit, account_number, stk_enabled")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (settings && settings.stk_enabled === false) {
      return { ok: false, configured: false, message: "Automatic M-PESA prompt is currently switched off." };
    }
    const min = Number(settings?.min_deposit ?? 0);
    const max = Number(settings?.max_deposit ?? 0);
    if (min && amount < min) {
      return { ok: false, configured: true, message: `Minimum deposit is KES ${min.toLocaleString()}` };
    }
    if (max && amount > max) {
      return { ok: false, configured: true, message: `Maximum deposit is KES ${max.toLocaleString()}` };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error: insertError } = await supabaseAdmin
      .from("deposits")
      .insert({
        user_id: ctx.userId,
        amount,
        phone: msisdn,
        status: "pending",
        channel: "stk",
      })
      .select("id")
      .single();
    if (insertError || !row) throw new Error(insertError?.message || "Could not open the deposit request");

    try {
      const push = await darajaStkPush({
        msisdn,
        amount,
        accountReference: "ZiiDi MMF",
        description: "ZiiDi deposit",
        callbackBase: callbackBase(),
      });

      if (!push.ok || !push.checkoutRequestId) {
        await supabaseAdmin
          .from("deposits")
          .update({ status: "rejected", admin_note: push.message, updated_at: new Date().toISOString() })
          .eq("id", row.id);
        return { ok: false, configured: true, depositId: row.id, message: push.message };
      }

      await supabaseAdmin
        .from("deposits")
        .update({
          checkout_request_id: push.checkoutRequestId,
          merchant_request_id: push.merchantRequestId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      return {
        ok: true,
        configured: true,
        depositId: row.id,
        checkoutRequestId: push.checkoutRequestId,
        message: push.message || "Enter your M-PESA PIN on your phone to complete the deposit",
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "M-PESA request failed";
      await supabaseAdmin
        .from("deposits")
        .update({ status: "rejected", admin_note: message, updated_at: new Date().toISOString() })
        .eq("id", row.id);
      return { ok: false, configured: true, depositId: row.id, message };
    }
  });

/**
 * Safety net: if Safaricom's callback is delayed or lost, the client asks us to
 * confirm the push directly and settle it. Idempotent.
 */
export const confirmStkDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { depositId: string }) => input)
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as { supabase: any; userId: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: dep } = await supabaseAdmin
      .from("deposits")
      .select("id, user_id, status, checkout_request_id")
      .eq("id", data.depositId)
      .maybeSingle();
    if (!dep || dep.user_id !== ctx.userId) throw new Error("Deposit not found");
    if (dep.status !== "pending") return { status: dep.status };
    if (!dep.checkout_request_id) return { status: "pending" };

    const { darajaStkQuery } = await import("@/lib/mpesa.server");
    const q = await darajaStkQuery(dep.checkout_request_id);

    if (q.resultCode === "0") {
      await supabaseAdmin.rpc("settle_stk_deposit", {
        _checkout_request_id: dep.checkout_request_id,
      } as never);
      return { status: "approved" };
    }
    // 1032 = cancelled by user, 1037 = timeout, 1 = insufficient funds
    if (["1032", "1037", "1", "1001", "2001"].includes(q.resultCode)) {
      await supabaseAdmin.rpc("fail_stk_deposit", {
        _checkout_request_id: dep.checkout_request_id,
        _reason: q.resultDesc || "The M-PESA prompt was not completed",
      });
      return { status: "rejected", message: q.resultDesc };
    }
    return { status: "pending" };
  });