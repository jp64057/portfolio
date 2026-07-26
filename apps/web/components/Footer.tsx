'use client'

import { usePathname } from 'next/navigation'
import { VisitorCounter } from '@/components/VisitorCounter'
import { NowStrip } from '@/components/NowStrip'

export function Footer() {
  const pathname = usePathname()

  return (
    <footer className="border-t border-[hsl(var(--border))] py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
      <div className="mb-3 flex justify-center">
        <NowStrip />
      </div>
      <p>Built with Next.js · Deployed on AWS · Infrastructure as Code with Terraform</p>
      <p className="mt-2">
        <VisitorCounter page={pathname} />
      </p>
    </footer>
  )
}
