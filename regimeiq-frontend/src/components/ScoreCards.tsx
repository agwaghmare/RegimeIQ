import type { RegimeScores } from '../types/regime'

interface Props {
  scores: RegimeScores
}

type CardDef = {
  key: keyof RegimeScores
  label: string
  icon: string
  color: 'primary' | 'tertiary' | 'error'
}

const CARDS: CardDef[] = [
  { key: 'growth', label: 'Growth Score', icon: 'trending_up', color: 'primary' },
  { key: 'inflation', label: 'Inflation Score', icon: 'trending_flat', color: 'tertiary' },
  { key: 'financial_conditions', label: 'Financial Cond.', icon: 'trending_up', color: 'primary' },
  { key: 'market_risk', label: 'Market Risk', icon: 'trending_down', color: 'error' },
]

const colorMap = {
  primary: { text: 'text-primary', bg: 'bg-primary/20', bar: 'bg-primary' },
  tertiary: { text: 'text-tertiary', bg: 'bg-tertiary/20', bar: 'bg-tertiary' },
  error: { text: 'text-error', bg: 'bg-error/20', bar: 'bg-error' },
}

const MAX = 4.0

function metricTone(value: number): { label: string; hint: string } {
  if (value >= 3.2) return { label: 'Elevated', hint: 'Watch closely' }
  if (value >= 2.2) return { label: 'Moderate', hint: 'Within range' }
  return { label: 'Stable', hint: 'Low stress' }
}

function trendIcon(value: number): string {
  if (value >= 3.2) return 'north_east'
  if (value >= 2.2) return 'trending_flat'
  return 'south_east'
}

export function ScoreCards({ scores }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {CARDS.map((card) => {
        const value = scores[card.key]
        const c = colorMap[card.color]
        const pct = Math.round((value / MAX) * 100)
        const tone = metricTone(value)
        return (
          <div
            key={card.key}
            className="bg-surface-container p-4 rounded-xl border border-outline-variant/15 relative overflow-hidden group transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(0,0,0,0.28)]"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex justify-between items-start mb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{card.label}</span>
              <span className={`material-symbols-outlined ${c.text} text-sm`}>{card.icon}</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className={`text-base font-bold ${c.text}`}>{tone.label}</div>
                <div className="text-[11px] text-on-surface-variant">{tone.hint}</div>
              </div>
              <span className={`material-symbols-outlined text-base ${c.text}`}>{trendIcon(value)}</span>
            </div>
            <div className="mt-4 h-8 w-full flex items-end gap-[1px]">
              <div className={`w-full h-2 ${c.bg} rounded-full relative overflow-hidden`}>
                <div
                  className={`absolute left-0 top-0 bottom-0 ${c.bar} rounded-full transition-all duration-500`}
                  style={{ width: `${pct}%` }}
                ></div>
              </div>
            </div>
            <div className="mt-2 text-[10px] text-on-surface-variant tabular-nums">{value.toFixed(1)} / {MAX.toFixed(1)}</div>
          </div>
        )
      })}
    </div>
  )
}
