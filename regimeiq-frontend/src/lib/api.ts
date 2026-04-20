import type {
  RegimeData,
  MetricRow,
  Trend,
  Status,
  NewsPayload,
  RiskTolerance,
  RebalancePlan,
} from '../types/regime'

/** In dev, use Vite proxy to avoid CORS and port issues. Set VITE_API_URL for production. */
const BASE_URL =
  import.meta.env.DEV && !import.meta.env.VITE_API_URL
    ? ''
    : (import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8001')

const API_PREFIX = import.meta.env.DEV && !import.meta.env.VITE_API_URL ? '/api' : ''

function url(path: string): string {
  return `${BASE_URL}${API_PREFIX}${path}`
}

/** Backend GET /regime/current payload (subset we need). */
interface RegimeApiResponse {
  date: string
  regime: string
  probability: number
  total_score: number
  breakdown: {
    growth: { score: number; max: number }
    inflation: { score: number; max: number }
    financial: { score: number; max: number }
    market: { score: number; max: number }
  }
  allocation: {
    equities: number
    bonds: number
    gold: number
  }
  signals: {
    growth: Record<string, unknown>
    inflation: Record<string, unknown>
    financial: Record<string, unknown>
    market: Record<string, unknown>
  }
  global_macro?: {
    fed_funds_3m_change?: number | null
    real_rate_10y?: number | null
    cpi_yoy?: number | null
    dxy_3m_pct_change?: number | null
    boj_10y_yield?: number | null
    ecb_policy_rate?: number | null
    uk_10y_gilt_yield?: number | null
  }
  fedwatch?: {
    source?: string
    as_of?: string
    next_3m?: {
      cut?: number
      hold?: number
      hike?: number
    }
  }
  macro_release_calendar?: {
    as_of?: string
    releases?: Array<{ event?: string; date?: string }>
  }
  error?: string
}

export interface MacroHistorySeries {
  yield: Array<number | null>
  price: Array<number | null>
}

export interface GlobalMacroHistoryResponse {
  dates: string[]
  series: {
    boj_10y_yield: MacroHistorySeries
    ecb_policy_rate: MacroHistorySeries
    uk_10y_gilt_yield: MacroHistorySeries
    us_real_10y: MacroHistorySeries
  }
  scatter: Array<{ year: number; real_yield: number; sp500_yoy: number }>
  cb_stats: Record<string, { current: number | null; pct: number | null; min: number | null; max: number | null; change_3m: number | null }>
}

export interface HistoricalInsightsResponse {
  timeline: Array<{ date: string; regime: string; total_score: number }>
  event_overlays: Array<{ event: string; input_date: string; detected_date: string; regime: string; total_score: number }>
  transitions: Array<{ date: string; from_regime: string | null; to_regime: string; new_allocation: { equities: number; bonds: number; gold: number } }>
  avg_duration_days: Record<string, number>
  allocation_history: Array<{ date: string; regime: string; equities: number; bonds: number; gold: number }>
  performance_simulation: {
    model_return: number
    spy_return: number
    model_max_drawdown: number
    spy_max_drawdown: number
    model_sharpe: number
    spy_sharpe: number
  }
}

export interface ForecastResponse {
  transition_matrix: Record<string, Record<string, number>>
  projected_regimes: {
    t1m: Record<string, number>
    t3m: Record<string, number>
    t6m: Record<string, number>
  }
  score_trajectory: Array<{ date: string; total_score: number; regime: string }>
  signal_momentum: Record<string, { value: number; change_3m: number; direction: 'up' | 'down' | 'flat' }>
  current_streak: { regime: string; start_date: string; days: number }
  avg_duration_days: Record<string, number>
  score_forecast?: Array<{ date: string; predicted_score: number; lo: number; hi: number }>
}

export interface RiskLabResponse {
  breakdown: {
    growth: { score: number; max: number }
    inflation: { score: number; max: number }
    financial: { score: number; max: number }
    market: { score: number; max: number }
  }
  stress_indicators: {
    yield_curve_inverted: boolean
    vix_above_25: boolean
    credit_spreads_widening: boolean
  }
  volatility_regime: 'low' | 'elevated' | 'high'
  current_drawdown: number
  crash_probability: number
  risk_drivers: string[]
}

function scaleToFour(s: { score: number; max: number }): number {
  if (!s.max) return 0
  return Math.floor((s.score / s.max) * 4)
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (typeof v === 'number') return Number.isFinite(v) ? v.toFixed(2) : '—'
  return String(v)
}

function fmtPct(v: unknown): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—'
  return `${(v * 100).toFixed(2)}%`
}

