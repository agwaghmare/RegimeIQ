type FeedItem = {
  time: string
  source: string
  text: string
  accent: 'primary' | 'outline'
}

const feedItems: FeedItem[] = [
  {
    time: '14:20:11',
    source: 'FED',
    text: 'Powell hints at structural disinflation; yield curve steepens 4bps.',
    accent: 'primary',
  },
  {
    time: '14:05:43',
    source: 'MACRO',
    text: 'PMI data exceeds estimates across EU markets. Neutral impact.',
    accent: 'outline',
  },
]

export function TerminalFeed() {
  return (
    <div className="bg-surface-container-low rounded-lg p-4 border border-outline-variant/5">
      <div className="flex items-center gap-2 mb-4">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-error opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-error"></span>
        </span>
        <span className="text-[10px] font-black uppercase tracking-widest">Live Terminal Feed</span>
      </div>
      <div className="space-y-4">
        {feedItems.map((item) => (
          <div
            key={`${item.time}-${item.source}`}
            className={`border-l-2 ${item.accent === 'primary' ? 'border-primary' : 'border-outline'} pl-3 py-1`}
          >
            <div className="text-[9px] text-on-surface-variant mb-1">
              {item.time} — {item.source}
            </div>
            <div className="text-[11px] leading-tight font-medium text-on-surface">{item.text}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
