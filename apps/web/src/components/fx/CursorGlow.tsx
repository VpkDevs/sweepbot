import { useEffect, useRef, useCallback } from 'react'

/**
 * CursorGlow — Mouse-following radial spotlight effect.
 * Renders a large, soft radial gradient that tracks the cursor with GPU-accelerated transforms.
 * Signature effect seen on Linear, Stripe, Vercel.
 */
export function CursorGlow({
  size = 600,
  color = 'rgba(139, 92, 246, 0.07)',
  blendMode = 'normal' as React.CSSProperties['mixBlendMode'],
}) {
  const glowRef = useRef<HTMLDivElement>(null)
  const posRef = useRef({ x: -1000, y: -1000 })
  const targetRef = useRef({ x: -1000, y: -1000 })
  const rafRef = useRef<number>(0)
  const activeRef = useRef(false)

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t

  const animate = useCallback(() => {
    posRef.current.x = lerp(posRef.current.x, targetRef.current.x, 0.08)
    posRef.current.y = lerp(posRef.current.y, targetRef.current.y, 0.08)

    if (glowRef.current) {
      glowRef.current.style.transform = `translate3d(${posRef.current.x - size / 2}px, ${posRef.current.y - size / 2}px, 0)`
    }

    if (activeRef.current) {
      rafRef.current = requestAnimationFrame(animate)
    }
  }, [size])

  useEffect(() => {
    activeRef.current = true
    rafRef.current = requestAnimationFrame(animate)

    const onMove = (e: MouseEvent) => {
      targetRef.current = { x: e.clientX, y: e.clientY }
    }

    const onLeave = () => {
      targetRef.current = { x: -1000, y: -1000 }
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    document.addEventListener('mouseleave', onLeave)

    return () => {
      activeRef.current = false
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseleave', onLeave)
    }
  }, [animate])

  return (
    <div
      ref={glowRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[1] will-change-transform"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        mixBlendMode: blendMode,
        filter: 'blur(2px)',
        opacity: 1,
        transition: 'opacity 0.4s ease',
      }}
    />
  )
}
