import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export interface StreakData {
  currentStreak: number
  longestStreak: number
  lastActivityDate: string | null
  freezeCredits: number
}

interface RecordActivityResult {
  currentStreak: number
  milestoneReached?: number
}

export function useStreak() {
  const queryClient = useQueryClient()

  const { data: streak, isLoading } = useQuery({
    queryKey: ['streaks', 'my'],
    queryFn: () => api.streaks.get() as unknown as Promise<StreakData>,
  })

  const { mutate: recordActivity, isPending: isRecording } = useMutation({
    mutationFn: () => api.streaks.recordActivity() as Promise<RecordActivityResult>,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['streaks'] })
    },
  })

  return {
    streak: streak ?? null,
    isLoading,
    isRecording,
    recordActivity,
  }
}
