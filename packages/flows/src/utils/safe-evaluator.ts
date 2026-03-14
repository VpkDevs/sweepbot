/**
 * Safe Expression Evaluator
 * A secure alternative to eval() and new Function() for mathematical expressions
 * Only supports basic arithmetic: +, -, *, /, %, and parentheses
 */

import { logger } from '@sweepbot/utils'

// Supported operators and their regex patterns
const SAFE_OPERATORS = ['+', '-', '*', '/', '%', '(', ')']

/**
 * Safely evaluate a mathematical expression string
 * @param expression - The expression to evaluate (e.g., "($BONUS * 5) + 100")
 * @param variables - Map of variable names to their values
 * @returns The result of the evaluation, or 0 if invalid
 */
export function safeEvaluate(expression: string, variables: Map<string, unknown>): number {
  if (!expression || typeof expression !== 'string') {
    return 0
  }

  // Step 1: Sanitize and validate input
  const sanitized = sanitizeExpression(expression)
  if (!sanitized) {
    logger.warn('Expression sanitization failed', { original: expression })
    return 0
  }

  // Step 2: Replace variables with their values
  const withValues = replaceVariables(sanitized, variables)
  if (withValues === null) {
    logger.warn('Variable replacement failed', { expression: sanitized })
    return 0
  }

  // Step 3: Validate the sanitized expression contains only safe characters
  if (!isValidExpression(withValues)) {
    logger.warn('Invalid expression characters detected', { expression: withValues })
    return 0
  }

  // Step 4: Parse and evaluate using a safe parser
  try {
    const result = parseAndEvaluate(withValues)
    if (!isFinite(result)) {
      logger.warn('Expression result is not finite', { result })
      return 0
    }
    return result
  } catch (error) {
    logger.warn('Expression evaluation failed', { 
      expression: withValues, 
      error: error instanceof Error ? error.message : String(error) 
    })
    return 0
  }
}

/**
 * Sanitize the expression string to remove any potentially dangerous content
 */
