/**
 * Unit tests for input sanitization utilities
 * Validates XSS prevention, whitespace normalisation, and URL safety.
 */

import { describe, it, expect } from 'vitest'
import {
  sanitizeString,
  sanitizeMultilineString,
  sanitizeUrl,
  sanitizeFields,
} from '../../utils/sanitize'

describe('sanitizeString', () => {
  it('strips HTML tags', () => {
    // Tags are removed; text content between tags is preserved as plain text
    expect(sanitizeString('<script>alert(1)</script>hello')).toBe('alert(1)hello')
    expect(sanitizeString('<b>bold</b> text')).toBe('bold text')
    expect(sanitizeString('<img src=x onerror="evil()">')).toBe('')
  })

  it('strips self-closing HTML tags', () => {
    expect(sanitizeString('<br/>line')).toBe('line')
    expect(sanitizeString('<hr />')).toBe('')
  })

  it('removes null bytes', () => {
    // Null bytes are stripped (not replaced with spaces)
    expect(sanitizeString('hello\x00world')).toBe('helloworld')
  })

  it('removes ASCII control characters', () => {
    // Non-printable control chars are stripped without inserting spaces
    expect(sanitizeString('hello\x01\x1Fworld')).toBe('helloworld')
  })

  it('collapses multiple whitespace into a single space', () => {
    expect(sanitizeString('hello   world')).toBe('hello world')
    // Tabs are whitespace — collapsed to a single space
    expect(sanitizeString('hello\t\tworld')).toBe('hello world')
    // Newlines are whitespace — collapsed to a single space
    expect(sanitizeString('a\n\nb')).toBe('a b')
  })

  it('trims leading and trailing whitespace', () => {
    expect(sanitizeString('  hello  ')).toBe('hello')
  })

  it('returns an empty string when input is only tags', () => {
    expect(sanitizeString('<div></div>')).toBe('')
  })

  it('preserves plain text unchanged (aside from trimming)', () => {
    expect(sanitizeString('Daily Bonus Flow')).toBe('Daily Bonus Flow')
  })

  it('handles nested/malformed tags', () => {
    // Greedy strip between < > removes each tag chunk
    expect(sanitizeString('<div><p>text</p></div>')).toBe('text')
  })

  it('strips javascript: URI in anchor text', () => {
    // The tag itself is stripped; the javascript: text in href is also gone
    expect(sanitizeString('<a href="javascript:evil()">click</a>')).toBe('click')
  })
})

describe('sanitizeMultilineString', () => {
  it('preserves single newlines', () => {
    expect(sanitizeMultilineString('line1\nline2')).toBe('line1\nline2')
  })

  it('normalises Windows line endings', () => {
    expect(sanitizeMultilineString('line1\r\nline2')).toBe('line1\nline2')
  })

  it('collapses more than 2 consecutive blank lines to 2', () => {
    expect(sanitizeMultilineString('a\n\n\n\nb')).toBe('a\n\nb')
  })

  it('strips HTML tags', () => {
    expect(sanitizeMultilineString('<b>bold</b>\ntext')).toBe('bold\ntext')
  })

  it('removes null bytes but keeps newlines and tabs', () => {
    expect(sanitizeMultilineString('hello\x00\nworld')).toBe('hello\nworld')
    // Tabs are preserved in multiline text (can be meaningful formatting)
    expect(sanitizeMultilineString('col1\tcol2')).toBe('col1\tcol2')
  })

  it('trims leading and trailing whitespace', () => {
    expect(sanitizeMultilineString('\n  bio text  \n')).toBe('bio text')
  })
})

describe('sanitizeUrl', () => {
  it('allows http:// URLs', () => {
    expect(sanitizeUrl('http://example.com/path')).toBe('http://example.com/path')
  })

  it('allows https:// URLs', () => {
    expect(sanitizeUrl('https://example.com/avatar.png')).toBe('https://example.com/avatar.png')
  })

  it('rejects javascript: scheme', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBeUndefined()
  })

  it('rejects data: scheme', () => {
    expect(sanitizeUrl('data:text/html,<script>evil()</script>')).toBeUndefined()
  })

  it('rejects ftp: scheme', () => {
    expect(sanitizeUrl('ftp://evil.example.com')).toBeUndefined()
  })

  it('rejects non-URL strings', () => {
    expect(sanitizeUrl('not-a-url')).toBeUndefined()
  })

  it('trims whitespace before parsing', () => {
    expect(sanitizeUrl('  https://example.com  ')).toBe('https://example.com')
  })
})

describe('sanitizeFields', () => {
  it('sanitizes specified text fields', () => {
    const input = { name: '<b>Flow</b>', count: 42, active: true }
    const result = sanitizeFields(input, ['name'])
    expect(result.name).toBe('Flow')
    expect(result.count).toBe(42)
    expect(result.active).toBe(true)
  })

  it('sanitizes multiline fields separately', () => {
    const input = { title: '<h1>Title</h1>', body: 'line1\nline2' }
    const result = sanitizeFields(input, ['title'], ['body'])
    expect(result.title).toBe('Title')
    expect(result.body).toBe('line1\nline2')
  })

  it('does not mutate the original object', () => {
    const input = { name: '<b>flow</b>' }
    const result = sanitizeFields(input, ['name'])
    expect(input.name).toBe('<b>flow</b>') // unchanged
    expect(result.name).toBe('flow')
  })

  it('ignores fields not listed', () => {
    const input = { name: '<b>ok</b>', description: '<b>also</b>' }
    const result = sanitizeFields(input, ['name'])
    expect(result.description).toBe('<b>also</b>') // untouched
  })

  it('skips non-string field values', () => {
    const input = { count: 5, name: 'ok' }
    const result = sanitizeFields(input, ['count' as unknown as keyof typeof input, 'name'])
    expect(result.count).toBe(5)
  })
})
