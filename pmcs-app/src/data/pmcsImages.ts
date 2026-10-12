// Maps a vehicle's PMCS item number to the TM figure shown on the step card.
//
// Only the files listed in the glob arrays below are bundled (as URLs, loaded by the browser only
// when a step that uses them is shown). Keep each glob list in sync with the item maps: every page
// referenced by an item map must be listed, and nothing else (unlisted files are not shipped).
// File names: m1078/m1151 `page-<PDF page>.png` are crops of that PDF page of the TM;
// m1097 `page-<PDF page>.png` likewise (TM 9-2320-280-10);
// m1101/mep803a `fig-<figure no.>.png` are TM figures; mep802a/mep1030/mep831a `fig-<WP>-<figure no.>.png` are
// work-package figures (e.g. fig-0010-1 = WP 0010, Figure 1; fig-0004-1-4 = WP 0004 Figure 1 sheet 4).
// All images are ≤150 KB grayscale PNGs.

type UrlMap = Record<string, string>;

// TM 9-2320-365-10 (PDF page numbers of "m1078_TM 9-2320-365-10.pdf")
const lmtvPages = import.meta.glob([
  '../assets/images/m1078/pmcs/page-36.png',
  '../assets/images/m1078/pmcs/page-11[6-9].png',
  '../assets/images/m1078/pmcs/page-12[0-2].png',
  '../assets/images/m1078/pmcs/page-12[5-7].png',
  '../assets/images/m1078/pmcs/page-129.png',
  '../assets/images/m1078/pmcs/page-13[0-8].png',
  '../assets/images/m1078/pmcs/page-14[0-7].png',
  '../assets/images/m1078/pmcs/page-151.png',
  '../assets/images/m1078/pmcs/page-15[4-6].png',
  '../assets/images/m1078/pmcs/page-15[8-9].png',
  '../assets/images/m1078/pmcs/page-16[0-1].png',
  '../assets/images/m1078/pmcs/page-16[5-9].png',
  '../assets/images/m1078/pmcs/page-17[1-4].png',
  '../assets/images/m1078/pmcs/page-17[7-9].png',
  '../assets/images/m1078/pmcs/page-18[0-2].png',
  '../assets/images/m1078/pmcs/page-18[4-5].png',
  '../assets/images/m1078/pmcs/page-19[0345].png',
  '../assets/images/m1078/pmcs/page-197.png',
], { eager: true, query: '?url', import: 'default' }) as UrlMap;

// TM 9-2320-387-10 (HMMWV) — only pages mapped in HMMWV_ITEM_TO_PAGE.
const hmmwvPages = import.meta.glob([
  '../assets/images/m1151/pmcs/page-139.png',
  '../assets/images/m1151/pmcs/page-140.png',
  '../assets/images/m1151/pmcs/page-141.png',
  '../assets/images/m1151/pmcs/page-142.png',
  '../assets/images/m1151/pmcs/page-143.png',
  '../assets/images/m1151/pmcs/page-144.png',
  '../assets/images/m1151/pmcs/page-145.png',
  '../assets/images/m1151/pmcs/page-146.png',
  '../assets/images/m1151/pmcs/page-147.png',
  '../assets/images/m1151/pmcs/page-149.png',
  '../assets/images/m1151/pmcs/page-150.png',
  '../assets/images/m1151/pmcs/page-152.png',
  '../assets/images/m1151/pmcs/page-153.png',
  '../assets/images/m1151/pmcs/page-154.png',
  '../assets/images/m1151/pmcs/page-156.png',
  '../assets/images/m1151/pmcs/page-157.png',
  '../assets/images/m1151/pmcs/page-158.png',
  '../assets/images/m1151/pmcs/page-160.png',
  '../assets/images/m1151/pmcs/page-161.png',
  '../assets/images/m1151/pmcs/page-162.png',
  '../assets/images/m1151/pmcs/page-163.png',
  '../assets/images/m1151/pmcs/page-164.png',
  '../assets/images/m1151/pmcs/page-165.png',
  '../assets/images/m1151/pmcs/page-166.png',
  '../assets/images/m1151/pmcs/page-167.png',
  '../assets/images/m1151/pmcs/page-169.png',
  '../assets/images/m1151/pmcs/page-170.png',
  '../assets/images/m1151/pmcs/page-171.png',
  '../assets/images/m1151/pmcs/page-173.png',
  '../assets/images/m1151/pmcs/page-174.png',
  '../assets/images/m1151/pmcs/page-175.png',
  '../assets/images/m1151/pmcs/page-176.png',
  '../assets/images/m1151/pmcs/page-177.png',
  '../assets/images/m1151/pmcs/page-178.png',
  '../assets/images/m1151/pmcs/page-179.png',
  '../assets/images/m1151/pmcs/page-180.png',
  '../assets/images/m1151/pmcs/page-181.png',
  '../assets/images/m1151/pmcs/page-182.png',
], { eager: true, query: '?url', import: 'default' }) as UrlMap;

