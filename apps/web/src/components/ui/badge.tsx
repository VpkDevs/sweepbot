import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border border-transparent bg-brand-500/10 text-brand-400',
        secondary: 'border border-transparent bg-zinc-800/50 text-zinc-300',
        success: 'border border-transparent bg-emerald-500/10 text-emerald-400',
        warning: 'border border-transparent bg-yellow-500/10 text-yellow-400',
        danger: 'border border-transparent bg-red-500/10 text-red-400',
        outline: 'border border-current',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
