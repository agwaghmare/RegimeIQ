import type { FedWatch, GlobalMacroSnapshot } from '../types/regime'

interface Props {
  regime: string
  totalScore: number
  fedwatch: FedWatch
  globalMacro: GlobalMacroSnapshot
}

const REGIME_COLOR: Record<string, string> = {
  'Risk-On':  '#c6ff1f',
  'Neutral':  '#f59e0b',
  'Risk-Off': '#ef4444',
  'Crisis':   '#dc2626',
}

const BAND_COLOR = {
  Low:    { text: '#22c55e', bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.25)' },
  Medium: { text: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)' },
  High:   { text: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.25)' },
}

export function PlaybookTab({ regime, totalScore, fedwatch, globalMacro }: Props) {
  const cut  = Math.round(fedwatch.next_3m.cut  * 100)
  const hold = Math.round(fedwatch.next_3m.hold * 100)
  const hike = Math.round(fedwatch.next_3m.hike * 100)
  const dxy  = globalMacro.dxy_3m_pct_change ?? 0
  const cpi  = globalMacro.cpi_yoy ?? 0
  const real = globalMacro.real_rate_10y ?? 0

  const regimeColor = REGIME_COLOR[regime] ?? '#c6ff1f'

  const bias =
    regime === 'Risk-Off' || regime === 'Crisis' ? 'Defensive tilt' :
    regime === 'Neutral' ? 'Balanced tilt' : 'Risk-on tilt'

  const positioning =
    regime === 'Risk-Off' || regime === 'Crisis'
      ? 'Underweight cyclicals, favor quality duration and hedges.'
      : regime === 'Neutral'
        ? 'Barbell positioning: quality equities plus selective duration.'
        : 'Overweight risk assets with disciplined downside controls.'

  const indicatorBand = (v: number, low: number, high: number): 'Low' | 'Medium' | 'High' =>
    v <= low ? 'Low' : v >= high ? 'High' : 'Medium'

  const inflationBand         = indicatorBand(cpi, 2.5, 3.2)
  const realRateBand          = indicatorBand(real, 0.8, 1.8)
  const dollarBand            = indicatorBand(dxy * 100, -1, 2)
  const policyRestrictiveness = hold >= 55 ? 'High' : hold >= 40 ? 'Medium' : 'Low'

  const sixMonth = {
    cut:  Math.round(Math.min(100, cut + 10)),
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
      { trigger: 'CPI cools faster than expected', action: 'add cyclical beta and reduce hedge intensity' },
      { trigger: 'credit spreads widen or VIX re-accelerates', action: 'rotate defensively and increase cash buffers' },
      { trigger: 'DXY spikes with rising yields', action: 'trim EM/cyclicals and favor domestic defensives' },
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

  const convictionScore = Math.max(35, Math.min(90, Math.round(
    (hold * 0.35) +
    (Math.max(0, 100 - Math.abs(cpi - 2.5) * 25) * 0.35) +
    (Math.max(0, 100 - Math.abs(real - 1.2) * 30) * 0.3)
  )))
  const convictionLabel = convictionScore >= 75 ? 'High Conviction' : convictionScore >= 55 ? 'Medium Conviction' : 'Low Conviction'
  const convictionColor = convictionScore >= 75 ? '#c6ff1f' : convictionScore >= 55 ? '#f59e0b' : '#ef4444'

  return (
    <section className="ml-0 md:ml-64 pt-20 p-6 min-h-screen space-y-6">

      {/* Hero header */}
      <div className="relative rounded-xl p-6 overflow-hidden" style={{
        background: 'linear-gradient(135deg, #0d0f12 0%, #181a1f 60%, #1a1f14 100%)',
        border: `1px solid ${regimeColor}30`,
        boxShadow: `0 0 40px ${regimeColor}12`,
      }}>
        {/* Subtle glow orb */}
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, ${regimeColor}18 0%, transparent 70%)` }} />
        <div className="text-[10px] uppercase tracking-widest mb-3" style={{ color: regimeColor }}>Current Playbook</div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">Regime</div>
            <div className="text-3xl font-black tracking-tight text-on-surface">{regime}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">Bias</div>
            <div className="text-xl font-bold text-on-surface">{bias}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">Positioning</div>
            <div className="text-sm text-on-surface leading-relaxed">{positioning}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Macro Indicators */}
        <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-4">Macro Indicators</h3>
          <div className="space-y-2">
            {([
              { label: 'Inflation Pressure',    band: inflationBand },
              { label: 'Real Rate Tightness',   band: realRateBand },
              { label: 'Dollar Stress',         band: dollarBand },
              { label: 'Policy Restrictiveness',band: policyRestrictiveness },
            ] as { label: string; band: 'Low' | 'Medium' | 'High' }[]).map(({ label, band }) => {
              const c = BAND_COLOR[band]
              return (
                <div key={label} className="flex items-center justify-between px-3 py-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <span className="text-sm text-on-surface">{label}</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ color: c.text, border: `1px solid ${c.border}` }}>{band}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Policy Timeline */}
        <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-4">Policy Timeline</h3>
          <div className="space-y-3">
            {/* Now */}
            <div className="rounded-lg p-3" style={{ background: 'rgba(198,255,31,0.05)', border: '1px solid rgba(198,255,31,0.15)' }}>
              <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#c6ff1f' }}>Now</div>
              <div className="text-sm text-on-surface">Regime score <span className="font-bold" style={{ color: '#c6ff1f' }}>{totalScore}/10</span> with {bias.toLowerCase()}.</div>
            </div>
            {/* 3M */}
            <div className="rounded-lg p-3 border border-outline-variant/20 bg-surface-container-high">
              <div className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-2">3M Fedwatch</div>
              <div className="flex gap-3">
                {[
                  { label: 'Cut',  val: cut,  color: '#22c55e' },
                  { label: 'Hold', val: hold, color: '#f59e0b' },
                  { label: 'Hike', val: hike, color: '#ef4444' },
                ].map(({ label, val, color }) => (
                  <div key={label} className="flex-1 text-center rounded p-2" style={{ background: `${color}12`, border: `1px solid ${color}30` }}>
                    <div className="text-[10px] uppercase" style={{ color }}>{label}</div>
                    <div className="text-lg font-black" style={{ color }}>{val}%</div>
                  </div>
                ))}
              </div>
            </div>
            {/* 6M */}
            <div className="rounded-lg p-3 border border-outline-variant/20 bg-surface-container-high">
              <div className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-2">6M (inferred)</div>
              <div className="flex gap-3">
                {[
                  { label: 'Cut',  val: sixMonth.cut,  color: '#22c55e' },
                  { label: 'Hold', val: sixMonth.hold, color: '#f59e0b' },
                  { label: 'Hike', val: sixMonth.hike, color: '#ef4444' },
                ].map(({ label, val, color }) => (
                  <div key={label} className="flex-1 text-center rounded p-2" style={{ background: `${color}12`, border: `1px solid ${color}20` }}>
                    <div className="text-[10px] uppercase" style={{ color }}>{label}</div>
                    <div className="text-lg font-black" style={{ color }}>{val}%</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Key Drivers */}
        <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">Key Drivers</h3>
          <div className="space-y-2">
            {explanatoryInsights.map((d, i) => (
              <div key={i} className="flex gap-3 rounded-lg px-3 py-2.5 text-xs leading-relaxed" style={{ background: 'rgba(198,255,31,0.04)', border: '1px solid rgba(198,255,31,0.12)' }}>
                <span className="mt-0.5 flex-shrink-0 w-1.5 h-1.5 rounded-full" style={{ background: '#c6ff1f', boxShadow: '0 0 4px #c6ff1f', marginTop: 4 }} />
                <span className="text-on-surface">{d}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Trade Playbook */}
        <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">Trade Playbook</h3>
          <div className="text-[10px] uppercase tracking-widest mb-2" style={{ color: '#c6ff1f' }}>Base case</div>
          <div className="space-y-2 mb-4">
            {tradePlaybook.baseCase.map((t) => (
              <div key={t} className="rounded-lg px-3 py-2.5 text-xs text-on-surface" style={{ background: 'rgba(198,255,31,0.06)', border: '1px solid rgba(198,255,31,0.2)' }}>{t}</div>
            ))}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-2">Conditional scenarios</div>
          <div className="space-y-2">
            {tradePlaybook.scenarios.map((s) => (
              <div key={s.trigger} className="rounded-lg px-3 py-2.5 text-xs" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <span className="font-semibold" style={{ color: '#f59e0b' }}>If </span>
                <span className="text-on-surface">{s.trigger}</span>
                <span className="font-semibold" style={{ color: '#f59e0b' }}> → </span>
                <span className="text-on-surface">{s.action}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Regime Flip Triggers */}
        <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
          <h3 className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#ef4444' }}>Regime Flip Triggers</h3>
          <div className="space-y-2">
            {regimeFlipTriggers.map((t) => (
              <div key={t} className="flex gap-2.5 rounded-lg px-3 py-2.5 text-xs leading-relaxed" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }}>
                <span className="flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }}>⚠</span>
                <span className="text-on-surface">{t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Expected Market Behavior */}
        <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">Expected Market Behavior</h3>
          <div className="text-sm leading-relaxed text-on-surface">{expectedBehavior}</div>
          <div className="mt-4 pt-4 border-t border-outline-variant/10">
            <div className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">Regime</div>
            <div className="text-base font-bold text-on-surface">{regime}</div>
          </div>
        </div>

        {/* Conviction Score */}
        <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">Conviction Score</h3>
          <div className="flex items-end gap-1 mb-1">
            <div className="text-4xl font-black" style={{ color: convictionColor, textShadow: `0 0 16px ${convictionColor}55` }}>{convictionScore}</div>
            <div className="text-base text-on-surface-variant mb-1">/100</div>
          </div>
          <div className="text-sm font-semibold mb-3" style={{ color: convictionColor }}>{convictionLabel}</div>
          <div className="h-1.5 rounded-full bg-surface-container-highest overflow-hidden mb-3">
            <div className="h-full rounded-full transition-all duration-700" style={{
              width: `${convictionScore}%`,
              background: `linear-gradient(to right, ${convictionScore >= 55 ? '#f59e0b' : '#ef4444'}, ${convictionColor})`,
              boxShadow: `0 0 8px ${convictionColor}66`,
            }} />
          </div>
          <div className="text-[10px] text-on-surface-variant leading-relaxed">
            Based on policy certainty, inflation distance from target, and real-rate stability. Higher score means stronger confidence in current playbook.
          </div>
        </div>
      </div>
    </section>
  )
}
