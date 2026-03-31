import type { FaultCategory } from '../types/diagnosis';

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
  { id: 'body-damage', label: 'Body Damage', icon: 'shield-alert', hasDiagnosisTree: false, affectsReadiness: 'PMC' },
  { id: 'glass-damage', label: 'Glass Damage', icon: 'scan', hasDiagnosisTree: false, affectsReadiness: 'PMC' },
  { id: 'missing-bii', label: 'Missing BII/Item', icon: 'package-x', hasDiagnosisTree: false, affectsReadiness: 'PMC' },
  // Trailer-specific categories
  { id: 'trailer-electrical', label: 'Trailer Lights', icon: 'lightbulb', hasDiagnosisTree: true, affectsReadiness: 'determined-by-tree' },
  { id: 'trailer-brakes', label: 'Trailer Brakes', icon: 'octagon-alert', hasDiagnosisTree: true, affectsReadiness: 'determined-by-tree' },
  { id: 'trailer-suspension', label: 'Suspension / Lean', icon: 'arrow-down-up', hasDiagnosisTree: true, affectsReadiness: 'determined-by-tree' },
  { id: 'trailer-support-leg', label: 'Support Leg', icon: 'arrow-up-from-line', hasDiagnosisTree: false, affectsReadiness: 'NMC' },
  { id: 'trailer-hitch', label: 'Lunette / Drawbar', icon: 'link', hasDiagnosisTree: false, affectsReadiness: 'NMC' },
  // Generator-specific categories
  { id: 'gen-engine', label: 'Engine Problem', icon: 'power-off', hasDiagnosisTree: true, affectsReadiness: 'determined-by-tree' },
  { id: 'gen-exhaust', label: 'Exhaust Smoke', icon: 'cloud', hasDiagnosisTree: true, affectsReadiness: 'determined-by-tree' },
  { id: 'gen-oil-pressure', label: 'Low Oil Pressure', icon: 'gauge', hasDiagnosisTree: true, affectsReadiness: 'determined-by-tree' },
  { id: 'gen-overheat', label: 'Overheating', icon: 'thermometer', hasDiagnosisTree: true, affectsReadiness: 'determined-by-tree' },
  { id: 'gen-electrical', label: 'Electrical / Output', icon: 'zap', hasDiagnosisTree: true, affectsReadiness: 'determined-by-tree' },
  { id: 'gen-fuel', label: 'Fuel System', icon: 'fuel', hasDiagnosisTree: false, affectsReadiness: 'NMC' },
  { id: 'gen-housing', label: 'Housing / Skid Base', icon: 'shield-alert', hasDiagnosisTree: false, affectsReadiness: 'PMC' },
];

