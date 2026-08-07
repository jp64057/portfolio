import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { randomUUID } from 'node:crypto'
import { PutCommand, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TABLE } from '../../shared/dynamo.js'
import { ok, err } from '../../shared/response.js'
import { clientIp } from '../../shared/request.js'

const PK = 'guestbook'
const ENTRY_PREFIX = 'entry::'
export const MAX_NAME = 50
export const MAX_MESSAGE = 280
const LIST_LIMIT = 100
const RATE_WINDOW_SEC = 60

// Cheap first-pass profanity guard — deliberately small, not exhaustive.
const BLOCKLIST = ['fuck', 'shit', 'bitch', 'cunt', 'asshole', 'nigger', 'faggot']

const autoApprove = () => (process.env.GUESTBOOK_AUTO_APPROVE ?? 'true') !== 'false'
const adminToken = () => process.env.GUESTBOOK_ADMIN_TOKEN ?? ''

export interface GuestbookEntry {
  id: string
  name: string
  message: string
  createdAt: string
}

export type Validation =
  | { valid: true; name: string; message: string }
  | { valid: false; error: string; status: number }

export function containsProfanity(text: string): boolean {
  const lower = text.toLowerCase()
  return BLOCKLIST.some((w) => new RegExp(`\\b${w}\\b`).test(lower))
}

export function validateSubmission(input: {
  name?: unknown
  message?: unknown
  honeypot?: unknown
}): Validation {
  // Honeypot: a hidden field only bots fill. Treat as spam, but don't reveal why.
  if (typeof input.honeypot === 'string' && input.honeypot.length > 0) {
    return { valid: false, error: 'Rejected', status: 400 }
  }
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  const message = typeof input.message === 'string' ? input.message.trim() : ''
  if (name.length < 1 || name.length > MAX_NAME) {
    return { valid: false, error: `Name must be 1–${MAX_NAME} characters`, status: 400 }
  }
  if (message.length < 1 || message.length > MAX_MESSAGE) {
    return { valid: false, error: `Message must be 1–${MAX_MESSAGE} characters`, status: 400 }
  }
  if (containsProfanity(`${name} ${message}`)) {
    return { valid: false, error: 'Please keep it civil — message rejected', status: 400 }
  }
  return { valid: true, name, message }
}

function isConditionalCheckFailed(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { name?: string }).name === 'ConditionalCheckFailedException'
}

async function listEntries(): Promise<APIGatewayProxyResultV2> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: { ':pk': PK, ':prefix': ENTRY_PREFIX },
      ScanIndexForward: false, // newest first (SK embeds the ISO timestamp)
      Limit: LIST_LIMIT,
    }),
  )
  const entries: GuestbookEntry[] = (res.Items ?? [])
    .filter((i) => i.approved !== false) // hide unapproved when moderation is on
    .map((i) => ({
      id: String(i.id),
      name: String(i.name),
      message: String(i.message),
      createdAt: String(i.createdAt),
    }))
  return ok({ entries })
}

async function createEntry(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const body = JSON.parse(event.body ?? '{}')
  const check = validateSubmission(body)
  if (!check.valid) return err(check.error, check.status)

  // Per-IP rate limit. `expiresAt` gates the logical window so a lagging TTL
  // sweep can't lock a visitor out beyond the window; `ttl` is just cleanup.
  const ip = clientIp(event)
  const now = Math.floor(Date.now() / 1000)
  try {
    await ddb.send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          PK: `guestbook_rl::${ip}`,
          SK: 'rl',
          expiresAt: now + RATE_WINDOW_SEC,
          ttl: now + RATE_WINDOW_SEC + 3600,
        },
        ConditionExpression: 'attribute_not_exists(PK) OR expiresAt < :now',
        ExpressionAttributeValues: { ':now': now },
      }),
    )
  } catch (e) {
    if (isConditionalCheckFailed(e)) return err('You are posting too fast — try again shortly.', 429)
    throw e
  }

  const id = randomUUID()
  const createdAt = new Date().toISOString()
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        PK,
        SK: `${ENTRY_PREFIX}${createdAt}::${id}`,
        id,
        name: check.name,
        message: check.message,
        createdAt,
        approved: autoApprove(),
      },
    }),
  )

  const entry: GuestbookEntry = { id, name: check.name, message: check.message, createdAt }
  return ok({ entry, pending: !autoApprove() }, 201)
}

async function deleteEntry(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const token = adminToken()
  if (!token) return err('Deletion is disabled', 403)
  const provided = event.headers?.['x-admin-token'] ?? event.headers?.['X-Admin-Token']
  if (provided !== token) return err('Unauthorized', 401)

  const { id, createdAt } = JSON.parse(event.body ?? '{}')
  if (!id || !createdAt) return err('id and createdAt are required', 400)

  await ddb.send(
    new DeleteCommand({ TableName: TABLE, Key: { PK, SK: `${ENTRY_PREFIX}${createdAt}::${id}` } }),
  )
  return ok({ deleted: true })
}

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  const method = event.requestContext?.http?.method ?? 'GET'
  try {
    switch (method) {
      case 'GET':
        return await listEntries()
      case 'POST':
        return await createEntry(event)
      case 'DELETE':
        return await deleteEntry(event)
      default:
        return err('Method not allowed', 405)
    }
  } catch (e) {
    console.error('guestbook handler failed', e)
    return err('Something went wrong')
  }
}
