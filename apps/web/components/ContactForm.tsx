'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useEffect, useRef, useState } from 'react'
import { sendContact } from '@/lib/api'
import { Turnstile } from '@/components/Turnstile'

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address'),
  message: z.string().min(10, 'Message must be at least 10 characters').max(2000),
  honeypot: z.string().max(0),
})

type FormData = z.infer<typeof schema>

export function ContactForm() {
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'success' | 'error' | 'rate-limited' | 'captcha'
  >('idle')
  const [turnstileToken, setTurnstileToken] = useState('')
  // Render the CAPTCHA only once the form scrolls into view. Keeps the external
  // widget out of the initial (top-of-page) render — so audits that don't
  // scroll never see it — while real visitors get it as they reach the form.
  const [showCaptcha, setShowCaptcha] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShowCaptcha(true)
          io.disconnect()
        }
      },
      { rootMargin: '0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    if (!turnstileToken) {
      setStatus('captcha')
      return
    }
    setStatus('loading')
    try {
      const res = await sendContact({ ...data, turnstileToken })
      if (res.status === 429) {
        setStatus('rate-limited')
      } else if (res.status === 403) {
        setStatus('captcha')
      } else if (res.ok) {
        setStatus('success')
        reset()
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  return (
    <div ref={containerRef} className="rounded-xl border border-[hsl(var(--border))] p-6 max-w-lg">
      {status === 'success' ? (
        <div role="status" className="text-center py-8">
          <p className="text-2xl mb-2" aria-hidden>✓</p>
          <p className="font-medium">Message sent!</p>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">I&apos;ll get back to you soon.</p>
          <button onClick={() => setStatus('idle')} className="mt-4 text-sm text-[hsl(var(--accent))] underline">
            Send another
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {/* Honeypot — hidden from real users, bots fill it in */}
          <input {...register('honeypot')} type="text" tabIndex={-1} aria-hidden className="hidden" />

          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1">Name</label>
            <input
              id="name"
              {...register('name')}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? 'name-error' : undefined}
              className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--accent))]"
              placeholder="Your name"
            />
            {errors.name && (
              <p id="name-error" role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
                {errors.name.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">Email</label>
            <input
              id="email"
              type="email"
              {...register('email')}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? 'email-error' : undefined}
              className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--accent))]"
              placeholder="you@example.com"
            />
            {errors.email && (
              <p id="email-error" role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="message" className="block text-sm font-medium mb-1">Message</label>
            <textarea
              id="message"
              {...register('message')}
              rows={5}
              aria-invalid={errors.message ? true : undefined}
              aria-describedby={errors.message ? 'message-error' : undefined}
              className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--accent))] resize-none"
              placeholder="Tell me what you're working on..."
            />
            {errors.message && (
              <p id="message-error" role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
                {errors.message.message}
              </p>
            )}
          </div>

          {showCaptcha && (
            <Turnstile onVerify={setTurnstileToken} onExpire={() => setTurnstileToken('')} />
          )}

          {status === 'captcha' && (
            <p role="alert" className="text-sm text-yellow-700 dark:text-yellow-400">
              Please complete the CAPTCHA before sending.
            </p>
          )}
          {status === 'rate-limited' && (
            <p role="alert" className="text-sm text-yellow-700 dark:text-yellow-400">
              Too many requests — try again in an hour.
            </p>
          )}
          {status === 'error' && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              Something went wrong. Try again or email me directly.
            </p>
          )}

          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full rounded-lg bg-[hsl(var(--accent-solid))] py-2.5 text-sm font-medium text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {status === 'loading' ? 'Sending…' : 'Send Message'}
          </button>
        </form>
      )}
    </div>
  )
}
