'use client'

import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
  ResponsiveContainer,
} from 'recharts'
import { fetchStats, type Stats } from '@/lib/api'

function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg bg-[hsl(var(--muted))] p-6 text-center">
      <p className="text-4xl font-bold text-[hsl(var(--accent))]">{value.toLocaleString()}</p>
      <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{label}</p>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="grid grid-cols-1 gap-4">
        {[...Array(1)].map((_, i) => (
          <div key={i} className="h-28 rounded-lg bg-[hsl(var(--muted))]" />
        ))}
      </div>
      <div className="h-80 rounded-xl border border-[hsl(var(--border))]" />
    </div>
  )
}

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetchStats().then(setStats).catch(() => setError(true))
  }, [])

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-2xl font-bold">Site stats</h1>
      <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
        Live traffic for this site, aggregated from DynamoDB by an AWS Lambda. No cookies, no
        third-party trackers, no personal data — just counts.
      </p>

      <div className="mt-10">
        {error ? (
          <div className="rounded-xl border border-[hsl(var(--border))] p-6 text-sm text-[hsl(var(--muted-foreground))]">
            Could not load stats right now — check back later.
          </div>
        ) : !stats ? (
          <LoadingSkeleton />
        ) : (
          <StatsView stats={stats} />
        )}
      </div>
    </div>
  )
}

function StatsView({ stats }: { stats: Stats }) {
  const hasPages = stats.pages.length > 0
  // Cap the chart to the busiest pages so long tails don't crush the axis.
  const chartData = stats.pages.slice(0, 10)

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 gap-4">
        <StatTile value={stats.totalPageViews} label="Total page views" />
      </div>

      <div className="rounded-xl border border-[hsl(var(--border))] p-6">
        <p className="mb-4 text-sm font-medium">Page views by page</p>
        {hasPages ? (
          <ResponsiveContainer width="100%" height={Math.max(160, chartData.length * 44)}>
            <BarChart
              layout="vertical"
              data={chartData}
              margin={{ left: 8, right: 40, top: 4, bottom: 4 }}
            >
              <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="path"
                width={120}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 13, fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted))' }}
                contentStyle={{
                  background: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '13px',
                }}
                formatter={(v: number) => [v.toLocaleString(), 'Views']}
              />
              <Bar dataKey="views" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} barSize={20}>
                <LabelList
                  dataKey="views"
                  position="right"
                  fill="hsl(var(--muted-foreground))"
                  fontSize={12}
                  formatter={(v: number) => v.toLocaleString()}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
            No page views recorded yet — be the first.
          </p>
        )}
      </div>

      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        Served by AWS Lambda + DynamoDB · cached ~60s · updated{' '}
        {new Date(stats.generatedAt).toLocaleString()}
      </p>
    </div>
  )
}
