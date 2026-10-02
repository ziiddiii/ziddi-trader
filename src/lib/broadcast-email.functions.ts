import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

/**
 * Admin-only: broadcast a notification email to every registered user
 * using the standard branded user-notification template.
 */
export const broadcastEmailToAllUsers = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { title: string; body: string; test?: boolean }) => {
    const title = (input.title ?? '').trim()
    const body = (input.body ?? '').trim()
    if (!title || title.length > 150) throw new Error('Subject must be 1-150 characters')
    if (!body || body.length > 5000) throw new Error('Message must be 1-5000 characters')
    return { title, body, test: !!input.test }
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc('has_role', {
      _user_id: context.userId,
      _role: 'admin',
    })
    if (!isAdmin) throw new Error('Forbidden')

    const { sendTemplateEmail } = await import('@/lib/email-templates/send-email')

    const emails: string[] = []
    // Undeliverable placeholder/demo addresses: sending to them creates hard
    // bounces that damage sender reputation and eat the hourly allowance.
    const isUndeliverable = (e: string) => {
      const d = e.split('@')[1]?.toLowerCase() ?? ''
      return (
        !d ||
        d === 'example.com' ||
        d === 'example.org' ||
        d === 'example.net' ||
        d === 'admin.com' ||
        d === 'test.com' ||
        d.endsWith('.local') ||
        d.endsWith('.test') ||
        d.endsWith('.invalid') ||
        d.endsWith('.localhost')
      )
    }
    if (data.test) {
      const { data: me } = await context.supabase.auth.getUser()
      if (me?.user?.email) emails.push(me.user.email)
    } else if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      // Works on any host: admin-only database listing of users.
      const { data: list } = await context.supabase.rpc('admin_list_users')
      for (const u of (list ?? []) as { email?: string | null }[]) if (u.email) emails.push(u.email)
    } else {
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
      for (let page = 1; page <= 20; page++) {
        const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 })
        if (error) break
        const users = list?.users ?? []
        for (const u of users) if (u.email) emails.push(u.email)
        if (users.length < 200) break
      }
    }

    const stamp = Date.now()
    let sent = 0
    let skipped = 0
    let failed = 0
    let rateLimited = 0
    const invalid = emails.filter(isUndeliverable).length
    const targets = emails.filter((e) => !isUndeliverable(e))

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

    const deliver = (email: string) =>
      sendTemplateEmail('user-notification', email, {
        templateData: {
          title: data.title,
          body: data.body,
          kind: 'announcement',
          siteUrl: process.env.SITE_URL || 'https://www.ziiditraders.online',
        },
        idempotencyKey: `broadcast-${stamp}-${email}`,
      })

    const sendOne = async (email: string) => {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await deliver(email)
          if (res?.sent) sent++
          else skipped++
          return
        } catch (err) {
          const status = (err as { status?: number })?.status
          if (status === 429 && attempt === 0) {
            const wait = (err as { retryAfterSeconds?: number })?.retryAfterSeconds ?? 5
            await sleep(Math.min(Math.max(wait, 1), 10) * 1000)
            continue
          }
          if (status === 429) rateLimited++
          else failed++
          return
        }
      }
    }

    // Send in parallel with a small worker pool — fast but still polite.
    const queue = [...new Set(targets)]
    const CONCURRENCY = 10
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
        while (queue.length) {
          const email = queue.shift()!
          await sendOne(email)
        }
      }),
    )

    return { total: targets.length, sent, skipped, failed, rateLimited, invalid }
  })
