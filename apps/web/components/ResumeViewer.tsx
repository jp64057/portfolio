'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// Dispatch this event (from any button / command) to open the résumé viewer.
export const OPEN_RESUME_VIEWER_EVENT = 'open-resume-viewer'

const RESUME_URL = '/resume.pdf'
const MIN_SCALE = 0.6
const MAX_SCALE = 2.4
const SCALE_STEP = 0.2
// Base CSS width (px) a page renders at when zoom = 1; the backing store is
// multiplied by devicePixelRatio for crispness.
const BASE_WIDTH = 760

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export function ResumeViewer() {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [numPages, setNumPages] = useState(0)
  const [scale, setScale] = useState(1)

  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  // The loaded PDFDocumentProxy (pdfjs types are loaded lazily, so use unknown).
  const pdfRef = useRef<{ numPages: number; getPage: (n: number) => Promise<unknown> } | null>(null)
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([])

  const close = useCallback(() => setOpen(false), [])

  // Open via the custom event.
  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener(OPEN_RESUME_VIEWER_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_RESUME_VIEWER_EVENT, onOpen)
  }, [])

  // On open: remember focus, lock body scroll, focus the close button; restore on close.
  useEffect(() => {
    if (!open) return
    restoreFocusRef.current = document.activeElement as HTMLElement | null
    setScale(1)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const raf = requestAnimationFrame(() => closeButtonRef.current?.focus())
    return () => {
      document.body.style.overflow = prevOverflow
      cancelAnimationFrame(raf)
      restoreFocusRef.current?.focus?.()
    }
  }, [open])

  // Handle Escape at the document level so it closes the viewer regardless of
  // where focus happens to be (the close-button focus lands on a rAF, which can
  // be delayed on a busy page) — mirrors the command palette's approach.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close])

  // Lazy-load pdf.js and the document when the viewer first opens.
  useEffect(() => {
    if (!open || pdfRef.current) return
    let cancelled = false
    setStatus('loading')
    ;(async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        // The worker ships as an ESM asset; webpack rewrites this URL at build.
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
        ).toString()
        const doc = await pdfjs.getDocument({ url: RESUME_URL }).promise
        if (cancelled) return
        pdfRef.current = doc
        canvasRefs.current = new Array(doc.numPages).fill(null)
        setNumPages(doc.numPages)
        setStatus('ready')
      } catch (e) {
        console.error('résumé viewer failed to load', e)
        if (!cancelled) setStatus('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  // Render every page whenever the viewer opens or the document / zoom changes.
  // `open` is a dependency because closing unmounts the <canvas> elements, so a
  // reopen mounts fresh (blank) ones that must be redrawn — even though status /
  // numPages are unchanged from the first open (the PDF stays cached).
  useEffect(() => {
    if (!open || status !== 'ready' || !pdfRef.current) return
    const doc = pdfRef.current
    const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2)
    let cancelled = false
    const tasks: { cancel: () => void }[] = []

    ;(async () => {
      for (let i = 1; i <= doc.numPages; i++) {
        if (cancelled) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const page: any = await doc.getPage(i)
        const canvas = canvasRefs.current[i - 1]
        if (!canvas) continue
        const unit = page.getViewport({ scale: 1 })
        // Fit BASE_WIDTH at zoom 1, then apply the user's zoom + DPR to the backing store.
        const cssScale = (BASE_WIDTH / unit.width) * scale
        const viewport = page.getViewport({ scale: cssScale * dpr })
        canvas.width = viewport.width
        canvas.height = viewport.height
        canvas.style.width = `${viewport.width / dpr}px`
        canvas.style.height = `${viewport.height / dpr}px`
        const ctx = canvas.getContext('2d')
        if (!ctx) continue
        const task = page.render({ canvasContext: ctx, viewport })
        tasks.push(task)
        try {
          await task.promise
        } catch {
          /* render cancelled by a newer zoom — ignore */
        }
      }
    })()

    return () => {
      cancelled = true
      tasks.forEach((t) => t.cancel())
    }
  }, [open, status, scale, numPages])

  const onKeyDown = (e: React.KeyboardEvent) => {
    // Escape is handled at the document level (see effect above).
    if (e.key === 'Tab') {
      // Simple focus trap: keep focus inside the dialog.
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, [tabindex]:not([tabindex="-1"])',
      )
      if (!focusables || focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  const zoomOut = () => setScale((s) => Math.max(MIN_SCALE, +(s - SCALE_STEP).toFixed(2)))
  const zoomIn = () => setScale((s) => Math.min(MAX_SCALE, +(s + SCALE_STEP).toFixed(2)))

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center p-4 pt-[8vh] sm:pt-[10vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Résumé viewer"
        onKeyDown={onKeyDown}
        className={`relative flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-2xl ${
          prefersReducedMotion() ? '' : 'motion-safe:animate-in'
        }`}
      >
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 border-b border-[hsl(var(--border))] px-4 py-2.5">
          <div className="flex items-center gap-2 font-mono text-sm">
            <span className="text-[hsl(var(--accent))]" aria-hidden>
              ▸
            </span>
            <span className="font-medium">résumé</span>
            {status === 'ready' && numPages > 0 && (
              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                {numPages === 1 ? '1 page' : `${numPages} pages`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={zoomOut}
              disabled={status !== 'ready' || scale <= MIN_SCALE}
              aria-label="Zoom out"
              className="rounded px-2 py-1 font-mono text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] disabled:opacity-40"
            >
              −
            </button>
            <span
              className="w-12 text-center font-mono text-xs text-[hsl(var(--muted-foreground))]"
              aria-live="polite"
            >
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={zoomIn}
              disabled={status !== 'ready' || scale >= MAX_SCALE}
              aria-label="Zoom in"
              className="rounded px-2 py-1 font-mono text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] disabled:opacity-40"
            >
              +
            </button>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={close}
              aria-label="Close résumé viewer"
              className="ml-1 rounded px-2 py-1 font-mono text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
            >
              esc ✕
            </button>
          </div>
        </div>

        {/* Pages */}
        <div className="flex-1 overflow-auto bg-[hsl(var(--muted))] p-4">
          {status === 'loading' && (
            <p className="py-16 text-center font-mono text-sm text-[hsl(var(--muted-foreground))]">
              Loading résumé…
            </p>
          )}
          {status === 'error' && (
            <p className="py-16 text-center font-mono text-sm text-[hsl(var(--muted-foreground))]">
              Could not display the résumé right now.{' '}
              <a href={RESUME_URL} target="_blank" rel="noopener noreferrer" className="underline">
                Open it in a new tab
              </a>
              .
            </p>
          )}
          <div className="flex flex-col items-center gap-4">
            {Array.from({ length: numPages }).map((_, i) => (
              <canvas
                key={i}
                ref={(el) => {
                  canvasRefs.current[i] = el
                }}
                role="img"
                aria-label={`Résumé${numPages > 1 ? ` — page ${i + 1} of ${numPages}` : ''}`}
                className="max-w-full rounded bg-white shadow-md"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
