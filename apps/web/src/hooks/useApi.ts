import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export const queryKeys = {
  health: ['health'] as const,
  user: {
    profile: ['user', 'profile'] as const,
    settings: ['user', 'settings'] as const,
    platforms: ['user', 'platforms'] as const,
    subscription: ['user', 'subscription'] as const,
    notificationPrefs: ['user', 'notification-prefs'] as const,
  },
  sessions: {
    list: (params?: object) => ['sessions', params] as const,
    detail: (id: string) => ['sessions', id] as const,
  },
  analytics: {
    portfolio: ['analytics', 'portfolio'] as const,
    platforms: ['analytics', 'platforms'] as const,
    dashboard: ['analytics', 'dashboard'] as const,
    heatmap: (year?: number) => ['analytics', 'heatmap', year] as const,
  },
  platforms: {
    list: ['platforms'] as const,
    detail: (id: string) => ['platforms', id] as const,
    stats: (id: string) => ['platforms', id, 'stats'] as const,
  },
  jackpots: {
    list: (params?: object) => ['jackpots', params] as const,
    history: (id: string) => ['jackpots', id, 'history'] as const,
    leaderboard: ['jackpots', 'leaderboard'] as const,
  },
  redemptions: {
    list: (params?: object) => ['redemptions', params] as const,
    detail: (id: string) => ['redemptions', id] as const,
  },
  trust: {
    list: ['trust'] as const,
    detail: (platform: string) => ['trust', platform] as const,
  },
  flows: {
    list: ['flows'] as const,
    detail: (id: string) => ['flows', id] as const,
    executions: (id: string) => ['flows', id, 'executions'] as const,
  },
  features: {
    achievements: ['features', 'achievements'] as const,
    streaks: ['features', 'streaks'] as const,
    records: ['features', 'records'] as const,
    bigWins: (params?: object) => ['features', 'big-wins', params] as const,
    heatmap: ['features', 'heatmap'] as const,
  },
  notifications: {
    list: (params?: object) => ['notifications', params] as const,
  },
}

export function useUserProfile() {
  return useQuery({ queryKey: queryKeys.user.profile, queryFn: api.user.profile })
}

export function useUserSettings() {
  return useQuery({ queryKey: queryKeys.user.settings, queryFn: api.user.settings })
}

export function useUserPlatforms() {
  return useQuery({ queryKey: queryKeys.user.platforms, queryFn: api.user.platforms })
}

export function useSubscription() {
  return useQuery({ queryKey: queryKeys.user.subscription, queryFn: api.user.subscription })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.user.updateProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.user.profile }),
  })
}

export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.user.updateSettings,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.user.settings }),
  })
}

export function useSessions(params?: { page?: number; limit?: number; platformId?: string }) {
  return useQuery({
    queryKey: queryKeys.sessions.list(params),
    queryFn: () => {
      const p: Record<string, string> = {}
      if (params?.page != null) p.page = String(params.page)
      if (params?.limit != null) p.limit = String(params.limit)
      if (params?.platformId) p.platformId = params.platformId
      return api.sessions.list(Object.keys(p).length ? p : undefined)
    },
  })
}

export function useSession(id: string) {
  return useQuery({
    queryKey: queryKeys.sessions.detail(id),
    queryFn: () => api.sessions.get(id),
    enabled: !!id,
  })
}

export function useCreateSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.sessions.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  })
}

export function useEndSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: {
        ended_at: string
        sc_balance_close?: number
        gc_balance_close?: number
        notes?: string
      }
    }) => api.sessions.end(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  })
}

export function usePortfolio() {
  return useQuery({ queryKey: queryKeys.analytics.portfolio, queryFn: api.analytics.portfolio })
}

export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.analytics.dashboard,
    queryFn: () => api.analytics.portfolio(),
  })
}

export function usePlatforms() {
  return useQuery({ queryKey: queryKeys.platforms.list, queryFn: () => api.platforms.list() })
}

export function usePlatform(id: string) {
  return useQuery({
    queryKey: queryKeys.platforms.detail(id),
    queryFn: () => api.platforms.get(id),
    enabled: !!id,
  })
}

