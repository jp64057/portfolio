import { describe, it, expect, vi, afterEach } from 'vitest'
import { trackVisit, fetchStats, sendContact, fetchGithubStats } from './api'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('api client', () => {
  it('trackVisit POSTs the page and returns the count', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ count: 42 }) })
    vi.stubGlobal('fetch', fetchMock)

    const count = await trackVisit('/')

    expect(count).toBe(42)
    expect(fetchMock).toHaveBeenCalledWith('/api/visit', expect.objectContaining({ method: 'POST' }))
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ page: '/' })
  })

  it('sendContact POSTs the form body as JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)

    await sendContact({ name: 'A', email: 'a@b.co', message: 'hello there', honeypot: '' })

    expect(fetchMock).toHaveBeenCalledWith('/api/contact', expect.objectContaining({ method: 'POST' }))
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body).toMatchObject({ name: 'A', email: 'a@b.co', honeypot: '' })
  })

  it('fetchStats rejects on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    await expect(fetchStats()).rejects.toThrow(/failed/i)
  })

  it('fetchGithubStats rejects on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    await expect(fetchGithubStats()).rejects.toThrow(/failed/i)
  })
})
