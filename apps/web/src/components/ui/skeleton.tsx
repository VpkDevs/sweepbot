import { cn } from '../../lib/utils'

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('shimmer animate-pulse rounded-lg bg-zinc-800/50', className)} {...props} />
  )
}

export { Skeleton }
