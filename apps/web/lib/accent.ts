// Accent-theme + CRT state, persisted in localStorage and reflected as
// data-accent / data-crt attributes on <html>. The inline script in layout.tsx
// applies the stored values before first paint (no flash of the wrong accent).

export const ACCENTS = ['blue', 'emerald', 'amber', 'fuchsia', 'violet'] as const
export type Accent = (typeof ACCENTS)[number]

export const ACCENT_STORAGE_KEY = 'accent'
export const CRT_STORAGE_KEY = 'crt'

const ACCENT_LABEL: Record<Accent, string> = {
  blue: 'Blue (default)',
  emerald: 'Emerald',
  amber: 'Amber',
  fuchsia: 'Fuchsia',
  violet: 'Violet',
}

export function accentLabel(a: Accent): string {
  return ACCENT_LABEL[a]
}

export function getAccent(): Accent {
  if (typeof document === 'undefined') return 'blue'
  const a = document.documentElement.dataset.accent as Accent | undefined
  return a && ACCENTS.includes(a) ? a : 'blue'
}

export function setAccent(a: Accent): void {
  const root = document.documentElement
  // 'blue' is the default (no attribute) so the base :root vars apply.
  if (a === 'blue') delete root.dataset.accent
  else root.dataset.accent = a
  try {
    localStorage.setItem(ACCENT_STORAGE_KEY, a)
  } catch {
    /* storage blocked — the choice just won't persist */
  }
}

export function isCrt(): boolean {
  if (typeof document === 'undefined') return false
  return document.documentElement.dataset.crt === 'on'
}

export function setCrt(on: boolean): void {
  const root = document.documentElement
  if (on) root.dataset.crt = 'on'
  else delete root.dataset.crt
  try {
    localStorage.setItem(CRT_STORAGE_KEY, on ? 'on' : 'off')
  } catch {
    /* ignore */
  }
}
