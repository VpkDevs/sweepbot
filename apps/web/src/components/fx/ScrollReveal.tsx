import { useRef, useEffect, useState, type ReactNode } from 'react'
import { cn } from '../../lib/utils'

type RevealDirection = 'up' | 'down' | 'left' | 'right' | 'none'

/**
 * ScrollReveal — Intersection Observer wrapper for scroll-triggered animations.
 * Supports multiple reveal directions, blur, scale, and stagger delays.
 * The foundation of all modern award-winning scroll experiences.
 */
export function ScrollReveal({
  children,
  className,
  direction = 'up',
  delay = 0,
  duration = 700,
  distance = 40,
  blur = 4,
  scale = 0.97,
  once = true,
  threshold = 0.15,
  as: Component = 'div',
}: {
  children: ReactNode
  className?: string
  direction?: RevealDirection
  delay?: number
  duration?: number
  distance?: number
  blur?: number
  scale?: number
  once?: boolean
  threshold?: number
  as?: React.ElementType
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
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
      { threshold, rootMargin: '0px 0px -40px 0px' },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [once, threshold])

  const getTransform = (): string => {
    if (isVisible) return 'translate3d(0, 0, 0) scale(1)'

    const transforms: string[] = []
    switch (direction) {
      case 'up':    transforms.push(`translateY(${distance}px)`); break
      case 'down':  transforms.push(`translateY(-${distance}px)`); break
      case 'left':  transforms.push(`translateX(${distance}px)`); break
      case 'right': transforms.push(`translateX(-${distance}px)`); break
    }
    if (scale !== 1) transforms.push(`scale(${scale})`)
    return transforms.join(' ') || 'none'
  }

  return (
    <Component
      ref={ref}
      className={cn(className)}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: getTransform(),
        filter: isVisible ? 'blur(0px)' : `blur(${blur}px)`,
        transition: `opacity ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, filter ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
        willChange: 'opacity, transform, filter',
      }}
    >
      {children}
    </Component>
  )
}

/**
 * ScrollRevealGroup — Automatically staggers children reveal delays.
 */
export function ScrollRevealGroup({
  children,
  className,
  staggerDelay = 60,
  ...props
}: {
  children: ReactNode
  className?: string
  staggerDelay?: number
} & Omit<React.ComponentProps<typeof ScrollReveal>, 'children' | 'delay'>) {
  const childArray = Array.isArray(children) ? children : [children]

  return (
    <div className={className}>
      {childArray.map((child, i) => (
        <ScrollReveal key={i} delay={i * staggerDelay} {...props}>
          {child}
        </ScrollReveal>
      ))}
    </div>
  )
}
