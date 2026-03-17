/**
 * NotificationPanel — Bell icon + dropdown panel.
 * Queries unread count for badge, loads last 20 notifications on open.
 * Wires: mark single as read on click, mark all as read button, delete.
 */

import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Bell, Trophy, Flame, Star, Zap, Info, X, CheckCheck } from 'lucide-react'
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
  streak: Flame,
  milestone: Star,
  big_win: Zap,
  system: Info,
}

const TYPE_CONFIG: Record<NotificationType, { color: string; bg: string; ring: string }> = {
  achievement: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', ring: 'ring-yellow-500/15' },
  streak: { color: 'text-orange-400', bg: 'bg-orange-500/10', ring: 'ring-orange-500/15' },
  milestone: { color: 'text-brand-400', bg: 'bg-brand-500/10', ring: 'ring-brand-500/15' },
  big_win: { color: 'text-jackpot', bg: 'bg-yellow-500/10', ring: 'ring-yellow-500/15' },
  system: { color: 'text-zinc-400', bg: 'bg-zinc-500/10', ring: 'ring-zinc-500/10' },
}

/**
 * Renders a notifications trigger and dropdown that shows recent notifications and related actions.
 *
 * The component displays a bell button with an unread count badge, polls the unread count periodically,
 * loads the latest notifications when opened, and exposes actions to mark individual notifications as read,
 * mark all as read, and dismiss notifications. The dropdown closes on outside clicks and navigates to a
 * notification's href when a notification with a link is clicked.
 *
 * @returns A React element containing the notifications trigger and dropdown panel
 */

export function NotificationPanel() {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  // Close on outside click
  useEffect(() => {
    if (!open) return
    /**
     * Closes the notification panel when a mouse event originates outside the panel element.
     *
     * @param e - The mouse event used to determine whether the click occurred outside the panel
     */
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
    refetchInterval: 30_000,
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

  /**
   * Handle user click on a notification: mark it read if unread, then navigate to its target and close the panel when a link is present.
   *
   * @param n - The notification that was clicked
   */

  function handleNotificationClick(n: Notification) {
    if (!n.is_read) markRead.mutate(n.id)
    if (n.href) {
      navigate({ to: n.href })
      setOpen(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div ref={panelRef} className="relative">
      {/* Bell trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="press-scale relative rounded-xl p-2 text-zinc-400 transition-all hover:bg-white/[0.04] hover:text-white"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="h-4.5 from-brand-600 to-brand-400 shadow-brand-500/30 pulse-ring absolute -right-0.5 -top-0.5 flex min-w-[1.125rem] items-center justify-center rounded-full bg-gradient-to-r px-1 text-[10px] font-bold tabular-nums leading-none text-white shadow-lg">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="glass-panel animate-spring-in absolute right-0 top-11 z-50 w-[360px] origin-top-right overflow-hidden rounded-2xl border border-white/[0.06] shadow-2xl shadow-black/50">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.04] px-4 py-3.5">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold tracking-tight text-white">Notifications</h3>
              {unread > 0 && (
                <span className="bg-brand-500/15 text-brand-400 ring-brand-500/20 flex h-5 min-w-[1.25rem] items-center justify-center rounded-md px-1.5 text-[10px] font-bold tabular-nums ring-1">
                  {unread}
                </span>
              )}
            </div>
            {unread > 0 && (
              <button
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
                className="text-brand-400 hover:text-brand-300 press-scale flex items-center gap-1.5 text-xs font-medium transition-colors disabled:opacity-50"
                title="Mark all as read"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* Body */}
          <div className="max-h-[440px] overflow-y-auto">
            {isLoading ? (
              <div className="divide-y divide-white/[0.03]">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex gap-3 px-4 py-3.5">
                    <div className="shimmer h-9 w-9 flex-shrink-0 rounded-xl bg-zinc-800/60" />
                    <div className="flex-1 space-y-2 py-0.5">
                      <div className="skeleton-text h-3 w-3/4 rounded-md" />
                      <div className="shimmer h-2.5 w-full rounded-md bg-zinc-800/40" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (notifications as Notification[]).length === 0 ? (
              <div className="animate-fade-in flex flex-col items-center justify-center px-6 py-16 text-center">
                <div className="empty-icon-wrapper mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-800/50">
                  <Bell className="h-6 w-6 text-zinc-600" />
                </div>
                <p className="text-sm font-semibold text-zinc-400">No notifications yet</p>
                <p className="mt-1 max-w-[200px] text-pretty text-xs leading-relaxed text-zinc-600">
                  Achievements, streaks, and milestones will appear here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.03]">
                {(notifications as Notification[]).map((n, i) => {
                  const TypeIcon = TYPE_ICON[n.type] ?? Info
                  const config = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.system
                  return (
                    <div
                      key={n.id}
                      className={cn(
                        'animate-slide-up-fade group relative flex gap-3 px-4 py-3.5 transition-all',
                        `message-delay-${i % 5}`,
                        n.href ? 'cursor-pointer hover:bg-white/[0.03]' : 'hover:bg-white/[0.02]',
                        !n.is_read && 'bg-brand-500/[0.03]'
                      )}
                      onClick={() => handleNotificationClick(n)}
                    >
                      {/* Unread indicator */}
                      {!n.is_read && (
                        <span className="bg-brand-400 shadow-brand-400/50 animate-glow-pulse absolute left-1.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full shadow-sm" />
                      )}

                      {/* Icon */}
                      <div
                        className={cn(
                          'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ring-1 transition-all',
                          config.bg,
                          config.color,
                          config.ring
                        )}
                      >
                        <TypeIcon className="h-4 w-4" />
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            'truncate text-sm leading-snug',
                            n.is_read ? 'font-medium text-zinc-300' : 'font-semibold text-white'
                          )}
                        >
                          {n.title}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-zinc-500">
                          {n.body}
                        </p>
                        <p className="mt-1.5 text-[10px] font-medium tabular-nums text-zinc-600">
                          {timeAgo(n.created_at)}
                        </p>
                      </div>

                      {/* Delete button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteNote.mutate(n.id)
                        }}
                        className="press-scale flex-shrink-0 rounded-lg p-1.5 text-zinc-600 opacity-0 transition-all hover:bg-white/[0.05] hover:text-zinc-300 group-hover:opacity-100"
                        title="Dismiss"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {(notifications as Notification[]).length > 0 && (
            <div className="border-t border-white/[0.04] px-4 py-2.5 text-center">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-600">
                Showing last {(notifications as Notification[]).length} notifications
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
