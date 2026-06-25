import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'
import { ddb, TABLE } from '../../shared/dynamo.js'
import { ok, err } from '../../shared/response.js'

const ses = new SESClient({ region: 'us-east-1' })
const FROM = process.env.SES_FROM_ADDRESS ?? ''
const TO = process.env.SES_TO_ADDRESS ?? ''

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const body = JSON.parse(event.body ?? '{}')
  const { name, email, message, honeypot } = body

  // Bot trap: honeypot field should always be empty for real users
  if (honeypot) return ok({ received: true })

  const ip = event.requestContext.http.sourceIp

  // IP rate limit: one submission per hour per IP
  const existing = await ddb.send(
    new GetCommand({ TableName: TABLE, Key: { PK: `rate_limit::${ip}`, SK: 'contact' } })
  )
  if (existing.Item) return err('Too many requests', 429)

  const ttl = Math.floor(Date.now() / 1000) + 3600
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: { PK: `rate_limit::${ip}`, SK: 'contact', ttl },
    })
  )

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
    })
  )

  return ok({ received: true })
}