// TM 9-2320-280-10 w/C3 (M1097) — PDF page renders of Table 2-2 rows; only pages mapped in M1097_ITEM_TO_PAGE.
const m1097Pages = import.meta.glob([
  '../assets/images/m1097/pmcs/page-120.png',
  '../assets/images/m1097/pmcs/page-121.png',
  '../assets/images/m1097/pmcs/page-122.png',
  '../assets/images/m1097/pmcs/page-123.png',
  '../assets/images/m1097/pmcs/page-124.png',
  '../assets/images/m1097/pmcs/page-125.png',
  '../assets/images/m1097/pmcs/page-127.png',
  '../assets/images/m1097/pmcs/page-128.png',
  '../assets/images/m1097/pmcs/page-130.png',
  '../assets/images/m1097/pmcs/page-131.png',
  '../assets/images/m1097/pmcs/page-132.png',
  '../assets/images/m1097/pmcs/page-133.png',
  '../assets/images/m1097/pmcs/page-134.png',
  '../assets/images/m1097/pmcs/page-135.png',
  '../assets/images/m1097/pmcs/page-137.png',
  '../assets/images/m1097/pmcs/page-138.png',
  '../assets/images/m1097/pmcs/page-139.png',
  '../assets/images/m1097/pmcs/page-140.png',
  '../assets/images/m1097/pmcs/page-141.png',
  '../assets/images/m1097/pmcs/page-142.png',
  '../assets/images/m1097/pmcs/page-143.png',
  '../assets/images/m1097/pmcs/page-147.png',
  '../assets/images/m1097/pmcs/page-148.png',
  '../assets/images/m1097/pmcs/page-150.png',
  '../assets/images/m1097/pmcs/page-151.png',
  '../assets/images/m1097/pmcs/page-152.png',
  '../assets/images/m1097/pmcs/page-153.png',
  '../assets/images/m1097/pmcs/page-155.png',
  '../assets/images/m1097/pmcs/page-158.png',
  '../assets/images/m1097/pmcs/page-159.png',
  '../assets/images/m1097/pmcs/page-160.png',
  '../assets/images/m1097/pmcs/page-162.png',
], { eager: true, query: '?url', import: 'default' }) as UrlMap;

const trailerFigs = import.meta.glob('../assets/images/m1101/pmcs/fig-*.png', { eager: true, query: '?url', import: 'default' }) as UrlMap;
const mepFigs = import.meta.glob('../assets/images/mep803a/pmcs/fig-*.png', { eager: true, query: '?url', import: 'default' }) as UrlMap;

// TM 9-6115-641-10 (MEP802A) — only figures mapped in MEP802A_ITEM_TO_FIG.
const mep802aFigs = import.meta.glob([
  '../assets/images/mep802a/pmcs/fig-0004-1.png',
  '../assets/images/mep802a/pmcs/fig-0005-1.png',
  '../assets/images/mep802a/pmcs/fig-0009-1.png',
  '../assets/images/mep802a/pmcs/fig-0010-1.png',
  '../assets/images/mep802a/pmcs/fig-0010-2.png',
  '../assets/images/mep802a/pmcs/fig-0012-1.png',
  '../assets/images/mep802a/pmcs/fig-0012-2.png',
], { eager: true, query: '?url', import: 'default' }) as UrlMap;

// TM 9-6115-749-10 (MEP1030) — only figures mapped in MEP1030_ITEM_TO_FIG.
const mep1030Figs = import.meta.glob([
  '../assets/images/mep1030/pmcs/fig-0004-2.png',
  '../assets/images/mep1030/pmcs/fig-0005-2.png',
  '../assets/images/mep1030/pmcs/fig-0013-1.png',
  '../assets/images/mep1030/pmcs/fig-0013-2.png',
  '../assets/images/mep1030/pmcs/fig-0013-3.png',
  '../assets/images/mep1030/pmcs/fig-0013-4.png',
  '../assets/images/mep1030/pmcs/fig-0014-2.png',
  '../assets/images/mep1030/pmcs/fig-0015-1.png',
  '../assets/images/mep1030/pmcs/fig-0016-2.png',
  '../assets/images/mep1030/pmcs/fig-0017-1.png',
], { eager: true, query: '?url', import: 'default' }) as UrlMap;

