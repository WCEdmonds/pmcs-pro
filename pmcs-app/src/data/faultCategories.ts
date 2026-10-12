import type { FaultCategory } from '../types/diagnosis';

// affectsReadiness:
//   'determined-by-tree' — the category never forces readiness. For categories WITH a tree the
//     terminal decides; for categories WITHOUT a tree (body/glass/BII/housing/hitch) readiness
//     comes from the PMCS step's NMC criterion and the operator's choice (field app), because the
//     same category covers both NMC faults (e.g. "Fire extinguisher missing", "Cab will not
//     securely latch") and PMC faults (e.g. "Washer reservoir low").
//   'PMC' / 'NMC' — fallback used only when every step mapped to the category agrees.
export const FAULT_CATEGORIES: FaultCategory[] = [
  { id: 'fluid-leak', label: 'Fluid Leak', icon: 'droplets', hasDiagnosisTree: true, affectsReadiness: 'determined-by-tree' },
  { id: 'wont-start', label: "Won't Start", icon: 'power-off', hasDiagnosisTree: true, affectsReadiness: 'determined-by-tree' },
  { id: 'unusual-noise', label: 'Unusual Noise', icon: 'volume-x', hasDiagnosisTree: true, affectsReadiness: 'determined-by-tree' },
  { id: 'tire-damage', label: 'Tire Damage', icon: 'circle-x', hasDiagnosisTree: true, affectsReadiness: 'determined-by-tree' },
  { id: 'brake-issue', label: 'Brake Issue', icon: 'octagon-alert', hasDiagnosisTree: true, affectsReadiness: 'determined-by-tree' },
  { id: 'electrical', label: 'Electrical', icon: 'zap', hasDiagnosisTree: true, affectsReadiness: 'determined-by-tree' },
  { id: 'engine-overheat', label: 'Engine Overheats', icon: 'thermometer', hasDiagnosisTree: true, affectsReadiness: 'determined-by-tree' },
  { id: 'engine-oil-pressure', label: 'Low Oil Pressure', icon: 'gauge', hasDiagnosisTree: true, affectsReadiness: 'determined-by-tree' },
  { id: 'transmission', label: 'Transmission', icon: 'cog', hasDiagnosisTree: true, affectsReadiness: 'determined-by-tree' },
  { id: 'steering', label: 'Hard Steering', icon: 'circle-dot', hasDiagnosisTree: true, affectsReadiness: 'determined-by-tree' },
  { id: 'engine-smoke', label: 'Exhaust Smoke', icon: 'cloud', hasDiagnosisTree: true, affectsReadiness: 'determined-by-tree' },
  { id: 'fuel-system', label: 'Fuel System', icon: 'fuel', hasDiagnosisTree: true, affectsReadiness: 'determined-by-tree' },
  { id: 'cooling-system', label: 'Cooling System', icon: 'snowflake', hasDiagnosisTree: true, affectsReadiness: 'determined-by-tree' },
  { id: 'body-damage', label: 'Body Damage', icon: 'shield-alert', hasDiagnosisTree: false, affectsReadiness: 'determined-by-tree' },
  { id: 'glass-damage', label: 'Glass Damage', icon: 'scan', hasDiagnosisTree: false, affectsReadiness: 'determined-by-tree' },
  { id: 'missing-bii', label: 'Missing BII/Item', icon: 'package-x', hasDiagnosisTree: false, affectsReadiness: 'determined-by-tree' },
  { id: 'weapon-station', label: 'Weapon Station', icon: 'shield-alert', hasDiagnosisTree: false, affectsReadiness: 'determined-by-tree' },
  { id: 'controls', label: 'Controls / Pedals', icon: 'triangle-alert', hasDiagnosisTree: false, affectsReadiness: 'determined-by-tree' },
  // M1097 (TM 9-2320-280-10) categories
  { id: 'heater', label: 'Heater', icon: 'flame', hasDiagnosisTree: true, affectsReadiness: 'determined-by-tree' },
  { id: 'winch', label: 'Winch', icon: 'cable', hasDiagnosisTree: true, affectsReadiness: 'determined-by-tree' },
  // Trailer-specific categories
  { id: 'trailer-electrical', label: 'Trailer Lights', icon: 'lightbulb', hasDiagnosisTree: true, affectsReadiness: 'determined-by-tree' },
  { id: 'trailer-brakes', label: 'Trailer Brakes', icon: 'octagon-alert', hasDiagnosisTree: true, affectsReadiness: 'determined-by-tree' },
  { id: 'trailer-suspension', label: 'Suspension / Lean', icon: 'arrow-down-up', hasDiagnosisTree: true, affectsReadiness: 'determined-by-tree' },
  { id: 'trailer-support-leg', label: 'Support Leg', icon: 'arrow-up-from-line', hasDiagnosisTree: true, affectsReadiness: 'determined-by-tree' },
  { id: 'trailer-hitch', label: 'Lunette / Drawbar', icon: 'link', hasDiagnosisTree: false, affectsReadiness: 'determined-by-tree' },
  // Generator-specific categories
  { id: 'gen-engine', label: 'Engine Problem', icon: 'power-off', hasDiagnosisTree: true, affectsReadiness: 'determined-by-tree' },
  { id: 'gen-exhaust', label: 'Exhaust Smoke', icon: 'cloud', hasDiagnosisTree: true, affectsReadiness: 'determined-by-tree' },
  { id: 'gen-oil-pressure', label: 'Low Oil Pressure', icon: 'gauge', hasDiagnosisTree: true, affectsReadiness: 'determined-by-tree' },
  { id: 'gen-overheat', label: 'Overheating', icon: 'thermometer', hasDiagnosisTree: true, affectsReadiness: 'determined-by-tree' },
  { id: 'gen-electrical', label: 'Electrical / Output', icon: 'zap', hasDiagnosisTree: true, affectsReadiness: 'determined-by-tree' },
  { id: 'gen-fuel', label: 'Fuel System', icon: 'fuel', hasDiagnosisTree: false, affectsReadiness: 'NMC' },
  { id: 'gen-housing', label: 'Housing / Skid Base', icon: 'shield-alert', hasDiagnosisTree: false, affectsReadiness: 'determined-by-tree' },
  { id: 'gen-winterization', label: 'Winterization Kit', icon: 'snowflake', hasDiagnosisTree: false, affectsReadiness: 'determined-by-tree' },
];