function fmtPmi(v: unknown): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—'
  // PMI diffusion index should be around 0-100; suppress known bad cached values.
  if (v < 10 || v > 90) return '—'
  return v.toFixed(2)
}

function trendForDelta(v: unknown): Trend {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 'flat'
  if (v > 0.0001) return 'up'
  if (v < -0.0001) return 'down'
  return 'flat'
}

function statusForBool(stress: boolean | undefined): Status {
  if (stress === true) return 'WARNING'
  if (stress === false) return 'NORMAL'
  return 'NEUTRAL'
}

function rowsFromGrowth(g: Record<string, unknown>): MetricRow[] {
  return [
    { metric: 'Unemployment 3M Δ', value: fmtPct(g.unemp_3m_change), trend: trendForDelta(g.unemp_3m_change), status: statusForBool(g.unemp_rising === true) },
    { metric: 'Yield spread (10Y–2Y)', value: fmt(g.yield_spread), trend: 'flat', status: statusForBool(g.yield_curve_inverted === true) },
    { metric: 'Industrial prod. YoY', value: fmt(g.indpro_yoy), trend: 'flat', status: statusForBool(g.indpro_negative === true) },
    { metric: 'PMI', value: fmtPmi(g.pmi_value), trend: 'flat', status: statusForBool(g.pmi_below_50 === true) },
  ]
}

function rowsFromInflation(i: Record<string, unknown>): MetricRow[] {
  const cpi3m = typeof i.cpi_3m_change === 'number' ? i.cpi_3m_change : null
  const fed3m = typeof i.fed_funds_3m_change === 'number' ? i.fed_funds_3m_change : null
  const realRate = typeof i.real_rate === 'number' ? i.real_rate : null
  const policyStillTight =
    fed3m !== null && realRate !== null && fed3m >= -0.10 && realRate > 1.0

  return [
    { metric: 'CPI YoY', value: fmt(i.cpi_yoy), trend: 'flat', status: statusForBool(i.cpi_above_3 === true) },
    { metric: 'CPI 3M change', value: fmtPct(i.cpi_3m_change), trend: trendForDelta(i.cpi_3m_change), status: statusForBool(cpi3m !== null ? cpi3m > 0 : undefined) },
    { metric: 'Fed Funds 3M Δ', value: fmtPct(i.fed_funds_3m_change), trend: trendForDelta(i.fed_funds_3m_change), status: statusForBool(policyStillTight ? true : false) },
    { metric: 'Core CPI YoY', value: fmt(i.core_cpi_yoy), trend: 'flat', status: 'NEUTRAL' },
    { metric: 'Real rate (10Y)', value: fmt(i.real_rate), trend: 'flat', status: statusForBool(i.real_rate_negative === true) },
  ]
}

function rowsFromFinancial(f: Record<string, unknown>): MetricRow[] {
  return [
    { metric: 'HY credit spread', value: fmt(f.credit_spread), trend: 'flat', status: statusForBool(f.credit_spread_widening === true) },
    { metric: 'HY credit spread % change', value: fmtPct(f.credit_spread_3m_pct_change), trend: trendForDelta(f.credit_spread_3m_pct_change), status: statusForBool(f.credit_spread_widening === true) },
    { metric: 'Spread 3M Δ', value: fmtPct(f.credit_spread_3m_change), trend: trendForDelta(f.credit_spread_3m_change), status: 'NEUTRAL' },
    { metric: '10Y 3M Δ', value: fmtPct(f.nominal_10y_3m_change), trend: trendForDelta(f.nominal_10y_3m_change), status: statusForBool(f.rate_rising_sharply === true) },
    { metric: 'DXY 3M %', value: fmtPct(f.dxy_3m_pct_change), trend: trendForDelta(f.dxy_3m_pct_change), status: statusForBool(f.dollar_strengthening === true) },
  ]
}

function rowsFromMarket(m: Record<string, unknown>): MetricRow[] {
  return [
    { metric: 'SPX 6M momentum', value: fmtPct(m.sp500_6m_momentum), trend: trendForDelta(m.sp500_6m_momentum), status: 'NEUTRAL' },
    { metric: 'SPX 12M momentum', value: fmtPct(m.sp500_12m_momentum), trend: trendForDelta(m.sp500_12m_momentum), status: statusForBool(m.momentum_negative === true) },
    { metric: 'VIX', value: fmt(m.vix_level), trend: trendForDelta(m.vix_1m_change), status: statusForBool(m.vix_above_25 === true) },
    { metric: 'SPX drawdown', value: fmtPct(m.sp500_drawdown), trend: trendForDelta(m.sp500_drawdown), status: statusForBool(m.drawdown_severe === true) },
    { metric: 'Below 200DMA', value: fmt(m.below_200ma), trend: 'flat', status: statusForBool(m.below_200ma === true) },
  ]
}

