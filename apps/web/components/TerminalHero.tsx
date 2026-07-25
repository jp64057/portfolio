'use client'

import { useEffect, useState } from 'react'
import { ResumeButton } from '@/components/ResumeButton'

const LINES = [
  '$ whoami',
  'Jacob Prue',
  '$ cat skills.txt',
  'Full-Stack Engineer | AWS | Terraform | TypeScript',
  '$ ls projects/',
  'portfolio/  [more coming soon]',
  '$ echo "Open to opportunities"',
  'Open to opportunities',
  '$ _',
]

export function TerminalHero() {
  const [displayed, setDisplayed] = useState<string[]>([])
  const [lineIndex, setLineIndex] = useState(0)
  const [charIndex, setCharIndex] = useState(0)

  useEffect(() => {
    if (lineIndex >= LINES.length) return

    const line = LINES[lineIndex]
    if (charIndex < line.length) {
      const t = setTimeout(() => {
        setDisplayed((prev) => {
          const next = [...prev]
          if (next.length <= lineIndex) next.push('')
          next[lineIndex] = line.slice(0, charIndex + 1)
          return next
        })
        setCharIndex((c) => c + 1)
      }, 28)
      return () => clearTimeout(t)
    } else {
      const t = setTimeout(() => {
        setLineIndex((i) => i + 1)
        setCharIndex(0)
      }, 220)
      return () => clearTimeout(t)
    }
  }, [lineIndex, charIndex])

  return (
    <section>
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-6 font-mono text-sm leading-7">
        <div className="mb-3 flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-red-500" />
          <span className="h-3 w-3 rounded-full bg-yellow-500" />
          <span className="h-3 w-3 rounded-full bg-green-500" />
        </div>
        {displayed.map((line, i) => (
          <div
            key={i}
            className={line.startsWith('$') ? 'text-[hsl(var(--accent))]' : 'text-[hsl(var(--foreground))]'}
          >
            {line}
            {i === displayed.length - 1 && lineIndex < LINES.length && (
              <span className="animate-pulse">█</span>
            )}
          </div>
        ))}
      </div>
      <div className="mt-8">
        <h1 className="text-4xl font-bold tracking-tight">
          Hi, I&apos;m <span className="text-[hsl(var(--accent))]">Jacob Prue</span>
        </h1>
        <p className="mt-3 text-lg text-[hsl(var(--muted-foreground))] max-w-xl">
          Full-stack engineer building scalable systems with React, Node.js, and AWS.
          I care about infrastructure as code, type safety, and shipping things that actually work.
        </p>
        <div className="mt-6 flex gap-4">
          <a
            href="#contact"
            className="rounded-lg bg-[hsl(var(--accent))] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
          >
            Get in touch
          </a>
          <a
            href="#projects"
            className="rounded-lg border border-[hsl(var(--border))] px-5 py-2.5 text-sm font-medium hover:bg-[hsl(var(--muted))] transition-colors"
          >
            View projects
          </a>
          <ResumeButton />
        </div>
      </div>
    </section>
  )
}
