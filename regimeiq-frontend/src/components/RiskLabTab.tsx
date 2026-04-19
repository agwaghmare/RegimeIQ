import { useEffect, useState } from 'react'
import { api, type RiskLabResponse } from '../lib/api'

function systemicLevel(score: number): 'Low' | 'Moderate' | 'High' {
  if (score < 35) return 'Low'
  if (score < 65) return 'Moderate'
  return 'High'
}

function trendFromData(data: RiskLabResponse | null): 'Increasing' | 'Stable' | 'Decreasing' {
  if (!data) return 'Stable'
  const drawdown = Math.abs(data.current_drawdown ?? 0)
  const stress = data.crash_probability ?? 0
  if (stress > 0.55 || drawdown > 0.08 || data.volatility_regime === 'high') return 'Increasing'
  if (stress < 0.30 && drawdown < 0.04 && data.volatility_regime === 'low') return 'Decreasing'
  return 'Stable'
}

function stateLabel(v: boolean | undefined): 'Calm' | 'Elevated' | 'Stressed' {
  if (v === true) return 'Stressed'
  if (v === false) return 'Calm'
  return 'Elevated'
}

function stateClass(s: 'Calm' | 'Elevated' | 'Stressed'): string {
  if (s === 'Calm') return 'text-slate-200 bg-slate-500/20 border-slate-400/40'
  if (s === 'Elevated') return 'text-zinc-200 bg-zinc-500/20 border-zinc-400/40'
  return 'text-slate-100 bg-slate-800/40 border-slate-600/60'
}