// TM 9-6115-639-13&P (MEP831A) — only figures mapped in MEP831A_ITEM_TO_FIG.
const mep831aFigs = import.meta.glob([
  '../assets/images/mep831a/pmcs/fig-0002-1.png',
  '../assets/images/mep831a/pmcs/fig-0002-3.png',
  '../assets/images/mep831a/pmcs/fig-0004-1.png',
  '../assets/images/mep831a/pmcs/fig-0004-1-4.png',
  '../assets/images/mep831a/pmcs/fig-0005-1.png',
  '../assets/images/mep831a/pmcs/fig-0010-1.png',
  '../assets/images/mep831a/pmcs/fig-0011-1.png',
], { eager: true, query: '?url', import: 'default' }) as UrlMap;

// LMTV M1078: PMCS item -> PDF page whose figure belongs to that item (figure sits above the item row).
// Items 'T2-2 #n' are Table 2-2 (M1078/M1081) items.
export const LMTV_ITEM_TO_PAGE: Record<string, number> = {
  '1': 116, '1.1': 117, '2': 36, '3': 118, '4': 119, '5': 120, '6': 138, '7': 121,
  '8': 122, '9': 122, '10': 122, '11': 125, '11.1': 126, '12': 127, '13': 129, '14': 130,
  '15': 131, '16': 132, '17': 132, '18': 133, '19': 133, '20': 134, '21': 134, '22': 135,
  '26': 136, '29': 137, '30': 138, '31': 138, '32': 140, '34': 141, '35': 142, '36': 143,
  '37': 144, '38': 156, '39': 145, '41.1': 146, '42': 147, '43': 151, '44': 154, '45': 155,
  '46': 156, '47': 158, '48': 159, '49': 160, '50': 161, '55': 165, '56': 166, '57': 166,
  '58': 167, '59': 168, '60': 169, '61': 171, '62': 147, '63': 172, '64': 173, '65': 174,
  '66': 177, '67': 178, '68': 179, '70': 180, '71': 180, '72': 180, '73': 181, '74': 182,
  '75': 182,
  'T2-2 #1': 184, 'T2-2 #2': 185, 'T2-2 #3': 185, 'T2-2 #5': 190, 'T2-2 #6': 193,
  'T2-2 #7': 194, 'T2-2 #8': 195, 'T2-2 #9': 197, 'T2-2 #10': 185,
};

// HMMWV M1151/M1152: TM 9-2320-387-10 Table 2-2 item number -> PDF page image (page-NNN.png)
export const HMMWV_ITEM_TO_PAGE: Record<string, number> = {
  '1': 139, '2': 140, '3': 140, '4': 141, '5': 141, '6': 142, '6.1': 143, '6.2': 144,
  '7': 144, '8': 145, '8.2': 146, '9': 146, '10': 146, '10.1': 147, '11': 149, '12': 150,
  '13': 152, '14': 152, '15': 153, '15.1': 154, '15.2': 154, '16': 153, '17': 156, '18': 156,
  '18.1': 156, '19': 156, '20': 156, '21': 157, '21.2': 157, '22': 158, '23': 160, '24': 160,
  '25': 161, '26': 161, '27': 162, '28': 163, '29': 163, '30': 163, '31': 164, '32': 164,
  '33': 165, '34': 165, '35': 165, '36': 166, '37': 166, '38': 167, '38.1': 167, '39': 169,
  '40': 170, '41': 170, '42': 171, '42.1': 171, '43': 171, '44': 173, '44.1': 174, '45': 175,
  '46': 175, '47': 176, '48': 176, '49': 177, '49.1': 177, '50': 178, '51': 178, '52': 179,
  '54': 180, '54.1': 180, '55': 180, '55.1': 180, '55.2': 181, '56': 181, '57': 181, '58': 181,
  '59': 182,
};

