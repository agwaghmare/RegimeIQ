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
  { label: 'Neutral', range: '2.5–5' },
  { label: 'Risk-Off', range: '5–7.5' },
  { label: 'Crisis', range: '7.5–10' },
]

export function RegimeBreakdown({ regime, probability, total_score, max_score, scores }: Props) {
  const pct = Math.round((total_score / max_score) * 100)
  const total = scores.growth + scores.inflation + scores.financial_conditions + scores.market_risk

  return (
    <div className="bg-surface-container rounded-lg p-5">
      <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4">Regime Score Breakdown</h3>
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl font-black tabular-nums">
          {total_score.toFixed(1)} <span className="text-xs font-medium text-on-surface-variant">/ {max_score.toFixed(1)}</span>
        </span>
        <span className="text-xs font-bold text-primary uppercase">{regime}</span>
      </div>
      <div className="relative h-2 w-full bg-surface-container-highest rounded-full mb-6 flex overflow-hidden">
        <div className="h-full bg-primary" style={{ width: `${pct}%` }}></div>
      </div>
      <div className="space-y-4">
        {RANGES.map((r) => {
          const isActive = r.label === regime
          return (
            <div
              key={r.label}
              className={`flex justify-between items-center text-[10px] ${isActive ? 'text-primary font-bold' : 'text-on-surface-variant'}`}
            >
              <span>{r.label} ({r.range})</span>
              {isActive ? (
                <span className="bg-primary/20 px-1 rounded">Active</span>
              ) : (
                <span className="material-symbols-outlined text-[12px] opacity-30">radio_button_unchecked</span>
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-8">
        <div className="text-[10px] uppercase font-bold tracking-widest mb-3">Score Contributors</div>
        <div className="h-8 w-full flex rounded overflow-hidden">
          {total > 0 && (
            <>
              <div className="h-full bg-primary-container flex items-center justify-center text-[9px] font-bold" style={{ width: `${(scores.growth / total) * 100}%` }}>G</div>
              <div className="h-full bg-primary flex items-center justify-center text-[9px] font-bold text-on-primary" style={{ width: `${(scores.inflation / total) * 100}%` }}>I</div>
              <div className="h-full bg-secondary-container flex items-center justify-center text-[9px] font-bold" style={{ width: `${(scores.financial_conditions / total) * 100}%` }}>F</div>
              <div className="h-full bg-surface-container-highest flex items-center justify-center text-[9px] font-bold" style={{ width: `${(scores.market_risk / total) * 100}%` }}>M</div>
            </>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4 text-[9px] text-on-surface-variant">
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary-container"></span> Growth ({scores.growth.toFixed(1)})</div>
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary"></span> Inflation ({scores.inflation.toFixed(1)})</div>
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-secondary-container"></span> Financial ({scores.financial_conditions.toFixed(1)})</div>
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-surface-container-highest"></span> Market ({scores.market_risk.toFixed(1)})</div>
        </div>
      </div>
      <div className="mt-4 text-[9px] text-on-surface-variant text-right">
        Probability: <span className="text-primary font-bold">{Math.round(probability * 100)}%</span>
      </div>
    </div>
  )
}
