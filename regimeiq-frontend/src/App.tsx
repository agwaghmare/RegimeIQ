import { useEffect, useMemo, useState } from 'react'
import { BankaiTransitionProvider } from './components/BankaiTransition'
import { useRegime } from './hooks/useRegime'
import { api } from './lib/api'
import { IntroScreen } from './components/IntroScreen'
import { TopNav } from './components/TopNav'
import { SideNav } from './components/SideNav'
import { ScoreCards } from './components/ScoreCards'
import { MetricsTable } from './components/MetricsTable'
import { RegimeBreakdown } from './components/RegimeBreakdown'
import { PortfolioAllocation } from './components/PortfolioAllocation'
import { GlobalMacroTab } from './components/GlobalMacroTab'
import { RiskLabTab } from './components/RiskLabTab'
import { PlaybookTab } from './components/PlaybookTab'
import { SettingsTab } from './components/SettingsTab'
import { HistoricalTab } from './components/HistoricalTab'
import { PortfolioTab } from './components/PortfolioTab'
import type { MetricRow, RegimeData } from './types/regime'
import type { HistoricalInsightsResponse } from './lib/api'

function regimeStyle(regime: string): { riskLevel: string; tone: string; glow: string } {
  if (regime === 'Risk-On')  return { riskLevel: 'Low Risk',      tone: 'text-white',         glow: 'from-[#c6ff1f]/12 to-transparent' }
  if (regime === 'Risk-Off') return { riskLevel: 'High Risk',     tone: 'text-orange-400',    glow: 'from-orange-500/16 to-transparent' }
  if (regime === 'Crisis')   return { riskLevel: 'Extreme Risk',  tone: 'text-red-400',       glow: 'from-red-600/18 to-transparent' }
  return { riskLevel: 'Moderate Risk',  tone: 'text-amber-400',   glow: 'from-amber-500/14 to-transparent' }
}

function topSignals(data: RegimeData): MetricRow[] {
  const all = [
    ...data.growth_metrics,
    ...data.inflation_metrics,
    ...data.financial_metrics,
    ...data.market_metrics,
  ]
  const ranked = all
    .filter((row) => row.status !== 'NORMAL')
    .sort((a, b) => {
      const weight = { CRITICAL: 3, WARNING: 2, NEUTRAL: 1, NORMAL: 0 }
      return weight[b.status] - weight[a.status]
    })
  return (ranked.length > 0 ? ranked : all).slice(0, 5)
}

function suggestedActions(regime: string): string[] {
  if (regime === 'Risk-Off' || regime === 'Crisis') {
    return ['Reduce equity exposure and trim high beta names.', 'Monitor credit spreads for further stress.', 'Increase defensive duration and cash buffers.']
  }
  if (regime === 'Risk-On') {
    return ['Lean into quality cyclicals with risk controls.', 'Keep trailing stops on broad equity exposure.', 'Watch inflation surprises before adding duration.']
  }
  return ['Keep neutral positioning across major buckets.', 'Use selective add-on trades only on confirmation.', 'Track policy and volatility signals for a break.']
}

type ArticleCategory = 'Macro' | 'Stock-specific' | 'Sector-specific'

type ArticleBrief = {
  category: ArticleCategory
  source: string
  title: string
  summary: string
  href: string
}

