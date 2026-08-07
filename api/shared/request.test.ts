import { describe, it, expect } from 'vitest'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'
import { clientIp } from './request.js'

const ev = (sourceIp: string, xff?: string): APIGatewayProxyEventV2 =>
  ({
    requestContext: { http: { sourceIp } },
    headers: xff === undefined ? {} : { 'x-forwarded-for': xff },
  }) as unknown as APIGatewayProxyEventV2

describe('clientIp', () => {
  it('falls back to sourceIp when no XFF is present', () => {
    expect(clientIp(ev('203.0.113.9'))).toBe('203.0.113.9')
  })

  it('returns the viewer IP CloudFront appended (last non-edge entry)', () => {
    // CloudFront edge = sourceIp = 130.176.0.5; it appended the viewer 198.51.100.7.
    expect(clientIp(ev('130.176.0.5', '198.51.100.7, 130.176.0.5'))).toBe('198.51.100.7')
  })

  it('handles the plain single-hop XFF (no APIGW-appended edge)', () => {
    expect(clientIp(ev('130.176.0.5', '198.51.100.7'))).toBe('198.51.100.7')
  })

  it('ignores client-spoofed entries to the left of CloudFront’s value', () => {
    // Attacker prepended 1.1.1.1; CloudFront still appended the real 198.51.100.7.
    expect(clientIp(ev('130.176.0.5', '1.1.1.1, 198.51.100.7, 130.176.0.5'))).toBe('198.51.100.7')
  })

  it('cannot be tricked by a trailing spoofed edge IP', () => {
    // Attacker ends their XFF with the edge IP; CloudFront + APIGW still append after.
    expect(clientIp(ev('130.176.0.5', '130.176.0.5, 198.51.100.7, 130.176.0.5'))).toBe('198.51.100.7')
  })

  it('returns sourceIp when XFF contains only edge entries', () => {
    expect(clientIp(ev('130.176.0.5', '130.176.0.5'))).toBe('130.176.0.5')
  })
})
