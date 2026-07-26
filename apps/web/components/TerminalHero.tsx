'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ResumeButton } from '@/components/ResumeButton'
import { trackResumeDownload } from '@/lib/api'

// Boot sequence typed out on load (before the terminal becomes interactive).
const BOOT: { prompt: boolean; text: string }[] = [
  { prompt: true, text: 'whoami' },
  { prompt: false, text: 'Jacob Prue — Full-Stack & Cloud Engineer' },
  { prompt: true, text: 'cat welcome.txt' },
  { prompt: false, text: 'Welcome — this terminal is interactive.' },
  { prompt: false, text: "Type a command, or `help` to see what's available." },
]

const PROMPT = 'visitor@jacob.prue.info:~$'

type Entry = { command: string; output: string[] }

const HELP: string[] = [
  'Available commands:',
  '  help       show this message',
  '  about      a short bio',
  '  projects   jump to the projects section',
  '  skills     jump to the skills section',
  '  github     jump to GitHub activity',
  '  contact    jump to the contact section',
  '  resume     download my résumé (PDF)',
  '  stats      open the site stats page',
  '  clear      clear the terminal',
]

const ABOUT: string[] = [
  'Jacob Prue — Full-Stack & Cloud Engineer',
  'I build scalable, cloud-native systems with React, Node.js, and AWS,',
  'with a focus on infrastructure as code, type safety, and reliable software.',
]

// Command hints surfaced as tappable chips for non-keyboard / mobile users.
const HINTS = ['help', 'about', 'projects', 'skills', 'contact', 'resume']

