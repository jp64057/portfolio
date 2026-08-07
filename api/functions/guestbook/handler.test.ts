import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }))

vi.mock('../../shared/dynamo.js', () => ({
  ddb: { send: mockSend },
  TABLE: 'portfolio',
}))

import { handler, validateSubmission, containsProfanity, MAX_MESSAGE, safeEqual } from './handler.js'

const post = (body: unknown, ip = '1.2.3.4'): APIGatewayProxyEventV2 =>
  ({
    requestContext: { http: { method: 'POST', sourceIp: ip } },
    body: JSON.stringify(body),
  }) as unknown as APIGatewayProxyEventV2

beforeEach(() => {
  mockSend.mockReset()
  delete process.env.GUESTBOOK_AUTO_APPROVE
  delete process.env.GUESTBOOK_ADMIN_TOKEN
})

describe('validateSubmission', () => {
  it('accepts a valid submission and trims', () => {
    expect(validateSubmission({ name: '  Ada  ', message: '  hi there  ' })).toEqual({
      valid: true,
      name: 'Ada',
      message: 'hi there',
    })
  })

  it('rejects empty name / message', () => {
    expect(validateSubmission({ name: '', message: 'hello' }).valid).toBe(false)
    expect(validateSubmission({ name: 'Ada', message: '' }).valid).toBe(false)
  })

  it('rejects an over-long message', () => {
    expect(validateSubmission({ name: 'Ada', message: 'x'.repeat(MAX_MESSAGE + 1) }).valid).toBe(false)
  })

  it('rejects a filled honeypot', () => {
    expect(validateSubmission({ name: 'Ada', message: 'hello', honeypot: 'bot' }).valid).toBe(false)
  })

  it('flags profanity', () => {
    expect(containsProfanity('this is shit')).toBe(true)
    expect(containsProfanity('this is fine')).toBe(false)
  })
})

describe('handler', () => {
  it('lists approved entries only, newest first', async () => {
    mockSend.mockResolvedValue({
      Items: [
        { id: 'a', name: 'Ada', message: 'hi', createdAt: '2026-01-02', approved: true },
        { id: 'b', name: 'Bad', message: 'nope', createdAt: '2026-01-01', approved: false },
      ],
    })
    const res = (await handler({
      requestContext: { http: { method: 'GET' } },
    } as APIGatewayProxyEventV2)) as { statusCode: number; body: string }
    expect(res.statusCode).toBe(200)
    const { entries } = JSON.parse(res.body)
    expect(entries).toHaveLength(1)
    expect(entries[0].id).toBe('a')
  })

  it('creates an entry (201) after passing the rate-limit put', async () => {
    mockSend.mockResolvedValue({}) // rate-limit put + entry put both succeed
    const res = (await handler(post({ name: 'Ada', message: 'hello there' }))) as {
      statusCode: number
      body: string
    }
    expect(res.statusCode).toBe(201)
    expect(mockSend).toHaveBeenCalledTimes(2)
    expect(JSON.parse(res.body).entry.name).toBe('Ada')
  })

  it('returns 429 when the rate-limit condition fails', async () => {
    mockSend.mockRejectedValueOnce(
      Object.assign(new Error('rl'), { name: 'ConditionalCheckFailedException' }),
    )
    const res = (await handler(post({ name: 'Ada', message: 'hello there' }))) as {
      statusCode: number
    }
    expect(res.statusCode).toBe(429)
  })

  it('rejects invalid submissions with 400 before touching Dynamo', async () => {
    const res = (await handler(post({ name: '', message: '' }))) as { statusCode: number }
    expect(res.statusCode).toBe(400)
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('returns 403 for DELETE when no admin token is configured', async () => {
    const res = (await handler({
      requestContext: { http: { method: 'DELETE' } },
      headers: {},
      body: '{}',
    } as unknown as APIGatewayProxyEventV2)) as { statusCode: number }
    expect(res.statusCode).toBe(403)
  })

  it('returns 401 for DELETE with a wrong admin token (no write)', async () => {
    process.env.GUESTBOOK_ADMIN_TOKEN = 'secret-token'
    const res = (await handler({
      requestContext: { http: { method: 'DELETE' } },
      headers: { 'x-admin-token': 'wrong' },
      body: JSON.stringify({ id: 'x', createdAt: '2026-01-01T00:00:00.000Z' }),
    } as unknown as APIGatewayProxyEventV2)) as { statusCode: number }
    expect(res.statusCode).toBe(401)
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('deletes with the correct admin token', async () => {
    process.env.GUESTBOOK_ADMIN_TOKEN = 'secret-token'
    mockSend.mockResolvedValueOnce({})
    const res = (await handler({
      requestContext: { http: { method: 'DELETE' } },
      headers: { 'x-admin-token': 'secret-token' },
      body: JSON.stringify({ id: 'abc', createdAt: '2026-01-01T00:00:00.000Z' }),
    } as unknown as APIGatewayProxyEventV2)) as { statusCode: number }
    expect(res.statusCode).toBe(200)
    expect(mockSend).toHaveBeenCalledTimes(1)
  })
})

describe('safeEqual', () => {
  it('is true only for equal strings and false on any mismatch/length', () => {
    expect(safeEqual('token', 'token')).toBe(true)
    expect(safeEqual('token', 'toke')).toBe(false)
    expect(safeEqual('token', 'Token')).toBe(false)
    expect(safeEqual('', '')).toBe(true)
  })
})
