import type { MetadataRoute } from 'next'

// Static export: emit a plain sitemap.xml at build time.
export const dynamic = 'force-static'

const SITE_URL = 'https://jacob.prue.info'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: 'monthly', priority: 1 },
    { url: `${SITE_URL}/stats/`, changeFrequency: 'weekly', priority: 0.5 },
  ]
}
