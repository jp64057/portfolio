'use client'

import { useEffect, useState } from 'react'
import { fetchGithubStats, type GithubStats } from '@/lib/api'

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    let frame = 0
    const total = 40
    const step = () => {
      frame++
      setDisplay(Math.round((value * frame) / total))
      if (frame < total) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [value])

  return <span>{display}</span>
}

export function GithubStatsCard() {
  const [stats, setStats] = useState<GithubStats | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetchGithubStats()
      .then(setStats)
      .catch(() => setError(true))
  }, [])

  if (error) {
    return (
      <div className="rounded-xl border border-[hsl(var(--border))] p-6 text-sm text-[hsl(var(--muted-foreground))]">
        Could not load GitHub stats — check back later.
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="rounded-xl border border-[hsl(var(--border))] p-6 animate-pulse">
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-[hsl(var(--muted))]" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] p-6 space-y-6">
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="rounded-lg bg-[hsl(var(--muted))] p-4">
          <p className="text-3xl font-bold text-[hsl(var(--accent))]">
            <AnimatedNumber value={stats.publicRepos} />
          </p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Public Repos</p>
        </div>
        <div className="rounded-lg bg-[hsl(var(--muted))] p-4">
          <p className="text-3xl font-bold text-[hsl(var(--accent))]">
            <AnimatedNumber value={stats.totalStars} />
          </p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Total Stars</p>
        </div>
        <div className="rounded-lg bg-[hsl(var(--muted))] p-4">
          <p className="text-3xl font-bold text-[hsl(var(--accent))]">
            <AnimatedNumber value={stats.followers} />
          </p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Followers</p>
        </div>
      </div>

      <div>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3">Top Languages</p>
        <div className="flex flex-wrap gap-2">
          {stats.topLanguages.map(({ name, pct }) => (
            <span
              key={name}
              className="rounded-full border border-[hsl(var(--border))] px-3 py-1 text-xs font-mono"
            >
              {name} <span className="text-[hsl(var(--accent))]">{pct}%</span>
            </span>
          ))}
        </div>
      </div>

      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        Live data via GitHub REST API · cached 15 min · served by AWS Lambda + DynamoDB
      </p>
    </div>
  )
}
