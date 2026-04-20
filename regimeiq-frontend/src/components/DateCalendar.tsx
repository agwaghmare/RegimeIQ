import { useEffect, useMemo, useState } from 'react'

interface DateCalendarProps {
  value: string        // 'YYYY-MM-DD'
  min?: string
  max?: string
  onChange: (date: string) => void
}

type View = 'day' | 'month' | 'year'

const DAYS        = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS      = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December']
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun',
                      'Jul','Aug','Sep','Oct','Nov','Dec']

function fmt(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function fmtYM(y: number, m: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}`
}

export function DateCalendar({ value, min, max, onChange }: DateCalendarProps) {
  const today = new Date()
  const initYear  = value ? parseInt(value.slice(0, 4))  : today.getFullYear()
  const initMonth = value ? parseInt(value.slice(5, 7)) - 1 : today.getMonth()

  const [viewYear,  setViewYear]  = useState(initYear)
  const [viewMonth, setViewMonth] = useState(initMonth)
  const [view, setView]           = useState<View>('day')
  const [typedInput, setTypedInput] = useState(value)
  const [inputError, setInputError] = useState(false)

  const minDate = min ?? '2006-01-01'
  const maxDate = max ?? today.toISOString().slice(0, 10)

  const minParts = useMemo(() => minDate.split('-').map(Number), [minDate])
  const maxParts = useMemo(() => maxDate.split('-').map(Number), [maxDate])

  // Keep typed input in sync when parent value changes (e.g. clicking a day)
  useEffect(() => { setTypedInput(value) }, [value])

  function isDisabled(y: number, m: number, d: number) {
    const s = fmt(y, m, d)
    return s < minDate || s > maxDate
  }

  function isMonthDisabled(y: number, m: number) {
    const lastDay = new Date(y, m + 1, 0).getDate()
    return fmt(y, m, lastDay) < minDate || fmt(y, m, 1) > maxDate
  }

  const cells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay()
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const result: (number | null)[] = Array(firstDay).fill(null)
    for (let d = 1; d <= daysInMonth; d++) result.push(d)
    while (result.length % 7 !== 0) result.push(null)
    return result
  }, [viewYear, viewMonth])

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }
  function prevYear() { setViewYear(y => y - 1) }
  function nextYear() { setViewYear(y => y + 1) }

  const canGoPrev = view === 'day'
    ? fmt(viewYear, viewMonth, 1) > fmt(minParts[0], minParts[1] - 1, 1)
    : view === 'month'
    ? viewYear > minParts[0]
    : false
  const canGoNext = view === 'day'
    ? fmt(viewYear, viewMonth, 1) < fmt(maxParts[0], maxParts[1] - 1, 1)
    : view === 'month'
    ? viewYear < maxParts[0]
    : false

  const yearRange = useMemo(() => {
    const years: number[] = []
    for (let y = maxParts[0]; y >= minParts[0]; y--) years.push(y)
    return years
  }, [minParts, maxParts])

  function handleTypedChange(raw: string) {
    // Strip non-digits then re-insert hyphens
    let digits = raw.replace(/\D/g, '').slice(0, 8)
    let v = digits
    if (digits.length > 4) v = digits.slice(0, 4) + '-' + digits.slice(4)
    if (digits.length > 6) v = digits.slice(0, 4) + '-' + digits.slice(4, 6) + '-' + digits.slice(6)
    setTypedInput(v)

    // Navigate calendar as user types
    if (digits.length >= 4) {
      const y = parseInt(digits.slice(0, 4))
      if (y >= minParts[0] && y <= maxParts[0]) setViewYear(y)
    }
    if (digits.length >= 6) {
      const m = parseInt(digits.slice(4, 6)) - 1
      if (m >= 0 && m <= 11) setViewMonth(m)
    }

    // Fire onChange only on a fully valid date
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      if (v >= minDate && v <= maxDate) {
        onChange(v)
        setInputError(false)
      } else {
        setInputError(true)
      }
    } else {
      setInputError(false)
    }
  }

  // ── Shared nav arrow ────────────────────────────────────────────────
  const NavArrow = ({ dir, disabled, onClick }: { dir: 'left'|'right'; disabled: boolean; onClick: () => void }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors disabled:opacity-20"
      style={{ background: 'rgba(255,255,255,0.05)' }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = 'rgba(255,255,255,0.10)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round" className="text-on-surface-variant">
        {dir === 'left'
          ? <polyline points="15 18 9 12 15 6" />
          : <polyline points="9 18 15 12 9 6" />}
      </svg>
    </button>
  )

  const todayStr = today.toISOString().slice(0, 10)

  return (
    <div className="select-none w-72" style={{ fontFamily: 'inherit' }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <NavArrow dir="left"  disabled={!canGoPrev} onClick={view === 'day' ? prevMonth : prevYear} />

        <div className="flex items-center gap-1">
          {view === 'day' && (
            <>
              {/* Month label → goes to month picker */}
              <button
                onClick={() => setView('month')}
                className="text-sm font-bold tracking-wide px-2 py-1 rounded transition-colors"
                style={{ color: 'rgba(255,255,255,0.9)' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#c6ff1f' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.9)' }}
              >
                {MONTHS[viewMonth]}
              </button>
              <span className="text-on-surface-variant opacity-30 text-xs">·</span>
              {/* Year label → goes to year picker via month view */}
              <button
                onClick={() => setView('year')}
                className="text-sm font-bold tracking-wide px-2 py-1 rounded transition-colors"
                style={{ color: 'rgba(255,255,255,0.9)' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#c6ff1f' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.9)' }}
              >
                {viewYear}
              </button>
            </>
          )}

          {view === 'month' && (
            <button
              onClick={() => setView('year')}
              className="text-sm font-bold tracking-wide px-2 py-1 rounded transition-colors"
              style={{ color: '#c6ff1f' }}
            >
              {viewYear}
            </button>
          )}

          {view === 'year' && (
            <span className="text-sm font-bold tracking-wide text-on-surface-variant px-2">
              {minParts[0]} — {maxParts[0]}
            </span>
          )}
        </div>

        <NavArrow dir="right" disabled={!canGoNext} onClick={view === 'day' ? nextMonth : nextYear} />
      </div>

      {/* ── Year view ──────────────────────────────────────────────── */}
      {view === 'year' && (
        <div className="grid grid-cols-4 gap-1.5 max-h-52 overflow-auto pr-0.5 mb-1">
          {yearRange.map(y => {
            const isSelected = value && parseInt(value.slice(0, 4)) === y
            const isCurrent  = y === today.getFullYear()
            return (
              <button key={y}
                onClick={() => { setViewYear(y); setView('month') }}
                className="py-2 rounded-lg text-[11px] font-semibold transition-all duration-100"
                style={{
                  background: isSelected
                    ? '#c6ff1f'
                    : y === viewYear
                    ? 'rgba(198,255,31,0.10)'
                    : 'rgba(255,255,255,0.04)',
                  color: isSelected
                    ? '#0d0f12'
                    : isCurrent
                    ? '#c6ff1f'
                    : y === viewYear
                    ? 'rgba(255,255,255,0.9)'
                    : 'rgba(255,255,255,0.55)',
                  border: isCurrent && !isSelected ? '1px solid rgba(198,255,31,0.25)' : '1px solid transparent',
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(198,255,31,0.12)' }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = y === viewYear ? 'rgba(198,255,31,0.10)' : 'rgba(255,255,255,0.04)' }}
              >
                {y}
              </button>
            )
          })}
        </div>
      )}

      {/* ── Month view ─────────────────────────────────────────────── */}
      {view === 'month' && (
        <div className="grid grid-cols-3 gap-2 mb-1">
          {MONTHS_SHORT.map((label, i) => {
            const disabled  = isMonthDisabled(viewYear, i)
            const isSelected = value
              && parseInt(value.slice(0, 4)) === viewYear
              && parseInt(value.slice(5, 7)) - 1 === i
            const isCurrent = i === today.getMonth() && viewYear === today.getFullYear()
            return (
              <button key={label}
                disabled={disabled}
                onClick={() => { setViewMonth(i); setView('day') }}
                className="py-2.5 rounded-lg text-[11px] font-semibold transition-all duration-100 disabled:opacity-25 disabled:cursor-default"
                style={{
                  background: isSelected
                    ? '#c6ff1f'
                    : i === viewMonth
                    ? 'rgba(198,255,31,0.10)'
                    : 'rgba(255,255,255,0.04)',
                  color: isSelected
                    ? '#0d0f12'
                    : isCurrent
                    ? '#c6ff1f'
                    : i === viewMonth
                    ? 'rgba(255,255,255,0.9)'
                    : 'rgba(255,255,255,0.55)',
                  border: isCurrent && !isSelected ? '1px solid rgba(198,255,31,0.25)' : '1px solid transparent',
                }}
                onMouseEnter={e => { if (!disabled && !isSelected) e.currentTarget.style.background = 'rgba(198,255,31,0.12)' }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = i === viewMonth ? 'rgba(198,255,31,0.10)' : 'rgba(255,255,255,0.04)' }}
              >
                {label}
              </button>
            )
          })}
        </div>
      )}

      {/* ── Day view ───────────────────────────────────────────────── */}
      {view === 'day' && (
        <>
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map(d => (
              <div key={d} className="text-center text-[10px] font-bold uppercase tracking-wider py-1"
                style={{ color: 'rgba(255,255,255,0.3)' }}>
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-0.5">
            {cells.map((d, i) => {
              if (d === null) return <div key={`e-${i}`} />
              const dateStr  = fmt(viewYear, viewMonth, d)
              const disabled = isDisabled(viewYear, viewMonth, d)
              const selected = dateStr === value
              const isToday  = dateStr === todayStr
              return (
                <button
                  key={dateStr}
                  disabled={disabled}
                  onClick={() => !disabled && onChange(dateStr)}
                  className="relative flex items-center justify-center h-8 w-full text-xs rounded-lg font-medium transition-all duration-100"
                  style={{
                    color: disabled ? 'rgba(255,255,255,0.18)'
                      : selected ? '#0d0f12'
                      : isToday  ? '#c6ff1f'
                      : 'rgba(255,255,255,0.75)',
                    background: selected ? '#c6ff1f' : 'transparent',
                    cursor: disabled ? 'default' : 'pointer',
                  }}
                  onMouseEnter={e => { if (!disabled && !selected) e.currentTarget.style.background = 'rgba(198,255,31,0.12)' }}
                  onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent' }}
                >
                  {d}
                  {isToday && !selected && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                      style={{ background: '#c6ff1f' }} />
                  )}
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* ── Type-in input ───────────────────────────────────────────── */}
      <div className="mt-4 pt-3 border-t border-outline-variant/15">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-on-surface-variant shrink-0" style={{ fontSize: 14 }}>edit_calendar</span>
          <input
            type="text"
            placeholder="YYYY-MM-DD"
            value={typedInput}
            onChange={e => handleTypedChange(e.target.value)}
            maxLength={10}
            spellCheck={false}
            className="flex-1 bg-transparent rounded px-2 py-1 text-[11px] text-on-surface focus:outline-none tabular-nums transition-colors"
            style={{
              border: inputError
                ? '1px solid rgba(239,68,68,0.6)'
                : '1px solid rgba(255,255,255,0.12)',
            }}
            onFocus={e => {
              if (!inputError) e.currentTarget.style.border = '1px solid rgba(198,255,31,0.45)'
            }}
            onBlur={e => {
              if (!inputError) e.currentTarget.style.border = '1px solid rgba(255,255,255,0.12)'
            }}
          />
          {inputError && (
            <span className="text-[9px] text-red-400 shrink-0">out of range</span>
          )}
        </div>
        {!inputError && typedInput.length > 0 && typedInput.length < 10 && (
          <p className="text-[9px] mt-1 pl-6" style={{ color: 'rgba(255,255,255,0.28)' }}>
            type full date to jump
          </p>
        )}
      </div>
    </div>
  )
}
