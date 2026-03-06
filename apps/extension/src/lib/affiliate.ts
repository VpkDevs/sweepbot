/**
 * Affiliate tracking and link injection.
 * Tracks affiliate clicks, manages referral links, and injects signup prompts.
 */

import type { PlatformConfig } from './platforms'
import { extensionApi } from './api'
import { storage } from './storage'
import { createLogger } from './logger'

const log = createLogger('AffiliateManager')

class AffiliateManager {
  /**
   * Inject an affiliate link into a page
   */
  async injectAffiliateLink(platform: PlatformConfig, targetSelector: string): Promise<void> {
    if (!platform.affiliateUrl) return

    const userRefCode = await storage.get('userRefCode')
    if (!userRefCode) return

    const affiliateUrl = platform.affiliateUrl.replace('SWEEPBOT', userRefCode)

    // Wait for DOM to be ready
    const element = await this.waitForElement(targetSelector, 5000)
    if (!element) return

    // Replace href if it's a link, otherwise set onclick
    if (element instanceof HTMLAnchorElement) {
      element.href = affiliateUrl
      element.target = '_blank'
      element.rel = 'noopener noreferrer'
    } else {
      element.addEventListener('click', (e) => {
        e.preventDefault()
        window.open(affiliateUrl, '_blank', 'noopener,noreferrer')
      })
    }

    // Track the click
    await this.trackClick(platform.slug)
  }

  /**
   * Inject an affiliate banner on signup pages
   */
  async injectAffiliateBanner(platform: PlatformConfig): Promise<void> {
    const userRefCode = await storage.get('userRefCode')
    if (!userRefCode || !platform.affiliateUrl) return

    // Create banner element
    const banner = document.createElement('div')
    banner.id = 'sweepbot-affiliate-banner'
    banner.className =
      'sweepbot-affiliate-banner fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-brand-600 to-brand-500 text-white px-4 py-3 flex items-center justify-between'
    banner.innerHTML = `
      <span class="text-sm">
        💰 Use code <strong>SWEEPBOT</strong> for bonus coins on ${platform.name}!
      </span>
      <div class="flex gap-2">
        <button class="sweepbot-signup-btn text-xs bg-white text-brand-600 px-3 py-1 rounded font-semibold hover:bg-gray-100">
          Sign Up
        </button>
        <button class="sweepbot-close-btn text-sm hover:opacity-75">✕</button>
      </div>
    `

    // Add styles
    const style = document.createElement('style')
    style.textContent = `
      .sweepbot-affiliate-banner {
        animation: slideDown 0.3s ease-out;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      }
      @keyframes slideDown {
        from { transform: translateY(-100%); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      .sweepbot-affiliate-banner * {
        box-sizing: border-box;
      }
    `
    document.head.appendChild(style)

    // Add to page
    document.body.insertBefore(banner, document.body.firstChild)

    // Set up event listeners
    const signupBtn = banner.querySelector('.sweepbot-signup-btn') as HTMLButtonElement
    const closeBtn = banner.querySelector('.sweepbot-close-btn') as HTMLButtonElement

    if (signupBtn) {
      signupBtn.addEventListener('click', () => {
        const affiliateUrl = platform.affiliateUrl!.replace('SWEEPBOT', userRefCode)
        window.open(affiliateUrl, '_blank', 'noopener,noreferrer')
        this.trackClick(platform.slug)
      })
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', async () => {
        banner.remove()
        // Store preference to not show again today
        await storage.set('affiliateNoShowUntil', {
          [platform.slug]: Date.now() + 24 * 60 * 60 * 1000,
        })
      })
    }
  }

  /**
   * Track an affiliate click
   */
  private async trackClick(platformSlug: string): Promise<void> {
    try {
      await extensionApi.trackAffiliateClick(platformSlug)
      await storage.logEvent({
        type: 'session_start',
        platformSlug,
        timestamp: Date.now(),
        data: { affiliate_click: true },
      })
    } catch (error) {
      log.error('Failed to track click', { error })
    }
  }

  /**
   * Track an affiliate signup (when we detect user registration)
   */
  async trackSignup(platformSlug: string, externalUserId?: string): Promise<void> {
    try {
      await extensionApi.trackAffiliateSignup(platformSlug, externalUserId)
      await storage.logEvent({
        type: 'session_start',
        platformSlug,
        timestamp: Date.now(),
        data: { affiliate_signup: true, external_user_id: externalUserId },
      })
    } catch (error) {
      log.error('Failed to track signup', { error })
    }
  }

  /**
   * Wait for an element to appear in DOM
   */
  private waitForElement(selector: string, timeout = 5000): Promise<Element | null> {
    return new Promise((resolve) => {
      const element = document.querySelector(selector)
      if (element) {
        resolve(element)
        return
      }

      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector)
        if (el) {
          observer.disconnect()
          resolve(el)
        }
      })

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      })

      setTimeout(() => {
        observer.disconnect()
        resolve(null)
      }, timeout)
    })
  }
}

export const affiliateManager = new AffiliateManager()
