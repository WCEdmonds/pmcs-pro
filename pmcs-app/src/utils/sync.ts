import { supabase } from './supabase';
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

export async function syncInspectionToSupabase(
  session: InspectionSession,
  faults: Fault[]
) {
  // Verify we have an auth session
  const { data: { session: authSession } } = await supabase.auth.getSession();
  if (!authSession) {
    throw new Error('No auth session — sign out and sign back in to enable sync');
  }

  const vehicle = VEHICLE_REGISTRY.find((v) => v.type === session.vehicleType);

  // Step 1: Upsert vehicle (normalized bumper number handles HQ-4 vs HQ4)
  const bumperNormalized = session.bumperNumber.replace(/[-\s]/g, '').toUpperCase();
  const { data: vehicleData, error: vehicleError } = await supabase.from('vehicles').upsert({
    bumper_number: session.bumperNumber,
    bumper_number_normalized: bumperNormalized,
    vehicle_type: session.vehicleType,
    serial_number: session.serialNumber || null,
    registration_number: session.registrationNumber || null,
    nomenclature: vehicle?.name || session.vehicleType,
    unit: session.unit,
    current_odometer: session.odometer,
  } as never, { onConflict: 'bumper_number_normalized,unit' }).select('id').single();

  if (vehicleError) {
    console.error('Sync: Vehicle upsert failed:', vehicleError.message);
    return;
  }
  if (!vehicleData) {
    console.error('Sync: Vehicle upsert returned no data');
    return;
  }

  // Step 2: Get profile ID for inspector
  const { data: profile, error: profileError } = await supabase.from('profiles')
    .select('id')
    .eq('dod_id', session.inspectorDodId)
    .single();

  if (profileError || !profile) {
    console.error('Sync: Profile lookup failed:', profileError?.message);
    return;
  }

  // Step 3: Insert inspection
  const { data: inspection, error: inspError } = await supabase.from('inspections').upsert({
    vehicle_id: vehicleData.id,
    inspector_id: profile.id,
    inspection_type: session.inspectionType,
    status: 'COMPLETED',
    odometer_reading: session.odometer,
    remarks: session.remarks || null,
    date: session.date,
    started_at: session.createdAt,
    completed_at: session.completedAt || new Date().toISOString(),
    client_session_id: session.id,
  } as never, { onConflict: 'client_session_id' }).select('id').single();

  if (inspError || !inspection) {
    console.error('Sync: Inspection upsert failed:', inspError?.message);
    return;
  }

  // Step 4: Insert faults
  if (faults.length > 0) {
    const faultRows = faults.map((f) => ({
      inspection_id: inspection.id,
      vehicle_id: vehicleData.id,
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
      resolution_status: f.correctedOnSite ? 'CORRECTED' : 'OPEN',
    }));
    const { data: insertedFaults, error: faultError } = await supabase
      .from('faults')
      .insert(faultRows as never)
      .select('id, item');
    if (faultError) {
      console.error('Sync: Fault insert failed:', faultError.message);
    }

    // Step 5: Upload fault photos to Supabase Storage
    if (insertedFaults) {
      for (let i = 0; i < faults.length; i++) {
        const localFault = faults[i];
        const remoteFault = insertedFaults[i] as { id: string };
        if (!remoteFault) continue;

        const photos = await db.photos.where('faultId').equals(localFault.id).toArray();
        if (photos.length === 0) continue;

        const photoUrls: string[] = [];
        for (const photo of photos) {
          const blob = dataUrlToBlob(photo.dataUrl);
          const ext = blob.type === 'image/png' ? 'png' : 'jpg';
          const path = `${session.id}/${remoteFault.id}/${photo.id}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from('fault-photos')
            .upload(path, blob, { contentType: blob.type });
          if (uploadError) {
            console.warn('Sync: Photo upload failed:', uploadError.message);
            continue;
          }
          const { data: urlData } = supabase.storage.from('fault-photos').getPublicUrl(path);
          photoUrls.push(urlData.publicUrl);
        }

        if (photoUrls.length > 0) {
          await supabase.from('faults')
            .update({ photo_urls: photoUrls } as never)
            .eq('id', remoteFault.id);
        }
      }
    }
  }

  console.log('Sync: Inspection synced successfully', { inspectionId: inspection.id, faults: faults.length });
}

export async function pullOpenFaultsForVehicle(bumperNumber: string, unit: string) {

  const { data: vehicle } = await supabase.from('vehicles')
    .select('id')
    .eq('bumper_number', bumperNumber)
    .eq('unit', unit)
    .single();

  if (!vehicle) return [];

  const { data: faults } = await supabase.from('faults')
    .select('*')
    .eq('vehicle_id', vehicle.id)
    .neq('resolution_status', 'CORRECTED')
    .order('created_at', { ascending: true });

  return faults || [];
}

export async function pullUnitVehicles(unit: string) {

  const { data } = await supabase.from('vehicles')
    .select('*')
    .eq('unit', unit);

  return data || [];
}
