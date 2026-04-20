import type { SubscriptionTier } from '../context/UserContext'

export type View =
  | 'dashboard'
  | 'forecast'
  | 'globalMacro'
  | 'playbook'
  | 'riskLab'
  | 'historical'
  | 'portfolio'
  | 'preferences'
  | 'account'
  | 'pricing'

export const TIER_ACCESS: Record<SubscriptionTier, Set<View>> = {
  free: new Set<View>(['dashboard', 'account', 'pricing', 'preferences']),
  basic: new Set<View>([
    'dashboard',
    'globalMacro',
    'playbook',
    'riskLab',
    'portfolio',
    'preferences',
    'account',
    'pricing',
  ]),
  premium: new Set<View>([
    'dashboard',
    'forecast',
    'globalMacro',
    'playbook',
    'riskLab',
    'historical',
    'portfolio',
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
