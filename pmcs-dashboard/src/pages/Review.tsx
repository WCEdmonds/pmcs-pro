// The troubleshooting review page, shared with the field app (pmcs-app/src/pages/ReviewPage.tsx).
// It runs here on the dashboard's own session, so leaders on networks that only allow the
// dashboard's address can use it.
import { useEffect } from 'react'
import { ReviewScreen } from '../../../pmcs-app/src/pages/ReviewPage'
import { setReviewRequest } from '../../../pmcs-app/src/utils/reviewApi'
import { ApiError as SharedApiError, NetworkError } from '../../../pmcs-app/src/utils/api'
import { ApiError, api, getSessionUserId } from '../lib/api'
import { useUnits } from '../hooks/useUnits'

// The shared page understands the field app's error types; translate the dashboard client's.
setReviewRequest(async (method, path, opts) => {
  try {
    return await api(method, path, opts)
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 0) throw new NetworkError(err.message)
      throw new SharedApiError(err.message, err.status, err.code)
    }
    if (err instanceof TypeError) throw new NetworkError()
    throw err
  }
})

export function Review() {
  const { profile, isAdmin } = useUnits()
  useEffect(() => { document.title = 'Troubleshooting Review · PMCS Pro' }, [])
  return (
    <ReviewScreen
      viewer={{
        id: profile?.id ?? getSessionUserId(),
        isAdmin,
        rank: profile?.rank,
        firstName: profile?.first_name,
        lastName: profile?.last_name,
        dodId: profile?.dod_id,
        homeLabel: 'Fleet Overview',
      }}
    />
  )
}
