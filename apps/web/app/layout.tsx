import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ThemeProvider } from '@/components/ThemeProvider'
import { Nav } from '@/components/Nav'
import { Footer } from '@/components/Footer'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

const SITE_URL = 'https://jacob.prue.info'
const DESCRIPTION =
  'Full-stack engineer building scalable, cloud-native systems with React, Node.js, and AWS — with a focus on infrastructure as code, type safety, and shipping reliable software.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Jacob Prue — Full-Stack & Cloud Engineer',
    template: '%s · Jacob Prue',
  },
  description: DESCRIPTION,
  keywords: [
    'Jacob Prue',
    'full-stack engineer',
    'cloud engineer',
    'AWS',
    'serverless',
    'Next.js',
    'TypeScript',
    'Terraform',
    'React',
    'Node.js',
  ],
  authors: [{ name: 'Jacob Prue', url: SITE_URL }],
  creator: 'Jacob Prue',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'Jacob Prue',
    title: 'Jacob Prue — Full-Stack & Cloud Engineer',
    description: DESCRIPTION,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Jacob Prue — Full-Stack & Cloud Engineer',
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Person',
      '@id': `${SITE_URL}/#person`,
      name: 'Jacob Prue',
      url: SITE_URL,
      jobTitle: 'Full-Stack & Cloud Engineer',
      sameAs: ['https://github.com/jp64057'],
      knowsAbout: ['React', 'Next.js', 'Node.js', 'AWS', 'Terraform', 'TypeScript', 'Serverless'],
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: 'Jacob Prue',
      description: DESCRIPTION,
      publisher: { '@id': `${SITE_URL}/#person` },
    },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geist.variable} ${geistMono.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Nav />
          <main className="min-h-screen">{children}</main>
          <Footer />
        </ThemeProvider>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  )
}
