import { ReactNode } from 'react'
import { Card, CardContent } from './card'
import { cn } from '../../lib/utils'

interface StatCardProps {
  label: string
  value: string | number | ReactNode
  icon?: ReactNode
  trend?: { value: number; direction: 'up' | 'down' | 'neutral' }
  className?: string
  accentColor?: 'brand' | 'emerald' | 'blue' | 'yellow' | 'red'
}

const colorMap = {
  brand: 'text-brand-400 bg-brand-500/10',
  emerald: 'text-emerald-400 bg-emerald-500/10',
  blue: 'text-blue-400 bg-blue-500/10',
  yellow: 'text-yellow-400 bg-yellow-500/10',
  red: 'text-red-400 bg-red-500/10',
}

export function StatCard({
  label,
  value,
  icon,
  trend,
  className,
  accentColor = 'brand',
}: StatCardProps) {
  const color = colorMap[accentColor]

  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          {icon && <div className={cn('rounded-lg p-2', color)}>{icon}</div>}
          {trend && (
            <div
              className={cn(
                'rounded px-2 py-1 text-xs font-bold',
                trend.direction === 'up' && 'bg-emerald-500/10 text-emerald-400',
                trend.direction === 'down' && 'bg-red-500/10 text-red-400',
                trend.direction === 'neutral' && 'bg-zinc-500/10 text-zinc-400'
              )}
            >
              {trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→'}{' '}
              {Math.abs(trend.value).toFixed(1)}%
            </div>
          )}
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-zinc-400">
          {label}
        </p>
        <p className="mt-2 text-2xl font-bold text-white">{value}</p>
      </CardContent>
    </Card>
  )
}
