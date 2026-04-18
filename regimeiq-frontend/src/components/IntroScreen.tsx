import { useEffect, useRef } from 'react'
import { useBankaiTransition } from './BankaiTransition'

interface IntroScreenProps {
  onContinue: () => void
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  opacity: number
  baseOpacity: number
  phase: number
}

interface Dust {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  life: number
  color: string
  gravity: number
}

const SPARK_COLORS = [
  'rgba(245,158,11,',   // amber
  'rgba(103,232,249,',  // cyan
  'rgba(200,214,229,',  // silver-blue
]

const COUNT = 48

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=JetBrains+Mono:wght@300;400&display=swap');

  @keyframes riq-in {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes riq-pulse {
    0%, 100% { opacity: 0.38; }
    50%       { opacity: 0.7;  }
  }
  @keyframes riq-float {
    0%, 100% { transform: translateY(0px);  }
    50%      { transform: translateY(-4px); }
  }
  @keyframes riq-ripple {
    from { width: 0px; height: 0px; opacity: 0.9; margin: 0; }
    to   { width: 100px; height: 100px; opacity: 0; margin: -50px; }
  }
  .riq-ripple {
    position: absolute;
    border-radius: 50%;
    border: 2px solid var(--riq-ripple-color, white);
    background: color-mix(in srgb, var(--riq-ripple-color, white) 15%, transparent);
    box-shadow: 0 0 12px 2px color-mix(in srgb, var(--riq-ripple-color, white) 40%, transparent);
    pointer-events: none;
    animation: riq-ripple 700ms ease-out forwards;
  }

  .riq-screen {
    position: fixed; inset: 0; z-index: 50;
    display: flex; align-items: center; justify-content: center;
    user-select: none;
    background:
      radial-gradient(ellipse 100% 80% at 50% 40%,
        #0e1a26 0%,
        #07101a 45%,
        #020608 100%);
  }

  .riq-content {
    position: relative; z-index: 10;
    display: flex; flex-direction: column;
    align-items: center;
    gap: 1.75rem;
    animation: riq-in 1.3s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
  }

  .riq-title-group {
    display: flex; flex-direction: column;
    align-items: center; gap: 0.7rem;
    animation: riq-float 9s ease-in-out infinite;
  }

  .riq-overline {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.5rem;
    font-weight: 300;
    letter-spacing: 0.58em;
    text-transform: uppercase;
    color: rgba(245, 158, 11, 0.55);
    animation: riq-pulse 4.5s ease-in-out infinite;
  }

  .riq-title {
    font-family: 'Syne', sans-serif;
    font-size: clamp(3.4rem, 9.5vw, 7.2rem);
    font-weight: 800;
    letter-spacing: -0.025em;
    line-height: 0.93;
    color: #eef2f7;
    text-align: center;
    /* Subtle luminosity layering */
    text-shadow:
      0 0 80px rgba(245, 158, 11, 0.04),
      0 1px 0 rgba(255,255,255,0.04);
  }

  .riq-divider {
    width: 1px;
    height: 38px;
    background: linear-gradient(
      to bottom,
      transparent,
      rgba(245, 158, 11, 0.28) 40%,
      rgba(245, 158, 11, 0.28) 60%,
      transparent
    );
  }

  /* Button */
  .riq-btn {
    position: relative;
    padding: 0.82rem 2.6rem;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.6rem;
    font-weight: 400;
    letter-spacing: 0.42em;
    text-transform: uppercase;
    color: rgba(238, 242, 247, 0.72);
    background: rgba(255, 255, 255, 0.025);
    border: 1px solid rgba(238, 242, 247, 0.12);
    border-radius: 2px;
    cursor: pointer;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    transition:
      transform    0.4s  cubic-bezier(0.34, 1.56, 0.64, 1),
      color        0.25s ease,
      border-color 0.25s ease,
      background   0.25s ease,
      box-shadow   0.25s ease;
  }
  .riq-btn:hover {
    transform: scale(1.035);
    color: rgba(238, 242, 247, 0.95);
    border-color: rgba(245, 158, 11, 0.35);
    background: rgba(245, 158, 11, 0.03);
    box-shadow:
      0 0 28px rgba(245, 158, 11, 0.07),
      inset 0 0 12px rgba(245, 158, 11, 0.02);
  }
  .riq-btn:active {
    transform: scale(0.975);
    transition-duration: 0.1s;
  }

  /* Corner labels */
  .riq-meta {
    position: absolute;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.46rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: rgba(22, 50, 80, 0.75);
    pointer-events: none;
  }
`

export function IntroScreen({ onContinue }: IntroScreenProps) {
  const { triggerBankai } = useBankaiTransition()

  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const screenRef   = useRef<HTMLDivElement>(null)
  const mouseRef    = useRef({ x: -9999, y: -9999 })
  const ptRef       = useRef<Particle[]>([])
  const dustRef     = useRef<Dust[]>([])
  const animRef     = useRef(0)
  const collapseRef = useRef(false)

  // Inject styles
  useEffect(() => {
    const el = document.createElement('style')
    el.id = 'riq-intro-styles'
    el.textContent = STYLES
    document.head.appendChild(el)
    return () => { document.head.removeChild(el) }
  }, [])

  // Canvas loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    ptRef.current = Array.from({ length: COUNT }, () => {
      const baseOpacity = Math.random() * 0.18 + 0.05
      return {
        x:           Math.random() * window.innerWidth,
        y:           Math.random() * window.innerHeight,
        vx:          (Math.random() - 0.5) * 0.18,
        vy:          (Math.random() - 0.5) * 0.18,
        radius:      Math.random() * 0.9 + 0.2,
        opacity:     baseOpacity,
        baseOpacity,
        phase:       Math.random() * Math.PI * 2,
      }
    })

    const ctx = canvas.getContext('2d')!
    let tick = 0

    const draw = () => {
      tick++
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const mouse     = mouseRef.current
      const cx        = canvas.width  / 2
      const cy        = canvas.height / 2
      const collapsing = collapseRef.current

      for (const p of ptRef.current) {
        if (collapsing) {
          // Gentle, unhurried pull toward center
          const dx = cx - p.x
          const dy = cy - p.y
          const d  = Math.hypot(dx, dy) || 1
          p.vx += (dx / d) * 0.009
          p.vy += (dy / d) * 0.009
          p.vx *= 0.965
          p.vy *= 0.965
          // Fade out smoothly as they approach center
          const proximity = Math.max(0, 1 - d / (Math.hypot(canvas.width, canvas.height) * 0.5))
          p.opacity = Math.max(0, p.opacity - 0.003 - proximity * 0.006)
        } else {
          // Soft mouse parallax repulsion
          const dx = p.x - mouse.x
          const dy = p.y - mouse.y
          const d  = Math.hypot(dx, dy)
          if (d < 180 && d > 0) {
            const f = ((180 - d) / 180) * 0.007
            p.vx += (dx / d) * f
            p.vy += (dy / d) * f
          }
          p.vx *= 0.982
          p.vy *= 0.982
          // Wrap
          if (p.x < -6) p.x = canvas.width  + 6
          if (p.x > canvas.width  + 6) p.x = -6
          if (p.y < -6) p.y = canvas.height + 6
          if (p.y > canvas.height + 6) p.y = -6
        }

        p.x += p.vx
        p.y += p.vy

        const breathe = (Math.sin(tick * 0.005 + p.phase) + 1) / 2
        const alpha   = collapsing
          ? p.opacity
          : p.baseOpacity * (0.55 + breathe * 0.45)

        if (alpha <= 0.001) continue

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(200, 214, 229, ${alpha})`
        ctx.fill()
      }

      // Very faint connection threads — barely visible, feels like a network at rest
      if (!collapsing) {
        const pts = ptRef.current
        for (let i = 0; i < pts.length; i++) {
          for (let j = i + 1; j < pts.length; j++) {
            const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y)
            if (d < 72) {
              ctx.beginPath()
              ctx.moveTo(pts[i].x, pts[i].y)
              ctx.lineTo(pts[j].x, pts[j].y)
              ctx.strokeStyle = `rgba(148, 163, 184, ${(1 - d / 72) * 0.045})`
              ctx.lineWidth = 0.35
              ctx.stroke()
            }
          }
        }
      }

      // Spark trail (click+drag)
      for (let i = dustRef.current.length - 1; i >= 0; i--) {
        const d = dustRef.current[i]
        d.vy += d.gravity
        d.vx *= 0.97
        d.vy *= 0.97
        d.x  += d.vx
        d.y  += d.vy
        d.life -= 0.018
        if (d.life <= 0) { dustRef.current.splice(i, 1); continue }
        const a = d.life * d.life * 0.55
        ctx.beginPath()
        ctx.arc(d.x, d.y, d.radius * d.life, 0, Math.PI * 2)
        ctx.fillStyle = `${d.color}${a})`
        ctx.fill()
      }

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)

    let rippleHue    = 0
    let rippleDist   = 0
    const RIPPLE_GAP = 60 // px between ripples

    const onMove = (e: MouseEvent) => {
      const prev = { x: mouseRef.current.x, y: mouseRef.current.y }
      mouseRef.current.x = e.clientX
      mouseRef.current.y = e.clientY

      if (prev.x === -9999) return

      const dx    = e.clientX - prev.x
      const dy    = e.clientY - prev.y
      const speed = Math.hypot(dx, dy)

      // Sparks on any movement
      if (speed > 2.5) {
        const count = Math.min(Math.ceil(speed / 4), 5)
        for (let i = 0; i < count; i++) {
          const angle = Math.random() * Math.PI * 2
          const vel   = Math.random() * 2.2 + 0.4
          dustRef.current.push({
            x:       e.clientX + (Math.random() - 0.5) * 5,
            y:       e.clientY + (Math.random() - 0.5) * 5,
            vx:      Math.cos(angle) * vel,
            vy:      Math.sin(angle) * vel - 1.2,
            radius:  Math.random() * 1.5 + 0.4,
            life:    0.7 + Math.random() * 0.3,
            color:   SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)],
            gravity: 0.07 + Math.random() * 0.04,
          })
        }
      }

      // Rainbow ripple throttled by distance
      rippleDist += speed
      if (rippleDist >= RIPPLE_GAP) {
        rippleDist = 0
        const screen = screenRef.current
        if (screen) {
          const rect  = screen.getBoundingClientRect()
          const color = `hsl(${rippleHue}, 100%, 65%)`
          rippleHue   = (rippleHue + 37) % 360
          const el    = document.createElement('div')
          el.className = 'riq-ripple'
          el.style.left = `${e.clientX - rect.left}px`
          el.style.top  = `${e.clientY - rect.top}px`
          el.style.setProperty('--riq-ripple-color', color)
          screen.appendChild(el)
          setTimeout(() => { if (screen.contains(el)) screen.removeChild(el) }, 750)
        }
      }
    }

    document.addEventListener('mousemove', onMove)

    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
      document.removeEventListener('mousemove', onMove)
    }
  }, [])

  const handleExplore = () => {
    collapseRef.current = true
    triggerBankai(onContinue)
  }

  return (
    <div ref={screenRef} className="riq-screen">
      {/* Particle field */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

      {/* Noise grain — atmosphere, not decoration */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='0.055'/%3E%3C/svg%3E")`,
          backgroundSize: '180px 180px',
          opacity: 0.55,
          mixBlendMode: 'overlay',
        }}
      />

      {/* Faint radial vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 70% 60% at 50% 50%, transparent 40%, rgba(2,6,8,0.55) 100%)',
        }}
      />

      {/* Content */}
      <div className="riq-content">
        <div className="riq-title-group">
          <span className="riq-overline">◆ &nbsp;Macro Intelligence</span>
          <h1 className="riq-title">RegimeIQ</h1>
        </div>

        <div className="riq-divider" />

        <button className="riq-btn" onClick={handleExplore}>
          Explore
        </button>
      </div>

      {/* Corner metadata — ambient, unobtrusive */}
      <span className="riq-meta" style={{ top: '1.5rem', left: '1.75rem' }}>
        SYS_INIT · 2026
      </span>
      <span className="riq-meta" style={{ top: '1.5rem', right: '1.75rem' }}>
        v2.1.4
      </span>
      <span
        className="riq-meta"
        style={{ bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}
      >
        Macro · Intelligence · Platform
      </span>
    </div>
  )
}
