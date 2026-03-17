import { Skeleton } from './skeleton'
import { cn } from '../../lib/utils'

interface LoadingStateProps {
  count?: number
  variant?: 'text' | 'card' | 'table'
  className?: string
}

export function LoadingState({ count = 3, variant = 'card', className }: LoadingStateProps) {
  if (variant === 'text') {
    return (
      <div className={cn('space-y-3', className)}>
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    )
  }

  if (variant === 'table') {
    return (
      <div className={cn('space-y-2', className)}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-10 w-10 flex-shrink-0 rounded-lg" />
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-20" />
          </div>
        ))}
      </div>
    )
  }

  // Card variant
  return (
    <div className={cn('space-y-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-lg border border-white/5 p-4">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-8 w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-16" />
          </div>
        </div>
      ))}
    </div>
  )
}
