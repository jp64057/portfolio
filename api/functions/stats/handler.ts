import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { QueryCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TABLE } from '../../shared/dynamo.js'
import { ok, err } from '../../shared/response.js'

// Per-page view aggregates live under a single shared partition (PK='stats',
// SK='page::<path>'), maintained by the visitor-counter Lambda. That lets us
// Query them together instead of Scanning the whole shared table — cost is
// O(pages) regardless of how large the table grows. See issue #99.
const STATS_PK = 'stats'
const PAGE_PREFIX = 'page::'
const CACHE_TTL_MS = 60_000

export interface Stats {
  totalPageViews: number
  pages: { path: string; views: number }[]
  generatedAt: string
}

// Module-scope cache — survives across warm invocations of the same container,
// so bursts of traffic to /stats don't hammer DynamoDB.
let cache: { data: Stats; expires: number } | null = null

export async function computeStats(): Promise<Stats> {
  const pages: { path: string; views: number }[] = []
  let totalPageViews = 0
  let lastKey: Record<string, unknown> | undefined

  // Query only the aggregate partition (paginate defensively; the set is small).
  do {
    const res = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: { ':pk': STATS_PK, ':prefix': PAGE_PREFIX },
        ExclusiveStartKey: lastKey,
      })
    )
    for (const item of res.Items ?? []) {
      const path = String(item.SK).slice(PAGE_PREFIX.length) || '/'
      const views = Number(item.views) || 0
      pages.push({ path, views })
      totalPageViews += views
    }
    lastKey = res.LastEvaluatedKey
  } while (lastKey)

  pages.sort((a, b) => b.views - a.views)

  return {
    totalPageViews,
    pages,
    generatedAt: new Date().toISOString(),
  }
}

export const handler = async (
  _event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    if (!cache || cache.expires < Date.now()) {
      cache = { data: await computeStats(), expires: Date.now() + CACHE_TTL_MS }
    }
    return {
      ...ok(cache.data),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN ?? '*',
        'Cache-Control': 'public, max-age=300',
      },
    }
  } catch (e) {
    console.error('stats handler failed', e)
    return err('Failed to compute stats')
  }
}
