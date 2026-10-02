import * as React from 'react'
import { Heading, Hr, Link, Row, Column, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { BrandShell, styles, BRAND_URL, BRAND_NAME } from './_brand'

interface Props {
  title?: string
  body?: string
  kind?: string
  siteUrl?: string
  reference?: string
  details?: { label: string; value: string }[]
}

const Email = ({ title, body, kind, siteUrl, reference, details }: Props) => {
  const safeTitle = title || 'Account update'
  const safeBody =
    body || `You have a new update in your ${BRAND_NAME} account.`
  const url = siteUrl || BRAND_URL
  const rows = Array.isArray(details) ? details.filter((d) => d && d.label) : []
  return (
    <BrandShell preview={safeTitle}>
      {kind ? <Text style={styles.badge}>{kind.toUpperCase()}</Text> : null}
      <Heading style={styles.h1}>{safeTitle}</Heading>
      <Text style={styles.p}>{safeBody}</Text>
      {rows.length > 0 ? (
        <Section style={receipt}>
          <Text style={receiptTitle}>Transaction receipt</Text>
          {reference ? (
            <Text style={receiptRef}>Reference: {reference}</Text>
          ) : null}
          <Hr style={receiptRule} />
          {rows.map((d) => (
            <Row key={d.label} style={receiptRow}>
              <Column style={receiptLabel}>{d.label}</Column>
              <Column style={receiptValue}>{d.value}</Column>
            </Row>
          ))}
        </Section>
      ) : null}
      <Text style={styles.p}>
        Open your dashboard:{' '}
        <Link href={url} style={styles.link}>{url}</Link>
      </Text>
      <Text style={styles.small}>
        You received this because it relates to activity on your {BRAND_NAME}{' '}
        account.
      </Text>
    </BrandShell>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    d?.title ? `${BRAND_NAME} • ${d.title}` : `${BRAND_NAME} update`,
  displayName: 'User notification',
  previewData: {
    title: 'Shares released to your portfolio',
    body: 'Your purchase of Safaricom shares has been approved and credited to your portfolio.',
    kind: 'approval',
    reference: 'ZD8F21A9',
    details: [
      { label: 'Stock', value: 'SCOM — Safaricom PLC' },
      { label: 'Quantity', value: '120 shares' },
      { label: 'Amount', value: 'KES 25,000.00' },
      { label: 'Status', value: 'Completed' },
    ],
  },
} satisfies TemplateEntry

const receipt = {
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '16px 18px',
  margin: '18px 0',
  backgroundColor: '#f8fafc',
}
const receiptTitle = {
  margin: '0',
  fontSize: '13px',
  fontWeight: 700 as const,
  color: '#0f172a',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
}
const receiptRef = {
  margin: '4px 0 0',
  fontSize: '12px',
  color: '#64748b',
}
const receiptRule = { borderColor: '#e2e8f0', margin: '12px 0' }
const receiptRow = { marginBottom: '6px' }
const receiptLabel = {
  fontSize: '13px',
  color: '#64748b',
  paddingRight: '12px',
}
const receiptValue = {
  fontSize: '13px',
  fontWeight: 700 as const,
  color: '#0f172a',
  textAlign: 'right' as const,
}