// M1097: TM 9-2320-280-10 Table 2-2 item number -> PDF page image (page-NNN.png). Row page, or the
// continuation page holding the item's figure (12 -> 127 gauges, 33 -> 139, 42 -> 143 tread, 53 -> 152).
export const M1097_ITEM_TO_PAGE: Record<string, number> = {
  '1': 120, '2': 121, '3': 121, '5': 122, '6': 123, '7': 123,
  '7.1': 123, '8': 124, '9': 124, '10': 125, '12': 127, '14': 128,
  '17': 130, '18': 130, '19': 130, '19.1': 131, '20': 131, '21': 131,
  '22.1': 131, '23': 132, '24': 133, '25': 134, '26': 134, '27': 134,
  '28': 135, '30': 137, '31': 137, '32': 138, '33': 139, '34': 139,
  '36': 140, '37': 140, '37.1': 140, '38': 140, '39': 141, '40': 141,
  '41': 141, '41.1': 142, '42': 143, '43': 147, '44': 147, '45': 148,
  '46': 148, '49': 150, '51': 151, '52': 151, '53': 152, '54': 153,
  '58': 155, '63': 158, '64': 158, '65': 158, '66': 158, '68': 159,
  '69': 159, '71': 159, '72': 160, '75': 162, '76': 162,
};

// M1101/M1102 (TM 9-2330-392-14&P): the PMCS table has no figures; Figure 2-2 (para 2-2, PDF p. 34,
// Controls and Indicators) shows handbrake levers, breakaway cable, lunette, intervehicular cable,
// safety chains, and front support leg.
export const TRAILER_ITEM_TO_FIG: Record<string, string> = {
  '1': '2-2', '2': '2-2', '3': '2-2', '4': '2-2', '7': '2-2', '8': '2-2', '11': '2-2',
};

// MEP-803A (TM 9-6115-642-10): the PMCS table points to Figure 1-2 (components, PDF p. 19) and
// Figure 2-1 (controls, PDF p. 32); service figures 2-4 (grounding, p. 47), 3-1 (air cleaner, p. 78),
// 3-2 (fuel filter/water separator, p. 82).
export const MEP_ITEM_TO_FIG: Record<string, string> = {
  '1': '1-2', '3': '1-2', '5': '1-2', '6': '1-2', '7': '3-2', '8': '1-2', '9': '1-2', '12': '1-2',
  '14': '1-2', '15': '3-1', '16': '2-4', '17': '1-2', '18': '1-2', '19': '1-2', '20': '2-1', '21': '2-1',
  '22': '1-2', '23': '1-2', '24': '1-2', '25': '1-2', '28': '2-4', '29': '2-1',
  '30': '1-2', '32': '1-2', '33': '1-2', '34': '1-2', '35': '3-2', '36': '1-2', '37': '1-2', '39': '1-2', '40': '2-1',
};

// MEP802A (TM 9-6115-641-10): work-package figures under assets/images/mep802a/pmcs.
export const MEP802A_ITEM_TO_FIG: Record<string, string> = {
  '1': '0010-1', '3': '0010-1', '5': '0010-1', '6': '0010-1', '8': '0010-1', '9': '0010-1', '10': '0010-1',
  '11': '0010-1', '11.1': '0010-1', '12': '0010-1', '14': '0010-1', '17': '0010-1', '18': '0010-1', '19': '0010-1',
  '22': '0010-1', '23': '0010-1', '24': '0010-1', '25': '0010-1', '26': '0010-1', '30': '0010-1', '32': '0010-1',
  '33': '0010-1', '34': '0010-1', '36': '0010-1', '37': '0010-1', '38': '0010-1', '39': '0010-1', '44': '0010-1',
  '7': '0012-2', '35': '0012-2', '15': '0012-1', '16': '0005-1', '28': '0005-1', '20': '0004-1', '21': '0004-1',
  '29': '0004-1', '40': '0004-1', '41': '0010-2', '42': '0010-2', '43': '0010-2', '45': '0010-2', '46': '0010-2',
  '47': '0010-2', '48': '0010-2', '49': '0010-2', '50': '0010-2', '51': '0010-2', '52': '0010-2', '54': '0010-2',
  '55': '0010-2', '56': '0010-2', '57': '0010-2', '58': '0010-2', '59': '0010-2', '60': '0010-2', '61': '0010-2',
  '62': '0010-2', '63': '0010-2', '64': '0010-2', '65': '0010-2', '53': '0009-1',
};

