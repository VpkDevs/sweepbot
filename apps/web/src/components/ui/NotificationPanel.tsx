/**
 * NotificationPanel — Bell icon + dropdown panel.
 * Queries unread count for badge, loads last 20 notifications on open.
 * Wires: mark single as read on click, mark all as read button, delete.
 */

import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
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

const TYPE_CONFIG: Record<NotificationType, { color: string; bg: string; ring: string }> = {
  achievement: { color: 'text-yellow-400',  bg: 'bg-yellow-500/10', ring: 'ring-yellow-500/15' },
  streak:      { color: 'text-orange-400',  bg: 'bg-orange-500/10', ring: 'ring-orange-500/15' },
  milestone:   { color: 'text-brand-400',   bg: 'bg-brand-500/10',  ring: 'ring-brand-500/15' },
  big_win:     { color: 'text-jackpot',     bg: 'bg-yellow-500/10', ring: 'ring-yellow-500/15' },
  system:      { color: 'text-zinc-400',    bg: 'bg-zinc-500/10',   ring: 'ring-zinc-500/10' },
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
        className="relative p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-all press-scale"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4.5 min-w-[1.125rem] items-center justify-center rounded-full bg-gradient-to-r from-brand-600 to-brand-400 px-1 text-[10px] font-bold text-white tabular-nums leading-none shadow-lg shadow-brand-500/30 pulse-ring">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-11 z-50 w-[360px] glass-panel rounded-2xl shadow-2xl shadow-black/50 overflow-hidden animate-spring-in origin-top-right border border-white/[0.06]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.04]">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-tight">Notifications</h3>
              {unread > 0 && (
                <span className="flex items-center justify-center h-5 min-w-[1.25rem] rounded-md bg-brand-500/15 px-1.5 text-[10px] font-bold text-brand-400 tabular-nums ring-1 ring-brand-500/20">
                  {unread}
                </span>
              )}
            </div>
            {unread > 0 && (
              <button
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
                className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 font-medium disabled:opacity-50 transition-colors press-scale"
                title="Mark all as read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
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
                    <div className="w-9 h-9 rounded-xl bg-zinc-800/60 flex-shrink-0 shimmer" />
                    <div className="flex-1 space-y-2 py-0.5">
                      <div className="h-3 w-3/4 skeleton-text rounded-md" />
                      <div className="h-2.5 w-full bg-zinc-800/40 rounded-md shimmer" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (notifications as Notification[]).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6 animate-fade-in">
                <div className="empty-icon-wrapper w-14 h-14 rounded-2xl bg-zinc-800/50 flex items-center justify-center mb-3">
                  <Bell className="w-6 h-6 text-zinc-600" />
                </div>
                <p className="text-sm font-semibold text-zinc-400">No notifications yet</p>
                <p className="text-xs text-zinc-600 mt-1 max-w-[200px] leading-relaxed text-pretty">
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
                        'group relative flex gap-3 px-4 py-3.5 transition-all animate-slide-up-fade',
                        n.href ? 'cursor-pointer hover:bg-white/[0.03]' : 'hover:bg-white/[0.02]',
                        !n.is_read && 'bg-brand-500/[0.03]',
                      )}
                      style={{ animationDelay: `${i * 30}ms` }}
                      onClick={() => handleNotificationClick(n)}
                    >
                      {/* Unread indicator */}
                      {!n.is_read && (
                        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-brand-400 shadow-sm shadow-brand-400/50 animate-glow-pulse" />
                      )}

                      {/* Icon */}
                      <div
                        className={cn(
                          'flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ring-1 transition-all',
                          config.bg,
                          config.color,
                          config.ring,
                        )}
                      >
                        <TypeIcon className="w-4 h-4" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          'text-sm leading-snug truncate',
                          n.is_read ? 'text-zinc-300 font-medium' : 'text-white font-semibold',
                        )}>
                          {n.title}
                        </p>
                        <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2 leading-relaxed">
                          {n.body}
                        </p>
                        <p className="text-[10px] text-zinc-600 mt-1.5 tabular-nums font-medium">{timeAgo(n.created_at)}</p>
                      </div>

                      {/* Delete button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteNote.mutate(n.id)
                        }}
                        className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.05] transition-all press-scale"
                        title="Dismiss"
                      >
                        <X className="w-3.5 h-3.5" />
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
              <span className="text-[10px] text-zinc-600 uppercase tracking-[0.15em] font-bold">
                Showing last {(notifications as Notification[]).length} notifications
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
