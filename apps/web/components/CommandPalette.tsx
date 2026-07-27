'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { OPEN_RESUME_VIEWER_EVENT } from '@/components/ResumeViewer'
import { ACCENTS, accentLabel, setAccent, isCrt, setCrt } from '@/lib/accent'
import { sendChat, type ChatTurn } from '@/lib/api'

type Command = {
  id: string
  label: string
  hint?: string
  group: string
  keywords?: string
  // Ask-AI items keep the palette open (they switch it into chat mode).
  keepOpen?: boolean
  run: () => void
}

// Dispatch this event (e.g. from a Nav button) to open the palette without a keyboard.
export const OPEN_COMMAND_PALETTE_EVENT = 'open-command-palette'

// Shown as one-tap prompts when the palette opens with an empty query.
const SUGGESTED = [
  "What's your experience with AWS?",
  'Summarize your tech stack',
  'What are you most proud of building?',
]

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export function CommandPalette() {
  const router = useRouter()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  // Ask-AI mode: the palette becomes a spotlight chat over /api/chat.
  const [mode, setMode] = useState<'command' | 'ask'>('command')
  const [thread, setThread] = useState<ChatTurn[]>([])
  const [asking, setAsking] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const threadRef = useRef<HTMLDivElement>(null)
  // Element focused before the palette opened, so we can restore focus on close.
  const restoreFocusRef = useRef<HTMLElement | null>(null)

  const close = useCallback(() => setOpen(false), [])

  // Navigate to an on-page section (smooth-scroll if already home, otherwise route there).
  const goToSection = useCallback(
    (hash: string) => {
      const id = hash.replace(/^\/?#/, '')
      if (window.location.pathname === '/') {
        const el = document.getElementById(id)
        el?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
        window.history.replaceState(null, '', `/#${id}`)
      } else {
        router.push(`/#${id}`)
      }
    },
    [router],
  )

  const viewResume = useCallback(() => {
    window.dispatchEvent(new Event(OPEN_RESUME_VIEWER_EVENT))
  }, [])

  // Send a question to the résumé chatbot and append the answer to the thread.
  const ask = useCallback(async (question: string, history: ChatTurn[]) => {
    const q = question.trim()
    if (!q) return
    const next: ChatTurn[] = [...history, { role: 'user', content: q }]
    setThread(next)
    setQuery('')
    setAsking(true)
    try {
      const { reply } = await sendChat(next)
      setThread((prev) => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setThread((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
      ])
    } finally {
      setAsking(false)
    }
  }, [])

  const startAsk = useCallback(
    (question: string) => {
      setMode('ask')
      void ask(question, [])
    },
    [ask],
  )

  const exitAsk = useCallback(() => {
    setMode('command')
    setThread([])
    setQuery('')
    setActive(0)
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [])

  const commands = useMemo<Command[]>(() => {
    const currentlyDark = (resolvedTheme ?? theme) === 'dark'
    return [
      { id: 'home', group: 'Navigate', label: 'Go to Home', keywords: 'top hero start', run: () => router.push('/') },
      { id: 'projects', group: 'Navigate', label: 'Go to Projects', keywords: 'work', run: () => goToSection('projects') },
      { id: 'skills', group: 'Navigate', label: 'Go to Skills', keywords: 'stack tech', run: () => goToSection('skills') },
      { id: 'github', group: 'Navigate', label: 'Go to GitHub Activity', keywords: 'stats contributions', run: () => goToSection('github') },
      { id: 'contact', group: 'Navigate', label: 'Go to Contact', keywords: 'email message reach', run: () => goToSection('contact') },
      { id: 'stats', group: 'Navigate', label: 'Go to Stats page', keywords: 'analytics visitors', run: () => router.push('/stats') },
      { id: 'resume', group: 'Actions', label: 'View résumé', hint: 'PDF', keywords: 'cv download view open', run: viewResume },
      {
        id: 'theme',
        group: 'Appearance',
        label: currentlyDark ? 'Switch to light theme' : 'Switch to dark theme',
        keywords: 'dark light mode toggle appearance',
        run: () => setTheme(currentlyDark ? 'light' : 'dark'),
      },
      ...ACCENTS.map((a) => ({
        id: `accent-${a}`,
        group: 'Appearance',
        label: `Accent: ${accentLabel(a)}`,
        keywords: `color accent theme ${a}`,
        run: () => setAccent(a),
      })),
      {
        id: 'crt',
        group: 'Appearance',
        label: 'Toggle CRT / scanline mode',
        keywords: 'retro scanlines glow crt terminal',
        run: () => setCrt(!isCrt()),
      },
      {
        id: 'github-ext',
        group: 'Links',
        label: 'Open GitHub profile',
        hint: '↗',
        keywords: 'external code repos jp64057',
        run: () => window.open('https://github.com/jp64057', '_blank', 'noopener,noreferrer'),
      },
    ]
  }, [router, goToSection, viewResume, setTheme, theme, resolvedTheme])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = q
      ? commands.filter(
          (c) => c.label.toLowerCase().includes(q) || c.keywords?.toLowerCase().includes(q),
        )
      : commands
    // Ask-AI items: one "ask this" when there's a query, else the suggestions.
    const askItems: Command[] = query.trim()
      ? [
          {
            id: 'ask',
            group: 'Ask AI',
            label: `Ask my résumé: “${query.trim()}”`,
            hint: '↵',
            keepOpen: true,
            run: () => startAsk(query.trim()),
          },
        ]
      : SUGGESTED.map((s, i) => ({
          id: `ask-${i}`,
          group: 'Ask AI',
          label: s,
          keywords: 'ai ask question résumé',
          keepOpen: true,
          run: () => startAsk(s),
        }))
    return [...base, ...askItems]
  }, [commands, query, startAsk])

  // Global open shortcut: ⌘K / Ctrl-K, plus a custom event for non-keyboard triggers.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpen)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpen)
    }
  }, [])

  // On open: remember focus, reset state, lock body scroll, focus the input.
  useEffect(() => {
    if (!open) return
    restoreFocusRef.current = document.activeElement as HTMLElement | null
    setQuery('')
    setActive(0)
    setMode('command')
    setThread([])
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Focus after paint so the input is mounted.
    const raf = requestAnimationFrame(() => inputRef.current?.focus())
    return () => {
      document.body.style.overflow = prevOverflow
      cancelAnimationFrame(raf)
      restoreFocusRef.current?.focus?.()
    }
  }, [open])

  // Keep the active option clamped and scrolled into view.
  useEffect(() => {
    if (active >= filtered.length) setActive(filtered.length ? filtered.length - 1 : 0)
  }, [filtered, active])

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [active])

  // Keep the chat thread scrolled to the newest message.
  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight })
  }, [thread, asking])

  // Entering ask mode by mouse-clicking a suggestion loses focus (the option
  // button unmounts). Re-focus the input so esc/enter keep working.
  useEffect(() => {
    if (mode === 'ask') requestAnimationFrame(() => inputRef.current?.focus())
  }, [mode])

  const runCommand = useCallback(
    (cmd: Command | undefined) => {
      if (!cmd) return
      if (!cmd.keepOpen) close()
      cmd.run()
    },
    [close],
  )

  const onDialogKeyDown = (e: React.KeyboardEvent) => {
    if (mode === 'ask') {
      if (e.key === 'Escape') {
        e.preventDefault()
        exitAsk()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (!asking) void ask(query, thread)
      }
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (filtered.length ? (i + 1) % filtered.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (filtered.length ? (i - 1 + filtered.length) % filtered.length : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      runCommand(filtered[active])
    } else if (e.key === 'Tab') {
      // Focus trap: only the input and the option list are interactive; keep focus on input.
      e.preventDefault()
      inputRef.current?.focus()
    }
  }

  if (!open) return null

  let renderIndex = -1
  let lastGroup = ''

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center p-4 pt-[15vh]"
      onMouseDown={(e) => {
        // Click on the backdrop (not the dialog) closes.
        if (e.target === e.currentTarget) close()
      }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-hidden />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={onDialogKeyDown}
        className="relative w-full max-w-lg overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] px-4">
          <span className="font-mono text-[hsl(var(--accent))]" aria-hidden>
            {mode === 'ask' ? '✦' : '›'}
          </span>
          <input
            ref={inputRef}
            type="text"
            role={mode === 'ask' ? 'textbox' : 'combobox'}
            aria-expanded={mode === 'ask' ? undefined : true}
            aria-controls={mode === 'ask' ? undefined : 'command-list'}
            aria-activedescendant={
              mode === 'ask' ? undefined : filtered[active] ? `command-${filtered[active].id}` : undefined
            }
            aria-autocomplete={mode === 'ask' ? undefined : 'list'}
            placeholder={mode === 'ask' ? 'Ask a follow-up… (esc to exit)' : 'Type a command, search, or ask a question…'}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            className="w-full bg-transparent py-4 font-mono text-sm outline-none placeholder:text-[hsl(var(--muted-foreground))]"
          />
          <kbd className="hidden rounded border border-[hsl(var(--border))] px-1.5 py-0.5 font-mono text-[10px] text-[hsl(var(--muted-foreground))] sm:inline">
            esc
          </kbd>
        </div>

        {mode === 'ask' ? (
          <div ref={threadRef} className="max-h-80 space-y-3 overflow-y-auto p-4" aria-live="polite">
            <p className="text-center text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              Ask my résumé · esc to exit
            </p>
            {thread.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                    m.role === 'user'
                      ? 'bg-[hsl(var(--accent-solid))] text-white'
                      : 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {asking && (
              <div className="flex justify-start">
                <div className="rounded-lg bg-[hsl(var(--muted))] px-3 py-2 text-sm text-[hsl(var(--muted-foreground))]">
                  <span className="animate-pulse">…thinking</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div
            ref={listRef}
            id="command-list"
            role="listbox"
            aria-label="Commands"
            className="max-h-72 overflow-y-auto p-2"
          >
            {filtered.length === 0 && (
              <p className="px-3 py-6 text-center font-mono text-sm text-[hsl(var(--muted-foreground))]">
                No matching commands
              </p>
            )}
            {filtered.map((cmd) => {
              renderIndex += 1
              const index = renderIndex
              const showGroup = cmd.group !== lastGroup
              lastGroup = cmd.group
              const isActive = index === active
              return (
                <div key={cmd.id}>
                  {showGroup && (
                    <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                      {cmd.group}
                    </div>
                  )}
                  <button
                    id={`command-${cmd.id}`}
                    data-index={index}
                    role="option"
                    aria-selected={isActive}
                    onMouseMove={() => setActive(index)}
                    onClick={() => runCommand(cmd)}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left font-mono text-sm transition-colors ${
                      isActive
                        ? 'bg-[hsl(var(--accent-solid))] text-white'
                        : 'text-[hsl(var(--foreground))]'
                    }`}
                  >
                    <span>{cmd.label}</span>
                    {cmd.hint && (
                      <span className={isActive ? 'text-white/70' : 'text-[hsl(var(--muted-foreground))]'}>
                        {cmd.hint}
                      </span>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
