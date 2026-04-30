import { useState } from 'react'
import { useUser } from '../context/UserContext'
import type { SubscriptionTier } from '../context/UserContext'

type Cycle = 'monthly' | 'annual'

interface Tier {
  id: SubscriptionTier
  name: string
  tagline: string
  monthly: number
  annual: number
  highlight?: boolean
}

const TIERS: Tier[] = [
  { id: 'free', name: 'Free', tagline: 'Get a feel for the regime', monthly: 0, annual: 0 },
  { id: 'basic', name: 'Basic', tagline: 'Daily terminal for active users', monthly: 10, annual: 100, highlight: true },
  { id: 'premium', name: 'Premium', tagline: 'Full forecasting + history', monthly: 20, annual: 200 },
]

type FeatureRow = {
  label: string
  values: Record<SubscriptionTier, boolean | string>
  emphasize?: boolean
}

const FEATURES: FeatureRow[] = [
  { label: 'Main Dashboard', values: { free: true, basic: true, premium: true } },
  { label: 'Global Macro', values: { free: false, basic: true, premium: true } },
  { label: 'Strategy Desk', values: { free: false, basic: true, premium: true } },
  { label: 'Risk Lab', values: { free: false, basic: true, premium: true } },
  { label: 'Portfolio', values: { free: false, basic: true, premium: true } },
  { label: 'User Preferences', values: { free: false, basic: true, premium: true } },
  { label: 'Forecast Tab', values: { free: false, basic: false, premium: true }, emphasize: true },
  { label: 'Historical Data', values: { free: false, basic: false, premium: true }, emphasize: true },
  { label: 'Priority support', values: { free: false, basic: false, premium: true } },
]

function priceLabel(tier: Tier, cycle: Cycle): string {
  if (tier.monthly === 0 && tier.annual === 0) return '$0'
  if (cycle === 'monthly') return `$${tier.monthly}/mo`
  return `$${tier.annual}/yr`
}

function subPriceLabel(tier: Tier, cycle: Cycle): string {
  if (tier.monthly === 0 && tier.annual === 0) return 'Free forever'
  if (cycle === 'monthly') return `or $${tier.annual}/yr`
  return `or $${tier.monthly}/mo`
}

export function PricingTab() {
  const { user } = useUser()
  const [cycle, setCycle] = useState<Cycle>('annual')

  return (
    <main className="ml-0 md:ml-64 pt-20 p-6 min-h-screen space-y-6">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-on-surface-variant mb-1">Pricing</div>
          <h1 className="text-3xl font-black tracking-tight">Choose your plan</h1>
          <p className="text-sm text-on-surface-variant mt-1 max-w-xl">
            Upgrade to Premium for the Forecast Tab and full historical regime data.
          </p>
        </div>
        <div className="inline-flex items-center bg-surface-container rounded-full border border-outline-variant/20 p-1">
          {(['monthly', 'annual'] as Cycle[]).map((c) => (
            <button
              key={c}
              onClick={() => setCycle(c)}
              className={`px-4 py-1.5 text-xs font-bold uppercase tracking-widest rounded-full transition-all ${
                cycle === c
                  ? 'bg-primary text-on-primary'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </header>

      {/* Plan cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {TIERS.map((tier) => {
          const isCurrent = user.plan === tier.id
          const tierOrder: Record<string, number> = { free: 0, basic: 1, premium: 2 }
          const isDowngrade = !isCurrent && (tierOrder[tier.id] ?? 0) < (tierOrder[user.plan] ?? 0)
          return (
            <div
              key={tier.id}
              className={`relative rounded-xl p-6 border ${
                tier.highlight
                  ? 'bg-surface-container-high border-transparent ring-1 ring-[#ff8439]/60'
                  : 'bg-surface-container border-outline-variant/20'
              }`}
            >
              {tier.highlight && (
                <span
                  className="absolute -top-2.5 left-6 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: '#ff8439', color: '#0e0e10' }}
                >
                  Most Popular
                </span>
              )}
              <div className="flex items-baseline justify-between mb-2">
                <h3 className="text-lg font-black text-on-surface">{tier.name}</h3>
                {isCurrent && (
                  <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                    Current
                  </span>
                )}
              </div>
              <p className="text-xs text-on-surface-variant mb-4">{tier.tagline}</p>
              <div className="mb-5">
                <div className="text-4xl font-black tabular-nums text-on-surface">
                  {priceLabel(tier, cycle)}
                </div>
                <div className="text-[11px] text-on-surface-variant mt-1">{subPriceLabel(tier, cycle)}</div>
              </div>
              <button
                disabled={isCurrent}
                onClick={() => { /* non-functional demo */ }}
                className={`w-full py-2 text-xs font-bold uppercase tracking-widest rounded transition-all ${
                  isCurrent
                    ? 'bg-surface-container-highest text-on-surface-variant cursor-not-allowed'
                    : tier.highlight
                      ? 'bg-[#ff8439] text-[#0e0e10] hover:opacity-90'
                      : 'bg-primary text-on-primary hover:opacity-90'
                }`}
              >
                {isCurrent ? 'Current Plan' : isDowngrade ? 'Downgrade' : 'Upgrade'}
              </button>
            </div>
          )
        })}
      </section>

      {/* Comparison table */}
      <section className="bg-surface-container rounded-xl p-5 border border-outline-variant/20 overflow-hidden">
        <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4">
          Feature comparison
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/15">
                <th className="text-left text-[11px] uppercase tracking-widest text-on-surface-variant font-semibold py-3 pr-4 w-[40%]">
                  Feature
                </th>
                {TIERS.map((t) => (
                  <th
                    key={t.id}
                    className={`text-center text-[11px] uppercase tracking-widest font-bold py-3 px-4 ${
                      t.highlight ? 'text-[#ff8439]' : 'text-on-surface-variant'
                    }`}
                  >
                    {t.name}
                  </th>
                ))}
              </tr>
              <tr className="border-b border-outline-variant/10">
                <td className="py-3 pr-4 text-xs uppercase tracking-wider text-on-surface-variant">Price</td>
                {TIERS.map((t) => (
                  <td
                    key={t.id}
                    className={`text-center py-3 px-4 font-bold tabular-nums ${
                      t.highlight ? 'text-on-surface' : 'text-on-surface'
                    }`}
                  >
                    {priceLabel(t, cycle)}
                    <div className="text-[10px] font-normal text-on-surface-variant mt-0.5">
                      {subPriceLabel(t, cycle)}
                    </div>
                  </td>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((row) => (
                <tr key={row.label} className="border-b border-outline-variant/5 last:border-0">
                  <td
                    className={`py-3 pr-4 text-sm ${
                      row.emphasize ? 'font-bold text-on-surface' : 'text-on-surface'
                    }`}
                  >
                    {row.label}
                  </td>
                  {TIERS.map((t) => {
                    const v = row.values[t.id]
                    return (
                      <td
                        key={t.id}
                        className={`text-center py-3 px-4 ${
                          t.highlight ? 'bg-surface-container-high/50' : ''
                        }`}
                      >
                        {v === true ? (
                          <span
                            className="material-symbols-outlined text-lg"
                            style={{ color: '#22c55e' }}
                          >
                            check
                          </span>
                        ) : v === false ? (
                          <span className="text-on-surface-variant opacity-40">—</span>
                        ) : (
                          <span className="text-xs text-on-surface">{v}</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
