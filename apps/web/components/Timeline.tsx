'use client'

import { motion, useReducedMotion } from 'framer-motion'

// NOTE: placeholder milestones — swap for real history when content lands
// (#12/#13). Each node can later deep-link to a project / case-study page.
type Milestone = {
  when: string
  title: string
  detail: string
  tags?: string[]
}

const MILESTONES: Milestone[] = [
  {
    when: '2026',
    title: 'Built this portfolio',
    detail:
      'Next.js 15 static site on S3 + CloudFront with a serverless API (Lambda, API Gateway, DynamoDB), all provisioned in Terraform and shipped via GitHub Actions OIDC.',
    tags: ['Next.js', 'AWS', 'Terraform'],
  },
  {
    when: '2025',
    title: 'Cloud & infrastructure-as-code',
    detail:
      'Designed serverless backends and codified infrastructure end to end — least-privilege IAM, CI/CD pipelines, and observability with alarms and budgets.',
    tags: ['Lambda', 'DynamoDB', 'GitHub Actions'],
  },
  {
    when: '2024',
    title: 'Full-stack product engineering',
    detail:
      'Shipped React + TypeScript front-ends backed by Node.js services, with a focus on type safety, accessibility, and performance budgets.',
    tags: ['React', 'TypeScript', 'Node.js'],
  },
  {
    when: '2023',
    title: 'Foundations',
    detail:
      'Grounded in software fundamentals — data structures, testing, and clean, maintainable systems.',
  },
]

export function Timeline() {
  const reduce = useReducedMotion()

  return (
    <ol className="relative ml-3 border-l border-[hsl(var(--border))]">
      {/* Without JS, framer-motion's initial opacity:0 would hide the list —
          force it visible (mirrors the .reveal no-JS fallback). */}
      <noscript>
        <style>{`.timeline-item{opacity:1 !important;transform:none !important}`}</style>
      </noscript>
      {MILESTONES.map((m, i) => (
        <motion.li
          key={m.when + m.title}
          className="timeline-item mb-10 ml-6 last:mb-0"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '0px 0px -12% 0px' }}
          transition={{ duration: 0.5, delay: Math.min(i * 0.05, 0.2), ease: 'easeOut' }}
        >
          {/* Node dot sitting on the line */}
          <span
            className="absolute -left-[7px] mt-1.5 h-3.5 w-3.5 rounded-full border-2 border-[hsl(var(--background))] bg-[hsl(var(--accent))]"
            aria-hidden
          />
          <div className="font-mono text-xs text-[hsl(var(--accent))]">{m.when}</div>
          <h3 className="mt-1 text-lg font-semibold">{m.title}</h3>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{m.detail}</p>
          {m.tags && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {m.tags.map((t) => (
                <span
                  key={t}
                  className="rounded border border-[hsl(var(--border))] px-1.5 py-0.5 font-mono text-[11px] text-[hsl(var(--muted-foreground))]"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </motion.li>
      ))}
    </ol>
  )
}
