'use client'

import { useEffect, useState } from 'react'
import { fetchNow, type NowData } from '@/lib/api'

// Turn an ISO timestamp into a compact relative label ("3h ago").
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

// A slim "what I'm up to" strip: the latest public commit, polled once on load.
// Renders nothing until data arrives and hides itself on any error, so it never
// leaves a broken placeholder.
export function NowStrip() {
  const [now, setNow] = useState<NowData | null>(null)

  useEffect(() => {
    let alive = true
    fetchNow()
      .then((d) => alive && setNow(d))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  if (!now?.latestCommit) return null
  const c = now.latestCommit
  // Scheme-guard the API-supplied URL: React does not block javascript: URLs in
  // href, so only allow https before rendering it into a link. (issue #117)
  const safeUrl = /^https:\/\//.test(c.url) ? c.url : '#'

  return (
    <div className="flex items-center gap-2 font-mono text-xs text-[hsl(var(--muted-foreground))]">
      <span className="relative flex h-2 w-2" aria-hidden>
        <span className="absolute inline-flex h-full w-full rounded-full bg-[hsl(var(--accent))] opacity-75 motion-safe:animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[hsl(var(--accent))]" />
      </span>
      <span>
        last pushed to{' '}
        <a
          href={safeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[hsl(var(--accent))] hover:underline"
        >
          {c.repo}
        </a>{' '}
        · {relativeTime(c.at)}
      </span>
    </div>
  )
}
