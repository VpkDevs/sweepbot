import { chromium } from 'playwright'
import { detectPlatform } from '../lib/platforms'

describe('Playwright harness', () => {
  it('runs detection logic inside a headless browser', async () => {
    let browser
    try {
      browser = await chromium.launch()
    } catch {
      console.warn('Playwright browser not available, skipping test')
      return
    }
    const page = await browser.newPage()
    // expose Node function to page
    await page.exposeFunction('detectPlatform', detectPlatform)

    const slug = await page.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (window as any).detectPlatform('https://chumbacasino.com/slots/123')
      return result?.slug
    })

    expect(slug).toBe('chumba')

    await browser.close()
  })
})
