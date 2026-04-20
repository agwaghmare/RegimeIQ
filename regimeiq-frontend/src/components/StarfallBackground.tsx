import { memo, useMemo } from 'react'

const STAR_COUNT = 200

function rnd(min: number, max: number) {
  return min + Math.random() * (max - min)
}

interface Star {
  id: number
  x: number
  y: number
  size: number
  opacity: number
}

const STARS: Star[] = Array.from({ length: STAR_COUNT }, (_, i) => ({
  id: i,
  x: rnd(0, 100),
  y: rnd(0, 100),
  size: rnd(0.6, 1.8),
  opacity: rnd(0.25, 0.75),
}))

function StarfallBackgroundInner() {
  const stars = useMemo(() => STARS.map(s => (
    <div
      key={s.id}
      style={{
        position: 'absolute',
        left: `${s.x}%`,
        top: `${s.y}%`,
        width:  `${s.size}px`,
        height: `${s.size}px`,
        borderRadius: '50%',
        background: '#fff',
        opacity: s.opacity,
      }}
    />
  )), [])

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -10,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      {stars}
    </div>
  )
}

export const StarfallBackground = memo(StarfallBackgroundInner)
