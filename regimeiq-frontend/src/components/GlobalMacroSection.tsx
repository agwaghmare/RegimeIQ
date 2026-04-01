interface Props {
  updatedAt: string
  realRate: string
  cpiYoy: string
  fedFunds3mChange: string
  dxy3mChange: string
}

function statusClass(value: number, high: number, low: number): string {
  if (!Number.isFinite(value)) return 'text-on-surface-variant'
  if (value >= high) return 'text-error'
  if (value <= low) return 'text-primary'
  return 'text-on-surface'
}

export function GlobalMacroSection({ updatedAt, realRate, cpiYoy, fedFunds3mChange, dxy3mChange }: Props) {
  const policyDelta = Number(fedFunds3mChange)

  return (
    <section id="global-macro" className="bg-surface-container rounded-lg p-5 space-y-4 scroll-mt-24">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Global Macro</h3>
        <span className="text-[10px] uppercase text-on-surface-variant">Updated: {updatedAt}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="bg-surface-container-low rounded p-3">
          <div className="text-on-surface-variant mb-1">Fed Policy (3M)</div>
          <div className={`font-bold ${statusClass(policyDelta, 0.0, -0.25)}`}>
            {fedFunds3mChange}
          </div>
          <div className="text-[10px] text-on-surface-variant mt-1">
            Proxy for higher-for-longer vs easing policy path
          </div>
        </div>
        <div className="bg-surface-container-low rounded p-3">
          <div className="text-on-surface-variant mb-1">US Real Rate (10Y)</div>
          <div className="font-bold">{realRate}</div>
          <div className="text-[10px] text-on-surface-variant mt-1">Restrictive real rates usually pressure risk assets</div>
        </div>
        <div className="bg-surface-container-low rounded p-3">
          <div className="text-on-surface-variant mb-1">US CPI YoY</div>
          <div className="font-bold">{cpiYoy}</div>
          <div className="text-[10px] text-on-surface-variant mt-1">Inflation persistence input to regime scoring</div>
        </div>
        <div className="bg-surface-container-low rounded p-3">
          <div className="text-on-surface-variant mb-1">DXY 3M Change</div>
          <div className="font-bold">{dxy3mChange}</div>
          <div className="text-[10px] text-on-surface-variant mt-1">Dollar stress indicator for global financial conditions</div>
        </div>
      </div>

      <div className="text-[11px] text-on-surface-variant">
        Tracked policy blocks: Fed stance, BoJ yield control sensitivity, ECB rates, and UK gilt stress.
      </div>
    </section>
  )
}
