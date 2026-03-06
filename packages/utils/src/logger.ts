/**
 * Centralized Logging Infrastructure
 * Replaces console.log with structured logging that works in all environments
 * 
 * Usage:
 *   logger.info('User logged in', { userId: '123' })
 *   logger.error('API call failed', { error, endpoint: '/api/users' })
 *   logger.debug('Cache hit', { key: 'user:123' })
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'
type LogContext = Record<string, unknown>

interface LoggerConfig {
  level: LogLevel
  enableConsole: boolean
  enableRemote: boolean
  remoteEndpoint?: string
}

class Logger {
  private config: LoggerConfig
  private readonly levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  }

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: (import.meta.env.VITE_LOG_LEVEL as LogLevel) || 'info',
      enableConsole: import.meta.env.DEV || import.meta.env.VITE_ENABLE_CONSOLE_LOGS === 'true',
      enableRemote: import.meta.env.PROD && import.meta.env.VITE_ENABLE_REMOTE_LOGS === 'true',
      remoteEndpoint: import.meta.env.VITE_LOG_ENDPOINT,
      ...config,
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[this.config.level]
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString()
    const contextStr = context ? ` ${JSON.stringify(context)}` : ''
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${contextStr}`
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    if (!this.shouldLog(level)) return

    const formattedMessage = this.formatMessage(level, message, context)

    // Console output (development + explicit enable)
    if (this.config.enableConsole) {
      const consoleMethod = level === 'debug' ? 'log' : level
      console[consoleMethod](formattedMessage)
    }

    // Remote logging (production)
    if (this.config.enableRemote && this.config.remoteEndpoint) {
      this.sendToRemote(level, message, context).catch((error) => {
        // Failsafe: if remote logging fails, fall back to console
        console.error('Failed to send log to remote:', error)
      })
    }
  }

  private async sendToRemote(level: LogLevel, message: string, context?: LogContext): Promise<void> {
    if (!this.config.remoteEndpoint) return

    try {
      await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level,
          message,
          context,
          timestamp: new Date().toISOString(),
          environment: import.meta.env.MODE,
          userAgent: navigator.userAgent,
        }),
      })
    } catch (error) {
      // Silent fail - don't want logging failures to break the app
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context)
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context)
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context)
  }

  error(message: string, context?: LogContext): void {
    this.log('error', message, context)
  }

  /**
   * Create a child logger with fixed context (useful for scoping logs to a module)
   */
  child(fixedContext: LogContext): Logger {
    const childLogger = new Logger(this.config)
    const originalLog = childLogger.log.bind(childLogger)
    
    childLogger.log = (level: LogLevel, message: string, context?: LogContext) => {
      originalLog(level, message, { ...fixedContext, ...context })
    }

    return childLogger
  }
}

export const logger = new Logger()

// Convenience factory for creating scoped loggers
export const createLogger = (scope: string, context?: LogContext) =>
  logger.child({ scope, ...context })
