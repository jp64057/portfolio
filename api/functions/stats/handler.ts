import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TABLE } from '../../shared/dynamo.js'
import { ok, err } from '../../shared/response.js'

const VISITOR_PREFIX = 'visitor_count::'
const CACHE_TTL_MS = 60_000

export interface Stats {
  totalPageViews: number
  pages: { path: string; views: number }[]
  resumeDownloads: number
  generatedAt: string
}

// Module-scope cache — survives across warm invocations of the same container,
// so bursts of traffic to /stats don't hammer DynamoDB.
let cache: { data: Stats; expires: number } | null = null

export async function computeStats(): Promise<Stats> {
  // Visitor counts live under a distinct PK per page (visitor_count::<page>),
  // so they can't be Queried together — Scan with a prefix filter instead.
  // The table is tiny; a filtered Scan is the right tool here.
  const pages: { path: string; views: number }[] = []
  let totalPageViews = 0
  let lastKey: Record<string, unknown> | undefined

  do {
    const res = await ddb.send(
      new ScanCommand({
        TableName: TABLE,
        FilterExpression: 'begins_with(PK, :prefix)',
        ExpressionAttributeValues: { ':prefix': VISITOR_PREFIX },
        ExclusiveStartKey: lastKey,
      })
    )
    for (const item of res.Items ?? []) {
      const path = String(item.PK).slice(VISITOR_PREFIX.length) || '/'
      const views = Number(item.count) || 0
      pages.push({ path, views })
      totalPageViews += views
    }
    lastKey = res.LastEvaluatedKey
  } while (lastKey)

  pages.sort((a, b) => b.views - a.views)

  // Résumé downloads are one item per event under a shared PK — count them
  // without pulling the (IP-bearing) items back over the wire.
  const dl = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': 'resume_download' },
      Select: 'COUNT',
    })
  )

  return {
    totalPageViews,
    pages,
    resumeDownloads: dl.Count ?? 0,
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
