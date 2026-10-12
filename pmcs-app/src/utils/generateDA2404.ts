import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { InspectionSession, StepResult, Fault } from '../types';
import { VEHICLE_REGISTRY } from '../data/vehicles';
import { getUnitName } from './uicLookup';
import { sanitizeLine } from './winAnsi';
import { inspectionTypeLabel } from './inspectionTypes';

interface GenerateInput {
  session: InspectionSession;
  stepResults: StepResult[];
  faults: Fault[];
  supervisorName?: string;
  supervisorDodId?: string;
}

export const PAGE1_ROWS = 14;
export const PAGE2_ROWS = 28;
export const MAX_ROWS = PAGE1_ROWS + PAGE2_ROWS;

export interface Da2404Row {
  tmItem: string;
  status: string;
  deficiency: string;
  corrective: string;
}

// Fallback TM publication dates (YYYYMMDD) when VEHICLE_REGISTRY has no tmDate.
const FALLBACK_TM_DATES: Record<string, string> = {
  M1151: '20060901', // TM 9-2320-387-10, Sep 2006
  M1152: '20060901',
  LMTV_M1078: '19981001', // TM 9-2320-365-10, Oct 1998
};

export function tmDateFor(vehicleType: string): string {
  const entry = VEHICLE_REGISTRY.find((v) => v.type === vehicleType) as { tmDate?: string } | undefined;
  return entry?.tmDate || FALLBACK_TM_DATES[vehicleType] || '';
}

const REMARK_CHUNK = 70;

function chunk(text: string, size: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > size && line) {
      out.push(line);
      line = w;
    } else {
      line = (line + ' ' + w).trim();
    }
  }
  if (line) out.push(line);
  return out;
}

/**
 * Builds the fault-table rows: faults (or a "no deficiencies" line), then
 * remarks (the form has no remarks block). Never silently drops rows: if there
 * are more than fit, the last row says how many are missing.
 */
export function buildRows(faults: Fault[], remarks?: string): Da2404Row[] {
  const rows: Da2404Row[] = [];
  if (faults.length === 0) {
    rows.push({ tmItem: '', status: '', deficiency: 'PMCS COMPLETED - NO DEFICIENCIES FOUND', corrective: '' });
  } else {
    for (const fault of faults) {
      rows.push({
        tmItem: fault.item,
        status: fault.readiness === 'NMC' ? 'X' : '/',
        deficiency: `${fault.itemDescription}: ${fault.description}`,
        corrective: fault.correctedOnSite
          ? (fault.correctiveAction || 'Corrected on site by operator')
          : fault.needsMaintenance
            ? `Requires maintenance support${fault.partNeeded ? ` - Parts: ${fault.partDescription || 'TBD'}${fault.nsn ? ` (NSN ${fault.nsn})` : ''}` : ''}`
            : '',
      });
    }
  }

  const remarkText = sanitizeLine(remarks);
  if (remarkText) {
    chunk(`REMARKS: ${remarkText}`, REMARK_CHUNK).forEach((line) =>
      rows.push({ tmItem: '', status: '', deficiency: line, corrective: '' }),
    );
  }

  if (rows.length > MAX_ROWS) {
    const kept = rows.slice(0, MAX_ROWS - 1);
    const missing = rows.length - kept.length;
    kept.push({
      tmItem: '',
      status: '',
      deficiency: `*** ${missing} MORE ENTRIES NOT SHOWN - FORM FULL ***`,
      corrective: 'See PMCS Pro inspection record / continuation sheet',
    });
    return kept;
  }
  return rows;
}

export class Da2404Error extends Error {}

async function loadTemplate(): Promise<ArrayBuffer> {
  let res: Response;
  try {
    res = await fetch('/da2404-template.pdf');
  } catch {
    throw new Da2404Error('Could not load the DA 2404 template. Open the app once while online so it is saved for offline use.');
  }
  if (!res.ok) throw new Da2404Error(`Could not load the DA 2404 template (${res.status}).`);
  return res.arrayBuffer();
}

