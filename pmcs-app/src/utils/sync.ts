import { api, getSessionUserId } from './api';
import { db } from './db';
import type { InspectionSession, Fault } from '../types';
import { VEHICLE_REGISTRY } from '../data/vehicles';

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export async function syncInspection(
  session: InspectionSession,
  faults: Fault[]
): Promise<string> {
  // Verify we have an auth session
  if (!getSessionUserId()) {
    throw new Error('No auth session — sign out and sign back in to enable sync');
  }

  const vehicle = VEHICLE_REGISTRY.find((v) => v.type === session.vehicleType);

  // Vehicle upsert + inspection upsert + fault insert happen server-side in one
  // call, idempotent on the client session id so retries don't duplicate faults.
  const result = await api<{ inspection_id: string; fault_ids: string[] }>('POST', '/inspections/sync', {
    body: {
      vehicle: {
        bumper_number: session.bumperNumber,
        vehicle_type: session.vehicleType,
        serial_number: session.serialNumber || null,
        registration_number: session.registrationNumber || null,
        nomenclature: vehicle?.name || session.vehicleType,
        unit: session.unit,
        current_odometer: session.odometer,
      },
      inspection: {
        inspector_dod_id: session.inspectorDodId,
        inspection_type: session.inspectionType,
        odometer_reading: session.odometer,
        remarks: session.remarks || null,
        date: session.date,
        started_at: session.createdAt,
        completed_at: session.completedAt || new Date().toISOString(),
        client_session_id: session.id,
      },
      faults: faults.map((f) => ({
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
    },
  });

  // Upload fault photos
  for (let i = 0; i < faults.length; i++) {
    const remoteFaultId = result.fault_ids[i];
    if (!remoteFaultId) continue;

    const photos = await db.photos.where('faultId').equals(faults[i].id).toArray();
    for (const photo of photos) {
      const blob = dataUrlToBlob(photo.dataUrl);
      try {
        await api('POST', `/faults/${remoteFaultId}/photos`, {
          query: { session: session.id, photo: photo.id, ext: blob.type === 'image/png' ? 'png' : 'jpg' },
          raw: blob,
        });
      } catch (err) {
        console.warn('Sync: Photo upload failed:', (err as Error).message);
      }
    }
  }

  console.log('Sync: Inspection synced successfully', { inspectionId: result.inspection_id, faults: faults.length });
  return result.inspection_id;
}

export async function pullOpenFaultsForVehicle(bumperNumber: string, unit: string) {
  const vehicles = await api<{ id: string }[]>('GET', '/vehicles', { query: { bumper_number: bumperNumber, unit } });
  if (vehicles.length === 0) return [];
  return api<unknown[]>('GET', '/faults', { query: { vehicle_id: vehicles[0].id, open: 1, order: 'asc' } });
}

export async function pullUnitVehicles(unit: string) {
  return api<unknown[]>('GET', '/vehicles', { query: { unit } });
}
