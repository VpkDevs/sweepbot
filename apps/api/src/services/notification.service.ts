import { db } from '../db/client.js'
import { notifications } from '../db/schema/notifications.js'
import { eq, and, desc, count } from 'drizzle-orm'
import { logger } from '../utils/logger.js'

export type NotificationType =
  | 'achievement_unlocked'
  | 'session_milestone'
  | 'jackpot_alert'
  | 'redemption_update'
  | 'subscription_update'
  | 'trust_alert'
  | 'system'

export interface CreateNotificationInput {
  userId: string
  type: NotificationType
  title: string
  body: string
  icon?: string
  href?: string
  data?: Record<string, unknown>
}

export async function createNotification(input: CreateNotificationInput) {
  try {
    const [notification] = await db
      .insert(notifications)
      .values({
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        ...(input.icon !== null && input.icon !== undefined ? { icon: input.icon } : {}),
        ...(input.href !== null && input.href !== undefined ? { href: input.href } : {}),
        data: input.data ?? null,
      })
      .returning()

    logger.debug({ userId: input.userId, type: input.type }, 'Notification created')
    return notification
  } catch (error) {
    logger.error({ error, userId: input.userId }, 'Failed to create notification')
    throw error
  }
}

export async function getUserNotifications(
  userId: string,
  opts: { limit?: number; offset?: number; unreadOnly?: boolean } = {}
) {
  const { limit = 20, offset = 0, unreadOnly = false } = opts

  const conditions = [eq(notifications.userId, userId)]
  if (unreadOnly) conditions.push(eq(notifications.isRead, false))

  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(notifications)
      .where(and(...conditions)),
  ])

  return { data: rows, total: Number(countRows[0]?.total ?? 0) }
}

export async function markNotificationRead(notificationId: string, userId: string) {
  const [updated] = await db
    .update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
    .returning()

  return updated
}

export async function markAllNotificationsRead(userId: string) {
  await db
    .update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
}

export async function deleteNotification(notificationId: string, userId: string) {
  const [deleted] = await db
    .delete(notifications)
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
    .returning()

  return deleted
}

export async function getUnreadCount(userId: string): Promise<number> {
  const result = await db
    .select({ total: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))

  return Number(result[0]?.total ?? 0)
}
