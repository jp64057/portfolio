import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { PutCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TABLE } from '../../shared/dynamo.js'
import { ok } from '../../shared/response.js'

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const country = event.headers['cloudfront-viewer-country'] ?? 'unknown'
  const timestamp = new Date().toISOString()

  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        PK: 'resume_download',
        SK: timestamp,
        country,
        ip: event.requestContext.http.sourceIp,
      },
    })
  )

  return ok({ logged: true })
}
