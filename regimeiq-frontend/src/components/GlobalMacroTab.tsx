import { useEffect, useMemo, useState } from 'react'
import { api, type GlobalMacroHistoryResponse } from '../lib/api'
import type { GlobalMacroSnapshot, FedWatch, MacroReleaseCalendar } from '../types/regime'

interface Props {
  updatedAt: string
  globalMacro: GlobalMacroSnapshot
  fedwatch: FedWatch
  releaseCalendar: MacroReleaseCalendar
}

function f(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—'
  return v.toFixed(2)
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function dirLabel(v: number | null | undefined, threshold = 0.05): 'Up' | 'Down' | 'Stable' | 'Unknown' {
  if (v === null || v === undefined || !Number.isFinite(v)) return 'Unknown'
  if (v > threshold) return 'Up'
  if (v < -threshold) return 'Down'
  return 'Stable'
}

function dirClass(label: ReturnType<typeof dirLabel>): string {
  if (label === 'Up') return 'text-emerald-300 bg-emerald-900/25 border-emerald-500/40'
  if (label === 'Down') return 'text-red-300 bg-red-900/25 border-red-500/40'
  if (label === 'Stable') return 'text-zinc-300 bg-zinc-700/25 border-zinc-500/30'
  return 'text-on-surface-variant bg-surface-container-high border-outline-variant/20'
}


function MacroCard({
  title,
  value,
  subtitle,
  description,
}: {
  title: string
  value: number | null | undefined
  subtitle: string
  description: string
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div
      className="bg-gradient-to-br from-surface-container-low to-surface-container rounded-xl p-4 border border-outline-variant/20 shadow-sm cursor-pointer select-none transition-all duration-200"
      style={{ borderColor: expanded ? 'rgba(198,255,31,0.35)' : undefined }}
      onClick={() => setExpanded(e => !e)}
    >
      <div className="flex items-center justify-between">
        <div className="text-xs text-on-surface-variant">{title}</div>
        <span className="text-[10px] text-on-surface-variant opacity-50">{expanded ? '▲' : '▼'}</span>
      </div>
      <div className="mt-2">
        <div className="text-xl font-black tracking-tight">{f(value)}</div>
      </div>
      <div className="text-[11px] text-on-surface-variant mt-2">{subtitle}</div>
      {expanded && (
        <div className="mt-3 pt-3 border-t border-outline-variant/20 text-[11px] font-semibold leading-relaxed" style={{ color: 'rgba(198,255,31,0.9)', textShadow: '0 0 8px rgba(198,255,31,0.4)' }}>
          {description}
        </div>
      )}
    </div>
  )
}

type Range = '1Y' | '3Y' | '5Y' | 'MAX'
type Scale = 'linear' | 'log'
type MacroTabKey = 'charts' | 'calendar'

export function GlobalMacroTab({ updatedAt, globalMacro, fedwatch, releaseCalendar }: Props) {
  const [history, setHistory] = useState<GlobalMacroHistoryResponse | null>(null)
  const [range, setRange] = useState<Range>('5Y')
  const [scale, setScale] = useState<Scale>('linear')
  const [tab, setTab] = useState<MacroTabKey>('charts')
  const [hoveredYear, setHoveredYear] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    api.getGlobalMacroHistory()
      .then((h) => { if (!cancelled) setHistory(h) })
      .catch(() => { if (!cancelled) setHistory(null) })
    return () => { cancelled = true }
  }, [])

  const rateBars = [
    { label: 'BoJ 10Y', value: globalMacro.boj_10y_yield ?? 0 },
    { label: 'ECB DFR', value: globalMacro.ecb_policy_rate ?? 0 },
    { label: 'UK 10Y', value: globalMacro.uk_10y_gilt_yield ?? 0 },
    { label: 'US Real 10Y', value: globalMacro.real_rate_10y ?? 0 },
  ]
  const maxRate = Math.max(...rateBars.map((r) => r.value), 1)
  const historyCharts = useMemo(() => ([
    { key: 'boj_10y_yield', label: 'BoJ 10Y Yield' },
    { key: 'ecb_policy_rate', label: 'ECB Policy Rate' },
    { key: 'uk_10y_gilt_yield', label: 'UK 10Y Gilt Yield' },
    { key: 'us_real_10y', label: 'US Real 10Y Yield' },
  ] as const), [])

  const toPath = (values: Array<number | null> | undefined, h: number, w: number): string => {
    if (!values || values.length === 0) return ''
    const pts = values.map((v, i) => ({ i, v }))
    const valid = pts.filter((p) => p.v !== null) as Array<{ i: number; v: number }>
    if (valid.length < 2) return ''
    const transformed = valid.map((p) => {
      if (scale === 'log') return Math.log(Math.max(p.v, 1e-6))
      return p.v
    })
    const min = Math.min(...transformed)
    const max = Math.max(...transformed)
    const span = Math.max(max - min, 1e-6)
    return valid.map((p, idx) => {
      const x = (p.i / (values.length - 1)) * w
      const yVal = scale === 'log' ? Math.log(Math.max(p.v, 1e-6)) : p.v
      const y = h - ((yVal - min) / span) * h
      return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    }).join(' ')
  }

  const RANGE_MONTHS: Record<string, number | null> = { '1Y': 12, '3Y': 36, '5Y': 60, 'MAX': null }

  const windowed = (arr: Array<number | null> | undefined): Array<number | null> => {
    if (!arr) return []
    const months = RANGE_MONTHS[range]
    if (months === null) return arr
    return arr.slice(Math.max(0, arr.length - months))
  }

  const formatAxisDate = (d: string | undefined): string => {
    if (!d) return ''
    const parsed = new Date(d)
    if (Number.isNaN(parsed.getTime())) return d
    return parsed.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
  }

  const macroNarrative = useMemo(() => {
    const cpi = globalMacro.cpi_yoy ?? 0
    const real = globalMacro.real_rate_10y ?? 0
    const dxy = globalMacro.dxy_3m_pct_change ?? 0
    const hold = fedwatch.next_3m.hold
    const tone =
      cpi > 3 || real > 1.5
        ? 'policy remains restrictive and financing conditions are still tight'
        : 'price pressure is moderating and policy constraints are easing'
    const dollar =
      dxy > 0.02
        ? 'Dollar strength is adding global tightening pressure.'
        : dxy < -0.02
          ? 'Dollar softness is reducing external stress.'
          : 'Dollar conditions are broadly balanced.'
    return `Macro regime read: ${tone} Fed pricing is ${Math.round(hold * 100)}% hold-dominant over the next 3 months. ${dollar}`
  }, [fedwatch.next_3m.hold, globalMacro.cpi_yoy, globalMacro.dxy_3m_pct_change, globalMacro.real_rate_10y])

  const directionalMetrics = useMemo(() => [
    { name: 'Fed policy impulse (3M)', value: globalMacro.fed_funds_3m_change, direction: dirLabel(globalMacro.fed_funds_3m_change, 0.02) },
    { name: 'US Real 10Y', value: globalMacro.real_rate_10y, direction: dirLabel(globalMacro.real_rate_10y, 0.05) },
    { name: 'US CPI YoY', value: globalMacro.cpi_yoy, direction: dirLabel((globalMacro.cpi_yoy ?? 0) - 2.5, 0.1) },
    { name: 'DXY 3M change', value: globalMacro.dxy_3m_pct_change, direction: dirLabel(globalMacro.dxy_3m_pct_change, 0.01) },
  ], [globalMacro.cpi_yoy, globalMacro.dxy_3m_pct_change, globalMacro.fed_funds_3m_change, globalMacro.real_rate_10y])

  const macroDrivers = useMemo(() => {
    const drivers: string[] = []
    if ((globalMacro.real_rate_10y ?? 0) > 1.5) drivers.push('High real rates keep valuation multiples under pressure.')
    if ((globalMacro.cpi_yoy ?? 0) > 3) drivers.push('Inflation is still above comfort, limiting easing flexibility.')
    if ((globalMacro.dxy_3m_pct_change ?? 0) > 0.02) drivers.push('Stronger dollar tightens global liquidity conditions.')
    if (fedwatch.next_3m.hold > 0.5) drivers.push('Markets still expect a hold-heavy policy path.')
    if ((globalMacro.boj_10y_yield ?? 0) > 1 || (globalMacro.ecb_policy_rate ?? 0) > 3) drivers.push('Global policy divergence is reshaping cross-asset flows.')
    if (drivers.length === 0) drivers.push('Macro inputs are balanced, with no single dominant stress driver.')
    return drivers.slice(0, 5)
  }, [fedwatch.next_3m.hold, globalMacro.boj_10y_yield, globalMacro.cpi_yoy, globalMacro.dxy_3m_pct_change, globalMacro.ecb_policy_rate, globalMacro.real_rate_10y])

  const bankDivergence = useMemo(() => {
    const stats = history?.cb_stats
    const banks = [
      { name: 'Federal Reserve', key: 'fed', label: 'Fed Funds', change_3m: globalMacro.fed_funds_3m_change },
      { name: 'ECB', key: 'ecb', label: 'Deposit Rate', change_3m: null },
      { name: 'BoJ', key: 'boj', label: '10Y Yield', change_3m: null },
    ]
    return banks.map((b) => {
      const s = stats?.[b.key]
      const pct = s?.pct ?? 0
      const stance =
        pct >= 75 ? 'Historically Tight' :
        pct >= 50 ? 'Above Neutral' :
        pct >= 25 ? 'Below Neutral' :
        'Historically Loose'
      const dir = (b.change_3m ?? 0) > 0.05 ? 'up' : (b.change_3m ?? 0) < -0.05 ? 'down' : 'flat'
      return { ...b, pct, current: s?.current ?? null, min: s?.min ?? null, max: s?.max ?? null, stance, dir }
    })
  }, [history?.cb_stats, globalMacro.fed_funds_3m_change])

  const regimeCatalysts = useMemo(() => {
    const catalysts = [
      'Unexpected CPI downside surprise could accelerate easing expectations.',
      'Credit spread re-widening would raise recession probability quickly.',
      'Sharp dollar reversal could reprice global risk appetite.',
      'Labor market inflection could flip growth signals.',
      'Central bank communication shocks may force rapid rate-path repricing.',
    ]
    return catalysts.slice(0, 5)
  }, [])

  const heatmap = useMemo(() => {
    const inflation = clamp(((globalMacro.cpi_yoy ?? 2) / 5) * 100, 0, 100)
    const growth = clamp(55 - (globalMacro.real_rate_10y ?? 0) * 12, 0, 100)
    const liquidity = clamp(50 - (globalMacro.dxy_3m_pct_change ?? 0) * 700, 0, 100)
    const volatility = clamp(30 + ((1 - fedwatch.next_3m.hold) * 40), 0, 100)
    return [
      { name: 'Inflation', score: inflation },
      { name: 'Growth', score: growth },
      { name: 'Liquidity', score: liquidity },
      { name: 'Volatility', score: volatility },
    ]
  }, [fedwatch.next_3m.hold, globalMacro.cpi_yoy, globalMacro.dxy_3m_pct_change, globalMacro.real_rate_10y])

  const realVsEquities = useMemo(() => {
    return history?.scatter ?? []
  }, [history?.scatter])

  return (
    <section className="ml-0 md:ml-64 pt-20 p-6 min-h-screen space-y-6">
      <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">Global Macro</h2>
          <span className="text-[10px] uppercase text-on-surface-variant">Updated: {updatedAt}</span>
        </div>
        <div className="rounded-xl border border-primary/20 bg-primary/10 p-4">
          <div className="text-[11px] uppercase tracking-widest text-primary mb-2">Macro Narrative</div>
          <div className="text-sm leading-relaxed text-on-surface">{macroNarrative}</div>
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button onClick={() => setTab('charts')} className={`px-3 py-1 rounded text-xs ${tab === 'charts' ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'}`}>Market Charts</button>
          <button onClick={() => setTab('calendar')} className={`px-3 py-1 rounded text-xs ${tab === 'calendar' ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'}`}>Release Calendar</button>
        </div>
        <div className="mb-2 bg-surface-container-low rounded-lg p-3">
          <div className="text-xs text-on-surface-variant mb-2">FedWatch-style next 3M probabilities</div>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="rounded bg-surface-container-high p-2"><div className="text-on-surface-variant">Cut</div><div className="font-bold text-emerald-400">{Math.round(fedwatch.next_3m.cut * 100)}%</div></div>
            <div className="rounded bg-surface-container-high p-2"><div className="text-on-surface-variant">Hold</div><div className="font-bold text-amber-400">{Math.round(fedwatch.next_3m.hold * 100)}%</div></div>
            <div className="rounded bg-surface-container-high p-2"><div className="text-on-surface-variant">Hike</div><div className="font-bold text-red-400">{Math.round(fedwatch.next_3m.hike * 100)}%</div></div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {directionalMetrics.map((m) => (
            <div key={m.name} className="rounded-lg bg-surface-container-low border border-outline-variant/20 p-3">
              <div className="text-[11px] text-on-surface-variant">{m.name}</div>
              <div className="mt-1 text-lg font-bold">{f(m.value)}</div>
              <span className={`inline-block mt-2 px-2 py-0.5 text-[11px] border rounded-full ${dirClass(m.direction)}`}>
                {m.direction}
              </span>
            </div>
          ))}
        </div>
        {tab === 'charts' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <MacroCard title="Fed Policy (3M)" value={globalMacro.fed_funds_3m_change} subtitle="Higher-for-longer vs easing path" description="Measures the 3-month change in the Fed Funds rate. A rising value signals tightening — bearish for equities and risk assets. A falling value indicates easing, which typically supports growth and compresses credit spreads. This is one of the most direct inputs to the macro regime classification." />
          <MacroCard title="US Real Rate (10Y)" value={globalMacro.real_rate_10y} subtitle="Restrictive real-rate pressure" description="The inflation-adjusted 10-year Treasury yield. When real rates are high (above ~1.5%), borrowing costs are genuinely restrictive — this pressures equity valuations, especially long-duration growth stocks. Negative real rates are historically associated with risk-on regimes and loose financial conditions." />
          <MacroCard title="US CPI YoY" value={globalMacro.cpi_yoy} subtitle="Inflation persistence signal" description="Year-over-year consumer price inflation. Readings above 3% historically push the Fed toward tightening, increasing recession risk. Below 2.5% gives the Fed room to ease. This metric determines whether inflation is a binding constraint on monetary policy and is a key driver of the inflation scorecard." />
          <MacroCard title="DXY 3M Change" value={globalMacro.dxy_3m_pct_change} subtitle="Dollar stress transmission" description="The 3-month percentage change in the US Dollar Index. A strengthening dollar tightens global financial conditions — it raises debt servicing costs for EM economies and compresses commodity prices. A weakening dollar eases conditions globally and typically accompanies risk-on regimes." />
          <MacroCard title="BoJ 10Y Yield" value={globalMacro.boj_10y_yield} subtitle="Yield control sensitivity" description="The Bank of Japan's 10-year government bond yield. As the BoJ unwinds its yield curve control policy, rising Japanese yields can trigger global capital repatriation — unwinding the yen carry trade and causing cross-asset volatility. A key tail risk for global liquidity conditions." />
          <MacroCard title="ECB Policy Rate" value={globalMacro.ecb_policy_rate} subtitle="Euro area policy stance" description="The European Central Bank's deposit facility rate. A proxy for eurozone monetary tightness. Restrictive ECB policy can dampen European growth and spill into global credit conditions. When ECB and Fed policy diverge significantly, it drives EUR/USD moves that feed back into DXY and global financial conditions." />
          <MacroCard title="UK 10Y Gilt Yield" value={globalMacro.uk_10y_gilt_yield} subtitle="UK funding stress proxy" description="The yield on 10-year UK government bonds. Elevated gilt yields signal fiscal stress or inflation concerns in the UK and can serve as a leading indicator of broader sovereign bond market pressure in developed markets. The 2022 gilt crisis showed how rapidly UK yields can transmit into global risk-off moves." />
        </div>
        ) : (
          <div className="bg-surface-container-low rounded-lg p-4 border border-outline-variant/10">
            <div className="text-xs text-on-surface-variant mb-3">Upcoming macro releases</div>
            <div className="space-y-2">
              {releaseCalendar.releases.map((r, idx) => (
                <div key={`${r.event}-${idx}`} className="flex items-center justify-between text-xs border-b border-outline-variant/10 pb-2">
                  <span>{r.event}</span>
                  <span className="text-on-surface-variant">{r.date}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {tab === 'charts' && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Yield Curve Visualization</h3>
          <div className="text-[11px] text-on-surface-variant">Cross-market yield shape and relative steepness.</div>
          <div className="space-y-3">
            {rateBars.map((row, idx) => {
              const t = (rateBars.length - 1) > 0 ? idx / (rateBars.length - 1) : 0
              const barColor = `hsl(270, ${Math.round(60 + t * 30)}%, ${Math.round(35 + t * 30)}%)`
              return (
                <div key={row.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-on-surface-variant">{row.label}</span>
                    <span className="font-semibold tabular-nums" style={{ color: barColor }}>{row.value.toFixed(2)}</span>
                  </div>
                  <div className="h-2 rounded bg-surface-container-highest overflow-hidden">
                    <div
                      className="h-full"
                      style={{ width: `${clamp((row.value / maxRate) * 100, 0, 100)}%`, background: `linear-gradient(to right, hsl(260, 70%, 30%), ${barColor})` }}
                    ></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Real Rates vs Equities</h3>
          <div className="text-[11px] text-on-surface-variant">Higher real yields typically pressure equity valuations.</div>
          <div className="rounded bg-surface-container-low p-3">
            {(() => {
              const xs = realVsEquities.map(p => p.real_yield)
              const ys = realVsEquities.map(p => p.sp500_yoy)
              const xMin = xs.length ? Math.min(...xs) : -2
              const xMax = xs.length ? Math.max(...xs) : 4
              const yMin = ys.length ? Math.min(...ys) : -30
              const yMax = ys.length ? Math.max(...ys) : 30
              const xSpan = xMax - xMin || 1
              const ySpan = yMax - yMin || 1
              const PAD_L = 48, PAD_B = 48, PAD_T = 14, PAD_R = 14
              const W = 420, H = 210
              const plotW = W - PAD_L - PAD_R
              const plotH = H - PAD_T - PAD_B
              const px = (v: number) => PAD_L + ((v - xMin) / xSpan) * plotW
              const py = (v: number) => PAD_T + plotH - ((v - yMin) / ySpan) * plotH
              const xTicks = [xMin, (xMin + xMax) / 2, xMax]
              const yTicks = [yMin, (yMin + yMax) / 2, yMax]
              const fmtY = (v: number) => `${v.toFixed(0)}%`
              const fmtX = (v: number) => `${v.toFixed(1)}%`
              return (
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-56">
                  {/* grid */}
                  {yTicks.map((v, i) => (
                    <line key={i} x1={PAD_L} y1={py(v)} x2={W - PAD_R} y2={py(v)} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                  ))}
                  {xTicks.map((v, i) => (
                    <line key={i} x1={px(v)} y1={PAD_T} x2={px(v)} y2={PAD_T + plotH} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                  ))}
                  {/* axes */}
                  <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + plotH} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                  <line x1={PAD_L} y1={PAD_T + plotH} x2={W - PAD_R} y2={PAD_T + plotH} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                  {/* Y-axis ticks + labels */}
                  {yTicks.map((v, i) => (
                    <g key={i}>
                      <line x1={PAD_L - 4} y1={py(v)} x2={PAD_L} y2={py(v)} stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
                      <text x={PAD_L - 8} y={py(v) + 3.5} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.45)">{fmtY(v)}</text>
                    </g>
                  ))}
                  {/* X-axis ticks + labels */}
                  {xTicks.map((v, i) => (
                    <g key={i}>
                      <line x1={px(v)} y1={PAD_T + plotH} x2={px(v)} y2={PAD_T + plotH + 4} stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
                      <text x={px(v)} y={PAD_T + plotH + 14} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.45)">{fmtX(v)}</text>
                    </g>
                  ))}
                  {/* axis titles — well clear of tick labels */}
                  <text x={PAD_L + plotW / 2} y={H - 4} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.4)">US Real 10Y Yield (%)</text>
                  <text x={11} y={PAD_T + plotH / 2} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.4)" transform={`rotate(-90, 11, ${PAD_T + plotH / 2})`}>S&amp;P 500 YoY (%)</text>
                  {/* dots */}
                  {realVsEquities.map((pt, idx) => {
                    const t = realVsEquities.length > 1 ? idx / (realVsEquities.length - 1) : 0
                    const cx = px(pt.real_yield)
                    const cy = py(pt.sp500_yoy)
                    const hovered = hoveredYear === pt.year
                    return (
                      <g key={`rvse-${pt.year}`}
                        onMouseEnter={() => setHoveredYear(pt.year)}
                        onMouseLeave={() => setHoveredYear(null)}
                        style={{ cursor: 'pointer' }}>
                        <circle cx={cx} cy={cy} r={hovered ? 6 : 4} fill={`hsl(${Math.round(350 - t * 30)}, ${Math.round(80 + t * 20)}%, ${Math.round(32 + t * 38)}%)`} opacity={hovered ? 1 : 0.85} />
                        {hovered && (
                          <text x={cx} y={cy - 9} textAnchor="middle" fontSize="8" fontWeight="bold" fill="white">{pt.year}</text>
                        )}
                      </g>
                    )
                  })}
                </svg>
              )
            })()}
            <div className="mt-1 text-[10px] text-on-surface-variant">Each dot = one year (Dec). Color: pink/red = oldest, hot pink = most recent.</div>
          </div>
        </div>
      </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-1 bg-surface-container rounded-xl p-5 border border-outline-variant/20">
          <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">Key Macro Drivers</h3>
          <div className="space-y-2 text-xs">
            {macroDrivers.map((d) => (
              <div key={d} className="rounded border border-outline-variant/20 bg-surface-container-low px-3 py-2">+ {d}</div>
            ))}
          </div>
        </div>
        <div className="xl:col-span-1 bg-surface-container rounded-xl p-5 border border-outline-variant/20">
          <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">Central Bank Divergence</h3>
          <div className="space-y-4">
            {bankDivergence.map((b) => {
              const stanceColor =
                b.stance === 'Historically Tight' ? '#ef4444' :
                b.stance === 'Above Neutral'       ? '#f97316' :
                b.stance === 'Below Neutral'       ? '#38bdf8' :
                '#c6ff1f'
              const dirArrow = b.dir === 'up' ? '↑' : b.dir === 'down' ? '↓' : '→'
              return (
                <div key={b.name} className="space-y-1.5">
                  {/* Header row */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-on-surface">{b.name}</span>
                      <span className="ml-1.5 text-[10px] text-on-surface-variant">{b.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px]" style={{ color: stanceColor }}>{dirArrow}</span>
                      <span className="text-[10px] font-semibold tabular-nums text-on-surface">{b.current !== null ? `${b.current.toFixed(2)}%` : '—'}</span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ color: stanceColor, background: `${stanceColor}18` }}>{b.stance}</span>
                    </div>
                  </div>
                  {/* Track with 25/50/75 markers and filled bar */}
                  <div className="relative h-2 rounded-full bg-surface-container-highest overflow-visible">
                    {/* zone markers */}
                    {[25, 50, 75].map(p => (
                      <div key={p} className="absolute top-0 h-full w-px bg-surface-container z-10" style={{ left: `${p}%` }} />
                    ))}
                    <div className="absolute inset-0 overflow-hidden rounded-full">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${clamp(b.pct, 2, 100)}%`, background: stanceColor, boxShadow: `0 0 6px ${stanceColor}66` }} />
                    </div>
                  </div>
                  {/* Percentile label */}
                  <div className="text-center text-[9px] text-on-surface-variant tabular-nums opacity-50">
                    {b.pct !== null ? `${b.pct.toFixed(0)}th percentile of historical range` : ''}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div className="xl:col-span-1 bg-surface-container rounded-xl p-5 border border-outline-variant/20">
          <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">Macro Heatmap</h3>
          <div className="space-y-2">
            {heatmap.map((h) => {
              const t = h.score / 100
              const heatColor = `hsl(${Math.round(120 - t * 120)}, 65%, 45%)`
              return (
              <div key={h.name}>
                <div className="flex justify-between text-xs mb-1"><span>{h.name}</span><span className="tabular-nums">{Math.round(h.score)}</span></div>
                <div className="h-2 rounded bg-surface-container-highest overflow-hidden">
                  <div className="h-full" style={{ width: `${h.score}%`, background: heatColor }}></div>
                </div>
              </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
        <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">What Could Change the Regime</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
          {regimeCatalysts.map((c) => (
            <div key={c} className="rounded bg-surface-container-low px-3 py-2" style={{ border: '1px solid rgba(198,255,31,0.25)', background: 'rgba(198,255,31,0.05)' }}>
              {c}
            </div>
          ))}
        </div>
      </div>

      {tab === 'charts' && (
      <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Yield vs Price (Historical)</h3>
          <div className="flex items-center gap-2">
            {(['1Y', '3Y', '5Y', 'MAX'] as const).map((r) => (
              <button key={r} onClick={() => setRange(r)} className={`px-2 py-1 rounded text-[11px] ${range === r ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'}`}>{r}</button>
            ))}
            <div className="w-px h-4 bg-outline-variant/30 mx-1"></div>
            <button onClick={() => setScale(scale === 'linear' ? 'log' : 'linear')} className="px-2 py-1 rounded text-[11px] bg-surface-container-high text-on-surface-variant">
              {scale === 'linear' ? 'Linear' : 'Log'} scale
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {historyCharts.map((chart) => {
            const s = history?.series?.[chart.key]
            const datesAll = history?.dates ?? []
            const y = windowed(s?.yield)
            const p = windowed(s?.price)
            const dTake = y.length > 0 ? datesAll.slice(datesAll.length - y.length) : datesAll
            const yieldPath = toPath(y, 120, 420)
            const pricePath = toPath(p, 120, 420)
            const dates = dTake
            const tickIdx = dates.length > 0
              ? [0, Math.floor(dates.length * 0.25), Math.floor(dates.length * 0.5), Math.floor(dates.length * 0.75), dates.length - 1]
              : []
            const yValid = y.filter((v): v is number => v !== null)
            const pValid = p.filter((v): v is number => v !== null)
            const yMin = yValid.length ? Math.min(...yValid) : 0
            const yMax = yValid.length ? Math.max(...yValid) : 0
            const pMin = pValid.length ? Math.min(...pValid) : 0
            const pMax = pValid.length ? Math.max(...pValid) : 0
            const fmt = (v: number) => Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2)
            return (
              <div key={chart.key} className="bg-surface-container-low rounded-lg p-3 border border-outline-variant/10">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold">{chart.label}</div>
                  <div className="text-[10px] text-on-surface-variant">{range === 'MAX' ? 'All history' : `Past ${range}`}</div>
                </div>
                <svg viewBox="-42 0 504 120" className="w-full h-32 bg-surface/30 rounded">
                  {/* horizontal grid lines */}
                  <line x1="0" y1="0" x2="420" y2="0" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                  <line x1="0" y1="60" x2="420" y2="60" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                  <line x1="0" y1="120" x2="420" y2="120" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                  {/* yield Y-axis labels (left, white) */}
                  <text x="-4" y="6" textAnchor="end" fontSize="8" fill="rgba(255,255,255,0.45)">{fmt(yMax)}</text>
                  <text x="-4" y="63" textAnchor="end" fontSize="8" fill="rgba(255,255,255,0.45)">{fmt((yMax + yMin) / 2)}</text>
                  <text x="-4" y="119" textAnchor="end" fontSize="8" fill="rgba(255,255,255,0.45)">{fmt(yMin)}</text>
                  {/* price Y-axis labels (right, amber) */}
                  <text x="424" y="6" textAnchor="start" fontSize="8" fill="rgba(245,158,11,0.6)">{fmt(pMax)}</text>
                  <text x="424" y="63" textAnchor="start" fontSize="8" fill="rgba(245,158,11,0.6)">{fmt((pMax + pMin) / 2)}</text>
                  <text x="424" y="119" textAnchor="start" fontSize="8" fill="rgba(245,158,11,0.6)">{fmt(pMin)}</text>
                  <path d={yieldPath} fill="none" stroke="currentColor" className="text-primary" strokeWidth="2.5" />
                  <path d={pricePath} fill="none" stroke="currentColor" className="text-[#f59e0b]" strokeWidth="2.5" />
                </svg>
                <div className="mt-2 flex justify-between text-[10px] text-on-surface-variant tabular-nums">
                  {tickIdx.map((idx, i) => (
                    <span key={`${chart.key}-tick-${i}`}>{formatAxisDate(dates[idx])}</span>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-4 text-[10px] text-on-surface-variant">
                  <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary"></span>Yield</span>
                  <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#f59e0b]"></span>Price Index</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      )}
    </section>
  )
}
