import { cn } from '../../lib/utils'

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-lg bg-zinc-800/50 shimmer', className)}
      {...props}
    />
  )
}

export { Skeleton }
