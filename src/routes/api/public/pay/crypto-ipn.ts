import { createFileRoute } from "@tanstack/react-router";

/**
 * NOWPayments IPN. A confirmed/finished payment credits the user's ZiiDi
 * balance automatically — no admin action needed.
 */
export const Route = createFileRoute("/api/public/pay/crypto-ipn")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          return new Response("Bad payload", { status: 400 });
        }

        const { verifyIpnSignature } = await import("@/lib/nowpayments.server");
        if (!verifyIpnSignature(payload, request.headers.get("x-nowpayments-sig"))) {
          return new Response("Invalid signature", { status: 401 });
        }

        const orderId = typeof payload["order_id"] === "string" ? payload["order_id"] : "";
        const status = String(payload["payment_status"] ?? "").toLowerCase();
        const paymentId = payload["payment_id"] == null ? "" : String(payload["payment_id"]);
        if (!orderId) return Response.json({ ok: true });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        if (status === "finished" || status === "confirmed") {
          const { error } = await supabaseAdmin.rpc("settle_crypto_deposit", {
            _payment_id: orderId,
            _receipt: paymentId,
          } as never);
          if (error) console.error("[crypto-ipn] settlement failed", error.message);
        } else if (status === "failed" || status === "expired" || status === "refunded") {
          const { error } = await supabaseAdmin.rpc("fail_crypto_deposit", {
            _payment_id: orderId,
            _reason: `Crypto payment ${status}`,
          } as never);
          if (error) console.error("[crypto-ipn] failure update failed", error.message);
        }

        return Response.json({ ok: true });
      },
    },
  },
});