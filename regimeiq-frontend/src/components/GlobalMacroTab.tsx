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

  const windowed = (arr: Array<number | null> | undefined, total: number): Array<number | null> => {
    if (!arr) return []
    if (range === 'MAX' || range === '5Y') return arr
    const take = range === '3Y' ? Math.floor(total * 0.6) : Math.floor(total * 0.2)
    return arr.slice(Math.max(0, arr.length - Math.max(take, 8)))
  }

  const formatAxisDate = (d: string | undefined): string => {
    if (!d) return ''
    const parsed = new Date(d)
    if (Number.isNaN(parsed.getTime())) return d
    return parsed.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
  }

  return (
    <section className="ml-0 md:ml-64 pt-20 p-6 min-h-screen space-y-6">
      <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">Global Macro</h2>
          <span className="text-[10px] uppercase text-on-surface-variant">Updated: {updatedAt}</span>
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button onClick={() => setTab('charts')} className={`px-3 py-1 rounded text-xs ${tab === 'charts' ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'}`}>Market Charts</button>
          <button onClick={() => setTab('calendar')} className={`px-3 py-1 rounded text-xs ${tab === 'calendar' ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'}`}>Release Calendar</button>
          <div className="w-px h-5 bg-outline-variant/30 mx-1"></div>
          {(['1Y', '3Y', '5Y', 'MAX'] as const).map((r) => (
            <button key={r} onClick={() => setRange(r)} className={`px-2 py-1 rounded text-[11px] ${range === r ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'}`}>{r}</button>
          ))}
          <button onClick={() => setScale(scale === 'linear' ? 'log' : 'linear')} className="px-2 py-1 rounded text-[11px] bg-surface-container-high text-on-surface-variant">
            {scale === 'linear' ? 'Linear' : 'Log'} scale
          </button>
        </div>
        <div className="mb-4 bg-surface-container-low rounded-lg p-3">
          <div className="text-xs text-on-surface-variant mb-2">FedWatch-style next 3M probabilities</div>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="rounded bg-surface-container-high p-2"><div className="text-on-surface-variant">Cut</div><div className="font-bold">{Math.round(fedwatch.next_3m.cut * 100)}%</div></div>
            <div className="rounded bg-surface-container-high p-2"><div className="text-on-surface-variant">Hold</div><div className="font-bold">{Math.round(fedwatch.next_3m.hold * 100)}%</div></div>
            <div className="rounded bg-surface-container-high p-2"><div className="text-on-surface-variant">Hike</div><div className="font-bold">{Math.round(fedwatch.next_3m.hike * 100)}%</div></div>
          </div>
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
        <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
          <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4">Rates Snapshot</h3>
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

        <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
          <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4">Macro Pressure Gauge</h3>
          <div className="space-y-3">
            <div className="text-xs text-on-surface-variant">Composite from CPI, real rates, dollar and global policy yields</div>
            <div className="h-3 w-full rounded-full bg-surface-container-highest overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary via-[#f59e0b] to-error"
                style={{
                  width: `${clamp((((globalMacro.cpi_yoy ?? 0) + (globalMacro.real_rate_10y ?? 0) + (globalMacro.dxy_3m_pct_change ?? 0) * 20) / 10) * 100, 0, 100)}%`,
                }}
              ></div>
            </div>
            <div className="flex justify-between text-[11px] text-on-surface-variant">
              <span>Low</span>
              <span>Moderate</span>
              <span>High</span>
            </div>
          </div>
        </div>
      </div>
      )}

      {tab === 'charts' && (
      <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
        <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4">5Y Yield vs Price</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {historyCharts.map((chart) => {
            const s = history?.series?.[chart.key]
            const datesAll = history?.dates ?? []
            const y = windowed(s?.yield, datesAll.length)
            const p = windowed(s?.price, datesAll.length)
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
                  <div className="text-[10px] text-on-surface-variant">Past 5 years</div>
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
