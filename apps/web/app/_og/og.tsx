import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'

// Shared renderer for the site's OpenGraph / Twitter cards. Each metadata image
// route (opengraph-image.tsx / twitter-image.tsx) calls renderOg() so every
// card is generated at build with the same terminal-themed look.

export const ogSize = { width: 1200, height: 630 }
export const ogContentType = 'image/png'

const ACCENT = '#4f9cf9'
const BG = '#0a0f1e'
const PANEL = '#111a2e'
const BORDER = '#24314d'
const FG = '#e8eef9'
const MUTED = '#93a4c3'

// Fonts are read from the source tree at build (the metadata image route runs
// in Node during `next export`; cwd is the web app root). Reading from cwd is
// more reliable here than fetch()/import.meta.url, which don't resolve against
// an origin during static prerender.
const FONT_DIR = join(process.cwd(), 'app/_og/fonts')
function ogFonts() {
  return [
    {
      name: 'DejaVu Sans Mono',
      data: readFileSync(join(FONT_DIR, 'DejaVuSansMono.ttf')),
      weight: 400 as const,
      style: 'normal' as const,
    },
    {
      name: 'DejaVu Sans Mono',
      data: readFileSync(join(FONT_DIR, 'DejaVuSansMono-Bold.ttf')),
      weight: 700 as const,
      style: 'normal' as const,
    },
  ]
}

export async function renderOg(opts: { command: string; title: string; subtitle: string; tags?: string[] }) {
  const { command, title, subtitle, tags = [] } = opts
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: BG,
          padding: 64,
          fontFamily: 'DejaVu Sans Mono',
          color: FG,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            border: `1px solid ${BORDER}`,
            borderRadius: 20,
            background: PANEL,
            padding: 56,
          }}
        >
          {/* window chrome */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 36 }}>
            <div style={{ width: 18, height: 18, borderRadius: 9, background: '#ff5f56' }} />
            <div style={{ width: 18, height: 18, borderRadius: 9, background: '#ffbd2e' }} />
            <div style={{ width: 18, height: 18, borderRadius: 9, background: '#27c93f' }} />
          </div>

          <div style={{ display: 'flex', fontSize: 28, color: ACCENT }}>
            {`visitor@jacob.prue.info:~$ ${command}`}
          </div>

          <div style={{ display: 'flex', fontSize: 84, fontWeight: 700, marginTop: 20, lineHeight: 1.05 }}>
            {title}
          </div>

          <div style={{ display: 'flex', fontSize: 34, color: MUTED, marginTop: 18 }}>{subtitle}</div>

          {tags.length > 0 && (
            <div style={{ display: 'flex', gap: 14, marginTop: 36, flexWrap: 'wrap' }}>
              {tags.map((t) => (
                <div
                  key={t}
                  style={{
                    display: 'flex',
                    border: `1px solid ${BORDER}`,
                    borderRadius: 8,
                    padding: '8px 16px',
                    fontSize: 24,
                    color: MUTED,
                  }}
                >
                  {t}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', marginTop: 28, fontSize: 24, color: MUTED }}>jacob.prue.info</div>
      </div>
    ),
    { ...ogSize, fonts: ogFonts() },
  )
}