export function usePlatformStats(id: string) {
  return useQuery({
    queryKey: queryKeys.platforms.stats(id),
    queryFn: () => api.platforms.get(id),
    enabled: !!id,
  })
}

export function useJackpots(params?: { page?: number; limit?: number; platform?: string }) {
  return useQuery({
    queryKey: queryKeys.jackpots.list(params),
    queryFn: () => {
      const p: Record<string, string> = {}
      if (params?.page != null) p.page = String(params.page)
      if (params?.limit != null) p.limit = String(params.limit)
      if (params?.platform) p.platform = params.platform
      return api.jackpots.leaderboard(Object.keys(p).length ? p : undefined)
    },
  })
}

export function useJackpotLeaderboard() {
  return useQuery({
    queryKey: queryKeys.jackpots.leaderboard,
    queryFn: () => api.jackpots.leaderboard(),
  })
}

export function useRedemptions(params?: { page?: number; limit?: number; status?: string }) {
  return useQuery({
    queryKey: queryKeys.redemptions.list(params),
    queryFn: () => {
      const p: Record<string, string> = {}
      if (params?.page != null) p.page = String(params.page)
      if (params?.limit != null) p.limit = String(params.limit)
      if (params?.status) p.status = params.status
      return api.redemptions.list(Object.keys(p).length ? p : undefined)
    },
  })
}

export function useCreateRedemption() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.redemptions.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['redemptions'] }),
  })
}

export function useTrustIndex() {
  return useQuery({ queryKey: queryKeys.trust.list, queryFn: () => api.trust.list() })
}

export function useTrustScore(platform: string) {
  return useQuery({
    queryKey: queryKeys.trust.detail(platform),
    queryFn: () => api.trust.get(platform),
    enabled: !!platform,
  })
}

export function useFlows() {
  return useQuery({ queryKey: queryKeys.flows.list, queryFn: () => api.flows.list() })
}

export function useFlow(id: string) {
  return useQuery({
    queryKey: queryKeys.flows.detail(id),
    queryFn: () => api.flows.get(id),
    enabled: !!id,
  })
}

export function useFlowExecutions(id: string) {
  return useQuery({
    queryKey: queryKeys.flows.executions(id),
    queryFn: () => api.flows.executions(id),
    enabled: !!id,
  })
}

export function useExecuteFlow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.flows.execute(id),
    onSuccess: (_data, id) => qc.invalidateQueries({ queryKey: queryKeys.flows.executions(id) }),
  })
}

export function useInterpretFlow() {
  return useMutation({
    mutationFn: (rawInput: string) => api.flows.interpret(rawInput),
  })
}

export function useAchievements() {
  return useQuery({
    queryKey: queryKeys.features.achievements,
    queryFn: () => api.features.achievements(),
  })
}

export function useStreaks() {
  return useQuery({ queryKey: queryKeys.features.streaks, queryFn: api.features.streaks })
}

export function useRecords() {
  return useQuery({ queryKey: queryKeys.features.records, queryFn: api.features.records })
}

export function useBigWins(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: queryKeys.features.bigWins(params),
    queryFn: () => {
      const p: Record<string, string> = {}
      if (params?.page != null) p.page = String(params.page)
      if (params?.limit != null) p.limit = String(params.limit)
      return api.features.bigWins(Object.keys(p).length ? p : undefined)
    },
  })
}

export function useNotifications(params?: { limit?: number; unreadOnly?: boolean }) {
  return useQuery({
    queryKey: queryKeys.notifications.list(params),
    queryFn: () =>
      api.notifications.list(
        params ? { limit: params.limit, unread_only: params.unreadOnly } : undefined
      ),
    refetchInterval: 30_000,
  })
}

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.notifications.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.notifications.markAllRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

export function useCreateCheckoutSession() {
  return useMutation({
    mutationFn: ({ tier, cycle }: { tier: string; cycle: string }) =>
      api.user.createCheckoutSession(tier, cycle),
  })
}
