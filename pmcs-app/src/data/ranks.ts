export const ENLISTED_RANKS = [
  'PVT', 'PV2', 'PFC', 'SPC', 'CPL',
  'SGT', 'SSG', 'SFC', 'MSG', '1SG', 'SGM', 'CSM',
] as const;

export const OFFICER_RANKS = [
  '2LT', '1LT', 'CPT', 'MAJ', 'LTC', 'COL',
] as const;

export const WARRANT_RANKS = [
  'WO1', 'CW2', 'CW3', 'CW4', 'CW5',
] as const;

export const ALL_RANKS = [...ENLISTED_RANKS, ...WARRANT_RANKS, ...OFFICER_RANKS];
