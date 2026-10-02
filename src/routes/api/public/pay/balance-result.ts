import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/pay/balance-result")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const payload = (await request.json()) as any;
          const result = payload?.Result ?? payload;
          const { flattenResultParams, parseBalanceString } = await import("@/lib/mpesa.server");
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const params = flattenResultParams(result);
          const code = String(result?.ResultCode ?? "");
          const balances = params["AccountBalance"] ? parseBalanceString(params["AccountBalance"]) : {};
          const conversationId = result?.ConversationID ?? null;
          const originator = result?.OriginatorConversationID ?? null;

          const update = {
            status: code === "0" ? "completed" : "failed",
            result_code: code,
            result_desc: result?.ResultDesc ?? null,
            raw_result: payload,
            ...balances,
          };

          let query = supabaseAdmin.from("mpesa_balance_checks").update(update);
          if (conversationId) query = query.eq("conversation_id", conversationId);
          else if (originator) query = query.eq("originator_conversation_id", originator);
          else return Response.json({ ResultCode: 0, ResultDesc: "Ignored" });
          await query;
        } catch (e) {
          console.error("[mpesa balance-result]", e);
        }
        return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
      },
    },
  },
});