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
        <div className="text-[10px] uppercase font-bold tracking-widest mb-3 text-on-surface-variant">Score Contributors</div>
        <div className="h-6 w-full flex rounded overflow-hidden gap-px">
          {total > 0 && [
            { label: 'G', val: scores.growth,                color: CONTRIBUTOR_COLORS[0] },
            { label: 'I', val: scores.inflation,             color: CONTRIBUTOR_COLORS[1] },
            { label: 'F', val: scores.financial_conditions,  color: CONTRIBUTOR_COLORS[2] },
            { label: 'M', val: scores.market_risk,           color: CONTRIBUTOR_COLORS[3] },
          ].map((seg) => (
            <div
              key={seg.label}
              className="h-full flex items-center justify-center text-[9px] font-bold text-white"
              style={{ width: `${(seg.val / total) * 100}%`, background: seg.color }}
            >
              {seg.label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3 text-[9px] text-on-surface-variant">
          {[
            { label: 'Growth',    val: scores.growth,                color: CONTRIBUTOR_COLORS[0] },
            { label: 'Inflation', val: scores.inflation,             color: CONTRIBUTOR_COLORS[1] },
            { label: 'Financial', val: scores.financial_conditions,  color: CONTRIBUTOR_COLORS[2] },
            { label: 'Market',    val: scores.market_risk,           color: CONTRIBUTOR_COLORS[3] },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
              {s.label} ({s.val.toFixed(1)})
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 text-[9px] text-on-surface-variant text-right">
        Probability:{' '}
        <span className="font-bold" style={{ color: 'var(--accent)' }}>{Math.round(probability * 100)}%</span>
      </div>
    </div>
  )
}
