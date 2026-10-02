import * as React from 'react'
import { render } from '@react-email/render'
import { Resend } from 'resend'
import { Webhook } from 'standardwebhooks'
import { createFileRoute } from '@tanstack/react-router'
import { SignupEmail } from '@/lib/email-templates/signup'
import { InviteEmail } from '@/lib/email-templates/invite'
import { MagicLinkEmail } from '@/lib/email-templates/magic-link'
import { RecoveryEmail } from '@/lib/email-templates/recovery'
import { EmailChangeEmail } from '@/lib/email-templates/email-change'
import { ReauthenticationEmail } from '@/lib/email-templates/reauthentication'

// Configuration
const SITE_NAME = "Safaricom ZiiDi Trader"
const ROOT_DOMAIN = "ziiditraders.online"
const FROM_DOMAIN = "ziiditraders.online"
const FROM_LOCAL_PART = "trade"
const SITE_URL = `https://${ROOT_DOMAIN}`

// This webhook is registered in Supabase Dashboard → Authentication → Hooks →
// "Send Email" hook. Supabase signs every request using the Standard Webhooks
// spec with the secret configured there (SUPABASE_AUTH_HOOK_SECRET below,
// formatted like "v1,whsec_...").
//
// Payload shape (https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook):
//   {
//     user: { email: string, ... },
//     email_data: {
//       token: string,
//       token_hash: string,
//       redirect_to: string,
//       email_action_type: 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change' | 'reauthentication',
//       site_url: string,
//       token_new?: string,
//       token_hash_new?: string,
//     }
//   }

interface SendEmailHookPayload {
  user: { email: string }
  email_data: {
    token: string
    token_hash: string
    redirect_to: string
    email_action_type: string
    site_url: string
    old_email?: string
    new_email?: string
    token_hash_new?: string
  }
}

function buildVerifyUrl(emailData: SendEmailHookPayload['email_data']) {
  const type =
    emailData.email_action_type === 'magiclink' ? 'magiclink' : emailData.email_action_type
  const url = new URL(`${SITE_URL}/auth/v1/verify`)
  url.searchParams.set('token', emailData.token_hash)
  url.searchParams.set('type', type)
  url.searchParams.set('redirect_to', emailData.redirect_to)
  return url.toString()
}

type EmailBuilder = (payload: SendEmailHookPayload) => {
  subject: string
  element: React.ReactElement
}

const EMAIL_BUILDERS: Record<string, EmailBuilder> = {
  signup: (payload) => ({
    subject: 'Confirm your email',
    element: React.createElement(SignupEmail, {
      siteName: SITE_NAME,
      siteUrl: SITE_URL,
      recipient: payload.user.email,
      confirmationUrl: buildVerifyUrl(payload.email_data),
    }),
  }),
  invite: (payload) => ({
    subject: "You've been invited",
    element: React.createElement(InviteEmail, {
      siteName: SITE_NAME,
      siteUrl: SITE_URL,
      confirmationUrl: buildVerifyUrl(payload.email_data),
    }),
  }),
  magiclink: (payload) => ({
    subject: 'Your login link',
    element: React.createElement(MagicLinkEmail, {
      siteName: SITE_NAME,
      confirmationUrl: buildVerifyUrl(payload.email_data),
    }),
  }),
  recovery: (payload) => ({
    subject: 'Reset your password',
    element: React.createElement(RecoveryEmail, {
      siteName: SITE_NAME,
      confirmationUrl: buildVerifyUrl(payload.email_data),
    }),
  }),
  email_change: (payload) => ({
    subject: 'Confirm your new email',
    element: React.createElement(EmailChangeEmail, {
      siteName: SITE_NAME,
      oldEmail: payload.email_data.old_email ?? '',
      email: payload.user.email,
      newEmail: payload.email_data.new_email ?? '',
      confirmationUrl: buildVerifyUrl(payload.email_data),
    }),
  }),
  reauthentication: (payload) => ({
    subject: 'Your verification code',
    element: React.createElement(ReauthenticationEmail, {
      token: payload.email_data.token ?? '',
    }),
  }),
}

async function handleSendEmailHook(request: Request): Promise<Response> {
  const hookSecret = process.env.SUPABASE_AUTH_HOOK_SECRET
  if (!hookSecret) {
    return new Response('SUPABASE_AUTH_HOOK_SECRET is not configured', { status: 500 })
  }

  const rawBody = await request.text()
  const headers = Object.fromEntries(request.headers)

  let payload: SendEmailHookPayload
  try {
    const wh = new Webhook(hookSecret)
    payload = wh.verify(rawBody, headers) as SendEmailHookPayload
  } catch {
    return new Response('Invalid webhook signature', { status: 401 })
  }

  const builder = EMAIL_BUILDERS[payload.email_data.email_action_type]
  if (!builder) {
    return new Response(
      `Unsupported email_action_type: ${payload.email_data.email_action_type}`,
      { status: 400 }
    )
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return new Response('RESEND_API_KEY is not configured', { status: 500 })
  }

  const { subject, element } = builder(payload)
  const html = await render(element)
  const text = await render(element, { plainText: true })

  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({
    to: payload.user.email,
    from: `${SITE_NAME} <${FROM_LOCAL_PART}@${FROM_DOMAIN}>`,
    subject,
    html,
    text,
  })

  if (error) {
    return new Response(`Resend error (${error.name}): ${error.message}`, { status: 500 })
  }

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const Route = createFileRoute("/lovable/email/auth/webhook")({
  server: {
    handlers: {
      POST: ({ request }) => handleSendEmailHook(request),
    },
  },
})
