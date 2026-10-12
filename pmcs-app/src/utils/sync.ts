import { api } from './api';
import type { InspectionSession, Fault } from '../types';
import { VEHICLE_REGISTRY } from '../data/vehicles';
import { normalizeUic } from './auth';

export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export interface SyncResponse {
  inspection_id: string;
  vehicle_id?: string;
  fault_ids: string[];
}

export function buildSyncBody(session: InspectionSession, faults: Fault[], userUnit: string) {
  const vehicle = VEHICLE_REGISTRY.find((v) => v.type === session.vehicleType);
  return {
    vehicle: {
      bumper_number: session.bumperNumber.trim(),
      vehicle_type: session.vehicleType,
      serial_number: session.serialNumber || null,
      registration_number: session.registrationNumber || null,
      nomenclature: vehicle?.name || session.vehicleType,
      // The server only accepts the signed-in user's own unit.
      unit: normalizeUic(userUnit || session.unit || ''),
      current_odometer: Number.isFinite(session.odometer) ? session.odometer : null,
    },
    inspection: {
      inspector_dod_id: session.inspectorDodId,
      inspection_type: session.inspectionType,
      odometer_reading: Number.isFinite(session.odometer) ? session.odometer : null,
      remarks: session.remarks?.trim() || null,
      date: session.date,
      started_at: session.createdAt,
      completed_at: session.completedAt || session.createdAt,
      client_session_id: session.id,
    },
    faults: faults.map((f) => ({
      client_fault_id: f.id,
      item: f.item,
      item_description: f.itemDescription,
      zone: f.zone,
      readiness: f.readiness,
      category_id: f.categoryId || null,
      description: f.description,
      corrective_action: f.correctiveAction || null,
      part_needed: f.partNeeded,
      part_description: f.partDescription || null,
      nsn: f.nsn || null,
      corrected_on_site: f.correctedOnSite,
      needs_maintenance: f.needsMaintenance,
    })),
  };
}

/** POST /inspections/sync — idempotent on client_session_id. Returns the server ids. */
export async function postInspection(session: InspectionSession, faults: Fault[], userUnit: string): Promise<SyncResponse> {
  const res = await api<SyncResponse>('POST', '/inspections/sync', {
    body: buildSyncBody(session, faults, userUnit),
    timeoutMs: 30_000,
  });
  if (!res || typeof res.inspection_id !== 'string' || !Array.isArray(res.fault_ids)) {
    throw new Error('Server returned an unexpected sync response');
  }
  return res;
}
