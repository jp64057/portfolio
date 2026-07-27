'use client'

import { useEffect, useRef } from 'react'

// A lightweight canvas-2D particle field that drifts behind the hero and reacts
// to the pointer. Deliberately not WebGL/three.js — this keeps the bundle tiny
// and the main thread quiet so the Lighthouse budgets hold. It:
//   • does nothing under prefers-reduced-motion,
//   • pauses when the tab is hidden or the hero scrolls out of view,
//   • caps particle count + devicePixelRatio for cheap frames.
export function HeroBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let width = 0
    let height = 0
    let raf = 0
    let running = true
    const pointer = { x: -9999, y: -9999 }

    type P = { x: number; y: number; vx: number; vy: number }
    let particles: P[] = []

    const accent = () => {
      const v = getComputedStyle(canvas).getPropertyValue('--accent').trim()
      return v || '217 91% 60%'
    }

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      width = rect.width
      height = rect.height
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      // Density scales with area but is capped so big screens stay cheap.
      const count = Math.min(70, Math.round((width * height) / 16000))
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
      }))
    }

    const LINK_DIST = 120

    const frame = () => {
      if (!running) return
      const hsl = accent()
      ctx.clearRect(0, 0, width, height)

      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0 || p.x > width) p.vx *= -1
        if (p.y < 0 || p.y > height) p.vy *= -1

        // Gentle pull toward the pointer when it's near.
        const dx = pointer.x - p.x
        const dy = pointer.y - p.y
        const d2 = dx * dx + dy * dy
        if (d2 < 140 * 140) {
          p.vx += (dx / (d2 + 400)) * 6
          p.vy += (dy / (d2 + 400)) * 6
        }
        // Damp so the pointer nudge doesn't accumulate forever.
        p.vx = Math.max(-0.6, Math.min(0.6, p.vx * 0.99))
        p.vy = Math.max(-0.6, Math.min(0.6, p.vy * 0.99))

        ctx.fillStyle = `hsl(${hsl} / 0.6)`
        ctx.beginPath()
        ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2)
        ctx.fill()
      }

      // Link nearby particles with faint lines.
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i]
          const b = particles[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const dist = Math.hypot(dx, dy)
          if (dist < LINK_DIST) {
            ctx.strokeStyle = `hsl(${hsl} / ${0.14 * (1 - dist / LINK_DIST)})`
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.stroke()
          }
        }
      }

      raf = requestAnimationFrame(frame)
    }

    const start = () => {
      if (running) return
      running = true
      raf = requestAnimationFrame(frame)
    }
    const stop = () => {
      running = false
      cancelAnimationFrame(raf)
    }

    const onPointer = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      pointer.x = e.clientX - rect.left
      pointer.y = e.clientY - rect.top
    }
    const onLeave = () => {
      pointer.x = -9999
      pointer.y = -9999
    }
    const onVisibility = () => (document.hidden ? stop() : start())

    resize()
    running = true
    raf = requestAnimationFrame(frame)

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    // Pause when the hero scrolls off-screen.
    const io = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? start() : stop()),
      { threshold: 0 },
    )
    io.observe(canvas)

    window.addEventListener('pointermove', onPointer)
    window.addEventListener('pointerleave', onLeave)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      stop()
      ro.disconnect()
      io.disconnect()
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('pointerleave', onLeave)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 h-full w-full"
    />
  )
}
