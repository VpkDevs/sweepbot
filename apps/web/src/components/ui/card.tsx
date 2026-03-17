import { ReactNode } from 'react'
import { cn } from '../../lib/utils'

export function Card({
  children,
  className,
  variant = 'default',
}: {
  children: ReactNode
  className?: string
  variant?: 'default' | 'elevated' | 'ghost'
}) {
  const variantStyles = {
    default: 'glass-card rounded-2xl border border-white/5',
    elevated: 'glass-card-elevated rounded-2xl border border-white/8 shadow-xl',
    ghost: 'rounded-2xl border border-white/5 bg-transparent',
  }

  return <div className={cn(variantStyles[variant], className)}>{children}</div>
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('border-b border-white/5 px-6 py-4 sm:px-8', className)}>{children}</div>
  )
}

export function CardTitle({
  children,
  className,
  as: Comp = 'h3',
}: {
  children: ReactNode
  className?: string
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
}) {
  const Component = Comp as any
  return (
    <Component
      className={cn('text-lg font-bold leading-tight tracking-tight text-white', className)}
    >
      {children}
    </Component>
  )
}

export function CardContent({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('px-6 py-4 sm:px-8 sm:py-6', className)}>{children}</div>
}

export function CardDescription({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <p className={cn('text-sm text-zinc-400', className)}>{children}</p>
}
