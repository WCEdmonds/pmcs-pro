import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { toWinAnsi } from './winansi';
// Same blank form the field app uses for client-side generation (bundled as binary by wrangler).
import template from '../../pmcs-app/public/da2404-template.pdf';

export interface Da2404Fault {
  item: string | null;
  item_description: string | null;
  description: string | null;
  readiness: string | null;
  corrective_action: string | null;
  corrected_on_site: number | null;
  needs_maintenance: number | null;
  part_needed: number | null;
  part_description: string | null;
  nsn: string | null;
}

export interface Da2404Input {
  unitName: string;
  vehicleType: string | null;
  nomenclature: string | null;
  registration: string;
  odometer: number | null;
  date: string | null;
  inspectionType: string | null;
  inspectorName: string;
  inspectorDodId: string | null;
  supervisorName?: string | null;
  supervisorDodId?: string | null;
  /** Inspector's local time as 'HHMM'; defaults to the current UTC time + 'Z'. */
  localTime?: string | null;
  faults: Da2404Fault[];
}

// Keyed by the app's VehicleType and by roster model numbers.
const norm = (s: string) => s.toUpperCase().replace(/[\s-]/g, '');
// Which TM covers which model (verified against each TM's cover page). Dates are the latest change.
const TM_BY_TYPE: Array<{ test: (m: string) => boolean; tm: string; tmDate: string }> = [
  { test: (m) => /^M110[12]/.test(m), tm: 'TM 9-2330-392-14&P', tmDate: '20010427' },
  { test: (m) => /^MEP(803|813)/.test(m), tm: 'TM 9-6115-642-10', tmDate: '19961030' },
  { test: (m) => /^M1078(?!A)/.test(m) || m === 'LMTVM1078' || m === 'LMTV_M1078', tm: 'TM 9-2320-365-10', tmDate: '20010531' },
  { test: (m) => /^(M1151|M1152|M1113|M1165)/.test(m), tm: 'TM 9-2320-387-10', tmDate: '20090630' },
];

function tmFor(vehicleType: string | null) {
  if (!vehicleType) return { tm: '', tmDate: '' };
  const m = norm(vehicleType);
  return TM_BY_TYPE.find((t) => t.test(m)) ?? { tm: '', tmDate: '' };
}

function formatInspectionType(type: string | null): string {
  switch (type) {
    case 'BEFORE': return 'B';
    case 'DURING': return 'D';
    case 'AFTER': return 'A';
    case '30_DAY': return '30-Day';
    default: return type ?? '';
  }
}

export async function fillDa2404(input: Da2404Input): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(template, { ignoreEncryption: true });
  const form = pdfDoc.getForm();
  const setField = (name: string, value: string) => {
    try {
      form.getTextField(name).setText(toWinAnsi(value));
    } catch {
      // Field missing or not a text field — skip
    }
  };

  const { tm, tmDate } = tmFor(input.vehicleType);
  setField('form1[0].Page1[0].ORGANIZ[0]', input.unitName);
  setField('form1[0].Page1[0].NOMENMODEL[0]', input.nomenclature || input.vehicleType || '');
  setField('form1[0].Page1[0].REGISTRAT[0]', input.registration);
  setField('form1[0].Page1[0].MILES[0]', input.odometer != null ? String(input.odometer) : '');
  setField('form1[0].Page1[0].DATE[0]', (input.date ?? '').replace(/-/g, ''));
  setField('form1[0].Page1[0].TYPEINSPEC[0]', formatInspectionType(input.inspectionType));
  setField('form1[0].Page1[0].TMNUM_A[0]', tm);
  setField('form1[0].Page1[0].TMDATE_A[0]', tmDate);
  setField('form1[0].Page1[0].TIME_A[0]', input.localTime || `${new Date().toISOString().slice(11, 16).replace(':', '')}Z`);

  const rows = input.faults.length === 0
    ? [{ tmItem: '', status: '/', deficiency: 'PMCS COMPLETED — NO DEFICIENCIES FOUND', corrective: '' }]
    : input.faults.map((f) => ({
        tmItem: f.item ?? '',
        status: f.readiness === 'NMC' ? 'X' : '/',
        deficiency: `${f.item_description ?? ''}: ${f.description ?? ''}`,
        corrective: f.corrected_on_site
          ? (f.corrective_action || 'Corrected on site by operator')
          : f.needs_maintenance
            ? `Requires maintenance support${f.part_needed ? ` — Parts: ${f.part_description || 'TBD'}${f.nsn ? ` (NSN ${f.nsn})` : ''}` : ''}`
            : '',
      }));

  for (let i = 0; i < Math.min(rows.length, 14); i++) {
    const r = rows[i];
    const s = i === 0 ? '' : `_${i}`;
    setField(`form1[0].Page1[0].TMNO${s}[0]`, r.tmItem);
    setField(`form1[0].Page1[0].STAT${s}[0]`, r.status);
    setField(`form1[0].Page1[0].DEFIC${s}[0]`, r.deficiency);
    setField(`form1[0].Page1[0].CORRECT${s}[0]`, r.corrective);
  }
  for (let i = 14; i < Math.min(rows.length, 42); i++) {
    const r = rows[i];
    const s = i === 14 ? '' : `_${i - 14}`;
    setField(`form1[0].Page2[0].TM_B${s}[0]`, r.tmItem);
    setField(`form1[0].Page2[0].STAT_B${s}[0]`, r.status);
    setField(`form1[0].Page2[0].DEF_B${s}[0]`, r.deficiency);
    setField(`form1[0].Page2[0].COR_B${s}[0]`, r.corrective);
  }

  const page = pdfDoc.getPages()[0];
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const h = page.getHeight();
  const drawText = (text: string, opts: Parameters<typeof page.drawText>[1]) => page.drawText(toWinAnsi(text), opts);
  drawText(input.inspectorName, { x: 42, y: h - 360, size: 9, font, color: rgb(0, 0, 0) });
  if (input.inspectorDodId) {
    drawText(`DOD ID: ${input.inspectorDodId}`, { x: 42, y: h - 372, size: 7, font, color: rgb(0.3, 0.3, 0.3) });
  }

  if (input.supervisorName) {
    drawText(input.supervisorName, { x: 287, y: h - 360, size: 9, font, color: rgb(0, 0, 0) });
    if (input.supervisorDodId) {
      drawText(`DOD ID: ${input.supervisorDodId}`, { x: 287, y: h - 372, size: 7, font, color: rgb(0.3, 0.3, 0.3) });
    }
  }

  try {
    form.flatten();
  } catch {
    // Some forms don't flatten cleanly
  }
  return pdfDoc.save();
}
