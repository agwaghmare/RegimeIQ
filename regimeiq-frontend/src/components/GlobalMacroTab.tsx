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
  if (label === 'Up') return 'text-slate-200 bg-slate-500/20 border-slate-400/40'
  if (label === 'Down') return 'text-slate-300 bg-slate-700/30 border-slate-600/50'
  if (label === 'Stable') return 'text-zinc-200 bg-zinc-600/20 border-zinc-400/30'
  return 'text-on-surface-variant bg-surface-container-high border-outline-variant/20'
}

function sparklinePoints(value: number | null | undefined): string {
  const safe = Number.isFinite(value) ? Number(value) : 0
  const n = 6
  const pts: string[] = []
  for (let i = 0; i < n; i += 1) {
    const x = (i / (n - 1)) * 100
    const drift = (i - (n - 1) / 2) * 0.07
    const yRaw = 50 - (safe + drift) * 8
    const y = clamp(yRaw, 12, 88)
    pts.push(`${x},${y}`)
  }
  return pts.join(' ')
}

function MacroCard({
  title,
  value,
  subtitle,
}: {
  title: string
  value: number | null | undefined
  subtitle: string
}) {
  const isEmpty = value === null || value === undefined || !Number.isFinite(value)
  return (
    <div className="bg-gradient-to-br from-surface-container-low to-surface-container rounded-xl p-4 border border-outline-variant/20 shadow-sm">
      <div className="text-xs text-on-surface-variant">{title}</div>
      <div className="flex items-end justify-between mt-2">
        <div className="text-xl font-black tracking-tight">{f(value)}</div>
        <div className="w-20 h-10 opacity-80">
          {isEmpty ? (
            <div className="h-full w-full rounded bg-surface-container-high"></div>
          ) : (
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
              <polyline
                fill="none"
                stroke="currentColor"
                strokeWidth="5"
                className="text-primary"
                points={sparklinePoints(value)}
              />
            </svg>
          )}
        </div>
      </div>
      <div className="text-[11px] text-on-surface-variant mt-2">{subtitle}</div>
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
    const fedProxy = globalMacro.fed_funds_3m_change ?? 0
    const ecb = globalMacro.ecb_policy_rate ?? 0
    const boj = globalMacro.boj_10y_yield ?? 0
    const maxAbs = Math.max(Math.abs(fedProxy), Math.abs(ecb), Math.abs(boj), 0.1)
    return [
      { name: 'Federal Reserve', value: fedProxy, stance: fedProxy > 0.05 ? 'Tightening bias' : fedProxy < -0.05 ? 'Easing bias' : 'Hold bias', w: Math.abs(fedProxy) / maxAbs },
      { name: 'ECB', value: ecb, stance: ecb > 2.5 ? 'Restrictive' : 'Balanced', w: Math.abs(ecb) / maxAbs },
      { name: 'BoJ', value: boj, stance: boj > 0.75 ? 'Normalizing' : 'Accommodative', w: Math.abs(boj) / maxAbs },
    ]
  }, [globalMacro.boj_10y_yield, globalMacro.ecb_policy_rate, globalMacro.fed_funds_3m_change])

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
    const s = history?.series?.us_real_10y
    if (!s?.yield || !s?.price || s.yield.length < 3 || s.price.length < 3) return []
    const len = Math.min(s.yield.length, s.price.length)
    return Array.from({ length: len }).map((_, i) => ({
      x: s.yield[i] ?? 0,
      y: s.price[i] ?? 0,
      i,
    }))
  }, [history?.series?.us_real_10y])

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
            <div className="rounded bg-surface-container-high p-2"><div className="text-on-surface-variant">Cut</div><div className="font-bold">{Math.round(fedwatch.next_3m.cut * 100)}%</div></div>
            <div className="rounded bg-surface-container-high p-2"><div className="text-on-surface-variant">Hold</div><div className="font-bold">{Math.round(fedwatch.next_3m.hold * 100)}%</div></div>
            <div className="rounded bg-surface-container-high p-2"><div className="text-on-surface-variant">Hike</div><div className="font-bold">{Math.round(fedwatch.next_3m.hike * 100)}%</div></div>
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
          <MacroCard title="Fed Policy (3M)" value={globalMacro.fed_funds_3m_change} subtitle="Higher-for-longer vs easing path" />
          <MacroCard title="US Real Rate (10Y)" value={globalMacro.real_rate_10y} subtitle="Restrictive real-rate pressure" />
          <MacroCard title="US CPI YoY" value={globalMacro.cpi_yoy} subtitle="Inflation persistence signal" />
          <MacroCard title="DXY 3M Change" value={globalMacro.dxy_3m_pct_change} subtitle="Dollar stress transmission" />
          <MacroCard title="BoJ 10Y Yield" value={globalMacro.boj_10y_yield} subtitle="Yield control sensitivity" />
          <MacroCard title="ECB Policy Rate" value={globalMacro.ecb_policy_rate} subtitle="Euro area policy stance" />
          <MacroCard title="UK 10Y Gilt Yield" value={globalMacro.uk_10y_gilt_yield} subtitle="UK funding stress proxy" />
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
            {rateBars.map((row) => (
              <div key={row.label} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-on-surface-variant">{row.label}</span>
                  <span className="font-semibold tabular-nums">{row.value.toFixed(2)}</span>
                </div>
                <div className="h-2 rounded bg-surface-container-highest overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${clamp((row.value / maxRate) * 100, 0, 100)}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Real Rates vs Equities</h3>
          <div className="text-[11px] text-on-surface-variant">Higher real yields typically pressure equity valuations.</div>
          <div className="rounded bg-surface-container-low p-3">
            <svg viewBox="0 0 380 180" className="w-full h-44">
              <line x1="30" y1="150" x2="350" y2="150" className="stroke-outline-variant/40" strokeWidth="1" />
              <line x1="30" y1="20" x2="30" y2="150" className="stroke-outline-variant/40" strokeWidth="1" />
              {realVsEquities.map((pt) => {
                const x = 30 + clamp(((pt.x + 2) / 6) * 320, 0, 320)
                const y = 150 - clamp(((pt.y - 60) / 80) * 130, 0, 130)
                return <circle key={`rvse-${pt.i}`} cx={x} cy={y} r="2.2" className="fill-primary/80" />
              })}
            </svg>
            <div className="mt-1 text-[10px] text-on-surface-variant">X-axis: real yield, Y-axis: equity proxy index.</div>
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
          <div className="space-y-3">
            {bankDivergence.map((b) => (
              <div key={b.name}>
                <div className="flex justify-between text-xs mb-1"><span>{b.name}</span><span>{b.stance}</span></div>
                <div className="h-2 rounded bg-surface-container-highest overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${clamp(b.w * 100, 5, 100)}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="xl:col-span-1 bg-surface-container rounded-xl p-5 border border-outline-variant/20">
          <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">Macro Heatmap</h3>
          <div className="space-y-2">
            {heatmap.map((h) => (
              <div key={h.name}>
                <div className="flex justify-between text-xs mb-1"><span>{h.name}</span><span>{Math.round(h.score)}</span></div>
                <div className="h-2 rounded bg-surface-container-highest overflow-hidden">
                  <div className="h-full bg-primary/85" style={{ width: `${h.score}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
        <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">What Could Change the Regime</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
          {regimeCatalysts.map((c) => (
            <div key={c} className="rounded border border-outline-variant/20 bg-surface-container-low px-3 py-2">
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
            return (
              <div key={chart.key} className="bg-surface-container-low rounded-lg p-3 border border-outline-variant/10">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold">{chart.label}</div>
                  <div className="text-[10px] text-on-surface-variant">{range === 'MAX' ? 'All history' : `Past ${range}`}</div>
                </div>
                <svg viewBox="0 0 420 120" className="w-full h-32 bg-surface/30 rounded">
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
