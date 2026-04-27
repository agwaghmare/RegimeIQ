import { useState } from 'react'
import { useUser } from '../context/UserContext'
import { canAccess, type View } from '../lib/tierAccess'

type NavKey = 'dashboard' | 'learn' | 'globalMacro' | 'playbook' | 'riskLab' | 'portfolio' | 'historical'

type NavItem = {
  icon: string
  label: string
  key: NavKey
}

const navItems: NavItem[] = [
  { icon: 'dashboard', label: 'Dashboard', key: 'dashboard' },
  { icon: 'school', label: 'Learn', key: 'learn' },
  { icon: 'public', label: 'Global Macro', key: 'globalMacro' },
  { icon: 'strategy', label: 'Strategy Desk', key: 'playbook' },
  { icon: 'warning', label: 'Risk Lab', key: 'riskLab' },
  { icon: 'pie_chart', label: 'Portfolio', key: 'portfolio' },
  { icon: 'history', label: 'Historical', key: 'historical' },
]

interface Props {
  activeView: View
  onSelectView: (view: NavKey) => void
  onExport: () => Promise<void>
}

export function SideNav({ activeView, onSelectView, onExport }: Props) {
  const { user } = useUser()
  const [exporting, setExporting] = useState(false)

  const handleClick = (key: NavKey, locked: boolean) => {
    if (locked) {
      onSelectView('dashboard')
      // soft redirect — could toast "Upgrade to unlock" in a real app
      return
    }
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
      <div className="px-6 mb-4 mt-4" />
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const isActive = item.key === activeView
          const locked = !canAccess(user.plan, item.key)
          return (
            <button
              key={item.label}
              onClick={() => handleClick(item.key, locked)}
              title={locked ? 'Upgrade to Premium to unlock' : undefined}
              className={`w-[calc(100%-1.5rem)] text-left px-3 py-2 mx-3 flex items-center gap-3 transition-all duration-200 ease-in-out rounded ${
                locked
                  ? 'text-[#5a5f66] cursor-not-allowed hover:bg-transparent'
                  : isActive
                    ? 'cursor-pointer bg-gradient-to-r from-[#181a1f] to-[#262b33] text-[#d8dde4] border-r-2 border-[#c6ff1f]'
                    : 'cursor-pointer text-[#9ba3ad] hover:bg-[#19191d] hover:text-[#eceff3]'
              }`}
            >
              <span
                className="material-symbols-outlined text-lg"
                style={{ color: locked ? '#5a5f66' : isActive ? '#c6ff1f' : undefined }}
              >{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {locked && (
                <span className="material-symbols-outlined text-[14px] opacity-70">lock</span>
              )}
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
