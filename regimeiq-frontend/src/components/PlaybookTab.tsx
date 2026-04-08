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
  const real = globalMacro.real_rate_10y ?? 0

  const bias =
    regime === 'Risk-Off' || regime === 'Crisis'
      ? 'Defensive tilt'
      : regime === 'Neutral'
        ? 'Balanced tilt'
        : 'Risk-on tilt'

  const regimeLabel =
    regime === 'Neutral' ? 'Neutral (Defensive Lean)' : regime
  const macroPressure = Math.round((cpi + real + dxy * 10) * 10) / 10
  const inferredDrivers = [
    'Rising unemployment',
    'Weak PMI',
    'Stable inflation',
  ]

  return (
    <section className="ml-0 md:ml-64 pt-20 p-6 min-h-screen space-y-6">
      <div className="bg-gradient-to-r from-[#1b1c22] to-[#262834] rounded-xl p-5 border border-primary/30 shadow-[0_0_40px_rgba(78,222,163,0.12)]">
        <h2 className="text-sm font-black uppercase tracking-widest text-primary mb-2">Playbook</h2>
        <div className="text-xs text-on-surface-variant">Actionable regime guidance and policy context.</div>
      </div>

      <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20 text-sm space-y-4">
        <div>
          <div className="text-on-surface-variant uppercase text-xs">Current Regime</div>
          <div className="text-xl font-black">{regimeLabel}</div>
          <div className="text-on-surface-variant">Score: {totalScore.toFixed(1)}/10</div>
        </div>

        <div>
          <div className="text-on-surface-variant uppercase text-xs">Policy Bias</div>
          <div className="font-semibold">{bias === 'Balanced tilt' ? 'Defensive within Neutral regime' : bias}</div>
        </div>

        <div>
          <div className="text-on-surface-variant uppercase text-xs">Policy Expectation</div>
          <div className="font-semibold">Higher-for-longer (Fed hold-dominant: {cut}% cut / {hold}% hold / {hike}% hike)</div>
        </div>

        <div>
          <div className="text-on-surface-variant uppercase text-xs">Macro Pressure</div>
          <div className="text-xl font-black">{macroPressure}</div>
          <div className="text-on-surface-variant text-xs">Composite of inflation, real rates, and dollar strength</div>
        </div>

        <div>
          <div className="text-on-surface-variant uppercase text-xs">Key Drivers</div>
          <div className="space-y-1 mt-1">
            {inferredDrivers.map((d) => (
              <div key={d}>- {d}</div>
            ))}
          </div>
        </div>

        <div>
          <div className="text-on-surface-variant uppercase text-xs">Suggested Actions</div>
          <div className="space-y-1 mt-1 text-xs">
            <div>• Rising DXY + elevated VIX → Reduce exposure to cyclicals and global risk assets</div>
            <div>• Hold-dominant policy → Maintain balanced duration, avoid excessive beta</div>
            <div>• If regime improves toward Risk-On → Gradually increase equity exposure</div>
          </div>
        </div>
      </div>
    </section>
  )
}
