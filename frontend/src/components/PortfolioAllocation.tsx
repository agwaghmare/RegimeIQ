import type { Allocation } from '../types/regime'

interface Props {
  allocation: Allocation
  regime: string
}

export function PortfolioAllocation({ allocation, regime }: Props) {
  const bars = [
    { label: 'Equities (SPY/QQQ)', pct: Math.round(allocation.equities * 100), barColor: 'bg-primary' },
    { label: 'Fixed Income (TLT/AGG)', pct: Math.round(allocation.bonds * 100), barColor: 'bg-secondary-dim' },
    { label: 'Alternatives (GLD/BTC)', pct: Math.round(allocation.alternatives * 100), barColor: 'bg-tertiary-dim' },
  ]

  const regimeLabel = regime === 'Risk-On' || regime === 'Expansion'
    ? 'over-weighting risk assets. Maintain 10% trailing stops on broad indices.'
    : 'rotating into defensive assets. Reduce equity exposure and favour duration.'

  return (
    <div className="bg-surface-container rounded-lg p-5">
      <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-6">Optimized Allocation</h3>
      <div className="space-y-5">
        {bars.map((b) => (
          <div key={b.label} className="space-y-2">
            <div className="flex justify-between text-[11px]">
              <span className="font-medium">{b.label}</span>
              <span className="font-bold">{b.pct}%</span>
            </div>
            <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
              <div className={`h-full ${b.barColor} rounded-full`} style={{ width: `${b.pct}%` }}></div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-8 p-3 rounded bg-primary-container/20 border border-primary/10">
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
