import type { RegimeData } from '../types/regime'

const BASE_URL = import.meta.env.VITE_API_URL ?? ''

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`)
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

export const api = {
  getRegime: () => get<RegimeData>('/regime/'),
}
