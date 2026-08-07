import Link from 'next/link'
import { JpMark } from '@/components/JpMark'

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <JpMark size={80} spin={16} radius="16px" label="Jacob Prue monogram" className="mb-2" />
      <p className="font-mono text-5xl font-bold text-[hsl(var(--muted-foreground))]">404</p>
      <p className="text-lg">Page not found.</p>
      <Link href="/" className="text-[hsl(var(--accent))] underline underline-offset-4">
        Go home
      </Link>
    </div>
  )
}
