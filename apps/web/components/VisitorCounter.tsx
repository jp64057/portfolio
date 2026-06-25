'use client'

import { useEffect, useState } from 'react'
import { trackVisit } from '@/lib/api'

export function VisitorCounter({ page }: { page: string }) {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    trackVisit(page).then((c) => setCount(c)).catch(() => {})
  }, [page])

  if (count === null) return null

  return (
    <span className="text-xs text-[hsl(var(--muted-foreground))]">
      {count.toLocaleString()} {count === 1 ? 'view' : 'views'}
    </span>
  )
}
