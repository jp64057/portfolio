import type { Metadata } from 'next'

// The /stats page is a client component and can't export metadata itself,
// so this route-level layout supplies its SEO tags.
export const metadata: Metadata = {
  title: 'Site stats',
  description:
    'Live, privacy-friendly traffic for jacob.prue.info — page views aggregated from DynamoDB by an AWS Lambda. No cookies, no third-party trackers.',
  alternates: { canonical: '/stats/' },
}

export default function StatsLayout({ children }: { children: React.ReactNode }) {
  return children
}
