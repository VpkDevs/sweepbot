const isDev = process.env.NODE_ENV !== 'production'

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = (..._args: unknown[]): void => {}

export function createLogger(context: string) {
  const prefix = `[SweepBot:${context}]`

  return {
    // debug and info are silenced in production builds to avoid console noise
    // and accidental leakage of session/context data.
    debug: isDev ? (...args: unknown[]) => console.debug(prefix, ...args) : noop,
    info:  isDev ? (...args: unknown[]) => console.log(prefix, ...args)   : noop,
    // warn and error remain unconditional so production issues are surfaced.
    warn:  (...args: unknown[]) => console.warn(prefix, ...args),
    error: (...args: unknown[]) => console.error(prefix, ...args),
  }
}