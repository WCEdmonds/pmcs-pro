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

// DEMO DATA ONLY. Every identifier here is fictitious: bumper numbers, sections, serial numbers,
// "nsn" values (9999xxxxxx) and LINs (Zxxxxx) are placeholders and do not belong to any real unit.
// Only the model mix is representative. vehicleType follows the TM coverage mapping (models not
// covered by an app TM — e.g. M1097, M1083A1, M1085A1P2, M1078A1P2, MEP-802A — are null).
export const VEHICLE_ROSTER: RosterVehicle[] = [

  // ── 1ST PLT ──
  { bumperNumber: 'A-01', model: 'M1113', description: 'TRUCK UTILITY M1113', serialNumber: 'SN-DEMO-007', nsn: '9999000001', lin: 'Z00001', section: '1ST PLT', vehicleType: 'M1152' },
  { bumperNumber: 'A-02T', model: 'M1101', description: 'TLR CGO HI MOB 3/4T', serialNumber: 'SN-DEMO-017', nsn: '9999000002', lin: 'Z00002', section: '1ST PLT', vehicleType: 'M1101_TRAILER' },
  { bumperNumber: 'A-03', model: 'M1113', description: 'TRUCK UTILITY M1113', serialNumber: 'SN-DEMO-006', nsn: '9999000003', lin: 'Z00001', section: '1ST PLT', vehicleType: 'M1152' },
  { bumperNumber: 'A-04T', model: 'M1101', description: 'TLR CGO HI MOB 3/4T', serialNumber: 'SN-DEMO-018', nsn: '9999000004', lin: 'Z00002', section: '1ST PLT', vehicleType: 'M1101_TRAILER' },
  { bumperNumber: 'A-05', model: 'M1083A1', description: 'TRK CGO W/E M1083A1', serialNumber: 'SN-DEMO-028', nsn: '9999000005', lin: 'Z00003', section: '1ST PLT', vehicleType: null },
  { bumperNumber: 'A-06GT', model: 'PP-3102', description: 'POWER PLAN ELECT', serialNumber: 'SN-DEMO-032', nsn: '9999000006', lin: 'Z00004', section: '1ST PLT', vehicleType: null },
  { bumperNumber: 'A-07T', model: 'M1082', description: 'TRLER FLAT BED M1082', serialNumber: 'SN-DEMO-043', nsn: '9999000007', lin: 'Z00005', section: '1ST PLT', vehicleType: null },
  { bumperNumber: 'A-08', model: 'M1083A1', description: 'TRK CGO W/E M1083A1', serialNumber: 'SN-DEMO-027', nsn: '9999000008', lin: 'Z00003', section: '1ST PLT', vehicleType: null },
  { bumperNumber: 'A-09GT', model: 'MJQ40B', description: 'POWER PLNT AN/MJQ-40B', serialNumber: 'SN-DEMO-042', nsn: '9999000009', lin: 'Z00006', section: '1ST PLT', vehicleType: null },
  { bumperNumber: 'A-10', model: 'M1085A1P2WOW', description: 'TRK CGO LWB WO/WINCH', serialNumber: 'SN-DEMO-040', nsn: '9999000010', lin: 'Z00007', section: '1ST PLT', vehicleType: null },
  { bumperNumber: 'A-11GT', model: 'PP-3102', description: 'POWER PLAN ELECT', serialNumber: 'SN-DEMO-033', nsn: '9999000011', lin: 'Z00004', section: '1ST PLT', vehicleType: null },
  { bumperNumber: 'A-12', model: 'M1151A1', description: 'TR UT INT ARM M1151A1', serialNumber: 'SN-DEMO-010', nsn: '9999000012', lin: 'Z00008', section: '1ST PLT', vehicleType: 'M1151' },

  // ── HQ PLT ──
  { bumperNumber: 'H-01', model: 'M1085A1P2WOW', description: 'TRK CGO LWB WO/WINCH', serialNumber: 'SN-DEMO-001', nsn: '9999000013', lin: 'Z00007', section: 'HQ PLT', vehicleType: null },
  { bumperNumber: 'H-02', model: 'M1097', description: 'TRK UTIL 10000 M1097', serialNumber: 'SN-DEMO-023', nsn: '9999000014', lin: 'Z00009', section: 'HQ PLT', vehicleType: null },
  { bumperNumber: 'H-03G', model: 'MEP-1030', description: 'GENERATOR SET,DIESEL ENGINE', serialNumber: 'SN-DEMO-031', nsn: '9999000015', lin: 'Z00010', section: 'HQ PLT', vehicleType: null },
  { bumperNumber: 'H-04', model: 'M1152A1', description: 'TRK UT EX CAP M1152A1', serialNumber: 'SN-DEMO-014', nsn: '9999000016', lin: 'Z00011', section: 'HQ PLT', vehicleType: 'M1152' },
  { bumperNumber: 'H-05G', model: 'MEP802A', description: 'GEN ST DSL MEP-802A', serialNumber: 'SN-DEMO-034', nsn: '9999000017', lin: 'Z00012', section: 'HQ PLT', vehicleType: null },
  { bumperNumber: 'H-06T', model: 'M1101', description: 'TLR CGO HI MOB 3/4T', serialNumber: 'SN-DEMO-024', nsn: '9999000018', lin: 'Z00002', section: 'HQ PLT', vehicleType: 'M1101_TRAILER' },
  { bumperNumber: 'H-07W', model: 'M1112', description: 'TRALR WTR M1112 8 WHL', serialNumber: 'SN-DEMO-041', nsn: '9999000019', lin: 'Z00013', section: 'HQ PLT', vehicleType: null },

  // ── MAINT PLT ──
  { bumperNumber: 'M-01G', model: 'MEP803A', description: 'GEN ST DSL MEP-803A', serialNumber: 'SN-DEMO-035', nsn: '9999000020', lin: 'Z00014', section: 'MAINT PLT', vehicleType: 'MEP803A' },
  { bumperNumber: 'M-02G', model: 'MEP803A', description: 'GEN ST DSL MEP-803A', serialNumber: 'SN-DEMO-036', nsn: '9999000021', lin: 'Z00014', section: 'MAINT PLT', vehicleType: 'MEP803A' },
  { bumperNumber: 'M-03', model: 'M1085A1P2WOW', description: 'TRK CGO LWB WO/WINCH', serialNumber: 'SN-DEMO-002', nsn: '9999000022', lin: 'Z00007', section: 'MAINT PLT', vehicleType: null },
  { bumperNumber: 'M-04', model: 'M1097', description: 'TRK UTIL 10000 M1097', serialNumber: 'SN-DEMO-022', nsn: '9999000023', lin: 'Z00009', section: 'MAINT PLT', vehicleType: null },
  { bumperNumber: 'M-05T', model: 'M1102', description: 'TLR CGO HI MOB 11/4T', serialNumber: 'SN-DEMO-016', nsn: '9999000024', lin: 'Z00015', section: 'MAINT PLT', vehicleType: 'M1101_TRAILER' },
  { bumperNumber: 'M-06', model: 'M1097', description: 'TRK UTIL 10000 M1097', serialNumber: 'SN-DEMO-019', nsn: '9999000025', lin: 'Z00009', section: 'MAINT PLT', vehicleType: null },
  { bumperNumber: 'M-07', model: 'M984A4WO/W', description: 'TRK WRECK M984A4 WO/W', serialNumber: 'SN-DEMO-003', nsn: '9999000026', lin: 'Z00016', section: 'MAINT PLT', vehicleType: null },
  { bumperNumber: 'M-08', model: 'M1089A1WW', description: 'TRUCK WKR W/W M1089A1', serialNumber: 'SN-DEMO-048', nsn: '9999000027', lin: 'Z00017', section: 'MAINT PLT', vehicleType: null },

  // ── 2ND PLT ──
  { bumperNumber: 'B-01', model: 'M1152A1', description: 'TRK UT EX CAP M1152A1', serialNumber: 'SN-DEMO-015', nsn: '9999000028', lin: 'Z00011', section: '2ND PLT', vehicleType: 'M1152' },
  { bumperNumber: 'B-02GT', model: 'PU-822A/T', description: 'PWER PLANT UTLY (MED)', serialNumber: 'SN-DEMO-045', nsn: '9999000029', lin: 'Z00018', section: '2ND PLT', vehicleType: null },
  { bumperNumber: 'B-03', model: 'M1165A1', description: 'TR UT EX CAP: M1165A1', serialNumber: 'SN-DEMO-012', nsn: '9999000030', lin: 'Z00019', section: '2ND PLT', vehicleType: 'M1152' },

  // ── 3RD PLT ──
  { bumperNumber: 'C-01', model: 'M1097', description: 'TRK UTIL 10000 M1097', serialNumber: 'SN-DEMO-021', nsn: '9999000031', lin: 'Z00009', section: '3RD PLT', vehicleType: null },
  { bumperNumber: 'C-02GT', model: '', description: 'TRAILER, GENERATOR/ECU MTD', serialNumber: 'SN-DEMO-047', nsn: '9999000032', lin: 'Z00020', section: '3RD PLT', vehicleType: null },

  // ── 4TH PLT ──
  { bumperNumber: 'D-01', model: 'M1097', description: 'TRK UTIL 10000 M1097', serialNumber: 'SN-DEMO-020', nsn: '9999000033', lin: 'Z00009', section: '4TH PLT', vehicleType: null },
  { bumperNumber: 'D-02G', model: 'MEP831', description: 'GEN SET DED MEP 831', serialNumber: 'SN-DEMO-037', nsn: '9999000034', lin: 'Z00021', section: '4TH PLT', vehicleType: null },
  { bumperNumber: 'D-03G', model: 'MEP831', description: 'GEN SET DED MEP 831', serialNumber: 'SN-DEMO-038', nsn: '9999000035', lin: 'Z00021', section: '4TH PLT', vehicleType: null },
  { bumperNumber: 'D-04G', model: 'MEP-1030', description: 'GENERATOR SET,DIESEL ENGINE', serialNumber: 'SN-DEMO-029', nsn: '9999000036', lin: 'Z00010', section: '4TH PLT', vehicleType: null },
  { bumperNumber: 'D-05', model: 'M1078A1P2WOW', description: 'TRK CG M1078A1P2 WO/W', serialNumber: 'SN-DEMO-025', nsn: '9999000037', lin: 'Z00022', section: '4TH PLT', vehicleType: null },
  { bumperNumber: 'D-06T', model: 'M1082', description: 'TRLER FLAT BED M1082', serialNumber: 'SN-DEMO-044', nsn: '9999000038', lin: 'Z00005', section: '4TH PLT', vehicleType: null },
  { bumperNumber: 'D-07GT', model: '', description: 'TRAILER, GENERATOR/ECU MTD', serialNumber: 'SN-DEMO-046', nsn: '9999000039', lin: 'Z00020', section: '4TH PLT', vehicleType: null },
  { bumperNumber: 'D-08T', model: 'M1101', description: 'TLR CGO HI MOB 3/4T', serialNumber: 'SN-DEMO-005', nsn: '9999000040', lin: 'Z00002', section: '4TH PLT', vehicleType: 'M1101_TRAILER' },
  { bumperNumber: 'D-09', model: 'M1151A1', description: 'TR UT INT ARM M1151A1', serialNumber: 'SN-DEMO-009', nsn: '9999000041', lin: 'Z00008', section: '4TH PLT', vehicleType: 'M1151' },
  { bumperNumber: 'D-10', model: 'M1152A1', description: 'TRK UT EX CAP M1152A1', serialNumber: 'SN-DEMO-013', nsn: '9999000042', lin: 'Z00011', section: '4TH PLT', vehicleType: 'M1152' },

  // ── 5TH PLT ──
  { bumperNumber: 'E-01', model: 'M1078WOW', description: 'TRK CGO LMTV M1078 WO/WN', serialNumber: 'SN-DEMO-026', nsn: '9999000043', lin: 'Z00022', section: '5TH PLT', vehicleType: 'LMTV_M1078' },

  // ── COMMO PLT ──
  { bumperNumber: 'S-01', model: 'M1151A1', description: 'TR UT INT ARM M1151A1', serialNumber: 'SN-DEMO-008', nsn: '9999000044', lin: 'Z00008', section: 'COMMO PLT', vehicleType: 'M1151' },
  { bumperNumber: 'S-02', model: 'M1165A1', description: 'TR UT EX CAP: M1165A1', serialNumber: 'SN-DEMO-011', nsn: '9999000045', lin: 'Z00019', section: 'COMMO PLT', vehicleType: 'M1152' },
  { bumperNumber: 'S-03G', model: 'MEP-1030', description: 'GENERATOR SET,DIESEL ENGINE', serialNumber: 'SN-DEMO-030', nsn: '9999000046', lin: 'Z00010', section: 'COMMO PLT', vehicleType: null },
  { bumperNumber: 'S-04T', model: 'M1101', description: 'TLR CGO HI MOB 3/4T', serialNumber: 'SN-DEMO-004', nsn: '9999000047', lin: 'Z00002', section: 'COMMO PLT', vehicleType: 'M1101_TRAILER' },

  // ── MAINT PLT ──
  { bumperNumber: 'DEMO-SATS', model: '95A81', description: 'SHOP EQUIP AUTO VEH', serialNumber: 'SN-DEMO-039', nsn: 'N/A', lin: 'Z00023', section: 'MAINT PLT', vehicleType: null },
];
