const BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

export interface GithubStats {
  publicRepos: number
  totalStars: number
  followers: number
  topLanguages: { name: string; pct: number }[]
}

export async function fetchGithubStats(): Promise<GithubStats> {
  const res = await fetch(`${BASE}/api/github-stats`, { next: { revalidate: 900 } })
  if (!res.ok) throw new Error('Failed to fetch GitHub stats')
  return res.json()
}

export async function trackVisit(page: string): Promise<number> {
  const res = await fetch(`${BASE}/api/visit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ page }),
  })
  if (!res.ok) throw new Error('Visit tracking failed')
  const data = await res.json()
  return data.count as number
}

export async function sendContact(body: {
  name: string
  email: string
  message: string
  honeypot: string
  turnstileToken?: string
}): Promise<Response> {
  return fetch(`${BASE}/api/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function trackResumeDownload(): Promise<void> {
  await fetch(`${BASE}/api/resume-download`, { method: 'POST' }).catch(() => {})
}

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export async function sendChat(
  messages: ChatTurn[],
): Promise<{ reply: string; fallback?: boolean }> {
  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  })
  if (res.status === 429) {
    return { reply: "You're sending messages too quickly — please slow down.", fallback: true }
  }
  if (!res.ok) {
    return { reply: 'Sorry, something went wrong. Please try again in a moment.', fallback: true }
  }
  return res.json()
}

export interface GuestbookEntry {
  id: string
  name: string
  message: string
  createdAt: string
}

export async function fetchGuestbook(): Promise<GuestbookEntry[]> {
  const res = await fetch(`${BASE}/api/guestbook`)
  if (!res.ok) throw new Error('Failed to load guestbook')
  const data = await res.json()
  return data.entries as GuestbookEntry[]
}

export async function signGuestbook(body: {
  name: string
  message: string
  honeypot: string
}): Promise<Response> {
  return fetch(`${BASE}/api/guestbook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export interface Stats {
  totalPageViews: number
  pages: { path: string; views: number }[]
  resumeDownloads: number
  generatedAt: string
}

export async function fetchStats(): Promise<Stats> {
  const res = await fetch(`${BASE}/api/stats`)
  if (!res.ok) throw new Error('Failed to fetch stats')
  return res.json()
}
