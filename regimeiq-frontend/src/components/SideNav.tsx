type NavItem = {
  icon: string
  label: string
  key: 'dashboard' | 'globalMacro' | 'riskMetrics' | 'portfolio' | 'archive'
}

const navItems: NavItem[] = [
  { icon: 'dashboard', label: 'Dashboard', key: 'dashboard' },
  { icon: 'public', label: 'Global Macro', key: 'globalMacro' },
  { icon: 'warning', label: 'Risk Metrics', key: 'riskMetrics' },
  { icon: 'pie_chart', label: 'Portfolio', key: 'portfolio' },
  { icon: 'history', label: 'Archive', key: 'archive' },
]

interface Props {
  activeView: 'dashboard' | 'globalMacro'
  onSelectView: (view: 'dashboard' | 'globalMacro') => void
}

export function SideNav({ activeView, onSelectView }: Props) {
  const handleClick = (key: NavItem['key']) => {
    if (key === 'dashboard' || key === 'globalMacro') {
      onSelectView(key)
      return
    }
    const idMap: Record<'riskMetrics' | 'portfolio' | 'archive', string> = {
      riskMetrics: 'risk-metrics',
      portfolio: 'portfolio',
      archive: 'archive',
    }
    onSelectView('dashboard')
    window.setTimeout(() => {
      const el = document.getElementById(idMap[key as 'riskMetrics' | 'portfolio' | 'archive'])
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
  }

  return (
    <aside className="fixed left-0 top-0 hidden md:flex flex-col h-screen w-64 bg-[#131316] py-6 space-y-2 z-40 pt-16 font-['Inter'] text-xs font-medium tracking-wide">
      <div className="px-6 mb-8 mt-4">
        <div className="text-base font-black text-[#e7e4ec] uppercase tracking-widest">Institutional Terminal</div>
        <div className="text-[10px] text-on-surface-variant opacity-60">V3.4.2</div>
      </div>
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const isActive =
            (item.key === 'dashboard' && activeView === 'dashboard') ||
            (item.key === 'globalMacro' && activeView === 'globalMacro')
          return (
            <button
              key={item.label}
              onClick={() => handleClick(item.key)}
              className={`w-[calc(100%-1.5rem)] text-left px-3 py-2 mx-3 flex items-center gap-3 cursor-pointer transition-transform duration-200 ease-in-out ${
                isActive
                  ? 'bg-[#19191d] text-[#4edea3] border-r-2 border-[#4edea3]'
                  : 'text-[#94a3b8] hover:bg-[#19191d] hover:text-[#e7e4ec]'
              }`}
            >
              <span className="material-symbols-outlined text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>
      <div className="px-6 pt-4 border-t border-outline-variant/10">
        <button className="w-full py-2 bg-primary text-on-primary font-bold rounded hover:opacity-90 transition-all flex items-center justify-center gap-2">
          <span className="material-symbols-outlined text-sm">download</span>
          <span>Export Report</span>
        </button>
      </div>
      <div className="px-6 py-4 space-y-3">
        <div className="flex items-center gap-3 text-[#94a3b8] hover:text-[#e7e4ec] cursor-pointer">
          <span className="material-symbols-outlined text-lg">help</span>
          <span>Support</span>
        </div>
        <div className="flex items-center gap-3 text-[#94a3b8] hover:text-[#e7e4ec] cursor-pointer">
          <span className="material-symbols-outlined text-lg">code</span>
          <span>API</span>
        </div>
      </div>
    </aside>
  )
}
