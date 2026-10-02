// Server-only, host-independent mail transport.
//
// Pick a provider with the EMAIL_PROVIDER environment variable:
//   lovable  – Lovable managed email (default while hosted on Lovable)
//   smtp     – any SMTP server (cPanel, Gmail, Zoho, Outlook, your host's mail)
//   resend | sendgrid | brevo | mailgun – HTTP email APIs
// If EMAIL_PROVIDER is not set it is auto-detected from whichever credentials exist.

export type OutgoingMail = {
  to: string
  subject: string
  html: string
  text: string
  replyTo?: string
}

const env = (k: string) => (process.env[k] ?? '').trim()

export function mailProvider(): string {
  const explicit = env('EMAIL_PROVIDER').toLowerCase()
  if (explicit) return explicit
  if (env('SMTP_HOST')) return 'smtp'
  if (env('RESEND_API_KEY')) return 'resend'
  if (env('SENDGRID_API_KEY')) return 'sendgrid'
  if (env('BREVO_API_KEY')) return 'brevo'
  if (env('MAILGUN_API_KEY')) return 'mailgun'
  return 'lovable'
}

/** "Site Name <noreply@domain>" taken from MAIL_FROM / MAIL_FROM_NAME. */
export function mailFrom(defaultName: string, defaultAddress: string): { name: string; address: string; header: string } {
  const name = env('MAIL_FROM_NAME') || defaultName
  const address = env('MAIL_FROM') || defaultAddress
  return { name, address, header: `"${name}" <${address}>` }
}

async function fail(res: Response, provider: string): Promise<never> {
  const body = await res.text().catch(() => '')
  const err = new Error(`${provider} send failed (${res.status}): ${body.slice(0, 300)}`) as Error & { status?: number }
  err.status = res.status
  throw err
}

/** Sends through a non-Lovable provider. Throws on failure. */
export async function sendExternalMail(provider: string, mail: OutgoingMail, from: { name: string; address: string; header: string }) {
  switch (provider) {
    case 'smtp': {
      // Loaded at runtime so the Lovable/edge build never bundles it. Needs a Node host.
      const modName = 'nodemailer'
      const nodemailer = (await import(/* @vite-ignore */ modName)).default
      const port = Number(env('SMTP_PORT') || 587)
      const transport = nodemailer.createTransport({
        host: env('SMTP_HOST'),
        port,
        secure: env('SMTP_SECURE') ? env('SMTP_SECURE') === 'true' : port === 465,
        auth: env('SMTP_USER') ? { user: env('SMTP_USER'), pass: env('SMTP_PASS') } : undefined,
      })
      await transport.sendMail({ from: from.header, to: mail.to, subject: mail.subject, html: mail.html, text: mail.text, replyTo: mail.replyTo })
      return
    }
    case 'resend': {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: from.header, to: [mail.to], subject: mail.subject, html: mail.html, text: mail.text, reply_to: mail.replyTo }),
      })
      if (!res.ok) await fail(res, 'Resend')
      return
    }
    case 'sendgrid': {
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env('SENDGRID_API_KEY')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: mail.to }] }],
          from: { email: from.address, name: from.name },
          reply_to: mail.replyTo ? { email: mail.replyTo } : undefined,
          subject: mail.subject,
          content: [{ type: 'text/plain', value: mail.text }, { type: 'text/html', value: mail.html }],
        }),
      })
      if (!res.ok) await fail(res, 'SendGrid')
      return
    }
    case 'brevo': {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': env('BREVO_API_KEY'), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: { email: from.address, name: from.name },
          to: [{ email: mail.to }],
          replyTo: mail.replyTo ? { email: mail.replyTo } : undefined,
          subject: mail.subject, htmlContent: mail.html, textContent: mail.text,
        }),
      })
      if (!res.ok) await fail(res, 'Brevo')
      return
    }
    case 'mailgun': {
      const domain = env('MAILGUN_DOMAIN')
      const base = env('MAILGUN_REGION') === 'eu' ? 'https://api.eu.mailgun.net' : 'https://api.mailgun.net'
      const form = new URLSearchParams({ from: from.header, to: mail.to, subject: mail.subject, html: mail.html, text: mail.text })
      if (mail.replyTo) form.set('h:Reply-To', mail.replyTo)
      const res = await fetch(`${base}/v3/${domain}/messages`, {
        method: 'POST',
        headers: { Authorization: 'Basic ' + btoa(`api:${env('MAILGUN_API_KEY')}`) },
        body: form,
      })
      if (!res.ok) await fail(res, 'Mailgun')
      return
    }
    default:
      throw new Error(`Unknown EMAIL_PROVIDER "${provider}"`)
  }
}