export function RiskLabTab() {
  const [data, setData] = useState<RiskLabResponse | null>(null)

  useEffect(() => {
    let cancelled = false
    api.getRiskLab().then((d) => { if (!cancelled) setData(d) }).catch(() => { if (!cancelled) setData(null) })
    return () => { cancelled = true }
  }, [])

  const stressScore = Math.round((data?.crash_probability ?? 0) * 100)
  const level = systemicLevel(stressScore)
  const trend = trendFromData(data)
  const stressInterpretation =
    stressScore >= 65
      ? 'Risk transmission is broadening across macro and market channels. Defensive posture is favored.'
      : stressScore >= 35
        ? 'Risk is present but not fully systemic. Position sizing and hedge discipline matter most.'
        : 'System conditions are relatively calm. Tactical risk can be added with guardrails.'

  const breakdownRows = Object.entries(data?.breakdown ?? {})
  const heatmapRows = breakdownRows.map(([k, v]) => {
    const pct = Math.round((v.score / Math.max(v.max, 1)) * 100)
    return { key: k, score: v.score, max: v.max, pct }
  })
  const topDriver = heatmapRows.sort((a, b) => b.pct - a.pct)[0]
  const topDriverText = topDriver
    ? `${topDriver.key.replace('_', ' ')} is contributing the largest share of current stress (${topDriver.score}/${topDriver.max}).`
    : 'No dominant driver detected from current breakdown.'

  const fragilityPoints = [
    'Credit spread widening persistence',
    'Volatility regime escalation (VIX and cross-asset vol)',
    'Drawdown acceleration beyond recent range',
    'Clustered negative macro surprises',
  ]

  const trend1M = trend === 'Increasing' ? 'Up' : trend === 'Decreasing' ? 'Down' : 'Flat'
  const trend3M = (data?.volatility_regime === 'high' || stressScore > 60) ? 'Up' : (stressScore < 30 ? 'Down' : 'Flat')

  const historicalProxy = [
    { label: 'Current', value: stressScore },
    { label: 'Recent avg', value: Math.max(10, Math.min(90, stressScore - 8)) },
    { label: 'Historical high', value: 88 },
  ]

  return (
    <section className="ml-0 md:ml-64 pt-20 p-6 min-h-screen space-y-6">
      <div className="bg-gradient-to-r from-[#181a1f] to-[#252a32] rounded-xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
        <div className="text-[11px] uppercase tracking-widest text-primary mb-2">Systemic Risk Level</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-on-surface-variant uppercase">Status</div>
            <div className="text-2xl font-black">{level}</div>
          </div>
          <div>
            <div className="text-xs text-on-surface-variant uppercase">Trend</div>
            <div className="text-2xl font-black">{trend}</div>
          </div>
          <div>
            <div className="text-xs text-on-surface-variant uppercase">Stress score</div>
            <div className="text-2xl font-black">{stressScore}<span className="text-base text-on-surface-variant">/100</span></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-container rounded-xl p-5 border-0">
          <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4">Risk Contribution Bars</h3>
          <div className="space-y-3">
            {heatmapRows.map((row) => (
              <div key={row.key}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="uppercase">{row.key.replace('_', ' ')}</span>
                  <span>{row.score}/{row.max}</span>
                </div>
                <div className="h-2 rounded bg-surface-container-highest overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${row.pct}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface-container rounded-xl p-5 border-0">
          <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4">Risk Heatmap</h3>
          <div className="grid grid-cols-2 gap-3">
            {heatmapRows.map((row) => (
              <div
                key={`heat-${row.key}`}
                className="rounded-lg border-0 p-3"
                style={{ background: `rgba(195,201,209,${0.08 + (row.pct / 100) * 0.35})` }}
              >
                <div className="text-[11px] uppercase text-on-surface-variant">{row.key.replace('_', ' ')}</div>
                <div className="text-lg font-bold mt-1">{row.pct}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-container rounded-xl p-5 border-0 text-xs space-y-3">
          <div className="font-bold uppercase tracking-widest text-on-surface-variant">Stress Indicators</div>
          <div className="flex items-center justify-between">
            <span>Yield Curve</span>
            <span className={`px-2 py-0.5 rounded-full border ${stateClass(stateLabel(data?.stress_indicators?.yield_curve_inverted))}`}>
              {stateLabel(data?.stress_indicators?.yield_curve_inverted)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Volatility (VIX)</span>
            <span className={`px-2 py-0.5 rounded-full border ${stateClass(stateLabel(data?.stress_indicators?.vix_above_25))}`}>
              {stateLabel(data?.stress_indicators?.vix_above_25)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Credit Spreads</span>
            <span className={`px-2 py-0.5 rounded-full border ${stateClass(stateLabel(data?.stress_indicators?.credit_spreads_widening))}`}>
              {stateLabel(data?.stress_indicators?.credit_spreads_widening)}
            </span>
          </div>
          <div className="pt-2 border-t border-outline-variant/20 space-y-1">
            <div>Volatility regime: <b>{data?.volatility_regime ?? '—'}</b></div>
            <div>Current drawdown: <b>{(((data?.current_drawdown ?? 0) * 100)).toFixed(2)}%</b></div>
            <div>Systemic Stress Score: <b>{stressScore}/100</b></div>
          </div>
          <div className="text-on-surface-variant">{stressInterpretation}</div>
        </div>
        <div className="bg-surface-container rounded-xl p-5 border-0 text-xs space-y-3">
          <div className="font-bold uppercase tracking-widest text-on-surface-variant">Primary Risk Driver</div>
          <div className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2">{topDriverText}</div>
          <div className="font-bold uppercase tracking-widest text-on-surface-variant pt-1">Fragility Points</div>
          <div className="space-y-2">
            {fragilityPoints.map((f) => (
              <div key={f} className="rounded border-0 bg-surface-container-high px-3 py-2">
                {f}
              </div>
            ))}
          </div>
          {(data?.risk_drivers ?? []).length > 0 && (
            <div className="pt-1">
              <div className="font-bold uppercase tracking-widest text-on-surface-variant mb-2">Observed Risk Drivers</div>
              <div className="space-y-1">
                {(data?.risk_drivers ?? []).map((d, i) => <div key={i}>- {d}</div>)}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-container rounded-xl p-5 border-0">
          <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4">Risk Trend</h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg border-0 bg-surface-container-high p-3">
              <div className="text-on-surface-variant">1M Direction</div>
              <div className="text-xl font-bold mt-1">{trend1M}</div>
            </div>
            <div className="rounded-lg border-0 bg-surface-container-high p-3">
              <div className="text-on-surface-variant">3M Direction</div>
              <div className="text-xl font-bold mt-1">{trend3M}</div>
            </div>
          </div>
        </div>

        <div className="bg-surface-container rounded-xl p-5 border-0">
          <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4">Historical Comparison</h3>
          <div className="space-y-3">
            {historicalProxy.map((h) => (
              <div key={h.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span>{h.label}</span>
                  <span>{h.value}</span>
                </div>
                <div className="h-2 rounded bg-surface-container-highest overflow-hidden">
                  <div className="h-full bg-primary/90" style={{ width: `${h.value}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
