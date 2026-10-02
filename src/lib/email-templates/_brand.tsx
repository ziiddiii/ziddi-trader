import * as React from 'react'
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import logoAsset from '@/assets/safaricom-logo.png'

export const BRAND_NAME = 'Safaricom ZiiDi Trader'
export const BRAND_URL = 'https://www.ziiditraders.online'
export const BRAND_GREEN = '#00A651'
export const BRAND_GREEN_DARK = '#007A3D'
export const BRAND_INK = '#0f172a'
export const BRAND_MUTED = '#475569'
export const BRAND_BORDER = '#e5e7eb'

export const BRAND_LOGO_URL = `${BRAND_URL}${logoAsset}`

interface ShellProps {
  preview: string
  children: React.ReactNode
}

export const BrandShell = ({ preview, children }: ShellProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{preview}</Preview>
    <Body style={main}>
      <Container style={outer}>
        <Section style={header}>
          <Img
            src={BRAND_LOGO_URL}
            width="56"
            height="56"
            alt="Safaricom"
            style={logoImg}
          />
          <Text style={brandMark}>Safaricom</Text>
          <Text style={brandTitle}>ZiiDi Trader</Text>
        </Section>
        <Section style={card}>{children}</Section>
        <Section style={footWrap}>
          <Hr style={hr} />
          <Text style={footText}>
            {BRAND_NAME} · Licensed Money Market Fund partner
          </Text>
          <Text style={footText}>
            <Link href={BRAND_URL} style={footLink}>
              www.ziiditraders.online
            </Link>
            &nbsp;·&nbsp;Nairobi, Kenya
          </Text>
          <Text style={footFine}>
            You received this email because it relates to activity on your
            Safaricom ZiiDi Trader account.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const styles = {
  h1: {
    color: BRAND_INK,
    fontSize: '22px',
    fontWeight: 700 as const,
    margin: '0 0 14px',
    lineHeight: '1.25',
  },
  p: {
    color: BRAND_MUTED,
    fontSize: '15px',
    lineHeight: '24px',
    margin: '0 0 16px',
  },
  button: {
    backgroundColor: BRAND_GREEN,
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: 600 as const,
    borderRadius: '10px',
    padding: '13px 24px',
    textDecoration: 'none',
    display: 'inline-block',
  },
  link: { color: BRAND_GREEN_DARK, textDecoration: 'underline' },
  code: {
    display: 'inline-block',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '26px',
    fontWeight: 700 as const,
    color: BRAND_INK,
    letterSpacing: '6px',
    background: '#f1f5f9',
    border: `1px solid ${BRAND_BORDER}`,
    borderRadius: '10px',
    padding: '14px 20px',
    margin: '4px 0 20px',
  },
  badge: {
    display: 'inline-block',
    backgroundColor: '#ecfdf5',
    color: BRAND_GREEN_DARK,
    fontSize: '11px',
    fontWeight: 700 as const,
    padding: '4px 10px',
    borderRadius: '999px',
    letterSpacing: '0.06em',
    margin: '0 0 12px',
  },
  hr: { borderColor: BRAND_BORDER, margin: '18px 0' },
  small: { color: '#94a3b8', fontSize: '12px', margin: '18px 0 0' },
}

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Arial, sans-serif",
  margin: 0,
  padding: '24px 0',
}
const outer = { maxWidth: '580px', margin: '0 auto', padding: '0 16px' }
const header = {
  background: `linear-gradient(135deg, ${BRAND_GREEN} 0%, ${BRAND_GREEN_DARK} 100%)`,
  padding: '22px 24px',
  borderRadius: '14px 14px 0 0',
}
const brandMark = {
  color: '#ffffff',
  fontSize: '13px',
  letterSpacing: '0.14em',
  textTransform: 'uppercase' as const,
  margin: '10px 0 0',
  opacity: 0.9,
}
const logoImg = {
  display: 'block',
  borderRadius: '10px',
  background: '#ffffff',
  padding: '4px',
}
const brandTitle = {
  color: '#ffffff',
  fontSize: '22px',
  fontWeight: 700 as const,
  margin: '4px 0 0',
}
const card = {
  border: `1px solid ${BRAND_BORDER}`,
  borderTop: 'none',
  borderRadius: '0 0 14px 14px',
  padding: '28px 26px',
  background: '#ffffff',
}
const footWrap = { padding: '18px 6px 0' }
const hr = { borderColor: BRAND_BORDER, margin: '0 0 14px' }
const footText = {
  color: '#64748b',
  fontSize: '12px',
  margin: '0 0 4px',
  textAlign: 'center' as const,
}
const footLink = { color: BRAND_GREEN_DARK, textDecoration: 'none' }
const footFine = {
  color: '#94a3b8',
  fontSize: '11px',
  margin: '10px 0 0',
  textAlign: 'center' as const,
  lineHeight: '16px',
}