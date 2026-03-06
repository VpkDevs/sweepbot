import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import puppeteer from 'puppeteer'

let browser: puppeteer.Browser
let page: puppeteer.Page

beforeAll(async () => {
  browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] })
  page = await browser.newPage()
})

afterAll(async () => {
  await page.close()
  await browser.close()
})

describe('web app smoke', () => {
  it('renders the landing page title', async () => {
    await page.goto('http://localhost:5173/')
    const title = await page.title()
    expect(title.toLowerCase()).toContain('sweepbot')
  })
})
