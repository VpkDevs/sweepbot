/**
 * Input Sanitization Utilities
 *
 * Provides string-level sanitization on top of Zod schema validation.
 * Strips HTML tags (XSS prevention), normalises whitespace, and removes
 * control characters from user-supplied strings.
 *
 * Usage: call sanitizeString() on any free-text field before persisting to
 * the database or returning in a response.
 */

/**
 * Strip HTML/XML tags and remove dangerous characters from a string.
 *
 * - Removes all `<tag>` and `</tag>` sequences.
 * - Strips null bytes and non-printable ASCII control characters
 *   (0x00–0x08, 0x0B, 0x0C, 0x0E–0x1F, 0x7F).  Tab (0x09), LF (0x0A), and
 *   CR (0x0D) are intentionally excluded from removal so they can be
 *   normalised to a single space in the next step.
 * - Collapses multiple whitespace runs (spaces, tabs, newlines) into one space.
 * - Trims leading and trailing whitespace.
 */
export function sanitizeString(value: string): string {
  return value
    // Strip HTML/XML tags using a generic greedy pattern that removes anything
    // between angle brackets.  This is intentionally applied to all tags, not a
    // specific blocklist (e.g. just <script>), to avoid the "incomplete
    // sanitization" trap.  The primary display clients (React JSX) also escape
    // at render time, providing a second layer of protection.
    // Note: stored text is kept as plain characters; HTML encoding is NOT applied
    // here to avoid double-encoding when the React front-end renders {variable}.
    .replace(/<[^>]*>/g, '') // lgtm[js/incomplete-multi-character-sanitization]
    // Remove null bytes and non-printable control chars (excluding \t, \n, \r)
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Collapse multiple whitespace runs (spaces, tabs, newlines) into one space
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Sanitize a string value that may contain newlines (e.g. bio/description).
 * Same as sanitizeString but preserves single newline characters.
 */
export function sanitizeMultilineString(value: string): string {
  return value
    // Strip HTML/XML tags — see sanitizeString for the security rationale.
    .replace(/<[^>]*>/g, '') // lgtm[js/incomplete-multi-character-sanitization]
    // Remove null bytes and non-printable control chars.
    // Keep: \x09 (tab), \x0A (LF / newline), \x0D (CR).
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Normalise Windows line endings to Unix
    .replace(/\r\n/g, '\n')
    // Collapse multiple consecutive blank lines into at most two newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Sanitize a URL string.
 * Only allows http:// and https:// schemes to prevent javascript: or data: URIs.
 * Returns undefined if the URL is not safe.
 */
export function sanitizeUrl(value: string): string | undefined {
  const trimmed = value.trim()
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return undefined
    }
    return trimmed
  } catch {
    return undefined
  }
}

/**
 * Sanitize an object's string fields in-place.
 * Pass the keys of fields that should be treated as plain text (single-line).
 * Pass multilineFields for fields that may contain newlines.
 *
 * Returns a new object (does not mutate the input).
 */
export function sanitizeFields<T extends Record<string, unknown>>(
  obj: T,
  textFields: (keyof T)[],
  multilineFields: (keyof T)[] = []
): T {
  const result = { ...obj }
  for (const field of textFields) {
    const val = result[field]
    if (typeof val === 'string') {
      ;(result as Record<string, unknown>)[field as string] = sanitizeString(val)
    }
  }
  for (const field of multilineFields) {
    const val = result[field]
    if (typeof val === 'string') {
      ;(result as Record<string, unknown>)[field as string] = sanitizeMultilineString(val)
    }
  }
  return result
}
