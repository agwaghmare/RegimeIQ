type NavItem = {
  icon: string
  label: string
  active?: boolean
}

const navItems: NavItem[] = [
  { icon: 'dashboard', label: 'Dashboard', active: true },
  { icon: 'public', label: 'Global Macro' },
  { icon: 'warning', label: 'Risk Metrics' },
  { icon: 'pie_chart', label: 'Portfolio' },
  { icon: 'history', label: 'Archive' },
]

export function SideNav() {
  return (
    <aside className="fixed left-0 top-0 hidden md:flex flex-col h-screen w-64 bg-[#131316] py-6 space-y-2 z-40 pt-16 font-['Inter'] text-xs font-medium tracking-wide">
      <div className="px-6 mb-8 mt-4">
        <div className="text-base font-black text-[#e7e4ec] uppercase tracking-widest">Institutional Terminal</div>
        <div className="text-[10px] text-on-surface-variant opacity-60">V3.4.2</div>
      </div>
      <nav className="flex-1 space-y-1">
        {navItems.map((item) =>
          item.active ? (
            <div
              key={item.label}
              className="px-3 py-2 mx-3 bg-[#19191d] text-[#4edea3] border-r-2 border-[#4edea3] flex items-center gap-3 cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ) : (
            <div
              key={item.label}
              className="px-3 py-2 mx-3 text-[#94a3b8] hover:bg-[#19191d] hover:text-[#e7e4ec] flex items-center gap-3 cursor-pointer transition-transform duration-200 ease-in-out"
            >
              <span className="material-symbols-outlined text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </div>
          )
        )}
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
