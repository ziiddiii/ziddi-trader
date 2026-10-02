import * as React from 'react'
import { Button, Heading, Text } from '@react-email/components'
import { BrandShell, styles, BRAND_NAME } from './_brand'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({ recipient, confirmationUrl }: SignupEmailProps) => (
  <BrandShell preview={`Confirm your email for ${BRAND_NAME}`}>
    <Text style={styles.badge}>ACCOUNT VERIFICATION</Text>
    <Heading style={styles.h1}>Confirm your email address</Heading>
    <Text style={styles.p}>
      Welcome to {BRAND_NAME}. Please confirm <strong>{recipient}</strong> to
      activate your trading account and start investing in NSE-listed shares,
      bonds and the Safaricom Money Market Fund.
    </Text>
    <Button style={styles.button} href={confirmationUrl}>
      Verify my email
    </Button>
    <Text style={styles.small}>
      Didn’t create an account? You can safely ignore this email.
    </Text>
  </BrandShell>
)

export default SignupEmail
