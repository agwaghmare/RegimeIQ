interface Props {
  regime: string
  probability: number
}

export function TopNav({ regime, probability }: Props) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#0e0e10] flex justify-between items-center w-full px-6 py-3 max-w-[1920px] mx-auto font-['Inter'] tabular-nums text-sm antialiased">
      <div className="flex items-center gap-8">
        <span className="text-lg font-bold tracking-tighter text-[#e7e4ec]">RegimeIQ</span>
        <nav className="hidden md:flex gap-6">
          <a className="text-[#4edea3] border-b-2 border-[#4edea3] pb-1 font-semibold" href="#">Current</a>
          <a className="text-[#94a3b8] hover:text-[#e7e4ec] transition-colors" href="#">Historical</a>
          <a className="text-[#94a3b8] hover:text-[#e7e4ec] transition-colors" href="#">Forecast</a>
          <a className="text-[#94a3b8] hover:text-[#e7e4ec] transition-colors" href="#">Settings</a>
        </nav>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-primary-container px-3 py-1 rounded-lg">
          <span className="text-xs font-bold uppercase tracking-wider text-on-primary-container">Regime: {regime}</span>
          <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_rgba(78,222,163,0.6)]"></span>
        </div>
        <div className="text-xs font-medium text-on-surface-variant flex items-center gap-1">
          <span>Prob:</span>
          <span className="text-primary font-bold">{Math.round(probability * 100)}%</span>
        </div>
        <div className="h-8 w-[1px] bg-outline-variant opacity-20 mx-2"></div>
        <div className="flex items-center gap-3 text-[#94a3b8]">
          <span className="material-symbols-outlined cursor-pointer hover:text-white transition-all active:scale-95 duration-100">notifications</span>
          <span className="material-symbols-outlined cursor-pointer hover:text-white transition-all active:scale-95 duration-100">account_circle</span>
        </div>
      </div>
    </header>
  )
}
