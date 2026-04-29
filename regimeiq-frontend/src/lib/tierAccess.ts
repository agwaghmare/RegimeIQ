import type { SubscriptionTier } from '../context/UserContext'

export type View =
  | 'dashboard'
  | 'learn'
  | 'forecast'
  | 'globalMacro'
  | 'playbook'
  | 'riskLab'
  | 'historical'
  | 'portfolio'
  | 'settings'
  | 'preferences'
  | 'account'
  | 'pricing'

export const TIER_ACCESS: Record<SubscriptionTier, Set<View>> = {
  free: new Set<View>(['dashboard', 'learn', 'account', 'pricing', 'preferences', 'settings']),
  basic: new Set<View>([
    'dashboard',
    'learn',
    'globalMacro',
    'playbook',
    'riskLab',
    'portfolio',
    'settings',
    'preferences',
    'account',
    'pricing',
  ]),
  premium: new Set<View>([
    'dashboard',
    'learn',
    'forecast',
    'globalMacro',
    'playbook',
    'riskLab',
    'historical',
    'portfolio',
    'settings',
    'preferences',
    'account',
    'pricing',
  ]),
}

export function canAccess(tier: SubscriptionTier, view: View): boolean {
  return TIER_ACCESS[tier].has(view)
}

export const TIER_LABEL: Record<SubscriptionTier, string> = {
  free: 'Free',
  basic: 'Basic',
  premium: 'Premium',
}
