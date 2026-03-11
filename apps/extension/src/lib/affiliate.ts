import type { PlatformConfig } from './platforms'
import { createLogger } from './logger'

const log = createLogger('AffiliateManager')

export class AffiliateManager {
  async injectAffiliateBanner(platform: PlatformConfig): Promise<void> {
    // Simple affiliate banner injection
    const banner = document.createElement('div')
    banner.id = 'sweepbot-affiliate-banner'
    banner.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: linear-gradient(90deg, #8b5cf6, #06b6d4);
        color: white;
        padding: 8px 16px;
        text-align: center;
        font-size: 14px;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      ">
        🤖 <strong>SweepBot</strong> is tracking your session for analytics
        <button onclick="this.parentElement.parentElement.remove()" style="
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          margin-left: 12px;
          cursor: pointer;
        ">×</button>
      </div>
    `
    
    document.body.appendChild(banner)
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      banner.remove()
    }, 5000)
    
    log.info(`Affiliate banner injected for ${platform.name}`)
  }
}

export const affiliateManager = new AffiliateManager()