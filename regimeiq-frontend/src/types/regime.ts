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
  updated_at: string
}
