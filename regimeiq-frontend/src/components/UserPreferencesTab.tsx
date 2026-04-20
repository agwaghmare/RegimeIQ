import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { SETTINGS_STORAGE_KEY, loadUserSettings } from '../lib/userSettings'
import type { NewsPayload, RebalancePlan, RiskTolerance } from '../types/regime'

const NEWS_OPTIONS = ['inflation', 'fed', 'recession', 'oil', 'gold', 'technology', 'geopolitics', 'crypto']

type SettingsState = {
  riskTolerance: RiskTolerance
  newsTopics: string[]
  alerts: {
    regimeShift: boolean
    vixSpike: boolean
    creditStress: boolean
  }
  modelBehavior: {
    sensitivity: 'low' | 'medium' | 'high'
    rebalanceFrequency: 'weekly' | 'monthly' | 'quarterly'
  }
}

const RISK_ORDER: RiskTolerance[] = ['conservative', 'moderate', 'aggressive']
const RISK_INDEX: Record<RiskTolerance, number> = { conservative: 0, moderate: 1, aggressive: 2 }

function macroRelevant(article: { title: string; description?: string | null; source: string }): boolean {
  const text = `${article.title} ${article.description ?? ''} ${article.source}`.toLowerCase()
  const keys = [
    'inflation', 'fed', 'federal reserve', 'rates', 'yield', 'macro', 'economy',
    'recession', 'gdp', 'labor', 'unemployment', 'vix', 'credit', 'dollar', 'treasury',
    'central bank', 'ecb', 'boj', 'liquidity', 'policy',
  ]
  return keys.some((k) => text.includes(k))
}

