import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const [profileRes, watchedRes] = await Promise.all([
      supabase.from('profiles').select('unit').eq('id', user.id).single(),
      supabase.from('dashboard_watched_uics').select('uic').eq('user_id', user.id),
    ])

    const own = (profileRes.data as { unit: string | null } | null)?.unit ?? null
    const watched = (watchedRes.data ?? []).map((w: { uic: string }) => w.uic)

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
