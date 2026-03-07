import { useRef, useEffect, useState, type ReactNode } from 'react'
import { cn } from '../../lib/utils'

function getRevealDelayClass(delayMs: number) {
  const step = Math.max(0, Math.min(12, Math.round(delayMs / 40)))
  return `reveal-delay-${step}`
}

/**
 * TextReveal — Per-word or per-character staggered reveal animation.
 * Uses Intersection Observer to trigger on scroll into view.
 * Award-winning motion design pattern from Awwwards SOTD sites.
 */
export function TextReveal({
  children,
  className,
  as: Component = 'div',
  delay = 0,
  stagger = 40,
  mode = 'word',
  once = true,
  threshold = 0.2,
}: {
  children: ReactNode
  className?: string | undefined
  as?: React.ElementType
  delay?: number
  stagger?: number
  mode?: 'word' | 'char' | 'line'
  once?: boolean
  threshold?: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry) return
        if (entry.isIntersecting) {
          setIsVisible(true)
          if (once) observer.unobserve(el)
        } else if (!once) {
          setIsVisible(false)
        }
      },
      { threshold },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [once, threshold])

  // Split text into tokens
  const text = typeof children === 'string' ? children : ''
  const tokens = mode === 'char'
    ? text.split('')
    : mode === 'line'
      ? text.split('\n')
      : text.split(/(\s+)/)

  if (typeof children !== 'string') {
    // For non-string children, wrap the whole thing
    return (
      <Component
        ref={containerRef}
        className={cn(
          'transition-all duration-700',
          isVisible
            ? 'opacity-100 translate-y-0 blur-0'
            : 'opacity-0 translate-y-6 blur-[4px]',
          getRevealDelayClass(delay),
          className,
        )}
      >
        {children}
      </Component>
    )
  }

  return (
    <Component ref={containerRef} className={cn('flex flex-wrap', className)} aria-label={text}>
      {tokens.map((token, i) => {
        const isSpace = /^\s+$/.test(token)
        if (isSpace) {
          return <span key={`s-${i}`} className="whitespace-pre">{token}</span>
        }

        const tokenDelay = delay + i * stagger

        return (
          <span
            key={`t-${i}`}
            className={cn(
              'inline-block transition-all duration-700 ease-out',
              isVisible
                ? 'opacity-100 translate-y-0 blur-0'
                : 'opacity-0 translate-y-[0.5em] blur-[2px]',
              getRevealDelayClass(tokenDelay),
            )}
            aria-hidden
          >
            {token}
          </span>
        )
      })}
    </Component>
  )
}

/**
 * TextRevealHeading — Convenience wrapper for headings with text reveal.
 */
export function TextRevealHeading({
  children,
  level = 1,
  className,
  ...props
}: {
  children: string
  level?: 1 | 2 | 3 | 4
  className?: string
} & Omit<React.ComponentProps<typeof TextReveal>, 'as' | 'children'>) {
  const Tag = `h${level}` as React.ElementType
  return (
    <TextReveal as={Tag} className={className} stagger={50} {...props}>
      {children}
    </TextReveal>
  )
}
