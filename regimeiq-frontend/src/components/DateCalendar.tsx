import { useMemo, useState } from 'react'

interface DateCalendarProps {
  value: string        // 'YYYY-MM-DD'
  min?: string
  max?: string
  onChange: (date: string) => void
}

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = ['January','February','March','April','May','June',
                 'July','August','September','October','November','December']

function fmt(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function DateCalendar({ value, min, max, onChange }: DateCalendarProps) {
  const today = new Date()
  const initYear  = value ? parseInt(value.slice(0, 4))  : today.getFullYear()
  const initMonth = value ? parseInt(value.slice(5, 7)) - 1 : today.getMonth()

  const [viewYear,  setViewYear]  = useState(initYear)
  const [viewMonth, setViewMonth] = useState(initMonth)
  const [showYearPicker, setShowYearPicker] = useState(false)

  const minDate = min ?? '2006-01-01'
  const maxDate = max ?? today.toISOString().slice(0, 10)

  const minParts = minDate.split('-').map(Number)
  const maxParts = maxDate.split('-').map(Number)

  function isDisabled(y: number, m: number, d: number) {
    const s = fmt(y, m, d)
    return s < minDate || s > maxDate
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

  const canGoPrev = fmt(viewYear, viewMonth, 1) > fmt(minParts[0], minParts[1] - 1, 1)
  const canGoNext = fmt(viewYear, viewMonth, 1) < fmt(maxParts[0], maxParts[1] - 1, 1)

  const yearRange = useMemo(() => {
    const years: number[] = []
    for (let y = maxParts[0]; y >= minParts[0]; y--) years.push(y)
    return years
  }, [minDate, maxDate])

  return (
    <div className="select-none w-72" style={{ fontFamily: 'inherit' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          disabled={!canGoPrev}
          className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors disabled:opacity-20"
          style={{ background: 'rgba(255,255,255,0.05)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.10)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-on-surface-variant">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <button
          onClick={() => setShowYearPicker(v => !v)}
          className="text-sm font-bold tracking-wide text-on-surface hover:text-primary transition-colors px-2 py-1 rounded"
        >
          {MONTHS[viewMonth]} {viewYear}
        </button>

        <button
          onClick={nextMonth}
          disabled={!canGoNext}
          className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors disabled:opacity-20"
          style={{ background: 'rgba(255,255,255,0.05)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.10)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-on-surface-variant">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Year picker dropdown */}
      {showYearPicker && (
        <div className="mb-3 max-h-36 overflow-auto rounded-lg border border-outline-variant/20 grid grid-cols-4 gap-1 p-2"
          style={{ background: '#16171c' }}>
          {yearRange.map(y => (
            <button key={y}
              onClick={() => { setViewYear(y); setShowYearPicker(false) }}
              className="text-[11px] py-1 rounded transition-colors font-semibold"
              style={{
                color: y === viewYear ? '#c6ff1f' : 'rgba(255,255,255,0.55)',
                background: y === viewYear ? 'rgba(198,255,31,0.12)' : 'transparent',
              }}
            >{y}</button>
          ))}
        </div>
      )}

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-[10px] font-bold uppercase tracking-wider py-1"
            style={{ color: 'rgba(255,255,255,0.3)' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((d, i) => {
          if (d === null) return <div key={`e-${i}`} />

          const dateStr = fmt(viewYear, viewMonth, d)
          const disabled = isDisabled(viewYear, viewMonth, d)
          const selected = dateStr === value
          const isToday  = dateStr === today.toISOString().slice(0, 10)

          return (
            <button
              key={dateStr}
              disabled={disabled}
              onClick={() => !disabled && onChange(dateStr)}
              className="relative flex items-center justify-center h-8 w-full text-xs rounded-lg font-medium transition-all duration-100"
              style={{
                color: disabled
                  ? 'rgba(255,255,255,0.18)'
                  : selected
                  ? '#0d0f12'
                  : isToday
                  ? '#c6ff1f'
                  : 'rgba(255,255,255,0.75)',
                background: selected
                  ? '#c6ff1f'
                  : 'transparent',
                cursor: disabled ? 'default' : 'pointer',
              }}
              onMouseEnter={e => {
                if (!disabled && !selected)
                  e.currentTarget.style.background = 'rgba(198,255,31,0.12)'
              }}
              onMouseLeave={e => {
                if (!selected) e.currentTarget.style.background = 'transparent'
              }}
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

      {/* Footer: typed input for power users */}
      <div className="mt-4 pt-3 border-t border-outline-variant/15 flex items-center gap-2">
        <span className="text-[10px] text-on-surface-variant uppercase tracking-wider">Date</span>
        <input
          type="text"
          placeholder="YYYY-MM-DD"
          value={value}
          onChange={e => {
            const v = e.target.value
            if (/^\d{4}-\d{2}-\d{2}$/.test(v) && v >= minDate && v <= maxDate) {
              onChange(v)
              setViewYear(parseInt(v.slice(0, 4)))
              setViewMonth(parseInt(v.slice(5, 7)) - 1)
            }
          }}
          className="flex-1 bg-transparent border border-outline-variant/20 rounded px-2 py-1 text-[11px] text-on-surface focus:outline-none focus:border-primary/50 tabular-nums"
        />
      </div>
    </div>
  )
}
