import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Wrench, CheckCircle, Loader2, FileDown, RefreshCw, Lock, ExternalLink } from 'lucide-react'
import { api, errorMessage, isAbortedError } from '../lib/api'
import { useLoader } from '../hooks/useLoader'
import { unitLabel, useUnits } from '../hooks/useUnits'
import { formatDay, localHHMM } from '../lib/dates'
import { ActionError, ErrorState, ReadinessBadge, StaleBanner, StatusBadge } from '../components/Feedback'
import type { DiagnosisAttempt, Fault, GeneratedForm, Inspection, ProfileSummary, ResolutionStatus, Vehicle } from '../types/database'

interface VehicleData {
  vehicle: Vehicle | null
  openFaults: Fault[]
  allFaults: Pick<Fault, 'id' | 'inspection_id'>[]
  inspections: Inspection[]
  diagnoses: DiagnosisAttempt[]
  profiles: ProfileSummary[]
  forms: GeneratedForm[]
}

async function loadVehicle(vehicleId: string, signal: AbortSignal): Promise<VehicleData> {
  const vehicle = await api<Vehicle>('GET', `/vehicles/${encodeURIComponent(vehicleId)}`, { signal }).catch((err: unknown) => {
    if ((err as { status?: number }).status === 404 || (err as { status?: number }).status === 403) return null
    throw err
  })
  if (!vehicle) return { vehicle: null, openFaults: [], allFaults: [], inspections: [], diagnoses: [], profiles: [], forms: [] }

  const [allFaults, inspections] = await Promise.all([
    api<Fault[]>('GET', '/faults', { query: { vehicle_id: vehicleId }, signal }),
    api<Inspection[]>('GET', '/inspections', { query: { vehicle_id: vehicleId, status: 'COMPLETED', limit: 20 }, signal }),
  ])
  const openFaults = allFaults.filter((f) => f.resolution_status !== 'CORRECTED')
  const inspectionIds = inspections.map((i) => i.id)
  const inspectorIds = [...new Set(inspections.map((i) => i.inspector_id))]
  const [diagnoses, profiles, forms] = await Promise.all([
    openFaults.length
      ? api<DiagnosisAttempt[]>('GET', '/diagnosis-attempts', { query: { fault_id: openFaults.map((f) => f.id) }, signal })
      : Promise.resolve([]),
    inspectorIds.length ? api<ProfileSummary[]>('GET', '/profiles', { query: { id: inspectorIds }, signal }) : Promise.resolve([]),
    inspectionIds.length
      ? api<GeneratedForm[]>('GET', '/generated-forms', { query: { inspection_id: inspectionIds }, signal })
      : Promise.resolve([]),
  ])
  return { vehicle, openFaults, allFaults, inspections, diagnoses, profiles, forms }
}

/**
 * Opens a tab synchronously (inside the click handler, so Safari doesn't block
 * it) and points it at the URL once `getUrl` resolves. If the browser blocked
 * the tab anyway, the URL is returned so the page can render a link instead.
 */
async function openInNewTab(getUrl: () => Promise<string>): Promise<string | null> {
  const win = window.open('', '_blank')
  if (win) {
    try {
      win.opener = null
      win.document.title = 'DA 2404'
      win.document.body.textContent = 'Preparing DA 2404...'
    } catch {
      // cross-origin or restricted: harmless
    }
  }
  try {
    const url = await getUrl()
    if (win && !win.closed) {
      win.location.href = url
      return null
    }
    return url
  } catch (err) {
    win?.close()
    throw err
  }
}

