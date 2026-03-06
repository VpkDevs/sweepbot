/**
 * Lightweight structured logger for the browser extension context.
 * Does NOT import from @sweepbot/utils — extensions have different bundle
 * constraints and no access to Node.js APIs.
 *
 * In development: all levels logged to console.
 * In production: only warn + error logged (debug/info are no-ops).
 */

type LogContext = Record<string, unknown>

interface Logger {
  debug(msg: string, ctx?: LogContext): void
  info(msg: string, ctx?: LogContext): void
  warn(msg: string, ctx?: LogContext): void
  error(msg: string, ctx?: LogContext): void
}

// WXT sets import.meta.env.MODE; fall back to checking a known dev hostname.
const isDev =
  typeof import.meta !== 'undefined'
    ? import.meta.env?.MODE !== 'production'
    : true

function formatMsg(scope: string, msg: string): string {
  return `[SweepBot:${scope}] ${msg}`
}

export function createLogger(scope: string): Logger {
  return {
    debug(msg, ctx) {
      if (!isDev) return
      if (ctx) {
        console.debug(formatMsg(scope, msg), ctx)
      } else {
        console.debug(formatMsg(scope, msg))
      }
    },
    info(msg, ctx) {
      if (!isDev) return
      if (ctx) {
        console.info(formatMsg(scope, msg), ctx)
      } else {
        console.info(formatMsg(scope, msg))
      }
    },
    warn(msg, ctx) {
      if (ctx) {
        console.warn(formatMsg(scope, msg), ctx)
      } else {
        console.warn(formatMsg(scope, msg))
      }
    },
    error(msg, ctx) {
      if (ctx) {
        console.error(formatMsg(scope, msg), ctx)
      } else {
        console.error(formatMsg(scope, msg))
      }
    },
  }
}
