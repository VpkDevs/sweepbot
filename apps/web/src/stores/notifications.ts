import { create } from 'zustand'
import { api } from '../lib/api'

interface Notification {
  id: string
  type: string
  title: string
  body: string
  icon?: string
  href?: string
  isRead: boolean
  readAt?: string
  createdAt: string
  data?: Record<string, unknown>
}

interface NotificationsState {
  notifications: Notification[]
  unreadCount: number
  isLoading: boolean
  hasMore: boolean
  page: number
  fetch: (reset?: boolean) => Promise<void>
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  hasMore: true,
  page: 1,

  fetch: async (reset = false) => {
    const { page, isLoading } = get()
    if (isLoading) return

    const nextPage = reset ? 1 : page
    set({ isLoading: true })

    try {
      const data = (await api.notifications.list({ limit: 20 })) as unknown as Notification[]
      const unread = data.filter((n) => !n.isRead).length

      set((state) => ({
        notifications: reset ? data : [...state.notifications, ...data],
        unreadCount: reset ? unread : state.unreadCount + unread,
        page: nextPage + 1,
        hasMore: data.length === 20,
        isLoading: false,
      }))
    } catch {
      set({ isLoading: false })
    }
  },

  markRead: async (id) => {
    await api.notifications.markRead(id)
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }))
  },

  markAllRead: async () => {
    await api.notifications.markAllRead()
    set((state) => ({
      notifications: state.notifications.map((n) => ({
        ...n,
        isRead: true,
        readAt: n.readAt ?? new Date().toISOString(),
      })),
      unreadCount: 0,
    }))
  },

  remove: async (id) => {
    const notification = get().notifications.find((n) => n.id === id)
    await api.notifications.delete(id)
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
      unreadCount: notification && !notification.isRead
        ? Math.max(0, state.unreadCount - 1)
        : state.unreadCount,
    }))
  },
}))
