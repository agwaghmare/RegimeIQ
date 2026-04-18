import { useEffect, useRef, useState } from 'react'
import { useUser } from '../context/UserContext'
import { TIER_LABEL } from '../lib/tierAccess'

type MenuView = 'preferences' | 'account' | 'pricing'

interface Props {
  onSelect: (view: MenuView) => void
}

const TIER_BADGE_STYLE: Record<string, { bg: string; fg: string }> = {
  free: { bg: 'rgba(172,170,177,0.18)', fg: '#acaab1' },
  basic: { bg: 'rgba(195,201,209,0.18)', fg: '#c3c9d1' },
  premium: { bg: 'rgba(255,132,57,0.18)', fg: '#ff8439' },
}

export function UserMenu({ onSelect }: Props) {
  const { user } = useUser()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current) return
      if (!rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const items: { key: MenuView; label: string; icon: string }[] = [
    { key: 'preferences', label: 'User Preferences', icon: 'tune' },
    { key: 'account', label: 'Account', icon: 'person' },
    { key: 'pricing', label: 'Pricing', icon: 'workspace_premium' },
  ]

  const badge = TIER_BADGE_STYLE[user.plan] ?? TIER_BADGE_STYLE.free

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="h-8 w-8 rounded-full bg-surface-container-high text-on-surface text-[11px] font-bold flex items-center justify-center ring-1 ring-primary/30 hover:ring-primary/60 transition-all active:scale-95"
        title={`${user.name} · ${TIER_LABEL[user.plan]}`}
      >
        {user.avatarInitials}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] w-64 bg-surface-container border border-outline-variant/20 rounded-xl shadow-[0_18px_44px_rgba(0,0,0,0.44)] overflow-hidden z-[60]"
        >
          <div className="px-4 py-3 border-b border-outline-variant/10 flex items-center gap-3">
            <div
              className="h-9 w-9 rounded-full bg-surface-container-high text-on-surface text-[11px] font-bold flex items-center justify-center ring-1 ring-primary/30"
            >
              {user.avatarInitials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-on-surface truncate">{user.name}</div>
              <div className="text-[10px] text-on-surface-variant truncate">{user.email}</div>
            </div>
            <span
              className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={{ backgroundColor: badge.bg, color: badge.fg }}
            >
              {TIER_LABEL[user.plan]}
            </span>
          </div>
          <div className="py-1">
            {items.map((it) => (
              <button
                key={it.key}
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  onSelect(it.key)
                }}
                className="w-full flex items-center gap-3 px-4 py-2 text-xs text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors text-left"
              >
                <span className="material-symbols-outlined text-base">{it.icon}</span>
                <span className="font-medium">{it.label}</span>
              </button>
            ))}
          </div>
          <div className="border-t border-outline-variant/10 py-1">
            <button
              role="menuitem"
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-3 px-4 py-2 text-xs text-on-surface-variant hover:bg-surface-container-high hover:text-error transition-colors text-left"
            >
              <span className="material-symbols-outlined text-base">logout</span>
              <span className="font-medium">Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
