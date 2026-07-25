import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ThemeProvider } from '@/components/ThemeProvider'
import { Nav } from '@/components/Nav'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

export const metadata: Metadata = {
  title: 'Jacob Prue — Software Engineer',
  description: 'Full-stack engineer specializing in React, Node.js, and AWS infrastructure.',
  openGraph: {
    title: 'Jacob Prue — Software Engineer',
    description: 'Full-stack engineer specializing in React, Node.js, and AWS infrastructure.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geist.variable} ${geistMono.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Nav />
          <main className="min-h-screen">{children}</main>
          <footer className="border-t border-[hsl(var(--border))] py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
            Built with Next.js · Deployed on AWS · Infrastructure as Code with Terraform
          </footer>
        </ThemeProvider>
      </body>
    </html>
  )
}
