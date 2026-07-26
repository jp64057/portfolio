import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TABLE } from '../../shared/dynamo.js'
import { ok, err } from '../../shared/response.js'

const GITHUB_USERNAME = 'jp64057'
const CACHE_TTL_SECONDS = 300 // 5 min — keeps us well within the GitHub rate limit

export interface NowData {
  // Most recent public push, if any.
  latestCommit: { repo: string; message: string; url: string; at: string } | null
  fetchedAt: string
}

// Pull the newest commit out of the user's public GitHub event stream.
export async function computeNow(): Promise<NowData> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (process.env.GITHUB_PAT) headers['Authorization'] = `Bearer ${process.env.GITHUB_PAT}`

  const res = await fetch(
    `https://api.github.com/users/${GITHUB_USERNAME}/events/public?per_page=30`,
    { headers },
  )
  if (!res.ok) throw new Error(`GitHub events API ${res.status}`)

  // The events feed's PushEvent payload carries `head` (the SHA) and `ref`, but
  // often NOT a `commits` array — so we take the head SHA and, when the message
  // isn't inlined, fetch the commit to get its message.
  const events = (await res.json()) as Array<{
    type: string
    created_at: string
    repo: { name: string }
    payload: { head?: string; ref?: string; commits?: { message: string; sha: string }[] }
  }>

  const push = events.find((e) => e.type === 'PushEvent' && (e.payload.head || e.payload.commits?.length))
  let latestCommit: NowData['latestCommit'] = null
  if (push) {
    const inlined = push.payload.commits?.[push.payload.commits.length - 1]
    const sha = inlined?.sha ?? push.payload.head ?? ''
    const repoFull = push.repo.name

    let message = inlined?.message ?? ''
    if (!message && sha) {
      // Fetch the commit for its message (repo is public; cached upstream anyway).
      try {
        const cRes = await fetch(`https://api.github.com/repos/${repoFull}/commits/${sha}`, { headers })
        if (cRes.ok) {
          const c = (await cRes.json()) as { commit?: { message?: string } }
          message = c.commit?.message ?? ''
        }
      } catch {
        /* leave message empty — we still show the repo + link */
      }
    }

    latestCommit = {
      repo: repoFull.replace(`${GITHUB_USERNAME}/`, ''),
      message: (message.split('\n')[0] || 'pushed changes').slice(0, 100),
      url: sha ? `https://github.com/${repoFull}/commit/${sha}` : `https://github.com/${repoFull}`,
      at: push.created_at,
    }
  }

  return { latestCommit, fetchedAt: new Date().toISOString() }
}

export const handler = async (_event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const cacheKey = { PK: 'now::cache', SK: 'v1' }
  try {
    const cached = await ddb.send(new GetCommand({ TableName: TABLE, Key: cacheKey }))
    if (cached.Item && cached.Item.ttl > Math.floor(Date.now() / 1000)) {
      return ok(cached.Item.data)
    }

    const data = await computeNow()
    const ttl = Math.floor(Date.now() / 1000) + CACHE_TTL_SECONDS
    await ddb.send(new PutCommand({ TableName: TABLE, Item: { ...cacheKey, data, ttl } }))
    return ok(data)
  } catch (e) {
    console.error('now handler failed', e)
    // On any failure, surface an empty payload so the widget just hides itself.
    return err('Failed to load activity', 502)
  }
}
