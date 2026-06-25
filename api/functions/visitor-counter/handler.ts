import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TABLE } from '../../shared/dynamo.js'
import { ok, err } from '../../shared/response.js'

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const body = JSON.parse(event.body ?? '{}')
  const page: string = body.page ?? '/'

  const result = await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: `visitor_count::${page}`, SK: 'count' },
      UpdateExpression: 'ADD #count :one',
      ExpressionAttributeNames: { '#count': 'count' },
      ExpressionAttributeValues: { ':one': 1 },
      ReturnValues: 'UPDATED_NEW',
    })
  )

  const count = (result.Attributes?.count as number) ?? 1
  return ok({ count })
}
