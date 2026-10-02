import { createFileRoute } from "@tanstack/react-router";

/**
 * M-PESA Express (STK push) callback. Safaricom posts the final outcome here,
 * and a successful payment is settled automatically — the user's ZiiDi balance
 * is credited with no admin action.
 */
export const Route = createFileRoute("/api/public/pay/stk-callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleStkCallback } = await import("@/lib/mpesa-callback.server");
        return handleStkCallback(request);
      },
    },
  },
});
