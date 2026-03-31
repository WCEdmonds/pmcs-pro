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
}

export interface Vehicle {
  id: string
  bumper_number: string | null
  vehicle_type: string | null
  serial_number: string | null
  registration_number: string | null
  nomenclature: string | null
  unit: string | null
  current_odometer: number | null
  status: VehicleStatus | null
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
  date: string | null
  started_at: string | null
  completed_at: string | null
  client_session_id: string | null
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
  part_needed: string | null
  part_description: string | null
  nsn: string | null
  corrected_on_site: boolean | null
  resolution_status: ResolutionStatus | null
  gcss_work_order: string | null
  created_at: string
  photo_urls: string[] | null
  resolved_at: string | null
  resolved_by: string | null
}

export interface GeneratedForm {
  id: string
  inspection_id: string
  vehicle_id: string
  pdf_storage_path: string | null
  generated_at: string
}

export interface DashboardWatchedUic {
  id: string
  user_id: string
  uic: string
  created_at: string
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

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at'>
        Update: Partial<Omit<Profile, 'id'>>
      }
      vehicles: {
        Row: Vehicle
        Insert: Omit<Vehicle, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Vehicle, 'id'>>
      }
      inspections: {
        Row: Inspection
        Insert: Omit<Inspection, 'id'>
        Update: Partial<Omit<Inspection, 'id'>>
      }
      faults: {
        Row: Fault
        Insert: Omit<Fault, 'id' | 'created_at'>
        Update: Partial<Omit<Fault, 'id'>>
      }
      generated_forms: {
        Row: GeneratedForm
        Insert: Omit<GeneratedForm, 'id'>
        Update: Partial<Omit<GeneratedForm, 'id'>>
      }
      diagnosis_attempts: {
        Row: DiagnosisAttempt
        Insert: Omit<DiagnosisAttempt, 'id'>
        Update: Partial<Omit<DiagnosisAttempt, 'id'>>
      }
      dashboard_watched_uics: {
        Row: DashboardWatchedUic
        Insert: Omit<DashboardWatchedUic, 'id' | 'created_at'>
        Update: Partial<Omit<DashboardWatchedUic, 'id'>>
      }
    }
  }
}
