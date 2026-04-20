import { useEffect, useMemo, useState } from 'react'
import { api, type HistoricalInsightsResponse } from '../lib/api'
import type { RegimeData } from '../types/regime'
import { ScoreCards } from './ScoreCards'
import { MetricsTable } from './MetricsTable'
import { RegimeBreakdown } from './RegimeBreakdown'
import { PortfolioAllocation } from './PortfolioAllocation'
import { DateCalendar } from './DateCalendar'

const REGIME_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  'Risk-On':  { text: '#22c55e', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.3)'  },
  Neutral:    { text: '#eab308', bg: 'rgba(234,179,8,0.12)',  border: 'rgba(234,179,8,0.3)'  },
  'Risk-Off': { text: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.3)' },
  Crisis:     { text: '#ef4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)'  },
}

const regimeBarColor: Record<string, string> = {
  'Risk-On': '#22c55e',
  Neutral:   '#eab308',
  'Risk-Off':'#f97316',
  Crisis:    '#ef4444',
}

function RegimePill({ regime }: { regime: string }) {
  const c = REGIME_COLOR[regime] ?? { text: '#9ca3af', bg: 'rgba(156,163,175,0.1)', border: 'rgba(156,163,175,0.2)' }
  return (
    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
      style={{ color: c.text, background: c.bg, border: `1px solid ${c.border}` }}>
      {regime}
    </span>
  )
}

const MIN_DATE = '2006-01-01'
const MAX_DATE = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

