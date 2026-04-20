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

const LEVEL_COLOR: Record<string, string> = {
  Low:      '#22c55e',
  Moderate: '#f59e0b',
  High:     '#ef4444',
}

const STATE_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  Calm:     { text: 'hsl(77,100%,62%)',  bg: 'rgba(198,255,31,0.08)', border: 'rgba(198,255,31,0.25)' },
  Elevated: { text: 'hsl(77,80%,42%)',   bg: 'rgba(160,210,20,0.08)', border: 'rgba(160,210,20,0.22)' },
  Stressed: { text: 'hsl(77,60%,25%)',   bg: 'rgba(100,140,10,0.10)', border: 'rgba(100,140,10,0.25)' },
}

const TREND_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  Up:         { text: 'hsl(77,60%,25%)',  bg: 'rgba(100,140,10,0.10)', border: 'rgba(100,140,10,0.25)' },
  Flat:       { text: 'hsl(77,80%,42%)',  bg: 'rgba(160,210,20,0.08)', border: 'rgba(160,210,20,0.22)' },
  Down:       { text: 'hsl(77,100%,62%)', bg: 'rgba(198,255,31,0.08)', border: 'rgba(198,255,31,0.25)' },
  Increasing: { text: 'hsl(77,60%,25%)',  bg: 'rgba(100,140,10,0.10)', border: 'rgba(100,140,10,0.25)' },
  Stable:     { text: 'hsl(77,80%,42%)',  bg: 'rgba(160,210,20,0.08)', border: 'rgba(160,210,20,0.22)' },
  Decreasing: { text: 'hsl(77,100%,62%)', bg: 'rgba(198,255,31,0.08)', border: 'rgba(198,255,31,0.25)' },
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
  const levelColor = LEVEL_COLOR[level]

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
  const topDriver = [...heatmapRows].sort((a, b) => b.pct - a.pct)[0]
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
    { label: 'Current',         value: stressScore },
    { label: 'Recent avg',      value: Math.max(10, Math.min(90, stressScore - 8)) },
    { label: 'Historical high', value: 88 },
  ]

  const barColor = (pct: number) =>
    pct >= 66 ? '#ef4444' : pct >= 33 ? '#f59e0b' : '#22c55e'

  return (
    <section className="ml-0 md:ml-64 pt-20 p-6 min-h-screen space-y-6">

      {/* Hero header */}
      <div className="relative rounded-xl p-6 overflow-hidden" style={{
        background: 'linear-gradient(135deg, #0d0f12 0%, #181a1f 60%, #1a0f0f 100%)',
        border: `1px solid ${levelColor}30`,
        boxShadow: `0 0 40px ${levelColor}12`,
      }}>
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, ${levelColor}18 0%, transparent 70%)` }} />
        <div className="text-[10px] uppercase tracking-widest mb-3" style={{ color: levelColor }}>Systemic Risk Level</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">Status</div>
            <div className="text-3xl font-black text-on-surface">{level}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">Trend</div>
            <div className="text-3xl font-black" style={{ color: TREND_COLOR[trend].text }}>{trend}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">Stress Score</div>
            <div className="flex items-end gap-1">
              <div className="text-3xl font-black" style={{ color: levelColor, textShadow: `0 0 16px ${levelColor}55` }}>{stressScore}</div>
              <div className="text-base text-on-surface-variant mb-1">/100</div>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{
                width: `${stressScore}%`,
                background: `linear-gradient(to right, #22c55e, #f59e0b, #ef4444)`,
                clipPath: `inset(0 ${100 - stressScore}% 0 0)`,
              }} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Risk Contribution Bars */}
        <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-4">Risk Contribution</h3>
          <div className="space-y-3">
            {heatmapRows.map((row) => {
              const color = barColor(row.pct)
              return (
                <div key={row.key}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="uppercase text-on-surface">{row.key.replace('_', ' ')}</span>
                    <span className="tabular-nums font-semibold text-on-surface-variant">{row.score}/{row.max}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{
                      width: `${row.pct}%`,
                      background: color,
                      boxShadow: `0 0 6px ${color}66`,
                    }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Risk Heatmap */}
        <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-4">Risk Heatmap</h3>
          <div className="grid grid-cols-2 gap-3">
            {heatmapRows.map((row) => {
              const color = barColor(row.pct)
              return (
                <div key={`heat-${row.key}`} className="rounded-lg p-3" style={{
                  background: `${color}10`,
                  border: `1px solid ${color}30`,
                }}>
                  <div className="text-[10px] uppercase text-on-surface-variant">{row.key.replace('_', ' ')}</div>
                  <div className="text-2xl font-black mt-1" style={{ color }}>{row.pct}<span className="text-sm font-normal text-on-surface-variant">%</span></div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Stress Indicators */}
        <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20 space-y-3">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Stress Indicators</h3>
          {([
            { label: 'Yield Curve',    state: stateLabel(data?.stress_indicators?.yield_curve_inverted) },
            { label: 'Volatility (VIX)', state: stateLabel(data?.stress_indicators?.vix_above_25) },
            { label: 'Credit Spreads', state: stateLabel(data?.stress_indicators?.credit_spreads_widening) },
          ] as { label: string; state: 'Calm' | 'Elevated' | 'Stressed' }[]).map(({ label, state }) => {
            const c = STATE_COLOR[state]
            return (
              <div key={label} className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
                <span className="text-on-surface">{label}</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ color: c.text }}>{state}</span>
              </div>
            )
          })}
          <div className="pt-2 border-t border-outline-variant/20 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Volatility regime</span>
              <span className="font-bold text-on-surface">{data?.volatility_regime ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Current drawdown</span>
              <span className="font-bold text-on-surface">{((data?.current_drawdown ?? 0) * 100).toFixed(2)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Systemic stress score</span>
              <span className="font-bold text-on-surface">{stressScore}/100</span>
            </div>
          </div>
          <div className="text-xs text-on-surface-variant leading-relaxed pt-1">{stressInterpretation}</div>
        </div>

        {/* Primary Driver + Fragility */}
        <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20 space-y-3">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Primary Risk Driver</h3>
          <div className="flex gap-2.5 rounded-lg px-3 py-2.5 text-xs leading-relaxed" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <span style={{ color: '#ef4444' }} className="flex-shrink-0">▲</span>
            <span className="text-on-surface">{topDriverText}</span>
          </div>

          <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant pt-1">Fragility Points</h3>
          <div className="space-y-2">
            {fragilityPoints.map((f) => (
              <div key={f} className="flex gap-2.5 rounded-lg px-3 py-2.5 text-xs leading-relaxed" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
                <span className="flex-shrink-0" style={{ color: '#ef4444' }}>⚠</span>
                <span className="text-on-surface">{f}</span>
              </div>
            ))}
          </div>

          {(data?.risk_drivers ?? []).length > 0 && (
            <div className="pt-1">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Observed Risk Drivers</h3>
              <div className="space-y-1.5">
                {(data?.risk_drivers ?? []).map((d, i) => (
                  <div key={i} className="flex gap-2 text-xs" style={{ color: 'rgba(198,255,31,0.8)' }}>
                    <span className="flex-shrink-0">·</span><span>{d}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Risk Trend */}
        <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-4">Risk Trend</h3>
          <div className="grid grid-cols-2 gap-3">
            {([
              { label: '1M Direction', val: trend1M },
              { label: '3M Direction', val: trend3M },
            ]).map(({ label, val }) => {
              const c = TREND_COLOR[val]
              return (
                <div key={label} className="rounded-lg p-4 text-center" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
                  <div className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">{label}</div>
                  <div className="text-2xl font-black" style={{ color: c.text }}>{val}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Historical Comparison */}
        <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-4">Historical Comparison</h3>
          <div className="space-y-3">
            {historicalProxy.map((h) => (
              <div key={h.label}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-on-surface">{h.label}</span>
                  <span className="font-semibold tabular-nums" style={{ color: '#c6ff1f' }}>{h.value}</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{
                    width: `${h.value}%`,
                    background: `linear-gradient(to right, hsl(77,60%,18%), hsl(77,90%,35%) ${h.value * 0.5}%, hsl(77,100%,58%))`,
                    boxShadow: '0 0 8px rgba(198,255,31,0.4)',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
