import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }))

vi.mock('../../shared/dynamo.js', () => ({
  ddb: { send: mockSend },
  TABLE: 'portfolio',
}))

import { computeStats, handler } from './handler.js'

// NB: block body, not `() => mockSend.mockReset()` — mockReset() returns the
// spy, and a hook that returns a function is treated by vitest as a teardown
// callback (it would get invoked with no args, breaking the next assertions).
beforeEach(() => {
  mockSend.mockReset()
})

describe('computeStats', () => {
  it('aggregates page views from the shared stats partition', async () => {
    mockSend.mockResolvedValue({
      Items: [
        { PK: 'stats', SK: 'page::/', views: 100 },
        { PK: 'stats', SK: 'page::/projects', views: 40 },
      ],
    })

    const stats = await computeStats()
    expect(stats.totalPageViews).toBe(140)
    // Sorted most-viewed first, prefix stripped.
    expect(stats.pages).toEqual([
      { path: '/', views: 100 },
      { path: '/projects', views: 40 },
    ])
    expect(typeof stats.generatedAt).toBe('string')
  })

  it('follows Query pagination across pages', async () => {
    mockSend.mockImplementation((cmd: any) => {
      if (!cmd.input.ExclusiveStartKey) {
        return Promise.resolve({
          Items: [{ PK: 'stats', SK: 'page::/', views: 10 }],
          LastEvaluatedKey: { PK: 'stats', SK: 'page::/' },
        })
      }
      return Promise.resolve({ Items: [{ PK: 'stats', SK: 'page::/blog', views: 5 }] })
    })

    const stats = await computeStats()
    expect(stats.totalPageViews).toBe(15)
    expect(stats.pages).toHaveLength(2)
  })

  it('handles empty data gracefully', async () => {
    mockSend.mockResolvedValue({ Items: [] })

    const stats = await computeStats()
    expect(stats.totalPageViews).toBe(0)
    expect(stats.pages).toEqual([])
  })
})

describe('handler', () => {
  // Runs before the caching test, so the module-level cache is still empty here.
  it('returns 500 when DynamoDB errors', async () => {
    mockSend.mockRejectedValue(new Error('boom'))
    const res = (await handler({} as APIGatewayProxyEventV2)) as { statusCode: number }
    expect(res.statusCode).toBe(500)
  })

  it('caches results and sets Cache-Control (runs last — populates the cache)', async () => {
    mockSend.mockResolvedValue({ Items: [{ PK: 'stats', SK: 'page::/', views: 3 }] })

    const first = (await handler({} as APIGatewayProxyEventV2)) as {
      statusCode: number
      headers: Record<string, string>
    }
    const second = await handler({} as APIGatewayProxyEventV2)

    expect(first.statusCode).toBe(200)
    expect(first.headers['Cache-Control']).toContain('max-age')
    // One Query for the first call; the second is served from cache.
    expect(mockSend).toHaveBeenCalledTimes(1)
    expect(second).toEqual(first)
  })
})
