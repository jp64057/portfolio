'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Fades + slides its children in the first time they scroll into view.
 * Respects prefers-reduced-motion (shows immediately, no transition) and,
 * via the no-JS fallback in globals, never leaves content hidden.
 */
export function Reveal({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(true)
      return
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -10% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={ref} className={`reveal ${shown ? 'reveal-visible' : ''} ${className}`.trim()}>
      {children}
    </div>
  )
}
