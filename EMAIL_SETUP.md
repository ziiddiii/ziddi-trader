# Email setup when hosting outside Lovable

All app emails (deposit, withdrawal, transfer, KYC and admin notifications, admin
broadcasts) go through one switch: the `EMAIL_PROVIDER` environment variable.
Set it, plus that provider's settings, in your new host's environment
(cPanel "Environment variables", Vercel/Netlify/Render settings, or a `.env` file).

If `EMAIL_PROVIDER` is not set, the app picks the first provider whose
credentials it finds; with none, it uses Lovable email (works only on Lovable).

## Always set

```
MAIL_FROM=info@yourdomain.com        # sender address (must be allowed by your provider)
MAIL_FROM_NAME=Safaricom ZiiDi Trader
SITE_URL=https://yourdomain.com      # used for links inside emails
```

## Option A: your host's mailbox (SMTP), e.g. cPanel, Zoho, Gmail, Outlook

Needs a Node.js host (cPanel Node app, VPS, Render, Railway…).

```
EMAIL_PROVIDER=smtp
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=465            # 465 = SSL, 587 = STARTTLS
SMTP_SECURE=true         # true for 465, false for 587
SMTP_USER=info@yourdomain.com
SMTP_PASS=your-mailbox-password
```

## Option B: an email API (works on any host, including Vercel/Cloudflare)

```
EMAIL_PROVIDER=resend     RESEND_API_KEY=re_...
EMAIL_PROVIDER=sendgrid   SENDGRID_API_KEY=SG...
EMAIL_PROVIDER=brevo      BREVO_API_KEY=xkeysib-...
EMAIL_PROVIDER=mailgun    MAILGUN_API_KEY=...  MAILGUN_DOMAIN=mg.yourdomain.com  MAILGUN_REGION=us|eu
```

## Database keys you also need on the new host

```
SUPABASE_URL=...                 VITE_SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...     VITE_SUPABASE_PUBLISHABLE_KEY=...
```

A service-role key is optional: notification emails find each recipient
through a protected database lookup, so they work without it.

## Sign-up / password-reset emails

Those are sent by the login system, not the app. If you also move the database to
your own server, enter the same SMTP details in its Auth → SMTP settings.
In-app notifications (the bell) keep working everywhere with no setup.
