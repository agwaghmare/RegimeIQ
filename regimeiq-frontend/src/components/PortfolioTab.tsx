import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { loadUserSettings } from '../lib/userSettings'
import type { Allocation, RebalancePlan, RegimeEquityExample } from '../types/regime'

interface Props {
  allocation: Allocation
  regime: string
}

interface ETF {
  ticker: string
  name: string
  desc: string
}

function regimeBadgeClass(regime: string): string {
  if (regime === 'Risk-On') return 'bg-slate-400/20 text-slate-200'
  if (regime === 'Risk-Off') return 'bg-zinc-500/25 text-zinc-200'
  if (regime === 'Crisis') return 'bg-stone-500/25 text-stone-200'
  return 'bg-gray-500/25 text-gray-200'
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const span = Math.min(endDeg - startDeg, 359.9)
  const s = polarToCartesian(cx, cy, r, startDeg)
  const e = polarToCartesian(cx, cy, r, startDeg + span)
  const large = span > 180 ? 1 : 0
  return `M ${s.x.toFixed(3)} ${s.y.toFixed(3)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(3)} ${e.y.toFixed(3)}`
}

const EQUITIES_ETFS: ETF[] = [
  { ticker: 'VOO', name: 'Vanguard S&P 500 ETF', desc: 'Tracks the S&P 500; broad large-cap US exposure.' },
  { ticker: 'SCHB', name: 'Schwab US Broad Market ETF', desc: 'Total US market, very low expense ratio.' },
  { ticker: 'QQQ', name: 'Invesco Nasdaq-100 ETF', desc: 'Top 100 non-financial Nasdaq names; tech-heavy growth.' },
]

const BONDS_ETFS: ETF[] = [
  { ticker: 'BIL', name: 'SPDR Bloomberg 1-3 Month T-Bill ETF', desc: 'Ultra-short duration; near-zero rate risk.' },
  { ticker: 'SHV', name: 'iShares Short Treasury Bond ETF', desc: 'Short-term US Treasuries, 1 year and under.' },
  { ticker: 'TLT', name: 'iShares 20+ Year Treasury Bond ETF', desc: 'Long-duration Treasuries; high rate sensitivity.' },
  { ticker: 'AGG', name: 'iShares Core US Aggregate Bond ETF', desc: 'Broad investment-grade bond market.' },
]

const ALTS_ETFS: ETF[] = [
  { ticker: 'GLD', name: 'SPDR Gold Shares', desc: 'Largest gold ETF by AUM; tracks spot gold price.' },
  { ticker: 'IAU', name: 'iShares Gold Trust', desc: 'Lower expense ratio alternative to GLD.' },
]

function ETFRow({ etf }: { etf: ETF }) {
  return (
    <div className="flex items-start gap-3 py-3 px-4 border-b border-outline-variant/10 last:border-0">
      <span className="font-mono text-xs px-2 py-1 rounded bg-surface-container-highest text-on-surface shrink-0">
        {etf.ticker}
      </span>
      <div className="min-w-0">
        <div className="text-sm font-medium text-on-surface leading-tight">{etf.name}</div>
        <div className="text-xs text-on-surface-variant mt-0.5">{etf.desc}</div>
      </div>
    </div>
  )
}

function AssetCard({
  title,
  pct,
  color,
  etfs,
  placeholder,
}: {
  title: string
  pct: number
  color: string
  etfs: ETF[]
  placeholder: string
}) {
  return (
    <div className="bg-surface-container rounded-xl border border-outline-variant/20 overflow-hidden flex flex-col">
      <div className="h-1.5 w-full" style={{ backgroundColor: color }} />
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider">{title}</h3>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: `${color}22`, color }}
        >
          {Math.round(pct * 100)}%
        </span>
      </div>
      <div className="flex-1">
        {etfs.map((etf) => (
          <ETFRow key={etf.ticker} etf={etf} />
        ))}
      </div>
      <div className="mx-4 mb-4 mt-2 rounded-lg border border-dashed border-outline-variant/30 p-3 text-xs text-on-surface-variant/50 text-center">
        {placeholder}
      </div>
    </div>
  )
}

