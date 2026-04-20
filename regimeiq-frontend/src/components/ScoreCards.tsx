import type { RegimeScores } from '../types/regime'

interface Props { scores: RegimeScores }

type CardDef = {
  key: keyof RegimeScores
  label: string
}

const CARDS: CardDef[] = [
  { key: 'growth',               label: 'Growth Score'    },
  { key: 'inflation',            label: 'Inflation Score' },
  { key: 'financial_conditions', label: 'Financial Cond.' },
  { key: 'market_risk',          label: 'Market Risk'     },
]

const MAX = 4.0

function scoreColor(value: number): string {
  const t = Math.max(0, Math.min(1, value / MAX))
  // Three-stop: green → orange → red, avoids the yellow-green midpoint
  // Three-stop: green (#22c55e) → yellow (#eab308) → red (#ef4444)
  const [r, g, b] = t < 0.5
    ? [
        Math.round(34  + (234 - 34)  * (t * 2)),
        Math.round(197 + (179 - 197) * (t * 2)),
        Math.round(94  + (8   - 94)  * (t * 2)),
      ]
    : [
        Math.round(234 + (239 - 234) * ((t - 0.5) * 2)),
        Math.round(179 + (68  - 179) * ((t - 0.5) * 2)),
        Math.round(8   + (68  - 8)   * ((t - 0.5) * 2)),
      ]
  return `rgb(${r},${g},${b})`
}

function metricTone(value: number): { label: string; hint: string } {
  if (value >= 3) return { label: 'Elevated', hint: 'Watch closely' }
  if (value >= 2) return { label: 'Moderate', hint: 'Within range' }
  return { label: 'Stable', hint: 'Low stress' }
}

export function ScoreCards({ scores }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {CARDS.map((card) => {
        const value = scores[card.key]
        const pct   = Math.round((value / MAX) * 100)
        const tone  = metricTone(value)
        const color = scoreColor(value)
        return (
          <div
            key={card.key}
            className="bg-surface-container p-4 rounded-xl border border-outline-variant/15 relative overflow-hidden group transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(0,0,0,0.28)]"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="mb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{card.label}</span>
            </div>
            <div className="font-bold text-base" style={{ color }}>{tone.label}</div>
            <div className="text-[11px] text-on-surface-variant">{tone.hint}</div>
            <div className="mt-4 h-8 w-full flex items-end">
              <div className="w-full h-2 bg-primary/20 rounded-full relative overflow-hidden">
                <div
                  className="absolute left-0 top-0 bottom-0 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: color }}
                />
              </div>
            </div>
            <div className="mt-2 text-[10px] text-on-surface-variant tabular-nums">{value.toFixed(1)} / {MAX.toFixed(1)}</div>
          </div>
        )
      })}
    </div>
  )
}
