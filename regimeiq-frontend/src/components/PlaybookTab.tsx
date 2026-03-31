import type { FedWatch, GlobalMacroSnapshot } from '../types/regime'

interface Props {
  regime: string
  totalScore: number
  fedwatch: FedWatch
  globalMacro: GlobalMacroSnapshot
}

export function PlaybookTab({ regime, totalScore, fedwatch, globalMacro }: Props) {
  const cut = Math.round(fedwatch.next_3m.cut * 100)
  const hold = Math.round(fedwatch.next_3m.hold * 100)
  const hike = Math.round(fedwatch.next_3m.hike * 100)
  const dxy = globalMacro.dxy_3m_pct_change ?? 0
  const cpi = globalMacro.cpi_yoy ?? 0

  const bias =
    regime === 'Risk-Off' || regime === 'Crisis'
      ? 'Defensive tilt'
      : regime === 'Neutral'
        ? 'Balanced tilt'
        : 'Risk-on tilt'

  return (
    <section className="ml-0 md:ml-64 pt-20 p-6 min-h-screen space-y-6">
      <div className="bg-gradient-to-r from-[#1b1c22] to-[#262834] rounded-xl p-5 border border-primary/30 shadow-[0_0_40px_rgba(78,222,163,0.12)]">
        <h2 className="text-sm font-black uppercase tracking-widest text-primary mb-2">Playbook</h2>
        <div className="text-xs text-on-surface-variant">Actionable regime guidance and policy context.</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="bg-surface-container rounded-xl p-4 border border-outline-variant/20">
          <div className="text-on-surface-variant uppercase">Current Regime</div>
          <div className="text-2xl font-black">{regime}</div>
          <div className="text-on-surface-variant mt-1">Score: {totalScore}/13</div>
        </div>
        <div className="bg-surface-container rounded-xl p-4 border border-outline-variant/20">
          <div className="text-on-surface-variant uppercase">Policy Bias</div>
          <div className="text-2xl font-black">{bias}</div>
          <div className="text-on-surface-variant mt-1">FedWatch cut/hold/hike: {cut}/{hold}/{hike}%</div>
        </div>
        <div className="bg-surface-container rounded-xl p-4 border border-outline-variant/20">
          <div className="text-on-surface-variant uppercase">Macro Pressure</div>
          <div className="text-2xl font-black">{Math.round((cpi + dxy * 10) * 10) / 10}</div>
          <div className="text-on-surface-variant mt-1">Derived from CPI + DXY trend</div>
        </div>
      </div>

      <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20 text-xs">
        <div className="font-bold uppercase tracking-widest text-on-surface-variant mb-3">Suggested Actions</div>
        <div className="space-y-2">
          <div>- If DXY keeps rising and VIX stays elevated, stay underweight cyclicals.</div>
          <div>- If Fed hold probability dominates, keep duration balanced and avoid excessive beta.</div>
          <div>- If regime drops back to Neutral and momentum stabilizes, scale risk gradually.</div>
        </div>
      </div>
    </section>
  )
}
