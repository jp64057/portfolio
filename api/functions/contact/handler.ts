import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { PutCommand } from '@aws-sdk/lib-dynamodb'
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'
import { ddb, TABLE } from '../../shared/dynamo.js'
import { ok, err } from '../../shared/response.js'
import { clientIp } from '../../shared/request.js'

const ses = new SESClient({ region: 'us-east-1' })
const FROM = process.env.SES_FROM_ADDRESS ?? ''
const TO = process.env.SES_TO_ADDRESS ?? ''
const RATE_WINDOW_SEC = 3600 // one submission per hour per IP

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

// Verify a Cloudflare Turnstile token server-side. If no secret is configured
// (local/dev), verification is skipped so the form still works.
export async function verifyTurnstile(token: unknown, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY ?? ''
  if (!secret) {
    // Fail CLOSED in a real deployment: if the secret is somehow unset in
    // Lambda, reject rather than silently letting every submission through.
    // Only skip verification locally (sam local / unit tests), where the
    // function name env var is absent. (issue #111)
    if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
      console.error('TURNSTILE_SECRET_KEY is unset in Lambda — failing closed')
      return false
    }
    return true
  }
  if (typeof token !== 'string' || token.length === 0) return false
  try {
    const form = new URLSearchParams({ secret, response: token, remoteip: ip })
    const res = await fetch(SITEVERIFY_URL, { method: 'POST', body: form })
    const data = (await res.json()) as { success?: boolean }
    return data.success === true
  } catch (e) {
    console.error('turnstile verification error', e)
    return false
  }
}

export const MAX_NAME = 100
export const MAX_MESSAGE = 5000
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type ContactValidation =
  | { valid: true; name: string; email: string; message: string }
  | { valid: false; error: string }

// Validate + normalize the submission. Length caps stop multi-megabyte emails;
// type checks stop non-string fields from throwing inside SES. (issue #112)
export function validateContact(body: {
  name?: unknown
  email?: unknown
  message?: unknown
}): ContactValidation {
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (name.length < 1 || name.length > MAX_NAME) {
    return { valid: false, error: `Name must be 1–${MAX_NAME} characters` }
  }
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return { valid: false, error: 'A valid email is required' }
  }
  if (message.length < 1 || message.length > MAX_MESSAGE) {
    return { valid: false, error: `Message must be 1–${MAX_MESSAGE} characters` }
  }
  return { valid: true, name, email, message }
}

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  let body: { honeypot?: unknown; turnstileToken?: unknown; name?: unknown; email?: unknown; message?: unknown }
  try {
    body = JSON.parse(event.body ?? '{}')
  } catch {
    return err('Invalid request body', 400)
  }
  const { honeypot, turnstileToken } = body

  // Bot trap: honeypot should always be empty for real users. Ack silently so
  // bots don't learn they were filtered.
  if (honeypot) return ok({ received: true })

  const check = validateContact(body)
  if (!check.valid) return err(check.error, 400)
  const { name, email, message } = check

  const ip = clientIp(event)

  // CAPTCHA: verify before consuming the IP's rate-limit slot, so a legit user
  // who fails/expires the challenge can retry.
  if (!(await verifyTurnstile(turnstileToken, ip))) {
    return err('CAPTCHA verification failed — please try again.', 403)
  }

  // Per-IP rate limit. The expiresAt gate enforces the window even if the TTL
  // sweep lags; the conditional write also closes the check-then-write race.
  const now = Math.floor(Date.now() / 1000)
  try {
    await ddb.send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          PK: `rate_limit::${ip}`,
          SK: 'contact',
          expiresAt: now + RATE_WINDOW_SEC,
          ttl: now + RATE_WINDOW_SEC + 3600,
        },
        ConditionExpression: 'attribute_not_exists(PK) OR expiresAt < :now',
        ExpressionAttributeValues: { ':now': now },
      }),
    )
  } catch (e) {
    if (typeof e === 'object' && e !== null && (e as { name?: string }).name === 'ConditionalCheckFailedException') {
      return err('Too many requests', 429)
    }
    throw e
  }

  try {
    await ses.send(
      new SendEmailCommand({
        Source: FROM,
        ReplyToAddresses: [email],
        Destination: { ToAddresses: [TO] },
        Message: {
          Subject: { Data: `Portfolio contact from ${name}` },
          Body: {
            Text: {
              Data: `From: ${name} <${email}>\n\n${message}`,
            },
          },
        },
      }),
    )
  } catch (e) {
    console.error('contact SES send failed', e)
    return err('Could not send your message right now — please try again later.')
  }

  return ok({ received: true })
}
