/**
 * Extends WXT's auto-generated ImportMetaEnv with custom and standard Vite env vars.
 * WXT only generates extension-specific properties (BROWSER, MANIFEST_VERSION, etc.)
 * so we declare the additional vars we use here via interface merging.
 */
interface ImportMetaEnv {
  /** API base URL, injected at build time via .env / VITE_API_URL */
  readonly VITE_API_URL?: string
  /**
   * Vite build mode: "development" | "production" | "test"
   * Available in all Vite-based builds; WXT maps this to COMMAND but also
   * sets MODE for broad compatibility.
   */
  readonly MODE?: string
}
