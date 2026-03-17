/**
 * Platform-specific DOM selectors for automation.
 * Each platform has unique selectors for common actions.
 */

export interface PlatformSelectors {
  loginButton?: string
  loginButtonText?: string
  bonusButton?: string
  bonusButtonText?: string
  bonusAmount?: string
  spinButton?: string
  spinButtonText?: string
  winAmount?: string
  balance?: string
  gameCard?: string
}

export const PLATFORM_SELECTORS: Record<string, PlatformSelectors> = {
  _default: {
    loginButton: '[data-testid="login-button"], .login-btn, button[aria-label="Log in"]',
    loginButtonText: 'Log In',
    bonusButton: '[data-testid="bonus-button"], .bonus-claim, button[aria-label="Claim bonus"]',
    bonusButtonText: 'Claim',
    spinButton: '[data-testid="spin-button"], .spin-btn, button[aria-label="Spin"]',
    spinButtonText: 'Spin',
    winAmount: '[data-testid="win-amount"], .win-display',
    balance: '[data-testid="balance"], .balance-display',
  },

  chumbacasino: {
    loginButton: '.header-login-button',
    loginButtonText: 'Sign In',
    bonusButton: '.daily-bonus-claim',
    bonusButtonText: 'Claim Daily Bonus',
    bonusAmount: '.bonus-amount-display',
    spinButton: '.game-spin-button',
    winAmount: '.win-amount',
    balance: '.user-balance-sc',
  },

  luckyland: {
    loginButton: '.login-link',
    loginButtonText: 'Login',
    bonusButton: '.claim-bonus-btn',
    bonusButtonText: 'Claim',
    spinButton: '.spin-button',
    winAmount: '.win-display',
    balance: '.balance-sc',
  },

  stake: {
    loginButton: '[data-test="login-button"]',
    bonusButton: '[data-test="bonus-claim"]',
    spinButton: '[data-test="spin"]',
    winAmount: '[data-test="win-amount"]',
    balance: '[data-test="balance"]',
  },

  pulsz: {
    loginButton: '.header-sign-in',
    bonusButton: '.daily-bonus-button',
    spinButton: '.game-spin',
    winAmount: '.win-value',
    balance: '.sc-balance',
  },

  wowvegas: {
    loginButton: '.login-button',
    bonusButton: '.bonus-claim',
    spinButton: '.spin',
    winAmount: '.win',
    balance: '.balance',
  },

  fortunecoins: {
    loginButton: '.sign-in-btn',
    bonusButton: '.claim-daily-bonus',
    spinButton: '.spin-btn',
    winAmount: '.win-amount-display',
    balance: '.fc-balance',
  },
}
