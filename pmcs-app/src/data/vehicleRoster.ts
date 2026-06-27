import type { VehicleType } from '../types';

export interface RosterVehicle {
  bumperNumber: string;
  model: string;
  description: string;
  serialNumber: string;
  nsn: string;
  lin: string;
  section: string;
  /** Maps to app's VehicleType for PMCS checklists. null = no PMCS data yet. */
  vehicleType: VehicleType | null;
}

export const VEHICLE_ROSTER: RosterVehicle[] = [
  // ── IEW Section ──
  { bumperNumber: 'HHC-20',  model: 'M1113',          description: 'TRUCK UTILITY M1113',              serialNumber: 'SN-DEMO-007',              nsn: '1008010915', lin: 'T61630', section: 'IEW',            vehicleType: 'M1151' },
  { bumperNumber: 'HHC-20T', model: 'M1101',           description: 'TLR CGO HI MOB 3/4T',             serialNumber: 'SN-DEMO-017',                nsn: '1007983877', lin: 'T95992', section: 'IEW',            vehicleType: 'M1101_TRAILER' },
  { bumperNumber: 'HHC-21',  model: 'M1113',           description: 'TRUCK UTILITY M1113',              serialNumber: 'SN-DEMO-006',              nsn: '1008010812', lin: 'T61630', section: 'IEW',            vehicleType: 'M1151' },
  { bumperNumber: 'HHC-21T', model: 'M1101',           description: 'TLR CGO HI MOB 3/4T',             serialNumber: 'SN-DEMO-018',                nsn: '1007983984', lin: 'T95992', section: 'IEW',            vehicleType: 'M1101_TRAILER' },
  { bumperNumber: 'HHC-22',  model: 'M1083A1',         description: 'TRK CGO W/E M1083A1',             serialNumber: 'SN-DEMO-028',       nsn: '1008026020', lin: 'T61908', section: 'IEW',            vehicleType: 'LMTV_M1078' },
  { bumperNumber: 'HHC-22GT',model: 'PP-3102',         description: 'POWER PLAN ELECT',                serialNumber: 'SN-DEMO-032',          nsn: '1007593460', lin: 'T39849', section: 'IEW',            vehicleType: null },
  { bumperNumber: 'HHC-22T', model: 'M1082',           description: 'TRLER FLAT BED M1082',            serialNumber: 'SN-DEMO-043',       nsn: '1008004717', lin: 'T96564', section: 'IEW',            vehicleType: null },
  { bumperNumber: 'HHC-23',  model: 'M1083A1',         description: 'TRK CGO W/E M1083A1',             serialNumber: 'SN-DEMO-027',       nsn: '1008025900', lin: 'T61908', section: 'IEW',            vehicleType: 'LMTV_M1078' },
  { bumperNumber: 'HHC-23GT',model: 'MJQ40B',          description: 'POWER PLNT AN/MJQ-40B',           serialNumber: 'SN-DEMO-042',        nsn: '1008012202', lin: 'P42126', section: 'IEW',            vehicleType: null },
  { bumperNumber: 'HHC-24',  model: 'M1085A1P2WOW',    description: 'TRK CGO LWB WO/WINCH',            serialNumber: 'SN-DEMO-040',       nsn: '1002582150', lin: 'T93271', section: 'IEW',            vehicleType: 'LMTV_M1078' },
  { bumperNumber: 'HHC-24GT',model: 'PP-3102',         description: 'POWER PLAN ELECT',                serialNumber: 'SN-DEMO-033',          nsn: '1007593462', lin: 'T39849', section: 'IEW',            vehicleType: null },
  { bumperNumber: 'HHC-25',  model: 'M1151A1',         description: 'TR UT INT ARM M1151A1',            serialNumber: 'SN-DEMO-010',              nsn: '1008016513', lin: 'T34704', section: 'IEW',            vehicleType: 'M1151' },

  // ── HQ/OPS/SUPPLY Section ──
  { bumperNumber: 'HHC-5',   model: 'M1085A1P2WOW',    description: 'TRK CGO LWB WO/WINCH',            serialNumber: 'SN-DEMO-001',   nsn: '1019054641', lin: 'T93271', section: 'HQ/OPS/SUPPLY',  vehicleType: 'LMTV_M1078' },
  { bumperNumber: 'HHC-6',   model: 'M1097',           description: 'TRK UTIL 10000 M1097',            serialNumber: 'SN-DEMO-023',              nsn: '1008008618', lin: 'T07679', section: 'HQ/OPS/SUPPLY',  vehicleType: 'M1151' },
  { bumperNumber: 'HHC-6G',  model: 'MEP-1030',        description: 'GENERATOR SET,DIESEL ENGINE',     serialNumber: 'SN-DEMO-031',          nsn: '1036989089', lin: 'G42488', section: 'HQ/OPS/SUPPLY',  vehicleType: null },
  { bumperNumber: 'HHC-7',   model: 'M1152A1',         description: 'TRK UT EX CAP M1152A1',           serialNumber: 'SN-DEMO-014',              nsn: '1008014315', lin: 'T37588', section: 'HQ/OPS/SUPPLY',  vehicleType: 'M1152' },
  { bumperNumber: 'HHC-7G',  model: 'MEP802A',         description: 'GEN ST DSL MEP-802A',             serialNumber: 'SN-DEMO-034',             nsn: '1007984305', lin: 'G11966', section: 'HQ/OPS/SUPPLY',  vehicleType: 'MEP803A' },
  { bumperNumber: 'HHC-7T',  model: 'M1101',           description: 'TLR CGO HI MOB 3/4T',             serialNumber: 'SN-DEMO-024',         nsn: '1002596823', lin: 'T95992', section: 'HQ/OPS/SUPPLY',  vehicleType: 'M1101_TRAILER' },
  { bumperNumber: 'HHC-WB',  model: 'M1112',           description: 'TRALR WTR M1112 8 WHL',           serialNumber: 'SN-DEMO-041',           nsn: '1008002484', lin: 'W98825', section: 'HQ/OPS/SUPPLY',  vehicleType: null },

  // ── FMT Section ──
  { bumperNumber: 'HHC-80G', model: 'MEP803A',         description: 'GEN ST DSL MEP-803A',             serialNumber: 'SN-DEMO-035',             nsn: '1007958528', lin: 'G74711', section: 'FMT',            vehicleType: 'MEP803A' },
  { bumperNumber: 'HHC-81G', model: 'MEP803A',         description: 'GEN ST DSL MEP-803A',             serialNumber: 'SN-DEMO-036',             nsn: '1005411987', lin: 'G74711', section: 'FMT',            vehicleType: 'MEP803A' },
  { bumperNumber: 'HHC-82',  model: 'M1085A1P2WOW',    description: 'TRK CGO LWB WO/WINCH',            serialNumber: 'SN-DEMO-002',   nsn: '1022148141', lin: 'T93271', section: 'FMT',            vehicleType: 'LMTV_M1078' },
  { bumperNumber: 'HHC-84',  model: 'M1097',           description: 'TRK UTIL 10000 M1097',            serialNumber: 'SN-DEMO-022',              nsn: '1008006697', lin: 'T07679', section: 'FMT',            vehicleType: 'M1151' },
  { bumperNumber: 'HHC-84T', model: 'M1102',           description: 'TLR CGO HI MOB 11/4T',            serialNumber: 'SN-DEMO-016',                nsn: '1007965880', lin: 'T95924', section: 'FMT',            vehicleType: 'M1101_TRAILER' },
  { bumperNumber: 'HHC-85',  model: 'M1097',           description: 'TRK UTIL 10000 M1097',            serialNumber: 'SN-DEMO-019',              nsn: '1008008525', lin: 'T07679', section: 'FMT',            vehicleType: 'M1151' },
  { bumperNumber: 'HHC-86',  model: 'M984A4WO/W',      description: 'TRK WRECK M984A4 WO/W',           serialNumber: 'SN-DEMO-003',   nsn: '1007999730', lin: 'T63161', section: 'FMT',            vehicleType: null },
  { bumperNumber: 'HHC-87',  model: 'M1089A1WW',       description: 'TRUCK WKR W/W M1089A1',           serialNumber: 'SN-DEMO-048',        nsn: '1007998600', lin: 'T94709', section: 'FMT',            vehicleType: null },

  // ── S1 Section ──
  { bumperNumber: 'HQ-1',    model: 'M1152A1',         description: 'TRK UT EX CAP M1152A1',           serialNumber: 'SN-DEMO-015',              nsn: '1008014650', lin: 'T37588', section: 'S1',             vehicleType: 'M1152' },
  { bumperNumber: 'HQ-1GT',  model: 'PU-822A/T',       description: 'PWER PLANT UTLY (MED)',            serialNumber: 'SN-DEMO-045',          nsn: '1008024218', lin: 'P63462', section: 'S1',             vehicleType: null },
  { bumperNumber: 'HQ-5',    model: 'M1165A1',         description: 'TR UT EX CAP: M1165A1',            serialNumber: 'SN-DEMO-012',              nsn: '1008015673', lin: 'T56383', section: 'S1',             vehicleType: 'M1151' },

  // ── S2 Section ──
  { bumperNumber: 'HQ-2',    model: 'M1097',           description: 'TRK UTIL 10000 M1097',            serialNumber: 'SN-DEMO-021',              nsn: '1008009316', lin: 'T07679', section: 'S2',             vehicleType: 'M1151' },
  { bumperNumber: 'HQ-2GT',  model: '',                 description: 'TRAILER, GENERATOR/ECU MTD, 2017 1013915', serialNumber: 'SN-DEMO-047', nsn: '1038577363', lin: 'YF309V', section: 'S2',             vehicleType: null },

  // ── S3/UMT Section ──
  { bumperNumber: 'HQ-3',    model: 'M1097',           description: 'TRK UTIL 10000 M1097',            serialNumber: 'SN-DEMO-020',              nsn: '1008009231', lin: 'T07679', section: 'S3/UMT',         vehicleType: 'M1151' },
  { bumperNumber: 'HQ-30G',  model: 'MEP831',          description: 'GEN SET DED MEP 831',             serialNumber: 'SN-DEMO-037',            nsn: '1007964118', lin: 'G18358', section: 'S3/UMT',         vehicleType: null },
  { bumperNumber: 'HQ-31G',  model: 'MEP831',          description: 'GEN SET DED MEP 831',             serialNumber: 'SN-DEMO-038',            nsn: '1007974911', lin: 'G18358', section: 'S3/UMT',         vehicleType: null },
  { bumperNumber: 'HQ-32G',  model: 'MEP-1030',        description: 'GENERATOR SET,DIESEL ENGINE',     serialNumber: 'SN-DEMO-029',          nsn: '1037006202', lin: 'G42488', section: 'S3/UMT',         vehicleType: null },
  { bumperNumber: 'HQ-33',   model: 'M1078A1P2WOW',    description: 'TRK CG M1078A1P2 WO/W',           serialNumber: 'SN-DEMO-025',       nsn: '1007996014', lin: 'T59448', section: 'S3/UMT',         vehicleType: 'LMTV_M1078' },
  { bumperNumber: 'HQ-33T',  model: 'M1082',           description: 'TRLER FLAT BED M1082',            serialNumber: 'SN-DEMO-044',       nsn: '1008004423', lin: 'T96564', section: 'S3/UMT',         vehicleType: null },
  { bumperNumber: 'HQ-3GT',  model: '',                 description: 'TRAILER, GENERATOR/ECU MTD, 2017 1013915', serialNumber: 'SN-DEMO-046', nsn: '1037604727', lin: 'YF309V', section: 'S3/UMT',         vehicleType: null },
  { bumperNumber: 'HQ-3T',   model: 'M1101',           description: 'TLR CGO HI MOB 3/4T',             serialNumber: 'SN-DEMO-005',               nsn: '1007980811', lin: 'T95992', section: 'S3/UMT',         vehicleType: 'M1101_TRAILER' },
  { bumperNumber: 'HQ-7',    model: 'M1151A1',         description: 'TR UT INT ARM M1151A1',            serialNumber: 'SN-DEMO-009',              nsn: '1013917894', lin: 'T34704', section: 'S3/UMT',         vehicleType: 'M1151' },
  { bumperNumber: 'UMT-1',   model: 'M1152A1',         description: 'TRK UT EX CAP M1152A1',           serialNumber: 'SN-DEMO-013',              nsn: '1008014129', lin: 'T37588', section: 'S3/UMT',         vehicleType: 'M1152' },

  // ── S4 Section ──
  { bumperNumber: 'HQ-4',    model: 'M1078A1P2WOW',    description: 'TRK CG M1078A1P2 WO/W',           serialNumber: 'SN-DEMO-026',       nsn: '1007996241', lin: 'T59448', section: 'S4',             vehicleType: 'LMTV_M1078' },

  // ── S6 Section ──
  { bumperNumber: 'HQ-6',    model: 'M1151A1',         description: 'TR UT INT ARM M1151A1',            serialNumber: 'SN-DEMO-008',              nsn: '1013917892', lin: 'T34704', section: 'S6',             vehicleType: 'M1151' },
  { bumperNumber: 'HQ-9',    model: 'M1165A1',         description: 'TR UT EX CAP: M1165A1',            serialNumber: 'SN-DEMO-011',              nsn: '1008015497', lin: 'T56383', section: 'S6',             vehicleType: 'M1151' },
  { bumperNumber: 'HQ-9G',   model: 'MEP-1030',        description: 'GENERATOR SET,DIESEL ENGINE',     serialNumber: 'SN-DEMO-030',          nsn: '1037006201', lin: 'G42488', section: 'S6',             vehicleType: null },
  { bumperNumber: 'HQ-9T',   model: 'M1101',           description: 'TLR CGO HI MOB 3/4T',             serialNumber: 'SN-DEMO-004',               nsn: '1007980693', lin: 'T95992', section: 'S6',             vehicleType: 'M1101_TRAILER' },

  // ── FMT (shop equipment) ──
  { bumperNumber: 'SATS',    model: '95A81',            description: 'SHOP EQUIP AUTO VEH',             serialNumber: 'SN-DEMO-039',       nsn: 'N/A',        lin: 'S25885', section: 'FMT',            vehicleType: null },
];
