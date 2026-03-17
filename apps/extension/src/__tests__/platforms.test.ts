import { detectPlatform, isGamePage, isSignupPage, PLATFORMS } from '../lib/platforms'

describe('platforms detection', () => {
  it('finds a known platform by URL', () => {
    const url = 'https://chumbacasino.com/slots/123'
    const cfg = detectPlatform(url)
    expect(cfg?.slug).toBe('chumba')
  })

  it('returns null for unknown URL', () => {
    expect(detectPlatform('https://example.com')).toBeNull()
  })

  it('correctly identifies game pages and signup pages', () => {
    const cfg = PLATFORMS[0] // chumba
    expect(isGamePage('https://chumbacasino.com/slots/play', cfg)).toBe(true)
    expect(isSignupPage('https://chumbacasino.com/register', cfg)).toBe(true)
    expect(isGamePage('https://chumbacasino.com/home', cfg)).toBe(false)
  })
})
