import { useRef, useState, useCallback, type ReactNode } from 'react'
import { cn } from '../../lib/utils'

/**
 * MagneticButton — Button that magnetically attracts toward the cursor.
 * Creates a satisfying, playful interaction where the button stretches
 * toward the mouse before snapping back. Studio-quality interaction.
 */
export function MagneticButton({
  children,
  className,
  strength = 0.35,
  radius = 150,
  as: Component = 'button',
  ...props
}: {
  children: ReactNode
  className?: string
  strength?: number
  radius?: number
  as?: React.ElementType
  [key: string]: unknown
}) {
  const ref = useRef<HTMLElement>(null)
  const [transform, setTransform] = useState({ x: 0, y: 0 })
  const [isNear, setIsNear] = useState(false)

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    const distX = e.clientX - centerX
    const distY = e.clientY - centerY
    const distance = Math.sqrt(distX * distX + distY * distY)

    if (distance < radius) {
      setIsNear(true)
      setTransform({
        x: distX * strength,
        y: distY * strength,
      })
    } else {
      setIsNear(false)
      setTransform({ x: 0, y: 0 })
    }
  }, [strength, radius])

  const handleMouseLeave = useCallback(() => {
    setIsNear(false)
    setTransform({ x: 0, y: 0 })
  }, [])

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="inline-block"
      style={{ padding: `${radius / 2}px`, margin: `-${radius / 2}px` }}
    >
      <Component
        ref={ref}
        className={cn(className)}
        style={{
          transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${isNear ? 1.05 : 1})`,
          transition: isNear
            ? 'transform 0.15s cubic-bezier(0.33, 1, 0.68, 1)'
            : 'transform 0.5s cubic-bezier(0.33, 1, 0.68, 1)',
          willChange: 'transform',
        }}
        {...props}
      >
        {/* Inner content with inverse micro-movement for depth */}
        <span
          className="inline-flex items-center gap-2"
          style={{
            transform: `translate3d(${transform.x * 0.15}px, ${transform.y * 0.15}px, 0)`,
            transition: 'transform 0.15s ease',
          }}
        >
          {children}
        </span>
      </Component>
    </div>
  )
}
