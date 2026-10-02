import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/pay/b2c-timeout")({
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
              .from("mpesa_payouts")
              .update({ status: "timeout", result_desc: "M-PESA request timed out", raw_result: payload })
              .eq("conversation_id", conversationId);
          }
        } catch (e) {
          console.error("[mpesa b2c-timeout]", e);
        }
        return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
      },
    },
  },
});