// Maps PMCS steps to relevant fault categories.
// Only categories the soldier could plausibly observe at that step.
// Exterior = what you see/touch outside. Under hood = engine systems. Cab = interior/instruments.
export const STEP_CATEGORIES: Record<string, string[]> = {
  // ── M1151 / M1152 (TM 9-2320-387-10 Table 2-2) — replaces all existing m1151-b-* and m1152-b-* entries ──
  'm1151-b-001': ['fluid-leak', 'body-damage'],  // BEFORE 1 Left Front, Side Exterior
  'm1151-b-002': ['tire-damage'],  // BEFORE 2 Left Side Tires
  'm1151-b-003': ['fluid-leak', 'body-damage'],  // BEFORE 3 Rear Exterior
  'm1151-b-004': ['fluid-leak', 'body-damage'],  // BEFORE 4 Right Front, Side Exterior
  'm1151-b-005': ['tire-damage'],  // BEFORE 5 Right Side Tires
  'm1151-b-006': ['fluid-leak', 'body-damage'],  // BEFORE 6 Front
  'm1151-b-007': ['fluid-leak', 'steering'],  // BEFORE 6.1 Power Steering Reservoir (P/N RCSK 18330)
  'm1151-b-008': ['fluid-leak', 'steering'],  // BEFORE 6.2 Power Steering Reservoir (P/N 94252A)
  'm1151-b-009': ['electrical', 'engine-overheat', 'steering'],  // BEFORE 7 Serpentine Drivebelt and Pulleys
  'm1151-b-010': ['fluid-leak', 'engine-overheat', 'cooling-system'],  // BEFORE 8 Cooling System
  'm1151-b-011': ['body-damage'],  // BEFORE 8.2 Doors (Frag 5/Armored) (M1151A1 ONLY)
  'm1151-b-012': ['missing-bii', 'body-damage'],  // BEFORE 9 Seat and Seatbelts
  'm1151-b-013': ['missing-bii'],  // BEFORE 10 Fire Extinguisher
  'm1151-b-014': ['electrical', 'missing-bii'],  // BEFORE 10.1 Automatic Fire Extinguisher System (AFES)
  'm1151-b-015': ['transmission'],  // BEFORE 11 Gear Shifter Lever
  'm1151-b-018': ['wont-start', 'electrical', 'engine-oil-pressure', 'engine-overheat', 'engine-smoke', 'brake-issue', 'fuel-system'],  // BEFORE 12 Instrument Panel
  'm1151-b-022': ['steering'],  // BEFORE 13 Steering
  'm1151-b-023': ['brake-issue'],  // BEFORE 14 Brakes
  'm1151-b-021': ['weapon-station', 'missing-bii'],  // BEFORE 15 Weapon Station
  'm1151-b-024': ['weapon-station'],  // BEFORE 15.1 Traversing Unit (M1151A1 ONLY)
  'm1151-b-025': ['weapon-station', 'electrical'],  // BEFORE 15.2 Battery Powered Motorized Traversing Unit (BPMTU) (M1151A1 ONLY)
  'm1151-b-026': ['engine-oil-pressure', 'engine-overheat', 'engine-smoke', 'electrical', 'brake-issue', 'fuel-system'],  // DURING 16 Controls and Indicators
  'm1151-b-027': ['brake-issue', 'unusual-noise'],  // DURING 17 Brakes
  'm1151-b-028': ['steering', 'tire-damage', 'unusual-noise'],  // DURING 18 Steering
  'm1151-b-029': ['controls'],  // DURING 18.1 Accelerator Pedal
  'm1151-b-030': ['unusual-noise', 'transmission'],  // DURING 19 Powertrain
  'm1151-b-031': ['transmission'],  // DURING 20 Transmission
  'm1151-b-032': ['electrical'],  // DURING 21 Air Conditioner
  'm1151-b-033': ['transmission'],  // AFTER 21.2 Gear Shifter Lever
  'm1151-b-034': ['transmission', 'fluid-leak'],  // AFTER 22 Transmission Fluid
  'm1151-b-035': ['fuel-system', 'fluid-leak'],  // AFTER 23 Fuel Filter
  'm1151-b-036': ['tire-damage'],  // AFTER 24 Left Side Tires
  'm1151-b-037': ['glass-damage', 'missing-bii'],  // AFTER 25 Mirror (Left Side)
  'm1151-b-038': ['fluid-leak', 'body-damage'],  // AFTER 26 Left Front, Side Exterior
  'm1151-b-039': ['fluid-leak', 'body-damage'],  // AFTER 27 Rear Exterior
  'm1151-b-040': ['tire-damage'],  // AFTER 28 Right Side Tires
  'm1151-b-041': ['glass-damage', 'missing-bii'],  // AFTER 29 Mirror (Right Side)
  'm1151-b-042': ['fluid-leak', 'body-damage'],  // AFTER 30 Right Front, Side Exterior
  'm1151-b-043': ['engine-oil-pressure', 'fluid-leak', 'engine-smoke'],  // AFTER 31 Engine Oil
  'm1151-b-044': ['fluid-leak', 'steering'],  // AFTER 32 Power Steering Lines and Fittings
  'm1151-b-045': ['fluid-leak', 'cooling-system'],  // AFTER 33 Cooling System
  'm1151-b-046': ['brake-issue', 'fluid-leak'],  // AFTER 34 Master Cylinder
  'm1151-b-016': ['electrical'],  // AFTER 35 Lights
  'm1151-b-047': ['electrical'],  // AFTER 36 Horn
  'm1151-b-017': ['glass-damage', 'electrical'],  // AFTER 37 Windshield and Wipers
  'm1151-b-048': ['electrical'],  // AFTER 38 Light Switches
  'm1151-b-049': ['controls'],  // WEEKLY 38.1 Hand Throttle
  'm1151-b-050': ['tire-damage'],  // WEEKLY 39 Tires
  'm1151-b-051': ['unusual-noise', 'engine-smoke'],  // WEEKLY 40 Exhaust System
  'm1151-b-052': ['fluid-leak', 'unusual-noise'],  // WEEKLY 41 Shock Absorbers
  'm1151-b-054': ['body-damage', 'glass-damage'],  // WEEKLY 42.1 Doors and Windows
  'm1151-b-055': ['body-damage'],  // WEEKLY 43 Tailgate
  'm1151-b-056': ['body-damage'],  // WEEKLY 44 Body
  'm1151-b-057': ['cooling-system', 'missing-bii'],  // WEEKLY 44.1 Geared Fan Drive (SERIAL NUMBERS 3000000 AND ABOVE ONLY)
  'm1151-b-058': ['electrical', 'fuel-system', 'fluid-leak'],  // WEEKLY 45 Vehicular Heater (VEHICLE W/VEHICULAR WINTERIZATION KIT)
  'm1151-b-059': ['engine-smoke', 'body-damage'],  // WEEKLY 46 Air Cleaner
  'm1151-b-060': ['electrical', 'steering'],  // WEEKLY 47 Alternator Brackets
  'm1151-b-061': ['cooling-system', 'fluid-leak', 'engine-overheat'],  // WEEKLY 48 Cooling System
  'm1151-b-062': ['electrical', 'wont-start'],  // WEEKLY 49 Batteries
  'm1151-b-063': ['weapon-station', 'electrical'],  // WEEKLY 49.1 Battery Powered Motorized Traversing Unit (BPMTU) Batteries (M1151A1 WITH BPMTU (see item 15.2))
  'm1151-b-064': ['weapon-station', 'body-damage'],  // WEEKLY 50 Weapon Station
  'm1151-b-065': ['missing-bii', 'unusual-noise'],  // WEEKLY 51 Tiedowns
  'm1151-b-066': ['body-damage', 'missing-bii'],  // WEEKLY 52 Tow Pintle
  'm1151-b-067': ['brake-issue'],  // WEEKLY 54 Parking Brake
  'm1151-b-068': ['steering'],  // WEEKLY 54.1 Steering Gear Mounting
  'm1151-b-069': ['electrical', 'fluid-leak'],  // WEEKLY 55 Windshield Washer
  'm1151-b-070': ['electrical', 'fuel-system', 'fluid-leak'],  // WEEKLY 55.1 Rear Troop/Cargo Heater (VEHICLE W/TROOP/CARGO WINTERIZATION KIT)
  'm1151-b-071': ['body-damage', 'missing-bii'],  // WEEKLY 55.2 Deep Water Fording Kit (IF INSTALLED)
  'm1151-b-072': ['body-damage'],  // MONTHLY 56 Corrosion
  'm1151-b-073': ['body-damage'],  // MONTHLY 57 Tailgate
  'm1151-b-074': ['body-damage', 'missing-bii'],  // MONTHLY 58 Winch
  'm1151-b-075': ['body-damage'],  // MONTHLY 59 Zippers
  'm1152-b-001': ['fluid-leak', 'body-damage'],  // BEFORE 1 Left Front, Side Exterior
  'm1152-b-002': ['tire-damage'],  // BEFORE 2 Left Side Tires
  'm1152-b-003': ['fluid-leak', 'body-damage'],  // BEFORE 3 Rear Exterior
  'm1152-b-004': ['fluid-leak', 'body-damage'],  // BEFORE 4 Right Front, Side Exterior
  'm1152-b-005': ['tire-damage'],  // BEFORE 5 Right Side Tires
  'm1152-b-006': ['fluid-leak', 'body-damage'],  // BEFORE 6 Front
  'm1152-b-007': ['fluid-leak', 'steering'],  // BEFORE 6.1 Power Steering Reservoir (P/N RCSK 18330)
  'm1152-b-008': ['fluid-leak', 'steering'],  // BEFORE 6.2 Power Steering Reservoir (P/N 94252A)
  'm1152-b-009': ['electrical', 'engine-overheat', 'steering'],  // BEFORE 7 Serpentine Drivebelt and Pulleys
  'm1152-b-010': ['fluid-leak', 'engine-overheat', 'cooling-system'],  // BEFORE 8 Cooling System
  'm1152-b-011': ['body-damage'],  // BEFORE 8.2 Doors (Frag 5/Armored) (M1152A1 ONLY)
  'm1152-b-012': ['missing-bii', 'body-damage'],  // BEFORE 9 Seat and Seatbelts
  'm1152-b-013': ['missing-bii'],  // BEFORE 10 Fire Extinguisher
  'm1152-b-014': ['electrical', 'missing-bii'],  // BEFORE 10.1 Automatic Fire Extinguisher System (AFES)
  'm1152-b-015': ['transmission'],  // BEFORE 11 Gear Shifter Lever
  'm1152-b-018': ['wont-start', 'electrical', 'engine-oil-pressure', 'engine-overheat', 'engine-smoke', 'brake-issue', 'fuel-system'],  // BEFORE 12 Instrument Panel
  'm1152-b-022': ['steering'],  // BEFORE 13 Steering
  'm1152-b-023': ['brake-issue'],  // BEFORE 14 Brakes
  'm1152-b-026': ['engine-oil-pressure', 'engine-overheat', 'engine-smoke', 'electrical', 'brake-issue', 'fuel-system'],  // DURING 16 Controls and Indicators
  'm1152-b-027': ['brake-issue', 'unusual-noise'],  // DURING 17 Brakes
  'm1152-b-028': ['steering', 'tire-damage', 'unusual-noise'],  // DURING 18 Steering
  'm1152-b-029': ['controls'],  // DURING 18.1 Accelerator Pedal
  'm1152-b-030': ['unusual-noise', 'transmission'],  // DURING 19 Powertrain
  'm1152-b-031': ['transmission'],  // DURING 20 Transmission
  'm1152-b-032': ['electrical'],  // DURING 21 Air Conditioner
  'm1152-b-033': ['transmission'],  // AFTER 21.2 Gear Shifter Lever
  'm1152-b-034': ['transmission', 'fluid-leak'],  // AFTER 22 Transmission Fluid
  'm1152-b-035': ['fuel-system', 'fluid-leak'],  // AFTER 23 Fuel Filter
  'm1152-b-036': ['tire-damage'],  // AFTER 24 Left Side Tires
  'm1152-b-037': ['glass-damage', 'missing-bii'],  // AFTER 25 Mirror (Left Side)
  'm1152-b-038': ['fluid-leak', 'body-damage'],  // AFTER 26 Left Front, Side Exterior
  'm1152-b-039': ['fluid-leak', 'body-damage'],  // AFTER 27 Rear Exterior
  'm1152-b-040': ['tire-damage'],  // AFTER 28 Right Side Tires
  'm1152-b-041': ['glass-damage', 'missing-bii'],  // AFTER 29 Mirror (Right Side)
  'm1152-b-042': ['fluid-leak', 'body-damage'],  // AFTER 30 Right Front, Side Exterior
  'm1152-b-043': ['engine-oil-pressure', 'fluid-leak', 'engine-smoke'],  // AFTER 31 Engine Oil
  'm1152-b-044': ['fluid-leak', 'steering'],  // AFTER 32 Power Steering Lines and Fittings
  'm1152-b-045': ['fluid-leak', 'cooling-system'],  // AFTER 33 Cooling System
  'm1152-b-046': ['brake-issue', 'fluid-leak'],  // AFTER 34 Master Cylinder
  'm1152-b-016': ['electrical'],  // AFTER 35 Lights
  'm1152-b-047': ['electrical'],  // AFTER 36 Horn
  'm1152-b-017': ['glass-damage', 'electrical'],  // AFTER 37 Windshield and Wipers
  'm1152-b-048': ['electrical'],  // AFTER 38 Light Switches
  'm1152-b-049': ['controls'],  // WEEKLY 38.1 Hand Throttle
  'm1152-b-050': ['tire-damage'],  // WEEKLY 39 Tires
  'm1152-b-051': ['unusual-noise', 'engine-smoke'],  // WEEKLY 40 Exhaust System
  'm1152-b-052': ['fluid-leak', 'unusual-noise'],  // WEEKLY 41 Shock Absorbers
  'm1152-b-053': ['body-damage', 'glass-damage'],  // WEEKLY 42 Doors and Windows (M1152 ONLY, NOT M1152A1)
  'm1152-b-054': ['body-damage', 'glass-damage'],  // WEEKLY 42.1 Doors and Windows (M1152A1 ONLY)
  'm1152-b-055': ['body-damage'],  // WEEKLY 43 Tailgate
  'm1152-b-057': ['cooling-system', 'missing-bii'],  // WEEKLY 44.1 Geared Fan Drive (SERIAL NUMBERS 3000000 AND ABOVE ONLY)
  'm1152-b-058': ['electrical', 'fuel-system', 'fluid-leak'],  // WEEKLY 45 Vehicular Heater (VEHICLE W/VEHICULAR WINTERIZATION KIT)
  'm1152-b-059': ['engine-smoke', 'body-damage'],  // WEEKLY 46 Air Cleaner
  'm1152-b-060': ['electrical', 'steering'],  // WEEKLY 47 Alternator Brackets
  'm1152-b-061': ['cooling-system', 'fluid-leak', 'engine-overheat'],  // WEEKLY 48 Cooling System
  'm1152-b-062': ['electrical', 'wont-start'],  // WEEKLY 49 Batteries
  'm1152-b-065': ['missing-bii', 'unusual-noise'],  // WEEKLY 51 Tiedowns
  'm1152-b-066': ['body-damage', 'missing-bii'],  // WEEKLY 52 Tow Pintle
  'm1152-b-067': ['brake-issue'],  // WEEKLY 54 Parking Brake
  'm1152-b-068': ['steering'],  // WEEKLY 54.1 Steering Gear Mounting
  'm1152-b-069': ['electrical', 'fluid-leak'],  // WEEKLY 55 Windshield Washer
  'm1152-b-070': ['electrical', 'fuel-system', 'fluid-leak'],  // WEEKLY 55.1 Rear Troop/Cargo Heater (VEHICLE W/TROOP/CARGO WINTERIZATION KIT)
  'm1152-b-071': ['body-damage', 'missing-bii'],  // WEEKLY 55.2 Deep Water Fording Kit (IF INSTALLED)
  'm1152-b-072': ['body-damage'],  // MONTHLY 56 Corrosion
  'm1152-b-073': ['body-damage'],  // MONTHLY 57 Tailgate
  'm1152-b-074': ['body-damage', 'missing-bii'],  // MONTHLY 58 Winch
  'm1152-b-075': ['body-damage'],  // MONTHLY 59 Zippers

  // ── M1101 Trailer Zone 1: Drawbar & Front (BEFORE) ──
  'm1101-b-001': ['trailer-hitch'],                          // Lunette ring
  'm1101-b-002': ['trailer-brakes', 'trailer-hitch'],        // Brake actuator assembly
  'm1101-b-003': ['trailer-support-leg'],                     // Front support leg
  // ── M1101 Trailer Zone 2: Left Side (BEFORE) ──
  'm1101-b-004': ['trailer-brakes'],                          // Handbrake lever (left)
  'm1101-b-005': ['tire-damage'],                             // Tires (left)
  // ── M1101 Trailer Zone 3: Right Side (BEFORE) ──
  'm1101-b-006': ['tire-damage'],                             // Tires (right)
  'm1101-b-007': ['trailer-brakes'],                          // Handbrake lever (right)
  // ── M1101 Trailer Zone 4: Electrical (BEFORE) ──
  'm1101-b-008': ['trailer-electrical'],                      // Intervehicular cable / lights
  // ── M1101 Trailer Zone 5: Rear & Underside (AFTER) ──
  'm1101-b-009': ['body-damage'],                             // Rear stabilizers
  'm1101-b-010': ['trailer-suspension'],                      // Shock absorbers
  'm1101-b-011': ['trailer-hitch'],                           // Safety chains
  // ── M1101 Trailer Zone 6: Weekly ──
  'm1101-b-012': ['tire-damage'],                             // Wheel assemblies (left)
  'm1101-b-013': ['trailer-brakes'],                          // Brake lines/hoses
  'm1101-b-014': ['trailer-electrical'],                      // Lights, reflectors, wiring
  'm1101-b-015': ['tire-damage'],                             // Wheel assemblies (right)
  'm1101-b-016': ['body-damage'],                             // Cargo body
  'm1101-b-017': ['body-damage'],                             // Soft top kit
  'm1101-b-018': ['body-damage'],                             // Frame and crossmember
  // ── M1101 Trailer Zone 7: Monthly ──
  'm1101-b-019': ['trailer-brakes'],                          // Brake actuator fluid

  // ── MEP-803A Zone 1: Exterior — BEFORE ──
  'mep803a-b-001': ['gen-housing'],                           // Housing
  'mep803a-b-002': ['gen-housing'],                           // ID plates
  'mep803a-b-003': ['gen-housing'],                           // Skid base
  'mep803a-b-004': ['gen-housing'],                           // Acoustical materials
  // ── MEP-803A Zone 2: Engine Assembly — BEFORE ──
  'mep803a-b-005': ['gen-engine'],                            // Engine assembly
  'mep803a-b-006': ['gen-fuel'],                              // Fuel system
  'mep803a-b-007': ['gen-fuel'],                              // Fuel filter/water separator
  'mep803a-b-008': ['gen-oil-pressure'],                      // Lubrication system
  'mep803a-b-009': ['gen-overheat'],                          // Radiator
  'mep803a-b-010': ['gen-overheat'],                          // Hoses
  'mep803a-b-011': ['gen-overheat', 'gen-engine'],            // Cooling fan
  'mep803a-b-012': ['gen-overheat', 'gen-engine'],            // Fan belt
  // ── MEP-803A Zone 3: Cooling & Exhaust — BEFORE ──
  'mep803a-b-013': ['gen-overheat'],                          // Overflow bottle
  'mep803a-b-014': ['gen-exhaust'],                           // Exhaust system
  'mep803a-b-015': ['gen-engine'],                            // Air cleaner
  // ── MEP-803A Zone 4: Electrical — BEFORE ──
  'mep803a-b-016': ['gen-electrical'],                        // Ground rod
  'mep803a-b-017': ['gen-electrical'],                        // Batteries
  'mep803a-b-018': ['gen-electrical'],                        // Battery cables
  'mep803a-b-019': ['gen-electrical'],                        // Output box
  'mep803a-b-020': ['gen-electrical'],                        // Controls and indicators
  'mep803a-b-021': ['gen-electrical'],                        // Control box harness
  // ── MEP-803A Zone 5: DURING ──
  'mep803a-b-022': ['gen-housing'],                           // Housing
  'mep803a-b-023': ['gen-engine'],                            // Engine assembly
  'mep803a-b-024': ['gen-fuel'],                              // Fuel system
  'mep803a-b-025': ['gen-oil-pressure'],                      // Lubrication system
  'mep803a-b-026': ['gen-overheat', 'gen-engine'],            // Cooling fan
  'mep803a-b-027': ['gen-overheat'],                          // Overflow bottle
  'mep803a-b-028': ['gen-electrical'],                        // Ground rod
  'mep803a-b-029': ['gen-electrical'],                        // Controls and indicators
  // ── MEP-803A Zone 6: AFTER ──
  'mep803a-b-030': ['gen-housing'],                           // Housing
  'mep803a-b-031': ['gen-housing'],                           // ID plates
  'mep803a-b-032': ['gen-housing'],                           // Skid base
  'mep803a-b-033': ['gen-engine'],                            // Engine assembly
  'mep803a-b-034': ['gen-fuel'],                              // Fuel system
  'mep803a-b-035': ['gen-fuel'],                              // Fuel filter/water separator
  'mep803a-b-036': ['gen-oil-pressure'],                      // Lubrication system
  'mep803a-b-037': ['gen-overheat'],                          // Radiator
  'mep803a-b-038': ['gen-overheat'],                          // Hoses
  'mep803a-b-039': ['gen-overheat', 'gen-engine'],            // Fan belt
  'mep803a-b-040': ['gen-electrical'],                        // Controls and indicators

  // ── LMTV M1078 Approach / Exterior Walk-Around ──
  'm1078-b-001': ['glass-damage', 'electrical'],                    // 1 Windshield, Windshield Wipers, and Washer Reservoir
  'm1078-b-002': ['body-damage', 'missing-bii'],                    // 1.1 Front and Rear Shackles
  'm1078-b-003': ['fluid-leak', 'body-damage'],                     // 2 Exterior of Vehicle
  'm1078-b-004': ['cooling-system', 'fluid-leak', 'engine-overheat'], // 3 Coolant
  'm1078-b-005': ['fuel-system', 'fluid-leak'],                     // 4 Fuel Tank
  'm1078-b-006': ['tire-damage', 'body-damage'],                    // 5 Spare Tire Strap
  'm1078-b-007': ['body-damage', 'fluid-leak'],                     // 6 Cab Hydraulic Latch
  'm1078-b-008': ['fluid-leak'],                                    // 7 Air/Hydraulic Power Unit
  // ── LMTV M1078 Cab Interior ──
  'm1078-b-009': ['missing-bii'],                                   // 8 Seat Belts
  'm1078-b-010': ['body-damage'],                                   // 9 Driver's Seat
  'm1078-b-011': ['missing-bii'],                                   // 10 Fire Extinguisher
  'm1078-b-012': ['electrical', 'wont-start', 'brake-issue'],       // 11 Lighted Indicator Display
  'm1078-b-013': ['electrical', 'glass-damage'],                    // 11.1 Windshield Wipers and Washer (Operational Check)
  // ── LMTV M1078 Engine Running Checks ──
  'm1078-b-014': ['engine-oil-pressure', 'electrical', 'wont-start'], // 12 OIL PRESS Gage
  'm1078-b-015': ['electrical', 'unusual-noise'],                   // 13 Tachometer
  'm1078-b-016': ['engine-overheat', 'electrical'],                 // 14 WATER TEMP Gage
  'm1078-b-017': ['engine-smoke', 'unusual-noise'],                 // 15 AIR FILTER RESTRICTION GAUGE
  'm1078-b-018': ['brake-issue', 'electrical'],                     // 16 FRONT BRAKE AIR and REAR BRAKE AIR Gages
  'm1078-b-019': ['electrical'],                                    // 17 VOLTS Gage
  'm1078-b-020': ['fuel-system', 'electrical'],                     // 18 FUEL Gage
  // ── LMTV M1078 Driving Checks ──
  'm1078-b-021': ['brake-issue'],                                   // 19 SYSTEM PARK Control
  'm1078-b-022': ['transmission', 'electrical'],                    // 20 WTEC II TEPSS or WTEC III TPSS
  'm1078-b-023': ['electrical'],                                    // 21 Turn Signal Control
  'm1078-b-024': ['electrical'],                                    // 22 Hazard Lights Switch
  // ── LMTV M1078 M1078 Cargo — Before (Table 2-2) ──
  'm1078-b-025': ['electrical', 'body-damage'],                     // T2-2 #1 Troop Transport Alarm Switch (If Equipped)
  // ── LMTV M1078 During Operation ──
  'm1078-b-026': ['electrical', 'engine-overheat', 'engine-oil-pressure', 'brake-issue', 'transmission'], // 23 Controls and Indicators
  'm1078-b-027': ['engine-smoke', 'unusual-noise'],                 // 24 Engine Operation
  'm1078-b-028': ['tire-damage'],                                   // 25 CTIS
  'm1078-b-029': ['brake-issue', 'unusual-noise'],                  // 26 Air Dryer
  'm1078-b-030': ['steering'],                                      // 27 Steering
  'm1078-b-031': ['brake-issue', 'unusual-noise'],                  // 28 Service Brakes
  'm1078-b-032': ['body-damage', 'electrical'],                     // T2-2 #2 LMHC (If Equipped)
  // ── LMTV M1078 After Operation ──
  'm1078-b-033': ['fluid-leak'],                                    // 29 Hydraulic Manifold
  'm1078-b-034': ['fluid-leak', 'body-damage'],                     // 30 Cab Hydraulic Cylinder
  'm1078-b-035': ['fluid-leak', 'body-damage'],                     // 31 Cab Hydraulic Latch
  'm1078-b-036': ['fuel-system', 'fluid-leak'],                     // 32 Fuel/Water Separator
  'm1078-b-037': ['fluid-leak', 'body-damage'],                     // 33 Engine Compartment
  'm1078-b-038': ['engine-oil-pressure', 'fluid-leak'],             // 34 Engine Oil
  'm1078-b-039': ['transmission', 'fluid-leak'],                    // 35 Transmission Oil
  'm1078-b-040': ['fluid-leak'],                                    // 36 Hydraulic Reservoir (If Equipped)
  'm1078-b-041': ['brake-issue'],                                   // 37 Air Tanks
  'm1078-b-042': ['tire-damage'],                                   // 38 Tires
  'm1078-b-043': ['electrical'],                                    // 39 Horn Button
  'm1078-b-044': ['electrical'],                                    // 40 Lights
  'm1078-b-045': ['electrical'],                                    // 41 Light Switches
  // ── LMTV M1078 Weekly ──
  'm1078-b-046': ['brake-issue'],                                   // 41.1 Front Gladhands
  'm1078-b-047': ['fluid-leak', 'cooling-system', 'fuel-system'],   // 42 Mounting/Coupling Hardware and Hoses/Tubes (Engine Systems)
  'm1078-b-048': ['body-damage', 'unusual-noise', 'fluid-leak'],    // 43 Mounting/Coupling Hardware and Hoses/Tubes (Chassis)
  'm1078-b-049': ['body-damage'],                                   // 44 11K SRW Operation (If Equipped)
  'm1078-b-050': ['electrical'],                                    // 45 Heater/Defrost Controls
  'm1078-b-051': ['tire-damage'],                                   // 46 Wheels and Tires
  'm1078-b-052': ['fluid-leak'],                                    // 47 Hydraulic Reservoir (If Equipped)
  'm1078-b-053': ['electrical', 'wont-start'],                      // 48 Batteries
  'm1078-b-054': ['brake-issue'],                                   // 49 Air Dryer
  'm1078-b-055': ['body-damage', 'brake-issue', 'unusual-noise', 'fluid-leak'], // 50 Underneath Vehicle
  'm1078-b-056': ['electrical'],                                    // 51 Electrical Connectors
  'm1078-b-057': ['brake-issue'],                                   // 52 Rear Gladhands
  'm1078-b-058': ['missing-bii'],                                   // 53 Reflectors
  'm1078-b-059': ['body-damage'],                                   // 54 Pintle Hook
  'm1078-b-060': ['body-damage'],                                   // 55 Shackles
  'm1078-b-061': ['body-damage'],                                   // 56 11K SRW Rollers (If Equipped)
  'm1078-b-062': ['body-damage', 'fluid-leak'],                     // 57 11K SRW (If Equipped)
  'm1078-b-063': ['fuel-system', 'fluid-leak'],                     // 58 Fuel Tank
  'm1078-b-064': ['glass-damage', 'body-damage'],                   // 59 Door, Window, and Mirror
  'm1078-b-065': ['engine-overheat', 'electrical'],                 // 60 Drive Belts, Fan, and Pulleys
  'm1078-b-066': ['engine-overheat'],                               // 61 Fan Clutch
  'm1078-b-067': ['cooling-system', 'fluid-leak'],                  // 62 Radiator Hoses
  'm1078-b-068': ['fuel-system', 'fluid-leak'],                     // 63 Fuel Filter
  'm1078-b-069': ['steering', 'fluid-leak'],                        // 64 Power Steering Reservoir
  'm1078-b-070': ['engine-smoke'],                                  // 65 Charge Air
  'm1078-b-071': ['body-damage', 'electrical'],                     // T2-2 #3 LMHC (If Equipped)
  'm1078-b-072': ['body-damage'],                                   // T2-2 #5 Cargo Bed
  // ── LMTV M1078 Monthly ──
  'm1078-b-073': ['tire-damage', 'body-damage'],                    // 66 Spare Tire
  'm1078-b-074': ['fuel-system'],                                   // 67 Ether Starting Aid
  'm1078-b-075': ['body-damage', 'missing-bii'],                    // 68 Rifle Stowage Mount
  'm1078-b-076': ['electrical'],                                    // 69 Amber Warning Light (If Equipped)
  'm1078-b-077': ['fluid-leak'],                                    // 70 Hydraulic Manifold
  'm1078-b-078': ['fluid-leak'],                                    // 71 Back-up Hydraulic Pump
  'm1078-b-079': ['body-damage'],                                   // 72 Tool Box
  'm1078-b-080': ['body-damage'],                                   // 73 11K SRW Cable (If Equipped)
  'm1078-b-081': ['body-damage'],                                   // 74 Springs
  'm1078-b-082': ['body-damage'],                                   // 75 Cab Lift Cylinder
  'm1078-b-083': ['body-damage'],                                   // T2-2 #6 Cargo Bed Sides and Tailgate
  'm1078-b-084': ['body-damage'],                                   // T2-2 #7 Ladder
  'm1078-b-085': ['body-damage'],                                   // T2-2 #8 Troopseats (If Equipped)
  'm1078-b-086': ['body-damage'],                                   // T2-2 #9 Cargo Cover
  'm1078-b-087': ['body-damage', 'electrical'],                     // T2-2 #10 LMHC (If Equipped)
  // ── M1097 HMMWV heavy variant (TM 9-2320-280-10 w/C3, Table 2-2) ──
  'm1097-b-001': ['fluid-leak', 'body-damage'],  // BEFORE 1 Left Front, Side Exterior
  'm1097-b-002': ['tire-damage'],  // BEFORE 2 Left Side Tires
  'm1097-b-003': ['fluid-leak', 'body-damage'],  // BEFORE 3 Rear Exterior
  'm1097-b-004': ['fluid-leak', 'body-damage'],  // BEFORE 5 Right Front, Side Exterior
  'm1097-b-005': ['tire-damage'],  // BEFORE 6 Right Side Tires
  'm1097-b-006': ['fluid-leak', 'body-damage'],  // BEFORE 7 Front
  'm1097-b-007': ['steering', 'fluid-leak'],  // BEFORE 7.1 Power Steering Reservoir
  'm1097-b-008': ['cooling-system', 'engine-overheat'],  // BEFORE 8 Cooling System
  'm1097-b-009': ['missing-bii', 'body-damage'],  // BEFORE 9 Seat and Seatbelts
  'm1097-b-010': ['missing-bii'],  // BEFORE 10 Fire Extinguisher
  'm1097-b-011': ['wont-start', 'electrical', 'engine-oil-pressure', 'engine-overheat', 'engine-smoke', 'brake-issue', 'fuel-system'],  // BEFORE 12 Instrument Panel
  'm1097-b-012': ['brake-issue'],  // BEFORE 14 Brakes
  'm1097-b-013': ['engine-oil-pressure', 'engine-overheat', 'engine-smoke', 'electrical'],  // DURING 17 Controls and Indicators
  'm1097-b-014': ['brake-issue', 'unusual-noise'],  // DURING 18 Brakes
  'm1097-b-015': ['steering', 'tire-damage'],  // DURING 19 Steering
  'm1097-b-016': ['controls'],  // DURING 19.1 Accelerator Pedal
  'm1097-b-017': ['unusual-noise', 'transmission'],  // DURING 20 Powertrain
  'm1097-b-018': ['transmission'],  // DURING 21 Transmission
  'm1097-b-019': ['transmission'],  // AFTER 22.1 Gear Shifter Lever
  'm1097-b-020': ['transmission', 'fluid-leak'],  // AFTER 23 Transmission Fluid
  'm1097-b-021': ['fuel-system', 'fluid-leak'],  // AFTER 24 Fuel Filter
  'm1097-b-022': ['tire-damage'],  // AFTER 25 Left Side Tires
  'm1097-b-023': ['glass-damage', 'missing-bii'],  // AFTER 26 Mirror (Left Side)
  'm1097-b-024': ['fluid-leak', 'body-damage'],  // AFTER 27 Left Front, Side Exterior
  'm1097-b-025': ['fluid-leak', 'body-damage'],  // AFTER 28 Rear Exterior
  'm1097-b-026': ['tire-damage'],  // AFTER 30 Right Side Tires
  'm1097-b-027': ['glass-damage', 'missing-bii'],  // AFTER 31 Mirror (Right Side)
  'm1097-b-028': ['fluid-leak', 'body-damage'],  // AFTER 32 Right Front, Side Exterior
  'm1097-b-029': ['engine-oil-pressure', 'fluid-leak'],  // AFTER 33 Engine Oil
  'm1097-b-030': ['steering', 'fluid-leak'],  // AFTER 34 Power Steering Lines and Fittings
  'm1097-b-031': ['cooling-system', 'fluid-leak'],  // AFTER 36 Cooling System
  'm1097-b-032': ['brake-issue', 'fluid-leak'],  // AFTER 37 Master Cylinder
  'm1097-b-033': ['body-damage'],  // AFTER 37.1 Windshield Washer Jar
  'm1097-b-034': ['electrical'],  // AFTER 38 Lights
  'm1097-b-035': ['electrical'],  // AFTER 39 Horn
  'm1097-b-036': ['glass-damage', 'electrical'],  // AFTER 40 Windshield and Wipers
  'm1097-b-037': ['electrical'],  // AFTER 41 Light Switches
  'm1097-b-038': ['controls'],  // WEEKLY 41.1 Hand Throttle
  'm1097-b-039': ['tire-damage'],  // WEEKLY 42 Tires
  'm1097-b-040': ['unusual-noise', 'engine-smoke'],  // WEEKLY 43 Exhaust System
  'm1097-b-041': ['fluid-leak', 'unusual-noise'],  // WEEKLY 44 Shock Absorbers
  'm1097-b-042': ['body-damage', 'glass-damage'],  // WEEKLY 45 Doors and Windows
  'm1097-b-043': ['body-damage'],  // WEEKLY 46 Tailgate
  'm1097-b-044': ['heater', 'fuel-system'],  // WEEKLY 49 Front Arctic Heater and/or Rear Troop/Cargo Heater (Vehicle 
  'm1097-b-045': ['engine-smoke'],  // WEEKLY 51 Air Cleaner
  'm1097-b-046': ['electrical', 'steering'],  // WEEKLY 52 Alternator Brackets
  'm1097-b-047': ['cooling-system', 'engine-overheat', 'fluid-leak', 'unusual-noise'],  // WEEKLY 53 Cooling System
  'm1097-b-048': ['electrical', 'wont-start'],  // WEEKLY 54 Batteries
  'm1097-b-049': ['missing-bii'],  // WEEKLY 58 Tiedowns
  'm1097-b-050': ['body-damage'],  // WEEKLY 63 Tow Pintle
  'm1097-b-051': ['body-damage'],  // WEEKLY 64 Tow Hooks
  'm1097-b-052': ['electrical'],  // WEEKLY 65 Trailer Electrical Connector
  'm1097-b-053': ['brake-issue'],  // WEEKLY 66 Parking Brake
  'm1097-b-054': ['body-damage'],  // MONTHLY 68 Corrosion
  'm1097-b-055': ['body-damage'],  // MONTHLY 69 Tailgate
  'm1097-b-056': ['body-damage'],  // MONTHLY 71 Shelter Mount Kit (M1037, M1042, M1097, M1097A1, M1097A2, an
  'm1097-b-057': ['winch'],  // MONTHLY 72 Winch (Vehicles with winch)
  'm1097-b-058': ['body-damage'],  // MONTHLY 75 Zippers
  'm1097-b-059': ['body-damage'],  // MONTHLY 76 Skid Plates (Vehicles equipped with skid plate)
  // ── MEP802A (TM 9-6115-641-10) ──
  'mep802a-b-001': ['gen-housing'],                                                   // BEFORE 1 Housing
  'mep802a-b-002': ['gen-housing'],                                                   // BEFORE 2 Identification Plates
  'mep802a-b-003': ['gen-housing'],                                                   // BEFORE 3 Skid Base
  'mep802a-b-004': ['gen-housing'],                                                   // BEFORE 4 Acoustical Materials
  'mep802a-b-005': ['gen-engine'],                                                    // BEFORE 5 Engine Assembly
  'mep802a-b-006': ['gen-fuel'],                                                      // BEFORE 6 Fuel System
  'mep802a-b-007': ['gen-fuel'],                                                      // BEFORE 7 Fuel Filter/Water Separator
  'mep802a-b-008': ['gen-oil-pressure'],                                              // BEFORE 8 Lubrication System
  'mep802a-b-009': ['gen-overheat'],                                                  // BEFORE 9 Radiator
  'mep802a-b-010': ['gen-overheat'],                                                  // BEFORE 10 Hoses
  'mep802a-b-011': ['gen-overheat', 'gen-engine'],                                    // BEFORE 11 Cooling Fan
  'mep802a-b-012': ['gen-overheat'],                                                  // BEFORE 11.1 Water Pump
  'mep802a-b-013': ['gen-overheat', 'gen-electrical', 'gen-engine'],                  // BEFORE 12 Fan Belt
  'mep802a-b-014': ['gen-overheat'],                                                  // BEFORE 13 Overflow Bottle
  'mep802a-b-015': ['gen-exhaust'],                                                   // BEFORE 14 Exhaust System
  'mep802a-b-016': ['gen-engine', 'gen-exhaust'],                                     // BEFORE 15 Air Cleaner Assembly
  'mep802a-b-017': ['gen-electrical'],                                                // BEFORE 16 Ground Rod Cable and Connections
  'mep802a-b-018': ['gen-electrical'],                                                // BEFORE 17 Batteries
  'mep802a-b-019': ['gen-electrical'],                                                // BEFORE 18 Battery Cables
  'mep802a-b-020': ['gen-electrical'],                                                // BEFORE 19 Output Box Assembly
  'mep802a-b-021': ['gen-electrical'],                                                // BEFORE 20 Controls and Indicators
  'mep802a-b-022': ['gen-electrical'],                                                // BEFORE 21 Control Box Harness
  'mep802a-b-023': ['gen-housing'],                                                   // DURING 22 Housing
  'mep802a-b-024': ['gen-engine'],                                                    // DURING 23 Engine Assembly
  'mep802a-b-025': ['gen-fuel'],                                                      // DURING 24 Fuel System
  'mep802a-b-026': ['gen-oil-pressure'],                                              // DURING 25 Lubrication System
  'mep802a-b-027': ['gen-overheat', 'gen-engine'],                                    // DURING 26 Cooling Fan
  'mep802a-b-028': ['gen-overheat'],                                                  // DURING 27 Overflow Bottle
  'mep802a-b-029': ['gen-electrical'],                                                // DURING 28 Ground Rod Cable and Connections
  'mep802a-b-030': ['gen-electrical', 'gen-oil-pressure', 'gen-overheat'],            // DURING 29 Controls and Indicators
  'mep802a-b-031': ['gen-housing'],                                                   // AFTER 30 Housing
  'mep802a-b-032': ['gen-housing'],                                                   // AFTER 31 Identification Plates
  'mep802a-b-033': ['gen-housing'],                                                   // AFTER 32 Skid Base
  'mep802a-b-034': ['gen-engine'],                                                    // AFTER 33 Engine Assembly
  'mep802a-b-035': ['gen-fuel'],                                                      // AFTER 34 Fuel System
  'mep802a-b-036': ['gen-fuel'],                                                      // AFTER 35 Fuel Filter/Water Separator
  'mep802a-b-037': ['gen-oil-pressure'],                                              // AFTER 36 Lubrication System
  'mep802a-b-038': ['gen-overheat'],                                                  // AFTER 37 Radiator
  'mep802a-b-039': ['gen-overheat'],                                                  // AFTER 38 Hoses
  'mep802a-b-040': ['gen-overheat', 'gen-electrical', 'gen-engine'],                  // AFTER 39 Fan Belt
  'mep802a-b-041': ['gen-electrical'],                                                // AFTER 40 Controls and Indicators
  'mep802a-b-042': ['gen-winterization'],                                             // BEFORE 41 Heater Assembly
  'mep802a-b-043': ['gen-winterization'],                                             // BEFORE 42 Control Unit
  'mep802a-b-044': ['gen-winterization'],                                             // BEFORE 43 Fuel Pump
  'mep802a-b-045': ['gen-winterization'],                                             // BEFORE 44 Fuel Tank
  'mep802a-b-046': ['gen-winterization'],                                             // BEFORE 45 Fuel Lines
  'mep802a-b-047': ['gen-winterization'],                                             // BEFORE 46 Heater
  'mep802a-b-048': ['gen-winterization'],                                             // BEFORE 47 Exhaust Hose
  'mep802a-b-049': ['gen-winterization'],                                             // BEFORE 48 Air Inlet Hose
  'mep802a-b-050': ['gen-winterization'],                                             // BEFORE 49 Winterization Kit Coolant Lines
  'mep802a-b-051': ['gen-winterization'],                                             // BEFORE 50 Coolant Pump
  'mep802a-b-052': ['gen-winterization'],                                             // BEFORE 51 Coolant Lines
  'mep802a-b-053': ['gen-winterization'],                                             // BEFORE 52 Wire Harness
  'mep802a-b-054': ['gen-winterization', 'gen-electrical'],                           // BEFORE 53 Heater Control and Switch Lamp
  'mep802a-b-055': ['gen-winterization'],                                             // DURING 54 Heater Assembly
  'mep802a-b-056': ['gen-winterization'],                                             // DURING 55 All Fuel Connections
  'mep802a-b-057': ['gen-winterization'],                                             // DURING 56 All Coolant Connections
  'mep802a-b-058': ['gen-winterization'],                                             // AFTER 57 Heater Assembly
  'mep802a-b-059': ['gen-winterization'],                                             // AFTER 58 Control Unit
  'mep802a-b-060': ['gen-winterization'],                                             // AFTER 59 All Fuel Connections
  'mep802a-b-061': ['gen-winterization'],                                             // AFTER 60 Fuel Pump
  'mep802a-b-062': ['gen-winterization'],                                             // AFTER 61 Heater
  'mep802a-b-063': ['gen-winterization'],                                             // AFTER 62 Exhaust Hose
  'mep802a-b-064': ['gen-winterization'],                                             // AFTER 63 Air Inlet Hose
  'mep802a-b-065': ['gen-winterization'],                                             // AFTER 64 All Coolant Connections
  'mep802a-b-066': ['gen-winterization'],                                             // AFTER 65 Wire Harness
  // ── MEP1030 (TM 9-6115-749-10) ──
  'mep1030-b-001': ['gen-electrical'],                                                // BEFORE 1 Ground Rod, Clamp, and Cable
  'mep1030-b-002': ['gen-housing'],                                                   // BEFORE 2 Rear Panel
  'mep1030-b-003': ['gen-housing'],                                                   // BEFORE 3 ID Plates and Labels
  'mep1030-b-004': ['gen-housing'],                                                   // BEFORE 4 DCS Cover
  'mep1030-b-005': ['gen-electrical'],                                                // BEFORE 5 DCS
  'mep1030-b-006': ['gen-electrical'],                                                // BEFORE 6 Convenience Receptacle
  'mep1030-b-007': ['gen-housing'],                                                   // BEFORE 7 Flexible Sleeve
  'mep1030-b-008': ['gen-fuel'],                                                      // BEFORE 8 Fuel Fill
  'mep1030-b-009': ['gen-housing'],                                                   // BEFORE 9 Rear Door
  'mep1030-b-010': ['gen-fuel'],                                                      // BEFORE 10 Fuel Tank
  'mep1030-b-011': ['gen-fuel'],                                                      // BEFORE 11 Fuel System Hoses
  'mep1030-b-012': ['gen-fuel'],                                                      // BEFORE 12 Fuel Pumps and Fuel Manifold
  'mep1030-b-013': ['gen-electrical'],                                                // BEFORE 13 Electrical Connections
  'mep1030-b-014': ['gen-housing', 'gen-overheat'],                                   // BEFORE 14 Top Panel
  'mep1030-b-015': ['gen-housing'],                                                   // BEFORE 15 ID Plates and Labels
  'mep1030-b-016': ['gen-overheat'],                                                  // BEFORE 16 Radiator, Exterior
  'mep1030-b-017': ['gen-overheat'],                                                  // BEFORE 17 Radiator, Interior
  'mep1030-b-018': ['gen-exhaust'],                                                   // BEFORE 18 Muffler
  'mep1030-b-019': ['gen-housing'],                                                   // BEFORE 19 Right-Side Panel
  'mep1030-b-020': ['gen-housing'],                                                   // BEFORE 20 ID Plates and Labels
  'mep1030-b-021': ['gen-housing'],                                                   // BEFORE 21 Skid Base
  'mep1030-b-022': ['gen-oil-pressure'],                                              // BEFORE 22 Oil Drain Outlet
  'mep1030-b-023': ['gen-housing'],                                                   // BEFORE 23 Output Box Door
  'mep1030-b-024': ['gen-housing'],                                                   // BEFORE 24 Right-Side Door
  'mep1030-b-025': ['gen-electrical'],                                                // BEFORE 25 Output Connections
  'mep1030-b-026': ['gen-housing'],                                                   // BEFORE 26 Output Terminal Board Protective Cover
  'mep1030-b-027': ['gen-housing'],                                                   // BEFORE 27 ID Plates and Labels
  'mep1030-b-028': ['gen-housing'],                                                   // BEFORE 28 Terminal Nut Wrench
  'mep1030-b-029': ['gen-engine', 'gen-fuel'],                                        // BEFORE 29 Engine and Compartment Base
  'mep1030-b-030': ['gen-exhaust'],                                                   // BEFORE 30 Internal Exhaust Pipe
  'mep1030-b-031': ['gen-overheat'],                                                  // BEFORE 31 Radiator Hoses and Pipes
  'mep1030-b-032': ['gen-winterization'],                                             // BEFORE 32 Winterization Kit (If Installed)
  'mep1030-b-033': ['gen-oil-pressure'],                                              // BEFORE 33 Oil Drain Line
  'mep1030-b-034': ['gen-oil-pressure'],                                              // BEFORE 34 Oil Level
  'mep1030-b-035': ['gen-fuel'],                                                      // BEFORE 35 Fuel Lines
  'mep1030-b-036': ['gen-fuel'],                                                      // BEFORE 36 Fuel Filter/Water Separator
  'mep1030-b-037': ['gen-engine', 'gen-exhaust'],                                     // BEFORE 37 Air Cleaner Assembly
  'mep1030-b-038': ['gen-electrical'],                                                // BEFORE 38 AC Generator
  'mep1030-b-039': ['gen-housing'],                                                   // BEFORE 39 Storage Box
  'mep1030-b-040': ['gen-housing'],                                                   // BEFORE 40 Front Panel
  'mep1030-b-041': ['gen-housing'],                                                   // BEFORE 41 ID Plates and Labels
  'mep1030-b-042': ['gen-electrical'],                                                // BEFORE 42 NATO Slave Receptacle
  'mep1030-b-043': ['gen-housing'],                                                   // BEFORE 43 Grounding Rod Storage Door
  'mep1030-b-044': ['gen-housing'],                                                   // BEFORE 44 Left-Side Panel
  'mep1030-b-045': ['gen-fuel'],                                                      // BEFORE 45 Fuel Drain Fitting
  'mep1030-b-046': ['gen-housing'],                                                   // BEFORE 46 Skid Base
  'mep1030-b-047': ['gen-housing'],                                                   // BEFORE 47 Left-Side Door
  'mep1030-b-048': ['gen-oil-pressure'],                                              // BEFORE 48 Oil Filter
  'mep1030-b-049': ['gen-engine', 'gen-fuel'],                                        // BEFORE 49 Engine and Compartment Base
  'mep1030-b-050': ['gen-overheat'],                                                  // BEFORE 50 Coolant Overflow Bottle
  'mep1030-b-051': ['gen-electrical', 'gen-overheat'],                                // BEFORE 51 Battery-Charging Alternator
  'mep1030-b-052': ['gen-electrical'],                                                // BEFORE 52 Batteries
  'mep1030-b-053': ['gen-electrical', 'gen-engine'],                                  // BEFORE 53 Starter
  'mep1030-b-054': ['gen-electrical'],                                                // BEFORE 54 AC Generator
  'mep1030-b-055': ['gen-housing'],                                                   // BEFORE 55 ID Plates and Labels
  'mep1030-b-056': ['gen-overheat'],                                                  // BEFORE 56 Radiator Hoses and Pipes
  'mep1030-b-057': ['gen-housing'],                                                   // BEFORE 57 Document Box
  'mep1030-b-058': ['gen-electrical', 'gen-engine', 'gen-oil-pressure', 'gen-overheat'],// DURING 58 DCS
  'mep1030-b-059': ['gen-engine', 'gen-exhaust'],                                     // DURING 59 Engine
  'mep1030-b-060': ['gen-electrical'],                                                // DURING 60 Ground Rod and Connections
  'mep1030-b-061': ['gen-housing'],                                                   // DURING 61 Rear Door
  'mep1030-b-062': ['gen-electrical'],                                                // DURING 62 Convenience Receptacle
  'mep1030-b-063': ['gen-fuel'],                                                      // DURING 63 Fuel Tank
  'mep1030-b-064': ['gen-fuel'],                                                      // DURING 64 Fuel System Hoses
  'mep1030-b-065': ['gen-fuel'],                                                      // DURING 65 Fuel Pumps and Fuel Manifold
  'mep1030-b-066': ['gen-electrical'],                                                // DURING 66 Electrical Connections
  'mep1030-b-067': ['gen-electrical'],                                                // DURING 67 Relay Panel and Electrical Connections
  'mep1030-b-068': ['gen-engine', 'gen-fuel'],                                        // DURING 68 Engine and Compartment Base
  'mep1030-b-069': ['gen-oil-pressure'],                                              // DURING 69 Oil Drain Line
  'mep1030-b-070': ['gen-fuel'],                                                      // DURING 70 Fuel Lines and Fuel Filter/Water Separator
  'mep1030-b-071': ['gen-oil-pressure'],                                              // DURING 71 Oil Level
  'mep1030-b-072': ['gen-electrical'],                                                // DURING 72 AC Generator
  'mep1030-b-073': ['gen-fuel'],                                                      // DURING 73 Fuel Drain Fitting
  'mep1030-b-074': ['gen-overheat'],                                                  // DURING 74 Cooling Fan
  'mep1030-b-075': ['gen-engine', 'gen-fuel'],                                        // DURING 75 Engine and Compartment Base
  'mep1030-b-076': ['gen-overheat'],                                                  // DURING 76 Coolant Overflow Bottle
  'mep1030-b-077': ['gen-electrical'],                                                // DURING 77 AC Generator
  'mep1030-b-078': ['gen-fuel'],                                                      // AFTER 78 Fuel Fill
  'mep1030-b-079': ['gen-fuel'],                                                      // AFTER 79 Fuel Tank
  'mep1030-b-080': ['gen-electrical'],                                                // AFTER 80 Output Connections
  'mep1030-b-081': ['gen-housing'],                                                   // AFTER 81 Output Terminal Board Protective Cover
  'mep1030-b-082': ['gen-oil-pressure'],                                              // AFTER 82 Oil Drain Outlet
  'mep1030-b-083': ['gen-engine', 'gen-fuel'],                                        // AFTER 83 Engine and Compartment Base
  'mep1030-b-084': ['gen-oil-pressure'],                                              // AFTER 84 Oil Level
  'mep1030-b-085': ['gen-fuel'],                                                      // AFTER 85 Fuel Drain Fitting
  'mep1030-b-086': ['gen-electrical'],                                                // AFTER 86 Batteries
  'mep1030-b-087': ['gen-electrical'],                                                // AFTER 87 Battery Cables
  'mep1030-b-088': ['gen-engine', 'gen-fuel'],                                        // AFTER 88 Engine and Compartment Base
  'mep1030-b-089': ['gen-overheat'],                                                  // AFTER 89 Coolant Overflow Bottle
  'mep1030-b-090': ['gen-housing', 'gen-overheat'],                                   // AFTER 90 Intake and Exhaust Grates
  'mep1030-b-091': ['gen-overheat'],                                                  // AFTER 91 Radiator, Interior
  // ── MEP831A (TM 9-6115-639-13&P) ──
  'mep831a-b-001': ['gen-housing'],                                                   // BEFORE 1 Overall Generator Set
  'mep831a-b-002': ['gen-housing', 'gen-overheat'],                                   // BEFORE 2 Generator Set Main Access Cover
  'mep831a-b-003': ['gen-electrical'],                                                // BEFORE 3 Control Box and Output Panel
  'mep831a-b-004': ['gen-electrical'],                                                // BEFORE 4 Convenience Receptacle (60 Hz Only)
  'mep831a-b-005': ['gen-electrical'],                                                // BEFORE 5 NATO Slave Receptacle
  'mep831a-b-006': ['gen-electrical'],                                                // BEFORE 6 Output Panel
  'mep831a-b-007': ['gen-exhaust'],                                                   // BEFORE 7 Exhaust System
  'mep831a-b-008': ['gen-fuel'],                                                      // BEFORE 8 Fuel Fill Ports
  'mep831a-b-009': ['gen-fuel'],                                                      // BEFORE 9 Fuel Tank and Hoses
  'mep831a-b-010': ['gen-fuel'],                                                      // BEFORE 10 Fuel Filter/Water Separator
  'mep831a-b-011': ['gen-housing'],                                                   // BEFORE 11 Skid Base
  'mep831a-b-012': ['gen-electrical', 'gen-engine'],                                  // BEFORE 12 Battery
  'mep831a-b-013': ['gen-electrical'],                                                // BEFORE 13 Frequency Converter (A8)
  'mep831a-b-014': ['gen-oil-pressure'],                                              // BEFORE 14 Engine Oil
  'mep831a-b-015': ['gen-engine', 'gen-exhaust', 'gen-overheat'],                     // BEFORE 15 Engine Air Filter
  'mep831a-b-016': ['gen-electrical'],                                                // BEFORE 16 Engine Alternator Compartment
  'mep831a-b-017': ['gen-electrical'],                                                // DURING 17 VOLTAGE and LOAD Meters (Control Panel)
  'mep831a-b-018': ['gen-fuel', 'gen-engine'],                                        // DURING 18 FUEL LEVEL Meter (Located on Control Panel)
  'mep831a-b-019': ['gen-oil-pressure'],                                              // DURING 19 Engine Oil (After 8 Hours of Constant Use)
  'mep831a-b-020': ['gen-fuel'],                                                      // DURING 20 Fuel Filter/Water Separator (After 8 Hours of Constant Use)
  'mep831a-b-021': ['gen-fuel'],                                                      // AFTER 21 Fuel Lines
  'mep831a-b-022': ['gen-housing'],                                                   // AFTER 22 Overall Generator Set
  'mep831a-b-023': ['gen-housing'],                                                   // AFTER 23 Data Plates
  'mep831a-b-024': ['gen-fuel', 'gen-engine'],                                        // AFTER 24 Engine
};

export function getCategoriesForStep(stepId: string): FaultCategory[] {
  const categoryIds = STEP_CATEGORIES[stepId] || [];
  return FAULT_CATEGORIES.filter((c) => categoryIds.includes(c.id));
}

export function getCategoryById(id: string): FaultCategory | undefined {
  return FAULT_CATEGORIES.find((c) => c.id === id);
}
