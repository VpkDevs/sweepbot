import { useRef, useState, useCallback, type ReactNode } from 'react'
import { cn } from '../../lib/utils'

/**
 * SpotlightCard — Mouse-tracking radial light reflection on cards.
 * Creates a Stripe-style spotlight that follows the cursor inside the card.
 * Includes subtle border glow and 3D tilt.
 */
export function SpotlightCard({
  children,
  className,
  spotlightColor = 'rgba(139, 92, 246, 0.08)',
  borderColor = 'rgba(139, 92, 246, 0.15)',
  as: Component = 'div',
  ...props
}: {
  children: ReactNode
  className?: string
  spotlightColor?: string
  borderColor?: string
  as?: React.ElementType
  [key: string]: unknown
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isHovered, setIsHovered] = useState(false)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setPosition({ x, y })

    // Calculate tilt (max 4 degrees)
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const tiltX = ((y - centerY) / centerY) * -4
    const tiltY = ((x - centerX) / centerX) * 4
    setTilt({ x: tiltX, y: tiltY })
  }, [])

  const handleMouseEnter = useCallback(() => setIsHovered(true), [])
  const handleMouseLeave = useCallback(() => {
    setIsHovered(false)
    setTilt({ x: 0, y: 0 })
  }, [])

  return (
    <Component
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        'relative overflow-hidden rounded-2xl transition-transform duration-300 ease-out',
        className
      )}
      style={{
        transform: isHovered
          ? `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateZ(4px)`
          : 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px)',
      }}
      {...props}
    >
      {/* Spotlight gradient overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-500"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(400px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 60%)`,
        }}
      />

      {/* Border glow effect */}
      <div
        className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] transition-opacity duration-500"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(300px circle at ${position.x}px ${position.y}px, ${borderColor}, transparent 60%)`,
          mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          maskComposite: 'exclude',
          WebkitMaskComposite: 'xor',
          padding: '1px',
        }}
      />

      {children}
    </Component>
  )
}