export function PortfolioTab({ allocation, regime }: Props) {
  const [plan, setPlan] = useState<RebalancePlan | null>(null)
  const [planError, setPlanError] = useState<string | null>(null)
  const [loadingPlan, setLoadingPlan] = useState(true)

  const loadPlan = useCallback(() => {
    const risk = loadUserSettings().riskTolerance
    setLoadingPlan(true)
    setPlanError(null)
    api
      .getRebalancePlan(risk)
      .then(setPlan)
      .catch((e) => setPlanError((e as Error).message))
      .finally(() => setLoadingPlan(false))
  }, [])

  useEffect(() => {
    loadPlan()
  }, [loadPlan])

  useEffect(() => {
    window.addEventListener('regimeiq-settings', loadPlan)
    return () => window.removeEventListener('regimeiq-settings', loadPlan)
  }, [loadPlan])

  const target = useMemo(() => {
    const w = plan?.bucket_weights
    if (w) {
      return {
        eq: w.equities,
        bd: w.bonds,
        alt: w.commodities,
        label: plan?.risk_tolerance ?? loadUserSettings().riskTolerance,
      }
    }
    return {
      eq: allocation.equities,
      bd: allocation.bonds,
      alt: allocation.alternatives,
      label: 'regime baseline',
    }
  }, [plan, allocation])

  const CX = 100
  const CY = 100
  const R = 72
  const SW = 28

  const eqDeg = target.eq * 360
  const bdDeg = target.bd * 360
  const altDeg = target.alt * 360

  const segments = [
    { key: 'eq',  label: 'Equities',     pct: target.eq,  deg: eqDeg,  start: 0,            color: '#3b82f6' },
    { key: 'bd',  label: 'Fixed Income', pct: target.bd,  deg: bdDeg,  start: eqDeg,         color: '#22c55e' },
    { key: 'alt', label: 'Alternatives', pct: target.alt, deg: altDeg, start: eqDeg + bdDeg, color: '#f59e0b' },
  ]

  return (
    <section className="ml-0 md:ml-64 pt-20 p-6 min-h-screen">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h2 className="text-xl font-bold text-on-surface tracking-tight">Portfolio Allocation</h2>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${regimeBadgeClass(regime)}`}>{regime}</span>
            {plan && (
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-primary/20 text-primary border border-primary/30">
                Risk: {plan.risk_tolerance}
              </span>
            )}
          </div>
        </div>

        {loadingPlan && (
          <div className="text-xs text-on-surface-variant">Loading your rebalance plan from Settings…</div>
        )}
        {planError && <div className="text-xs text-error">Rebalance plan unavailable: {planError}</div>}

        {plan?.model_portfolio && plan.model_portfolio.length > 0 && (
          <div className="bg-surface-container rounded-xl border border-primary/20 p-5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-primary mb-3">
              Suggested holdings (Sharpe-ranked, from Settings)
            </h3>
            <div className="space-y-2">
              {plan.model_portfolio.map((h) => (
                <div key={h.ticker} className="flex justify-between text-sm border-b border-outline-variant/10 pb-2 last:border-0">
                  <span className="font-mono font-semibold">{h.ticker}</span>
                  <span className="text-on-surface-variant">
                    {Math.round(h.target_weight * 100)}% · Sharpe {h.sharpe.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-on-surface-variant mt-3">
              Weights follow your risk tolerance in Settings and the current regime. Adjust in Settings to update this page.
            </p>
          </div>
        )}

        {plan?.regime_equity_examples && plan.regime_equity_examples.length > 0 && (
          <div className="bg-surface-container rounded-xl border border-outline-variant/25 p-5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1">
              Regime-linked single names
            </h3>
            <p className="text-[10px] text-on-surface-variant/80 mb-4">
              Examples for <span className="font-semibold text-on-surface">{plan.regime}</span> — for research; not
              back-tested in RegimeIQ data.
            </p>
            <div className="space-y-3">
              {plan.regime_equity_examples.map((ex: RegimeEquityExample) => (
                <div key={ex.ticker} className="flex gap-3 text-sm border-b border-outline-variant/10 pb-3 last:border-0 last:pb-0">
                  <span className="font-mono text-xs px-2 py-1 rounded bg-surface-container-highest text-on-surface shrink-0 h-fit">
                    {ex.ticker}
                  </span>
                  <div className="min-w-0">
                    <div className="font-medium text-on-surface">{ex.name}</div>
                    <div className="text-xs text-on-surface-variant mt-0.5">{ex.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-surface-container rounded-xl border border-outline-variant/20 p-6 flex items-center justify-center">
            <svg viewBox="0 0 200 200" width={200} height={200} className="overflow-visible">
              <circle cx={CX} cy={CY} r={R} fill="none" stroke="currentColor" strokeWidth={SW} className="text-surface-container-highest" />
              {segments.map((seg) => (
                <path
                  key={seg.key}
                  d={arcPath(CX, CY, R, seg.start, seg.start + seg.deg)}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={SW}
                  strokeLinecap="butt"
                />
              ))}
              <text x={CX} y={CY - 6} textAnchor="middle" className="fill-on-surface" fontSize={13} fontWeight="700">
                {plan ? 'Target mix' : 'Regime'}
              </text>
              <text x={CX} y={CY + 12} textAnchor="middle" className="fill-on-surface-variant" fontSize={10}>
                {target.label}
              </text>
            </svg>
          </div>

          <div className="bg-surface-container rounded-xl border border-outline-variant/20 p-6 flex flex-col justify-center space-y-5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">
              {plan ? 'Target mix (Settings + regime)' : 'Regime allocation'}
            </h3>
            {segments.map((seg) => (
              <div key={seg.key} className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-on-surface-variant">{seg.label}</span>
                  <span className="font-bold tabular-nums" style={{ color: seg.color }}>
                    {Math.round(seg.pct * 100)}%
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-surface-container-highest overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${seg.pct * 100}%`, backgroundColor: seg.color }} />
                </div>
              </div>
            ))}
            {plan && (
              <div className="pt-2 text-[10px] text-on-surface-variant border-t border-outline-variant/20">
                Regime-only baseline: {Math.round(allocation.equities * 100)}% / {Math.round(allocation.bonds * 100)}% /{' '}
                {Math.round(allocation.alternatives * 100)}% (eq / bonds / alts)
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <AssetCard
            title="Equities"
            pct={target.eq}
            color="#3b82f6"
            etfs={EQUITIES_ETFS}
            placeholder={
              plan?.regime_equity_examples?.length
                ? `Examples: ${plan.regime_equity_examples.map((s) => s.ticker).join(', ')}`
                : plan?.buy_recommendations?.stocks?.length
                  ? `Favor: ${plan.buy_recommendations.stocks.map((s) => s.ticker).join(', ')}`
                  : 'Individual Stocks — Coming Soon'
            }
          />
          <AssetCard
            title="Fixed Income"
            pct={target.bd}
            color="#22c55e"
            etfs={BONDS_ETFS}
            placeholder={plan?.buy_recommendations?.bonds?.length ? `Favor: ${plan.buy_recommendations.bonds.map((s) => s.ticker).join(', ')}` : 'More Bond Options — Coming Soon'}
          />
          <AssetCard
            title="Alternatives"
            pct={target.alt}
            color="#f59e0b"
            etfs={ALTS_ETFS}
            placeholder={plan?.buy_recommendations?.commodities?.length ? `Favor: ${plan.buy_recommendations.commodities.map((s) => s.ticker).join(', ')}` : 'Commodities, REITs, Crypto — Coming Soon'}
          />
        </div>

        <div className="flex items-start gap-3 rounded-xl bg-primary-container/20 border border-primary/10 p-4 text-xs text-on-primary-container">
          <span className="material-symbols-outlined text-primary text-base shrink-0">lightbulb</span>
          <span>
            The <strong className="font-bold">{regime}</strong> regime sets the baseline. Your{' '}
            <strong className="font-bold">Settings → risk tolerance</strong> tilts the target mix and drives the Sharpe-based
            6-holding list above. Change tolerance or refresh data, then reopen Portfolio to update.
          </span>
        </div>
      </div>
    </section>
  )
}
