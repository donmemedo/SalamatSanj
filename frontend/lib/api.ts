"use client"
import { useCallback, useEffect, useState } from "react"

// Same-origin by default (Next rewrites /api -> backend). Set NEXT_PUBLIC_API_URL for PWA/mobile builds.
const BASE = process.env.NEXT_PUBLIC_API_URL ?? ""

export async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(BASE + path, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } })
  if (!r.ok) throw new Error(`${r.status}`)
  return r.status === 204 ? (undefined as T) : r.json()
}

export function useApi<T>(path: string) {
  const [data, setData] = useState<T>()
  const [error, setError] = useState(false)
  const reload = useCallback(() => {
    setError(false)
    return api<T>(path).then(setData, () => setError(true))
  }, [path])
  useEffect(() => { reload() }, [reload])
  return { data, error, reload, setData }
}
