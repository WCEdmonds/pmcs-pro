// Maps vehicle PMCS item numbers to their TM diagram page images

// Eagerly import all PMCS page images for each vehicle
const lmtvPages = import.meta.glob('../assets/images/m1078/pmcs/page-*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const hmmwvPages = import.meta.glob('../assets/images/m1151/pmcs/page-*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

function getLmtvPageUrl(pageNum: number): string | undefined {
  return lmtvPages[`../assets/images/m1078/pmcs/page-${pageNum}.png`];
}

function getHmmwvPageUrl(pageNum: number): string | undefined {
  return hmmwvPages[`../assets/images/m1151/pmcs/page-${pageNum}.png`];
}

// LMTV M1078: item number -> TM page number
const LMTV_ITEM_TO_PAGE: Record<string, number> = {
  '1': 116, '1.1': 117, '2': 36, '3': 118, '4': 119, '5': 120,
  '6': 121, '7': 121, '8': 122, '9': 122, '10': 122,
  '11': 125, '11.1': 126, '12': 127, '13': 129, '14': 130,
  '15': 131, '16': 132, '17': 132, '18': 133, '19': 133,
  '20': 134, '21': 134, '22': 135,
};

// HMMWV M1151/M1152: item number -> TM page number
const HMMWV_ITEM_TO_PAGE: Record<string, number> = {
  '1': 139, '2': 140, '3': 140, '4': 141, '5': 141,
  '6': 142, '6.1': 143, '6.2': 144, '7': 144,
  '8': 145, '8.1': 146, '8.2': 146, '9': 146, '10': 146,
  '10.1': 147, '11': 149, '12': 150, '13': 152, '14': 152,
  '15': 153, '15.1': 154, '15.2': 154, '16': 153,
};

export function getPmcsItemImage(vehicleType: string, itemNumber: string): string | undefined {
  if (vehicleType === 'LMTV_M1078') {
    const pageNum = LMTV_ITEM_TO_PAGE[itemNumber];
    if (!pageNum) return undefined;
    return getLmtvPageUrl(pageNum);
  }
  if (vehicleType === 'M1151' || vehicleType === 'M1152') {
    const pageNum = HMMWV_ITEM_TO_PAGE[itemNumber];
    if (!pageNum) return undefined;
    return getHmmwvPageUrl(pageNum);
  }
  return undefined;
}
