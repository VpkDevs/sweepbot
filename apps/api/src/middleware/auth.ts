/**
 * Authentication middleware.
 * Validates Supabase JWTs and attaches user context to requests.
 */

import type { FastifyRequest, FastifyReply } from 'fastify'
import { createClient } from '@supabase/supabase-js'
import { env } from '../utils/env.js'
import { logger } from '../utils/logger.js'

// Supabase admin client (server-side only — uses service role key)
export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

declare module 'fastify' {
  interface FastifyRequest {
    user: {
      id: string
      email: string
      tier: string
    } | null
  }
}

/**
 * Prevalidation hook that validates Bearer JWT from Supabase Auth.
 * Attach to routes that require authentication.
 */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.code(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' },
    })
  }

  const token = authHeader.slice(7)
  const { data, error } = await supabaseAdmin.auth.getUser(token)

  if (error || !data.user) {
    logger.warn({ error }, 'Auth failed')
    return reply.code(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
    })
  }

  // Attach user context (tier comes from profiles table in real app)
  request.user = {
    id: data.user.id,
    email: data.user.email ?? '',
    tier: (data.user.user_metadata['tier'] as string | undefined) ?? 'free',
  }
}

/**
 * Optional auth — attaches user if token present, continues if not.
 * Use for routes where auth enhances but isn't required.
 */
export async function optionalAuth(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    request.user = null
    return
  }

  try {
    const token = authHeader.slice(7)
    const { data } = await supabaseAdmin.auth.getUser(token)
    request.user = data.user
      ? {
          id: data.user.id,
          email: data.user.email ?? '',
          tier: (data.user.user_metadata['tier'] as string | undefined) ?? 'free',
        }
      : null
  } catch {
    request.user = null
  }
}