// Maps PMCS steps to relevant fault categories.
// Only categories the soldier could plausibly observe at that step.
// Exterior = what you see/touch outside. Under hood = engine systems. Cab = interior/instruments.
export const STEP_CATEGORIES: Record<string, string[]> = {
  // ── M1151 Zone 1: Exterior Walk-Around ──
  'm1151-b-001': ['fluid-leak', 'body-damage'],            // Left Front/Side Exterior
  'm1151-b-002': ['tire-damage'],                           // Left Side Tires
  'm1151-b-003': ['fluid-leak', 'body-damage'],            // Rear Exterior
  'm1151-b-004': ['fluid-leak', 'body-damage'],            // Right Front/Side Exterior
  'm1151-b-005': ['tire-damage'],                           // Right Side Tires
  'm1151-b-006': ['fluid-leak', 'body-damage'],            // Front of Vehicle
  // ── M1151 Zone 2: Under Hood ──
  'm1151-b-007': ['fluid-leak', 'steering'],               // Power Steering Reservoir (RCSK)
  'm1151-b-008': ['fluid-leak', 'steering'],               // Power Steering Reservoir (94252A)
  'm1151-b-009': ['electrical', 'engine-overheat'],        // Serpentine Drivebelt and Pulleys
  'm1151-b-010': ['fluid-leak', 'engine-overheat', 'cooling-system'], // Cooling System
  // ── M1151 Zone 3: Cab ──
  'm1151-b-011': ['body-damage'],                          // Armored Doors
  'm1151-b-012': ['missing-bii'],                          // Seat and Seatbelts
  'm1151-b-013': ['missing-bii'],                          // Fire Extinguisher
  'm1151-b-014': ['electrical'],                           // Automatic Fire Extinguisher (AFES)
  'm1151-b-015': ['transmission'],                         // Gear Shifter Lever
  'm1151-b-016': ['electrical'],                           // Lights
  'm1151-b-017': ['electrical', 'glass-damage'],           // Horn, Windshield and Wipers
  'm1151-b-018': ['wont-start', 'electrical'],             // Instrument Panel — Pre-Start
  'm1151-b-019': ['wont-start', 'electrical', 'engine-overheat', 'engine-smoke'], // Instrument Panel — Engine Start
  'm1151-b-020': ['electrical', 'engine-oil-pressure', 'engine-overheat', 'unusual-noise'], // Instrument Panel — Gauges
  'm1151-b-021': ['body-damage', 'missing-bii'],           // Weapon Station

  // ── M1152 Zone 1: Exterior Walk-Around ──
  'm1152-b-001': ['fluid-leak', 'body-damage'],
  'm1152-b-002': ['tire-damage'],
  'm1152-b-003': ['fluid-leak', 'body-damage'],
  'm1152-b-004': ['fluid-leak', 'body-damage'],
  'm1152-b-005': ['tire-damage'],
  'm1152-b-006': ['fluid-leak', 'body-damage'],
  // ── M1152 Zone 2: Under Hood ──
  'm1152-b-007': ['fluid-leak', 'steering'],
  'm1152-b-008': ['fluid-leak', 'steering'],
  'm1152-b-009': ['electrical', 'engine-overheat', 'cooling-system'],
  'm1152-b-010': ['fluid-leak', 'engine-overheat', 'cooling-system'],
  // ── M1152 Zone 3: Cab Interior ──
  'm1152-b-011': ['body-damage'],
  'm1152-b-012': ['missing-bii'],
  'm1152-b-013': ['missing-bii'],
  'm1152-b-014': ['electrical'],
  'm1152-b-015': ['transmission'],
  'm1152-b-016': ['electrical'],
  'm1152-b-017': ['glass-damage', 'electrical'],
  // ── M1152 Zone 4: Engine Running ──
  'm1152-b-018': ['wont-start', 'electrical'],
  'm1152-b-019': ['wont-start', 'electrical', 'engine-overheat', 'engine-smoke'],
  'm1152-b-020': ['electrical', 'engine-oil-pressure', 'engine-overheat', 'unusual-noise'],

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

  // ── LMTV M1078 Zone 1: Exterior ──
  'm1078-b-001': ['glass-damage', 'electrical'],           // Windshield, Wipers, Washer
  'm1078-b-002': ['body-damage'],                          // Front and Rear Shackles
  'm1078-b-003': ['fluid-leak', 'body-damage'],            // Exterior of Vehicle
  'm1078-b-004': ['fluid-leak', 'engine-overheat', 'cooling-system'], // Coolant
  'm1078-b-005': ['fluid-leak', 'fuel-system'],            // Fuel Tank
  'm1078-b-006': ['tire-damage', 'missing-bii'],           // Spare Tire Strap
  'm1078-b-007': ['body-damage'],                          // Cab Hydraulic Latch
  'm1078-b-008': ['fluid-leak', 'brake-issue'],            // Air/Hydraulic Power Unit
  // ── LMTV M1078 Zone 2: Cab ──
  'm1078-b-009': ['missing-bii'],                          // Seat Belts
  'm1078-b-010': ['body-damage'],                          // Driver's Seat
  'm1078-b-011': ['missing-bii'],                          // Fire Extinguisher
  'm1078-b-012': ['electrical', 'wont-start'],             // Lighted Indicator Display
  'm1078-b-013': ['electrical', 'glass-damage'],           // Windshield Wipers/Washer (check)
  // ── LMTV M1078 Zone 3: Instruments ──
  'm1078-b-014': ['engine-oil-pressure', 'electrical'],    // OIL PRESS Gage
  'm1078-b-015': ['electrical'],                           // Tachometer
  'm1078-b-016': ['engine-overheat', 'electrical'],        // WATER TEMP Gage
  'm1078-b-017': ['engine-smoke', 'electrical'],           // AIR FILTER RESTRICTION GAUGE
  'm1078-b-018': ['brake-issue', 'electrical'],            // FRONT/REAR BRAKE AIR Gages
  'm1078-b-019': ['electrical'],                           // VOLTS Gage
  'm1078-b-020': ['fuel-system', 'electrical'],            // FUEL Gage
  'm1078-b-021': ['brake-issue'],                          // SYSTEM PARK Control
  'm1078-b-022': ['transmission'],                         // WTEC II/III TPSS
  'm1078-b-023': ['electrical'],                           // Turn Signal Control
  'm1078-b-024': ['electrical'],                           // Hazard Lights Switch
};

export function getCategoriesForStep(stepId: string): FaultCategory[] {
  const categoryIds = STEP_CATEGORIES[stepId] || [];
  return FAULT_CATEGORIES.filter((c) => categoryIds.includes(c.id));
}

export function getCategoryById(id: string): FaultCategory | undefined {
  return FAULT_CATEGORIES.find((c) => c.id === id);
}
