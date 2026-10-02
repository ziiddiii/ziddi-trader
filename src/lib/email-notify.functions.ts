import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

/**
 * Sends an app-notification email to a specific user by userId.
 * Requires the caller to be authenticated. Fetches the recipient's email
 * via admin lookup, then sends through the managed email API.
 *
 * Fire-and-forget from the client — failures are swallowed to keep UX
 * flows uninterrupted. Delivery is logged in Cloud → Emails.
 */
export const sendUserNotificationEmail = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      userId: string
      title: string
      body: string
      kind?: string
      idempotencyKey?: string
      reference?: string
      details?: { label: string; value: string }[]
    }) => input,
  )
  .handler(async ({ data, context }) => {
    try {
      // Look up the recipient. Uses the guarded database lookup so this works
      // on any host, falling back to the private service key when available.
      let email: string | null = null
      const { data: target } = await context.supabase.rpc(
        'notification_email_target' as never,
        { _user_id: data.userId } as never,
      )
      if (typeof target === 'string' && target) email = target
      if (!email && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(data.userId)
        email = userRes?.user?.email ?? null
      }
      if (!email) return { sent: false, reason: 'no_email' as const }

      const { sendTemplateEmail } = await import(
        '@/lib/email-templates/send-email'
      )
      const result = await sendTemplateEmail('user-notification', email, {
        templateData: {
          title: data.title,
          body: data.body,
          kind: data.kind,
          reference: data.reference,
          details: data.details,
          siteUrl: process.env.SITE_URL || 'https://www.ziiditraders.online',
        },
        idempotencyKey:
          data.idempotencyKey ||
          `notify-${data.userId}-${data.title}-${Date.now()}`,
      })
      return result
    } catch (err) {
      console.error('sendUserNotificationEmail failed', err)
      return { sent: false, reason: 'error' as const }
    }
  })