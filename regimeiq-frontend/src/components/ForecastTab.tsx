import { useEffect, useState } from 'react'
import { api, type ForecastResponse } from '../lib/api'
import type { FedWatch, MacroReleaseCalendar } from '../types/regime'

interface Props {
  regime: string
  fedwatch: FedWatch
  releaseCalendar: MacroReleaseCalendar
}

const REGIME_COLORS: Record<string, string> = {
  'Risk-On': '#22c55e',
  'Neutral': '#eab308',
  'Risk-Off': '#f97316',
  'Crisis': '#ef4444',
}

const REGIME_BG: Record<string, string> = {
  'Risk-On': 'bg-green-500/20 border-green-500/30',
  'Neutral': 'bg-yellow-500/20 border-yellow-500/30',
  'Risk-Off': 'bg-orange-500/20 border-orange-500/30',
  'Crisis': 'bg-red-500/20 border-red-500/30',
}

function streakColor(ratio: number): string {
  if (ratio >= 1.2) return 'bg-error'
  if (ratio >= 0.8) return 'bg-[#eab308]'
  return 'bg-primary'
}

function dirArrow(dir: string, goodDir: 'up' | 'down'): { icon: string; color: string } {
  if (dir === 'flat') return { icon: 'trending_flat', color: 'text-on-surface-variant' }
  const isGood = dir === goodDir
  return {
    icon: dir === 'up' ? 'north_east' : 'south_east',
    color: isGood ? 'text-green-400' : 'text-error',
  }
}

// Which direction is "improving" (lower risk) for each signal
const GOOD_DIR: Record<string, 'up' | 'down'> = {
  vix_level: 'down',
  credit_spread: 'down',
  cpi_yoy: 'down',
  yield_spread: 'up',
  sp500_drawdown: 'up',
  fed_funds_3m_change: 'down',
}

const SIGNAL_LABELS: Record<string, string> = {
  vix_level: 'VIX',
  credit_spread: 'HY Credit Spread',
  cpi_yoy: 'CPI YoY',
  yield_spread: 'Yield Spread (10Y–2Y)',
  sp500_drawdown: 'SPX Drawdown',
  fed_funds_3m_change: 'Fed Funds 3M Δ',
}

// Thresholds that flip a boolean signal
const FLIP_THRESHOLDS: Array<{
  key: string
  label: string
  threshold: number
  flipDir: 'above' | 'below'
  flagLabel: string
}> = [
  { key: 'vix_level', label: 'VIX', threshold: 25, flipDir: 'above', flagLabel: 'VIX > 25 adds +1 market risk' },
  { key: 'credit_spread', label: 'HY Spread', threshold: 4.0, flipDir: 'above', flagLabel: 'Spread > 4.0 adds +1 financial stress' },
  { key: 'cpi_yoy', label: 'CPI YoY', threshold: 3.0, flipDir: 'above', flagLabel: 'CPI > 3.0% adds +1 inflation stress' },
  { key: 'yield_spread', label: 'Yield Spread', threshold: 0, flipDir: 'below', flagLabel: 'Inversion adds +1 growth risk' },
]

function impactLevel(event: string): 'HIGH' | 'MEDIUM' | 'LOW' {
  const e = event.toLowerCase()
  if (e.includes('cpi') || e.includes('pce') || e.includes('payroll') || e.includes('nfp') || e.includes('gdp') || e.includes('fomc') || e.includes('fed')) return 'HIGH'
  if (e.includes('pmi') || e.includes('ism') || e.includes('retail') || e.includes('inflation') || e.includes('unemployment')) return 'MEDIUM'
  return 'LOW'
}

function impactSignals(event: string): string {
  const e = event.toLowerCase()
  if (e.includes('cpi') || e.includes('pce') || e.includes('inflation')) return 'Inflation signal'
  if (e.includes('payroll') || e.includes('nfp') || e.includes('employment') || e.includes('unemployment')) return 'Growth signal'
  if (e.includes('gdp')) return 'Growth + Inflation'
  if (e.includes('fomc') || e.includes('fed') || e.includes('rate')) return 'Policy signal'
  if (e.includes('pmi') || e.includes('ism')) return 'Growth signal'
  return 'Macro signal'
}

