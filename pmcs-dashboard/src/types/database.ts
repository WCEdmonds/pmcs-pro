// Shapes returned by the PMCS Pro API (pmcs-api). SQLite 0/1 flags arrive as
// booleans and JSON columns (photo_urls, steps_completed) arrive parsed.

export type VehicleStatus = 'FMC' | 'PMC' | 'NMC' | 'DEADLINE'

export type InspectionStatus = 'IN_PROGRESS' | 'COMPLETED'

export type Readiness = 'PMC' | 'NMC'

export type ResolutionStatus = 'OPEN' | 'ACKNOWLEDGED' | 'CORRECTED'

export interface Profile {
  id: string
  dod_id: string
  rank: string | null
  last_name: string | null
  first_name: string | null
  mi: string | null
  unit: string | null
  created_at: string
  /** Own unit first, then watched units (GET /me). */
  visible_units?: string[]
}

/** Editable profile fields (PATCH /me). */
export type ProfileUpdate = Partial<Pick<Profile, 'rank' | 'last_name' | 'first_name' | 'mi' | 'unit'>>

/** Public subset returned by GET /profiles?id= */
export interface ProfileSummary {
  id: string
  rank: string | null
  last_name: string | null
  first_name: string | null
}

export interface Vehicle {
  id: string
  bumper_number: string | null
  bumper_number_normalized?: string | null
  vehicle_type: string | null
  serial_number: string | null
  registration_number: string | null
  nomenclature: string | null
  unit: string | null
  current_odometer: number | null
  status: VehicleStatus | null
  section?: string | null
  lin_number?: string | null
  nsn?: string | null
  description?: string | null
  created_at: string
  updated_at: string
}

export interface Inspection {
  id: string
  vehicle_id: string
  inspector_id: string
  inspection_type: string | null
  status: InspectionStatus | null
  odometer_reading: number | null
  remarks: string | null
  /** Inspection calendar day (YYYY-MM-DD) as entered in the field app. */
  date: string | null
  started_at: string | null
  completed_at: string | null
  client_session_id: string | null
}

/** GET /vehicles/last-inspections */
export interface LastInspection {
  vehicle_id: string
  last_completed_at: string | null
}

export interface Fault {
  id: string
  inspection_id: string
  vehicle_id: string
  item: string | null
  item_description: string | null
  zone: string | null
  readiness: Readiness | null
  category_id: string | null
  description: string | null
  corrective_action: string | null
  part_needed: boolean | null
  part_description: string | null
  nsn: string | null
  corrected_on_site: boolean | null
  needs_maintenance: boolean | null
  resolution_status: ResolutionStatus | null
  gcss_work_order: string | null
  /** When the fault reached the server (sync time), not when it was found. */
  created_at: string
  photo_urls: string[] | null
  resolved_at: string | null
  resolved_by: string | null
}

export interface GeneratedForm {
  inspection_id: string
  pdf_storage_path: string | null
  id?: string
  vehicle_id?: string | null
  generated_at?: string
}

export interface WatchedUic {
  id: string
  uic: string
  created_at?: string
}

export interface VehicleStatusSnapshot {
  vehicle_id: string
  status: VehicleStatus
  /** Snapshot day (YYYY-MM-DD). */
  recorded_at: string
}

export interface DiagnosisStep {
  nodeId: string
  nodeText: string
  selectedOption?: string
  timestamp: string
}

export interface DiagnosisAttempt {
  id: string
  fault_id: string
  session_id: string
  category_id: string
  steps_completed: DiagnosisStep[]
  outcome: 'operator-fix' | 'needs-maintenance' | 'skipped'
  skip_reason: string | null
  readiness_result: Readiness
  completed_at: string
}
