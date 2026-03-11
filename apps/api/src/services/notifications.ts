/**
 * Notifications Service
 * Handles creating and managing user notifications
 */

import { z } from 'zod'
import { db } from '../db/client.js'
import { notifications } from '../db/schema/notifications.js'
import { eq, and, desc, count } from 'drizzle-orm'

type NotificationType =
  | 'achievement'
  | 'streak'
  | 'milestone'
  | 'big_win'
  | 'system'

// Helper to create notifications (for use in other services)
export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  icon?: string,
  href?: string,
  data?: Record<string, unknown>
) {
  return db.insert(notifications).values({
    userId,
    type,
    title,
    body,
    icon: icon ?? null,
    href: href ?? null,
    data: data ?? null,
    isRead: false,
  })
}

export async function getUserNotifications(
  userId: string,
  opts: { limit?: number; unreadOnly?: boolean } = {}
) {
  const { limit = 20, unreadOnly = false } = opts

  const conditions = [eq(notifications.userId, userId)]
  if (unreadOnly) conditions.push(eq(notifications.isRead, false))

  return db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
}

export async function getUnreadCount(userId: string): Promise<number> {
  const result = await db
    .select({ total: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))

  return Number(result[0]?.total ?? 0)
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

// Zod schema for validation (exported for reuse)
export const NotificationTypeSchema = z.enum(['achievement', 'streak', 'milestone', 'big_win', 'system'])
