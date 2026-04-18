import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

interface BankaiContextValue {
  triggerBankai: (callback: () => void) => void
}

const BankaiContext = createContext<BankaiContextValue>({ triggerBankai: (cb) => cb() })

export function useBankaiTransition() {
  return useContext(BankaiContext)
}

// ── Timing (ms) ────────────────────────────────────────────────────
const CHARGE_END  = 1500
const SLASH_END   = 1650
const CONSUME_END = 2600
const HOLD_END    = 3000
const REVEAL_END  = 5700

const STYLES = `
  @keyframes bankai-shake {
    0%, 100% { transform: translate(0, 0); }
    20%  { transform: translate(-1px, -1px); }
    40%  { transform: translate(1px, -1px); }
    60%  { transform: translate(-1px,  1px); }
    80%  { transform: translate(1px,   1px); }
  }
  .bankai-shaking { animation: bankai-shake 55ms steps(1) infinite; }
`

// ── Particle shapes ────────────────────────────────────────────────
interface Fragment { x:number; y:number; vx:number; vy:number; life:number; ml:number }
interface Wisp     { x:number; y:number; vx:number; vy:number; life:number; ml:number; k:number }
interface Ember    { x:number; y:number; vx:number; vy:number; life:number; ml:number }
// Charge-phase types
interface ISpark   { x:number; y:number; vx:number; vy:number; life:number; ml:number }
interface WFlash   { x:number; y:number; radius:number; life:number; ml:number }
interface CrackSeg { t0:number; t1:number; alpha:number; seed:number }
interface LSpark   { x:number; y:number; vx:number; vy:number; life:number; ml:number; curve:boolean }
interface ENode    { x:number; y:number; vx:number; vy:number; t0:number; maxR:number }
interface Bolt     { startX:number; startY:number; dirX:number; dirY:number; segs:number[]; length:number; life:number; ml:number }

const clamp    = (v:number, lo:number, hi:number) => Math.max(lo, Math.min(hi, v))
const easeOut  = (t:number) => 1 - Math.pow(1 - t, 2.5)
const easeIO   = (t:number) => t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t

