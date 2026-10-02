type CallbackItem = { Name?: unknown; Value?: unknown };
type CallbackBody = {
  CheckoutRequestID?: unknown;
  ResultCode?: unknown;
  ResultDesc?: unknown;
  CallbackMetadata?: { Item?: CallbackItem[] };
};

/** Settle an M-PESA Express callback. Safe to call from either callback route. */
export async function handleStkCallback(request: Request): Promise<Response> {
  try {
    const payload = (await request.json()) as {
      Body?: { stkCallback?: CallbackBody };
      stkCallback?: CallbackBody;
    } & CallbackBody;
    const cb = payload.Body?.stkCallback ?? payload.stkCallback ?? payload;
    const checkoutRequestId =
      typeof cb.CheckoutRequestID === "string" ? cb.CheckoutRequestID : undefined;

    if (!checkoutRequestId) {
      return Response.json({ ResultCode: 0, ResultDesc: "Ignored" });
    }

    const resultCode = String(cb.ResultCode ?? "");
    const resultDesc = typeof cb.ResultDesc === "string" ? cb.ResultDesc : "";
    const meta: Record<string, string | number> = {};
    for (const item of Array.isArray(cb.CallbackMetadata?.Item)
      ? cb.CallbackMetadata.Item
      : []) {
      if (item.Name == null || (typeof item.Value !== "string" && typeof item.Value !== "number")) continue;
      meta[String(item.Name)] = item.Value;
    }

    const receipt = meta["MpesaReceiptNumber"] == null ? "" : String(meta["MpesaReceiptNumber"]);
    const paidAmount = meta["Amount"] == null ? undefined : Number(meta["Amount"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (resultCode === "0") {
      const { error } = await supabaseAdmin.rpc("settle_stk_deposit", {
        _checkout_request_id: checkoutRequestId,
        _receipt: receipt,
        _amount: paidAmount,
      } as never);
      if (error) console.error("[stk-callback] settlement failed", error.message);
    } else {
      const { error } = await supabaseAdmin.rpc("fail_stk_deposit", {
        _checkout_request_id: checkoutRequestId,
        _reason: resultDesc || "The M-PESA prompt was not completed",
      } as never);
      if (error) console.error("[stk-callback] failure update failed", error.message);
    }
  } catch (error) {
    console.error("[stk-callback] invalid callback payload", error);
  }

  return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
