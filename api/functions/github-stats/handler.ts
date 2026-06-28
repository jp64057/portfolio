import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TABLE } from '../../shared/dynamo.js'
import { ok, err } from '../../shared/response.js'

const GITHUB_USERNAME = 'jp64057'
const CACHE_TTL_SECONDS = 900

interface RepoData {
  language: string | null
  stargazers_count: number
  size: number
}

export const handler = async (_event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const cacheKey = { PK: 'github_stats::cache', SK: 'v1' }

  // Return cached result if still fresh
  const cached = await ddb.send(new GetCommand({ TableName: TABLE, Key: cacheKey }))
  if (cached.Item && cached.Item.ttl > Math.floor(Date.now() / 1000)) {
    return ok(cached.Item.data)
  }

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (process.env.GITHUB_PAT) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_PAT}`
  }

  const [userRes, reposRes] = await Promise.all([
    fetch(`https://api.github.com/users/${GITHUB_USERNAME}`, { headers }),
    fetch(`https://api.github.com/users/${GITHUB_USERNAME}/repos?per_page=100&type=owner`, { headers }),
  ])

  if (!userRes.ok || !reposRes.ok) return err('GitHub API error', 502)

  const user = await userRes.json() as { public_repos: number; followers: number }
  const repos = await reposRes.json() as RepoData[]

  const totalStars = repos.reduce((sum, r) => sum + r.stargazers_count, 0)

  // Aggregate bytes per language
  const langBytes: Record<string, number> = {}
  for (const repo of repos) {
    if (repo.language) {
      langBytes[repo.language] = (langBytes[repo.language] ?? 0) + repo.size
    }
  }
  const totalBytes = Object.values(langBytes).reduce((a, b) => a + b, 0)
  const topLanguages = Object.entries(langBytes)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, bytes]) => ({ name, pct: Math.round((bytes / totalBytes) * 100) }))

  const data = {
    publicRepos: user.public_repos as number,
    followers: user.followers as number,
    totalStars,
    topLanguages,
  }

  const ttl = Math.floor(Date.now() / 1000) + CACHE_TTL_SECONDS
  await ddb.send(new PutCommand({ TableName: TABLE, Item: { ...cacheKey, data, ttl } }))

  return ok(data)
}
