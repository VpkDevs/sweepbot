import { type ReactNode } from 'react'
import type { CSSProperties } from 'react'
import { cn } from '../../lib/utils'

/**
 * MarqueeStrip — Infinite horizontal scrolling ticker strip.
 * Duplicates content for seamless looping. Pauses on hover.
 * Premium decorative element seen on Vercel, Arc, Linear.
 */
export function MarqueeStrip({
  children,
  className,
  speed = 30,
  direction = 'left',
  pauseOnHover = true,
  gap = 48,
  fade = true,
}: {
  children: ReactNode
  className?: string
  speed?: number
  direction?: 'left' | 'right'
  pauseOnHover?: boolean
  gap?: number
  fade?: boolean
}) {
  const animationStyle = {
    '--marquee-speed': `${speed}s`,
    '--marquee-gap': `${gap}px`,
    '--marquee-direction': direction === 'left' ? 'normal' : 'reverse',
  } as CSSProperties

  return (
    <div
      className={cn('relative select-none overflow-hidden', pauseOnHover && 'group', className)}
      style={animationStyle}
    >
      {/* Fade edges */}
      {fade && (
        <>
          <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-24 bg-gradient-to-r from-zinc-950 to-transparent" />
          <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-24 bg-gradient-to-l from-zinc-950 to-transparent" />
        </>
      )}

      <div
        className={cn(
          'flex items-center whitespace-nowrap',
          'animate-[marquee_var(--marquee-speed)_linear_infinite_var(--marquee-direction)]',
          pauseOnHover && 'group-hover:[animation-play-state:paused]'
        )}
        style={{ gap: `${gap}px` }}
      >
        {/* Original content */}
        <div className="flex shrink-0 items-center" style={{ gap: `${gap}px` }}>
          {children}
        </div>
        {/* Duplicated for seamless loop */}
        <div className="flex shrink-0 items-center" style={{ gap: `${gap}px` }} aria-hidden>
          {children}
        </div>
      </div>
    </div>
  )
}

/**
 * MarqueeItem — Styled item for use inside MarqueeStrip.
 */
export function MarqueeItem({
  icon,
  label,
  value,
  className,
}: {
  icon?: ReactNode
  label: string
  value?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-xl border border-white/[0.04] bg-white/[0.03] px-4 py-2',
        'whitespace-nowrap text-sm font-medium text-zinc-400',
        className
      )}
    >
      {icon && <span className="text-brand-400 flex-shrink-0">{icon}</span>}
      <span>{label}</span>
      {value && <span className="font-bold tabular-nums text-white">{value}</span>}
    </div>
  )
}