function sanitizeExpression(expression: string): string | null {
  // Trim whitespace
  let sanitized = expression.trim()
  
  // Remove any non-printable characters
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '')
  
  // Check for dangerous patterns
  const dangerousPatterns = [
    /require\s*\(/i,
    /import\s+/i,
    /export\s+/i,
    /function\s*\(/i,
    /=>\s*{/i,
    /eval\s*\(/i,
    /Function\s*\(/i,
    /constructor\s*\(/i,
    /prototype\s*/i,
    /__dirname/i,
    /__filename/i,
    /process\./i,
    /global\./i,
    /window\./i,
    /document\./i,
    /<script/i,
    /<\/script>/i,
    /javascript:/i,
    /on\w+\s*=/i,
  ]

  for (const pattern of dangerousPatterns) {
    if (pattern.test(sanitized)) {
      logger.warn('Dangerous pattern detected in expression', { pattern: pattern.source })
      return null
    }
  }

  return sanitized
}

/**
 * Validate that a variable name contains only safe identifier characters.
 * Rejects names with regex metacharacters that could cause issues if the name
 * were ever used in a dynamically-constructed regular expression.
 */
function isSafeVariableName(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name)
}

/**
 * Replace $variableName patterns with their numeric values.
 *
 * Uses index-based string splicing (rather than String.prototype.replace) to
 * prevent JavaScript's special $& / $1 / $` replacement sequences from
 * misinterpreting a substituted value that happens to contain a $ character.
 */
function replaceVariables(expression: string, variables: Map<string, unknown>): string | null {
  // Find all $variable patterns
  const variablePattern = /\$([A-Za-z_][A-Za-z0-9_]*)/g
  const matches = [...expression.matchAll(variablePattern)]

  if (matches.length === 0) {
    return expression
  }

  let result = expression

  // Replace in reverse order so that earlier string offsets remain valid
  // after each index-based splice.
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i]!
    const varName = match[1]!

    // Guard: reject variable names that do not match the safe identifier pattern.
    if (!isSafeVariableName(varName)) {
      logger.warn('Unsafe variable name rejected', { varName })
      return null
    }

    const value = variables.get(varName)
    let numericStr: string

    if (value === undefined || value === null) {
      logger.debug('Variable not found, treating as 0', { varName })
      numericStr = '0'
    } else if (typeof value === 'number') {
      if (!isFinite(value)) {
        logger.warn('Variable value is not finite', { varName, value })
        return null
      }
      numericStr = String(value)
    } else if (typeof value === 'string') {
      const num = Number(value)
      if (isNaN(num)) {
        logger.warn('Variable is not a number', { varName, value })
        return null
      }
      numericStr = String(num)
    } else {
      logger.warn('Variable has unsupported type', { varName, type: typeof value })
      return null
    }

    // Index-based splice: completely avoids String.prototype.replace special chars
    const start = match.index!
    const end = start + match[0].length
    result = result.slice(0, start) + numericStr + result.slice(end)
  }

  return result
}

/**
 * Validate that the expression only contains safe characters
 */
function isValidExpression(expression: string): boolean {
  // Allow: numbers, operators, parentheses, spaces, and decimal points
  // Also allow comma for potential array access (will be validated)
  return /^[\d\s+\-*/%.(),]+$/.test(expression)
}

/**
 * Parse and evaluate a mathematical expression using recursive descent parsing
 * This is a complete parser that doesn't use eval or Function constructor
 */
function parseAndEvaluate(expression: string): number {
  // Tokenize the expression
  const tokens = tokenize(expression)
  if (tokens.length === 0) {
    return 0
  }

  // Use a simple recursive descent parser
  let position = 0

  function parseExpression(): number {
    let result = parseTerm()

    while (position < tokens.length) {
      const token = tokens[position]!
      if (token === '+') {
        position++
        result += parseTerm()
      } else if (token === '-') {
        position++
        result -= parseTerm()
      } else {
        break
      }
    }

    return result
  }

  function parseTerm(): number {
    let result = parseFactor()

    while (position < tokens.length) {
      const token = tokens[position]!
      if (token === '*') {
        position++
        result *= parseFactor()
      } else if (token === '/') {
        position++
        const divisor = parseFactor()
        if (divisor === 0) {
          logger.warn('Division by zero attempted')
          return 0
        }
        result /= divisor
      } else if (token === '%') {
        position++
        const divisor = parseFactor()
        if (divisor === 0) {
          logger.warn('Modulo by zero attempted')
          return 0
        }
        result %= divisor
      } else {
        break
      }
    }

    return result
  }

  function parseFactor(): number {
    const token = tokens[position]!

    // Handle parentheses
    if (token === '(') {
      position++
      const result = parseExpression()
      if (tokens[position] === ')') {
        position++
      }
      return result
    }

    // Handle negative numbers
    if (token === '-' && position + 1 < tokens.length) {
      position++
      return -parseFactor()
    }

    // Handle numbers
    const num = parseFloat(token)
    if (!isNaN(num)) {
      position++
      return num
    }

    // Unknown token
    logger.warn('Unknown token in expression', { token })
    return 0
  }

  const result = parseExpression()
  
  // Check if all tokens were consumed
  if (position < tokens.length) {
    logger.warn('Unexpected tokens remaining after parsing', { 
      remaining: tokens.slice(position) 
    })
  }

  return result
}

/**
 * Tokenize a mathematical expression into individual tokens
 */
function tokenize(expression: string): string[] {
  const tokens: string[] = []
  let current = ''
  let i = 0

  while (i < expression.length) {
    const char = expression[i]!

    // Skip whitespace
    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current)
        current = ''
      }
      i++
      continue
    }

    // Handle operators and parentheses
    if (['+', '-', '*', '/', '%', '(', ')'].includes(char)) {
      if (current) {
        tokens.push(current)
        current = ''
      }
      tokens.push(char)
      i++
      continue
    }

    // Handle decimal points within numbers
    if (char === '.') {
      if (current && /^\d+$/.test(current)) {
        current += char
        i++
        continue
      }
    }

    // Accumulate characters for numbers and identifiers
    current += char
    i++
  }

  if (current) {
    tokens.push(current)
  }

  return tokens
}

/**
 * Validate an expression without evaluating it
 * @returns true if the expression is safe to evaluate
 */
export function validateExpression(expression: string): { valid: boolean; error?: string } {
  if (!expression || typeof expression !== 'string') {
    return { valid: false, error: 'Expression must be a non-empty string' }
  }

  const sanitized = sanitizeExpression(expression)
  if (!sanitized) {
    return { valid: false, error: 'Expression contains dangerous patterns' }
  }

  if (!isValidExpression(sanitized)) {
    return { valid: false, error: 'Expression contains invalid characters' }
  }

  // Try to tokenize to catch syntax errors
  try {
    const tokens = tokenize(sanitized)
    if (tokens.length === 0) {
      return { valid: false, error: 'Expression is empty after tokenization' }
    }
  } catch {
    return { valid: false, error: 'Failed to parse expression' }
  }

  return { valid: true }
}

