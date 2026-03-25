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

const trendIcon = { up: 'arrow_upward', down: 'arrow_downward', flat: 'trending_flat' }

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

export function MetricsTable({ title, subtitle, rows }: MetricsTableProps) {
  return (
    <div className="bg-surface-container-low rounded-lg overflow-hidden">
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
                <td className="px-2 py-2.5 font-medium">{row.metric}</td>
                <td className="px-2 py-2.5">{row.value}</td>
                <td className={`px-2 py-2.5 ${trendColor[row.trend]}`}>
                  <span className="material-symbols-outlined text-[14px]">{trendIcon[row.trend]}</span>
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
