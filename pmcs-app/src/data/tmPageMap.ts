// Maps TM paragraph numbers to PDF page numbers for deep-linking.
// Generated from TM 9-2320-387-10 (M1151) and TM 9-2320-365-10 (LMTV M1078).

export const TM_PDF_URLS: Record<string, string> = {
  'M1151': 'https://piydlquxibpjqljgtdlu.supabase.co/storage/v1/object/public/tm-documents/TM-9-2320-387-10.pdf',
  'M1152': 'https://piydlquxibpjqljgtdlu.supabase.co/storage/v1/object/public/tm-documents/TM-9-2320-387-10.pdf',
  'LMTV_M1078': 'https://piydlquxibpjqljgtdlu.supabase.co/storage/v1/object/public/tm-documents/m1078_TM-9-2320-365-10.pdf',
  'M1101_TRAILER': 'https://piydlquxibpjqljgtdlu.supabase.co/storage/v1/object/public/tm-documents/Trailer-M1101-M1102-TM-9-2330-392-14P.pdf',
  'MEP803A': 'https://piydlquxibpjqljgtdlu.supabase.co/storage/v1/object/public/tm-documents/TM-9-6115-642-10.pdf',
};

// TM internal page → PDF page number
const M1151_PAGES: Record<string, number> = {
  '3-1': 278, '3-2': 324, '3-3': 325, '3-4': 326, '3-5': 324, '3-6': 328,
  '3-8': 332, '3-9': 286, '3-10': 334, '3-11': 336, '3-12': 338, '3-13': 339,
  '3-14': 340, '3-15': 341, '3-16': 282, '3-17': 343, '3-18': 326,
  '3-19': 346, '3-20': 346, '3-21': 347, '3-22': 349, '3-23': 349,
  '3-24': 350, '3-25': 354, '3-26': 352,
};

const LMTV_PAGES: Record<string, number> = {
  '3-1': 517, '3-2': 518, '3-6': 522, '3-7': 523, '3-8': 524, '3-9': 525,
  '3-10': 526, '3-11': 527, '3-12': 528, '3-13': 529, '3-14': 530,
  '3-15': 531, '3-16': 532, '3-17': 533, '3-18': 518, '3-19': 535,
  '3-20': 536, '3-21': 537, '3-22': 538, '3-23': 539, '3-24': 540,
  '3-25': 541, '3-26': 542, '3-27': 543, '3-28': 544, '3-29': 519,
  '3-30': 546,
};

const TRAILER_PAGES: Record<string, number> = {
  '2-6': 38, '2-7': 39, '2-8': 40, '2-9': 41, '2-10': 42, '2-14': 38,
  '3-1': 56, '3-2': 57, '3-3': 58, '3-4': 59, '3-5': 60, '3-6': 61,
};

const MEP803A_PAGES: Record<string, number> = {
  '2-8': 38, '2-10': 47, '3-1': 68, '3-2': 69, '3-3': 70, '3-4': 71,
  '3-5': 72, '3-6': 73, '3-7': 74, '3-8': 75, '3-9': 76,
};

const PAGE_MAPS: Record<string, Record<string, number>> = {
  'M1151': M1151_PAGES,
  'M1152': M1151_PAGES,
  'LMTV_M1078': LMTV_PAGES,
  'M1101_TRAILER': TRAILER_PAGES,
  'MEP803A': MEP803A_PAGES,
};

/**
 * Get a URL to open the TM PDF at a specific page.
 * @param vehicleType - e.g., 'M1151', 'LMTV_M1078'
 * @param tmPage - TM internal page, e.g., '3-11'
 * @returns URL with #page= fragment, or undefined if no mapping
 */
export function getTmPageUrl(vehicleType: string, tmPage: string): string | undefined {
  const baseUrl = TM_PDF_URLS[vehicleType];
  const pageMap = PAGE_MAPS[vehicleType];
  if (!baseUrl || !pageMap) return undefined;

  const pdfPage = pageMap[tmPage];
  if (!pdfPage) return undefined;

  return `${baseUrl}#page=${pdfPage}`;
}