export function TerminalHero() {
  const router = useRouter()
  const [reduced, setReduced] = useState(false)
  const [displayedBoot, setDisplayedBoot] = useState<string[]>([])
  const [bootLine, setBootLine] = useState(0)
  const [bootChar, setBootChar] = useState(0)
  const [booted, setBooted] = useState(false)

  const [entries, setEntries] = useState<Entry[]>([])
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Reduced-motion: skip the typing animation and boot straight into interactive mode.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setReduced(true)
      setDisplayedBoot(BOOT.map((b) => (b.prompt ? `$ ${b.text}` : b.text)))
      setBootLine(BOOT.length)
      setBooted(true)
    }
  }, [])

  // Type out the boot sequence character-by-character.
  useEffect(() => {
    if (reduced) return
    if (bootLine >= BOOT.length) {
      if (!booted) setBooted(true)
      return
    }
    const entry = BOOT[bootLine]
    const full = entry.prompt ? `$ ${entry.text}` : entry.text
    if (bootChar < full.length) {
      const t = setTimeout(() => {
        setDisplayedBoot((prev) => {
          const next = [...prev]
          if (next.length <= bootLine) next.push('')
          next[bootLine] = full.slice(0, bootChar + 1)
          return next
        })
        setBootChar((c) => c + 1)
      }, 24)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => {
      setBootLine((i) => i + 1)
      setBootChar(0)
    }, 180)
    return () => clearTimeout(t)
  }, [reduced, bootLine, bootChar, booted])

  // Keep the terminal scrolled to the latest output.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [entries, displayedBoot])

  const scrollToSection = useCallback((id: string) => {
    const el = document.getElementById(id)
    el?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    })
  }, [])

  const downloadResume = useCallback(() => {
    const a = document.createElement('a')
    a.href = '/resume.pdf'
    a.download = 'jacob-prue-resume.pdf'
    document.body.appendChild(a)
    a.click()
    a.remove()
    void trackResumeDownload()
  }, [])

  const runCommand = useCallback(
    (raw: string) => {
      const command = raw.trim()
      if (!command) {
        setEntries((prev) => [...prev, { command: '', output: [] }])
        return
      }
      setHistory((prev) => [...prev, command])
      setHistoryIndex(-1)

      const name = command.split(/\s+/)[0].toLowerCase()
      let output: string[] = []

      switch (name) {
        case 'help':
        case '?':
          output = HELP
          break
        case 'about':
        case 'whoami':
          output = ABOUT
          break
        case 'projects':
          output = ['→ scrolling to projects…']
          scrollToSection('projects')
          break
        case 'skills':
          output = ['→ scrolling to skills…']
          scrollToSection('skills')
          break
        case 'github':
          output = ['→ scrolling to GitHub activity…']
          scrollToSection('github')
          break
        case 'contact':
          output = ['→ scrolling to contact…']
          scrollToSection('contact')
          break
        case 'resume':
        case 'cv':
          output = ['↓ downloading résumé (jacob-prue-resume.pdf)…']
          downloadResume()
          break
        case 'stats':
          output = ['→ opening the stats page…']
          router.push('/stats')
          break
        case 'ls':
          output = ['projects/  skills/  github/  contact/  resume.pdf']
          break
        case 'clear':
          setEntries([])
          return
        default:
          output = [`command not found: ${name}`, "Type `help` for a list of commands."]
      }
      setEntries((prev) => [...prev, { command, output }])
    },
    [scrollToSection, downloadResume, router],
  )

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      runCommand(input)
      setInput('')
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (history.length === 0) return
      const idx = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1)
      setHistoryIndex(idx)
      setInput(history[idx])
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex === -1) return
      const idx = historyIndex + 1
      if (idx >= history.length) {
        setHistoryIndex(-1)
        setInput('')
      } else {
        setHistoryIndex(idx)
        setInput(history[idx])
      }
    }
  }

  return (
    <section>
      <div
        className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-6 font-mono text-sm leading-7"
        onClick={() => booted && inputRef.current?.focus()}
      >
        <div className="mb-3 flex gap-1.5" aria-hidden>
          <span className="h-3 w-3 rounded-full bg-red-500" />
          <span className="h-3 w-3 rounded-full bg-yellow-500" />
          <span className="h-3 w-3 rounded-full bg-green-500" />
        </div>

        <div ref={scrollRef} className="max-h-72 overflow-y-auto" aria-live="polite">
          {/* Boot sequence */}
          {displayedBoot.map((line, i) => (
            <div
              key={`boot-${i}`}
              className={
                line.startsWith('$')
                  ? 'text-[hsl(var(--accent))]'
                  : 'text-[hsl(var(--foreground))]'
              }
            >
              {line}
              {!booted && i === displayedBoot.length - 1 && <span className="animate-pulse">█</span>}
            </div>
          ))}

          {/* Executed commands + their output */}
          {entries.map((entry, i) => (
            <div key={`entry-${i}`}>
              <div className="text-[hsl(var(--accent))]">
                <span className="text-[hsl(var(--muted-foreground))]">{PROMPT} </span>
                {entry.command}
              </div>
              {entry.output.map((line, j) => (
                <div key={j} className="whitespace-pre-wrap text-[hsl(var(--foreground))]">
                  {line}
                </div>
              ))}
            </div>
          ))}

          {/* Interactive input line */}
          {booted && (
            <div className="flex items-center text-[hsl(var(--accent))]">
              <label htmlFor="terminal-input" className="text-[hsl(var(--muted-foreground))]">
                {PROMPT}&nbsp;
              </label>
              <input
                id="terminal-input"
                ref={inputRef}
                type="text"
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                aria-label="Terminal command input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                className="flex-1 bg-transparent text-[hsl(var(--foreground))] caret-[hsl(var(--accent))] outline-none"
              />
            </div>
          )}
        </div>

        {/* Tappable command hints for non-keyboard / mobile users */}
        {booted && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-[hsl(var(--border))] pt-3">
            {HINTS.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => runCommand(h)}
                className="rounded border border-[hsl(var(--border))] px-2 py-0.5 text-xs text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--background))] hover:text-[hsl(var(--accent))] transition-colors"
              >
                {h}
              </button>
            ))}
          </div>
        )}
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
            className="rounded-lg bg-[hsl(var(--accent-solid))] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
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
