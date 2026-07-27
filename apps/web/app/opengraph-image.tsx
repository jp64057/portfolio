import { renderOg, ogSize, ogContentType } from './_og/og'

// Generated statically at build (required for output: export).
export const dynamic = 'force-static'

export const alt = 'Jacob Prue — Full-Stack & Cloud Engineer'
export const size = ogSize
export const contentType = ogContentType

export default function Image() {
  return renderOg({
    command: 'whoami',
    title: 'Jacob Prue',
    subtitle: 'Full-Stack & Cloud Engineer',
    tags: ['Next.js', 'AWS', 'TypeScript', 'Terraform'],
  })
}
