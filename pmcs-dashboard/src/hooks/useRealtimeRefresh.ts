import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

type TableName = 'vehicles' | 'faults' | 'inspections' | 'generated_forms' | 'diagnosis_attempts'

let channelCounter = 0

/**
 * Subscribe to Supabase Realtime postgres changes on the given tables.
 * Calls `onRefresh` whenever an INSERT, UPDATE, or DELETE occurs.
 */
export function useRealtimeRefresh(
  tables: TableName[],
  onRefresh: () => void
) {
  const callbackRef = useRef(onRefresh)
  callbackRef.current = onRefresh

  useEffect(() => {
    const channelName = `dashboard-rt-${++channelCounter}`
    const channel = supabase.channel(channelName)

    for (const table of tables) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => callbackRef.current()
      )
    }

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])
}
