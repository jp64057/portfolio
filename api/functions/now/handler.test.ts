import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../shared/dynamo.js', () => ({ ddb: { send: vi.fn() }, TABLE: 'portfolio' }))

import { computeNow } from './handler.js'

// Real events-feed shape: PushEvent payload has `head`/`ref` but no `commits`.
const eventsNoCommits = [
  { type: 'WatchEvent', created_at: '2026-07-26T10:00:00Z', repo: { name: 'jp64057/other' }, payload: {} },
  {
    type: 'PushEvent',
    created_at: '2026-07-26T12:00:00Z',
    repo: { name: 'jp64057/portfolio' },
    payload: { ref: 'refs/heads/main', head: 'deadbeef' },
  },
]

beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
afterEach(() => vi.unstubAllGlobals())

describe('computeNow', () => {
  it('derives the commit from head SHA and fetches its message', async () => {
    ;(fetch as any)
      .mockResolvedValueOnce({ ok: true, json: async () => eventsNoCommits }) // events feed
      .mockResolvedValueOnce({ ok: true, json: async () => ({ commit: { message: 'feat: ship it\n\nbody' } }) }) // commit

    const data = await computeNow()
    expect(data.latestCommit).toEqual({
      repo: 'portfolio',
      message: 'feat: ship it',
      url: 'https://github.com/jp64057/portfolio/commit/deadbeef',
      at: '2026-07-26T12:00:00Z',
    })
    expect(fetch as any).toHaveBeenCalledTimes(2)
  })

  it('uses inlined commits when the payload includes them (no extra fetch)', async () => {
    const withCommits = [
      {
        type: 'PushEvent',
        created_at: '2026-07-26T12:00:00Z',
        repo: { name: 'jp64057/portfolio' },
        payload: { head: 'aaa', commits: [{ message: 'first', sha: 'aaa' }, { message: 'second', sha: 'bbb' }] },
      },
    ]
    ;(fetch as any).mockResolvedValueOnce({ ok: true, json: async () => withCommits })

    const data = await computeNow()
    expect(data.latestCommit?.message).toBe('second')
    expect(data.latestCommit?.url).toBe('https://github.com/jp64057/portfolio/commit/bbb')
    expect(fetch as any).toHaveBeenCalledTimes(1) // no commit lookup needed
  })

  it('still returns a result if the commit-message fetch fails', async () => {
    ;(fetch as any)
      .mockResolvedValueOnce({ ok: true, json: async () => eventsNoCommits })
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) })

    const data = await computeNow()
    expect(data.latestCommit?.repo).toBe('portfolio')
    expect(data.latestCommit?.message).toBe('pushed changes') // graceful fallback
  })

  it('returns null when there are no push events', async () => {
    ;(fetch as any).mockResolvedValue({ ok: true, json: async () => [eventsNoCommits[0]] })
    const data = await computeNow()
    expect(data.latestCommit).toBeNull()
  })

  it('throws on a non-ok GitHub events response', async () => {
    ;(fetch as any).mockResolvedValue({ ok: false, status: 403, json: async () => ({}) })
    await expect(computeNow()).rejects.toThrow(/403/)
  })
})
