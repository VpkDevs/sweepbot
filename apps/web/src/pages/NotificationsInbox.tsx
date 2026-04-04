import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, Check, Loader2, Award, Flame, Trophy, Star } from 'lucide-react'
import { api, type NotificationItem } from '../lib/api'
import { cn } from '../lib/utils'
import { ScrollReveal } from '../components/fx/ScrollReveal'
import { TextReveal } from '../components/fx/TextReveal'

type FilterKey = 'all' | 'unread' | 'achievements' | 'streaks' | 'milestones'

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'achievements', label: 'Achievements' },
  { key: 'streaks', label: 'Streaks' },
  { key: 'milestones', label: 'Milestones' },
]

const TYPE_ICONS: Record<string, React.ReactNode> = {
  achievement: <Award className="h-4 w-4 text-yellow-400" />,
  streak: <Flame className="h-4 w-4 text-orange-400" />,
  milestone: <Trophy className="h-4 w-4 text-amber-400" />,
  jackpot: <Star className="text-brand-400 h-4 w-4" />,
  default: <Bell className="h-4 w-4 text-zinc-400" />,
}

function getIcon(type: string): React.ReactNode {
  return TYPE_ICONS[type] ?? TYPE_ICONS['default']
}

function matchesFilter(item: NotificationItem, filter: FilterKey): boolean {
  if (filter === 'all') return true
  if (filter === 'unread') return !item.is_read
  if (filter === 'achievements') return item.type === 'achievement'
  if (filter === 'streaks') return item.type === 'streak'
  if (filter === 'milestones') return item.type === 'milestone'
  return true
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

const EMPTY_MESSAGES: Record<FilterKey, string> = {
  all: 'No notifications yet',
  unread: "You're all caught up! 🎉",
  achievements: 'No achievement notifications',
  streaks: 'No streak notifications',
  milestones: 'No milestone notifications',
}

/**
 * Full notifications inbox page with filter tabs, mark-all-read, and per-item interactions.
 */
export function NotificationsInbox() {
  const queryClient = useQueryClient()
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')

  const { data: rawNotifications, isLoading } = useQuery({
    queryKey: ['notifications', 'inbox'],
    queryFn: () => api.notifications.list({ limit: 100 }),
  })

  const { mutate: markAllRead, isPending: isMarkingAll } = useMutation({
    mutationFn: () => api.notifications.markAllRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const { mutate: markRead } = useMutation({
    mutationFn: (id: string) => api.notifications.markRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const notifications: NotificationItem[] = rawNotifications ?? []
  const filtered = notifications.filter((n) => matchesFilter(n, activeFilter))
  const unreadCount = notifications.filter((n) => !n.is_read).length

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6 lg:p-8">
      {/* Header */}
      <ScrollReveal>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <TextReveal
              as="h1"
              className="heading-display text-shimmer text-3xl text-white"
              stagger={50}
            >
              Notifications
            </TextReveal>
            {unreadCount > 0 && <p className="text-sm text-zinc-500">{unreadCount} unread</p>}
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markAllRead()}
              disabled={isMarkingAll}
              className={cn(
                'press-scale flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all',
                'text-zinc-400 ring-1 ring-white/[0.07] hover:text-white hover:ring-white/[0.12]',
                isMarkingAll && 'cursor-wait opacity-60'
              )}
            >
              {isMarkingAll ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
              Mark all read
            </button>
          )}
        </div>
      </ScrollReveal>

      {/* Filter tabs */}
      <ScrollReveal delay={50}>
        <div className="glass-card flex items-center gap-1 rounded-xl p-1">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveFilter(key)}
              className={cn(
                'flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all',
                activeFilter === key
                  ? 'bg-brand-500/20 text-brand-300 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </ScrollReveal>

      {/* List */}
      <ScrollReveal delay={100}>
        <div className="glass-card overflow-hidden rounded-2xl">
          {isLoading ? (
            <div className="divide-y divide-white/[0.03]">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3">
                  <div className="shimmer mt-0.5 h-8 w-8 flex-shrink-0 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <div className="shimmer h-3.5 w-2/3 rounded" />
                    <div className="shimmer h-3 w-full rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-zinc-500">
              <Bell className="mx-auto mb-3 h-8 w-8 text-zinc-700" />
              <p>{EMPTY_MESSAGES[activeFilter]}</p>
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.03]">
              {filtered.map((item) => (
                <li
                  key={item.id}
                  onClick={() => {
                    if (!item.is_read) markRead(item.id)
                  }}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-white/[0.02]',
                    !item.is_read && 'bg-brand-500/[0.03]'
                  )}
                >
                  {/* Icon */}
                  <div
                    className={cn(
                      'mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full',
                      !item.is_read ? 'bg-brand-500/10 ring-brand-500/20 ring-1' : 'bg-white/[0.04]'
                    )}
                  >
                    {getIcon(item.type)}
                  </div>

                  {/* Text */}
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p
                      className={cn(
                        'text-sm font-medium leading-snug',
                        item.is_read ? 'text-zinc-400' : 'text-white'
                      )}
                    >
                      {item.title}
                    </p>
                    <p className="line-clamp-2 text-xs leading-relaxed text-zinc-500">
                      {item.body}
                    </p>
                  </div>

                  {/* Meta */}
                  <div className="ml-2 flex flex-shrink-0 flex-col items-end gap-1">
                    <span className="text-[10px] text-zinc-600">{timeAgo(item.created_at)}</span>
                    {!item.is_read && (
                      <span className="bg-brand-400 shadow-brand-400/50 h-2 w-2 rounded-full shadow-sm" />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </ScrollReveal>
    </div>
  )
}
