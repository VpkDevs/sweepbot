import { pgTable, uuid, varchar, text, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core'

/**
 * Notification inbox for users.
 * Created automatically by the system when:
 *  - Achievement is awarded
 *  - Win/loss streak passes a milestone
 *  - Big win is verified
 *  - System announcement
 */
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  /** 'achievement' | 'streak' | 'milestone' | 'big_win' | 'system' */
  type: varchar('type', { length: 50 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  body: text('body').notNull(),
  /** Emoji or lucide icon name shown in panel */
  icon: varchar('icon', { length: 100 }),
  /** Optional href — clicking the notification navigates here */
  href: varchar('href', { length: 500 }),
  isRead: boolean('is_read').notNull().default(false),
  readAt: timestamp('read_at'),
  /** Extra metadata: { achievementId, achievementKey, streakCount, etc. } */
  data: jsonb('data'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
