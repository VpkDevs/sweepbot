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
      className={cn(
        'relative overflow-hidden select-none',
        pauseOnHover && 'group',
        className,
      )}
      style={animationStyle}
    >
      {/* Fade edges */}
      {fade && (
        <>
          <div className="absolute left-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-r from-zinc-950 to-transparent pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-l from-zinc-950 to-transparent pointer-events-none" />
        </>
      )}

      <div
        className={cn(
          'flex items-center whitespace-nowrap',
          'animate-[marquee_var(--marquee-speed)_linear_infinite_var(--marquee-direction)]',
          pauseOnHover && 'group-hover:[animation-play-state:paused]',
        )}
        style={{ gap: `${gap}px` }}
      >
        {/* Original content */}
        <div className="flex items-center shrink-0" style={{ gap: `${gap}px` }}>
          {children}
        </div>
        {/* Duplicated for seamless loop */}
        <div className="flex items-center shrink-0" style={{ gap: `${gap}px` }} aria-hidden>
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
    <div className={cn(
      'flex items-center gap-2.5 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.04]',
      'text-sm font-medium text-zinc-400 whitespace-nowrap',
      className,
    )}>
      {icon && <span className="text-brand-400 flex-shrink-0">{icon}</span>}
      <span>{label}</span>
      {value && <span className="text-white font-bold tabular-nums">{value}</span>}
    </div>
  )
}
