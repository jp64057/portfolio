'use client'

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

const SKILLS = [
  { subject: 'Frontend', score: 85 },
  { subject: 'Backend', score: 90 },
  { subject: 'Cloud / AWS', score: 80 },
  { subject: 'DevOps / CI/CD', score: 75 },
  { subject: 'Databases', score: 80 },
  { subject: 'TypeScript', score: 88 },
]

export function SkillsChart() {
  return (
    <div
      className="rounded-xl border border-[hsl(var(--border))] p-6"
      role="img"
      aria-label={`Radar chart of self-assessed proficiency: ${SKILLS.map((s) => `${s.subject} ${s.score} out of 100`).join(', ')}.`}
    >
      <ResponsiveContainer width="100%" height={320}>
        <RadarChart data={SKILLS}>
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fontSize: 13, fill: 'hsl(var(--muted-foreground))' }}
          />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '13px',
            }}
            formatter={(v: number) => [`${v}/100`, 'Proficiency']}
          />
          <Radar
            dataKey="score"
            stroke="hsl(var(--accent))"
            fill="hsl(var(--accent))"
            fillOpacity={0.2}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
      <p className="mt-2 text-center text-xs text-[hsl(var(--muted-foreground))]">
        Self-assessed proficiency — update in <code>components/SkillsChart.tsx</code>
      </p>
    </div>
  )
}
