import { describe, it, expect } from 'vitest';
import type { Fault, Vehicle, Inspection, VehicleStatus, Readiness, ResolutionStatus } from '../types/database';

describe('Dashboard type contracts', () => {
  it('Fault interface includes photo_urls field', () => {
    const fault: Fault = {
      id: 'f1',
      inspection_id: 'i1',
      vehicle_id: 'v1',
      item: '1',
      item_description: 'Test item',
      zone: 'Exterior',
      readiness: 'NMC',
      category_id: 'fluid-leak',
      description: 'Oil leak',
      corrective_action: null,
      part_needed: null,
      part_description: null,
      nsn: null,
      corrected_on_site: false,
      resolution_status: 'OPEN',
      gcss_work_order: null,
      photo_urls: ['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg'],
      created_at: '2026-03-31T00:00:00Z',
      resolved_at: null,
      resolved_by: null,
    };
    expect(fault.photo_urls).toHaveLength(2);
  });

  it('Fault photo_urls can be null', () => {
    const fault: Fault = {
      id: 'f2',
      inspection_id: 'i1',
      vehicle_id: 'v1',
      item: '2',
      item_description: 'Another item',
      zone: 'Cab',
      readiness: 'PMC',
      category_id: null,
      description: 'Minor issue',
      corrective_action: null,
      part_needed: null,
      part_description: null,
      nsn: null,
      corrected_on_site: true,
      resolution_status: 'CORRECTED',
      gcss_work_order: null,
      photo_urls: null,
      created_at: '2026-03-31T00:00:00Z',
      resolved_at: '2026-03-31T01:00:00Z',
      resolved_by: 'user-1',
    };
    expect(fault.photo_urls).toBeNull();
  });

  it('VehicleStatus values are valid', () => {
    const statuses: VehicleStatus[] = ['FMC', 'PMC', 'NMC', 'DEADLINE'];
    expect(statuses).toHaveLength(4);
  });

  it('Readiness values are valid', () => {
    const values: Readiness[] = ['PMC', 'NMC'];
    expect(values).toHaveLength(2);
  });

  it('ResolutionStatus values are valid', () => {
    const values: ResolutionStatus[] = ['OPEN', 'ACKNOWLEDGED', 'CORRECTED'];
    expect(values).toHaveLength(3);
  });

  it('Vehicle interface has all required fields', () => {
    const vehicle: Vehicle = {
      id: 'v1',
      bumper_number: 'HQ-7',
      vehicle_type: 'M1152A1',
      serial_number: '330905',
      registration_number: null,
      nomenclature: 'TRK UT EX CAP M1152A1',
      unit: 'WABC12',
      current_odometer: 45000,
      status: 'FMC',
      created_at: '2026-03-30T00:00:00Z',
      updated_at: '2026-03-31T00:00:00Z',
    };
    expect(vehicle.bumper_number).toBe('HQ-7');
    expect(vehicle.status).toBe('FMC');
  });

  it('Inspection interface has client_session_id for dedup', () => {
    const inspection: Inspection = {
      id: 'insp-1',
      vehicle_id: 'v1',
      inspector_id: 'profile-1',
      inspection_type: 'BEFORE',
      status: 'COMPLETED',
      odometer_reading: 45100,
      remarks: null,
      date: '2026-03-31',
      started_at: '2026-03-31T08:00:00Z',
      completed_at: '2026-03-31T09:30:00Z',
      client_session_id: 'uuid-from-app',
    };
    expect(inspection.client_session_id).toBe('uuid-from-app');
  });
});
