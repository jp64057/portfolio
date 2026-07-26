'use client'

import { useEffect, useRef } from 'react'

// Cloudflare Turnstile. Defaults to Cloudflare's public *test* site key (always
// passes) so the form works out of the box; set NEXT_PUBLIC_TURNSTILE_SITE_KEY
// at build time to a real key for actual protection.
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  remove: (id: string) => void
  reset: (id?: string) => void
}

let scriptPromise: Promise<void> | null = null
function loadScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if ((window as unknown as { turnstile?: TurnstileApi }).turnstile) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SCRIPT_SRC
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Turnstile failed to load'))
    document.head.appendChild(s)
  })
  return scriptPromise
}

export function Turnstile({
  onVerify,
  onExpire,
}: {
  onVerify: (token: string) => void
  onExpire?: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)
  // Keep the latest callbacks in refs so the render effect runs exactly once.
  const onVerifyRef = useRef(onVerify)
  onVerifyRef.current = onVerify
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire

  useEffect(() => {
    let cancelled = false
    loadScript()
      .then(() => {
        const api = (window as unknown as { turnstile?: TurnstileApi }).turnstile
        if (cancelled || !ref.current || !api) return
        widgetId.current = api.render(ref.current, {
          sitekey: SITE_KEY,
          callback: (token: string) => onVerifyRef.current(token),
          'expired-callback': () => onExpireRef.current?.(),
          'error-callback': () => onExpireRef.current?.(),
        })
      })
      .catch(() => {
        // Script blocked/unavailable — leave the widget empty; the server still
        // enforces verification when a real secret is configured.
      })
    return () => {
      cancelled = true
      const api = (window as unknown as { turnstile?: TurnstileApi }).turnstile
      if (widgetId.current && api) {
        try {
          api.remove(widgetId.current)
        } catch {
          // widget already gone
        }
      }
    }
  }, [])

  return <div ref={ref} className="min-h-[65px]" />
}
