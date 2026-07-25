import type { MetadataRoute } from 'next'

// Static export: emit a plain robots.txt at build time.
export const dynamic = 'force-static'

const SITE_URL = 'https://jacob.prue.info'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
