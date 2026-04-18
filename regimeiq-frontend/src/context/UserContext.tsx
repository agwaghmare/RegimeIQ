import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

export type SubscriptionTier = 'free' | 'basic' | 'premium'

export interface UserProfile {
  name: string
  email: string
  avatarInitials: string
  memberSince: string
  role: string
  firm: string
  location: string
  phone: string
  twoFactor: boolean
  plan: SubscriptionTier
  billingCycle: 'monthly' | 'annual'
  nextRenewal: string
  usage: {
    apiCallsThisMonth: number
    alertsConfigured: number
    watchlistsConfigured: number
  }
}

const DEMO_USER: UserProfile = {
  name: 'Alex Morgan',
  email: 'alex.morgan@regimeiq.io',
  avatarInitials: 'AM',
  memberSince: '2024-02-11',
  role: 'Portfolio Manager',
  firm: 'Meridian Capital Partners',
  location: 'New York, NY',
  phone: '+1 (212) 555-0142',
  twoFactor: true,
  plan: 'premium',
  billingCycle: 'annual',
  nextRenewal: '2027-04-17',
  usage: {
    apiCallsThisMonth: 4237,
    alertsConfigured: 12,
    watchlistsConfigured: 5,
  },
}

interface UserContextValue {
  user: UserProfile
  setPlan: (plan: SubscriptionTier) => void
}

const UserContext = createContext<UserContextValue | null>(null)

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile>(DEMO_USER)
  const value = useMemo<UserContextValue>(() => ({
    user,
    setPlan: (plan) => setUser((prev) => ({ ...prev, plan })),
  }), [user])
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useUser must be used within UserProvider')
  return ctx
}
