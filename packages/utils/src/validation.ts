/**
 * Validation utilities — input validation, type checking.
 */

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email)
}

/**
 * Validate password strength
 * Requires: min 8 chars, at least one uppercase, one lowercase, one number
 */
export function validatePassword(password: string): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters')
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain lowercase letters')
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain uppercase letters')
  }
  if (!/\d/.test(password)) {
    errors.push('Password must contain numbers')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Validate URL format
 */
export function validateUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * Validate phone number (basic US format)
 */
export function validatePhoneNumber(phone: string): boolean {
  const re = /^\+?1?[-.\s]?(\d{3})[-.\s]?(\d{3})[-.\s]?(\d{4})$/
  return re.test(phone.replace(/\s/g, ''))
}

/**
 * Validate credit card number (Luhn algorithm)
 */
export function validateCreditCard(cardNumber: string): boolean {
  const cleaned = cardNumber.replace(/\D/g, '')

  if (cleaned.length < 13 || cleaned.length > 19) {
    return false
  }

  let sum = 0
  let isEven = false

  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned[i]!, 10)

    if (isEven) {
      digit *= 2
      if (digit > 9) {
        digit -= 9
      }
    }

    sum += digit
    isEven = !isEven
  }

  return sum % 10 === 0
}

/**
 * Validate required field
 */
export function validateRequired(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  return true
}

/**
 * Validate min length
 */
export function validateMinLength(value: string, min: number): boolean {
  return value.length >= min
}

/**
 * Validate max length
 */
export function validateMaxLength(value: string, max: number): boolean {
  return value.length <= max
}

/**
 * Validate number range
 */
export function validateRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max
}

/**
 * Validate enum value
 */
export function validateEnum<T extends string | number>(value: unknown, allowedValues: readonly T[]): value is T {
  return allowedValues.includes(value as T)
}

/**
 * Validate object shape (simple version)
 */
export function validateObjectShape<T extends Record<string, unknown>>(
  obj: unknown,
  schema: Record<string, 'string' | 'number' | 'boolean' | 'object'>,
): obj is T {
  if (typeof obj !== 'object' || obj === null) return false

  for (const [key, type] of Object.entries(schema)) {
    const value = (obj as Record<string, unknown>)[key]
    if (typeof value !== type) {
      return false
    }
  }

  return true
}

/**
 * Validate ISO 8601 date string
 */
export function validateISODate(dateString: string): boolean {
  const date = new Date(dateString)
  return date instanceof Date && !isNaN(date.getTime())
}

/**
 * Validate hex color
 */
export function validateHexColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color)
}
