export function createLogger(context: string) {
  const prefix = `[SweepBot:${context}]`
  
  return {
    info: (...args: any[]) => console.log(prefix, ...args),
    warn: (...args: any[]) => console.warn(prefix, ...args),
    error: (...args: any[]) => console.error(prefix, ...args),
    debug: (...args: any[]) => console.debug(prefix, ...args)
  }
}