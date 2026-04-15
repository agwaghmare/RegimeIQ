interface Props {
  regime: string
  probability: number
  isLive?: boolean
  dataDate?: string | null
}

function formatDataDate(dataDate: string | null | undefined): string {
  if (!dataDate) return 'Waiting for data'
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  if (dataDate === today) return 'Updated today'
  if (dataDate === yesterday) return 'Updated yesterday'
  return `Data as of ${dataDate}`
}

export function TopNav({ regime, probability, isLive = false, dataDate = null }: Props) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#0e0e10] flex justify-between items-center w-full px-6 py-3 max-w-[1920px] mx-auto font-['Inter'] tabular-nums text-sm antialiased">
      <div className="flex items-center gap-8">
        <span className="text-lg font-bold tracking-tighter text-[#e7e4ec]">RegimeIQ</span>
        <nav className="hidden md:flex gap-6">
          <a className="text-[#d7dce3] border-b-2 border-[#c3c9d1] pb-1 font-semibold" href="#">Current</a>
          <a className="text-[#9aa2ac] hover:text-[#eceff3] transition-colors" href="#">Forecast</a>
        </nav>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-primary-container px-3 py-1 rounded-lg">
          <span className="text-xs font-bold uppercase tracking-wider text-on-primary-container">Regime: {regime}</span>
          <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_rgba(195,201,209,0.55)]"></span>
        </div>
        <div className="text-xs font-medium text-on-surface-variant flex items-center gap-1">
          <span>Prob:</span>
          <span className="text-primary font-bold">{Math.round(probability * 100)}%</span>
        </div>
        <div className="text-xs text-on-surface-variant flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${isLive ? 'bg-primary' : 'bg-error'}`}></span>
          <span>{isLive ? 'Live' : 'Paused'}</span>
          <span className="opacity-80">|</span>
          <span>{formatDataDate(dataDate)}</span>
        </div>
        <div className="h-8 w-[1px] bg-outline-variant opacity-20 mx-2"></div>
        <div className="flex items-center gap-3 text-[#9aa2ac]">
          <span className="material-symbols-outlined cursor-pointer hover:text-white transition-all active:scale-95 duration-100">notifications</span>
          <span className="material-symbols-outlined cursor-pointer hover:text-white transition-all active:scale-95 duration-100">account_circle</span>
        </div>
      </div>
    </header>
  )
}
