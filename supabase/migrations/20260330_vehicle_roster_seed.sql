-- Migration: DEMO01 HHC Vehicle Roster Seed
-- Adds section, lin_number, nsn, description columns to vehicles table
-- Seeds all 48 items from the HHC rolling stock roster
-- Date: 2026-03-30

BEGIN;

-- ============================================================
-- 1. Add new columns to vehicles table
-- ============================================================

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS section text;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS lin_number text;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS nsn text;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS description text;

-- ============================================================
-- 2. Seed DEMO01 HHC vehicle roster (48 items)
--    UPSERT on (bumper_number_normalized, unit) to be idempotent
-- ============================================================

INSERT INTO vehicles (
  bumper_number,
  bumper_number_normalized,
  vehicle_type,
  serial_number,
  nomenclature,
  unit,
  status,
  section,
  lin_number,
  nsn,
  description
) VALUES
  -- IEW Section
  ('HHC-20',  'HHC20',  'M1113',          'SN-DEMO-007',              'TRUCK UTILITY M1113',              'DEMO01', 'FMC', 'IEW', 'T61630', '1008010915', 'TRUCK UTILITY M1113'),
  ('HHC-20T', 'HHC20T', 'M1101',          'SN-DEMO-017',                'TLR CGO HI MOB 3/4T',             'DEMO01', 'FMC', 'IEW', 'T95992', '1007983877', 'TLR CGO HI MOB 3/4T'),
  ('HHC-21',  'HHC21',  'M1113',          'SN-DEMO-006',              'TRUCK UTILITY M1113',              'DEMO01', 'FMC', 'IEW', 'T61630', '1008010812', 'TRUCK UTILITY M1113'),
  ('HHC-21T', 'HHC21T', 'M1101',          'SN-DEMO-018',                'TLR CGO HI MOB 3/4T',             'DEMO01', 'FMC', 'IEW', 'T95992', '1007983984', 'TLR CGO HI MOB 3/4T'),
  ('HHC-22',  'HHC22',  'M1083A1',        'SN-DEMO-028',       'TRK CGO W/E M1083A1',             'DEMO01', 'FMC', 'IEW', 'T61908', '1008026020', 'TRK CGO W/E M1083A1'),
  ('HHC-22GT','HHC22GT','PP-3102',        'SN-DEMO-032',          'POWER PLAN ELECT',                'DEMO01', 'FMC', 'IEW', 'T39849', '1007593460', 'POWER PLAN ELECT'),
  ('HHC-22T', 'HHC22T', 'M1082',          'SN-DEMO-043',       'TRLER FLAT BED M1082',            'DEMO01', 'FMC', 'IEW', 'T96564', '1008004717', 'TRLER FLAT BED M1082'),
  ('HHC-23',  'HHC23',  'M1083A1',        'SN-DEMO-027',       'TRK CGO W/E M1083A1',             'DEMO01', 'FMC', 'IEW', 'T61908', '1008025900', 'TRK CGO W/E M1083A1'),
  ('HHC-23GT','HHC23GT','MJQ40B',         'SN-DEMO-042',        'POWER PLNT AN/MJQ-40B',           'DEMO01', 'FMC', 'IEW', 'P42126', '1008012202', 'POWER PLNT AN/MJQ-40B'),
  ('HHC-24',  'HHC24',  'M1085A1P2WOW',   'SN-DEMO-040',       'TRK CGO LWB WO/WINCH',            'DEMO01', 'FMC', 'IEW', 'T93271', '1002582150', 'TRK CGO LWB WO/WINCH'),
  ('HHC-24GT','HHC24GT','PP-3102',        'SN-DEMO-033',          'POWER PLAN ELECT',                'DEMO01', 'FMC', 'IEW', 'T39849', '1007593462', 'POWER PLAN ELECT'),
  ('HHC-25',  'HHC25',  'M1151A1',        'SN-DEMO-010',              'TR UT INT ARM M1151A1',            'DEMO01', 'FMC', 'IEW', 'T34704', '1008016513', 'TR UT INT ARM M1151A1'),

  -- HQ/OPS/SUPPLY Section
  ('HHC-5',   'HHC5',   'M1085A1P2WOW',   'SN-DEMO-001',   'TRK CGO LWB WO/WINCH',            'DEMO01', 'FMC', 'HQ/OPS/SUPPLY', 'T93271', '1019054641', 'TRK CGO LWB WO/WINCH'),
  ('HHC-6',   'HHC6',   'M1097',          'SN-DEMO-023',              'TRK UTIL 10000 M1097',            'DEMO01', 'FMC', 'HQ/OPS/SUPPLY', 'T07679', '1008008618', 'TRK UTIL 10000 M1097'),
  ('HHC-6G',  'HHC6G',  'MEP-1030',       'SN-DEMO-031',          'GENERATOR SET,DIESEL ENGINE',     'DEMO01', 'FMC', 'HQ/OPS/SUPPLY', 'G42488', '1036989089', 'GENERATOR SET,DIESEL ENGINE'),
  ('HHC-7',   'HHC7',   'M1152A1',        'SN-DEMO-014',              'TRK UT EX CAP M1152A1',           'DEMO01', 'FMC', 'HQ/OPS/SUPPLY', 'T37588', '1008014315', 'TRK UT EX CAP M1152A1'),
  ('HHC-7G',  'HHC7G',  'MEP802A',        'SN-DEMO-034',             'GEN ST DSL MEP-802A',             'DEMO01', 'FMC', 'HQ/OPS/SUPPLY', 'G11966', '1007984305', 'GEN ST DSL MEP-802A'),
  ('HHC-7T',  'HHC7T',  'M1101',          'SN-DEMO-024',         'TLR CGO HI MOB 3/4T',             'DEMO01', 'FMC', 'HQ/OPS/SUPPLY', 'T95992', '1002596823', 'TLR CGO HI MOB 3/4T'),
  ('HHC-WB',  'HHCWB',  'M1112',          'SN-DEMO-041',           'TRALR WTR M1112 8 WHL',           'DEMO01', 'FMC', 'HQ/OPS/SUPPLY', 'W98825', '1008002484', 'TRALR WTR M1112 8 WHL'),

  -- FMT Section
  ('HHC-80G', 'HHC80G', 'MEP803A',        'SN-DEMO-035',             'GEN ST DSL MEP-803A',             'DEMO01', 'FMC', 'FMT', 'G74711', '1007958528', 'GEN ST DSL MEP-803A'),
  ('HHC-81G', 'HHC81G', 'MEP803A',        'SN-DEMO-036',             'GEN ST DSL MEP-803A',             'DEMO01', 'FMC', 'FMT', 'G74711', '1005411987', 'GEN ST DSL MEP-803A'),
  ('HHC-82',  'HHC82',  'M1085A1P2WOW',   'SN-DEMO-002',   'TRK CGO LWB WO/WINCH',            'DEMO01', 'FMC', 'FMT', 'T93271', '1022148141', 'TRK CGO LWB WO/WINCH'),
  ('HHC-84',  'HHC84',  'M1097',          'SN-DEMO-022',              'TRK UTIL 10000 M1097',            'DEMO01', 'FMC', 'FMT', 'T07679', '1008006697', 'TRK UTIL 10000 M1097'),
  ('HHC-84T', 'HHC84T', 'M1102',          'SN-DEMO-016',                'TLR CGO HI MOB 11/4T',            'DEMO01', 'FMC', 'FMT', 'T95924', '1007965880', 'TLR CGO HI MOB 11/4T'),
  ('HHC-85',  'HHC85',  'M1097',          'SN-DEMO-019',              'TRK UTIL 10000 M1097',            'DEMO01', 'FMC', 'FMT', 'T07679', '1008008525', 'TRK UTIL 10000 M1097'),
  ('HHC-86',  'HHC86',  'M984A4WO/W',     'SN-DEMO-003',   'TRK WRECK M984A4 WO/W',           'DEMO01', 'FMC', 'FMT', 'T63161', '1007999730', 'TRK WRECK M984A4 WO/W'),
  ('HHC-87',  'HHC87',  'M1089A1WW',      'SN-DEMO-048',        'TRUCK WKR W/W M1089A1',           'DEMO01', 'FMC', 'FMT', 'T94709', '1007998600', 'TRUCK WKR W/W M1089A1'),

  -- S1 Section
  ('HQ-1',    'HQ1',    'M1152A1',        'SN-DEMO-015',              'TRK UT EX CAP M1152A1',           'DEMO01', 'FMC', 'S1', 'T37588', '1008014650', 'TRK UT EX CAP M1152A1'),
  ('HQ-1GT',  'HQ1GT',  'PU-822A/T',      'SN-DEMO-045',          'PWER PLANT UTLY (MED)',           'DEMO01', 'FMC', 'S1', 'P63462', '1008024218', 'PWER PLANT UTLY (MED)'),
  ('HQ-5',    'HQ5',    'M1165A1',        'SN-DEMO-012',              'TR UT EX CAP: M1165A1',           'DEMO01', 'FMC', 'S1', 'T56383', '1008015673', 'TR UT EX CAP: M1165A1'),

  -- S2 Section
  ('HQ-2',    'HQ2',    'M1097',          'SN-DEMO-021',              'TRK UTIL 10000 M1097',            'DEMO01', 'FMC', 'S2', 'T07679', '1008009316', 'TRK UTIL 10000 M1097'),
  ('HQ-2GT',  'HQ2GT',  'TRAILER-GEN',    'SN-DEMO-047',         'TRAILER, GENERATOR/ECU MTD, 2017 1013915', 'DEMO01', 'FMC', 'S2', 'YF309V', '1038577363', 'TRAILER, GENERATOR/ECU MTD, 2017 1013915'),

  -- S3/UMT Section
  ('HQ-3',    'HQ3',    'M1097',          'SN-DEMO-020',              'TRK UTIL 10000 M1097',            'DEMO01', 'FMC', 'S3/UMT', 'T07679', '1008009231', 'TRK UTIL 10000 M1097'),
  ('HQ-30G',  'HQ30G',  'MEP831',         'SN-DEMO-037',            'GEN SET DED MEP 831',             'DEMO01', 'FMC', 'S3/UMT', 'G18358', '1007964118', 'GEN SET DED MEP 831'),
  ('HQ-31G',  'HQ31G',  'MEP831',         'SN-DEMO-038',            'GEN SET DED MEP 831',             'DEMO01', 'FMC', 'S3/UMT', 'G18358', '1007974911', 'GEN SET DED MEP 831'),
  ('HQ-32G',  'HQ32G',  'MEP-1030',       'SN-DEMO-029',          'GENERATOR SET,DIESEL ENGINE',     'DEMO01', 'FMC', 'S3/UMT', 'G42488', '1037006202', 'GENERATOR SET,DIESEL ENGINE'),
  ('HQ-33',   'HQ33',   'M1078A1P2WOW',   'SN-DEMO-025',       'TRK CG M1078A1P2 WO/W',          'DEMO01', 'FMC', 'S3/UMT', 'T59448', '1007996014', 'TRK CG M1078A1P2 WO/W'),
  ('HQ-33T',  'HQ33T',  'M1082',          'SN-DEMO-044',       'TRLER FLAT BED M1082',            'DEMO01', 'FMC', 'S3/UMT', 'T96564', '1008004423', 'TRLER FLAT BED M1082'),
  ('HQ-3GT',  'HQ3GT',  'TRAILER-GEN',    'SN-DEMO-046',         'TRAILER, GENERATOR/ECU MTD, 2017 1013915', 'DEMO01', 'FMC', 'S3/UMT', 'YF309V', '1037604727', 'TRAILER, GENERATOR/ECU MTD, 2017 1013915'),
  ('HQ-3T',   'HQ3T',   'M1101',          'SN-DEMO-005',               'TLR CGO HI MOB 3/4T',             'DEMO01', 'FMC', 'S3/UMT', 'T95992', '1007980811', 'TLR CGO HI MOB 3/4T'),
  ('HQ-7',    'HQ7',    'M1151A1',        'SN-DEMO-009',              'TR UT INT ARM M1151A1',            'DEMO01', 'FMC', 'S3/UMT', 'T34704', '1013917894', 'TR UT INT ARM M1151A1'),
  ('UMT-1',   'UMT1',   'M1152A1',        'SN-DEMO-013',              'TRK UT EX CAP M1152A1',           'DEMO01', 'FMC', 'S3/UMT', 'T37588', '1008014129', 'TRK UT EX CAP M1152A1'),

  -- S4 Section
  ('HQ-4',    'HQ4',    'M1078A1P2WOW',   'SN-DEMO-026',       'TRK CG M1078A1P2 WO/W',          'DEMO01', 'FMC', 'S4', 'T59448', '1007996241', 'TRK CG M1078A1P2 WO/W'),

  -- S6 Section
  ('HQ-6',    'HQ6',    'M1151A1',        'SN-DEMO-008',              'TR UT INT ARM M1151A1',            'DEMO01', 'FMC', 'S6', 'T34704', '1013917892', 'TR UT INT ARM M1151A1'),
  ('HQ-9',    'HQ9',    'M1165A1',        'SN-DEMO-011',              'TR UT EX CAP: M1165A1',           'DEMO01', 'FMC', 'S6', 'T56383', '1008015497', 'TR UT EX CAP: M1165A1'),
  ('HQ-9G',   'HQ9G',   'MEP-1030',       'SN-DEMO-030',          'GENERATOR SET,DIESEL ENGINE',     'DEMO01', 'FMC', 'S6', 'G42488', '1037006201', 'GENERATOR SET,DIESEL ENGINE'),
  ('HQ-9T',   'HQ9T',   'M1101',          'SN-DEMO-004',               'TLR CGO HI MOB 3/4T',             'DEMO01', 'FMC', 'S6', 'T95992', '1007980693', 'TLR CGO HI MOB 3/4T'),

  -- FMT (shop equipment)
  ('SATS',    'SATS',   '95A81',          'SN-DEMO-039',       'SHOP EQUIP AUTO VEH',             'DEMO01', 'FMC', 'FMT', 'S25885', NULL,         'SHOP EQUIP AUTO VEH')

ON CONFLICT (bumper_number_normalized, unit) DO UPDATE SET
  bumper_number   = EXCLUDED.bumper_number,
  vehicle_type    = EXCLUDED.vehicle_type,
  serial_number   = EXCLUDED.serial_number,
  nomenclature    = EXCLUDED.nomenclature,
  status          = COALESCE(vehicles.status, EXCLUDED.status),  -- don't overwrite existing status
  section         = EXCLUDED.section,
  lin_number      = EXCLUDED.lin_number,
  nsn             = EXCLUDED.nsn,
  description     = EXCLUDED.description;

COMMIT;
