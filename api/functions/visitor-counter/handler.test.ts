import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }))
vi.mock('../../shared/dynamo.js', () => ({ ddb: { send: mockSend }, TABLE: 'portfolio' }))

import { handler, validatePage } from './handler.js'

const event = (body: unknown): APIGatewayProxyEventV2 =>
  ({
    requestContext: { http: { method: 'POST', sourceIp: '9.9.9.9' } },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as unknown as APIGatewayProxyEventV2

beforeEach(() => {
  mockSend.mockReset()
  mockSend.mockResolvedValue({ Attributes: { count: 42 } })
})

describe('validatePage', () => {
  it('accepts real pathnames', () => {
    expect(validatePage('/')).toBe('/')
    expect(validatePage('/stats')).toBe('/stats')
    expect(validatePage('/blog/some-post_1')).toBe('/blog/some-post_1')
  })
  it('rejects non-strings, non-paths, oversized, and injection-y values', () => {
    expect(validatePage(123)).toBeNull()
    expect(validatePage(null)).toBeNull()
    expect(validatePage('stats')).toBeNull() // no leading slash
    expect(validatePage('/' + 'a'.repeat(65))).toBeNull() // too long
    expect(validatePage('/a b')).toBeNull() // space
    expect(validatePage('/x::y')).toBeNull() // key-delimiter chars
    expect(validatePage('/<script>')).toBeNull()
  })
})

describe('visitor-counter handler', () => {
  it('increments and returns the count for a valid page', async () => {
    const res = (await handler(event({ page: '/stats' }))) as { statusCode: number; body: string }
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).count).toBe(42)
    expect(mockSend).toHaveBeenCalledTimes(1)
  })

  it('defaults to "/" when page is omitted', async () => {
    const res = (await handler(event({}))) as { statusCode: number }
    expect(res.statusCode).toBe(200)
    expect(mockSend).toHaveBeenCalledTimes(1)
  })

  it('rejects an invalid page without writing to DynamoDB', async () => {
    const res = (await handler(event({ page: '/x-' + 'z'.repeat(80) }))) as { statusCode: number }
    expect(res.statusCode).toBe(400)
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('rejects a non-string page', async () => {
    const res = (await handler(event({ page: { evil: true } }))) as { statusCode: number }
    expect(res.statusCode).toBe(400)
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('rejects a malformed JSON body', async () => {
    const res = (await handler({
      requestContext: { http: { method: 'POST', sourceIp: '9.9.9.9' } },
      body: '{not json',
    } as unknown as APIGatewayProxyEventV2)) as { statusCode: number }
    expect(res.statusCode).toBe(400)
    expect(mockSend).not.toHaveBeenCalled()
  })
})
