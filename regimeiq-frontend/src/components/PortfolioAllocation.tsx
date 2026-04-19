import type { Allocation } from '../types/regime'

interface Props {
  allocation: Allocation
  regime: string
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const span = Math.min(endDeg - startDeg, 359.9)
  const s = polarToCartesian(cx, cy, r, startDeg)
  const e = polarToCartesian(cx, cy, r, startDeg + span)
  const large = span > 180 ? 1 : 0
  return `M ${s.x.toFixed(3)} ${s.y.toFixed(3)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(3)} ${e.y.toFixed(3)}`
}

export function PortfolioAllocation({ allocation, regime }: Props) {
  const segments = [
    { key: 'eq', label: 'Equities',     pct: allocation.equities,    color: '#3b82f6' },
    { key: 'bd', label: 'Fixed Income', pct: allocation.bonds,       color: '#22c55e' },
    { key: 'alt', label: 'Alternatives', pct: allocation.alternatives, color: '#f59e0b' },
  ]
  const eqDeg = segments[0].pct * 360
  const bdDeg = segments[1].pct * 360
  const withAngles = [
    { ...segments[0], start: 0, end: eqDeg },
    { ...segments[1], start: eqDeg, end: eqDeg + bdDeg },
    { ...segments[2], start: eqDeg + bdDeg, end: 360 },
  ]

  const regimeLabel = regime === 'Risk-On' || regime === 'Expansion'
    ? 'over-weighting risk assets. Maintain 10% trailing stops on broad indices.'
    : 'rotating into defensive assets. Reduce equity exposure and favour duration.'

  return (
    <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20 shadow-sm">
      <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4">Suggested Allocation</h3>
      <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-4 items-center">
        <div className="mx-auto">
          <svg viewBox="0 0 160 160" width={140} height={140}>
            <circle cx={80} cy={80} r={50} fill="none" stroke="currentColor" strokeWidth={22} className="text-surface-container-highest" />
            {withAngles.map((seg) => (
              <path
                key={seg.key}
                d={arcPath(80, 80, 50, seg.start, seg.end)}
                fill="none"
                stroke={seg.color}
                strokeWidth={22}
              />
            ))}
            <text x={80} y={78} textAnchor="middle" className="fill-on-surface-variant" fontSize={9}>Regime Mix</text>
            <text x={80} y={94} textAnchor="middle" className="fill-on-surface" fontSize={13} fontWeight={700}>{regime}</text>
          </svg>
        </div>
        <div className="space-y-4">
          {withAngles.map((seg) => (
            <div key={seg.key} className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="font-medium">{seg.label}</span>
                <span className="font-bold tabular-nums" style={{ color: seg.color }}>{Math.round(seg.pct * 100)}%</span>
              </div>
              <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.round(seg.pct * 100)}%`, backgroundColor: seg.color }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-5 p-3 rounded bg-primary-container/20 border border-primary/10">
        <div className="flex gap-2 items-start">
          <span className="material-symbols-outlined text-primary text-sm">lightbulb</span>
          <p className="text-[10px] leading-relaxed text-on-primary-container">
            The current <span className="font-bold italic">{regime}</span> regime suggests {regimeLabel}
          </p>
        </div>
      </div>
    </div>
  )
}
