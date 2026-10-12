import { db } from './db';
import { api } from './api';

export async function getUnitName(uic: string): Promise<string | null> {
  if (!uic) return null;
  const upper = uic.toUpperCase();

  // Check local cache first
  const local = await db.uicLookup.get(upper);
  if (local) return local.unitName;

  // Check the server
  try {
    const data = await api<{ unit_name: string }>('GET', `/uic/${encodeURIComponent(upper)}`);
    await db.uicLookup.put({ uic: upper, unitName: data.unit_name });
    return data.unit_name;
  } catch {
    return null;
  }
}

export async function saveUicMapping(uic: string, unitName: string): Promise<void> {
  const upper = uic.toUpperCase();
  await db.uicLookup.put({ uic: upper, unitName });
  try {
    await api('PUT', `/uic/${encodeURIComponent(upper)}`, { body: { unit_name: unitName } });
  } catch {
    // Non-critical
  }
}