// MEP1030 (TM 9-6115-749-10): work-package figures under assets/images/mep1030/pmcs.
export const MEP1030_ITEM_TO_FIG: Record<string, string> = {
  '1': '0005-2', '60': '0005-2', '4': '0004-2', '5': '0004-2', '58': '0004-2', '2': '0013-1', '3': '0013-1',
  '6': '0013-1', '7': '0013-1', '8': '0013-1', '9': '0013-1', '10': '0013-1', '11': '0013-1', '12': '0013-1',
  '13': '0013-1', '61': '0013-1', '62': '0013-1', '63': '0013-1', '64': '0013-1', '65': '0013-1', '66': '0013-1',
  '67': '0013-1', '78': '0013-1', '79': '0013-1', '85': '0013-1', '19': '0013-2', '20': '0013-2', '21': '0013-2',
  '22': '0013-2', '23': '0013-2', '24': '0013-2', '25': '0013-2', '26': '0013-2', '27': '0013-2', '28': '0013-2',
  '29': '0013-2', '30': '0013-2', '31': '0013-2', '32': '0013-2', '33': '0013-2', '35': '0013-2', '38': '0013-2',
  '39': '0013-2', '68': '0013-2', '69': '0013-2', '70': '0016-2', '72': '0013-2', '80': '0013-2', '81': '0013-2',
  '82': '0013-2', '83': '0013-2', '17': '0015-1', '50': '0015-1', '76': '0015-1', '89': '0015-1', '91': '0015-1',
  '34': '0017-1', '71': '0017-1', '84': '0017-1', '36': '0016-2', '37': '0014-2', '40': '0013-3', '41': '0013-3',
  '42': '0013-3', '43': '0013-3', '44': '0013-4', '45': '0013-4', '46': '0013-4', '47': '0013-4', '48': '0013-4',
  '49': '0013-4', '51': '0013-4', '52': '0013-4', '53': '0013-4', '54': '0013-4', '55': '0013-4', '56': '0013-4',
  '57': '0013-4', '73': '0013-4', '74': '0013-4', '75': '0013-4', '77': '0013-4', '86': '0013-4', '87': '0013-4',
  '88': '0013-4',
};

// MEP831A (TM 9-6115-639-13&P): work-package figures under assets/images/mep831a/pmcs.
export const MEP831A_ITEM_TO_FIG: Record<string, string> = {
  '1': '0002-1', '2': '0002-1', '4': '0002-1', '5': '0002-1', '7': '0002-1', '11': '0002-1', '16': '0002-1',
  '22': '0002-1', '3': '0004-1', '17': '0004-1', '6': '0005-1', '8': '0002-3', '9': '0002-3', '10': '0002-3',
  '18': '0002-3', '20': '0002-3', '21': '0002-3', '24': '0002-3', '13': '0004-1-4', '14': '0010-1', '19': '0010-1',
  '15': '0011-1',
};

export function getPmcsItemImage(vehicleType: string, itemNumber: string): string | undefined {
  if (vehicleType === 'LMTV_M1078') {
    const pageNum = LMTV_ITEM_TO_PAGE[itemNumber];
    return pageNum ? lmtvPages[`../assets/images/m1078/pmcs/page-${pageNum}.png`] : undefined;
  }
  if (vehicleType === 'M1151' || vehicleType === 'M1152') {
    const pageNum = HMMWV_ITEM_TO_PAGE[itemNumber];
    return pageNum ? hmmwvPages[`../assets/images/m1151/pmcs/page-${pageNum}.png`] : undefined;
  }
  if (vehicleType === 'M1101_TRAILER') {
    const fig = TRAILER_ITEM_TO_FIG[itemNumber];
    return fig ? trailerFigs[`../assets/images/m1101/pmcs/fig-${fig}.png`] : undefined;
  }
  if (vehicleType === 'MEP803A') {
    const fig = MEP_ITEM_TO_FIG[itemNumber];
    return fig ? mepFigs[`../assets/images/mep803a/pmcs/fig-${fig}.png`] : undefined;
  }
  if (vehicleType === 'M1097') {
    const pageNum = M1097_ITEM_TO_PAGE[itemNumber];
    return pageNum ? m1097Pages[`../assets/images/m1097/pmcs/page-${pageNum}.png`] : undefined;
  }
  if (vehicleType === 'MEP802A') {
    const fig = MEP802A_ITEM_TO_FIG[itemNumber];
    return fig ? mep802aFigs[`../assets/images/mep802a/pmcs/fig-${fig}.png`] : undefined;
  }
  if (vehicleType === 'MEP1030') {
    const fig = MEP1030_ITEM_TO_FIG[itemNumber];
    return fig ? mep1030Figs[`../assets/images/mep1030/pmcs/fig-${fig}.png`] : undefined;
  }
  if (vehicleType === 'MEP831A') {
    const fig = MEP831A_ITEM_TO_FIG[itemNumber];
    return fig ? mep831aFigs[`../assets/images/mep831a/pmcs/fig-${fig}.png`] : undefined;
  }
  return undefined;
}
