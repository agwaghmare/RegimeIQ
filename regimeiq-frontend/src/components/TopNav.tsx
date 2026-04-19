interface Props {
  regime: string
  probability: number
  isLive?: boolean
  dataDate?: string | null
}

function formatDataDate(dataDate: string | null | undefined): string {
  if (!dataDate) return 'Waiting for data'
  const today     = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  if (dataDate === today)     return 'Updated today'
  if (dataDate === yesterday) return 'Updated yesterday'
  return `Data as of ${dataDate}`
}

export function TopNav({ regime, probability, isLive = false, dataDate = null }: Props) {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center w-full px-6 py-3 max-w-[1920px] mx-auto font-['Inter'] tabular-nums text-sm antialiased"
      style={{
        background: 'rgba(10, 10, 10, 0.94)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.03), 0 4px 24px rgba(0,0,0,0.7)',
      }}
    >
      <div className="flex items-center gap-8">
        <span className="text-lg font-black tracking-tighter text-white">RegimeIQ</span>
        <nav className="hidden md:flex gap-6">
          <a
            className="font-semibold pb-1 text-white"
            style={{ borderBottom: '2px solid var(--accent)' }}
            href="#"
          >
            Current
          </a>
          <a className="text-[#9aa2ac] hover:text-white transition-colors" href="#">Forecast</a>
        </nav>
      </div>

      <div className="flex items-center gap-4">
        <div
          className="flex items-center gap-2 px-3 py-1 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)' }}
        >
          <span className="text-xs font-bold uppercase tracking-wider text-white">Regime: {regime}</span>
          <span className="h-2 w-2 rounded-full" style={{ background: 'var(--accent)' }} />
        </div>

        <div className="text-xs font-medium flex items-center gap-1 text-[#9aa2ac]">
          <span>Prob:</span>
          <span className="font-black text-white">{Math.round(probability * 100)}%</span>
        </div>

        <div className="text-xs flex items-center gap-2 text-[#9aa2ac]">
          <span
            className={`h-2 w-2 rounded-full ${isLive ? 'live-blink' : ''}`}
            style={{ background: isLive ? 'var(--accent)' : '#ef4444' }}
          />
          <span>{isLive ? 'Live' : 'Paused'}</span>
          <span className="opacity-40">|</span>
          <span>{formatDataDate(dataDate)}</span>
        </div>

        <div className="h-8 w-px mx-1" style={{ background: 'rgba(255,255,255,0.07)' }} />

        <div className="flex items-center gap-3 text-[#9aa2ac]">
          <span className="material-symbols-outlined cursor-pointer hover:text-white transition-all active:scale-95">notifications</span>
          <span className="material-symbols-outlined cursor-pointer hover:text-white transition-all active:scale-95">account_circle</span>
        </div>
      </div>
    </header>
  )
}
