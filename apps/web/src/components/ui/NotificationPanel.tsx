/**
 * NotificationPanel — Bell icon + dropdown panel.
 * Queries unread count for badge, loads last 20 notifications on open.
 * Wires: mark single as read on click, mark all as read button, delete.
 */

import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Bell,
  Trophy,
  Flame,
  Star,
  Zap,
  Info,
  X,
  CheckCheck,
} from 'lucide-react'
import { api } from '../../lib/api'
import { timeAgo, cn } from '../../lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

type NotificationType = 'achievement' | 'streak' | 'milestone' | 'big_win' | 'system'

type Notification = {
  id: string
  type: NotificationType
  title: string
  body: string
  icon: string | null
  href: string | null
  is_read: boolean
  read_at: string | null
  data: unknown
  created_at: string
}

// ── Icon map ──────────────────────────────────────────────────────────────────

const TYPE_ICON: Record<NotificationType, React.ElementType> = {
  achievement: Trophy,
  streak:      Flame,
  milestone:   Star,
  big_win:     Zap,
  system:      Info,
}

const TYPE_COLOR: Record<NotificationType, string> = {
  achievement: 'text-yellow-400',
  streak:      'text-orange-400',
  milestone:   'text-brand-400',
  big_win:     'text-jackpot',
  system:      'text-zinc-400',
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NotificationPanel() {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: countData } = useQuery({
    queryKey: ['notifications', 'count'],
    queryFn: () => api.notifications.count(),
    refetchInterval: 30_000, // poll every 30s
  })

  const unread = countData?.unread ?? 0

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => api.notifications.list({ limit: 20 }),
    enabled: open,
  })

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }

  const markRead = useMutation({
    mutationFn: (id: string) => api.notifications.markRead(id),
    onSuccess: invalidate,
  })

  const markAll = useMutation({
    mutationFn: () => api.notifications.markAllRead(),
    onSuccess: invalidate,
  })

  const deleteNote = useMutation({
    mutationFn: (id: string) => api.notifications.delete(id),
    onSuccess: invalidate,
  })

  // ── Handlers ──────────────────────────────────────────────────────────────────

  function handleNotificationClick(n: Notification) {
    if (!n.is_read) markRead.mutate(n.id)
    if (n.href) {
      window.location.href = n.href
      setOpen(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div ref={panelRef} className="relative">
      {/* Bell trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative text-zinc-400 hover:text-white transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white tabular-nums leading-none">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-9 z-50 w-80 rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <h3 className="text-sm font-semibold text-white">Notifications</h3>
            {unread > 0 && (
              <button
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
                className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 disabled:opacity-50 transition-colors"
                title="Mark all as read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* Body */}
          <div className="max-h-[420px] overflow-y-auto divide-y divide-zinc-800/60">
            {isLoading ? (
              <div className="space-y-0">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex gap-3 px-4 py-3 animate-pulse">
                    <div className="w-7 h-7 rounded-full bg-zinc-800 flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-3/4 bg-zinc-800 rounded" />
                      <div className="h-2.5 w-full bg-zinc-800 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (notifications as Notification[]).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <Bell className="w-8 h-8 text-zinc-700 mb-3" />
                <p className="text-sm text-zinc-500">No notifications yet</p>
                <p className="text-xs text-zinc-600 mt-1">
                  You'll see achievements, streaks, and milestones here.
                </p>
              </div>
            ) : (
              (notifications as Notification[]).map((n) => {
                const TypeIcon = TYPE_ICON[n.type] ?? Info
                const iconColor = TYPE_COLOR[n.type] ?? 'text-zinc-400'
                return (
                  <div
                    key={n.id}
                    className={cn(
                      'group relative flex gap-3 px-4 py-3 transition-colors',
                      n.href ? 'cursor-pointer hover:bg-zinc-800/60' : 'hover:bg-zinc-800/30',
                      !n.is_read && 'bg-zinc-800/20',
                    )}
                    onClick={() => handleNotificationClick(n)}
                  >
                    {/* Unread dot */}
                    {!n.is_read && (
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-brand-500" />
                    )}

                    {/* Icon */}
                    <div className={cn('flex-shrink-0 mt-0.5 w-7 h-7 rounded-full flex items-center justify-center bg-zinc-800', iconColor)}>
                      <TypeIcon className="w-3.5 h-3.5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white leading-snug truncate">
                        {n.title}
                      </p>
                      <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2 leading-relaxed">
                        {n.body}
                      </p>
                      <p className="text-[10px] text-zinc-600 mt-1">{timeAgo(n.created_at)}</p>
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteNote.mutate(n.id)
                      }}
                      className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-zinc-400 transition-all p-0.5 rounded"
                      title="Dismiss"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          {(notifications as Notification[]).length > 0 && (
            <div className="border-t border-zinc-800 px-4 py-2.5 text-center">
              <span className="text-xs text-zinc-600">
                Showing last {(notifications as Notification[]).length} notifications
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
