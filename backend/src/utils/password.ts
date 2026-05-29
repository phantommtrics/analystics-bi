import crypto from 'crypto'

const CHARSET =
  'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%'

export function generateTemporaryPassword(length = 16): string {
  const bytes = crypto.randomBytes(length)
  let password = ''
  for (let i = 0; i < length; i++) {
    password += CHARSET[bytes[i]! % CHARSET.length]
  }
  return password
}
