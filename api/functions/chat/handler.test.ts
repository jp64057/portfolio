import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }))
vi.mock('../../shared/dynamo.js', () => ({ ddb: { send: mockSend }, TABLE: 'portfolio' }))

import { handler, sanitizeMessages } from './handler.js'

const post = (body: unknown, ip = '5.5.5.5'): APIGatewayProxyEventV2 =>
  ({
    requestContext: { http: { method: 'POST', sourceIp: ip } },
    body: JSON.stringify(body),
  }) as unknown as APIGatewayProxyEventV2

beforeEach(() => {
  mockSend.mockReset()
  delete process.env.ANTHROPIC_API_KEY
})

describe('sanitizeMessages', () => {
  it('keeps only valid user/assistant string messages', () => {
    const out = sanitizeMessages([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
      { role: 'system', content: 'ignored' },
      { role: 'user', content: 123 },
      { role: 'user', content: '  ' },
    ])
    expect(out).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
    ])
  })

  it('drops leading assistant turns so the transcript starts with a user', () => {
    const out = sanitizeMessages([
      { role: 'assistant', content: 'a' },
      { role: 'user', content: 'b' },
    ])
    expect(out[0]).toEqual({ role: 'user', content: 'b' })
  })

  it('caps history length', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ role: 'user', content: `m${i}` }))
    expect(sanitizeMessages(many).length).toBeLessThanOrEqual(12)
  })
})

describe('handler guards', () => {
  it('400 when there is no user message', async () => {
    const res = (await handler(post({ messages: [] }))) as { statusCode: number }
    expect(res.statusCode).toBe(400)
  })

  it('429 when the rate limit is exceeded', async () => {
    mockSend.mockRejectedValueOnce(
      Object.assign(new Error('rl'), { name: 'ConditionalCheckFailedException' }),
    )
    const res = (await handler(post({ messages: [{ role: 'user', content: 'hi' }] }))) as {
      statusCode: number
    }
    expect(res.statusCode).toBe(429)
  })

  it('returns a graceful fallback (200) when the API key is unset', async () => {
    mockSend.mockResolvedValue({ Attributes: { n: 1, ttl: 9999999999 } }) // rate-limit ok
    const res = (await handler(post({ messages: [{ role: 'user', content: 'hi' }] }))) as {
      statusCode: number
      body: string
    }
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.fallback).toBe(true)
    expect(body.reply).toMatch(/isn't fully set up|contact form/i)
  })
})
