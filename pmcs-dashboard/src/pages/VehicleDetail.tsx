import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Wrench, CheckCircle, Loader2, FileDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh'
import type { Vehicle, Fault, Inspection, DiagnosisAttempt } from '../types/database'

interface InspectionRow extends Inspection {
  inspectorName: string
  faultCount: number
  pdfPath: string | null
}

interface ProfileRecord {
  id: string
  rank: string | null
  last_name: string | null
  first_name: string | null
}

interface FaultIdRecord {
  id: string
  inspection_id: string
}

export function VehicleDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [openFaults, setOpenFaults] = useState<Fault[]>([])
  const [diagnosisByFaultId, setDiagnosisByFaultId] = useState<Map<string, DiagnosisAttempt>>(new Map())
  const [inspections, setInspections] = useState<InspectionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const isInitialLoad = useRef(true)
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [workOrderInputs, setWorkOrderInputs] = useState<Record<string, string>>({})

  useEffect(() => {
    if (id) loadData(id)
  }, [id])

  useRealtimeRefresh(['vehicles', 'faults', 'inspections', 'generated_forms', 'diagnosis_attempts'], () => {
    if (id) loadData(id)
  })

  async function loadData(vehicleId: string) {
    if (isInitialLoad.current) setLoading(true)

    const [vehicleRes, faultsRes, inspectionsRes] = await Promise.all([
      supabase.from('vehicles').select('*').eq('id', vehicleId).single(),
      supabase.from('faults').select('*').eq('vehicle_id', vehicleId).neq('resolution_status', 'CORRECTED').order('created_at', { ascending: false }),
      supabase.from('inspections').select('*').eq('vehicle_id', vehicleId).eq('status', 'COMPLETED').order('completed_at', { ascending: false }).limit(20),
    ])

    setVehicle(vehicleRes.data as Vehicle | null)
    const allOpenFaults = (faultsRes.data ?? []) as Fault[]
    setOpenFaults(allOpenFaults)

    // Fetch diagnosis attempts for open faults
    const faultIds = allOpenFaults.map((f) => f.id)
    if (faultIds.length > 0) {
      const { data: diagnosisData } = await supabase
        .from('diagnosis_attempts')
        .select('*')
        .in('fault_id', faultIds)
        .order('completed_at', { ascending: false })

      setDiagnosisByFaultId(
        (() => {
          const m = new Map<string, DiagnosisAttempt>()
          for (const d of (diagnosisData ?? []) as DiagnosisAttempt[]) {
            if (!m.has(d.fault_id)) m.set(d.fault_id, d)
          }
          return m
        })()
      )
    } else {
      setDiagnosisByFaultId(new Map())
    }

    // Enrich inspections with inspector names and fault counts
    const ins = (inspectionsRes.data ?? []) as Inspection[]
    if (ins.length > 0) {
      const inspectorIds = [...new Set(ins.map((i) => i.inspector_id))]
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, rank, last_name, first_name')
        .in('id', inspectorIds)

      const profileMap = new Map<string, string>()
      for (const p of (profiles ?? []) as ProfileRecord[]) {
        profileMap.set(p.id, `${p.rank ?? ''} ${p.last_name ?? ''}`.trim())
      }

      const inspectionIds = ins.map((i) => i.id)
      const { data: allFaults } = await supabase
        .from('faults')
        .select('id, inspection_id')
        .in('inspection_id', inspectionIds)

      const faultCountMap = new Map<string, number>()
      for (const f of (allFaults ?? []) as FaultIdRecord[]) {
        faultCountMap.set(f.inspection_id, (faultCountMap.get(f.inspection_id) ?? 0) + 1)
      }

      // Load generated forms
      const { data: forms } = await supabase
        .from('generated_forms')
        .select('inspection_id, pdf_storage_path')
        .in('inspection_id', inspectionIds)

      const formMap = new Map<string, string>()
      for (const f of (forms ?? []) as { inspection_id: string; pdf_storage_path: string }[]) {
        formMap.set(f.inspection_id, f.pdf_storage_path)
      }

      setInspections(
        ins.map((i) => ({
          ...i,
          inspectorName: profileMap.get(i.inspector_id) ?? 'Unknown',
          faultCount: faultCountMap.get(i.id) ?? 0,
          pdfPath: formMap.get(i.id) ?? null,
        }))
      )
    } else {
      setInspections([])
    }

    isInitialLoad.current = false
    setLoading(false)
  }

  async function handleResolve(faultId: string) {
    setResolvingId(faultId)
    const { data: { user } } = await supabase.auth.getUser()

    const updates: { resolution_status: string; resolved_at: string; resolved_by: string | null; gcss_work_order?: string } = {
      resolution_status: 'CORRECTED',
      resolved_at: new Date().toISOString(),
      resolved_by: user?.id ?? null,
    }

    const wo = workOrderInputs[faultId]
    if (wo) {
      updates.gcss_work_order = wo
    }

    await supabase.from('faults').update(updates as never).eq('id', faultId)
    setOpenFaults((prev) => prev.filter((f) => f.id !== faultId))
    setResolvingId(null)
  }

  async function handleDownloadPdf(path: string) {
    const { data, error } = await supabase.storage.from('generated').createSignedUrl(path, 3600)
    if (error) {
      console.error('Download error:', error)
      alert('Failed to download PDF: ' + error.message)
      return
    }
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank')
    }
  }

  async function handleGeneratePdf(inspectionId: string) {
    setGeneratingId(inspectionId)
    try {
      const { data, error } = await supabase.functions.invoke('generate-da2404', {
        body: { inspection_id: inspectionId },
      })
      if (error) {
        console.error('Generate error:', error)
        alert('Failed to generate DA 2404: ' + error.message)
        return
      }
      if (data?.error) {
        console.error('Generate error:', data.error)
        alert('Failed to generate DA 2404: ' + data.error)
        return
      }
      if (data?.url) {
        window.open(data.url, '_blank')
        if (id) loadData(id)
      }
    } finally {
      setGeneratingId(null)
    }
  }

  async function handleAcknowledge(faultId: string) {
    setResolvingId(faultId)
    const wo = workOrderInputs[faultId]
    const updates: { resolution_status: string; gcss_work_order?: string } = {
      resolution_status: 'ACKNOWLEDGED',
    }
    if (wo) updates.gcss_work_order = wo
    await supabase.from('faults').update(updates as never).eq('id', faultId)
    setOpenFaults((prev) =>
      prev.map((f) => f.id === faultId ? { ...f, resolution_status: 'ACKNOWLEDGED' as never, gcss_work_order: (wo || f.gcss_work_order) as never } : f)
    )
    setResolvingId(null)
  }

  function statusBadge(status: string | null) {
    if (status === 'FMC') return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-accent-green/20 text-accent-green">FMC</span>
    if (status === 'PMC') return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-accent-amber/20 text-accent-amber">PMC</span>
    if (status === 'DEADLINE') return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-accent-red/20 text-accent-red">DEADLINE</span>
    return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-accent-red/20 text-accent-red">NMC</span>
  }

  function readinessBadge(readiness: string | null) {
    if (readiness === 'NMC') return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-accent-red/20 text-accent-red">NMC</span>
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-accent-amber/20 text-accent-amber">PMC</span>
  }

  if (loading) {
    return <div className="text-text-secondary">Loading vehicle data...</div>
  }

  if (!vehicle) {
    return <div className="text-text-secondary">Vehicle not found</div>
  }

  return (
    <div className="space-y-8">
      {/* Back + Header */}
      <div>
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back to Fleet</span>
        </button>
        <div className="flex items-center gap-4">
          <h1 className="font-display text-2xl font-bold text-text-primary">
            {vehicle.bumper_number ?? 'Unknown'}
          </h1>
          {statusBadge(vehicle.status)}
        </div>
        <div className="flex gap-6 mt-2 text-sm text-text-secondary">
          <span>{vehicle.vehicle_type ?? '---'}</span>
          <span>ODO: {vehicle.current_odometer?.toLocaleString() ?? '---'}</span>
          {vehicle.serial_number && <span>S/N: {vehicle.serial_number}</span>}
        </div>
      </div>

      {/* Open Faults */}
      <div className="bg-bg-secondary border border-border rounded-xl">
        <div className="flex items-center gap-3 p-6 border-b border-border">
          <Wrench className="w-5 h-5 text-accent-red" />
          <h2 className="font-display text-lg font-semibold text-text-primary">
            Open Faults ({openFaults.length})
          </h2>
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
                  const diagnosis = diagnosisByFaultId.get(f.id)
                  return (
                  <tr key={f.id} className="hover:bg-bg-tertiary transition-colors">
                    <td className="px-6 py-4 font-display text-sm text-text-primary">
                      {f.item ?? '---'}
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary max-w-xs">
                      <div>{f.description ?? f.item_description ?? '---'}</div>
                      {/* Fault Photos */}
                      {f.photo_urls && f.photo_urls.length > 0 && (
                        <div className="flex gap-2 mt-2">
                          {f.photo_urls.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                              <img
                                src={url}
                                alt={`Fault photo ${i + 1}`}
                                className="w-12 h-12 rounded border border-border object-cover hover:ring-2 hover:ring-accent-blue transition-all"
                              />
                            </a>
                          ))}
                        </div>
                      )}
                      {/* Diagnosis Trail */}
                      {diagnosis && diagnosis.steps_completed.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <p className="text-xs font-semibold text-text-secondary mb-2">Operator Diagnosis Trail</p>
                          <div className="flex flex-col gap-1">
                            {diagnosis.steps_completed.map((step, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs">
                                <span className="text-text-secondary min-w-[16px]">{i + 1}.</span>
                                <span className="text-text-primary">{step.nodeText}</span>
                                {step.selectedOption && (
                                  <span className="text-accent-blue ml-auto flex-shrink-0">&rarr; {step.selectedOption}</span>
                                )}
                              </div>
                            ))}
                          </div>
                          {diagnosis.outcome === 'skipped' && diagnosis.skip_reason && (
                            <p className="text-xs text-accent-amber mt-2">Skipped: {diagnosis.skip_reason}</p>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">{readinessBadge(f.readiness)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        f.resolution_status === 'ACKNOWLEDGED'
                          ? 'bg-accent-amber/20 text-accent-amber'
                          : 'bg-accent-red/20 text-accent-red'
                      }`}>
                        {f.resolution_status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="text"
                        placeholder="WO#"
                        value={workOrderInputs[f.id] ?? f.gcss_work_order ?? ''}
                        onChange={(e) => setWorkOrderInputs((prev) => ({ ...prev, [f.id]: e.target.value }))}
                        className="w-28 px-2 py-1 bg-bg-tertiary border border-border rounded text-xs text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-accent-blue"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {f.resolution_status === 'OPEN' && (
                          <button
                            onClick={() => handleAcknowledge(f.id)}
                            disabled={resolvingId === f.id}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-accent-amber/20 text-accent-amber rounded-lg text-xs font-medium hover:bg-accent-amber/30 disabled:opacity-50 transition-colors"
                          >
                            {resolvingId === f.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                            GCSS-A
                          </button>
                        )}
                        <button
                          onClick={() => handleResolve(f.id)}
                          disabled={resolvingId === f.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-green/20 text-accent-green rounded-lg text-xs font-medium hover:bg-accent-green/30 disabled:opacity-50 transition-colors"
                        >
                          {resolvingId === f.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <CheckCircle className="w-3 h-3" />
                          )}
                          Resolve
                        </button>
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

      {/* Inspection History */}
      <div className="bg-bg-secondary border border-border rounded-xl">
        <div className="p-6 border-b border-border">
          <h2 className="font-display text-lg font-semibold text-text-primary">
            Inspection History
          </h2>
        </div>

        {inspections.length === 0 ? (
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
                {inspections.map((ins) => (
                  <tr key={ins.id} className="hover:bg-bg-tertiary transition-colors">
                    <td className="px-6 py-4 text-sm text-text-primary">
                      {ins.completed_at ? new Date(ins.completed_at).toLocaleDateString() : '---'}
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">
                      {ins.inspection_type ?? '---'}
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">
                      {ins.inspectorName}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {ins.faultCount > 0 ? (
                        <span className="text-accent-red font-semibold">{ins.faultCount}</span>
                      ) : (
                        <span className="text-accent-green">0</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {ins.pdfPath ? (
                        <button
                          onClick={() => handleDownloadPdf(ins.pdfPath!)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-blue/20 text-accent-blue rounded-lg text-xs font-medium hover:bg-accent-blue/30 transition-colors"
                        >
                          <FileDown className="w-3 h-3" />
                          Download
                        </button>
                      ) : (
                        <button
                          disabled={generatingId === ins.id}
                          onClick={() => handleGeneratePdf(ins.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-tertiary text-text-secondary rounded-lg text-xs font-medium hover:bg-bg-tertiary/80 disabled:opacity-50 transition-colors"
                        >
                          <FileDown className="w-3 h-3" />
                          {generatingId === ins.id ? 'Generating...' : 'Generate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
