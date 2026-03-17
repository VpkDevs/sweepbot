import type { PlatformConfig } from './platforms'
import { createLogger } from './logger'

const log = createLogger('AffiliateManager')

export class AffiliateManager {
  async injectAffiliateBanner(platform: PlatformConfig): Promise<void> {
    // Build the banner using DOM APIs only — no innerHTML with event handlers.
    // Inline onclick is forbidden by Chrome MV3 CSP and is an XSS footgun.
    const banner = document.createElement('div')
    banner.id = 'sweepbot-affiliate-banner'

    const inner = document.createElement('div')
    inner.style.cssText = [
      'position:fixed',
      'top:0',
      'left:0',
      'right:0',
      'background:linear-gradient(90deg,#8b5cf6,#06b6d4)',
      'color:white',
      'padding:8px 16px',
      'text-align:center',
      'font-size:14px',
      'z-index:999999',
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'gap:8px',
    ].join(';')

    const label = document.createElement('span')
    const bold = document.createElement('strong')
    bold.textContent = 'SweepBot'
    label.textContent = '\u{1F916} '
    label.appendChild(bold)
    const suffix = document.createTextNode(' is tracking your session for analytics')
    label.appendChild(suffix)

    const closeBtn = document.createElement('button')
    closeBtn.textContent = '\u00D7'
    closeBtn.style.cssText = [
      'background:rgba(255,255,255,0.2)',
      'border:none',
      'color:white',
      'padding:4px 8px',
      'border-radius:4px',
      'margin-left:12px',
      'cursor:pointer',
    ].join(';')
    // Safe event listener — no inline handler string, no CSP violation
    closeBtn.addEventListener('click', () => {
      banner.remove()
    })

    inner.appendChild(label)
    inner.appendChild(closeBtn)
    banner.appendChild(inner)

    document.body.appendChild(banner)

    // Auto-remove after 5 seconds
    setTimeout(() => {
      banner.remove()
    }, 5000)

    log.info(`Affiliate banner injected for ${platform.name}`)
  }
}

export const affiliateManager = new AffiliateManager()