const articleBriefs: ArticleBrief[] = [
  {
    category: 'Macro',
    source: 'Reuters',
    title: 'Bond investors target steeper US yield curve',
    summary: 'Positioning points to slower-growth expectations and rising long-end supply pressure, while the front end reflects rate-cut expectations.',
    href: 'https://www.reuters.com/business/bond-investors-target-steeper-us-yield-curve-bets-slower-growth-more-debt-2026-04-14/',
  },
  {
    category: 'Macro',
    source: 'Reuters',
    title: 'IMF trims growth outlook for emerging economies',
    summary: 'The latest IMF view highlights weaker aggregate EM growth as conflict and commodity shocks create uneven pressure across importers and exporters.',
    href: 'https://www.reuters.com/world/asia-pacific/imf-cuts-emerging-economies-growth-estimate-war-darkens-outlook-2026-04-14/',
  },
  {
    category: 'Stock-specific',
    source: 'CNBC',
    title: 'JPMorgan flags additional downside for Tesla',
    summary: 'The call underscores concern around demand and valuation reset risk, keeping single-name volatility elevated despite broader market rebounds.',
    href: 'https://www.cnbc.com/2026/04/06/tesla-is-down-sharply-in-2026-jpmorgan-sees-even-more-declines-ahead.html',
  },
  {
    category: 'Stock-specific',
    source: 'CNBC',
    title: 'Intel jumps after fab buyback move',
    summary: 'The buyback of its Ireland fab stake is being read as a balance-sheet confidence signal, driving a sharp short-term re-rating in shares.',
    href: 'https://www.cnbc.com/2026/04/01/intel-stock-ireland-stake-chip-factory.html',
  },
  {
    category: 'Sector-specific',
    source: 'Reuters',
    title: 'Tech valuations may offer entry point',
    summary: 'After a deep relative drawdown, strategists point to strong projected earnings contribution from IT versus the broader index.',
    href: 'https://www.reuters.com/business/finance/depressed-tech-valuations-could-offer-entry-point-investors-goldman-sachs-says-2026-04-07/',
  },
  {
    category: 'Sector-specific',
    source: 'Reuters',
    title: 'Commodities supercycle argument gains traction',
    summary: 'Energy and materials sentiment remains tied to supply disruptions and policy risk, supporting a higher-volatility but constructive sector backdrop.',
    href: 'https://www.reuters.com/markets/commodities/commodities-supercycle-is-here-how-might-investors-participate-2026-04-13/',
  },
]

function signalStyle(status: MetricRow['status']): string {
  if (status === 'CRITICAL') return 'text-red-300 bg-red-900/30 border-red-500/40'
  if (status === 'WARNING')  return 'text-amber-300 bg-amber-900/25 border-amber-500/35'
  if (status === 'NEUTRAL')  return 'text-sky-300 bg-sky-900/20 border-sky-500/30'
  return 'text-slate-400 bg-slate-800/20 border-slate-600/20'
}

function trendArrow(t: MetricRow['trend']): string {
  if (t === 'up') return 'north_east'
  if (t === 'down') return 'south_east'
  return 'trending_flat'
}

function riskBucket(totalScore: number): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (totalScore <= 4) return 'LOW'
  if (totalScore <= 8) return 'MEDIUM'
  return 'HIGH'
}

