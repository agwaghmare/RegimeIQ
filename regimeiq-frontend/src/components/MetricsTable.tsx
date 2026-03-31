type MetricRow = {
  metric: string
  value: string
  trend: 'up' | 'down' | 'flat'
  status: 'NORMAL' | 'WARNING' | 'CRITICAL' | 'NEUTRAL'
}

type MetricsTableProps = {
  title: string
  subtitle: string
  rows: MetricRow[]
}

const trendGlyph = { up: '▲', down: '▼', flat: '→' }

const trendColor = {
  up: 'text-primary',
  down: 'text-primary',
  flat: 'text-tertiary',
}

const statusStyle: Record<MetricRow['status'], string> = {
  NORMAL: 'bg-primary/10 text-primary',
  WARNING: 'bg-error/10 text-error',
  CRITICAL: 'bg-error/10 text-error',
  NEUTRAL: 'bg-tertiary/10 text-tertiary',
}

const metricHelp: Record<string, string> = {
  'Unemployment 3M Δ': 'What: 3-month change in unemployment rate. Market impact: rising unemployment usually increases recession risk and pressures equities.',
  'Yield spread (10Y–2Y)': 'What: difference between 10Y and 2Y Treasury yields. Market impact: inversion often signals tighter conditions and slower growth ahead.',
  'Industrial prod. YoY': 'What: year-over-year change in industrial output. Market impact: weakening production can signal softer earnings and cyclical risk.',
  PMI: 'What: Purchasing Managers Index (business activity diffusion index). Market impact: below 50 typically signals contraction and weaker risk sentiment.',
  'CPI YoY': 'What: Consumer Price Index inflation versus last year. Market impact: higher CPI can delay rate cuts and pressure duration/risk assets.',
  'CPI 3M change': 'What: short-term inflation trend over recent months. Market impact: rising trend raises policy-tightening risk; falling trend supports disinflation.',
  'Core CPI YoY': 'What: CPI excluding food and energy. Market impact: sticky core inflation keeps central banks cautious and rates higher for longer.',
  'Fed Funds 3M Δ': 'What: 3-month change in policy rate. Market impact: no cuts/tight policy tends to support USD and pressure rate-sensitive assets.',
  'Real rate (10Y)': 'What: inflation-adjusted long-term interest rate. Market impact: higher real rates tighten financial conditions and weigh on growth assets.',
  'HY credit spread': 'What: yield spread of high-yield bonds vs Treasuries. Market impact: widening spreads signal rising default/risk aversion.',
  'HY credit spread % change': 'What: percent change in HY spread over 3 months. Market impact: sharp increases indicate fast deterioration in credit sentiment.',
  'Spread 3M Δ': 'What: 3-month change in credit spreads. Market impact: fast widening often precedes broader risk-off market behavior.',
  '10Y 3M Δ': 'What: 3-month change in long-end yield proxy. Market impact: sharp rate moves can reprice equities, duration and FX quickly.',
  'DXY 3M %': 'What: 3-month change in US Dollar index. Market impact: stronger USD can tighten global liquidity and pressure EM/risk assets.',
  'SPX 6M momentum': 'What: S&P 500 return trend over 6 months. Market impact: negative momentum often aligns with risk-off positioning.',
  'SPX 12M momentum': 'What: S&P 500 return trend over 12 months. Market impact: weakening long trend can reduce risk appetite.',
  VIX: 'What: implied volatility index for US equities. Market impact: rising VIX reflects higher hedging demand and market stress.',
  'SPX drawdown': 'What: percent decline from S&P 500 peak. Market impact: deeper drawdowns usually coincide with tighter conditions and de-risking.',
  'Below 200DMA': 'What: whether S&P 500 is below 200-day moving average. Market impact: below 200DMA often indicates weaker technical regime.',
}

export function MetricsTable({ title, subtitle, rows }: MetricsTableProps) {
  return (
    <div className="bg-surface-container-low rounded-lg overflow-visible">
      <div className="px-4 py-3 bg-surface-container flex justify-between items-center">
        <h3 className="text-xs font-bold uppercase tracking-widest">{title}</h3>
        <span className="text-[10px] text-on-surface-variant font-mono">{subtitle}</span>
      </div>
      <div className="p-2">
        <table className="w-full text-left tabular-nums">
          <thead>
            <tr className="text-[10px] text-on-surface-variant uppercase tracking-tighter border-b border-outline-variant/10">
              <th className="px-2 py-2 font-medium">Metric</th>
              <th className="px-2 py-2 font-medium">Value</th>
              <th className="px-2 py-2 font-medium">Trend</th>
              <th className="px-2 py-2 font-medium text-right">Status</th>
            </tr>
          </thead>
          <tbody className="text-[11px]">
            {rows.map((row) => (
              <tr key={row.metric} className="hover:bg-surface-container-high transition-colors group">
                <td className="px-2 py-2.5 font-medium relative">
                  <span className="group/metric relative inline-block cursor-help decoration-dotted underline-offset-2 hover:underline">
                    {row.metric}
                    <span className="pointer-events-none absolute left-0 top-full mt-1 z-50 hidden w-72 rounded-md border border-outline-variant/30 bg-[#111317] px-3 py-2 text-[10px] leading-relaxed text-[#e7e4ec] shadow-xl group-hover/metric:block">
                      {metricHelp[row.metric] ?? 'Macro/market variable used in regime scoring and portfolio allocation.'}
                    </span>
                  </span>
                </td>
                <td className="px-2 py-2.5">{row.value}</td>
                <td className={`px-2 py-2.5 ${trendColor[row.trend]}`}>
                  <span className="text-[12px] font-bold">{trendGlyph[row.trend]}</span>
                </td>
                <td className="px-2 py-2.5 text-right">
                  <span className={`${statusStyle[row.status]} px-1.5 py-0.5 rounded text-[9px] font-bold`}>
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
