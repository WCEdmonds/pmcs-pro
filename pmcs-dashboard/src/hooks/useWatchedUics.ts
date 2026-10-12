import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'

interface UseWatchedUicsResult {
  uics: string[]
  ownUic: string | null
  loading: boolean
}

export function useWatchedUics(): UseWatchedUicsResult {
  const [ownUic, setOwnUic] = useState<string | null>(null)
  const [watchedUics, setWatchedUics] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    let own: string | null = null
    let watched: string[] = []
    try {
      const [profile, watchedRows] = await Promise.all([
        api<{ unit: string | null }>('GET', '/me'),
        api<{ uic: string }[]>('GET', '/watched-uics'),
      ])
      own = profile.unit ?? null
      watched = watchedRows.map((w) => w.uic)
    } catch {
      setLoading(false)
      return
    }

    setOwnUic(own)
    setWatchedUics(watched)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const handler = () => { load() }
    window.addEventListener('watched-uics-changed', handler)
    return () => window.removeEventListener('watched-uics-changed', handler)
  }, [load])

  // Combine own UIC + watched UICs, deduplicated
  const uics = [...new Set([...(ownUic ? [ownUic] : []), ...watchedUics])]

  return { uics, ownUic, loading }
}
