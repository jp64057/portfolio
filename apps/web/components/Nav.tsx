'use client'

import Link from 'next/link'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { OPEN_COMMAND_PALETTE_EVENT } from '@/components/CommandPalette'

export function Nav() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <header className="sticky top-0 z-50 border-b border-[hsl(var(--border))] bg-[hsl(var(--background)/0.8)] backdrop-blur">
      <nav className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
        <Link href="/" className="font-mono font-bold tracking-tight">
          Jacob Prue
        </Link>
        <div className="flex items-center gap-6 text-sm">
          <Link href="/#projects" className="hover:text-[hsl(var(--accent))] transition-colors">Projects</Link>
          <Link href="/#skills" className="hover:text-[hsl(var(--accent))] transition-colors">Skills</Link>
          <Link href="/#contact" className="hover:text-[hsl(var(--accent))] transition-colors">Contact</Link>
          <Link href="/stats" className="hover:text-[hsl(var(--accent))] transition-colors">Stats</Link>
          <a
            href="https://github.com/jp64057"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[hsl(var(--accent))] transition-colors"
          >
            GitHub
          </a>
          <button
            onClick={() => window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT))}
            aria-label="Open command palette"
            title="Command palette (⌘K)"
            className="hidden items-center gap-1 rounded-md border border-[hsl(var(--border))] px-2 py-1 font-mono text-xs text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors sm:flex"
          >
            <kbd className="font-sans">⌘</kbd>K
          </button>
          {mounted && (
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle theme"
              className="rounded-md border border-[hsl(var(--border))] px-2 py-1 text-xs hover:bg-[hsl(var(--muted))] transition-colors"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          )}
        </div>
      </nav>
    </header>
  )
}
