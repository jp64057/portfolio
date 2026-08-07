import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TABLE } from '../../shared/dynamo.js'
import { ok, err } from '../../shared/response.js'

// `page` becomes part of the DynamoDB partition key (visitor_count::<page>), so
// it MUST be bounded: without this, arbitrary/random values let anyone create
// unbounded distinct items, forging counts and inflating the cost of the
// /api/stats table scan. The frontend only ever sends a Next.js pathname
// (usePathname()), e.g. "/" or "/stats" — this pattern accepts those and
// rejects everything else. See issue #98.
const PAGE_RE = /^\/[A-Za-z0-9/_-]{0,64}$/

export function validatePage(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  return PAGE_RE.test(raw) ? raw : null
}

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  let body: { page?: unknown }
  try {
    body = JSON.parse(event.body ?? '{}')
  } catch {
    return err('Invalid request body', 400)
  }

  // Default to "/" when omitted; reject anything that isn't a valid path.
  const page = event.body && 'page' in body ? validatePage(body.page) : '/'
  if (page === null) return err('Invalid page', 400)

  // Primary per-page counter (source of the "N views on this page" footer).
  const primary = new UpdateCommand({
    TableName: TABLE,
    Key: { PK: `visitor_count::${page}`, SK: 'count' },
    UpdateExpression: 'ADD #count :one',
    ExpressionAttributeNames: { '#count': 'count' },
    ExpressionAttributeValues: { ':one': 1 },
    ReturnValues: 'UPDATED_NEW',
  })
  // Mirror into a shared-PK aggregate so /api/stats can Query all pages at once
  // instead of Scanning the whole table (issue #99). Best-effort: never fail a
  // visit if the aggregate write hiccups.
  const aggregate = new UpdateCommand({
    TableName: TABLE,
    Key: { PK: 'stats', SK: `page::${page}` },
    UpdateExpression: 'ADD #views :one',
    ExpressionAttributeNames: { '#views': 'views' },
    ExpressionAttributeValues: { ':one': 1 },
  })

  const [result] = await Promise.all([
    ddb.send(primary),
    ddb.send(aggregate).catch((e) => console.error('stats aggregate update failed', e)),
  ])

  const count = (result.Attributes?.count as number) ?? 1
  return ok({ count })
}
