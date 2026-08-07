import type { APIGatewayProxyEventV2 } from 'aws-lambda'

// Derive the real visitor IP for rate limiting / CAPTCHA remoteip.
//
// /api/* is served THROUGH CloudFront to the API Gateway origin, so
// `requestContext.http.sourceIp` is the CloudFront edge IP, not the visitor —
// keying per-IP controls on it buckets unrelated users together and never pins
// an abuser to their own IP.
//
// CloudFront always appends the viewer's IP to `X-Forwarded-For` when it
// forwards to the origin, and API Gateway then appends the edge IP. Any
// client-supplied XFF entries are placed to the LEFT of CloudFront's appended
// value, so they can't reach the trusted position. We therefore drop trailing
// entries equal to the immediate source (the edge / APIGW hop) and take the
// last remaining entry — the IP CloudFront actually observed. Falls back to
// sourceIp when no XFF is present (e.g. a direct execute-api call, or local dev).
export function clientIp(event: APIGatewayProxyEventV2): string {
  const src = event.requestContext?.http?.sourceIp ?? 'unknown'
  const xff = event.headers?.['x-forwarded-for']
  if (!xff) return src
  const parts = xff
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  while (parts.length && parts[parts.length - 1] === src) parts.pop()
  return parts.length ? parts[parts.length - 1] : src
}
