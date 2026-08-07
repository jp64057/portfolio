import type { CSSProperties } from 'react'

// JpMark — Jacob Prue's monogram, ported from the Claude Design canvas.
//
// A "JP" (J stacked over P) extruded through `steps` depth layers into a
// four-sided chrome prism (the face is repeated at 0/90/180/270° so any spin
// angle still shows a JP). It renders STATIC by default and only spins +
// hue-cycles on hover — and never animates for users who prefer reduced motion.
// The animation itself lives in globals.css (@property --jp-h + the jp-spin /
// jp-hue keyframes, gated behind `.jp-mark:hover`); this component only emits
// the layered geometry and the per-instance timing/​colour custom properties.
//
// `color={false}` gives a desaturated monochrome build for tiny sizes.

type JpMarkProps = {
  /** Rendered width in px. */
  size?: number
  /** Rendered height in px (defaults to `size`). */
  height?: number
  /** Spin duration in seconds (hover only). */
  spin?: number
  /** Hue-cycle duration in seconds (hover only). */
  hueCycle?: number
  /** Chrome hue-cycling (true) vs. desaturated monochrome (false). */
  color?: boolean
  /** Box corner radius, any CSS length/percentage. */
  radius?: string
  /** Box background behind the mark. */
  bg?: string
  /** Depth layers. Fewer = lighter DOM; 60 matches the source design. */
  steps?: number
  /** Accessible name. Omit to mark the graphic decorative (aria-hidden). */
  label?: string
  className?: string
  style?: CSSProperties
}

const FACES = [0, 90, 180, 270]
const STAGE = 680 // internal design stage the geometry is authored against
const FONT = 230
const DEPTH = 72

type Layer = { z: number; color: string; glow: string }

function buildLayers(steps: number, color: boolean): Layer[] {
  const hue = color ? 'calc(var(--jp-h) * 1deg)' : '252'
  // In monochrome mode, clamp chroma so the mark reads as brushed metal.
  const c = (k: number) => (color ? k : Math.min(k, 0.018))
  const layers: Layer[] = []
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1)
    const p = Math.pow(t, 0.7)
    const col =
      t < 0.02
        ? `oklch(0.88 ${c(0.045)} ${hue})`
        : t < 0.08
          ? `oklch(0.8 ${c(0.05)} ${hue})`
          : `oklch(${(0.74 - p * 0.34).toFixed(3)} ${c(0.05 - p * 0.018).toFixed(3)} ${hue})`
    const glow =
      t < 0.02
        ? `0 3px 0 oklch(0.95 ${c(0.03)} ${hue}), 0 -2px 0 oklch(0.62 ${c(0.04)} ${hue})`
        : 'none'
    layers.push({ z: Math.round(-t * DEPTH * 100) / 100, color: col, glow })
  }
  return layers
}

export function JpMark({
  size = 300,
  height,
  spin = 22,
  hueCycle = 60,
  color = true,
  radius = '0px',
  bg = 'transparent',
  steps = 60,
  label,
  className,
  style,
}: JpMarkProps) {
  const h = height ?? size
  const scale = Math.min(size, h) / 560
  const layers = buildLayers(Math.max(8, Math.round(steps)), color)

  const boxStyle: CSSProperties = {
    position: 'relative',
    width: `${size}px`,
    height: `${h}px`,
    perspective: '1600px',
    overflow: 'hidden',
    borderRadius: radius,
    background: bg,
    // Per-instance animation timing, read by the hover rules in globals.css.
    ['--jp-spin' as string]: `${spin}s`,
    ['--jp-hue' as string]: `${hueCycle}s`,
    ...style,
  }

  return (
    <div
      className={['jp-mark', className].filter(Boolean).join(' ')}
      style={boxStyle}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: `${STAGE}px`,
          height: `${STAGE}px`,
          transformStyle: 'preserve-3d',
          transform: `translate(-50%, -50%) scale(${scale.toFixed(4)})`,
        }}
      >
        <div
          className="jp-spinner"
          style={{
            width: '100%',
            height: '100%',
            transformStyle: 'preserve-3d',
            // Static rest angle — a slight Y turn so the chrome extrude reads.
            transform: 'rotateX(7deg) rotateY(-20deg)',
          }}
        >
          {FACES.map((deg, fi) => (
            <div
              key={deg}
              className="jp-face"
              style={{
                position: 'absolute',
                inset: 0,
                transformStyle: 'preserve-3d',
                transform: `rotateY(${deg}deg) translateZ(150px)`,
                // Stagger the hover hue-cycle across faces (quarter-phase each).
                ['--jp-delay' as string]: `${-(hueCycle * fi) / 4}s`,
              }}
            >
              {layers.map((l, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backfaceVisibility: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: 0.72,
                    fontFamily: 'var(--font-archivo), sans-serif',
                    fontSize: `${FONT}px`,
                    letterSpacing: '-0.03em',
                    color: l.color,
                    transform: `translateZ(${l.z}px)`,
                    textShadow: l.glow,
                  }}
                >
                  <span>J</span>
                  <span style={{ marginTop: '-0.04em' }}>P</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
