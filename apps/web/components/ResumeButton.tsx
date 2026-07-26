'use client'

import { OPEN_RESUME_VIEWER_EVENT } from '@/components/ResumeViewer'

const DEFAULT_CLASS =
  'rounded-lg border border-[hsl(var(--border))] px-5 py-2.5 text-sm font-medium hover:bg-[hsl(var(--muted))] transition-colors'

export function ResumeButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      // Opens the in-site PDF viewer — the résumé is never downloaded to disk.
      onClick={() => window.dispatchEvent(new Event(OPEN_RESUME_VIEWER_EVENT))}
      className={className ?? DEFAULT_CLASS}
    >
      View résumé
    </button>
  )
}