export function BankaiTransitionProvider({ children }: { children: React.ReactNode }) {
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const callbackRef = useRef<(() => void) | null>(null)
  const animRef     = useRef(0)
  const [active,  setActive]  = useState(false)
  const [shaking, setShaking] = useState(false)

  useEffect(() => {
    const el = document.createElement('style')
    el.id = 'bankai-styles'
    el.textContent = STYLES
    document.head.appendChild(el)
    return () => { document.head.removeChild(el) }
  }, [])

  const triggerBankai = useCallback((cb: () => void) => {
    callbackRef.current = cb
    setActive(true)
    setShaking(true)
    setTimeout(() => setShaking(false), SLASH_END + 280)
  }, [])

  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    const W = canvas.width  = window.innerWidth
    const H = canvas.height = window.innerHeight

    // ── Crescent geometry ──────────────────────────────────────────
    // Centered slash with CONCAVE pulling the midpoint backward (moon-fang shape)
    const SX      = W * 0.50
    const ANCHOR_X = SX + 50          // unified x-anchor: blob centre == slash position
    const CONCAVE = W * 0.08
    const Y0 = -65, Y1 = H + 65

    const crescentXY = (y: number): number => {
      const t  = (y - Y0) / (Y1 - Y0)
      const tc = clamp(t, 0, 1)
      return (1-tc)*(1-tc)*SX + 2*(1-tc)*tc*(SX - CONCAVE) + tc*tc*SX
    }

    // Pre-sample arc for fast particle spawning
    const ARC_N = 90
    const arc   = Array.from({ length: ARC_N }, (_, i) => {
      const y = (i / (ARC_N - 1)) * H
      return { x: crescentXY(y), y }
    })
    const onArc = (): { x: number; y: number } => {
      const p = arc[Math.floor(Math.random() * ARC_N)]
      return { x: p.x + (Math.random() - 0.5) * 10, y: p.y + (Math.random() - 0.5) * 10 }
    }

    // ── Draw helpers ───────────────────────────────────────────────
    const crescentX = (y: number) => crescentXY(y) + (ANCHOR_X - SX)

    const traceCrescent = () => {
      const STEPS = 100
      ctx.beginPath()
      ctx.moveTo(crescentX(Y0), Y0)
      for (let i = 1; i <= STEPS; i++) {
        const y = Y0 + (i / STEPS) * (Y1 - Y0)
        ctx.lineTo(crescentX(y), y)
      }
    }

    const fillConsumed = (xOffset = 0) => {
      const STEPS = 80
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(crescentX(Y0) + xOffset, Y0)
      for (let i = 1; i <= STEPS; i++) {
        const y = Y0 + (i / STEPS) * (Y1 - Y0)
        ctx.lineTo(crescentX(y) + xOffset, y)
      }
      ctx.lineTo(-W * 0.12, Y1)
      ctx.lineTo(-W * 0.12, Y0)
      ctx.closePath()
      ctx.fillStyle = 'rgba(0,0,0,1)'
      ctx.fill()
      ctx.restore()
    }

    // Magenta edge glow — layered from wide outer to razor white core
    const GLOW_LAYERS: Array<[number, number, number, number, number, number]> = [
      // [lineWidth, r, g, b, alpha, shadowBlur]
      [75,  60,  0, 100, 0.18, 0],
      [48, 110,  0, 160, 0.32, 0],
      [28, 180,  0, 195, 0.52, 0],
      [15, 235,  0, 210, 0.72, 18],
      [ 7, 255, 30, 225, 0.88, 13],
      [ 3, 255,130, 240, 0.82,  9],
      [1.2,255,255, 255, 0.78,  5],
    ]

    const drawEdge = (alpha: number, widthScale = 1, lumBoost = 0) => {
      for (const [lw, r, g, b, a, blur] of GLOW_LAYERS) {
        ctx.save()
        traceCrescent()
        ctx.lineWidth   = lw * widthScale
        const br  = Math.min(255, r + (255 - r) * lumBoost)
        const bg  = Math.min(255, g + (255 - g) * lumBoost)
        const bb_ = Math.min(255, b + (255 - b) * lumBoost)
        ctx.strokeStyle = `rgba(${Math.floor(br)},${Math.floor(bg)},${Math.floor(bb_)},${clamp(a * alpha, 0, 1)})`
        ctx.lineCap     = 'round'
        if (blur) {
          ctx.shadowBlur  = blur
          ctx.shadowColor = lumBoost > 0.3 ? 'rgba(255,255,255,0.92)' : 'rgba(255,0,200,0.75)'
        }
        ctx.stroke()
        ctx.restore()
      }
    }

    // ── Particle pools ─────────────────────────────────────────────
    const fragments: Fragment[] = []
    const wisps:     Wisp[]     = []
    const embers:    Ember[]    = []

    // ── Phase 5 smoke nodes — uniform distribution with upward drift ─
    // Screen-center clears first (small t0), edges clear last.
    // Each node drifts up and sideways like rising smoke.
    const erosionNodes: ENode[] = Array.from({ length: 240 }, () => {
      const x      = Math.random() * W
      const y      = Math.random() * H
      const distFrac = Math.hypot(x - W / 2, y - H / 2) / Math.hypot(W / 2, H / 2)
      const t0     = clamp(distFrac * 0.55 + Math.random() * 0.45, 0, 1)
      const vx     = (Math.random() - 0.5) * 0.28
      const vy     = -(0.18 + Math.random() * 0.40)
      const maxR   = 28 + Math.random() * 95
      return { x, y, vx, vy, t0, maxR }
    })

    // 1. Slash Fragments — sharp streaks, high speed, short life
    const spawnFragments = (count: number) => {
      for (let i = 0; i < count; i++) {
        const { x, y } = onArc()
        const speed  = 7 + Math.random() * 14
        // Asymmetry: right side gets more (slash direction bias)
        const side   = Math.random() < 0.62 ? 1 : -1
        const spread = (0.05 + Math.random() * 0.75) * Math.PI * side
        const ml     = 0.35 + Math.random() * 0.45
        fragments.push({
          x, y,
          vx: Math.cos(spread) * speed,
          vy: Math.sin(spread) * speed * 0.35,
          life: ml, ml,
        })
      }
    }

    // 2. Energy Wisps — curved soft glow, medium life
    const spawnWisp = () => {
      const { x, y } = onArc()
      const speed = 1.5 + Math.random() * 3.5
      const angle = (Math.random() - 0.28) * Math.PI * 0.9
      const ml    = 0.9 + Math.random() * 0.9
      wisps.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.35 + (Math.random() - 0.5) * 0.5,
        life: ml, ml,
        k: (Math.random() - 0.5) * 0.09,   // curvature
      })
    }

    // 3. Embers — slow drifting, long life, faint
    const spawnEmber = () => {
      const { x, y } = onArc()
      const ml = 1.2 + Math.random() * 1.1
      embers.push({
        x: x + (Math.random() - 0.5) * 90,
        y: y + (Math.random() - 0.5) * 45,
        vx: (Math.random() - 0.5) * 0.9,
        vy: (Math.random() - 0.5) * 0.4 - 0.12,
        life: ml, ml,
      })
    }

    // ── Charge-phase helpers ───────────────────────────────────────
    // Multi-harmonic noise deforms the blob shape organically each frame
    const calcBlobR = (angle: number, tSec: number, base: number, freqMult = 1): number =>
      base * (1
        + Math.sin(angle * 3  * freqMult + tSec * 4.7  * freqMult) * 0.112
        + Math.sin(angle * 5  * freqMult - tSec * 3.3  * freqMult) * 0.082
        + Math.sin(angle * 7  * freqMult + tSec * 6.8  * freqMult) * 0.051
        + Math.sin(angle * 11 * freqMult - tSec * 9.1  * freqMult) * 0.028
        + Math.sin(angle * 13 * freqMult + tSec * 12.4 * freqMult) * 0.015)

    // 22 pre-seeded crack segments distributed along the arc
    const N_CRACKS = 22
    const cracks: CrackSeg[] = Array.from({ length: N_CRACKS }, (_, i) => ({
      t0:   clamp((i / N_CRACKS) + (Math.random() - 0.5) * 0.03, 0, 1),
      t1:   clamp((i / N_CRACKS) + 0.05 + Math.random() * 0.05,  0, 1),
      alpha: 0,
      seed:  Math.random() * 100,
    }))

    const iSparks: ISpark[] = []
    const wFlashes: WFlash[] = []
    const leakers:  LSpark[] = []

    const spawnISpark = (baseR: number, tSec: number) => {
      const angle = Math.random() * Math.PI * 2
      const r     = Math.random() * calcBlobR(angle, tSec, baseR) * 0.83
      const speed = 1.5 + Math.random() * 4.5
      const dir   = Math.random() * Math.PI * 2
      const ml    = 0.030 + Math.random() * 0.090
      iSparks.push({
        x: SX + Math.cos(angle) * r,  y: H/2 + Math.sin(angle) * r,
        vx: Math.cos(dir) * speed,    vy: Math.sin(dir) * speed,
        life: ml, ml,
      })
    }

    const spawnWFlash = (baseR: number, tSec: number) => {
      const angle = Math.random() * Math.PI * 2
      const r     = Math.random() * calcBlobR(angle, tSec, baseR) * 0.72
      const ml    = 0.016 + Math.random() * 0.032
      wFlashes.push({
        x: SX + Math.cos(angle) * r,  y: H/2 + Math.sin(angle) * r,
        radius: 5 + Math.random() * 14,
        life: ml, ml,
      })
    }

    const spawnLeaker = (baseR: number, tSec: number) => {
      const angle = Math.random() * Math.PI * 2
      const r     = calcBlobR(angle, tSec, baseR)
      const speed = 2.5 + Math.random() * 4.5
      const ml    = 0.07 + Math.random() * 0.11
      leakers.push({
        x: SX + Math.cos(angle) * r,  y: H/2 + Math.sin(angle) * r,
        vx: Math.cos(angle) * speed,  vy: Math.sin(angle) * speed,
        life: ml, ml,
        curve: Math.random() < 0.55,
      })
    }

    const bolts: Bolt[] = []

    const spawnBolt = (blobBaseR: number, tSec: number, fMult: number, isHugging: boolean) => {
      // startX is exactly on the slash path — same geometry traceCrescent uses
      const targetY   = Y0 + Math.random() * (Y1 - Y0)
      const jitterAmt = isHugging ? 6 : 18
      const startX    = crescentX(targetY) + 20 + (Math.random() - 0.5) * jitterAmt
      const startY    = targetY

      // Outward normal via finite-difference tangent.
      // For this crescent (concave-left Bézier), nx = tyDelta/tLen is always positive,
      // so the CCW normal always points rightward — no sign-flip needed.
      const DELTA  = 12
      const txDelta = crescentX(targetY + DELTA) - crescentX(targetY - DELTA)
      const tyDelta = 2 * DELTA
      const tLen    = Math.hypot(txDelta, tyDelta) || 1
      const nx      = tyDelta  / tLen   // always > 0 for this curve → fires right
      const ny      = -txDelta / tLen
      const spread  = isHugging ? 0.28 : 0.65
      const dAngle  = Math.atan2(ny, nx) + (Math.random() - 0.5) * spread
      const nSegs   = isHugging ? 3 + Math.floor(Math.random() * 2) : 4 + Math.floor(Math.random() * 4)
      const length  = isHugging ? 8 + Math.random() * 20 : 28 + Math.random() * 65
      const jitter  = isHugging ? 9 : 15
      const segs    = Array.from({ length: nSegs }, () => (Math.random() - 0.5) * jitter)
      const ml      = isHugging ? 0.018 + Math.random() * 0.028 : 0.030 + Math.random() * 0.060
      bolts.push({ startX, startY, dirX: Math.cos(dAngle), dirY: Math.sin(dAngle), segs, length, life: ml, ml })
    }

    let startTime: number | null = null
    let callbackFired = false
    let fragmentsBurst = false

    // ── Main loop ──────────────────────────────────────────────────
    const draw = (ts: number) => {
      if (!startTime) startTime = ts
      const elapsed = ts - startTime

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
      // Black base from hold phase onward — charge/slash/consume draw their own black
      if (elapsed >= CONSUME_END) {
        ctx.fillStyle = 'black'
        ctx.fillRect(-1, -1, W + 2, H + 2)
      } else {
        ctx.clearRect(0, 0, W, H)
      }

      // ════════════════════════════════════════════════════════════
      // PHASE 1 — CHARGE  (0–1500ms)
      // ════════════════════════════════════════════════════════════
      if (elapsed < CHARGE_END) {
        const pt   = elapsed / CHARGE_END
        const tSec = elapsed / 1000

        // Sub-phase timing: lightning onset = 1000ms, compression onset = 1200ms
        const LIGHTNING_PT   = 1000 / CHARGE_END   // ≈ 0.667
        const COMPRESS_ONSET = 0.80                 // = 1200ms
        const lightningT     = pt >= LIGHTNING_PT
          ? (pt - LIGHTNING_PT) / (1 - LIGHTNING_PT)
          : 0
        const compressionT   = pt > COMPRESS_ONSET
          ? (pt - COMPRESS_ONSET) / (1 - COMPRESS_ONSET)
          : 0

        // Blob grows to peak at 1200ms, then shrinks 10% with exponential ease-in
        // expIn: 2^(10t-10) → near-zero at onset, explosive near 1500ms
        const peakR  = 10 + (1 - Math.pow(1 - COMPRESS_ONSET, 1.8)) * 90
        const expIn  = compressionT > 0 ? Math.pow(2, 10 * compressionT - 10) : 0
        const baseR  = compressionT > 0
          ? peakR * (1.0 - 0.10 * expIn)
          : 10 + (1 - Math.pow(1 - pt, 1.8)) * 90

        // Noise speed also follows expIn: stays calm, then blurs to chaos near 1500ms
        const freqMult = 1 + expIn * 5

        // ── Background veil: reaches full black at end of compression ──
        const veilAlpha = Math.min(1, pt * 0.75 + compressionT * 0.25)
        ctx.fillStyle = `rgba(0,0,0,${veilAlpha})`
        ctx.fillRect(0, 0, W, H)

        // ── Inward vacuum halo ──
        if (baseR > 1) {
          const haloR = baseR * 2.9
          const halo  = ctx.createRadialGradient(SX, H/2, baseR * 0.85, SX, H/2, haloR)
          halo.addColorStop(0,    'rgba(0,0,0,0)')
          halo.addColorStop(0.30, `rgba(0,0,0,${pt * 0.14})`)
          halo.addColorStop(0.65, `rgba(0,0,0,${pt * 0.07})`)
          halo.addColorStop(1,    'rgba(0,0,0,0)')
          ctx.fillStyle = halo
          ctx.beginPath()
          ctx.arc(SX, H/2, haloR, 0, Math.PI * 2)
          ctx.fill()
        }

        // ── Organic blob — 140-point noise-deformed path ──
        if (baseR > 0.5) {
          const N_BLOB = 140
          ctx.save()
          ctx.beginPath()
          for (let i = 0; i <= N_BLOB; i++) {
            const angle = (i / N_BLOB) * Math.PI * 2
            const r     = calcBlobR(angle, tSec, baseR, freqMult)
            const x     = SX    + Math.cos(angle) * r
            const y     = H/2   + Math.sin(angle) * r
            if (i === 0) { ctx.moveTo(x, y) } else { ctx.lineTo(x, y) }
          }
          ctx.closePath()
          const blobG = ctx.createRadialGradient(SX, H/2, 0, SX, H/2, baseR)
          blobG.addColorStop(0,   'rgba(0,0,0,1)')
          blobG.addColorStop(0.5, 'rgba(0,0,0,1)')
          blobG.addColorStop(0.82, pt > 0.52 ? `rgba(8,0,20,${pt * 0.88})` : 'rgba(0,0,0,1)')
          blobG.addColorStop(1,   'rgba(0,0,0,0.88)')
          ctx.fillStyle = blobG
          ctx.fill()
          ctx.restore()
        }

        // ── Internal sparks: jitter scales to frantic during compression ──
        const jitterScale = 1 + compressionT * 8
        const sparkRate   = pt * pt * 0.6 + (pt > 0.40 ? 0.12 : 0)
        const spawnRate   = sparkRate * (1 + compressionT * 5)
        if (compressionT < 0.92 && Math.random() < spawnRate * 3.2) spawnISpark(baseR, tSec)
        if (compressionT < 0.92 && Math.random() < spawnRate * 1.6) spawnISpark(baseR, tSec)
        if (compressionT > 0.30  && Math.random() < compressionT * 2.0) spawnISpark(baseR, tSec)

        for (let i = iSparks.length - 1; i >= 0; i--) {
          const s = iSparks[i]
          s.vx += (Math.random() - 0.5) * 5.0 * jitterScale
          s.vy += (Math.random() - 0.5) * 5.0 * jitterScale
          s.vx *= 0.70
          s.vy *= 0.70
          s.x  += s.vx;  s.y += s.vy
          s.life -= 0.016
          if (s.life <= 0) { iSparks.splice(i, 1); continue }
          const lt = s.life / s.ml
          let cr: number, cg: number, cb_: number, ca: number
          if (lt > 0.65) {
            cr = 255; cg = 255; cb_ = 255; ca = lt * 0.90
          } else if (lt > 0.30) {
            const b = (lt - 0.30) / 0.35
            cr = 255; cg = Math.floor(b * 255); cb_ = Math.floor(100 + b * 155); ca = lt * 0.85
          } else {
            cr = 255; cg = 0; cb_ = 185; ca = lt * 0.70
          }
          ctx.beginPath()
          ctx.arc(s.x, s.y, 1.2 + (1 - lt) * 0.8, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${cr},${cg},${cb_},${ca})`
          ctx.fill()
        }

        // ── White-hot overload spikes ──
        if (pt > 0.38 && compressionT < 0.88) {
          const fp = ((pt - 0.38) / 0.62) * 0.22 + (pt > 0.88 ? 0.18 : 0)
          if (Math.random() < fp)                      spawnWFlash(baseR, tSec)
          if (pt > 0.78 && Math.random() < fp * 0.55)  spawnWFlash(baseR, tSec)
        }
        for (let i = wFlashes.length - 1; i >= 0; i--) {
          const f = wFlashes[i]
          f.life -= 0.016
          if (f.life <= 0) { wFlashes.splice(i, 1); continue }
          const ft  = f.life / f.ml
          const grd = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.radius)
          grd.addColorStop(0,    `rgba(255,255,255,${ft * 0.98})`)
          grd.addColorStop(0.35, `rgba(255,55,240,${ft * 0.78})`)
          grd.addColorStop(0.72, `rgba(175,0,175,${ft * 0.38})`)
          grd.addColorStop(1,    'rgba(0,0,0,0)')
          ctx.fillStyle = grd
          ctx.beginPath()
          ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2)
          ctx.fill()
        }

        // ── Magenta crack system: turns white-hot during compression ──
        for (let i = 0; i < cracks.length; i++) {
          const c = cracks[i]
          if (pt < 0.30) {
            if (Math.random() < 0.022)       c.alpha = Math.random() * 0.26
            else                              c.alpha *= 0.78
          } else if (pt < 0.68) {
            if (Math.random() < 0.052 + pt * 0.04)
              c.alpha = Math.min(0.52, c.alpha + Math.random() * 0.22)
            c.alpha *= 0.87
          } else {
            const prevA = i > 0               ? cracks[i-1].alpha : 0
            const nextA = i < cracks.length-1 ? cracks[i+1].alpha : 0
            const contagion = (prevA + nextA) * 0.20 * (pt - 0.68)
            if (Math.random() < 0.09 + pt * 0.10 + compressionT * 0.22)
              c.alpha = Math.min(0.85 + compressionT * 0.15, c.alpha + Math.random() * 0.18 + contagion)
            c.alpha = c.alpha * (0.87 + Math.random() * 0.09)
          }

          if (c.alpha < 0.01) continue
          // White-hot color transition: magenta (255,0,200) → white (255,255,255)
          const crackG = Math.floor(compressionT * 255)
          const crackB = Math.floor(200 + compressionT * 55)
          const CSTEPS = 7
          ctx.save()
          ctx.beginPath()
          for (let s = 0; s <= CSTEPS; s++) {
            const t  = c.t0 + (s / CSTEPS) * (c.t1 - c.t0)
            const y  = Y0 + t * (Y1 - Y0)
            const jx = Math.sin(c.seed * 13.7 + s * 5.3) * 2.5
            const x  = crescentX(y) + jx
            if (s === 0) { ctx.moveTo(x, y) } else { ctx.lineTo(x, y) }
          }
          ctx.lineWidth   = 0.7 + Math.random() * 0.8
          ctx.strokeStyle = `rgba(255,${crackG},${crackB},${c.alpha})`
          ctx.shadowBlur  = 8 + compressionT * 16
          ctx.shadowColor = compressionT > 0.5 ? 'rgba(255,255,220,0.95)' : 'rgba(255,0,180,0.95)'
          ctx.stroke()
          ctx.restore()
        }

        // ── Edge leakage: stops spawning during late compression ──
        if (pt > 0.68 && compressionT < 0.70) {
          const lp = ((pt - 0.68) / 0.32) * 0.20
          if (Math.random() < lp)                      spawnLeaker(baseR, tSec)
          if (pt > 0.84 && Math.random() < lp * 0.65)  spawnLeaker(baseR, tSec)
        }
        for (let i = leakers.length - 1; i >= 0; i--) {
          const l = leakers[i]
          if (l.curve) {
            const dx = SX - l.x, dy = H/2 - l.y
            const d  = Math.hypot(dx, dy) || 1
            l.vx += (dx / d) * 0.38
            l.vy += (dy / d) * 0.38
          }
          l.vx *= 0.91;  l.vy *= 0.91
          l.x  += l.vx;  l.y  += l.vy
          l.life -= 0.016
          if (l.life <= 0) { leakers.splice(i, 1); continue }
          const lt    = l.life / l.ml
          const isWht = lt > 0.55
          ctx.save()
          ctx.beginPath()
          ctx.arc(l.x, l.y, 1.8, 0, Math.PI * 2)
          ctx.fillStyle   = isWht ? `rgba(255,255,255,${lt*0.88})` : `rgba(255,0,200,${lt*0.78})`
          ctx.shadowBlur  = isWht ? 10 : 6
          ctx.shadowColor = isWht ? 'rgba(255,255,220,0.85)' : 'rgba(255,0,180,0.80)'
          ctx.fill()
          ctx.restore()
        }

        // ── Perimeter lightning (1000–1500ms): spawns at blobRadius+5, clipped outside ──
        if (lightningT > 0 && baseR > 1) {
          const isHugging   = compressionT > 0
          const spawnChance = isHugging
            ? 0.38 + compressionT * 0.50
            : 0.18 + lightningT * 0.22
          if (Math.random() < spawnChance)                        spawnBolt(baseR, tSec, freqMult, isHugging)
          if (Math.random() < spawnChance * 0.65)                 spawnBolt(baseR, tSec, freqMult, isHugging)
          if (isHugging && Math.random() < compressionT * 0.55)   spawnBolt(baseR, tSec, freqMult, isHugging)
        }

        if (bolts.length > 0 && baseR > 1) {
          const N_CLIP = 60
          ctx.save()
          ctx.beginPath()
          ctx.rect(-W * 0.5, -H * 0.5, W * 2, H * 2)
          for (let ci = 0; ci <= N_CLIP; ci++) {
            const ca  = (ci / N_CLIP) * Math.PI * 2
            const cr  = calcBlobR(ca, tSec, baseR, freqMult)
            const cx_ = SX  + Math.cos(ca) * cr
            const cy_ = H/2 + Math.sin(ca) * cr
            if (ci === 0) ctx.moveTo(cx_, cy_)
            else          ctx.lineTo(cx_, cy_)
          }
          ctx.closePath()
          ctx.clip('evenodd')

          for (let i = bolts.length - 1; i >= 0; i--) {
            const bolt   = bolts[i]
            bolt.life   -= 0.016
            if (bolt.life <= 0) { bolts.splice(i, 1); continue }
            const boltA  = bolt.life / bolt.ml
            const segLen = bolt.length / bolt.segs.length
            ctx.save()
            ctx.beginPath()
            let cx = bolt.startX
            let cy = bolt.startY
            ctx.moveTo(cx, cy)
            for (const perp of bolt.segs) {
              cx += bolt.dirX * segLen + (-bolt.dirY) * perp
              cy += bolt.dirY * segLen + ( bolt.dirX) * perp
              ctx.lineTo(cx, cy)
            }
            ctx.lineWidth   = 0.8 + boltA * 1.2
            ctx.strokeStyle = `rgba(255,0,200,${boltA * 0.88})`
            ctx.shadowBlur  = 10
            ctx.shadowColor = 'rgba(255,0,200,0.92)'
            ctx.lineCap     = 'round'
            ctx.lineJoin    = 'round'
            ctx.stroke()
            ctx.restore()
          }

          ctx.restore()
        }

      // ════════════════════════════════════════════════════════════
      // PHASE 2 — INSTANT SLASH  (1500–1650ms)
      // ════════════════════════════════════════════════════════════
      } else if (elapsed < SLASH_END) {
        const pt      = (elapsed - CHARGE_END) / (SLASH_END - CHARGE_END)
        const slashMs = elapsed - CHARGE_END

        // Flash frame: 10% magenta overlay decaying to 0 over 50ms
        const flashAlpha = Math.max(0, 0.10 * (1 - slashMs / 50))
        if (flashAlpha > 0.001) {
          ctx.fillStyle = `rgba(255,0,200,${flashAlpha})`
          ctx.fillRect(0, 0, W, H)
        }

        const lumBoost = Math.max(0, 1 - slashMs / 30)
        drawEdge(1.0, 1, lumBoost)

        // First frame: clear Phase 1 residuals, burst fragments, radial-kick particles
        if (!fragmentsBurst) {
          fragmentsBurst = true
          bolts.length = 0
          spawnFragments(88 + Math.floor(Math.random() * 38))
          for (const l of leakers) {
            const dx = l.x - SX
            const dy = l.y - H / 2
            const d  = Math.hypot(dx, dy) || 1
            l.vx = (dx / d) * (18 + Math.random() * 14)
            l.vy = (dy / d) * (18 + Math.random() * 14)
            l.curve = false
            l.ml = Math.max(l.ml, l.life + 0.20)
          }
          for (const s of iSparks) {
            const dx = s.x - SX
            const dy = s.y - H / 2
            const d  = Math.hypot(dx, dy) || 1
            s.vx = (dx / d) * (20 + Math.random() * 12)
            s.vy = (dy / d) * (20 + Math.random() * 12)
          }
        }

        // Distortion shockwave ripple
        const rR = pt * Math.min(W, H) * 0.28
        const rG = ctx.createRadialGradient(SX, H/2, rR * 0.8, SX, H/2, rR)
        rG.addColorStop(0,   'rgba(0,0,0,0)')
        rG.addColorStop(0.6, `rgba(200,0,210,${(1-pt)*0.11})`)
        rG.addColorStop(1,   'rgba(0,0,0,0)')
        ctx.fillStyle = rG
        ctx.beginPath()
        ctx.arc(SX, H/2, rR, 0, Math.PI * 2)
        ctx.fill()

        // Draw fragment streaks
        for (let i = fragments.length - 1; i >= 0; i--) {
          const f = fragments[i]
          const px = f.x;  const py = f.y
          f.x += f.vx;  f.y += f.vy
          f.vx *= 0.86;  f.vy *= 0.88
          f.life -= 0.045
          if (f.life <= 0) { fragments.splice(i, 1); continue }
          const a  = f.life / f.ml
          ctx.save()
          ctx.beginPath()
          ctx.moveTo(px, py)
          ctx.lineTo(f.x, f.y)
          ctx.lineWidth   = 1.2 + a * 2
          ctx.strokeStyle = `rgba(255,${Math.floor(a*55)},${Math.floor(a*195)},${a})`
          ctx.lineCap     = 'round'
          ctx.shadowBlur  = 9
          ctx.shadowColor = 'rgba(255,0,200,0.7)'
          ctx.stroke()
          ctx.restore()
        }

        // Draw shockwave-ejected leakage sparks
        for (let i = leakers.length - 1; i >= 0; i--) {
          const l = leakers[i]
          l.x += l.vx;  l.y += l.vy
          l.vx *= 0.88;  l.vy *= 0.88
          l.life -= 0.055
          if (l.life <= 0) { leakers.splice(i, 1); continue }
          const a = l.life / l.ml
          ctx.save()
          ctx.beginPath()
          ctx.arc(l.x, l.y, 2.2 + a * 1.5, 0, Math.PI * 2)
          ctx.fillStyle   = `rgba(255,${Math.floor(a * 200)},255,${a * 0.92})`
          ctx.shadowBlur  = 12
          ctx.shadowColor = 'rgba(255,180,255,0.85)'
          ctx.fill()
          ctx.restore()
        }

        // Draw radially-kicked internal sparks
        for (let i = iSparks.length - 1; i >= 0; i--) {
          const s = iSparks[i]
          s.x += s.vx;  s.y += s.vy
          s.vx *= 0.84;  s.vy *= 0.84
          s.life -= 0.035
          if (s.life <= 0) { iSparks.splice(i, 1); continue }
          const a = s.life / s.ml
          ctx.beginPath()
          ctx.arc(s.x, s.y, 1.4, 0, Math.PI * 2)
          ctx.fillStyle = a > 0.5
            ? `rgba(255,255,255,${a * 0.85})`
            : `rgba(255,0,200,${a * 0.75})`
          ctx.fill()
        }

      // ════════════════════════════════════════════════════════════
      // PHASE 3 — PARTICLE SURGE + BLACK CONSUME  (1150–2100ms)
      // ════════════════════════════════════════════════════════════
      } else if (elapsed < CONSUME_END) {
        const pt  = (elapsed - SLASH_END) / (CONSUME_END - SLASH_END)

        // Slash-origin expansion: thick stroke on crescent = all pixels within
        // consumeR of the slash line, expanding equally on both sides.
        // maxR covers the furthest screen edge from the crescent (~W*0.58 + buffer).
        const maxR     = W * 0.63
        const consumeR = Math.max(W * 0.02, easeOut(pt) * maxR)
        const falloff  = Math.min(consumeR * 0.06, 10)
        ctx.save()
        ctx.beginPath()
        traceCrescent()
        ctx.lineWidth   = consumeR * 2
        ctx.strokeStyle = 'rgba(0,0,0,1)'
        ctx.lineCap     = 'butt'
        ctx.lineJoin    = 'round'
        ctx.shadowBlur  = falloff
        ctx.shadowColor = 'rgba(0,0,0,1)'
        ctx.stroke()
        ctx.restore()

        // Edge glow fades as darkness takes over
        drawEdge(Math.max(0, 1 - pt * 1.6))

        // Surge intensity decays over consume phase
        const surge = Math.max(0, 1 - easeOut(pt) * 0.75)

        // Foreground: sharp streak fragments continue (early surge only)
        if (pt < 0.28 && Math.random() < surge * 0.55) spawnFragments(2 + Math.floor(Math.random()*4))
        for (let i = fragments.length - 1; i >= 0; i--) {
          const f = fragments[i]
          const px = f.x;  const py = f.y
          f.x += f.vx;  f.y += f.vy
          f.vx *= 0.91;  f.vy *= 0.92
          f.life -= 0.020
          if (f.life <= 0) { fragments.splice(i, 1); continue }
          const a  = f.life / f.ml
          ctx.save()
          ctx.beginPath()
          ctx.moveTo(px, py)
          ctx.lineTo(f.x, f.y)
          ctx.lineWidth   = 1 + a * 1.8
          ctx.strokeStyle = `rgba(255,${Math.floor(a*50)},${Math.floor(a*185)},${a*0.88})`
          ctx.lineCap     = 'round'
          ctx.shadowBlur  = 7
          ctx.shadowColor = 'rgba(255,0,200,0.6)'
          ctx.stroke()
          ctx.restore()
        }

        // Mid: energy wisps with curved drift
        if (Math.random() < surge * 0.55 + 0.12) spawnWisp()
        if (Math.random() < 0.35)                  spawnWisp()
        for (let i = wisps.length - 1; i >= 0; i--) {
          const w = wisps[i]
          w.vx += w.k
          w.x  += w.vx;  w.y += w.vy
          w.vy *= 0.97
          w.life -= 0.014
          if (w.life <= 0) { wisps.splice(i, 1); continue }
          const a = w.life / w.ml
          ctx.save()
          ctx.beginPath()
          ctx.arc(w.x, w.y, 3 + a * 4.5, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(175,0,205,${a * a * 0.48})`
          ctx.shadowBlur  = 13
          ctx.shadowColor = 'rgba(210,0,220,0.55)'
          ctx.fill()
          ctx.restore()
        }

        // Background: slow drifting embers
        if (Math.random() < 0.32) spawnEmber()
        if (Math.random() < 0.18) spawnEmber()
        for (let i = embers.length - 1; i >= 0; i--) {
          const e = embers[i]
          e.x += e.vx;  e.y += e.vy
          e.life -= 0.008
          if (e.life <= 0) { embers.splice(i, 1); continue }
          ctx.beginPath()
          ctx.arc(e.x, e.y, 1.5, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(185,0,165,${(e.life/e.ml)*0.28})`
          ctx.fill()
        }

      // ════════════════════════════════════════════════════════════
      // PHASE 4 — ENERGY HOLD  (2100–2500ms)
      // ════════════════════════════════════════════════════════════
      } else if (elapsed < HOLD_END) {
        const pt = (elapsed - CONSUME_END) / (HOLD_END - CONSUME_END)

        if (!callbackFired) {
          callbackFired = true
          callbackRef.current?.()
        }

        ctx.fillStyle = 'black'
        ctx.fillRect(0, 0, W, H)

        // Occasional slash-line flicker
        if (Math.random() < 0.14 * (1 - pt)) {
          ctx.save()
          ctx.globalAlpha = Math.random() * 0.14 * (1 - pt)
          traceCrescent()
          ctx.lineWidth   = 1
          ctx.strokeStyle = 'rgba(255,0,175,0.7)'
          ctx.shadowBlur  = 10
          ctx.shadowColor = 'rgba(255,0,200,0.9)'
          ctx.stroke()
          ctx.restore()
        }

        // Drifting embers persist
        if (Math.random() < 0.18) spawnEmber()
        for (let i = embers.length - 1; i >= 0; i--) {
          const e = embers[i]
          e.x += e.vx;  e.y += e.vy - 0.14
          e.life -= 0.010
          if (e.life <= 0) { embers.splice(i, 1); continue }
          ctx.beginPath()
          ctx.arc(e.x, e.y, 1.2, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(205,0,175,${(e.life/e.ml)*0.23})`
          ctx.fill()
        }

      // ════════════════════════════════════════════════════════════
      // PHASE 5 — SMOKE DISSIPATION  (2500–5200ms)
      //   Base fill (from top-of-frame) stays intact every frame.
      //   destination-out uniformly reduces its alpha to smokeAlpha,
      //   then erosion nodes punch additional holes — no clearRect,
      //   no gap, no white corners possible.
      // ════════════════════════════════════════════════════════════
      } else if (elapsed < REVEAL_END) {
        const pt         = (elapsed - HOLD_END) / (REVEAL_END - HOLD_END)
        const smokeAlpha = Math.max(0, Math.pow(1 - pt, 0.72))
        const fadeAlpha  = 1 - smokeAlpha  // how much to erode the base fill

        // ── Uniform opacity reduction via destination-out ─────────────
        // Reduces base fill from alpha=1 down to smokeAlpha without
        // ever creating a gap — no clearRect, no white-corner risk.
        if (fadeAlpha > 0.001) {
          ctx.save()
          ctx.globalCompositeOperation = 'destination-out'
          ctx.globalAlpha = fadeAlpha
          ctx.fillStyle   = 'rgba(0,0,0,1)'
          ctx.fillRect(0, 0, W, H)
          ctx.restore()
        }

        if (smokeAlpha > 0.004) {
          // ── Expanding smoke clearings (destination-out) ─────────────
          ctx.save()
          ctx.globalCompositeOperation = 'destination-out'
          for (const n of erosionNodes) {
            // Drift nodes upward each frame (smoke rises)
            n.x += n.vx
            n.y += n.vy
            if (pt <= n.t0) continue
            const np = Math.min(1, (pt - n.t0) / 0.32)
            const r  = easeOut(np) * n.maxR
            if (r < 0.8) continue
            const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r)
            g.addColorStop(0,    'rgba(0,0,0,1)')
            g.addColorStop(0.42, 'rgba(0,0,0,0.72)')
            g.addColorStop(0.78, 'rgba(0,0,0,0.22)')
            g.addColorStop(1,    'rgba(0,0,0,0)')
            ctx.fillStyle = g
            ctx.beginPath()
            ctx.arc(n.x, n.y, r, 0, Math.PI * 2)
            ctx.fill()
          }
          ctx.restore()
        }

        // ── Faint wispy particles at smoke edges ─────────────────────
        if (smokeAlpha > 0.05 && Math.random() < 0.12) {
          embers.push({
            x:    Math.random() * W,
            y:    Math.random() * H,
            vx:   (Math.random() - 0.5) * 0.35,
            vy:   -(0.22 + Math.random() * 0.45),
            life: 0.7 + Math.random() * 0.6,
            ml:   1.3,
          })
        }
        for (let i = embers.length - 1; i >= 0; i--) {
          const e = embers[i]
          e.x += e.vx;  e.y += e.vy
          e.life -= 0.007
          if (e.life <= 0) { embers.splice(i, 1); continue }
          const a = (e.life / e.ml) * smokeAlpha * 0.12
          if (a < 0.004) continue
          ctx.beginPath()
          ctx.arc(e.x, e.y, 2.2, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(160,160,165,${a})`
          ctx.fill()
        }

      } else if (elapsed < REVEAL_END + 220) {
        // Grace window: fully erode base fill to transparent, delay DOM removal
        ctx.save()
        ctx.globalCompositeOperation = 'destination-out'
        ctx.globalAlpha = 1
        ctx.fillStyle   = 'rgba(0,0,0,1)'
        ctx.fillRect(0, 0, W, H)
        ctx.restore()
      } else {
        setActive(false)
        return
      }

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(animRef.current) }
  }, [active])

  const ctxValue = useMemo(() => ({ triggerBankai }), [triggerBankai])

  return (
    <BankaiContext.Provider value={ctxValue}>
      {children}
      {active && (
        <div
          className={shaking ? 'bankai-shaking' : undefined}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none' }}
        >
          <canvas
            ref={canvasRef}
            style={{ display: 'block', width: '100%', height: '100%' }}
          />
        </div>
      )}
    </BankaiContext.Provider>
  )
}
