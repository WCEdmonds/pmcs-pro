import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { InspectionSession, StepResult, Fault } from '../types';
import { VEHICLE_REGISTRY } from '../data/vehicles';
import { getUnitName } from './uicLookup';

interface GenerateInput {
  session: InspectionSession;
  stepResults: StepResult[];
  faults: Fault[];
  supervisorName?: string;
  supervisorDodId?: string;
}

export async function generateDA2404({ session, faults, supervisorName, supervisorDodId }: GenerateInput): Promise<Uint8Array> {
  // Load the blank DA 2404 template
  const templateUrl = '/da2404-template.pdf';
  const templateResponse = await fetch(templateUrl);
  const templateBytes = await templateResponse.arrayBuffer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfDoc = await PDFDocument.load(templateBytes as any, { ignoreEncryption: true });

  const form = pdfDoc.getForm();
  const vehicle = VEHICLE_REGISTRY.find((v) => v.type === session.vehicleType);

  // Helper to safely set field value
  const setField = (name: string, value: string) => {
    try {
      const field = form.getTextField(name);
      field.setText(value);
    } catch {
      // Field may not exist or be a different type — skip
    }
  };

  // === HEADER FIELDS ===
  // Use the human-readable unit name for the Organization field, fall back to UIC
  const unitName = await getUnitName(session.unit) || session.unit;
  setField('form1[0].Page1[0].ORGANIZ[0]', unitName);
  setField('form1[0].Page1[0].NOMENMODEL[0]', vehicle?.name || session.vehicleType);
  setField('form1[0].Page1[0].REGISTRAT[0]', session.serialNumber || session.bumperNumber);
  setField('form1[0].Page1[0].MILES[0]', String(session.odometer));
  setField('form1[0].Page1[0].DATE[0]', formatDate(session.date));
  setField('form1[0].Page1[0].TYPEINSPEC[0]', formatInspectionType(session.inspectionType));
  setField('form1[0].Page1[0].TMNUM_A[0]', vehicle?.tmReference || '');

  // TM publication dates from first page of each TM
  const tmDates: Record<string, string> = {
    'M1151': '20060901',      // TM 9-2320-387-10, Sep 2006
    'LMTV_M1078': '19981001', // TM 9-2320-365-10, Oct 1998
  };
  setField('form1[0].Page1[0].TMDATE_A[0]', tmDates[session.vehicleType] || '');

  // Time
  setField('form1[0].Page1[0].TIME_A[0]', new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }));

  // === FAULT TABLE ROWS ===
  // Page 1 has 14 rows (TMNO_0 through TMNO_13, STAT_0 through STAT_13, etc.)
  // Page 2 has 28 rows (TM_B_0 through TM_B_27, etc.)

  // Collect all rows: faults first, then "no faults" line if clean
  const rows: Array<{
    tmItem: string;
    status: string;
    deficiency: string;
    corrective: string;
  }> = [];

  if (faults.length === 0) {
    rows.push({
      tmItem: '',
      status: '/',
      deficiency: 'PMCS COMPLETED — NO DEFICIENCIES FOUND',
      corrective: '',
    });
  } else {
    for (const fault of faults) {
      rows.push({
        tmItem: fault.item,
        status: fault.readiness === 'NMC' ? 'X' : '/',
        deficiency: `${fault.itemDescription}: ${fault.description}`,
        corrective: fault.correctedOnSite
          ? (fault.correctiveAction || 'Corrected on site by operator')
          : fault.needsMaintenance
            ? `Requires maintenance support${fault.partNeeded ? ` — Parts: ${fault.partDescription || 'TBD'}${fault.nsn ? ` (NSN ${fault.nsn})` : ''}` : ''}`
            : '',
      });
    }
  }

  // Fill Page 1 rows (up to 14)
  for (let i = 0; i < Math.min(rows.length, 14); i++) {
    const row = rows[i];
    const suffix = i === 0 ? '' : `_${i}`;
    setField(`form1[0].Page1[0].TMNO${suffix}[0]`, row.tmItem);
    setField(`form1[0].Page1[0].STAT${suffix}[0]`, row.status);
    setField(`form1[0].Page1[0].DEFIC${suffix}[0]`, row.deficiency);
    setField(`form1[0].Page1[0].CORRECT${suffix}[0]`, row.corrective);
  }

  // Fill Page 2 rows if overflow (up to 28 more)
  for (let i = 14; i < Math.min(rows.length, 42); i++) {
    const row = rows[i];
    const pageIdx = i - 14;
    const suffix = pageIdx === 0 ? '' : `_${pageIdx}`;
    setField(`form1[0].Page2[0].TM_B${suffix}[0]`, row.tmItem);
    setField(`form1[0].Page2[0].STAT_B${suffix}[0]`, row.status);
    setField(`form1[0].Page2[0].DEF_B${suffix}[0]`, row.deficiency);
    setField(`form1[0].Page2[0].COR_B${suffix}[0]`, row.corrective);
  }

  // Draw names in signature areas (signature fields can't be filled with text via pdf-lib)
  const page = pdfDoc.getPages()[0];
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pageHeight = page.getHeight();

  // Box 8a: Inspector signature — name + DOD ID
  const inspectorLine1 = `${session.inspectorRank} ${session.inspectorName}`.trim();
  const inspectorLine2 = session.inspectorDodId && session.inspectorDodId !== 'anonymous'
    ? `DOD ID: ${session.inspectorDodId}` : '';
  page.drawText(inspectorLine1, {
    x: 42,
    y: pageHeight - 360,
    size: 9,
    font,
    color: rgb(0, 0, 0),
  });
  if (inspectorLine2) {
    page.drawText(inspectorLine2, {
      x: 42,
      y: pageHeight - 372,
      size: 7,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
  }

  // Box 9a: Supervisor signature — name + DOD ID
  if (supervisorName) {
    page.drawText(supervisorName, {
      x: 287,
      y: pageHeight - 360,
      size: 9,
      font,
      color: rgb(0, 0, 0),
    });
    if (supervisorDodId) {
      page.drawText(`DOD ID: ${supervisorDodId}`, {
        x: 287,
        y: pageHeight - 372,
        size: 7,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });
    }
  }

  // Flatten the form so it's not editable (print-ready)
  try {
    form.flatten();
  } catch {
    // Some forms don't flatten cleanly — that's OK
  }

  return pdfDoc.save();
}

function formatDate(dateStr: string): string {
  // Convert YYYY-MM-DD to YYYYMMDD
  return dateStr.replace(/-/g, '');
}

function formatInspectionType(type: string): string {
  switch (type) {
    case 'BEFORE': return 'B';
    case 'DURING': return 'D';
    case 'AFTER': return 'A';
    case '30_DAY': return '30-Day';
    default: return type;
  }
}
