import * as React from 'react'
import { Heading, Text } from '@react-email/components'
import { BrandShell, styles, BRAND_NAME } from './_brand'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <BrandShell preview={`Your ${BRAND_NAME} verification code`}>
    <Text style={styles.badge}>VERIFICATION CODE</Text>
    <Heading style={styles.h1}>Confirm it’s really you</Heading>
    <Text style={styles.p}>
      Enter the code below in {BRAND_NAME} to confirm your identity. The code
      expires shortly.
    </Text>
    <Text style={styles.code}>{token}</Text>
    <Text style={styles.small}>
      Didn’t request this? You can safely ignore this email.
    </Text>
  </BrandShell>
)

export default ReauthenticationEmail