export async function generateDA2404({ session, faults, supervisorName, supervisorDodId }: GenerateInput): Promise<Uint8Array> {
  const templateBytes = await loadTemplate();
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true });

  const form = pdfDoc.getForm();
  const vehicle = VEHICLE_REGISTRY.find((v) => v.type === session.vehicleType);

  const setField = (name: string, value: string) => {
    let field;
    try {
      field = form.getTextField(name);
    } catch {
      return; // field doesn't exist in this template
    }
    const text = sanitizeLine(value);
    const max = field.getMaxLength();
    field.setText(max ? text.slice(0, max) : text);
  };

  // === HEADER FIELDS ===
  const unitName = (await getUnitName(session.unit).catch(() => null)) || session.unit;
  setField('form1[0].Page1[0].ORGANIZ[0]', unitName);
  setField('form1[0].Page1[0].NOMENMODEL[0]', vehicle?.name || session.vehicleType);
  setField('form1[0].Page1[0].REGISTRAT[0]', session.serialNumber || session.bumperNumber);
  setField('form1[0].Page1[0].MILES[0]', Number.isFinite(session.odometer) ? String(session.odometer) : '');
  setField('form1[0].Page1[0].DATE[0]', formatDate(session.date));
  setField('form1[0].Page1[0].TYPEINSPEC[0]', formatInspectionType(session.inspectionType));
  setField('form1[0].Page1[0].TMNUM_A[0]', vehicle?.tmReference || '');
  setField('form1[0].Page1[0].TMDATE_A[0]', tmDateFor(session.vehicleType));
  const when = session.completedAt ? new Date(session.completedAt) : new Date();
  setField('form1[0].Page1[0].TIME_A[0]', when.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', ''));

  // === FAULT TABLE ROWS === (page 1: 14 rows, page 2: 28 rows)
  const rows = buildRows(faults, session.remarks);
  rows.forEach((row, i) => {
    if (i < PAGE1_ROWS) {
      const suffix = i === 0 ? '' : `_${i}`;
      setField(`form1[0].Page1[0].TMNO${suffix}[0]`, row.tmItem);
      setField(`form1[0].Page1[0].STAT${suffix}[0]`, row.status);
      setField(`form1[0].Page1[0].DEFIC${suffix}[0]`, row.deficiency);
      setField(`form1[0].Page1[0].CORRECT${suffix}[0]`, row.corrective);
    } else {
      const pageIdx = i - PAGE1_ROWS;
      const suffix = pageIdx === 0 ? '' : `_${pageIdx}`;
      setField(`form1[0].Page2[0].TM_B${suffix}[0]`, row.tmItem);
      setField(`form1[0].Page2[0].STAT_B${suffix}[0]`, row.status);
      setField(`form1[0].Page2[0].DEF_B${suffix}[0]`, row.deficiency);
      setField(`form1[0].Page2[0].COR_B${suffix}[0]`, row.corrective);
    }
  });

  // Names in the signature blocks (signature fields can't take text via pdf-lib)
  const page = pdfDoc.getPages()[0];
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pageHeight = page.getHeight();
  const draw = (text: string, x: number, yFromTop: number, size: number, grey = false) => {
    const safe = sanitizeLine(text);
    if (!safe) return;
    page.drawText(safe, { x, y: pageHeight - yFromTop, size, font, color: grey ? rgb(0.3, 0.3, 0.3) : rgb(0, 0, 0) });
  };

  draw(`${session.inspectorRank} ${session.inspectorName}`.trim(), 42, 360, 9);
  if (session.inspectorDodId && session.inspectorDodId !== 'anonymous') draw(`DOD ID: ${session.inspectorDodId}`, 42, 372, 7, true);
  if (supervisorName) {
    draw(supervisorName, 287, 360, 9);
    if (supervisorDodId) draw(`DOD ID: ${supervisorDodId}`, 287, 372, 7, true);
  }

  try {
    form.flatten();
  } catch {
    // Some forms don't flatten cleanly — that's OK
  }

  return pdfDoc.save();
}

export function formatDate(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

export function formatInspectionType(type: string): string {
  switch (type) {
    case 'BEFORE': return 'B';
    case 'DURING': return 'D';
    case 'AFTER': return 'A';
    case '30_DAY': return '30-Day';
    default: return inspectionTypeLabel(type);
  }
}
