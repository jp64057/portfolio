export function ok(body: unknown, status = 200) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN ?? '*',
    },
    body: JSON.stringify(body),
  }
}

export function err(message: string, status = 500) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN ?? '*',
    },
    body: JSON.stringify({ error: message }),
  }
}
