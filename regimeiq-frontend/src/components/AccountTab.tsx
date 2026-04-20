import { useUser } from '../context/UserContext'
import { TIER_LABEL } from '../lib/tierAccess'

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

export function AccountTab() {
  const { user } = useUser()
  const priceLabel = user.billingCycle === 'annual'
    ? user.plan === 'premium' ? '$200 / year'
      : user.plan === 'basic' ? '$100 / year'
        : '$0'
    : user.plan === 'premium' ? '$20 / month'
      : user.plan === 'basic' ? '$10 / month'
        : '$0'

  return (
    <main className="ml-0 md:ml-64 pt-20 p-6 min-h-screen space-y-6">
      <header>
        <div className="text-xs uppercase tracking-[0.18em] text-on-surface-variant mb-1">Account</div>
        <h1 className="text-3xl font-black tracking-tight">Account Information</h1>
      </header>

      {/* Header / Identity card */}
      <section className="bg-surface-container rounded-xl p-6 border border-outline-variant/20 flex items-center gap-5">
        <div className="h-16 w-16 rounded-full bg-surface-container-high text-on-surface text-xl font-black flex items-center justify-center ring-1 ring-primary/30">
          {user.avatarInitials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xl font-bold text-on-surface">{user.name}</div>
          <div className="text-xs text-on-surface-variant">{user.email}</div>
          <div className="text-[11px] text-on-surface-variant mt-1">
            Member since {formatDate(user.memberSince)}
          </div>
        </div>
        <span
          className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full"
          style={{ backgroundColor: 'rgba(255,132,57,0.18)', color: '#ff8439' }}
        >
          {TIER_LABEL[user.plan]}
        </span>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile card */}
        <section className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
          <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4">Profile</h3>
          <dl className="space-y-3 text-sm">
            <Row label="Role" value={user.role} />
            <Row label="Firm" value={user.firm} />
            <Row label="Location" value={user.location} />
            <Row label="Phone" value={user.phone} />
            <Row
              label="2FA"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: user.twoFactor ? '#22c55e' : '#ee7d77' }}
                  />
                  <span>{user.twoFactor ? 'Enabled' : 'Disabled'}</span>
                </span>
              }
            />
          </dl>
        </section>

        {/* Subscription card */}
        <section className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
          <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4">Subscription</h3>
          <div className="flex items-center gap-3 mb-4">
            <span
              className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full"
              style={{ backgroundColor: 'rgba(255,132,57,0.18)', color: '#ff8439' }}
            >
              {TIER_LABEL[user.plan]}
            </span>
            <span className="text-xs text-on-surface-variant capitalize">{user.billingCycle}</span>
          </div>
          <dl className="space-y-3 text-sm">
            <Row label="Price" value={priceLabel} />
            <Row label="Next renewal" value={formatDate(user.nextRenewal)} />
            <Row label="Payment" value="Visa ending 4218" />
          </dl>
          <button
            onClick={() => { /* non-functional demo button */ }}
            className="mt-5 w-full py-2 bg-primary text-on-primary text-xs font-bold rounded hover:opacity-90 transition-all"
          >
            Manage Billing
          </button>
        </section>
      </div>

      {/* Usage card */}
      <section className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
        <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4">Usage</h3>
        <div className="grid grid-cols-3 gap-5">
          <Stat label="API calls (this month)" value={`${user.usage.apiCallsThisMonth.toLocaleString()} / ∞`} />
          <Stat label="Alerts configured" value={`${user.usage.alertsConfigured}`} />
          <Stat label="Watchlists" value={`${user.usage.watchlistsConfigured}`} />
        </div>
      </section>
    </main>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-xs uppercase tracking-wider text-on-surface-variant">{label}</dt>
      <dd className="text-sm font-medium text-on-surface tabular-nums">{value}</dd>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-2xl font-black tabular-nums text-on-surface">{value}</div>
      <div className="text-[11px] text-on-surface-variant mt-1">{label}</div>
    </div>
  )
}
