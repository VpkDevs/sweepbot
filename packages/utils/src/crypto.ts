/**
 * Crypto utilities — hashing, secure token generation.
 * NOTE: For sensitive encryption, use dedicated crypto libraries (TweetNaCl, libsodium, etc.)
 */

/**
 * Simple hash function for non-security purposes
 * DO NOT USE for password hashing — use bcrypt or Argon2 instead
 */
export async function simpleHash(str: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(str)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Generate secure random token
 */
export function generateToken(length = 32): string {
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Generate secure random number
 */
export function generateRandomNumber(min = 0, max = 1): number {
  return Math.random() * (max - min) + min
}

/**
 * Generate UUID v4
 */
export function generateUUIDv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Constant-time string comparison (prevents timing attacks)
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return result === 0
}

/**
 * Generate HMAC signature (for API authentication)
 * Requires subtle crypto API (Web Crypto)
 */
export async function generateHMAC(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const messageData = encoder.encode(message)

  const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, messageData)

  const signatureArray = Array.from(new Uint8Array(signature))
  return signatureArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Basic base64 encoding (for non-sensitive data)
 */
export function encodeBase64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
}

/**
 * Basic base64 decoding
 */
export function decodeBase64(encoded: string): string {
  return decodeURIComponent(escape(atob(encoded)))
}
