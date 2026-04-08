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

export function ScoreCards({ scores }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {CARDS.map((card) => {
        const value = scores[card.key]
        const c = colorMap[card.color]
        const pct = Math.round((value / MAX) * 100)
        return (
          <div key={card.key} className="bg-surface-container p-4 rounded-lg relative overflow-hidden group">
            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{card.label}</span>
              <span className={`material-symbols-outlined ${c.text} text-sm`}>{card.icon}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black tabular-nums">{value.toFixed(1)}</span>
              <span className="text-xs text-on-surface-variant">/ {MAX.toFixed(1)}</span>
            </div>
            <div className="mt-4 h-8 w-full flex items-end gap-[1px]">
              <div className={`w-full h-2 ${c.bg} rounded-full relative overflow-hidden`}>
                <div className={`absolute left-0 top-0 bottom-0 ${c.bar} rounded-full`} style={{ width: `${pct}%` }}></div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
