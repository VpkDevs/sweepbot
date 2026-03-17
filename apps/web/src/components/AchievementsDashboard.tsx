import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Flame, Trophy, TrendingUp, Clock, Target, Zap } from 'lucide-react'
import { api } from '../lib/api'

interface AchievementSummary {
  streak: {
    current: number
    longest: number
  }
  records: {
    total: number
    biggestWin: number | null
    highestRTP: number | null
  }
  stats: {
    totalSessions: number
  }
}

export function AchievementsDashboard() {
  const { data: achievements, isLoading } = useQuery<AchievementSummary>({
    queryKey: ['achievements', 'summary'],
    queryFn: () => api.achievements.summary() as unknown as Promise<AchievementSummary>,
  })

  if (isLoading) {
    return <div className="text-muted-foreground">Loading achievements...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Achievements</h2>
        <p className="text-muted-foreground">Track your progress and personal bests</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Current Streak */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Streak</CardTitle>
            <Flame className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{achievements?.streak.current || 0} days</div>
            <p className="text-xs text-muted-foreground">
              Longest: {achievements?.streak.longest || 0} days
            </p>
          </CardContent>
        </Card>

        {/* Personal Records */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Personal Records</CardTitle>
            <Trophy className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{achievements?.records.total || 0}</div>
            <p className="text-xs text-muted-foreground">Records set</p>
          </CardContent>
        </Card>

        {/* Total Sessions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
            <Target className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{achievements?.stats.totalSessions || 0}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
      </div>

      {/* Records Detail */}
      <Card>
        <CardHeader>
          <CardTitle>Personal Bests</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">Biggest Win</span>
              </div>
              <span className="text-sm font-bold">
                {achievements?.records.biggestWin 
                  ? `${achievements.records.biggestWin.toFixed(2)} SC`
                  : '—'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-medium">Highest RTP</span>
              </div>
              <span className="text-sm font-bold">
                {achievements?.records.highestRTP 
                  ? `${achievements.records.highestRTP.toFixed(2)}%`
                  : '—'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">Longest Session</span>
              </div>
              <span className="text-sm font-bold">—</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Streak Milestones */}
      <Card>
        <CardHeader>
          <CardTitle>Streak Milestones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[7, 30, 100, 365].map((milestone) => {
              const current = achievements?.streak.current || 0
              const achieved = current >= milestone
              const progress = Math.min((current / milestone) * 100, 100)

              return (
                <div key={milestone} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className={achieved ? 'font-medium text-green-600' : 'text-muted-foreground'}>
                      {milestone} days {achieved && '✓'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {current}/{milestone}
                    </span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        achieved ? 'bg-green-500' : 'bg-primary'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
