import * as React from 'react'
import { Button, Heading, Text } from '@react-email/components'
import { BrandShell, styles, BRAND_NAME } from './_brand'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ confirmationUrl }: InviteEmailProps) => (
  <BrandShell preview={`You've been invited to join ${BRAND_NAME}`}>
    <Text style={styles.badge}>INVITATION</Text>
    <Heading style={styles.h1}>You’re invited to {BRAND_NAME}</Heading>
    <Text style={styles.p}>
      Accept your invitation to join Kenya’s trusted trading portal — buy and
      sell NSE shares, earn on the ZiiDi Lock, and grow through Auto Invest.
    </Text>
    <Button style={styles.button} href={confirmationUrl}>
      Accept invitation
    </Button>
    <Text style={styles.small}>
      If you weren’t expecting this, you can safely ignore this email.
    </Text>
  </BrandShell>
)

export default InviteEmail
