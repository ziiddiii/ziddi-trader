import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/pay/balance-timeout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const payload = (await request.json()) as any;
          const result = payload?.Result ?? payload;
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const conversationId = result?.ConversationID ?? null;
          if (conversationId) {
            await supabaseAdmin
              .from("mpesa_balance_checks")
              .update({ status: "timeout", result_desc: "Balance request timed out", raw_result: payload })
              .eq("conversation_id", conversationId);
          }
        } catch (e) {
          console.error("[mpesa balance-timeout]", e);
        }
        return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
      },
    },
  },
});