import type { RegimeScores } from '../types/regime'

interface Props {
  regime: string
  probability: number
  total_score: number
  max_score: number
  scores: RegimeScores
}

const RANGES = [
  { label: 'Risk-On', range: '0–2.5' },
  { label: 'Neutral',  range: '2.5–5.0' },
  { label: 'Risk-Off', range: '5.0–7.5' },
  { label: 'Crisis',   range: '7.5–10' },
]

const CONTRIBUTOR_COLORS = ['#3b82f6', '#f59e0b', '#22c55e', '#ef4444']

export function RegimeBreakdown({ regime, probability, total_score, max_score, scores }: Props) {
  const pct   = Math.round((total_score / max_score) * 100)
  const total = scores.growth + scores.inflation + scores.financial_conditions + scores.market_risk

  return (
    <div className="bg-surface-container rounded-lg p-5">
      <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4">Regime Score Breakdown</h3>

      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl font-black tabular-nums text-white">
          {total_score.toFixed(1)}{' '}
          <span className="text-xs font-medium text-on-surface-variant">/ {max_score.toFixed(1)}</span>
        </span>
        <span className="text-xs font-bold uppercase" style={{ color: 'var(--accent)' }}>{regime}</span>
      </div>

      <div className="relative h-1.5 w-full bg-surface-container-highest rounded-full mb-6 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: 'var(--accent)' }}
        />
      </div>

      <div className="space-y-3">
        {RANGES.map((r) => {
          const isActive = r.label === regime
          return (
            <div
              key={r.label}
              className="flex justify-between items-center text-[10px]"
              style={{ color: isActive ? 'var(--accent)' : '#6b7280', fontWeight: isActive ? 700 : 400 }}
            >
              <span>{r.label} ({r.range})</span>
              {isActive ? (
                <span
                  className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                  style={{ background: 'rgba(198,255,31,0.12)', border: '1px solid rgba(198,255,31,0.3)', color: 'var(--accent)' }}
                >
                  Active
                </span>
              ) : (
                <span className="material-symbols-outlined text-[12px] opacity-20">radio_button_unchecked</span>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-8">
        <div className="text-[10px] uppercase font-bold tracking-widest mb-4 text-on-surface-variant">Score Contributors</div>
        {/* Segmented bar with gaps and rounded caps */}
        <div className="relative h-2 w-full flex rounded-full overflow-hidden gap-0.5 bg-surface-container-highest">
          {(() => {
            const segs = [
              { label: 'G', val: scores.growth,               color: CONTRIBUTOR_COLORS[0] },
              { label: 'I', val: scores.inflation,            color: CONTRIBUTOR_COLORS[1] },
              { label: 'F', val: scores.financial_conditions, color: CONTRIBUTOR_COLORS[2] },
              { label: 'M', val: scores.market_risk,          color: CONTRIBUTOR_COLORS[3] },
            ]
            if (total === 0) return <div className="h-full w-full rounded-full bg-surface-container-high opacity-30" />
            return segs.filter(s => s.val > 0).map((seg) => (
              <div
                key={seg.label}
                className="h-full transition-all duration-700"
                style={{
                  width: `${(seg.val / total) * 100}%`,
                  background: seg.color,
                  boxShadow: `0 0 8px ${seg.color}88`,
                }}
              />
            ))
          })()}
        </div>
        {/* Legend — refined rows */}
        <div className="mt-4 space-y-2">
          {[
            { label: 'Growth',    val: scores.growth,               color: CONTRIBUTOR_COLORS[0], max: 4 },
            { label: 'Inflation', val: scores.inflation,            color: CONTRIBUTOR_COLORS[1], max: 4 },
            { label: 'Financial', val: scores.financial_conditions, color: CONTRIBUTOR_COLORS[2], max: 4 },
            { label: 'Market',    val: scores.market_risk,          color: CONTRIBUTOR_COLORS[3], max: 4 },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.color, boxShadow: `0 0 4px ${s.color}` }} />
              <span className="text-[10px] text-on-surface-variant w-14">{s.label}</span>
              <div className="flex-1 h-px rounded-full bg-surface-container-highest overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(s.val / s.max) * 100}%`, background: s.color, opacity: 0.7 }} />
              </div>
              <span className="text-[10px] tabular-nums text-on-surface-variant w-8 text-right">{s.val.toFixed(1)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 text-[9px] text-on-surface-variant text-right">
        Stress Level:{' '}
        <span className="font-bold" style={{ color: 'var(--accent)' }}>{Math.round(probability * 100)}%</span>
      </div>
    </div>
  )
}
