import { useEffect, useRef, useState, useMemo } from 'react'
import { cn } from '../../lib/utils'

/**
 * AnimatedCounter — Odometer-style digit rolling counter.
 * Each digit rolls independently from its previous value to the new one.
 * Creates a mechanical, premium counting effect like a slot machine.
 */
export function AnimatedCounter({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  duration = 1200,
  className,
  digitClassName,
}: {
  value: number
  prefix?: string
  suffix?: string
  decimals?: number
  duration?: number
  className?: string
  digitClassName?: string
}) {
  const formatted = useMemo(() => {
    const abs = Math.abs(value)
    const num = decimals > 0 ? abs.toFixed(decimals) : Math.round(abs).toLocaleString()
    const sign = value < 0 ? '-' : ''
    return `${sign}${prefix}${num}${suffix}`
  }, [value, prefix, suffix, decimals])

  return (
    <span className={cn('inline-flex items-baseline tabular-nums', className)} aria-label={formatted}>
      {formatted.split('').map((char, i) => {
        const isDigit = /\d/.test(char)
        if (isDigit) {
          return (
            <RollingDigit
              key={`d-${i}`}
              digit={parseInt(char)}
              duration={duration}
              delay={i * 50}
              className={digitClassName}
            />
          )
        }
        return (
          <span key={`c-${i}`} className="inline-block">
            {char}
          </span>
        )
      })}
    </span>
  )
}

function RollingDigit({
  digit,
  duration = 1200,
  delay = 0,
  className,
}: {
  digit: number
  duration?: number
  delay?: number
  className?: string | undefined
}) {
  const [currentDigit, setCurrentDigit] = useState(digit)
  const [isAnimating, setIsAnimating] = useState(false)
  const prevDigit = useRef(digit)
  const containerRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (digit !== prevDigit.current) {
      setIsAnimating(true)
      const timeout = setTimeout(() => {
        setCurrentDigit(digit)
        setIsAnimating(false)
      }, duration + delay)
      prevDigit.current = digit
      return () => clearTimeout(timeout)
    }
  }, [digit, duration, delay])

  // Height of one digit slot
  const digitHeight = '1.15em'

  // Build strip from prev digit to new digit (rolling through all digits between)
  const strip = useMemo(() => {
    const from = prevDigit.current
    const to = digit
    const digits: number[] = []
    if (from === to) {
      digits.push(to)
    } else {
      // Roll forward
      let cur = from
      while (cur !== to) {
        digits.push(cur)
        cur = (cur + 1) % 10
      }
      digits.push(to)
    }
    return digits
  }, [digit])

  return (
    <span
      ref={containerRef}
      className={cn('inline-block overflow-hidden relative', className)}
      style={{ height: digitHeight, lineHeight: digitHeight }}
    >
      <span
        className="inline-flex flex-col transition-transform"
        style={{
          transform: isAnimating
            ? `translateY(-${(strip.length - 1) * 100}%)`
            : 'translateY(0%)',
          transition: isAnimating
            ? `transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`
            : 'none',
        }}
      >
        {(isAnimating ? strip : [currentDigit]).map((d, i) => (
          <span
            key={i}
            className="inline-block text-center"
            style={{ height: digitHeight, lineHeight: digitHeight }}
          >
            {d}
          </span>
        ))}
      </span>
    </span>
  )
}

/**
 * AnimatedValue — Simpler smooth-interpolation counter (for continuous values).
 */
export function AnimatedValue({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  duration = 1200,
  className,
}: {
  value: number
  prefix?: string
  suffix?: string
  decimals?: number
  duration?: number
  className?: string
}) {
  const [displayed, setDisplayed] = useState(0)
  const displayedRef = useRef(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const startTime = performance.now()
    const startVal = displayedRef.current

    function tick(now: number) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Spring-like easing
      const eased = 1 - Math.pow(1 - progress, 4)
      const next = startVal + (value - startVal) * eased
      displayedRef.current = next
      setDisplayed(next)
      if (progress < 1) rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value, duration])

  return (
    <span className={cn('tabular-nums', className)}>
      {prefix}
      {decimals > 0 ? displayed.toFixed(decimals) : Math.round(displayed).toLocaleString()}
      {suffix}
    </span>
  )
}
