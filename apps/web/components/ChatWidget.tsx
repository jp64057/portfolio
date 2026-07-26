'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { sendChat, type ChatTurn } from '@/lib/api'

const GREETING: ChatTurn = {
  role: 'assistant',
  content: "Hi! I'm an AI assistant that can answer questions about Jacob's experience, skills, and projects. What would you like to know?",
}

export function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatTurn[]>([GREETING])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, loading])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || loading) return

    const next = [...messages, { role: 'user' as const, content: text }]
    setMessages(next)
    setInput('')
    setLoading(true)
    try {
      // Send only the real turns (drop the client-side greeting).
      const history = next.filter((m) => m !== GREETING)
      const { reply } = await sendChat(history)
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Floating toggle button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close résumé chat' : 'Ask my résumé — open chat'}
        aria-expanded={open}
        className="fixed bottom-5 right-5 z-[150] flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--accent-solid))] text-white shadow-lg transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--accent))] focus:ring-offset-2"
      >
        <span aria-hidden className="text-lg">{open ? '✕' : '💬'}</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Ask my résumé chat"
          className="fixed bottom-20 right-5 z-[150] flex h-[28rem] w-[min(24rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-2xl"
        >
          <div className="border-b border-[hsl(var(--border))] px-4 py-3">
            <p className="text-sm font-semibold">Ask my résumé</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              AI answers about Jacob&apos;s background
            </p>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            {messages.map((m, i) => (
              <div
                key={i}
                className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
              >
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
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-lg bg-[hsl(var(--muted))] px-3 py-2 text-sm text-[hsl(var(--muted-foreground))]">
                  <span className="animate-pulse">…thinking</span>
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={onSubmit}
            className="flex items-center gap-2 border-t border-[hsl(var(--border))] p-3"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={2000}
              aria-label="Your message"
              placeholder="Ask about Jacob's experience…"
              className="flex-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--accent))]"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-lg bg-[hsl(var(--accent-solid))] px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  )
}
