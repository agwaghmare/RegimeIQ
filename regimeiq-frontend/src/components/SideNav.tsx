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
  activeView: NavItem['key']
  onSelectView: (view: NavItem['key']) => void
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
      <div className="px-6 mb-8 mt-4" />
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const isActive = item.key === activeView
          return (
            <button
              key={item.label}
              onClick={() => handleClick(item.key)}
                className="w-[calc(100%-1.5rem)] text-left px-3 py-2 mx-3 flex items-center gap-3 cursor-pointer transition-colors duration-200 ease-in-out rounded outline-none focus-visible:ring-1 focus-visible:ring-white/20"
              style={
                isActive
                  ? {
                      background: 'linear-gradient(90deg, rgba(198,255,31,0.07) 0%, rgba(198,255,31,0.02) 100%)',
                      borderLeft: '2px solid var(--accent)',
                      color: '#ffffff',
                    }
                  : {
                      borderLeft: '2px solid transparent',
                      color: 'var(--color-muted)',
                    }
              }
              onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = '#eceff3' } }}
              onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-muted)' } }}
            >
              <span
                className="material-symbols-outlined text-lg"
                style={isActive ? { color: 'var(--accent)' } : {}}
              >{item.icon}</span>
              <span>{item.label}</span>
              {isActive && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
              )}
            </button>
          )
        })}
      </nav>
      <div className="px-6 pt-4 border-t border-outline-variant/10">
        <button
          onClick={handleExport}
          disabled={exporting}
          className="w-full py-2 font-bold rounded transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110"
          style={{ background: exporting ? 'rgba(255,255,255,0.08)' : 'var(--accent)', color: exporting ? '#9ca3af' : '#000000' }}
        >
          <span className="material-symbols-outlined text-sm">{exporting ? 'hourglass_empty' : 'download'}</span>
          <span>{exporting ? 'Exporting…' : 'Export Report'}</span>
        </button>
      </div>
    </aside>
  )
}
