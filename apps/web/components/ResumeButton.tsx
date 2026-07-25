'use client'

import { trackResumeDownload } from '@/lib/api'

const DEFAULT_CLASS =
  'rounded-lg border border-[hsl(var(--border))] px-5 py-2.5 text-sm font-medium hover:bg-[hsl(var(--muted))] transition-colors'

export function ResumeButton({ className }: { className?: string }) {
  return (
    <a
      href="/resume.pdf"
      download="jacob-prue-resume.pdf"
      // Fire-and-forget tracking; the `download` attr means no navigation, so
      // the request completes and the file still downloads immediately.
      onClick={() => {
        void trackResumeDownload()
      }}
      className={className ?? DEFAULT_CLASS}
    >
      Download résumé
    </a>
  )
}
