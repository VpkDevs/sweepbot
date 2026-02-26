/**
 * String utilities — formatting, case conversion, slug generation.
 */

/**
 * Capitalize first letter
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Convert to title case
 */
export function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(/\s+/)
    .map((word) => capitalize(word))
    .join(' ')
}

/**
 * Convert to camelCase
 */
export function toCamelCase(str: string): string {
  return str
    .toLowerCase()
    .split(/[-_\s]+/)
    .map((word, i) => (i === 0 ? word : capitalize(word)))
    .join('')
}

/**
 * Convert to snake_case
 */
export function toSnakeCase(str: string): string {
  return str
    .split(/(?=[A-Z])/)
    .join('_')
    .toLowerCase()
}

/**
 * Convert to kebab-case
 */
export function toKebabCase(str: string): string {
  return str
    .split(/(?=[A-Z])/)
    .join('-')
    .toLowerCase()
}

/**
 * Generate URL slug
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, length: number, suffix = '...'): string {
  if (str.length <= length) return str
  return str.substring(0, length - suffix.length) + suffix
}

/**
 * Repeat string N times
 */
export function repeat(str: string, times: number): string {
  return Array(times).fill(str).join('')
}

/**
 * Pad string to length
 */
export function padLeft(str: string, length: number, char = ' '): string {
  return char.repeat(Math.max(0, length - str.length)) + str
}

/**
 * Remove whitespace
 */
export function removeWhitespace(str: string): string {
  return str.replace(/\s/g, '')
}

/**
 * Check if string is email (basic validation)
 */
export function isEmail(str: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)
}

/**
 * Extract numbers from string
 */
export function extractNumbers(str: string): number[] {
  const matches = str.match(/\d+\.?\d*/g)
  return matches ? matches.map(Number) : []
}

/**
 * Limit text to N words
 */
export function limitWords(str: string, count: number): string {
  return str.split(/\s+/).slice(0, count).join(' ')
}