export function UserPreferencesTab() {
  const [settings, setSettings] = useState<SettingsState>(() => {
    const base = loadUserSettings()
    return {
      ...base,
      alerts: {
        regimeShift: true,
        vixSpike: true,
        creditStress: false,
      },
      modelBehavior: {
        sensitivity: 'medium',
        rebalanceFrequency: 'monthly',
      },
    }
  })
  const [plan, setPlan] = useState<RebalancePlan | null>(null)
  const [news, setNews] = useState<NewsPayload | null>(null)
  const [loadingPlan, setLoadingPlan] = useState(false)
  const [loadingNews, setLoadingNews] = useState(false)
  const [planError, setPlanError] = useState<string | null>(null)
  const [newsError, setNewsError] = useState<string | null>(null)

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    window.dispatchEvent(new Event('regimeiq-settings'))
  }, [settings.riskTolerance])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoadingPlan(true)
      setPlanError(null)
      try {
        const rebalance = await api.getRebalancePlan(settings.riskTolerance)
        if (!cancelled) setPlan(rebalance)
      } catch (e) {
        if (!cancelled) setPlanError((e as Error).message)
      } finally {
        if (!cancelled) setLoadingPlan(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [settings.riskTolerance])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoadingNews(true)
      setNewsError(null)
      try {
        const newsPayload = await api.getNews(settings.newsTopics)
        if (!cancelled) setNews(newsPayload)
      } catch (e) {
        if (!cancelled) setNewsError((e as Error).message)
      } finally {
        if (!cancelled) setLoadingNews(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [settings.newsTopics])

  const topNews = useMemo(
    () => (news?.articles ?? []).filter((a) => macroRelevant(a)).slice(0, 6),
    [news]
  )

  const currentRiskIdx = RISK_INDEX[settings.riskTolerance]
  const currentWeights = plan?.bucket_weights
  const riskTemplate = {
    conservative: { equities: 0.35, bonds: 0.5, commodities: 0.15 },
    moderate: { equities: 0.55, bonds: 0.35, commodities: 0.1 },
    aggressive: { equities: 0.7, bonds: 0.2, commodities: 0.1 },
  } as const
  const selectedTemplate = riskTemplate[settings.riskTolerance]

  const rebalanceGroups = useMemo(() => {
    const holds = plan?.model_portfolio ?? []
    const increase = holds.slice(0, 2).map((h) => `${h.ticker} (+ target ${Math.round(h.target_weight * 100)}%)`)
    const reduce = holds.slice(-2).map((h) => `${h.ticker} (trim below ${Math.round(h.target_weight * 100)}%)`)
    const maintain = holds.slice(2, 4).map((h) => `${h.ticker} (hold core weight)`)
    return { increase, reduce, maintain }
  }, [plan?.model_portfolio])

  const toggleTopic = (topic: string) => {
    setSettings((prev) => {
      const exists = prev.newsTopics.includes(topic)
      return {
        ...prev,
        newsTopics: exists ? prev.newsTopics.filter((t) => t !== topic) : [...prev.newsTopics, topic],
      }
    })
  }

  return (
    <section className="ml-0 md:ml-64 pt-20 p-6 min-h-screen space-y-6">
      <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
        <h2 className="text-sm font-black uppercase tracking-widest text-primary mb-2">User Profile</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="rounded-lg bg-surface-container-high p-3 border border-outline-variant/20">
            <div className="text-on-surface-variant">Profile</div>
            <div className="font-semibold mt-1">Institutional Macro Investor</div>
          </div>
          <div className="rounded-lg bg-surface-container-high p-3 border border-outline-variant/20">
            <div className="text-on-surface-variant">Risk Preference</div>
            <div className="font-semibold mt-1 capitalize">{settings.riskTolerance}</div>
          </div>
          <div className="rounded-lg bg-surface-container-high p-3 border border-outline-variant/20">
            <div className="text-on-surface-variant">Control Mode</div>
            <div className="font-semibold mt-1">Personalization + Alerts</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20 space-y-4">
          <div className="text-xs uppercase tracking-widest text-on-surface-variant">Risk Preference</div>
          <div className="relative h-2 rounded-full bg-surface-container-highest overflow-hidden">
            {/* filled portion only up to current position */}
            <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-300" style={{
              width: `${((currentRiskIdx + 1) / 3) * 100}%`,
              background: 'linear-gradient(90deg, hsla(94,100%,70%,1) 0%, hsla(0,100%,77%,1) 100%)',
            }} />
            <input
              type="range"
              min={0}
              max={2}
              step={1}
              value={currentRiskIdx}
              onChange={(e) => {
                const idx = Number(e.target.value)
                const picked = RISK_ORDER[idx] ?? 'moderate'
                setSettings((prev) => ({ ...prev, riskTolerance: picked }))
              }}
              className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
              style={{ zIndex: 2 }}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {RISK_ORDER.map((r) => {
              const active = settings.riskTolerance === r
              return (
                <button
                  key={r}
                  onClick={() => setSettings((prev) => ({ ...prev, riskTolerance: r }))}
                  className={`flex items-center gap-2 px-2 py-2 rounded text-[11px] uppercase tracking-wider border ${
                    active ? 'bg-primary/15 border-primary/40 text-on-surface' : 'bg-surface-container-high border-outline-variant/20 text-on-surface-variant'
                  }`}
                >
                  <span className={`h-4 w-4 rounded border flex items-center justify-center ${active ? 'border-primary bg-primary/20' : 'border-outline-variant/40'}`}>
                    {active ? '✓' : ''}
                  </span>
                  <span>{r}</span>
                </button>
              )
            })}
          </div>
          <div className="text-[11px] text-on-surface-variant">Use slider + checkbox marks to set how aggressive your allocation engine should be.</div>

          <div className="pt-3">
            <div className="text-xs uppercase tracking-widest text-on-surface-variant mb-2">News Preferences</div>
            <div className="flex flex-wrap gap-2">
              {NEWS_OPTIONS.map((topic) => {
                const active = settings.newsTopics.includes(topic)
                return (
                  <button
                    key={topic}
                    onClick={() => toggleTopic(topic)}
                    className={`px-2 py-1 rounded text-[11px] ${
                      active ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-[#1b1c22] text-on-surface-variant'
                    }`}
                  >
                    {topic}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
          <div className="text-xs uppercase tracking-widest text-on-surface-variant mb-3">Allocation Impact</div>
          <div className="space-y-2 text-xs mb-4">
            {[
              { k: 'Equities',    v: (currentWeights?.equities   ?? selectedTemplate.equities)   * 100, color: '#3b82f6' },
              { k: 'Bonds',       v: (currentWeights?.bonds       ?? selectedTemplate.bonds)       * 100, color: '#22c55e' },
              { k: 'Commodities', v: (currentWeights?.commodities ?? selectedTemplate.commodities) * 100, color: '#f59e0b' },
            ].map((row) => (
              <div key={row.k}>
                <div className="flex justify-between mb-1"><span>{row.k}</span><span style={{ color: row.color }}>{Math.round(row.v)}%</span></div>
                <div className="h-2 rounded bg-surface-container-highest overflow-hidden">
                  <div className="h-full" style={{ width: `${row.v}%`, backgroundColor: row.color }}></div>
                </div>
              </div>
            ))}
          </div>
          <div className="text-[11px] text-on-surface-variant border-t border-outline-variant/20 pt-3">
            If risk increases: equities tilt up, duration/bonds typically reduced, hedges stay strategic.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
          <div className="text-xs uppercase tracking-widest text-on-surface-variant mb-3">Structured Rebalance Plan</div>
          {loadingPlan ? (
            <div className="text-xs text-on-surface-variant">Updating plan...</div>
          ) : planError ? (
            <div className="text-xs text-error">{planError}</div>
          ) : (
            <div className="space-y-3 text-xs">
              <div className="rounded-lg border border-outline-variant/20 bg-surface-container-high p-3">
                <div className="text-on-surface-variant mb-1 uppercase text-[10px]">Increase</div>
                <div className="space-y-1">{(rebalanceGroups.increase.length ? rebalanceGroups.increase : ['No increase call']).map((r) => <div key={r}>{r}</div>)}</div>
              </div>
              <div className="rounded-lg border border-outline-variant/20 bg-surface-container-high p-3">
                <div className="text-on-surface-variant mb-1 uppercase text-[10px]">Reduce</div>
                <div className="space-y-1">{(rebalanceGroups.reduce.length ? rebalanceGroups.reduce : ['No reduce call']).map((r) => <div key={r}>{r}</div>)}</div>
              </div>
              <div className="rounded-lg border border-outline-variant/20 bg-surface-container-high p-3">
                <div className="text-on-surface-variant mb-1 uppercase text-[10px]">Maintain</div>
                <div className="space-y-1">{(rebalanceGroups.maintain.length ? rebalanceGroups.maintain : ['No maintain call']).map((r) => <div key={r}>{r}</div>)}</div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
          <div className="text-xs uppercase tracking-widest text-on-surface-variant mb-3">Asset Purpose Guide</div>
          <div className="space-y-2 text-xs">
            <div className="rounded border bg-surface-container-high px-3 py-2" style={{ borderColor: '#3b82f680', borderLeftWidth: 3, borderLeftColor: '#3b82f6' }}>
              <div className="font-semibold" style={{ color: '#3b82f6' }}>Equities</div>
              <div className="text-on-surface-variant">Primary growth engine and participation in risk-on expansions.</div>
            </div>
            <div className="rounded border bg-surface-container-high px-3 py-2" style={{ borderColor: '#22c55e80', borderLeftWidth: 3, borderLeftColor: '#22c55e' }}>
              <div className="font-semibold" style={{ color: '#22c55e' }}>Bonds</div>
              <div className="text-on-surface-variant">Stability anchor and drawdown dampener during risk-off regimes.</div>
            </div>
            <div className="rounded border bg-surface-container-high px-3 py-2" style={{ borderColor: '#f59e0b80', borderLeftWidth: 3, borderLeftColor: '#f59e0b' }}>
              <div className="font-semibold" style={{ color: '#f59e0b' }}>Commodities / Gold</div>
              <div className="text-on-surface-variant">Inflation hedge and diversification when financial conditions tighten.</div>
            </div>
          </div>
          <div className="text-xs uppercase tracking-widest text-on-surface-variant mt-5 mb-2">What changes if risk changes</div>
          <div className="rounded border border-primary/20 bg-primary/10 px-3 py-2 text-xs">
            Conservative {'->'} higher bond ballast and lower beta.
            Moderate {'->'} balanced regime participation.
            Aggressive {'->'} higher equity sensitivity with larger cyclicality.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
          <div className="text-xs uppercase tracking-widest text-on-surface-variant mb-3">Alert System</div>
          <div className="space-y-2 text-xs">
            {[
              { key: 'regimeShift', label: 'Alert on regime change' },
              { key: 'vixSpike', label: 'Alert on VIX spike (>25)' },
              { key: 'creditStress', label: 'Alert on credit spread widening' },
            ].map((a) => (
              <label key={a.key} className="flex items-center justify-between rounded border border-outline-variant/20 bg-surface-container-high px-3 py-2 cursor-pointer">
                <span>{a.label}</span>
                <input
                  type="checkbox"
                  checked={settings.alerts[a.key as keyof SettingsState['alerts']]}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      alerts: { ...prev.alerts, [a.key]: e.target.checked },
                    }))
                  }
                />
              </label>
            ))}
          </div>
        </div>

        <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
          <div className="text-xs uppercase tracking-widest text-on-surface-variant mb-3">Model Behavior</div>
          <div className="space-y-3 text-xs">
            <div>
              <div className="text-on-surface-variant mb-1">Sensitivity</div>
              <div className="flex gap-2">
                {(['low', 'medium', 'high'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSettings((prev) => ({ ...prev, modelBehavior: { ...prev.modelBehavior, sensitivity: s } }))}
                    className={`px-3 py-1 rounded border ${
                      settings.modelBehavior.sensitivity === s ? 'bg-primary/15 border-primary/40' : 'bg-surface-container-high border-outline-variant/20'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-on-surface-variant mb-1">Rebalance frequency</div>
              <div className="flex gap-2">
                {(['weekly', 'monthly', 'quarterly'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setSettings((prev) => ({ ...prev, modelBehavior: { ...prev.modelBehavior, rebalanceFrequency: f } }))}
                    className={`px-3 py-1 rounded border ${
                      settings.modelBehavior.rebalanceFrequency === f ? 'bg-primary/15 border-primary/40' : 'bg-surface-container-high border-outline-variant/20'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
        <div className="text-xs uppercase tracking-widest text-on-surface-variant mb-3">Macro News Feed (Filtered)</div>
        {loadingNews && <div className="text-xs text-on-surface-variant mb-2">Loading news…</div>}
        {newsError && <div className="text-xs text-error mb-2">{newsError}</div>}
        {news?.summary && <div className="text-[10px] text-on-surface-variant mb-2">{news.summary}</div>}
        <div className="space-y-2">
          {topNews.map((a) => (
            <a key={`${a.url}-${a.title}`} href={a.url} target="_blank" rel="noreferrer" className="block text-xs hover:opacity-80">
              <div className="font-semibold">{a.title}</div>
              <div className="text-on-surface-variant">{a.source} | score {Math.round(a.black_swan_score)}</div>
            </a>
          ))}
          {topNews.length === 0 && <div className="text-xs text-on-surface-variant">No macro-relevant articles returned for current filters.</div>}
        </div>
      </div>
    </section>
  )
}
