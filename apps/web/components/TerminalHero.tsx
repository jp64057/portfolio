'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { ResumeButton } from '@/components/ResumeButton'
import { OPEN_RESUME_VIEWER_EVENT } from '@/components/ResumeViewer'
import { HeroBackdrop } from '@/components/HeroBackdrop'
import { JpMark } from '@/components/JpMark'

// Boot sequence typed out on load (before the terminal becomes interactive).
const BOOT: { prompt: boolean; text: string }[] = [
  { prompt: true, text: 'whoami' },
  { prompt: false, text: 'Jacob Prue — Full-Stack & Cloud Engineer' },
  { prompt: true, text: 'cat welcome.txt' },
  { prompt: false, text: 'Welcome — this terminal is interactive.' },
  { prompt: false, text: "Type a command, `help` for the list, or ⇥ to autocomplete." },
]

const PROMPT = 'visitor@jacob.prue.info:~$'

type Entry = { command: string; output: string[] }

const ABOUT: string[] = [
  'Jacob Prue — Full-Stack & Cloud Engineer',
  'I build scalable, cloud-native systems with React, Node.js, and AWS,',
  'with a focus on infrastructure as code, type safety, and reliable software.',
]

const NEOFETCH: string[] = [
  '        ▄▄▄▄▄        visitor@jacob.prue.info',
  '     ▄█████████▄     ----------------------',
  '    ███▀     ▀███    OS:     PortfolioOS (Next.js 15)',
  '    ███  ▄▄▄  ███    Host:   S3 + CloudFront',
  '    ███  ▀▀▀  ███    Shell:  jsh 1.0',
  '    ███▄     ▄███    Cloud:  AWS Lambda · DynamoDB',
  '     ▀█████████▀     IaC:    Terraform',
  '        ▀▀▀▀▀        Uptime: since you arrived',
]

const COFFEE: string[] = [
  '      ( (',
  '       ) )',
  '    ........',
  '    |      |]   brewing…',
  '    \\      /',
  "     `----'    ☕ enjoy.",
]

// Command hints surfaced as tappable chips for non-keyboard / mobile users.
const HINTS = ['help', 'about', 'projects', 'skills', 'contact', 'resume']

type CommandResult = string[] | 'clear' | void
type Command = {
  name: string
  desc?: string // shown in `help`; omit to hide from help + completion
  run: (args: string[]) => CommandResult
}

// Build the `help` listing from the visible (described) commands.
function buildHelp(commands: Command[]): string[] {
  const visible = commands.filter((c) => c.desc)
  const pad = Math.max(...visible.map((c) => c.name.length))
  return [
    'Available commands:',
    ...visible.map((c) => `  ${c.name.padEnd(pad + 2)}${c.desc}`),
    '',
    'Tips: ↑/↓ history · ⇥ autocomplete · try `neofetch`, `coffee`, `sudo`…',
  ]
}

