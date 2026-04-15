import { useState } from 'react'

type NavItem = {
  icon: string
  label: string
  key: 'dashboard' | 'globalMacro' | 'playbook' | 'riskLab' | 'settings' | 'portfolio' | 'historical'
}

const navItems: NavItem[] = [
  { icon: 'dashboard', label: 'Dashboard', key: 'dashboard' },
  { icon: 'public', label: 'Global Macro', key: 'globalMacro' },
  { icon: 'strategy', label: 'Strategy Desk', key: 'playbook' },
  { icon: 'warning', label: 'Risk Lab', key: 'riskLab' },
  { icon: 'tune', label: 'Settings', key: 'settings' },
  { icon: 'pie_chart', label: 'Portfolio', key: 'portfolio' },
  { icon: 'history', label: 'Historical', key: 'historical' },
]

interface Props {
  activeView: NavItem['key'] | 'forecast' | 'dashboard'
  onSelectView: (view: NavItem['key'] | 'forecast') => void
  onExport: () => Promise<void>
}

export function SideNav({ activeView, onSelectView, onExport }: Props) {
  const [exporting, setExporting] = useState(false)

  const handleClick = (key: NavItem['key']) => {
    onSelectView(key)
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      await onExport()
    } finally {
      setExporting(false)
    }
  }

  return (
    <aside className="fixed left-0 top-0 hidden md:flex flex-col h-screen w-64 bg-[#131316] py-6 space-y-2 z-40 pt-16 font-['Inter'] text-xs font-medium tracking-wide">
      <div className="px-6 mb-8 mt-4">
        <div className="text-base font-black text-[#e7e4ec] uppercase tracking-widest">Institutional Terminal</div>
        <div className="text-[10px] text-on-surface-variant opacity-60">V3.4.2</div>
      </div>
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const isActive = item.key === activeView
          const spotlight = item.key === 'playbook' || item.key === 'riskLab'
          return (
            <button
              key={item.label}
              onClick={() => handleClick(item.key)}
              className={`w-[calc(100%-1.5rem)] text-left px-3 py-2 mx-3 flex items-center gap-3 cursor-pointer transition-transform duration-200 ease-in-out rounded ${
                isActive
                  ? 'bg-gradient-to-r from-[#181a1f] to-[#262b33] text-[#d8dde4] border-r-2 border-[#c3c9d1] ring-1 ring-primary/30'
                  : spotlight
                    ? 'text-[#c9ced6] hover:bg-[#19191d] hover:text-[#eceff3]'
                    : 'text-[#9ba3ad] hover:bg-[#19191d] hover:text-[#eceff3]'
              }`}
            >
              <span className="material-symbols-outlined text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>
      <div className="px-6 pt-4 border-t border-outline-variant/10">
        <button
          onClick={handleExport}
          disabled={exporting}
          className="w-full py-2 bg-primary text-on-primary font-bold rounded hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-sm">{exporting ? 'hourglass_empty' : 'download'}</span>
          <span>{exporting ? 'Exporting…' : 'Export Report'}</span>
        </button>
      </div>
    </aside>
  )
}
