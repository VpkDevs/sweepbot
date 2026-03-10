/**
 * React Performance Optimization Utilities
 * - Memoization helpers
 * - Lazy loading utilities
 * - Performance monitoring
 */

import React, { useRef, useEffect, useCallback, DependencyList } from 'react'
import { logger } from '@sweepbot/utils'

/**
 * Debounced callback hook
 * Delays invoking callback until after wait milliseconds have elapsed
 * since the last time the debounced function was invoked
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args)
      }, delay)
    },
    [callback, delay]
  )
}

/**
 * Throttled callback hook
 * Creates a throttled function that only invokes callback at most once per every wait milliseconds
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const lastRun = useRef(Date.now())

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now()

      if (now - lastRun.current >= delay) {
        callback(...args)
        lastRun.current = now
      }
    },
    [callback, delay]
  )
}

/**
 * Memoized async function
 * Caches the result of an async function based on stringified arguments
 */
export function useMemoAsync<T>(
  factory: () => Promise<T>,
  deps: DependencyList
): T | undefined {
  const [value, setValue] = React.useState<T>()

  useEffect(() => {
    let cancelled = false

    factory().then((result) => {
      if (!cancelled) {
        setValue(result)
      }
    })

    return () => {
      cancelled = true
    }
  }, deps)

  return value
}

/**
 * Performance monitoring hook
 * Measures and logs component render time
 */
export function usePerformanceMonitor(componentName: string, enabled = import.meta.env.DEV) {
  const renderCount = useRef(0)
  const startTime = useRef<number>()

  useEffect(() => {
    if (!enabled) return

    renderCount.current++

    if (!startTime.current) {
      startTime.current = performance.now()
    }

    return () => {
      if (startTime.current) {
        const duration = performance.now() - startTime.current
        
        if (duration > 16) { // More than one frame (60fps)
          logger.warn('Slow component render', {
            component: componentName,
            duration: `${duration.toFixed(2)}ms`,
            renderCount: renderCount.current,
          })
        } else {
          logger.debug('Component render', {
            component: componentName,
            duration: `${duration.toFixed(2)}ms`,
            renderCount: renderCount.current,
          })
        }

        startTime.current = undefined
      }
    }
  })
}

/**
 * Intersection Observer hook for lazy loading
 * Returns true when element enters viewport
 */
export function useIntersectionObserver(
  ref: React.RefObject<Element>,
  options: IntersectionObserverInit = {}
): boolean {
  const [isIntersecting, setIsIntersecting] = React.useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting)
    }, options)

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [ref, options])

  return isIntersecting
}

/**
 * Previous value hook
 * Returns the previous value of a variable
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>()

  useEffect(() => {
    ref.current = value
  }, [value])

  return ref.current
}

/**
 * Stable callback hook
 * Creates a stable callback reference that doesn't change between renders
 * but always calls the latest version of the callback
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useStableCallback<T extends (...args: any[]) => any>(callback: T): T {
  const callbackRef = useRef(callback)

  useEffect(() => {
    callbackRef.current = callback
  })

  return useCallback((...args: Parameters<T>) => {
    return callbackRef.current(...args)
  }, []) as T
}

/**
 * Mounted state hook
 * Returns whether component is currently mounted
 * Useful for preventing state updates on unmounted components
 */
export function useMounted(): React.MutableRefObject<boolean> {
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  return mounted
}

/**
 * Safe async state hook
 * Only updates state if component is still mounted
 */
export function useSafeState<T>(initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = React.useState(initialValue)
  const mounted = useMounted()

  const setSafeState = useCallback(
    (value: T | ((prev: T) => T)) => {
      if (mounted.current) {
        setState(value)
      }
    },
    [mounted]
  )

  return [state, setSafeState]
}