export default function App() {
  const { data, loading, error, refetch, isLive } = useRegime()
  const [historicalInsights, setHistoricalInsights] = useState<HistoricalInsightsResponse | null>(null)
  const [activeView, setActiveView] = useState<
    'dashboard' | 'globalMacro' | 'playbook' | 'riskLab' | 'settings' | 'historical' | 'portfolio'
  >('dashboard')
  const [showIntro, setShowIntro] = useState(() => {
    return sessionStorage.getItem('regimeiq_intro_seen') !== 'true'
  })

  useEffect(() => {
    let cancelled = false
    api.getHistoricalInsights()
      .then((payload) => {
        if (!cancelled) setHistoricalInsights(payload)
      })
      .catch(() => {
        if (!cancelled) setHistoricalInsights(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleExport = async () => {
    await api.downloadExport()
  }

  const hero         = data ? regimeStyle(data.regime)    : { riskLevel: '', tone: '', glow: '' }
  const keySignals   = data ? topSignals(data)             : []
  const actions      = data ? suggestedActions(data.regime): []
  const contributionRows = data ? [
    { label: 'Growth',    score: data.scores.growth,                max: 4, color: '#3b82f6' },
    { label: 'Inflation', score: data.scores.inflation,             max: 4, color: '#f59e0b' },
    { label: 'Financial', score: data.scores.financial_conditions,  max: 4, color: '#22c55e' },
    { label: 'Market',    score: data.scores.market_risk,           max: 4, color: '#ef4444' },
  ] : []
  const confidence = data ? {
    macro:  Math.max(0, Math.min(100, Math.round((1 - ((data.scores.growth + data.scores.inflation + data.scores.financial_conditions) / 12)) * 100))),
    market: Math.max(0, Math.min(100, Math.round((1 - (data.scores.market_risk / 4)) * 100))),
  } : { macro: 0, market: 0 }
  const dashboardRisk = data ? riskBucket(data.total_score) : ''
  const timeline = useMemo(() => {
    const items = historicalInsights?.timeline ?? []
    return items.slice(-12)
  }, [historicalInsights])
  const changeItems = useMemo(() => {
    if (!data) return []
    const growth = data.growth_metrics
    const inflation = data.inflation_metrics
    const market = data.market_metrics
    const financial = data.financial_metrics
    const changes: string[] = []
    const yieldSpread = growth.find((m) => m.metric.includes('Yield spread'))
    const vix = market.find((m) => m.metric === 'VIX')
    const cpiTrend = inflation.find((m) => m.metric.includes('CPI 3M change'))
    const credit = financial.find((m) => m.metric.includes('credit spread'))
    if (yieldSpread?.status === 'NORMAL') changes.push('Yield curve steepened into a less stressed zone.')
    if (vix?.status === 'NORMAL') changes.push('VIX pressure cooled and volatility is in a calmer band.')
    if (cpiTrend?.trend === 'down') changes.push('CPI trend is easing versus prior readings.')
    if (credit?.status === 'WARNING') changes.push('Credit spreads are still widening and need monitoring.')
    if (changes.length === 0) changes.push('Signal mix is stable versus yesterday with no major regime shock.')
    return changes.slice(0, 4)
  }, [data])
  const insightSummary = useMemo(() => {
    if (!data) return ''
    const macroTone = confidence.macro >= 60 ? 'macro pressure is manageable' : 'macro pressure remains elevated'
    const marketTone = confidence.market >= 60 ? 'market stress is contained' : 'market stress is still fragile'
    return `${data.regime} setup: ${macroTone} while ${marketTone}. Focus on transitions, not just level signals.`
  }, [confidence.macro, confidence.market, data])

  // BankaiTransitionProvider is lifted OUTSIDE the showIntro conditional so the canvas
  // overlay survives the setShowIntro(false) call and Phases 4–5 play over the dashboard.
  return (
    <BankaiTransitionProvider>
      {showIntro ? (
        <IntroScreen
          onContinue={() => {
            sessionStorage.setItem('regimeiq_intro_seen', 'true')
            setShowIntro(false)
          }}
        />
      ) : loading ? (
        <div className="bg-surface text-on-surface min-h-screen flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs text-on-surface-variant uppercase tracking-widest">Loading regime data…</p>
          </div>
        </div>
      ) : error || !data ? (
        <div className="bg-surface text-on-surface min-h-screen flex items-center justify-center">
          <div className="text-center space-y-4 max-w-sm">
            <span className="material-symbols-outlined text-error text-4xl">error</span>
            <p className="text-sm text-on-surface-variant">{error ?? 'No data available'}</p>
            <button
              onClick={refetch}
              className="px-4 py-2 bg-primary text-on-primary text-xs font-bold rounded hover:opacity-90 transition-all"
            >
              Retry
            </button>
          </div>
        </div>
      ) : (
    <div className="dashboard-reveal bg-surface text-on-surface font-body selection:bg-primary selection:text-on-primary min-h-screen">
      <TopNav regime={data.regime} probability={data.probability} isLive={isLive} dataDate={data.updated_at} />
      <SideNav activeView={activeView} onSelectView={setActiveView} onExport={handleExport} />

      {activeView === 'globalMacro' ? (
        <GlobalMacroTab
          updatedAt={data.updated_at}
          globalMacro={data.global_macro}
          fedwatch={data.fedwatch}
          releaseCalendar={data.macro_release_calendar}
        />
      ) : activeView === 'playbook' ? (
        <PlaybookTab
          regime={data.regime}
          totalScore={data.total_score}
          fedwatch={data.fedwatch}
          globalMacro={data.global_macro}
        />
      ) : activeView === 'riskLab' ? (
        <RiskLabTab />
      ) : activeView === 'settings' ? (
        <SettingsTab />
      ) : activeView === 'historical' ? (
        <HistoricalTab />
      ) : activeView === 'portfolio' ? (
        <PortfolioTab allocation={data.allocation} regime={data.regime} />
      ) : (
        <main id="dashboard" className="ml-0 md:ml-64 pt-20 p-6 min-h-screen space-y-6 scroll-smooth">
          <section className={`rounded-2xl border border-outline-variant/20 bg-gradient-to-r ${hero.glow} via-surface-container to-surface-container p-6 shadow-[0_18px_44px_rgba(0,0,0,0.32)]`}>
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-on-surface-variant mb-2">Current Regime</div>
                <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-none">{data.regime}</h1>
                <div className={`mt-2 text-sm md:text-base font-semibold ${hero.tone}`}>{hero.riskLevel}</div>
              </div>
              <div className="rounded-xl border border-outline-variant/20 bg-surface/40 px-4 py-3 min-w-[220px]">
                <div className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-2">Stress Level</div>
                <div className="flex items-end justify-between">
                  <div className="text-2xl font-black tabular-nums">{Math.round(data.probability * 100)}%</div>
                  <div className="text-[11px] text-on-surface-variant">Updated {data.updated_at}</div>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-surface-container-highest overflow-hidden">
                  <div className="h-full transition-all duration-700" style={{ width: `${Math.round(data.probability * 100)}%`, background: 'var(--accent)' }}></div>
                </div>
              </div>
            </div>
          </section>

          <section>
            <ScoreCards scores={data.scores} />
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-1">
              <PortfolioAllocation allocation={data.allocation} regime={data.regime} />
              <div className="mt-6 bg-surface-container rounded-xl border border-outline-variant/20 p-5 shadow-sm">
                <div className="text-xs uppercase tracking-widest text-on-surface-variant mb-4">Market Articles Briefing</div>
                <div className="space-y-4">
                  {(['Macro', 'Stock-specific', 'Sector-specific'] as ArticleCategory[]).map((category) => (
                    <div key={category}>
                      <div className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--accent)' }}>{category}</div>
                      <div className="space-y-2">
                        {articleBriefs
                          .filter((article) => article.category === category)
                          .map((article) => (
                            <a
                              key={article.title}
                              href={article.href}
                              target="_blank"
                              rel="noreferrer"
                              className="block rounded-lg border border-outline-variant/20 bg-surface-container-high/40 px-3 py-3 transition-all duration-300 hover:bg-surface-container-high"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="text-sm font-semibold">{article.title}</div>
                                <span className="material-symbols-outlined text-sm text-on-surface-variant">open_in_new</span>
                              </div>
                              <div className="mt-1 text-[11px] text-on-surface-variant">{article.source}</div>
                              <div className="mt-1 text-xs text-on-surface-variant leading-relaxed">{article.summary}</div>
                            </a>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="xl:col-span-1 bg-surface-container rounded-xl border border-outline-variant/20 p-5 shadow-sm">
              <div className="text-xs uppercase tracking-widest text-on-surface-variant mb-4">Key Signals</div>
              <div className="space-y-3">
                {keySignals.map((row) => (
                  <div
                    key={`${row.metric}-${row.value}`}
                    className="rounded-lg border border-outline-variant/20 bg-surface-container-high/40 px-3 py-2 transition-all duration-300 hover:bg-surface-container-high"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold">{row.metric}</div>
                      <span className={`material-symbols-outlined text-sm ${row.trend === 'up' ? 'text-slate-200' : row.trend === 'down' ? 'text-slate-400' : 'text-zinc-300'}`}>
                        {trendArrow(row.trend)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-on-surface-variant">
                      <span>{row.value}</span>
                      <span className={`px-2 py-0.5 rounded-full border ${signalStyle(row.status)}`}>{row.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="xl:col-span-1 bg-surface-container rounded-xl border border-outline-variant/20 p-5 shadow-sm">
              <div className="text-xs uppercase tracking-widest text-on-surface-variant mb-4">Suggested Action</div>
              <div className="space-y-3">
                {actions.map((action) => (
                  <div key={action} className="rounded-lg px-3 py-2 text-sm leading-relaxed" style={{ border: '1px solid rgba(198,255,31,0.12)', background: 'rgba(198,255,31,0.04)' }}>
                    {action}
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <RegimeBreakdown
                  regime={data.regime}
                  probability={data.probability}
                  total_score={data.total_score}
                  max_score={data.max_score}
                  scores={data.scores}
                />
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-1 bg-surface-container rounded-xl border border-outline-variant/20 p-5 shadow-sm">
              <div className="text-xs uppercase tracking-widest text-on-surface-variant mb-4">Regime Timeline (12M)</div>
              <div className="flex h-8 rounded overflow-hidden bg-surface-container-highest">
                {timeline.length > 0 ? timeline.map((point, idx) => (
                  <div
                    key={`${point.date}-${idx}`}
                    className="h-full"
                    style={{
                      width: `${100 / timeline.length}%`,
                      background: point.regime === 'Risk-On'  ? '#c6ff1f'
                                : point.regime === 'Neutral'  ? '#f59e0b'
                                : point.regime === 'Risk-Off' ? '#f97316'
                                : '#ef4444',
                      borderRight: '1px solid rgba(0,0,0,0.35)',
                    }}
                    title={`${point.date}: ${point.regime}`}
                  />
                )) : (
                  <div className="text-[11px] text-on-surface-variant px-2 py-2">Timeline loading...</div>
                )}
              </div>
              <div className="mt-2 text-[11px] text-on-surface-variant">Transition visibility: Risk-On to Risk-Off cycles at a glance.</div>
            </div>

            <div className="xl:col-span-1 bg-surface-container rounded-xl border border-outline-variant/20 p-5 shadow-sm">
              <div className="text-xs uppercase tracking-widest text-on-surface-variant mb-4">What Changed Today</div>
              <div className="space-y-2">
                {changeItems.map((item) => (
                  <div key={item} className="rounded-lg border border-outline-variant/20 bg-surface-container-high/40 px-3 py-2 text-xs">
                    + {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="xl:col-span-1 bg-surface-container rounded-xl border border-outline-variant/20 p-5 shadow-sm">
              <div className="text-xs uppercase tracking-widest text-on-surface-variant mb-4">Risk Gauge</div>
              <div className="flex items-center gap-5">
                <div className="relative h-24 w-24 rounded-full border-8 border-surface-container-highest">
                  <div
                    className="absolute left-1/2 top-1/2 h-1 w-9 origin-left -translate-y-1/2 rounded"
                    style={{ background: 'var(--accent)' }}
                    style={{ transform: `translateY(-50%) rotate(${(data.total_score / data.max_score) * 180 - 90}deg)` }}
                  ></div>
                  <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold">{dashboardRisk}</div>
                </div>
                <div className="text-xs text-on-surface-variant">
                  <div>Total score: <span className="text-on-surface font-semibold">{data.total_score}/{data.max_score}</span></div>
                  <div className="mt-1">Risk state: <span className="text-on-surface font-semibold">{dashboardRisk}</span></div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 bg-surface-container rounded-xl border border-outline-variant/20 p-5 shadow-sm">
              <div className="text-xs uppercase tracking-widest text-on-surface-variant mb-4">Signal Contribution</div>
              <div className="space-y-3">
                {contributionRows.map((row) => (
                  <div key={row.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span>{row.label}</span>
                      <span className="tabular-nums">{row.score}/{row.max}</span>
                    </div>
                    <div className="h-2 rounded bg-surface-container-highest overflow-hidden">
                      <div className="h-full" style={{ width: `${(row.score / row.max) * 100}%`, background: row.color }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="xl:col-span-1 bg-surface-container rounded-xl border border-outline-variant/20 p-5 shadow-sm">
              <div className="text-xs uppercase tracking-widest text-on-surface-variant mb-4">Stress Breakdown</div>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1"><span>Macro stress</span><span>{confidence.macro}%</span></div>
                  <div className="h-2 rounded bg-surface-container-highest overflow-hidden">
                    <div className="h-full" style={{ width: `${confidence.macro}%`, background: '#f97316' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1"><span>Market stress</span><span>{confidence.market}%</span></div>
                  <div className="h-2 rounded bg-surface-container-highest overflow-hidden">
                    <div className="h-full" style={{ width: `${confidence.market}%`, background: '#ef4444' }}></div>
                  </div>
                </div>
                <div className="rounded-lg px-3 py-2 text-xs text-on-surface-variant" style={{ border: '1px solid rgba(198,255,31,0.12)', background: 'rgba(198,255,31,0.04)' }}>
                  {insightSummary}
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <details className="group rounded-xl border border-outline-variant/20 bg-surface-container overflow-hidden">
              <summary className="cursor-pointer list-none flex items-center justify-between px-4 py-3 text-sm font-semibold">
                <span>Advanced View</span>
                <span className="material-symbols-outlined text-on-surface-variant transition-transform group-open:rotate-180">expand_more</span>
              </summary>
              <div className="p-4 pt-0 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <MetricsTable title="Growth Metrics" subtitle={`UPDATED: ${data.updated_at}`} rows={data.growth_metrics} />
                  <MetricsTable title="Inflation Metrics" subtitle={data.regime.toUpperCase()} rows={data.inflation_metrics} />
                </div>
                <div id="risk-metrics" className="grid grid-cols-1 md:grid-cols-2 gap-6 scroll-mt-24">
                  <MetricsTable title="Fin. Conditions" subtitle="FINANCIAL" rows={data.financial_metrics} />
                  <MetricsTable title="Market Risk" subtitle="MARKET" rows={data.market_metrics} />
                </div>
              </div>
            </details>
          </section>
        </main>
      )}

      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={refetch}
          className="h-14 w-14 rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
          style={{ background: 'var(--accent)', color: '#000', boxShadow: '0 4px 24px rgba(198,255,31,0.25)' }}
          title="Refresh regime data"
        >
          <span className="material-symbols-outlined">bolt</span>
        </button>
      </div>
    </div>
      )}
    </BankaiTransitionProvider>
  )
}
