import { supabase } from "@/integrations/supabase/client";
import { sendUserNotificationEmail } from "@/lib/email-notify.functions";

export type NotifyKind =
  | "auth"
  | "security"
  | "purchase"
  | "deposit"
  | "payment"
  | "bond"
  | "investment"
  | "sale"
  | "reversal"
  | "withdrawal"
  | "kyc"
  | "approval"
  | "lock"
  | "autoinvest"
  | "message"
  | "info";

export type NotifyDetail = { label: string; value: string };

/**
 * Insert an in-dashboard notification for a user. Real-time channel + bell
 * component picks it up automatically and shows a toast.
 *
 * Email alerts activate automatically for the same events once an email
 * sender domain is verified for the workspace.
 */
export async function notify(
  userId: string | null | undefined,
  kind: NotifyKind,
  title: string,
  body: string,
  receipt?: { reference?: string; details?: NotifyDetail[] },
) {
  if (!userId) return;
  try {
    await supabase.from("notifications").insert({
      user_id: userId,
      kind,
      title,
      body,
    });
  } catch {
    /* non-fatal */
  }
  // Fire-and-forget email alert. Silently ignored if user has no email or
  // domain isn't verified yet.
  try {
    void sendUserNotificationEmail({
      data: {
        userId,
        kind,
        title,
        body,
        reference: receipt?.reference,
        details: receipt?.details,
      },
    });
  } catch {
    /* non-fatal */
  }
}