/**
 * SweepBot API — Entry Point
 *
 * Starts the Fastify server. This file is the single entry point for the API
 * process. Keep it thin — all logic lives in server.ts and its plugins.
 */

import { buildServer } from './server.js'
import { env } from './utils/env.js'
import { logger } from './utils/logger.js'

const start = async (): Promise<void> => {
  const server = await buildServer()

  try {
    await server.listen({
      port: env.API_PORT,
      host: env.API_HOST,
    })
    logger.info({ port: env.API_PORT, env: env.NODE_ENV }, '🚀 SweepBot API is running')
  } catch (err) {
    logger.fatal({ err }, 'Failed to start server')
    process.exit(1)
  }
}

// Handle uncaught exceptions gracefully
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception')
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled rejection')
  process.exit(1)
})

void start()
