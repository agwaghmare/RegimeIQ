import { useEffect, useMemo, useState } from 'react'
import { api, type HistoricalInsightsResponse } from '../lib/api'

const regimeColor: Record<string, string> = {
  'Risk-On': 'bg-primary',
  Neutral: 'bg-[#eab308]',
  'Risk-Off': 'bg-[#f97316]',
  Crisis: 'bg-error',
}

export function HistoricalTab() {
  const [data, setData] = useState<HistoricalInsightsResponse | null>(null)

  useEffect(() => {
    let cancelled = false
    api.getHistoricalInsights().then((d) => { if (!cancelled) setData(d) }).catch(() => { if (!cancelled) setData(null) })
    return () => { cancelled = true }
  }, [])

  const timeline = useMemo(() => (data?.timeline ?? []).slice(-180), [data])

  return (
    <section className="ml-0 md:ml-64 pt-20 p-6 min-h-screen space-y-6">
      <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
        <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-3">Historical Validation</h2>
        <div className="text-xs text-on-surface-variant mb-3">This tab validates the model by showing how it behaved across crises and expansions.</div>
        <div className="flex h-8 rounded overflow-hidden bg-surface-container-highest">
          {timeline.map((t, i) => (
            <div key={`${t.date}-${i}`} className={`${regimeColor[t.regime] ?? 'bg-outline'} h-full`} style={{ width: `${100 / Math.max(timeline.length, 1)}%` }} title={`${t.date} — ${t.regime} (${t.total_score}/13)`}></div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
          <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">Major Event Overlays</h3>
          <div className="space-y-2 text-xs">
            {(data?.event_overlays ?? []).map((e) => (
              <div key={e.event} className="flex justify-between border-b border-outline-variant/10 pb-2">
                <span>{e.event}</span>
                <span className="text-on-surface-variant">{e.detected_date} · {e.regime} · {e.total_score}/13</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
          <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">Regime Transitions</h3>
          <div className="text-xs mb-3 text-on-surface-variant">Average duration (days): {Object.entries(data?.avg_duration_days ?? {}).map(([k, v]) => `${k} ${v}`).join(' · ')}</div>
          <div className="space-y-2 text-xs max-h-48 overflow-auto">
            {(data?.transitions ?? []).slice(-12).reverse().map((t, idx) => (
              <div key={`${t.date}-${idx}`} className="flex justify-between border-b border-outline-variant/10 pb-2">
                <span>{t.from_regime ?? 'Start'} → {t.to_regime}</span>
                <span className="text-on-surface-variant">{t.date}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
          <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">Historical Allocation</h3>
          <div className="space-y-2 text-xs max-h-56 overflow-auto">
            {(data?.allocation_history ?? []).slice(-18).reverse().map((a, idx) => (
              <div key={`${a.date}-${idx}`} className="grid grid-cols-4 gap-2 border-b border-outline-variant/10 pb-2">
                <span>{a.date}</span><span>E {Math.round(a.equities * 100)}%</span><span>B {Math.round(a.bonds * 100)}%</span><span>G {Math.round(a.gold * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
