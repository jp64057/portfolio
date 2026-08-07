import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }))
vi.mock('../../shared/dynamo.js', () => ({ ddb: { send: mockSend }, TABLE: 'portfolio' }))
// Avoid real SES construction / calls.
vi.mock('@aws-sdk/client-ses', () => ({
  SESClient: class {
    send = vi.fn().mockResolvedValue({})
  },
  SendEmailCommand: class {},
}))

import { handler, verifyTurnstile, validateContact } from './handler.js'

const event = (body: unknown, ip = '9.9.9.9'): APIGatewayProxyEventV2 =>
  ({
    requestContext: { http: { method: 'POST', sourceIp: ip } },
    body: JSON.stringify(body),
  }) as unknown as APIGatewayProxyEventV2

beforeEach(() => {
  mockSend.mockReset()
  delete process.env.TURNSTILE_SECRET_KEY
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('verifyTurnstile', () => {
  it('passes through when no secret is configured locally (not in Lambda)', async () => {
    delete process.env.AWS_LAMBDA_FUNCTION_NAME
    expect(await verifyTurnstile('anything', '1.2.3.4')).toBe(true)
  })

  it('fails CLOSED when no secret is configured but running in Lambda', async () => {
    process.env.AWS_LAMBDA_FUNCTION_NAME = 'portfolio-contact'
    expect(await verifyTurnstile('anything', '1.2.3.4')).toBe(false)
    delete process.env.AWS_LAMBDA_FUNCTION_NAME
  })

  it('fails a missing/empty token when a secret is set', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secret'
    expect(await verifyTurnstile('', '1.2.3.4')).toBe(false)
  })

  it('calls siteverify and honors the success flag', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secret'
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ success: true }) })
    vi.stubGlobal('fetch', fetchMock)
    expect(await verifyTurnstile('tok', '1.2.3.4')).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      expect.objectContaining({ method: 'POST' }),
    )

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ success: false }) }))
    expect(await verifyTurnstile('tok', '1.2.3.4')).toBe(false)
  })
})

describe('contact handler', () => {
  it('silently accepts (and drops) a filled honeypot without emailing', async () => {
    const res = (await handler(event({ honeypot: 'bot', name: 'x', email: 'a@b.co', message: 'hi' }))) as {
      statusCode: number
    }
    expect(res.statusCode).toBe(200)
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('rejects with 403 when the CAPTCHA fails', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secret'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ success: false }) }))
    const res = (await handler(
      event({ name: 'Ada', email: 'a@b.co', message: 'hello', turnstileToken: 'bad' }),
    )) as { statusCode: number }
    expect(res.statusCode).toBe(403)
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('returns 429 when the rate-limit condition fails', async () => {
    mockSend.mockRejectedValueOnce(
      Object.assign(new Error('rl'), { name: 'ConditionalCheckFailedException' }),
    )
    const res = (await handler(event({ name: 'Ada', email: 'a@b.co', message: 'hello' }))) as {
      statusCode: number
    }
    expect(res.statusCode).toBe(429)
  })

  it('sends the email on a valid submission', async () => {
    mockSend.mockResolvedValue({})
    const res = (await handler(event({ name: 'Ada', email: 'a@b.co', message: 'hello there' }))) as {
      statusCode: number
    }
    expect(res.statusCode).toBe(200)
    // one DynamoDB rate-limit put
    expect(mockSend).toHaveBeenCalledTimes(1)
  })

  it('rejects invalid input with 400 before any Turnstile/DynamoDB/SES call', async () => {
    for (const bad of [
      { name: '', email: 'a@b.co', message: 'hi' },
      { name: 'Ada', email: 'not-an-email', message: 'hi' },
      { name: 'Ada', email: 'a@b.co', message: '' },
      { name: 'Ada', email: 'a@b.co', message: 'x'.repeat(5001) },
      { name: 'Ada', email: { obj: true }, message: 'hi' },
    ]) {
      mockSend.mockClear()
      const res = (await handler(event(bad))) as { statusCode: number }
      expect(res.statusCode).toBe(400)
      expect(mockSend).not.toHaveBeenCalled()
    }
  })

  it('returns 400 on a malformed JSON body', async () => {
    const res = (await handler({
      requestContext: { http: { method: 'POST', sourceIp: '9.9.9.9' } },
      body: '{not json',
    } as unknown as import('aws-lambda').APIGatewayProxyEventV2)) as { statusCode: number }
    expect(res.statusCode).toBe(400)
  })
})

describe('validateContact', () => {
  it('accepts a normal submission and trims', () => {
    expect(validateContact({ name: ' Ada ', email: ' a@b.co ', message: ' hi ' })).toEqual({
      valid: true,
      name: 'Ada',
      email: 'a@b.co',
      message: 'hi',
    })
  })
  it('rejects bad name/email/message', () => {
    expect(validateContact({ name: '', email: 'a@b.co', message: 'x' }).valid).toBe(false)
    expect(validateContact({ name: 'A', email: 'nope', message: 'x' }).valid).toBe(false)
    expect(validateContact({ name: 'A', email: 'a@b.co', message: '' }).valid).toBe(false)
    expect(validateContact({ name: 123, email: 'a@b.co', message: 'x' }).valid).toBe(false)
  })
})
