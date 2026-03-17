import { ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-12 text-center sm:px-8 sm:py-16',
        className
      )}
    >
      {icon && (
        <div className="bg-brand-500/10 mb-6 flex h-16 w-16 items-center justify-center rounded-full">
          {icon}
        </div>
      )}
      <h3 className="mb-2 text-lg font-semibold text-white">{title}</h3>
      <p className="mb-6 max-w-sm text-sm text-zinc-400">{description}</p>
      {action && <div className="flex gap-3">{action}</div>}
    </div>
  )
}
