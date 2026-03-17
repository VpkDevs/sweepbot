// Global test utilities and environment setup
import { expect, vi, afterEach } from 'vitest'
// Use explicit extend — the /vitest shorthand is incompatible with Vitest <0.34 (ESM/CJS interop)
import * as jestDomMatchers from '@testing-library/jest-dom/matchers'
expect.extend(jestDomMatchers)
import { cleanup } from '@testing-library/react'

// Auto-cleanup DOM after each test
afterEach(() => {
  cleanup()
})

// Provide a working localStorage for Zustand persist middleware (jsdom's
// Storage prototype methods can fail instanceof checks in Vitest 0.33).
const _localStorage: Record<string, string> = {}
Object.defineProperty(window, 'localStorage', {
  writable: true,
  value: {
    getItem: (key: string) => _localStorage[key] ?? null,
    setItem: (key: string, value: string) => { _localStorage[key] = value },
    removeItem: (key: string) => { delete _localStorage[key] },
    clear: () => { Object.keys(_localStorage).forEach(k => delete _localStorage[k]) },
    get length() { return Object.keys(_localStorage).length },
    key: (index: number) => Object.keys(_localStorage)[index] ?? null,
  } as Storage,
})

// Mock window.matchMedia (used by Radix UI, shadcn components)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock IntersectionObserver (used by lazy-loading, charts, TextReveal)
// Assign to both window and globalThis to ensure jsdom picks it up
class MockIntersectionObserver {
  readonly root: Element | Document | null = null
  readonly rootMargin: string = '0px'
  readonly thresholds: ReadonlyArray<number> = []
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords(): IntersectionObserverEntry[] { return [] }
  unobserve() {}
}
global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver
// Also assign to window for jsdom compatibility
Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver,
})

// Mock ResizeObserver (used by Recharts, HUD overlay)
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as unknown as typeof ResizeObserver

// scrollIntoView is not implemented in jsdom
window.HTMLElement.prototype.scrollIntoView = vi.fn()

// Mock chrome extension APIs for any shared components that reference them
if (!('chrome' in globalThis)) {
  (globalThis as typeof globalThis & { chrome: unknown }).chrome = {
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined),
        clear: vi.fn().mockResolvedValue(undefined),
      },
    },
  }
}
