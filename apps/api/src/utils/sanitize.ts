/**
 * Input sanitization helpers for user-controlled strings persisted by the API.
 */

const HTML_TAG_PATTERN = /<[^>]*>/g
const CONTROL_CHARS_SINGLE_LINE = /[\u0000-\u001F\u007F]+/g
const CONTROL_CHARS_MULTILINE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]+/g

function stripHtmlTags(value: string): string {
  return value.replace(HTML_TAG_PATTERN, '')
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

    return parsed.toString()
  } catch {
    return null
  }
}