export function VehicleDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { ownUnit, unitNames } = useUnits()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [fallbackLinks, setFallbackLinks] = useState<Record<string, string>>({})
  const [workOrderInputs, setWorkOrderInputs] = useState<Record<string, string>>({})

  const { data, error, loading, updatedAt, reload, mutate } = useLoader(id ? `vehicle|${id}` : null, (signal) =>
    loadVehicle(id!, signal),
  )

  const view = useMemo(() => {
    if (!data) return null
    const diagnosisByFault = new Map<string, DiagnosisAttempt>()
    for (const d of data.diagnoses) if (!diagnosisByFault.has(d.fault_id)) diagnosisByFault.set(d.fault_id, d)
    const names = new Map(data.profiles.map((p) => [p.id, `${p.rank ?? ''} ${p.last_name ?? ''}`.trim() || 'Unknown']))
    const faultCount = new Map<string, number>()
    for (const f of data.allFaults) faultCount.set(f.inspection_id, (faultCount.get(f.inspection_id) ?? 0) + 1)
    const formByInspection = new Set(data.forms.filter((f) => f.pdf_storage_path).map((f) => f.inspection_id))
    const inspections = data.inspections.map((i) => ({
      ...i,
      inspectorName: names.get(i.inspector_id) ?? 'Unknown',
      faultCount: faultCount.get(i.id) ?? 0,
      hasForm: formByInspection.has(i.id),
    }))
    return { diagnosisByFault, inspections }
  }, [data])

  async function updateFault(faultId: string, status: Exclude<ResolutionStatus, 'OPEN'>) {
    if (busyId) return
    setBusyId(faultId)
    setActionError(null)
    const wo = workOrderInputs[faultId]?.trim()
    try {
      await api('PATCH', '/faults', {
        body: { ids: [faultId], resolution_status: status, ...(wo ? { gcss_work_order: wo } : {}) },
      })
      mutate((prev) => ({
        ...prev,
        openFaults:
          status === 'CORRECTED'
            ? prev.openFaults.filter((f) => f.id !== faultId)
            : prev.openFaults.map((f) => (f.id === faultId ? { ...f, resolution_status: status, gcss_work_order: wo || f.gcss_work_order } : f)),
      }))
      reload()
    } catch (err) {
      if (!isAbortedError(err)) setActionError(`${status === 'CORRECTED' ? 'Resolve' : 'Acknowledge'} failed: ${errorMessage(err)}`)
    } finally {
      setBusyId(null)
    }
  }

  async function handlePdf(inspectionId: string, mode: 'open' | 'generate' | 'regenerate') {
    if (pdfBusyId) return
    if (
      mode === 'regenerate' &&
      !window.confirm('Regenerate this DA 2404? It replaces the existing form, including any supervisor printed on it by the field app.')
    ) {
      return
    }
    setPdfBusyId(inspectionId)
    setActionError(null)
    try {
      const fallback = await openInNewTab(async () => {
        if (mode === 'open') {
          const { url } = await api<{ url: string }>('GET', '/generated-forms/link', { query: { inspection_id: inspectionId } })
          return url
        }
        // Without ?regenerate=1 the server re-uses an existing form instead of overwriting it.
        const { url } = await api<{ url: string }>('POST', `/inspections/${encodeURIComponent(inspectionId)}/da2404`, {
          query: mode === 'regenerate' ? { regenerate: 1 } : undefined,
          body: { local_time: localHHMM() },
          timeoutMs: 60_000,
        })
        return url
      })
      setFallbackLinks((prev) => {
        const next = { ...prev }
        if (fallback) next[inspectionId] = fallback
        else delete next[inspectionId]
        return next
      })
      if (mode !== 'open') reload()
    } catch (err) {
      if (!isAbortedError(err)) setActionError(`DA 2404 ${mode === 'open' ? 'download' : 'generation'} failed: ${errorMessage(err)}`)
    } finally {
      setPdfBusyId(null)
    }
  }

  if (loading) return <div className="text-text-secondary">Loading vehicle data...</div>
  if (!data || !view) return <ErrorState title="Couldn't load this vehicle" message={error ?? 'Unknown error'} onRetry={reload} />

  const { vehicle, openFaults } = data
  if (!vehicle) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back to Fleet</span>
        </button>
        <div className="text-text-secondary">Vehicle not found</div>
      </div>
    )
  }

  const canEdit = !!ownUnit && vehicle.unit === ownUnit

  return (
    <div className="space-y-8">
      <div>
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back to Fleet</span>
        </button>
        <div className="flex items-center gap-4">
          <h1 className="font-display text-2xl font-bold text-text-primary">{vehicle.bumper_number ?? 'Unknown'}</h1>
          <StatusBadge status={vehicle.status} />
          {!canEdit && (
            <span className="flex items-center gap-1 text-xs text-text-secondary" title="Watched unit: view only">
              <Lock className="w-3 h-3" /> View only
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-6 mt-2 text-sm text-text-secondary">
          <span>{unitLabel(vehicle.unit, unitNames)}</span>
          <span>{vehicle.vehicle_type ?? '---'}</span>
          <span>ODO: {vehicle.current_odometer?.toLocaleString() ?? '---'}</span>
          {vehicle.serial_number && <span>S/N: {vehicle.serial_number}</span>}
        </div>
      </div>

      {error && <StaleBanner message={error} updatedAt={updatedAt} onRetry={reload} />}
      <ActionError message={actionError} onDismiss={() => setActionError(null)} />

      <div className="bg-bg-secondary border border-border rounded-xl">
        <div className="flex items-center gap-3 p-6 border-b border-border">
          <Wrench className="w-5 h-5 text-accent-red" />
          <h2 className="font-display text-lg font-semibold text-text-primary">Open Faults ({openFaults.length})</h2>
        </div>

        {openFaults.length === 0 ? (
          <div className="p-12 text-center text-text-secondary">No open faults</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-text-secondary uppercase tracking-wider">
                  <th className="px-6 py-3">Item</th>
                  <th className="px-6 py-3">Description</th>
                  <th className="px-6 py-3">Readiness</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">GCSS-A WO#</th>
                  <th className="px-6 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {openFaults.map((f) => {
                  const diagnosis = view.diagnosisByFault.get(f.id)
                  const steps = diagnosis?.steps_completed ?? []
                  const busy = busyId === f.id
                  return (
                    <tr key={f.id} className="hover:bg-bg-tertiary transition-colors">
                      <td className="px-6 py-4 font-display text-sm text-text-primary">{f.item ?? '---'}</td>
                      <td className="px-6 py-4 text-sm text-text-secondary max-w-xs">
                        <div>{f.description ?? f.item_description ?? '---'}</div>
                        {f.photo_urls && f.photo_urls.length > 0 && (
                          <div className="flex gap-2 mt-2">
                            {f.photo_urls.map((url, i) => (
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                                <img
                                  src={url}
                                  alt={`Fault photo ${i + 1}`}
                                  loading="lazy"
                                  className="w-12 h-12 rounded border border-border object-cover hover:ring-2 hover:ring-accent-blue transition-all"
                                />
                              </a>
                            ))}
                          </div>
                        )}
                        {diagnosis && (steps.length > 0 || diagnosis.outcome === 'skipped') && (
                          <div className="mt-3 pt-3 border-t border-border">
                            {steps.length > 0 && (
                              <>
                                <p className="text-xs font-semibold text-text-secondary mb-2">Operator Diagnosis Trail</p>
                                <div className="flex flex-col gap-1">
                                  {steps.map((step, i) => (
                                    <div key={i} className="flex items-start gap-2 text-xs">
                                      <span className="text-text-secondary min-w-[16px]">{i + 1}.</span>
                                      <span className="text-text-primary">{step.nodeText}</span>
                                      {step.selectedOption && (
                                        <span className="text-accent-blue ml-auto flex-shrink-0">&rarr; {step.selectedOption}</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}
                            {diagnosis.outcome === 'skipped' && (
                              <p className="text-xs text-accent-amber mt-2" data-testid="skip-reason">
                                Diagnosis skipped{diagnosis.skip_reason ? `: ${diagnosis.skip_reason}` : ''}
                              </p>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4"><ReadinessBadge readiness={f.readiness} /></td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            f.resolution_status === 'ACKNOWLEDGED' ? 'bg-accent-amber/20 text-accent-amber' : 'bg-accent-red/20 text-accent-red'
                          }`}
                        >
                          {f.resolution_status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {canEdit ? (
                          <input
                            type="text"
                            placeholder="WO#"
                            aria-label="GCSS-A work order"
                            value={workOrderInputs[f.id] ?? f.gcss_work_order ?? ''}
                            onChange={(e) => setWorkOrderInputs((prev) => ({ ...prev, [f.id]: e.target.value }))}
                            className="w-28 px-2 py-1 bg-bg-tertiary border border-border rounded text-xs text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-accent-blue"
                          />
                        ) : (
                          <span className="text-xs text-text-secondary">{f.gcss_work_order ?? '---'}</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {canEdit ? (
                          <div className="flex gap-2">
                            {f.resolution_status === 'OPEN' && (
                              <button
                                onClick={() => updateFault(f.id, 'ACKNOWLEDGED')}
                                disabled={!!busyId}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-accent-amber/20 text-accent-amber rounded-lg text-xs font-medium hover:bg-accent-amber/30 disabled:opacity-50 transition-colors"
                              >
                                {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                                GCSS-A
                              </button>
                            )}
                            <button
                              onClick={() => updateFault(f.id, 'CORRECTED')}
                              disabled={!!busyId}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-green/20 text-accent-green rounded-lg text-xs font-medium hover:bg-accent-green/30 disabled:opacity-50 transition-colors"
                            >
                              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                              Resolve
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-text-secondary">View only</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-bg-secondary border border-border rounded-xl">
        <div className="p-6 border-b border-border">
          <h2 className="font-display text-lg font-semibold text-text-primary">Inspection History</h2>
        </div>

        {view.inspections.length === 0 ? (
          <div className="p-12 text-center text-text-secondary">No inspections recorded</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-text-secondary uppercase tracking-wider">
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Inspector</th>
                  <th className="px-6 py-3">Faults Found</th>
                  <th className="px-6 py-3">DA 2404</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {view.inspections.map((ins) => {
                  const busy = pdfBusyId === ins.id
                  const fallback = fallbackLinks[ins.id]
                  return (
                    <tr key={ins.id} className="hover:bg-bg-tertiary transition-colors">
                      <td className="px-6 py-4 text-sm text-text-primary">{formatDay(ins.date ?? ins.completed_at)}</td>
                      <td className="px-6 py-4 text-sm text-text-secondary">{ins.inspection_type ?? '---'}</td>
                      <td className="px-6 py-4 text-sm text-text-secondary">{ins.inspectorName}</td>
                      <td className="px-6 py-4 text-sm">
                        {ins.faultCount > 0 ? (
                          <span className="text-accent-red font-semibold">{ins.faultCount}</span>
                        ) : (
                          <span className="text-accent-green">0</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          {ins.hasForm ? (
                            <button
                              onClick={() => handlePdf(ins.id, 'open')}
                              disabled={!!pdfBusyId}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-blue/20 text-accent-blue rounded-lg text-xs font-medium hover:bg-accent-blue/30 disabled:opacity-50 transition-colors"
                            >
                              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileDown className="w-3 h-3" />}
                              Open
                            </button>
                          ) : canEdit ? (
                            <button
                              disabled={!!pdfBusyId}
                              onClick={() => handlePdf(ins.id, 'generate')}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-tertiary text-text-secondary rounded-lg text-xs font-medium hover:bg-bg-tertiary/80 disabled:opacity-50 transition-colors"
                            >
                              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileDown className="w-3 h-3" />}
                              {busy ? 'Generating...' : 'Generate'}
                            </button>
                          ) : (
                            <span className="text-xs text-text-secondary">Not generated</span>
                          )}
                          {ins.hasForm && canEdit && (
                            <button
                              disabled={!!pdfBusyId}
                              onClick={() => handlePdf(ins.id, 'regenerate')}
                              title="Rebuild the form from current data (replaces the existing one)"
                              className="flex items-center gap-1 px-2 py-1.5 text-text-secondary rounded-lg text-xs hover:bg-bg-tertiary disabled:opacity-50 transition-colors"
                            >
                              <RefreshCw className="w-3 h-3" />
                              Regenerate
                            </button>
                          )}
                          {fallback && (
                            <a
                              href={fallback}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-accent-blue underline"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Open PDF
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