export function HistoricalTab() {
  // ── Snapshot state ────────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState('')
  const [calendarOpen, setCalendarOpen] = useState(false)
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
          {/* Calendar trigger */}
          <div className="relative">
            <button
              onClick={() => setCalendarOpen(v => !v)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all"
              style={{
                background: calendarOpen ? 'rgba(198,255,31,0.08)' : 'rgba(255,255,255,0.04)',
                border: calendarOpen ? '1px solid rgba(198,255,31,0.35)' : '1px solid rgba(255,255,255,0.12)',
                color: selectedDate ? '#e8eaf0' : 'rgba(255,255,255,0.45)',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              {selectedDate || 'Pick a date'}
            </button>

            {calendarOpen && (
              <>
                {/* Backdrop */}
                <div className="fixed inset-0 z-10" onClick={() => setCalendarOpen(false)} />
                {/* Popover */}
                <div className="absolute top-full mt-2 left-0 z-20 rounded-xl p-4 border border-outline-variant/20 shadow-2xl"
                  style={{ background: '#16171c', minWidth: 288 }}>
                  <DateCalendar
                    value={selectedDate}
                    min={MIN_DATE}
                    max={MAX_DATE}
                    onChange={(d) => { setSelectedDate(d); setCalendarOpen(false) }}
                  />
                </div>
              </>
            )}
          </div>

          <button
            onClick={handleSnapshot}
            disabled={!selectedDate || snapshotLoading}
            className="px-5 py-2 text-xs font-bold rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            style={{ background: '#c6ff1f', color: '#0d0f12' }}
          >
            {snapshotLoading && (
              <span className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
            )}
            {snapshotLoading ? 'Loading…' : 'Run Snapshot'}
          </button>

          {snapshotData && !snapshotLoading && (
            <span className="text-xs font-semibold" style={{ color: '#c6ff1f' }}>
              Showing data as of {snapshotData.updated_at}
            </span>
          )}
          {snapshotError && (
            <span className="text-xs text-error bg-error/10 border border-error/30 rounded px-3 py-1.5">
              {snapshotError}
            </span>
          )}
        </div>

        {snapshotData && !snapshotLoading && (
          <div className="space-y-6 pt-2">
            <div className="flex flex-wrap items-center gap-4 pb-4 border-b border-outline-variant/20">
              <RegimePill regime={snapshotData.regime} />
              <div className="flex items-center gap-1 text-xs text-on-surface-variant">
                <span className="uppercase tracking-widest opacity-60">Score</span>
                <span className="font-bold text-on-surface ml-1">{snapshotData.total_score}</span>
                <span className="opacity-40">/</span>
                <span className="opacity-60">{snapshotData.max_score}</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-on-surface-variant">
                <span className="uppercase tracking-widest opacity-60">Probability</span>
                <span className="font-bold text-on-surface ml-1">{Math.round(snapshotData.probability * 100)}%</span>
              </div>
            </div>

            <ScoreCards scores={snapshotData.scores} />

            <div className="space-y-6">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              </div>
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
                style={{
                  width: `${100 / Math.max(timeline.length, 1)}%`,
                  background: regimeBarColor[t.regime] ?? '#6b7280',
                }}
                className="h-full"
                title={`${t.date} — ${t.regime} (${t.total_score}/13)`}
              />
            ))}
          </div>
          <div className="flex gap-4 mt-3">
            {Object.entries(regimeBarColor).map(([label, color]) => (
              <div key={label} className="flex items-center gap-1.5 text-[10px] text-on-surface-variant">
                <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: color }} />
                {label}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Major Event Overlays */}
          <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-4">
              Major Event Overlays
            </h3>
            <div className="space-y-2">
              {(insights?.event_overlays ?? []).map((e) => {
                const c = REGIME_COLOR[e.regime] ?? REGIME_COLOR['Neutral']
                return (
                  <div key={e.event} className="flex items-center justify-between rounded-lg px-3 py-2.5"
                    style={{ background: 'rgba(255,255,255,0.03)', borderLeft: `3px solid ${c.text}` }}>
                    <span className="text-xs text-on-surface font-medium">{e.event}</span>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <RegimePill regime={e.regime} />
                      <span className="text-[10px] text-on-surface-variant tabular-nums">{e.detected_date}</span>
                      <span className="text-[10px] font-semibold tabular-nums" style={{ color: c.text }}>{e.total_score}/13</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Regime Transitions */}
          <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">
              Regime Transitions
            </h3>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4">
              {Object.entries(insights?.avg_duration_days ?? {}).map(([k, v]) => {
                const c = REGIME_COLOR[k]
                return (
                  <div key={k} className="flex items-center gap-1.5 text-[10px]">
                    <span className="font-semibold" style={{ color: c?.text ?? '#9ca3af' }}>{k}</span>
                    <span className="text-on-surface-variant">{v}d avg</span>
                  </div>
                )
              })}
            </div>
            <div className="space-y-1.5 max-h-52 overflow-auto pr-1">
              {(insights?.transitions ?? []).slice(-12).reverse().map((t, idx) => {
                const fromC = REGIME_COLOR[t.from_regime ?? ''] ?? { text: '#9ca3af', bg: 'transparent', border: 'transparent' }
                const toC   = REGIME_COLOR[t.to_regime]         ?? { text: '#9ca3af', bg: 'transparent', border: 'transparent' }
                return (
                  <div key={`${t.date}-${idx}`} className="flex items-center justify-between rounded px-3 py-2"
                    style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <div className="flex items-center gap-2 text-xs">
                      <span style={{ color: fromC.text }} className="font-semibold">{t.from_regime ?? 'Start'}</span>
                      <span className="text-on-surface-variant">→</span>
                      <span style={{ color: toC.text }} className="font-semibold">{t.to_regime}</span>
                    </div>
                    <span className="text-[10px] text-on-surface-variant tabular-nums">{t.date}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Historical Allocation</h3>
            <div className="flex items-center gap-4 text-[10px] text-on-surface-variant">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: '#3b82f6' }} />Equities</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: '#22c55e' }} />Bonds</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: '#f59e0b' }} />Gold</span>
            </div>
          </div>
          <div className="space-y-1.5 max-h-64 overflow-auto pr-1">
            {(insights?.allocation_history ?? []).slice(-18).reverse().map((a, idx) => {
              const eq = Math.round(a.equities * 100)
              const bd = Math.round(a.bonds * 100)
              const gd = Math.round(a.gold * 100)
              return (
                <div key={`${a.date}-${idx}`} className="flex items-center gap-4 rounded px-3 py-2"
                  style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <span className="text-[10px] text-on-surface-variant tabular-nums w-24 shrink-0">{a.date}</span>
                  {/* Stacked bar */}
                  <div className="flex h-2 rounded overflow-hidden flex-1">
                    <div style={{ width: `${eq}%`, background: '#3b82f6' }} />
                    <div style={{ width: `${bd}%`, background: '#22c55e' }} />
                    <div style={{ width: `${gd}%`, background: '#f59e0b' }} />
                  </div>
                  {/* Labels */}
                  <div className="flex items-center gap-3 text-[10px] tabular-nums shrink-0">
                    <span style={{ color: '#3b82f6' }} className="font-semibold">{eq}%</span>
                    <span style={{ color: '#22c55e' }} className="font-semibold">{bd}%</span>
                    <span style={{ color: '#f59e0b' }} className="font-semibold">{gd}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