function mapApiToRegimeData(raw: RegimeApiResponse): RegimeData {
  const b = raw.breakdown
  const sig = raw.signals ?? { growth: {}, inflation: {}, financial: {}, market: {} }

  return {
    regime: raw.regime,
    probability: raw.probability,
    total_score: raw.total_score,
    max_score: 10,
    scores: {
      growth: scaleToFour(b.growth),
      inflation: scaleToFour(b.inflation),
      financial_conditions: scaleToFour(b.financial),
      market_risk: scaleToFour(b.market),
    },
    growth_metrics: rowsFromGrowth(sig.growth ?? {}),
    inflation_metrics: rowsFromInflation(sig.inflation ?? {}),
    financial_metrics: rowsFromFinancial(sig.financial ?? {}),
    market_metrics: rowsFromMarket(sig.market ?? {}),
    allocation: {
      equities: raw.allocation.equities,
      bonds: raw.allocation.bonds,
      alternatives: raw.allocation.gold,
    },
    fedwatch: {
      source: raw.fedwatch?.source ?? 'unknown',
      as_of: raw.fedwatch?.as_of ?? raw.date,
      next_3m: {
        cut: raw.fedwatch?.next_3m?.cut ?? 0.33,
        hold: raw.fedwatch?.next_3m?.hold ?? 0.34,
        hike: raw.fedwatch?.next_3m?.hike ?? 0.33,
      },
    },
    macro_release_calendar: {
      as_of: raw.macro_release_calendar?.as_of ?? raw.date,
      releases: (raw.macro_release_calendar?.releases ?? []).map((r) => ({
        event: r.event ?? 'Macro release',
        date: r.date ?? raw.date,
      })),
    },
    global_macro: {
      fed_funds_3m_change: raw.global_macro?.fed_funds_3m_change ?? null,
      real_rate_10y: raw.global_macro?.real_rate_10y ?? null,
      cpi_yoy: raw.global_macro?.cpi_yoy ?? null,
      dxy_3m_pct_change: raw.global_macro?.dxy_3m_pct_change ?? null,
      boj_10y_yield: raw.global_macro?.boj_10y_yield ?? null,
      ecb_policy_rate: raw.global_macro?.ecb_policy_rate ?? null,
      uk_10y_gilt_yield: raw.global_macro?.uk_10y_gilt_yield ?? null,
    },
    updated_at: raw.date,
  }
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(url(path))
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${path} failed: ${res.status} ${res.statusText}${text ? ` — ${text.slice(0, 200)}` : ''}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  getRegime: async (): Promise<RegimeData> => {
    const raw = await getJson<RegimeApiResponse>('/regime/current')
    return mapApiToRegimeData(raw)
  },
  getGlobalMacroHistory: async (): Promise<GlobalMacroHistoryResponse> => {
    return getJson<GlobalMacroHistoryResponse>('/macro/global-history')
  },
  getHistoricalInsights: async (): Promise<HistoricalInsightsResponse> => {
    return getJson<HistoricalInsightsResponse>('/regime/historical-insights')
  },
  getRiskLab: async (): Promise<RiskLabResponse> => {
    return getJson<RiskLabResponse>('/regime/risk-lab')
  },
  getNews: async (topics: string[] = []): Promise<NewsPayload> => {
    const q = topics.length > 0 ? `?topics=${encodeURIComponent(topics.join(','))}` : ''
    return getJson<NewsPayload>(`/news/${q}`)
  },
  getRebalancePlan: async (riskTolerance: RiskTolerance): Promise<RebalancePlan> => {
    return getJson<RebalancePlan>(
      `/allocation/rebalance-plan?risk_tolerance=${encodeURIComponent(riskTolerance)}`
    )
  },
  getSnapshot: async (date: string): Promise<RegimeData> => {
    const raw = await getJson<RegimeApiResponse>(`/regime/snapshot?date=${encodeURIComponent(date)}`)
    return mapApiToRegimeData(raw)
  },
  getForecast: async (): Promise<ForecastResponse> => {
    return getJson<ForecastResponse>('/regime/forecast')
  },
  downloadExport: async (): Promise<void> => {
    const res = await fetch(url('/regime/export'))
    if (!res.ok) throw new Error(`Export failed: ${res.status} ${res.statusText}`)
    const blob = await res.blob()
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    const disposition = res.headers.get('Content-Disposition') ?? ''
    const match = disposition.match(/filename=([^\s;]+)/)
    link.download = match ? match[1] : 'regimeiq_export.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)
  },
}
