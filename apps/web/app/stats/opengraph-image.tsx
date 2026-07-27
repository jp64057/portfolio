import { renderOg, ogSize, ogContentType } from '../_og/og'

// Generated statically at build (required for output: export).
export const dynamic = 'force-static'

export const alt = 'Site stats — jacob.prue.info'
export const size = ogSize
export const contentType = ogContentType

export default function Image() {
  return renderOg({
    command: 'cat stats.json',
    title: 'Site stats',
    subtitle: 'Live, privacy-friendly traffic — no cookies, no trackers.',
    tags: ['AWS Lambda', 'DynamoDB'],
  })
}
