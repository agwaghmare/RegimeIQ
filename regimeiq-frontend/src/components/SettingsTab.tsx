import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import type { NewsPayload, RebalancePlan, RiskTolerance } from '../types/regime'

const NEWS_OPTIONS = ['inflation', 'fed', 'recession', 'oil', 'gold', 'technology', 'geopolitics', 'crypto']
const STORAGE_KEY = 'regimeiq_settings_v1'

type SettingsState = {
  riskTolerance: RiskTolerance
  newsTopics: string[]
}

function loadSettings(): SettingsState {
  if (typeof window === 'undefined') {
    return { riskTolerance: 'moderate', newsTopics: ['inflation', 'fed', 'recession'] }
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { riskTolerance: 'moderate', newsTopics: ['inflation', 'fed', 'recession'] }
    const parsed = JSON.parse(raw) as Partial<SettingsState>
    const rt = parsed.riskTolerance
    const riskTolerance: RiskTolerance = rt === 'conservative' || rt === 'aggressive' ? rt : 'moderate'
    const newsTopics = Array.isArray(parsed.newsTopics) ? parsed.newsTopics.filter(Boolean) : ['inflation', 'fed', 'recession']
    return { riskTolerance, newsTopics }
  } catch {
    return { riskTolerance: 'moderate', newsTopics: ['inflation', 'fed', 'recession'] }
  }
}

export function SettingsTab() {
  const [settings, setSettings] = useState<SettingsState>(loadSettings)
  const [plan, setPlan] = useState<RebalancePlan | null>(null)
  const [news, setNews] = useState<NewsPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const [rebalance, newsPayload] = await Promise.all([
          api.getRebalancePlan(settings.riskTolerance),
          api.getNews(settings.newsTopics),
        ])
        if (cancelled) return
        setPlan(rebalance)
        setNews(newsPayload)
      } catch (e) {
        if (cancelled) return
        setError((e as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [settings.riskTolerance, settings.newsTopics])

  const topNews = useMemo(() => (news?.articles ?? []).slice(0, 6), [news])

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
        <h2 className="text-sm font-black uppercase tracking-widest text-primary mb-2">Settings</h2>
        <div className="text-xs text-on-surface-variant">Set risk tolerance, choose news coverage, and get a concrete rebalance plan.</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20 space-y-4">
          <div className="text-xs uppercase tracking-widest text-on-surface-variant">Risk Tolerance</div>
          <div className="flex gap-2">
            {(['conservative', 'moderate', 'aggressive'] as RiskTolerance[]).map((r) => (
              <button
                key={r}
                onClick={() => setSettings((prev) => ({ ...prev, riskTolerance: r }))}
                className={`px-3 py-2 rounded text-xs uppercase tracking-wider ${
                  settings.riskTolerance === r ? 'bg-primary text-on-primary' : 'bg-[#1b1c22] text-on-surface-variant'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

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
          <div className="text-xs uppercase tracking-widest text-on-surface-variant mb-3">Rebalance Guidance</div>
          {loading ? (
            <div className="text-xs text-on-surface-variant">Updating plan...</div>
          ) : error ? (
            <div className="text-xs text-error">{error}</div>
          ) : (
            <div className="space-y-3 text-xs">
              <div><span className="text-on-surface-variant">Stocks to buy:</span> {(plan?.buy_recommendations.stocks ?? []).map((a) => a.ticker).join(', ') || '—'}</div>
              <div><span className="text-on-surface-variant">Bonds to buy:</span> {(plan?.buy_recommendations.bonds ?? []).map((a) => a.ticker).join(', ') || '—'}</div>
              <div><span className="text-on-surface-variant">Commodities to buy:</span> {(plan?.buy_recommendations.commodities ?? []).map((a) => a.ticker).join(', ') || '—'}</div>
              <div className="pt-2 border-t border-outline-variant/20">
                <div className="text-on-surface-variant mb-1">Suggested 6-holding portfolio (Sharpe-based):</div>
                <div className="space-y-1">
                  {(plan?.model_portfolio ?? []).map((h) => (
                    <div key={h.ticker} className="flex justify-between">
                      <span>{h.ticker}</span>
                      <span>{Math.round(h.target_weight * 100)}% | Sharpe {h.sharpe.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
        <div className="text-xs uppercase tracking-widest text-on-surface-variant mb-3">News Feed (Based On Your Preferences)</div>
        <div className="space-y-2">
          {topNews.map((a) => (
            <a key={`${a.url}-${a.title}`} href={a.url} target="_blank" rel="noreferrer" className="block text-xs hover:opacity-80">
              <div className="font-semibold">{a.title}</div>
              <div className="text-on-surface-variant">{a.source} | score {Math.round(a.black_swan_score)}</div>
            </a>
          ))}
          {topNews.length === 0 && <div className="text-xs text-on-surface-variant">No news returned for current filters.</div>}
        </div>
      </div>
    </section>
  )
}
