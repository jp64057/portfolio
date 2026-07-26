import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../shared/dynamo.js', () => ({ ddb: { send: vi.fn() }, TABLE: 'portfolio' }))

import { computeNow } from './handler.js'

const events = [
  { type: 'WatchEvent', created_at: '2026-07-26T10:00:00Z', repo: { name: 'jp64057/other' }, payload: {} },
  {
    type: 'PushEvent',
    created_at: '2026-07-26T12:00:00Z',
    repo: { name: 'jp64057/portfolio' },
    payload: { commits: [{ message: 'first', sha: 'aaa' }, { message: 'feat: ship it\n\nbody', sha: 'bbb' }] },
  },
]

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('computeNow', () => {
  it('extracts the latest commit from the newest PushEvent', async () => {
    ;(fetch as any).mockResolvedValue({ ok: true, json: async () => events })

    const data = await computeNow()
    expect(data.latestCommit).toEqual({
      repo: 'portfolio', // username prefix stripped
      message: 'feat: ship it', // last commit, first line only
      url: 'https://github.com/jp64057/portfolio/commit/bbb',
      at: '2026-07-26T12:00:00Z',
    })
    expect(typeof data.fetchedAt).toBe('string')
  })

  it('returns null when there are no push events', async () => {
    ;(fetch as any).mockResolvedValue({ ok: true, json: async () => [events[0]] })
    const data = await computeNow()
    expect(data.latestCommit).toBeNull()
  })

  it('throws on a non-ok GitHub response', async () => {
    ;(fetch as any).mockResolvedValue({ ok: false, status: 403, json: async () => ({}) })
    await expect(computeNow()).rejects.toThrow(/403/)
  })
})
