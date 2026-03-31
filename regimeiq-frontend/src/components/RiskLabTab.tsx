import { useEffect, useState } from 'react'
import { api, type RiskLabResponse } from '../lib/api'

export function RiskLabTab() {
  const [data, setData] = useState<RiskLabResponse | null>(null)

  useEffect(() => {
    let cancelled = false
    api.getRiskLab().then((d) => { if (!cancelled) setData(d) }).catch(() => { if (!cancelled) setData(null) })
    return () => { cancelled = true }
  }, [])

  return (
    <section className="ml-0 md:ml-64 pt-20 p-6 min-h-screen space-y-6">
      <div className="bg-gradient-to-r from-[#2a1414] to-[#2a1e14] rounded-xl p-5 border border-error/30 shadow-[0_0_40px_rgba(239,68,68,0.12)]">
        <h2 className="text-sm font-black uppercase tracking-widest text-error mb-2">Risk Lab</h2>
        <div className="text-xs text-on-surface-variant">The Risk Lab breaks down where risk is coming from across macro, financial, and market dimensions.</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        {Object.entries(data?.breakdown ?? {}).map(([k, v]) => (
          <div key={k} className="bg-surface-container rounded-xl p-4 border border-outline-variant/20">
            <div className="text-on-surface-variant uppercase">{k}</div>
            <div className="text-2xl font-black">{v.score}/{v.max}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20 text-xs space-y-2">
          <div className="font-bold uppercase tracking-widest text-on-surface-variant">Stress Indicators</div>
          <div>Yield Curve Inverted: <b>{data?.stress_indicators?.yield_curve_inverted ? 'Yes' : 'No'}</b></div>
          <div>VIX {'>'} 25: <b>{data?.stress_indicators?.vix_above_25 ? 'Yes' : 'No'}</b></div>
          <div>Credit Spreads Widening: <b>{data?.stress_indicators?.credit_spreads_widening ? 'Yes' : 'No'}</b></div>
          <div>Volatility Regime: <b>{data?.volatility_regime ?? '—'}</b></div>
          <div>Current Drawdown: <b>{(((data?.current_drawdown ?? 0) * 100)).toFixed(2)}%</b></div>
          <div>Crash Probability: <b>{(((data?.crash_probability ?? 0) * 100)).toFixed(0)}%</b></div>
        </div>
        <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20 text-xs space-y-2">
          <div className="font-bold uppercase tracking-widest text-on-surface-variant">Risk Drivers</div>
          {(data?.risk_drivers ?? []).length === 0 ? (
            <div className="text-on-surface-variant">No acute drivers flagged.</div>
          ) : (
            (data?.risk_drivers ?? []).map((d, i) => <div key={i}>- {d}</div>)
          )}
        </div>
      </div>
    </section>
  )
}