// Score trajectory SVG chart
function ScoreTrajectoryChart({
  data,
  scoreForecast,
}: {
  data: ForecastResponse['score_trajectory']
  scoreForecast?: ForecastResponse['score_forecast']
}) {
  if (data.length === 0) return null

  const W = 800
  const H = 180
  const PAD = { top: 12, right: 40, bottom: 28, left: 8 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom

  const minScore = 0
  const maxScore = 10
  const scaleY = (v: number) => PAD.top + chartH - ((v - minScore) / (maxScore - minScore)) * chartH
  const scaleX = (i: number) => PAD.left + (i / Math.max(data.length - 1, 1)) * chartW

  // Background regime bands (0–2.5 Risk-On, 2.5–5 Neutral, 5–7.5 Risk-Off, 7.5–10 Crisis)
  const bands = [
    { lo: 0, hi: 2.5, color: '#22c55e', opacity: 0.08, label: 'Risk-On' },
    { lo: 2.5, hi: 5, color: '#eab308', opacity: 0.08, label: 'Neutral' },
    { lo: 5, hi: 7.5, color: '#f97316', opacity: 0.08, label: 'Risk-Off' },
    { lo: 7.5, hi: 10, color: '#ef4444', opacity: 0.08, label: 'Crisis' },
  ]

  // Forward projection: use backend ML Ridge AR forecast
  let projPoints: Array<{ x: number; y: number }> = []
  const stepX = chartW / Math.max(data.length - 1, 1)
  if (scoreForecast && scoreForecast.length >= 1) {
    const lastX = scaleX(data.length - 1)
    const lastY = scaleY(data[data.length - 1].total_score)
    projPoints = [
      { x: lastX, y: lastY },
      ...scoreForecast.map((pt, i) => ({
        x: lastX + stepX * (i + 1),
        y: scaleY(pt.predicted_score),
      })),
    ]
  }

  const polyline = data.map((d, i) => `${scaleX(i)},${scaleY(d.total_score)}`).join(' ')
  const projLine = projPoints.map((p) => `${p.x},${p.y}`).join(' ')

  // Y-axis labels
  const yLabels = [0, 2.5, 5, 7.5, 10]

  // X-axis: show year at Jan
  const xLabels: Array<{ label: string; x: number }> = []
  let lastYear = ''
  data.forEach((d, i) => {
    const year = d.date.slice(0, 4)
    const month = d.date.slice(5, 7)
    if (month === '01' && year !== lastYear) {
      xLabels.push({ label: year, x: scaleX(i) })
      lastYear = year
    }
  })

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto"
      style={{ maxHeight: 180 }}
    >
      {/* Band backgrounds */}
      {bands.map((b) => (
        <rect
          key={b.label}
          x={PAD.left}
          y={scaleY(b.hi)}
          width={chartW}
          height={scaleY(b.lo) - scaleY(b.hi)}
          fill={b.color}
          fillOpacity={b.opacity}
        />
      ))}

      {/* Y-axis grid lines + labels */}
      {yLabels.map((v) => (
        <g key={v}>
          <line
            x1={PAD.left}
            y1={scaleY(v)}
            x2={PAD.left + chartW}
            y2={scaleY(v)}
            stroke="#ffffff12"
            strokeWidth={1}
          />
          <text
            x={W - PAD.right + 4}
            y={scaleY(v) + 4}
            fontSize={9}
            fill="#9ba3ad"
          >
            {v}
          </text>
        </g>
      ))}

      {/* X-axis labels */}
      {xLabels.map((xl) => (
        <text
          key={xl.label}
          x={xl.x}
          y={H - 6}
          fontSize={9}
          fill="#9ba3ad"
          textAnchor="middle"
        >
          {xl.label}
        </text>
      ))}

      {/* Score line */}
      <polyline
        points={polyline}
        fill="none"
        stroke="#c3c9d1"
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {/* Confidence band for ML forecast */}
      {scoreForecast && scoreForecast.length >= 1 && (() => {
        const lastX = scaleX(data.length - 1)
        const anchorY = scaleY(data[data.length - 1].total_score)
        const topPoints = scoreForecast.map((pt, i) =>
          `${lastX + stepX * (i + 1)},${scaleY(pt.hi)}`
        ).join(' ')
        const botPoints = scoreForecast.slice().reverse().map((pt, i, arr) =>
          `${lastX + stepX * (arr.length - i)},${scaleY(pt.lo)}`
        ).join(' ')
        return (
          <polygon
            points={`${lastX},${anchorY} ${topPoints} ${botPoints}`}
            fill="#c3c9d1"
            fillOpacity={0.08}
          />
        )
      })()}

      {/* Forward projection (dotted) */}
      {projPoints.length > 1 && (
        <polyline
          points={projLine}
          fill="none"
          stroke="#c3c9d1"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          strokeOpacity={0.5}
        />
      )}

      {/* Current point */}
      {data.length > 0 && (
        <circle
          cx={scaleX(data.length - 1)}
          cy={scaleY(data[data.length - 1].total_score)}
          r={5}
          fill="#c3c9d1"
          stroke="#131316"
          strokeWidth={2}
        />
      )}
    </svg>
  )
}

