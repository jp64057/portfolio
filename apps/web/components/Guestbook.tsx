'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { fetchGuestbook, signGuestbook, type GuestbookEntry } from '@/lib/api'

const MAX_NAME = 50
const MAX_MESSAGE = 280

type Status = 'idle' | 'submitting' | 'error' | 'rate-limited' | 'pending'

function formatDate(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function Guestbook() {
  const [entries, setEntries] = useState<GuestbookEntry[]>([])
  const [loaded, setLoaded] = useState(false)
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    fetchGuestbook()
      .then(setEntries)
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const n = name.trim()
    const m = message.trim()
    if (!n || !m) return

    setStatus('submitting')
    setErrorMsg('')

    // Optimistic: show the entry immediately, roll back on failure.
    const optimistic: GuestbookEntry = {
      id: `temp-${Date.now()}`,
      name: n,
      message: m,
      createdAt: new Date().toISOString(),
    }
    setEntries((prev) => [optimistic, ...prev])
    const rollback = () => setEntries((prev) => prev.filter((x) => x.id !== optimistic.id))

    try {
      const res = await signGuestbook({ name: n, message: m, honeypot })
      if (res.status === 429) {
        rollback()
        setStatus('rate-limited')
        return
      }
      if (!res.ok) {
        rollback()
        const data = await res.json().catch(() => ({}))
        setErrorMsg(data.error ?? 'Could not post your message.')
        setStatus('error')
        return
      }
      const data = await res.json()
      if (data.pending) {
        // Moderation is on: the entry won't show until approved.
        rollback()
        setStatus('pending')
      } else {
        setEntries((prev) => prev.map((x) => (x.id === optimistic.id ? data.entry : x)))
        setStatus('idle')
      }
      setName('')
      setMessage('')
    } catch {
      rollback()
      setErrorMsg('Network error — please try again.')
      setStatus('error')
    }
  }

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-[hsl(var(--border))] p-6">
        {/* Honeypot — hidden from users; bots fill it in. */}
        <input
          type="text"
          tabIndex={-1}
          aria-hidden
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          className="hidden"
        />

        <div>
          <label htmlFor="gb-name" className="block text-sm font-medium mb-1">
            Name
          </label>
          <input
            id="gb-name"
            value={name}
            maxLength={MAX_NAME}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--accent))]"
            placeholder="Your name"
          />
        </div>

        <div>
          <label htmlFor="gb-message" className="block text-sm font-medium mb-1">
            Message
          </label>
          <textarea
            id="gb-message"
            value={message}
            maxLength={MAX_MESSAGE}
            rows={4}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full resize-none rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--accent))]"
            placeholder="Leave a note…"
          />
          <p className="mt-1 text-right text-xs text-[hsl(var(--muted-foreground))]">
            {message.length}/{MAX_MESSAGE}
          </p>
        </div>

        {status === 'rate-limited' && (
          <p role="alert" className="text-sm text-yellow-700 dark:text-yellow-400">
            You&apos;re posting too fast — try again in a moment.
          </p>
        )}
        {status === 'pending' && (
          <p role="status" className="text-sm text-[hsl(var(--accent))]">
            Thanks! Your message is awaiting approval.
          </p>
        )}
        {status === 'error' && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {errorMsg}
          </p>
        )}

        <button
          type="submit"
          disabled={status === 'submitting' || !name.trim() || !message.trim()}
          className="w-full rounded-lg bg-[hsl(var(--accent-solid))] py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {status === 'submitting' ? 'Signing…' : 'Sign the guestbook'}
        </button>
      </form>

      <div className="space-y-4">
        {!loaded && <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading messages…</p>}
        {loaded && entries.length === 0 && (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            No messages yet — be the first to sign.
          </p>
        )}
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="rounded-lg border border-[hsl(var(--border))] p-4"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{entry.name}</span>
                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                  {formatDate(entry.createdAt)}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-[hsl(var(--muted-foreground))]">
                {entry.message}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
