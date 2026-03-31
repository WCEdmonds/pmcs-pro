import { db } from './db';
import { supabase } from './supabase';

export async function getUnitName(uic: string): Promise<string | null> {
  if (!uic) return null;
  const upper = uic.toUpperCase();

  // Check local cache first
  const local = await db.uicLookup.get(upper);
  if (local) return local.unitName;

  // Check Supabase
  const { data } = await supabase.from('uic_lookup').select('unit_name').eq('uic', upper).single();
  if (data) {
    await db.uicLookup.put({ uic: upper, unitName: data.unit_name });
    return data.unit_name;
  }

  return null;
}

export async function saveUicMapping(uic: string, unitName: string): Promise<void> {
  const upper = uic.toUpperCase();
  await db.uicLookup.put({ uic: upper, unitName });
  try {
    await supabase.from('uic_lookup').upsert({ uic: upper, unit_name: unitName });
  } catch {
    // Non-critical
  }
}
