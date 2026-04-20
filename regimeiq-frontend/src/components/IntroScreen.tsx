import { useEffect, useRef } from 'react'
import { useBankaiTransition } from './BankaiTransition'
import { StarfallBackground } from './StarfallBackground'

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

// Dashboard accent: lime #c6ff1f — all sparks pull from this palette
const SPARK_COLORS = [
  'rgba(198,255,31,',   // primary lime
  'rgba(255,255,255,',  // white-hot
  'rgba(160,220,20,',   // deeper lime
]

const COUNT = 48

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=JetBrains+Mono:wght@300;400&display=swap');

  @keyframes riq-in {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes riq-float {
    0%, 100% { transform: translateY(0px);  }
    50%      { transform: translateY(-5px); }
  }
  @keyframes riq-ripple {
    from { width: 0px; height: 0px; opacity: 0.7; margin: 0; }
    to   { width: 100px; height: 100px; opacity: 0; margin: -50px; }
  }
  @keyframes riq-logo-in {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes riq-bloom {
    0%, 100% { opacity: 0.14; transform: scale(1);    }
    50%      { opacity: 0.28; transform: scale(1.18); }
  }

  .riq-ripple {
    position: absolute;
    border-radius: 50%;
    border: 1px solid rgba(198,255,31,0.45);
    background: rgba(198,255,31,0.025);
    box-shadow: 0 0 10px 1px rgba(198,255,31,0.10);
    pointer-events: none;
    animation: riq-ripple 700ms ease-out forwards;
  }

  .riq-screen {
    position: fixed; inset: 0; z-index: 50;
    display: flex; align-items: center; justify-content: center;
    user-select: none;
    background: #000;
  }

  .riq-content {
    position: relative; z-index: 10;
    display: flex; flex-direction: column;
    align-items: center;
    gap: 1.75rem;
    animation: riq-in 1.3s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
  }

  .riq-logo-lockup {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.6rem;
    animation: riq-float 9s ease-in-out infinite;
  }

  /* Bloom wrapper — positions the pulsing glow behind the logo */
  .riq-logo-wrap {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Animated bloom: lime radial gradient that pulses like a light source */
  .riq-logo-bloom {
    position: absolute;
    inset: -55%;
    border-radius: 50%;
    background: radial-gradient(
      circle,
      rgba(198,255,31,0.45) 0%,
      rgba(198,255,31,0.12) 38%,
      transparent 68%
    );
    animation: riq-bloom 5.5s ease-in-out infinite;
    pointer-events: none;
  }

  .riq-logo-img {
    position: relative;
    z-index: 1;
    width: 108px;
    height: 108px;
    object-fit: contain;
    /* mix-blend-mode: lighten makes black pixels transparent on dark bg */
    mix-blend-mode: lighten;
    filter: drop-shadow(0 0 22px rgba(198,255,31,0.35));
  }

  /* –15% scale vs original clamp(3.2rem,9vw,6.8rem) */
  .riq-title {
    font-family: 'Syne', sans-serif;
    font-size: clamp(2.72rem, 7.65vw, 5.78rem);
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 0.92;
    color: #e7e4ec;
    text-align: center;
    text-shadow:
      0 0 60px rgba(198, 255, 31, 0.06),
      0 1px 0 rgba(255,255,255,0.04);
  }

  /* CTA — full lime border, ambient glow at rest, intensifies on hover */
  .riq-btn {
    position: relative;
    padding: 0.78rem 2.8rem;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.58rem;
    font-weight: 400;
    letter-spacing: 0.44em;
    text-transform: uppercase;
    color: rgba(198, 255, 31, 0.82);
    background: rgba(198, 255, 31, 0.04);
    border: 1px solid #c6ff1f;
    border-radius: 2px;
    cursor: pointer;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow:
      0 0 10px rgba(198,255,31,0.08),
      0 0 2px  rgba(198,255,31,0.12);
    transition:
      transform    0.4s  cubic-bezier(0.34, 1.56, 0.64, 1),
      color        0.22s ease,
      background   0.22s ease,
      box-shadow   0.28s ease;
  }
  .riq-btn:hover {
    transform: scale(1.03);
    color: #c6ff1f;
    background: rgba(198, 255, 31, 0.07);
    box-shadow:
      0 0 28px rgba(198,255,31,0.28),
      0 0 56px rgba(198,255,31,0.12),
      0 0  4px rgba(198,255,31,0.20),
      inset 0 0 14px rgba(198,255,31,0.04);
  }
  .riq-btn:active {
    transform: scale(0.975);
    transition-duration: 0.1s;
  }

  /* Footer — wider kerning, 50% white */
  .riq-meta {
    position: absolute;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.44rem;
    letter-spacing: 0.45em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.5);
    pointer-events: none;
  }

  /* Top-left nav lockup — hover transitions gray → white */
  .riq-nav-logo {
    position: absolute;
    top: 1.25rem;
    left: 1.5rem;
    display: flex;
    align-items: center;
    gap: 0.55rem;
    animation: riq-logo-in 1s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both;
    pointer-events: all;
    cursor: default;
  }

  .riq-nav-logo img {
    width: 24px;
    height: 24px;
    object-fit: contain;
    mix-blend-mode: lighten;
    opacity: 0.7;
    transition: opacity 0.22s ease;
  }

  .riq-nav-logo span {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.5rem;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: rgba(155, 163, 173, 0.55);
    transition: color 0.22s ease;
  }

  .riq-nav-logo:hover img  { opacity: 1; }
  .riq-nav-logo:hover span { color: rgba(255, 255, 255, 0.9); }
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

      const mouse      = mouseRef.current
      const cx         = canvas.width  / 2
      const cy         = canvas.height / 2
      const collapsing = collapseRef.current

      for (const p of ptRef.current) {
        if (collapsing) {
          const dx = cx - p.x
          const dy = cy - p.y
          const d  = Math.hypot(dx, dy) || 1
          p.vx += (dx / d) * 0.009
          p.vy += (dy / d) * 0.009
          p.vx *= 0.965
          p.vy *= 0.965
          const proximity = Math.max(0, 1 - d / (Math.hypot(canvas.width, canvas.height) * 0.5))
          p.opacity = Math.max(0, p.opacity - 0.003 - proximity * 0.006)
        } else {
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
        // Particles: faint lime tint matching dashboard accent
        ctx.fillStyle = `rgba(198, 255, 31, ${alpha * 0.55})`
        ctx.fill()
      }

      // Connection threads — lime green at near-invisible opacity
      if (!collapsing) {
        const pts = ptRef.current
        for (let i = 0; i < pts.length; i++) {
          for (let j = i + 1; j < pts.length; j++) {
            const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y)
            if (d < 72) {
              ctx.beginPath()
              ctx.moveTo(pts[i].x, pts[i].y)
              ctx.lineTo(pts[j].x, pts[j].y)
              ctx.strokeStyle = `rgba(198, 255, 31, ${(1 - d / 72) * 0.035})`
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

    let rippleDist   = 0
    const RIPPLE_GAP = 60

    const onMove = (e: MouseEvent) => {
      const prev = { x: mouseRef.current.x, y: mouseRef.current.y }
      mouseRef.current.x = e.clientX
      mouseRef.current.y = e.clientY

      if (prev.x === -9999) return

      const dx    = e.clientX - prev.x
      const dy    = e.clientY - prev.y
      const speed = Math.hypot(dx, dy)

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

      // Lime ripple throttled by distance
      rippleDist += speed
      if (rippleDist >= RIPPLE_GAP) {
        rippleDist = 0
        const screen = screenRef.current
        if (screen) {
          const rect = screen.getBoundingClientRect()
          const el   = document.createElement('div')
          el.className = 'riq-ripple'
          el.style.left = `${e.clientX - rect.left}px`
          el.style.top  = `${e.clientY - rect.top}px`
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
      {/* Starfall background — rendered once, never re-renders */}
      <StarfallBackground />

      {/* Particle field */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

      {/* Grain overlay — same as dashboard atmosphere */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
          backgroundSize: '180px 180px',
          opacity: 0.45,
          mixBlendMode: 'overlay',
        }}
      />

      {/* Subtle center glow — lime, very faint */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 55% 45% at 50% 50%, rgba(198,255,31,0.03) 0%, transparent 70%)',
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 70% at 50% 50%, transparent 35%, rgba(0,0,0,0.65) 100%)',
        }}
      />

      {/* Top-left logo — mirrors TopNav positioning */}
      <div className="riq-nav-logo">
        <img src="/logo.png" alt="RegimeIQ" />
        <span>RegimeIQ</span>
      </div>

      {/* Content */}
      <div className="riq-content">
        <div className="riq-logo-lockup">
          {/* Bloom glow sits behind logo; mix-blend-mode:lighten removes black bg */}
          <div className="riq-logo-wrap">
            <div className="riq-logo-bloom" />
            <img src="/logo.png" alt="" className="riq-logo-img" />
          </div>
          <h1 className="riq-title">RegimeIQ</h1>
        </div>

        <button className="riq-btn" onClick={handleExplore}>
          Enter System
        </button>
      </div>

      {/* Bottom center tag */}
      <span
        className="riq-meta"
        style={{ bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}
      >
        Macro · Intelligence · Platform
      </span>
    </div>
  )
}
