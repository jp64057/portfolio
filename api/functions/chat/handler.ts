import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import Anthropic from '@anthropic-ai/sdk'
import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TABLE } from '../../shared/dynamo.js'
import { ok, err } from '../../shared/response.js'
import { clientIp } from '../../shared/request.js'

// Model is env-configurable. Defaults to Haiku 4.5 (cheapest/fastest); set
// CHAT_MODEL to claude-opus-4-8 for a more capable (pricier) résumé bot.
const MODEL = process.env.CHAT_MODEL ?? 'claude-haiku-4-5'
const MAX_TOKENS = 512
const RATE_WINDOW_SEC = 3600
const RATE_MAX = 10 // messages per IP per hour
const MAX_HISTORY = 12
const MAX_CONTENT = 4000
// Hard monthly token cap (input + output) across all users, to protect cost.
const MONTHLY_TOKEN_CAP = Number(process.env.CHAT_MONTHLY_TOKEN_CAP ?? 1_000_000)

const SYSTEM_PROMPT = `You are "Ask my résumé", an assistant embedded on Jacob Prue's portfolio site (jacob.prue.info). You answer questions about Jacob's professional background, skills, and projects.

About Jacob:
- Full-Stack & Cloud Engineer.
- Builds scalable, cloud-native systems with React, Next.js, Node.js, TypeScript, and AWS.
- Focus on infrastructure as code (Terraform), type safety, serverless (AWS Lambda, API Gateway, DynamoDB, S3, CloudFront), and CI/CD (GitHub Actions with OIDC).
- Featured project: this portfolio itself — a Next.js static site on S3 + CloudFront with a serverless API (Lambda + DynamoDB + SES), all provisioned in Terraform and deployed via GitHub Actions.

Guidelines:
- Only answer questions about Jacob's experience, skills, and projects. For anything off-topic (general knowledge, coding help, unrelated chit-chat), politely decline and steer back to Jacob's background.
- Be concise and friendly. Respond directly with the final answer — no preamble and no meta-commentary about your reasoning.
- If you don't know a specific detail, say so and suggest the contact form or downloading the résumé.`

const FALLBACK_UNCONFIGURED =
  "The résumé chatbot isn't fully set up yet. In the meantime, feel free to use the contact form or download the résumé."
const FALLBACK_CAP =
  "I've hit my usage limit for this month — please reach out via the contact form and Jacob will get back to you."
const FALLBACK_ERROR = 'Sorry, I ran into a problem answering that. Please try again in a moment.'

type ChatMessage = { role: 'user' | 'assistant'; content: string }

function isConditionalCheckFailed(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { name?: string }).name === 'ConditionalCheckFailedException'
}

// Sliding-window per-IP rate limit: RATE_MAX requests per RATE_WINDOW_SEC.
async function checkRateLimit(ip: string): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000)
  try {
    const res = await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: `chat_rl::${ip}`, SK: 'rl' },
        UpdateExpression: 'ADD #n :one SET #ttl = if_not_exists(#ttl, :ttl)',
        ConditionExpression: 'attribute_not_exists(#n) OR #n < :max OR #ttl < :now',
        ExpressionAttributeNames: { '#n': 'n', '#ttl': 'ttl' },
        ExpressionAttributeValues: {
          ':one': 1,
          ':max': RATE_MAX,
          ':now': now,
          ':ttl': now + RATE_WINDOW_SEC,
        },
        ReturnValues: 'ALL_NEW',
      }),
    )
    // If the window had expired, the counter kept climbing; reset it lazily.
    const item = res.Attributes
    if (item && Number(item.ttl) < now) {
      await ddb.send(
        new PutCommand({
          TableName: TABLE,
          Item: { PK: `chat_rl::${ip}`, SK: 'rl', n: 1, ttl: now + RATE_WINDOW_SEC },
        }),
      )
    }
    return true
  } catch (e) {
    if (isConditionalCheckFailed(e)) return false
    throw e
  }
}

function monthKey(): string {
  return new Date().toISOString().slice(0, 7) // YYYY-MM
}

async function underMonthlyCap(): Promise<boolean> {
  const res = await ddb.send(
    new GetCommand({ TableName: TABLE, Key: { PK: `chat_usage::${monthKey()}`, SK: 'total' } }),
  )
  const used = Number(res.Item?.tokens ?? 0)
  return used < MONTHLY_TOKEN_CAP
}

async function recordUsage(tokens: number): Promise<void> {
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: `chat_usage::${monthKey()}`, SK: 'total' },
      UpdateExpression: 'ADD #t :tok',
      ExpressionAttributeNames: { '#t': 'tokens' },
      ExpressionAttributeValues: { ':tok': tokens },
    }),
  )
}

// Sanitize the client's message history into a valid, bounded transcript.
export function sanitizeMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return []
  const cleaned: ChatMessage[] = []
  for (const m of raw) {
    const role = (m as { role?: unknown }).role
    const content = (m as { content?: unknown }).content
    if ((role === 'user' || role === 'assistant') && typeof content === 'string' && content.trim()) {
      cleaned.push({ role, content: content.slice(0, MAX_CONTENT) })
    }
  }
  // Keep the last MAX_HISTORY, and ensure the transcript starts with a user turn.
  const tail = cleaned.slice(-MAX_HISTORY)
  while (tail.length && tail[0].role !== 'user') tail.shift()
  return tail
}

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const messages = sanitizeMessages(JSON.parse(event.body ?? '{}').messages)
  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    return err('A user message is required', 400)
  }

  const ip = clientIp(event)

  try {
    if (!(await checkRateLimit(ip))) {
      return err('You are sending messages too quickly — please slow down.', 429)
    }

    // Graceful degradation: unconfigured key or exhausted monthly budget.
    if (!process.env.ANTHROPIC_API_KEY) {
      return ok({ reply: FALLBACK_UNCONFIGURED, fallback: true })
    }
    if (!(await underMonthlyCap())) {
      return ok({ reply: FALLBACK_CAP, fallback: true })
    }

    const client = new Anthropic()
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages,
    })

    const usage = response.usage
    void recordUsage((usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0)).catch(() => {})

    const reply = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim()

    return ok({ reply: reply || FALLBACK_ERROR })
  } catch (e) {
    console.error('chat handler failed', e)
    // Never surface raw errors to visitors — degrade gracefully.
    return ok({ reply: FALLBACK_ERROR, fallback: true })
  }
}
