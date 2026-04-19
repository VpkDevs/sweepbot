/**
 * Input sanitization helpers for user-controlled strings persisted by the API.
 */

import { isIP } from 'node:net'

const HTML_TAG_PATTERN = /<[^>]*>/g
const ANGLE_BRACKET_PATTERN = /[<>]/g
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_SINGLE_LINE = /[\u0000-\u001F\u007F]+/g
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_MULTILINE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]+/g

function stripHtmlTags(value: string): string {
  let sanitized = value
  let previous = ''

  while (sanitized !== previous) {
    previous = sanitized
    sanitized = sanitized.replace(HTML_TAG_PATTERN, '')
  }

  return sanitized.replace(ANGLE_BRACKET_PATTERN, '')
}

function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase()

  if (
    normalized === 'localhost' ||
    normalized === '::1' ||
    normalized.endsWith('.local')
  ) {
    return true
  }

  if (isIP(normalized) === 4) {
    const octets = normalized.split('.').map((part) => Number(part))

    return (
      octets[0] === 10 ||
      octets[0] === 127 ||
      (octets[0] === 172 && octets[1] !== undefined && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168) ||
      (octets[0] === 169 && octets[1] === 254)
    )
  }

  return false
}

export function sanitizeString(value: string): string {
  return stripHtmlTags(value)
    .replace(CONTROL_CHARS_SINGLE_LINE, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function sanitizeMultilineString(value: string): string {
  return stripHtmlTags(value)
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL_CHARS_MULTILINE, '')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function sanitizeUrl(value: string): string | null {
  const trimmed = value.trim()

  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null
    }

    if (isBlockedHostname(parsed.hostname)) {
      return null
    }

    return parsed.toString()
  } catch {
    return null
  }
}
