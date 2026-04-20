export type Trend = 'up' | 'down' | 'flat'
export type Status = 'NORMAL' | 'WARNING' | 'CRITICAL' | 'NEUTRAL'

export interface MetricRow {
  metric: string
  value: string
  trend: Trend
  status: Status
}

export interface RegimeScores {
  growth: number
  inflation: number
  financial_conditions: number
  market_risk: number
}

export interface Allocation {
  equities: number
  bonds: number
  alternatives: number
}

export interface GlobalMacroSnapshot {
  fed_funds: number | null
  fed_funds_3m_change: number | null
  real_rate_10y: number | null
  cpi_yoy: number | null
  dxy_3m_pct_change: number | null
  boj_10y_yield: number | null
  ecb_policy_rate: number | null
  uk_10y_gilt_yield: number | null
}

export interface FedWatch {
  source: string
  as_of: string
  next_3m: {
    cut: number
    hold: number
    hike: number
  }
}

export interface MacroReleaseCalendar {
  as_of: string
  releases: Array<{
    event: string
    date: string
  }>
}

export interface RegimeData {
  regime: string
  probability: number
  total_score: number
  max_score: number
  scores: RegimeScores
  growth_metrics: MetricRow[]
  inflation_metrics: MetricRow[]
  financial_metrics: MetricRow[]
  market_metrics: MetricRow[]
  allocation: Allocation
  fedwatch: FedWatch
  macro_release_calendar: MacroReleaseCalendar
  global_macro: GlobalMacroSnapshot
  updated_at: string
}

export type RiskTolerance = 'conservative' | 'moderate' | 'aggressive'

export interface NewsArticle {
  title: string
  source: string
  url: string
  published_at: string
  description?: string | null
  black_swan_score: number
  relevance: string
}

export interface NewsPayload {
  articles: NewsArticle[]
  summary: string
  as_of: string
}

export interface RankedAsset {
  ticker: string
  sharpe: number
  ann_return: number
  ann_vol: number
}

export interface RebalancePlan {
  regime: string
  risk_tolerance: string
  bucket_weights: {
    equities: number
    bonds: number
    commodities: number
  }
  buy_recommendations: {
    stocks: RankedAsset[]
    bonds: RankedAsset[]
    commodities: RankedAsset[]
  }
  model_portfolio: Array<{
    ticker: string
    sharpe: number
    target_weight: number
  }>
}