export function TerminalHero() {
  const router = useRouter()
  const { setTheme, resolvedTheme, theme } = useTheme()
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
  // Points at the current command list so the `help` command can render itself
  // without the registry having to reference its own (not-yet-assigned) const.
  const commandsRef = useRef<Command[]>([])

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

  const viewResume = useCallback(() => {
    window.dispatchEvent(new Event(OPEN_RESUME_VIEWER_EVENT))
  }, [])

  // The command registry: single source of truth for dispatch, `help`, and
  // tab-completion. Commands with a `desc` are listed by `help` and completable.
  const commands = useMemo<Command[]>(() => {
    const jump = (id: string, label: string): Command => ({
      name: id,
      desc: `jump to the ${label} section`,
      run: () => {
        scrollToSection(id)
        return [`→ scrolling to ${label}…`]
      },
    })
    return [
      { name: 'help', desc: 'show this message', run: () => buildHelp(commandsRef.current) },
      { name: 'about', desc: 'a short bio', run: () => ABOUT },
      jump('projects', 'projects'),
      jump('skills', 'skills'),
      jump('github', 'GitHub activity'),
      jump('contact', 'contact'),
      {
        name: 'resume',
        desc: 'view my résumé (PDF, opens in-page)',
        run: () => {
          viewResume()
          return ['▸ opening résumé viewer…']
        },
      },
      {
        name: 'stats',
        desc: 'open the site stats page',
        run: () => {
          router.push('/stats')
          return ['→ opening the stats page…']
        },
      },
      {
        name: 'theme',
        desc: 'toggle light / dark mode',
        run: () => {
          const dark = (resolvedTheme ?? theme) === 'dark'
          setTheme(dark ? 'light' : 'dark')
          return [`◑ switched to ${dark ? 'light' : 'dark'} theme`]
        },
      },
      { name: 'date', desc: 'print the current date & time', run: () => [new Date().toString()] },
      { name: 'echo', desc: 'echo <text> — print text back', run: (args) => [args.join(' ')] },
      { name: 'clear', desc: 'clear the terminal', run: () => 'clear' as const },
      // --- aliases & easter eggs (hidden: no desc) ---
      { name: 'whoami', run: () => ABOUT },
      { name: 'cv', run: () => (viewResume(), ['▸ opening résumé viewer…']) },
      { name: 'ls', run: () => ['projects/  skills/  github/  contact/  resume.pdf'] },
      { name: 'pwd', run: () => ['/home/visitor'] },
      { name: 'history', run: () => (history.length ? history.map((h, i) => `${i + 1}  ${h}`) : ['(no history yet)']) },
      { name: 'neofetch', run: () => NEOFETCH },
      { name: 'coffee', run: () => COFFEE },
      { name: 'sudo', run: (args) => [`visitor is not in the sudoers file. This incident will ${args.length ? 'not ' : ''}be reported.`] },
      { name: 'sl', run: () => ['🚂💨  woo woo! (you probably meant `ls`)'] },
      { name: 'matrix', run: () => ['Wake up, Neo…', 'The Matrix has you. Follow the white rabbit. 🐇'] },
      { name: 'exit', run: () => ['Nice try — there is no escape. You live here now. 🙂'] },
    ]
  }, [scrollToSection, viewResume, router, setTheme, resolvedTheme, theme, history])
  commandsRef.current = commands

  const runCommand = useCallback(
    (raw: string) => {
      const command = raw.trim()
      if (!command) {
        setEntries((prev) => [...prev, { command: '', output: [] }])
        return
      }
      setHistory((prev) => [...prev, command])
      setHistoryIndex(-1)

      const [name, ...args] = command.split(/\s+/)
      const cmd = commands.find((c) => c.name === name.toLowerCase())

      if (!cmd) {
        setEntries((prev) => [
          ...prev,
          { command, output: [`command not found: ${name}`, 'Type `help` for a list of commands.'] },
        ])
        return
      }

      const result = cmd.run(args)
      if (result === 'clear') {
        setEntries([])
        return
      }
      setEntries((prev) => [...prev, { command, output: result ?? [] }])
    },
    [commands],
  )

  // Tab-completion: complete to the common prefix of matching command names;
  // if several still match, list them.
  const complete = useCallback(() => {
    const token = input.trim()
    if (!token || /\s/.test(input)) return // only complete the command word
    const names = commands.filter((c) => c.desc).map((c) => c.name)
    const matches = names.filter((n) => n.startsWith(token.toLowerCase()))
    if (matches.length === 0) return
    if (matches.length === 1) {
      setInput(matches[0] + ' ')
      return
    }
    // Longest common prefix of the matches.
    let prefix = matches[0]
    for (const m of matches) {
      while (!m.startsWith(prefix)) prefix = prefix.slice(0, -1)
    }
    if (prefix.length > token.length) setInput(prefix)
    else setEntries((prev) => [...prev, { command: token, output: [matches.join('   ')] }])
  }, [input, commands])

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      runCommand(input)
      setInput('')
    } else if (e.key === 'Tab') {
      e.preventDefault()
      complete()
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
    <section className="relative isolate">
      <HeroBackdrop />
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

      <div className="mt-8 flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-8">
        <JpMark
          size={132}
          spin={16}
          radius="18px"
          label="Jacob Prue monogram"
          className="shrink-0 shadow-lg shadow-black/20"
        />
        <div>
          <h1 className="text-4xl font-bold tracking-tight">
            Hi, I&apos;m <span className="text-[hsl(var(--accent))]">Jacob Prue</span>
          </h1>
          <p className="mt-3 text-lg text-[hsl(var(--muted-foreground))] max-w-xl">
            Full-stack engineer building scalable systems with React, Node.js, and AWS.
            I care about infrastructure as code, type safety, and shipping things that actually work.
          </p>
          <div className="mt-6 flex flex-wrap gap-4">
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
      </div>
    </section>
  )
}
