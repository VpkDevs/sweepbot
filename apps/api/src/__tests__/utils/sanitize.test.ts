import { describe, expect, it } from 'vitest'
import { sanitizeMultilineString, sanitizeString, sanitizeUrl } from '../../utils/sanitize'

describe('sanitize helpers', () => {
  it('removes HTML from single-line strings and can return empty output', () => {
    expect(sanitizeString('<strong>Hello</strong>')).toBe('Hello')
    expect(sanitizeString('')).toBe('')
    expect(sanitizeString('<script></script>')).toBe('')
  })

  it('removes HTML from multiline strings while preserving line breaks', () => {
    expect(sanitizeMultilineString('<p>Hello</p>\n<div>world</div>')).toBe('Hello\nworld')
  })

  it('only allows http and https URLs', () => {
    expect(sanitizeUrl('https://example.com/avatar.png')).toBe('https://example.com/avatar.png')
    expect(sanitizeUrl('javascript:alert(1)')).toBeNull()
    expect(sanitizeUrl('ftp://example.com/avatar.png')).toBeNull()
    expect(sanitizeUrl('http://localhost/avatar.png')).toBeNull()
  })
})
