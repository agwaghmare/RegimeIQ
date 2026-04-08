import { useEffect, useMemo, useState } from 'react'
import { api, type HistoricalInsightsResponse } from '../lib/api'
import type { RegimeData } from '../types/regime'
import { ScoreCards } from './ScoreCards'
import { MetricsTable } from './MetricsTable'
import { RegimeBreakdown } from './RegimeBreakdown'
import { PortfolioAllocation } from './PortfolioAllocation'

const regimeColor: Record<string, string> = {
  'Risk-On': 'bg-primary',
  Neutral: 'bg-[#eab308]',
  'Risk-Off': 'bg-[#f97316]',
  Crisis: 'bg-error',
}

const MIN_DATE = '2006-01-01'
const MAX_DATE = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

export function HistoricalTab() {
  // ── Snapshot state ────────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState('')
  const [snapshotData, setSnapshotData] = useState<RegimeData | null>(null)
  const [snapshotLoading, setSnapshotLoading] = useState(false)
  const [snapshotError, setSnapshotError] = useState<string | null>(null)

  const handleSnapshot = async () => {
    if (!selectedDate) return
    setSnapshotLoading(true)
    setSnapshotError(null)
    setSnapshotData(null)
    try {
      const d = await api.getSnapshot(selectedDate)
      setSnapshotData(d)
    } catch (e) {
      setSnapshotError((e as Error).message)
    } finally {
      setSnapshotLoading(false)
    }
  }

  // ── Backtest / historical insights ───────────────────────────────
  const [insights, setInsights] = useState<HistoricalInsightsResponse | null>(null)

  useEffect(() => {
    let cancelled = false
    api.getHistoricalInsights()
      .then((d) => { if (!cancelled) setInsights(d) })
      .catch(() => { if (!cancelled) setInsights(null) })
    return () => { cancelled = true }
  }, [])

  const timeline = useMemo(() => (insights?.timeline ?? []).slice(-180), [insights])

  return (
    <section className="ml-0 md:ml-64 pt-20 p-6 min-h-screen space-y-8">

      {/* ── Section A: Historical Snapshot ─────────────────────────── */}
      <div className="bg-surface-container rounded-xl p-6 border border-outline-variant/20 space-y-5">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-1">
            Historical Snapshot
          </h2>
          <p className="text-xs text-on-surface-variant opacity-70 max-w-2xl leading-relaxed">
            Enter any past date to view the complete regime dashboard exactly as it would have
            appeared on that day — including regime classification, risk scores, signal metrics,
            and portfolio allocation computed using only data available up to that date.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="date"
            value={selectedDate}
            min={MIN_DATE}
            max={MAX_DATE}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-[#1a1a1e] border border-outline-variant/30 text-on-surface text-xs rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            onClick={handleSnapshot}
            disabled={!selectedDate || snapshotLoading}
            className="px-4 py-2 bg-primary text-on-primary text-xs font-bold rounded hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {snapshotLoading && (
              <span className="h-3 w-3 border border-on-primary border-t-transparent rounded-full animate-spin" />
            )}
            {snapshotLoading ? 'Loading…' : 'Run Snapshot'}
          </button>
          {snapshotData && !snapshotLoading && (
            <span className="text-xs text-primary font-semibold">
              Showing data as of {snapshotData.updated_at}
            </span>
          )}
        </div>

        {snapshotError && (
          <div className="text-xs text-error bg-error/10 border border-error/30 rounded px-3 py-2">
            {snapshotError}
          </div>
        )}

        {snapshotData && !snapshotLoading && (
          <div className="space-y-6 pt-2">
            <div className="flex items-center gap-3 pb-3 border-b border-outline-variant/20">
              <span className="px-3 py-1 rounded text-xs font-bold uppercase tracking-widest bg-[#1a1a1e] border border-outline-variant/30">
                {snapshotData.regime}
              </span>
              <span className="text-xs text-on-surface-variant">
                Score: {snapshotData.total_score} / {snapshotData.max_score}
              </span>
              <span className="text-xs text-on-surface-variant">
                Probability: {Math.round(snapshotData.probability * 100)}%
              </span>
            </div>

            <ScoreCards scores={snapshotData.scores} />

            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-12 lg:col-span-9 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <MetricsTable
                    title="Growth Metrics"
                    subtitle={`AS OF: ${snapshotData.updated_at}`}
                    rows={snapshotData.growth_metrics}
                  />
                  <MetricsTable
                    title="Inflation Metrics"
                    subtitle={snapshotData.regime.toUpperCase()}
                    rows={snapshotData.inflation_metrics}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <MetricsTable
                    title="Fin. Conditions"
                    subtitle="FINANCIAL"
                    rows={snapshotData.financial_metrics}
                  />
                  <MetricsTable
                    title="Market Risk"
                    subtitle="MARKET"
                    rows={snapshotData.market_metrics}
                  />
                </div>
              </div>
              <aside className="col-span-12 lg:col-span-3 space-y-6">
                <RegimeBreakdown
                  regime={snapshotData.regime}
                  probability={snapshotData.probability}
                  total_score={snapshotData.total_score}
                  max_score={snapshotData.max_score}
                  scores={snapshotData.scores}
                />
                <PortfolioAllocation
                  allocation={snapshotData.allocation}
                  regime={snapshotData.regime}
                />
              </aside>
            </div>
          </div>
        )}
      </div>

      {/* ── Section B: Historical Model Backtest ────────────────────── */}
      <div className="space-y-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">
          Historical Model Backtest
        </h2>

        <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
          <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">
            Regime Timeline (last 180 months)
          </h3>
          <div className="text-xs text-on-surface-variant mb-3">
            Validates the model by showing how regimes were classified across crises and expansions.
          </div>
          <div className="flex h-8 rounded overflow-hidden bg-surface-container-highest">
            {timeline.map((t, i) => (
              <div
                key={`${t.date}-${i}`}
                className={`${regimeColor[t.regime] ?? 'bg-outline'} h-full`}
                style={{ width: `${100 / Math.max(timeline.length, 1)}%` }}
                title={`${t.date} — ${t.regime} (${t.total_score}/13)`}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
            <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">
              Major Event Overlays
            </h3>
            <div className="space-y-2 text-xs">
              {(insights?.event_overlays ?? []).map((e) => (
                <div key={e.event} className="flex justify-between border-b border-outline-variant/10 pb-2">
                  <span>{e.event}</span>
                  <span className="text-on-surface-variant">
                    {e.detected_date} · {e.regime} · {e.total_score}/13
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
            <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">
              Regime Transitions
            </h3>
            <div className="text-xs mb-3 text-on-surface-variant">
              Average duration (days):{' '}
              {Object.entries(insights?.avg_duration_days ?? {})
                .map(([k, v]) => `${k} ${v}`)
                .join(' · ')}
            </div>
            <div className="space-y-2 text-xs max-h-48 overflow-auto">
              {(insights?.transitions ?? []).slice(-12).reverse().map((t, idx) => (
                <div key={`${t.date}-${idx}`} className="flex justify-between border-b border-outline-variant/10 pb-2">
                  <span>{t.from_regime ?? 'Start'} → {t.to_regime}</span>
                  <span className="text-on-surface-variant">{t.date}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
          <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">
            Historical Allocation
          </h3>
          <div className="space-y-2 text-xs max-h-56 overflow-auto">
            {(insights?.allocation_history ?? []).slice(-18).reverse().map((a, idx) => (
              <div key={`${a.date}-${idx}`} className="grid grid-cols-4 gap-2 border-b border-outline-variant/10 pb-2">
                <span>{a.date}</span>
                <span>E {Math.round(a.equities * 100)}%</span>
                <span>B {Math.round(a.bonds * 100)}%</span>
                <span>G {Math.round(a.gold * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
