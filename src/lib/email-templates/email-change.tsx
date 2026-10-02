import * as React from 'react'
import { Button, Heading, Link, Text } from '@react-email/components'
import { BrandShell, styles, BRAND_NAME } from './_brand'

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <BrandShell preview={`Confirm your email change on ${BRAND_NAME}`}>
    <Text style={styles.badge}>EMAIL CHANGE</Text>
    <Heading style={styles.h1}>Confirm your new email address</Heading>
    <Text style={styles.p}>
      You requested to change the email on your {BRAND_NAME} account from{' '}
      <Link href={`mailto:${oldEmail}`} style={styles.link}>{oldEmail}</Link>{' '}
      to{' '}
      <Link href={`mailto:${newEmail}`} style={styles.link}>{newEmail}</Link>.
    </Text>
    <Button style={styles.button} href={confirmationUrl}>
      Confirm email change
    </Button>
    <Text style={styles.small}>
      Didn’t request this? Please secure your account and contact ZiiDi Customer
      Care immediately.
    </Text>
  </BrandShell>
)

export default EmailChangeEmail
