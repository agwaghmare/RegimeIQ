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

  const positioning =
    regime === 'Risk-Off' || regime === 'Crisis'
      ? 'Underweight cyclicals, favor quality duration and hedges.'
      : regime === 'Neutral'
        ? 'Barbell positioning: quality equities plus selective duration.'
        : 'Overweight risk assets with disciplined downside controls.'

  const indicatorBand = (v: number, low: number, high: number): 'Low' | 'Medium' | 'High' => {
    if (v <= low) return 'Low'
    if (v >= high) return 'High'
    return 'Medium'
  }

  const inflationBand = indicatorBand(cpi, 2.5, 3.2)
  const realRateBand = indicatorBand(real, 0.8, 1.8)
  const dollarBand = indicatorBand(dxy * 100, -1, 2)
  const policyRestrictivenessBand = hold >= 55 ? 'High' : hold >= 40 ? 'Medium' : 'Low'

  const sixMonth = {
    cut: Math.round(Math.min(100, cut + 10)),
    hold: Math.round(Math.max(0, hold - 10)),
    hike: Math.round(Math.max(0, hike)),
  }

  const explanatoryInsights = [
    `Policy path remains hold-heavy (${hold}%), which keeps financing conditions restrictive and slows risk-taking expansion.`,
    `Real rates at ${real.toFixed(2)} indicate tighter discount-rate pressure on long-duration growth assets.`,
    `Dollar move (${(dxy * 100).toFixed(2)}%) is ${dxy > 0 ? 'tightening global liquidity' : 'easing external pressure'}, influencing cross-asset volatility.`,
    `Inflation at ${cpi.toFixed(2)} keeps the reaction function data-dependent rather than outright dovish.`,
  ]

  const tradePlaybook = {
    baseCase: [
      'Maintain balanced exposure with quality tilt and moderate duration.',
      'Prefer liquid index risk over concentrated high-beta exposures.',
    ],
    scenarios: [
      'If CPI cools faster than expected -> add cyclical beta and reduce hedge intensity.',
      'If credit spreads widen or VIX re-accelerates -> rotate defensively and increase cash buffers.',
      'If DXY spikes with rising yields -> trim EM/cyclicals and favor domestic defensives.',
    ],
  }

  const regimeFlipTriggers = [
    'CPI momentum decisively breaks lower for multiple prints.',
    'Labor-market deterioration accelerates beyond trend.',
    'Credit conditions tighten abruptly (spread shock).',
    'Policy communication shifts from hold to explicit easing/tightening bias.',
  ]

  const expectedBehavior =
    regime === 'Risk-On'
      ? 'Equities likely lead, credit remains supported, and volatility stays contained unless inflation re-accelerates.'
      : regime === 'Neutral'
        ? 'Range-bound risk assets, selective factor leadership, and sensitivity to macro surprises remain elevated.'
        : 'Defensive assets should outperform while equities show weaker breadth and higher volatility clustering.'

  const convictionScore = Math.max(35, Math.min(90, Math.round((hold * 0.35) + (Math.max(0, 100 - Math.abs(cpi - 2.5) * 25) * 0.35) + (Math.max(0, 100 - Math.abs(real - 1.2) * 30) * 0.3))))
  const convictionLabel = convictionScore >= 75 ? 'High Conviction' : convictionScore >= 55 ? 'Medium Conviction' : 'Low Conviction'

  return (
    <section className="ml-0 md:ml-64 pt-20 p-6 min-h-screen space-y-6">
      <div className="bg-gradient-to-r from-[#181a1f] to-[#272c34] rounded-xl p-6 border border-primary/30 shadow-[0_0_40px_rgba(195,201,209,0.14)]">
        <div className="text-[11px] uppercase tracking-widest text-primary mb-2">Current Playbook</div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-on-surface-variant uppercase">Regime</div>
            <div className="text-2xl font-black">{regime}</div>
          </div>
          <div>
            <div className="text-xs text-on-surface-variant uppercase">Bias</div>
            <div className="text-lg font-bold">{bias}</div>
          </div>
          <div>
            <div className="text-xs text-on-surface-variant uppercase">Positioning</div>
            <div className="text-sm text-on-surface">{positioning}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
          <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4">Macro Indicators</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between border-b border-outline-variant/10 pb-2">
              <span>Inflation Pressure</span><span className="text-on-surface-variant">{inflationBand}</span>
            </div>
            <div className="flex items-center justify-between border-b border-outline-variant/10 pb-2">
              <span>Real Rate Tightness</span><span className="text-on-surface-variant">{realRateBand}</span>
            </div>
            <div className="flex items-center justify-between border-b border-outline-variant/10 pb-2">
              <span>Dollar Stress</span><span className="text-on-surface-variant">{dollarBand}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Policy Restrictiveness</span><span className="text-on-surface-variant">{policyRestrictivenessBand}</span>
            </div>
          </div>
        </div>

        <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
          <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4">Policy Timeline</h3>
          <div className="space-y-3 text-xs">
            <div className="rounded-lg bg-surface-container-high p-3 border border-outline-variant/20">
              <div className="text-on-surface-variant mb-1">Now</div>
              <div>Regime score {typeof totalScore === 'number' ? totalScore.toFixed(1) : totalScore}/10 with {bias.toLowerCase()}.</div>
            </div>
            <div className="rounded-lg bg-surface-container-high p-3 border border-outline-variant/20">
              <div className="text-on-surface-variant mb-1">3M</div>
              <div>FedWatch: Cut {cut}% · Hold {hold}% · Hike {hike}%</div>
            </div>
            <div className="rounded-lg bg-surface-container-high p-3 border border-outline-variant/20">
              <div className="text-on-surface-variant mb-1">6M (inferred)</div>
              <div>Cut {sixMonth.cut}% · Hold {sixMonth.hold}% · Hike {sixMonth.hike}%</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
          <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">Key Drivers (Interpretation)</h3>
          <div className="space-y-2 text-xs">
            {explanatoryInsights.map((d) => (
              <div key={d} className="rounded-lg border border-outline-variant/20 bg-surface-container-high px-3 py-2">
                {d}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
          <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">Trade Playbook</h3>
          <div className="text-xs text-on-surface-variant mb-2">Base case</div>
          <div className="space-y-2 mb-4">
            {tradePlaybook.baseCase.map((t) => (
              <div key={t} className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-xs">{t}</div>
            ))}
          </div>
          <div className="text-xs text-on-surface-variant mb-2">If X happens {'→'} do Y</div>
          <div className="space-y-2">
            {tradePlaybook.scenarios.map((t) => (
              <div key={t} className="rounded-lg border border-outline-variant/20 bg-surface-container-high px-3 py-2 text-xs">{t}</div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
          <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">Regime Flip Triggers</h3>
          <div className="space-y-2 text-xs">
            {regimeFlipTriggers.map((t) => (
              <div key={t} className="rounded border border-outline-variant/20 bg-surface-container-high px-3 py-2">{t}</div>
            ))}
          </div>
        </div>
        <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
          <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">Expected Market Behavior</h3>
          <div className="text-sm leading-relaxed">{expectedBehavior}</div>
        </div>
        <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
          <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">Conviction Score</h3>
          <div className="text-3xl font-black">{convictionScore}<span className="text-base text-on-surface-variant">/100</span></div>
          <div className="mt-1 text-sm font-semibold">{convictionLabel}</div>
          <div className="mt-3 h-2 rounded bg-surface-container-highest overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${convictionScore}%` }}></div>
          </div>
          <div className="mt-3 text-xs text-on-surface-variant">
            Based on policy certainty, inflation distance from target, and real-rate stability. Higher score means stronger confidence in current playbook.
          </div>
        </div>
      </div>
    </section>
  )
}
