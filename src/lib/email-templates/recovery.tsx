import * as React from 'react'
import { Button, Heading, Text } from '@react-email/components'
import { BrandShell, styles, BRAND_NAME } from './_brand'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ confirmationUrl }: RecoveryEmailProps) => (
  <BrandShell preview={`Reset your ${BRAND_NAME} password`}>
    <Text style={styles.badge}>PASSWORD RESET</Text>
    <Heading style={styles.h1}>Reset your password</Heading>
    <Text style={styles.p}>
      We received a request to reset the password on your {BRAND_NAME} account.
      Tap the button below to choose a new one.
    </Text>
    <Button style={styles.button} href={confirmationUrl}>
      Reset my password
    </Button>
    <Text style={styles.small}>
      Didn’t request this? Your password stays unchanged and you can ignore this
      email.
    </Text>
  </BrandShell>
)

export default RecoveryEmail
