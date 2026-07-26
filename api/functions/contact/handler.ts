import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { PutCommand } from '@aws-sdk/lib-dynamodb'
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'
import { ddb, TABLE } from '../../shared/dynamo.js'
import { ok, err } from '../../shared/response.js'

const ses = new SESClient({ region: 'us-east-1' })
const FROM = process.env.SES_FROM_ADDRESS ?? ''
const TO = process.env.SES_TO_ADDRESS ?? ''
const RATE_WINDOW_SEC = 3600 // one submission per hour per IP

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

// Verify a Cloudflare Turnstile token server-side. If no secret is configured
// (local/dev), verification is skipped so the form still works.
export async function verifyTurnstile(token: unknown, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY ?? ''
  if (!secret) return true
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

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const body = JSON.parse(event.body ?? '{}')
  const { name, email, message, honeypot, turnstileToken } = body

  // Bot trap: honeypot should always be empty for real users. Ack silently so
  // bots don't learn they were filtered.
  if (honeypot) return ok({ received: true })

  const ip = event.requestContext.http.sourceIp

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

  return ok({ received: true })
}