export function ForecastTab({ regime, fedwatch, releaseCalendar }: Props) {
  const [forecast, setForecast] = useState<ForecastResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.getForecast()
      .then((d) => { if (!cancelled) { setForecast(d); setLoading(false) } })
      .catch((e) => { if (!cancelled) { setError((e as Error).message); setLoading(false) } })
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <section className="ml-0 md:ml-64 pt-20 p-6 min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-on-surface-variant uppercase tracking-widest">Computing forecast…</p>
        </div>
      </section>
    )
  }

  if (error || !forecast) {
    return (
      <section className="ml-0 md:ml-64 pt-20 p-6 min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3 max-w-sm">
          <span className="material-symbols-outlined text-error text-3xl">error</span>
          <p className="text-xs text-on-surface-variant">{error ?? 'Forecast unavailable'}</p>
        </div>
      </section>
    )
  }

  const streak = forecast.current_streak
  const avgDuration = forecast.avg_duration_days[streak.regime] ?? 1
  const streakRatio = streak.days / Math.max(avgDuration, 1)

  // Most likely next regime (highest prob non-current from transition_matrix)
  const transitions = forecast.transition_matrix[regime] ?? {}
  const nextRegime = Object.entries(transitions)
    .filter(([r]) => r !== regime)
    .sort(([, a], [, b]) => b - a)[0]

  const projHorizons: Array<{ key: keyof ForecastResponse['projected_regimes']; label: string }> = [
    { key: 't1m', label: '1 Month' },
    { key: 't3m', label: '3 Months' },
    { key: 't6m', label: '6 Months' },
  ]

  // Flip trigger watchlist — proximity to threshold
  const flipTriggers = FLIP_THRESHOLDS.flatMap((spec) => {
    const sig = forecast.signal_momentum[spec.key]
    if (!sig || sig.value == null) return []
    const val = sig.value
    let distance: number
    let direction: string
    if (spec.flipDir === 'above') {
      distance = spec.threshold - val
      direction = distance > 0 ? `+${distance.toFixed(2)} away` : `TRIGGERED`
    } else {
      distance = val - spec.threshold
      direction = distance > 0 ? `${distance.toFixed(2)} above inversion` : `TRIGGERED`
    }
    const proximity = Math.abs(spec.flipDir === 'above' ? distance : distance) / Math.abs(spec.threshold || 1)
    return [{ ...spec, val, distance, direction, proximity, triggered: distance <= 0 }]
  }).sort((a, b) => a.proximity - b.proximity)

  const releases = releaseCalendar.releases ?? []

  return (
    <section className="ml-0 md:ml-64 pt-20 p-6 min-h-screen space-y-6">

      {/* ── Section 1: Regime Outlook Header ─────────────────────────── */}
      <div className="bg-gradient-to-r from-[#181a1f] to-[#272c34] rounded-xl p-6 border border-primary/30 shadow-[0_0_40px_rgba(195,201,209,0.14)]">
        <div className="text-[11px] uppercase tracking-widest text-primary mb-3">Regime Outlook</div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div>
            <div className="text-xs text-on-surface-variant uppercase mb-1">Current Regime</div>
            <div className="text-2xl font-black" style={{ color: REGIME_COLORS[regime] ?? '#c3c9d1' }}>
              {regime}
            </div>
            <div className="text-xs text-on-surface-variant mt-1">
              Day {streak.days} of streak <span className="opacity-60">(avg {Math.round(avgDuration)} days)</span>
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-surface-container-highest overflow-hidden">
              <div
                className={`h-full transition-all duration-700 ${streakColor(streakRatio)}`}
                style={{ width: `${Math.min(100, streakRatio * 100).toFixed(0)}%` }}
              />
            </div>
            <div className="mt-1 text-[10px] text-on-surface-variant">
              {streakRatio >= 1.2 ? 'Over-extended — transition overdue' : streakRatio >= 0.8 ? 'Approaching average duration' : 'Early in regime cycle'}
            </div>
          </div>

          <div>
            <div className="text-xs text-on-surface-variant uppercase mb-1">Most Likely Next Regime</div>
            {nextRegime ? (
              <>
                <div className="text-xl font-bold" style={{ color: REGIME_COLORS[nextRegime[0]] ?? '#c3c9d1' }}>
                  {nextRegime[0]}
                </div>
                <div className="text-sm text-on-surface-variant mt-1">
                  {Math.round(nextRegime[1] * 100)}% historical probability
                </div>
              </>
            ) : (
              <div className="text-sm text-on-surface-variant">—</div>
            )}
          </div>

          <div>
            <div className="text-xs text-on-surface-variant uppercase mb-2">Average Regime Duration</div>
            <div className="space-y-1">
              {(['Risk-On', 'Neutral', 'Risk-Off', 'Crisis'] as const).map((r) => (
                <div key={r} className="flex items-center justify-between text-xs">
                  <span style={{ color: REGIME_COLORS[r] }}>{r}</span>
                  <span className="text-on-surface-variant">{Math.round(forecast.avg_duration_days[r] ?? 0)} days</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 2: Regime Probability Projections ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {projHorizons.map(({ key, label }) => {
          const probs = forecast.projected_regimes[key]
          const sorted = Object.entries(probs).sort(([, a], [, b]) => b - a)
          return (
            <div key={key} className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
              <div className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4">{label}</div>
              <div className="space-y-2.5">
                {sorted.map(([r, p]) => (
                  <div key={r}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span style={{ color: REGIME_COLORS[r] }}>{r}</span>
                      <span className="font-mono text-on-surface">{Math.round(p * 100)}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-surface-container-highest overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.round(p * 100)}%`, backgroundColor: REGIME_COLORS[r] ?? '#c3c9d1' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Section 3: Score Trajectory ───────────────────────────────── */}
      <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              Score Trajectory
            </h3>
            <div className="text-[10px] text-on-surface-variant opacity-60 mt-0.5">
              Last {forecast.score_trajectory.length} months · dotted line = 3M projection
            </div>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-on-surface-variant">
            {['Risk-On', 'Neutral', 'Risk-Off', 'Crisis'].map((r) => (
              <span key={r} className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: REGIME_COLORS[r] }} />
                {r}
              </span>
            ))}
          </div>
        </div>
        <ScoreTrajectoryChart data={forecast.score_trajectory} scoreForecast={forecast.score_forecast} />
      </div>

      {/* ── Section 4: FedWatch Rate Path ─────────────────────────────── */}
      <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
        <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4">
          FedWatch Policy Outlook
        </h3>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Rate Cut', key: 'cut' as const, color: '#22c55e' },
            { label: 'Hold', key: 'hold' as const, color: '#eab308' },
            { label: 'Rate Hike', key: 'hike' as const, color: '#ef4444' },
          ].map(({ label, key, color }) => {
            const pct = Math.round((fedwatch.next_3m[key] ?? 0) * 100)
            return (
              <div key={key} className="text-center">
                <div className="text-2xl font-black" style={{ color }}>{pct}%</div>
                <div className="text-xs text-on-surface-variant mt-1">{label}</div>
                <div className="mt-2 h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-4 pt-4 border-t border-outline-variant/10 text-xs text-on-surface-variant">
          <span className="opacity-60">Source: {fedwatch.source} · As of {fedwatch.as_of}</span>
          <span className="ml-4">Next 3-month Fed meeting window</span>
        </div>
      </div>

      {/* ── Section 5: Signal Momentum + Flip Triggers ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
          <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4">Signal Momentum</h3>
          <div className="space-y-2">
            {Object.entries(forecast.signal_momentum).map(([key, sig]) => {
              const arrow = dirArrow(sig.direction, GOOD_DIR[key] ?? 'down')
              const fmtVal = sig.value != null ? (Math.abs(sig.value) < 0.01 ? sig.value.toFixed(4) : sig.value.toFixed(2)) : '—'
              const fmtChg = sig.change_3m != null ? (sig.change_3m > 0 ? `+${sig.change_3m.toFixed(2)}` : sig.change_3m.toFixed(2)) : '—'
              return (
                <div key={key} className="flex items-center justify-between border-b border-outline-variant/10 pb-2 last:border-0 last:pb-0 text-xs">
                  <span className="text-on-surface-variant w-36">{SIGNAL_LABELS[key] ?? key}</span>
                  <span className="font-mono text-on-surface">{fmtVal}</span>
                  <span className="font-mono text-on-surface-variant w-16 text-right">{fmtChg}</span>
                  <span className={`material-symbols-outlined text-base ml-2 ${arrow.color}`}>{arrow.icon}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
          <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4">Flip Trigger Watchlist</h3>
          <div className="space-y-2 text-xs">
            {flipTriggers.map((t) => (
              <div
                key={t.key}
                className={`rounded border px-3 py-2 ${t.triggered ? 'border-error/40 bg-error/10' : t.proximity <= 0.2 ? 'border-[#f97316]/30 bg-[#f97316]/10' : 'border-outline-variant/20 bg-surface-container-high'}`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-semibold">{t.label}</span>
                  <span className={t.triggered ? 'text-error font-bold' : t.proximity <= 0.2 ? 'text-[#f97316]' : 'text-on-surface-variant'}>
                    {t.triggered ? 'TRIGGERED' : t.direction}
                  </span>
                </div>
                <div className="text-on-surface-variant opacity-70">{t.flagLabel}</div>
              </div>
            ))}
            {flipTriggers.length === 0 && (
              <div className="text-on-surface-variant opacity-60 text-center py-4">No signal data available</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Section 6: Upcoming Macro Catalysts ───────────────────────── */}
      <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
        <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4">
          Upcoming Macro Catalysts
        </h3>
        {releases.length === 0 ? (
          <div className="text-xs text-on-surface-variant opacity-60 text-center py-4">
            No upcoming releases in calendar
          </div>
        ) : (
          <div className="space-y-2">
            {releases.map((r, i) => {
              const impact = impactLevel(r.event)
              const signals = impactSignals(r.event)
              return (
                <div key={i} className="flex items-center gap-4 border-b border-outline-variant/10 pb-2 last:border-0 last:pb-0 text-xs">
                  <span className="text-on-surface-variant w-24 shrink-0 font-mono">{r.date}</span>
                  <span className="flex-1 text-on-surface">{r.event}</span>
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
                      impact === 'HIGH'
                        ? 'border-error/30 bg-error/10 text-error'
                        : impact === 'MEDIUM'
                          ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400'
                          : 'border-outline-variant/20 bg-surface-container-high text-on-surface-variant'
                    }`}
                  >
                    {impact}
                  </span>
                  <span className="text-on-surface-variant shrink-0 w-32 text-right opacity-70">{signals}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
