'use client'

import { useEffect, useState } from 'react'
import { trackVisit } from '@/lib/api'

export function VisitorCounter({ page }: { page: string }) {
  const [count, setCount] = useState<number | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    setCount(null)
    setError(false)
    trackVisit(page)
      .then((c) => {
        if (active) setCount(c)
      })
      .catch(() => {
        if (active) setError(true)
      })
    return () => {
      active = false
    }
  }, [page])

  // Stay silent on failure — never surface a broken or zero count.
  if (error) return null

  // Graceful loading placeholder that reserves space (no layout shift).
  if (count === null) {
    return (
      <span
        className="inline-block h-3 w-16 animate-pulse rounded bg-[hsl(var(--muted))] align-middle"
        aria-hidden
      />
    )
  }

  return (
    <span className="text-xs text-[hsl(var(--muted-foreground))]">
      {count.toLocaleString()} {count === 1 ? 'view' : 'views'} on this page
    </span>
  )
}
