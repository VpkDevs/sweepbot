import { useMemo } from 'react'

/**
 * NoiseOverlay — Animated SVG film-grain texture.
 * Uses feTurbulence for organic, non-repeating noise that animates
 * via seed cycling. Much higher fidelity than static noise PNG.
 * Premium effect seen on Apple, Stripe, Linear.
 */
export function NoiseOverlay({
  opacity = 0.018,
  blendMode = 'overlay' as React.CSSProperties['mixBlendMode'],
  animate = true,
}) {
  // Unique SVG filter ID to prevent collisions
  const filterId = useMemo(() => `noise-${Math.random().toString(36).slice(2, 8)}`, [])

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[9998]"
      style={{ opacity, mixBlendMode: blendMode }}
    >
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <filter id={filterId}>
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.65"
            numOctaves="4"
            stitchTiles="stitch"
          >
            {animate && (
              <animate
                attributeName="seed"
                from="0"
                to="100"
                dur="8s"
                repeatCount="indefinite"
              />
            )}
          </feTurbulence>
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#${filterId})`} />
      </svg>
    </div>
  )
}
