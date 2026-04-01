import type { Allocation } from '../types/regime'

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
  if (regime === 'Risk-On') return 'bg-emerald-500/20 text-emerald-400'
  if (regime === 'Risk-Off') return 'bg-rose-500/20 text-rose-400'
  if (regime === 'Crisis') return 'bg-red-600/20 text-red-400'
  return 'bg-yellow-500/20 text-yellow-400'
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  // Clamp to avoid degenerate arcs
  const span = Math.min(endDeg - startDeg, 359.9)
  const s = polarToCartesian(cx, cy, r, startDeg)
  const e = polarToCartesian(cx, cy, r, startDeg + span)
  const large = span > 180 ? 1 : 0
  return `M ${s.x.toFixed(3)} ${s.y.toFixed(3)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(3)} ${e.y.toFixed(3)}`
}

const EQUITIES_ETFS: ETF[] = [
  { ticker: 'VOO',  name: 'Vanguard S&P 500 ETF',         desc: 'Tracks the S&P 500; broad large-cap US exposure.' },
  { ticker: 'SCHB', name: 'Schwab US Broad Market ETF',    desc: 'Total US market, very low expense ratio.' },
  { ticker: 'QQQ',  name: 'Invesco Nasdaq-100 ETF',        desc: 'Top 100 non-financial Nasdaq names; tech-heavy growth.' },
]

const BONDS_ETFS: ETF[] = [
  { ticker: 'BIL', name: 'SPDR Bloomberg 1-3 Month T-Bill ETF', desc: 'Ultra-short duration; near-zero rate risk.' },
  { ticker: 'SHV', name: 'iShares Short Treasury Bond ETF',     desc: 'Short-term US Treasuries, 1 year and under.' },
  { ticker: 'TLT', name: 'iShares 20+ Year Treasury Bond ETF',  desc: 'Long-duration Treasuries; high rate sensitivity.' },
  { ticker: 'AGG', name: 'iShares Core US Aggregate Bond ETF',  desc: 'Broad investment-grade bond market.' },
]

const ALTS_ETFS: ETF[] = [
  { ticker: 'GLD', name: 'SPDR Gold Shares',   desc: 'Largest gold ETF by AUM; tracks spot gold price.' },
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
  const CX = 100
  const CY = 100
  const R = 72
  const SW = 28

  const eqDeg  = allocation.equities     * 360
  const bdDeg  = allocation.bonds        * 360
  const altDeg = allocation.alternatives * 360

  const segments = [
    { key: 'eq',  label: 'Equities',    pct: allocation.equities,     deg: eqDeg,  start: 0,              color: '#6366f1' },
    { key: 'bd',  label: 'Fixed Income', pct: allocation.bonds,        deg: bdDeg,  start: eqDeg,          color: '#22d3ee' },
    { key: 'alt', label: 'Alternatives', pct: allocation.alternatives, deg: altDeg, start: eqDeg + bdDeg,  color: '#f59e0b' },
  ]

  return (
    <section className="ml-0 md:ml-64 pt-20 p-6 min-h-screen">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-on-surface tracking-tight">Portfolio Allocation</h2>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${regimeBadgeClass(regime)}`}>
            {regime}
          </span>
        </div>

        {/* Top row: donut + allocation summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Donut chart */}
          <div className="bg-surface-container rounded-xl border border-outline-variant/20 p-6 flex items-center justify-center">
            <svg viewBox="0 0 200 200" width={200} height={200} className="overflow-visible">
              {/* Background track */}
              <circle cx={CX} cy={CY} r={R} fill="none" stroke="currentColor" strokeWidth={SW} className="text-surface-container-highest" />
              {/* Segments */}
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
              {/* Center label */}
              <text x={CX} y={CY - 6} textAnchor="middle" className="fill-on-surface" fontSize={13} fontWeight="700">
                {regime}
              </text>
              <text x={CX} y={CY + 12} textAnchor="middle" className="fill-on-surface-variant" fontSize={10}>
                Regime
              </text>
            </svg>
          </div>

          {/* Allocation summary bars */}
          <div className="bg-surface-container rounded-xl border border-outline-variant/20 p-6 flex flex-col justify-center space-y-5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">
              Regime Allocation
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
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${seg.pct * 100}%`, backgroundColor: seg.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Three asset class cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <AssetCard
            title="Equities"
            pct={allocation.equities}
            color="#6366f1"
            etfs={EQUITIES_ETFS}
            placeholder="Individual Stocks — Coming Soon"
          />
          <AssetCard
            title="Fixed Income"
            pct={allocation.bonds}
            color="#22d3ee"
            etfs={BONDS_ETFS}
            placeholder="More Bond Options — Coming Soon"
          />
          <AssetCard
            title="Alternatives"
            pct={allocation.alternatives}
            color="#f59e0b"
            etfs={ALTS_ETFS}
            placeholder="Commodities, REITs, Crypto — Coming Soon"
          />
        </div>

        {/* Regime note */}
        <div className="flex items-start gap-3 rounded-xl bg-primary-container/20 border border-primary/10 p-4 text-xs text-on-primary-container">
          <span className="material-symbols-outlined text-primary text-base shrink-0">lightbulb</span>
          <span>
            Allocations are driven by the current{' '}
            <strong className="font-bold">{regime}</strong> regime classification.
            As macro conditions shift, weightings adjust automatically — rotating into defensive
            assets in downturns and risk assets in expansions.
          </span>
        </div>

      </div>
    </section>
  )
}
