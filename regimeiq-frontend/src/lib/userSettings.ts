import type { RiskTolerance } from '../types/regime'

export const SETTINGS_STORAGE_KEY = 'regimeiq_settings_v1'

export type UserSettingsState = {
  riskTolerance: RiskTolerance
  newsTopics: string[]
}

export function loadUserSettings(): UserSettingsState {
  if (typeof window === 'undefined') {
    return { riskTolerance: 'moderate', newsTopics: ['inflation', 'fed', 'recession'] }
  }
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!raw) return { riskTolerance: 'moderate', newsTopics: ['inflation', 'fed', 'recession'] }
    const parsed = JSON.parse(raw) as Partial<UserSettingsState>
    const rt = parsed.riskTolerance
    const riskTolerance: RiskTolerance =
      rt === 'conservative' || rt === 'aggressive' ? rt : 'moderate'
    const newsTopics = Array.isArray(parsed.newsTopics)
      ? parsed.newsTopics.filter(Boolean)
      : ['inflation', 'fed', 'recession']
    return { riskTolerance, newsTopics }
  } catch {
    return { riskTolerance: 'moderate', newsTopics: ['inflation', 'fed', 'recession'] }
  }
}
