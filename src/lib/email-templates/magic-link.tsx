import * as React from 'react'
import { Button, Heading, Text } from '@react-email/components'
import { BrandShell, styles, BRAND_NAME } from './_brand'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ confirmationUrl }: MagicLinkEmailProps) => (
  <BrandShell preview={`Your secure sign-in link for ${BRAND_NAME}`}>
    <Text style={styles.badge}>SECURE SIGN-IN</Text>
    <Heading style={styles.h1}>Your sign-in link is ready</Heading>
    <Text style={styles.p}>
      Tap the button below to sign in to {BRAND_NAME}. For your security this
      link expires shortly and can only be used once.
    </Text>
    <Button style={styles.button} href={confirmationUrl}>
      Sign in securely
    </Button>
    <Text style={styles.small}>
      Didn’t request this? You can safely ignore this email.
    </Text>
  </BrandShell>
)

export default MagicLinkEmail
