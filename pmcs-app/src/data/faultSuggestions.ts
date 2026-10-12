// Fault suggestion chips keyed by step ID
// Each entry provides 3-5 common fault descriptions for quick entry.
//
// readiness: set ONLY when the chip text itself matches (NMC) or clearly falls outside (PMC)
// the TM "Not Fully Mission Capable If" criterion for that step. When omitted, the chip does not
// decide readiness — the step's NMC criterion / the operator does (the category is only a fallback).

import type { Readiness } from '../types/diagnosis';

export interface FaultSuggestion {
  text: string;
  categoryId: string;
  readiness?: Readiness;
}

export const FAULT_SUGGESTIONS: Record<string, FaultSuggestion[]> = {
  // ── M1151 / M1152 — replaces all existing m1151-b-* and m1152-b-* entries (texts are TM NMC criteria) ──
  'm1151-b-001': [
    { text: "Any brake fluid leaks; class III leak of oil, fuel, or coolant", categoryId: 'fluid-leak' },
    { text: "Any damage prevents operation", categoryId: 'body-damage' },
  ],
  'm1151-b-002': [
    { text: "Tire missing, deflated, or unserviceable", categoryId: 'tire-damage' },
  ],
  'm1151-b-003': [
    { text: "Any brake fluid leaks; class III leak of oil, fuel, or coolant", categoryId: 'fluid-leak' },
    { text: "Any damage prevents operation", categoryId: 'body-damage' },
    { text: "Any damage that would prevent operation", categoryId: 'body-damage' },
  ],
  'm1151-b-004': [
    { text: "Any brake fluid leaks; class III leak of oil, fuel, or coolant", categoryId: 'fluid-leak' },
    { text: "Any damage prevents operation", categoryId: 'body-damage' },
  ],
  'm1151-b-005': [
    { text: "Tire missing, deflated, or unserviceable", categoryId: 'tire-damage' },
  ],
  'm1151-b-006': [
    { text: "Any damage prevents operation", categoryId: 'body-damage' },
    { text: "Any brake fluid leaks; class III leak of oil, fuel, or coolant", categoryId: 'fluid-leak' },
  ],
  'm1151-b-007': [
    { text: "Power Steering Reservoir (P/N RCSK 18330) — defect found", categoryId: 'fluid-leak' },
  ],
  'm1151-b-008': [
    { text: "Power Steering Reservoir (P/N 94252A) — defect found", categoryId: 'fluid-leak' },
  ],
  'm1151-b-009': [
    { text: "Pulleys worn, broken, or misaligned", categoryId: 'electrical' },
    { text: "Serpentine drivebelt is missing or broken", categoryId: 'electrical' },
    { text: "Drivebelt fiber has more than one crack 1/8 in. (3.2 mm) in depth or 50%, or frays more than 2-in. (5.1-cm) long", categoryId: 'electrical' },
    { text: "Drivebelt is loose or misaligned (off one or more grooves on any pulley)", categoryId: 'electrical' },
  ],
  'm1151-b-010': [
    { text: "Cooling System — defect found", categoryId: 'fluid-leak' },
  ],
  'm1151-b-011': [
    { text: "Excessive force is required to operate", categoryId: 'body-damage' },
    { text: "Door does not latch", categoryId: 'body-damage' },
    { text: "Combat lock does not lock", categoryId: 'body-damage' },
  ],
  'm1151-b-012': [
    { text: "Seat adjustment lock broken or missing", categoryId: 'body-damage' },
  ],
  'm1151-b-013': [
    { text: "Fire extinguisher missing or damaged", categoryId: 'missing-bii' },
    { text: "Pressure gauge needle in recharge area", categoryId: 'missing-bii' },
    { text: "Seal broken or missing", categoryId: 'missing-bii' },
  ],
  'm1151-b-014': [
    { text: "Pressure gauge reads below pressure shown on label", categoryId: 'electrical' },
    { text: "Wiring harness or sensor box is disconnected, improperly installed, damaged or missing", categoryId: 'electrical' },
    { text: "Fire extinguisher, manual lever lock pin or tube assembly missing", categoryId: 'missing-bii' },
    { text: "Green LED indicator light is off, steady blink, slow blink, or double blink", categoryId: 'electrical' },
    { text: "LED light does not come on, is blinking, or covered with dust or any foreign object", categoryId: 'electrical' },
  ],
  'm1151-b-015': [
    { text: "Lever inoperable or binds between range detents", categoryId: 'transmission' },
    { text: "Lever inoperable or does not engage in all ranges with engine not running", categoryId: 'transmission' },
  ],
  'm1151-b-018': [
    { text: "Wait-to-start light does not come on when engine is cold, or wait light stays on continually", categoryId: 'wont-start' },
    { text: "Brake warning light does not come on", categoryId: 'brake-issue' },
    { text: "Engine will not start", categoryId: 'wont-start' },
    { text: "Oil pressure is less than 6 psi (41 kPa) at idle or 15 psi (103 kPa) under load", categoryId: 'engine-oil-pressure' },
    { text: "Voltmeter needle stays in yellow or red range", categoryId: 'electrical' },
    { text: "Air restriction indicator reaches red zone", categoryId: 'engine-smoke' },
  ],
  'm1151-b-022': [
    { text: "Steering wheel inoperable or binds", categoryId: 'steering' },
  ],
  'm1151-b-023': [
    { text: "Brakes will not stop the vehicle", categoryId: 'brake-issue' },
    { text: "Parking brake inoperable or unable to hold vehicle", categoryId: 'brake-issue' },
    { text: "Parking brake lever safety mechanism is not functioning properly", categoryId: 'brake-issue' },
  ],
  'm1151-b-021': [
    { text: "Weapon station binds", categoryId: 'weapon-station' },
    { text: "Armament weapons required for missions and mounting plate or bearing sleeve missing, or any damage that will prevent or impair mounting of armament weapons", categoryId: 'missing-bii' },
  ],
  'm1151-b-024': [
    { text: "Gear linkage assembly bent, broken, or missing linkage", categoryId: 'weapon-station' },
    { text: "Loose or missing mounting hardware", categoryId: 'weapon-station' },
    { text: "Handle missing or unserviceable, or quick release pin damaged or missing", categoryId: 'weapon-station' },
    { text: "Check disengage handle for proper operation", categoryId: 'weapon-station' },
    { text: "MTU is inoperable", categoryId: 'weapon-station' },
  ],
  'm1151-b-025': [
    { text: "Power cable broken, frayed, or damaged", categoryId: 'weapon-station' },
    { text: "Mounting hardware loose, damaged, or missing", categoryId: 'weapon-station' },
    { text: "Control box emergency stop switch inoperable", categoryId: 'weapon-station' },
    { text: "Drive assembly motor engagement control will not engage", categoryId: 'weapon-station' },
    { text: "Joystick inoperable or housing is not properly sealed", categoryId: 'electrical' },
  ],
  'm1151-b-026': [
    { text: "Engine oil pressure gauge reads less than approximately 30 psi (207 kPa) under normal driving conditions or less than 10 psi (69 kPa) at idle", categoryId: 'engine-oil-pressure' },
    { text: "Coolant temperature gauge reads greater than 250°F (120°C) and/or overheat lamp illuminates", categoryId: 'engine-overheat' },
    { text: "Air restriction gauge indicates restriction in the air cleaner", categoryId: 'engine-smoke' },
    { text: "Voltmeter indicates a loss of voltage", categoryId: 'electrical' },
    { text: "If light stays lit, brakes may not function properly", categoryId: 'brake-issue' },
    { text: "Speedometer needle does not move, jerks unevenly during sustained speeds, or appears stuck", categoryId: 'electrical' },
  ],
  'm1151-b-027': [
    { text: "Brakes pull or grab", categoryId: 'brake-issue' },
  ],
  'm1151-b-028': [
    { text: "Handling is unstable; turning is difficult or free play, binding, or shimmy detected", categoryId: 'steering' },
  ],
  'm1151-b-029': [
    { text: "Pedal sticking or binding", categoryId: 'controls' },
  ],
  'm1151-b-030': [
    { text: "Unusual noise or vibration detected", categoryId: 'unusual-noise' },
  ],
  'm1151-b-031': [
    { text: "Transmission slips or will not shift", categoryId: 'transmission' },
  ],
  'm1151-b-032': [
    { text: "Climatic conditions require air-conditioning and A/C is inoperable, or outlet duct air is not cooler than ambient temperature", categoryId: 'electrical' },
  ],
  'm1151-b-033': [
    { text: "Lever inoperable or binds between range detents", categoryId: 'transmission' },
    { text: "Lever inoperable or does not engage in all ranges with engine not running", categoryId: 'transmission' },
  ],
  'm1151-b-034': [
    { text: "Transmission Fluid — defect found", categoryId: 'transmission' },
  ],
  'm1151-b-035': [
    { text: "Fuel is not clear after draining 1 pt. (0.47 L)", categoryId: 'fuel-system' },
    { text: "Class III leakage evident", categoryId: 'fluid-leak' },
  ],
  'm1151-b-036': [
    { text: "Tire deflated or otherwise unserviceable", categoryId: 'tire-damage' },
  ],
  'm1151-b-037': [
    { text: "Mirror (Left Side) — defect found", categoryId: 'glass-damage' },
  ],
  'm1151-b-038': [
    { text: "Any brake fluid leaks; class III leak of oil, fuel, or coolant", categoryId: 'fluid-leak' },
    { text: "Crossmembers or underbody support are missing any hardware, are cracked, broken, or bent or rusted-through condition is present that would affect vehicle operation", categoryId: 'body-damage' },
    { text: "Any damage will prevent operation", categoryId: 'body-damage' },
  ],
  'm1151-b-039': [
    { text: "Any brake fluid leaks; class III leak of oil, fuel, or coolant", categoryId: 'fluid-leak' },
    { text: "Crossmembers or underbody support are missing any hardware, are cracked, broken, or bent or rusted-through condition is present that would affect vehicle operation", categoryId: 'body-damage' },
    { text: "Bumper, crossmember or an inner brace is cracked or broken", categoryId: 'body-damage' },
  ],
  'm1151-b-040': [
    { text: "Tire deflated or otherwise unserviceable", categoryId: 'tire-damage' },
  ],
  'm1151-b-041': [
    { text: "Mirror (Right Side) — defect found", categoryId: 'glass-damage' },
  ],
  'm1151-b-042': [
    { text: "Any brake fluid leaks; class III leak of oil, fuel, or coolant", categoryId: 'fluid-leak' },
    { text: "Crossmembers or underbody support are missing any hardware, are cracked, broken, or bent or rusted-through condition is present that would affect vehicle operation", categoryId: 'body-damage' },
    { text: "Any damage will prevent operation", categoryId: 'body-damage' },
  ],
  'm1151-b-043': [
    { text: "Oil appears milky", categoryId: 'engine-oil-pressure' },
  ],
  'm1151-b-044': [
    { text: "Class III leakage evident", categoryId: 'fluid-leak' },
  ],
  'm1151-b-045': [
    { text: "Class III leakage evident", categoryId: 'fluid-leak' },
  ],
  'm1151-b-046': [
    { text: "Any leak, or cover missing", categoryId: 'fluid-leak' },
  ],
  'm1151-b-016': [
    { text: "Lights — defect found", categoryId: 'electrical' },
  ],
  'm1151-b-047': [
    { text: "Horn — defect found", categoryId: 'electrical' },
  ],
  'm1151-b-017': [
    { text: "Windshield is cracked, broken, or discolored (cloudy) sufficiently to impair operator's vision", categoryId: 'glass-damage' },
    { text: "The bond between glass and frame is separated from glass or frame", categoryId: 'glass-damage' },
    { text: "Any complete break on inner surface of glass", categoryId: 'glass-damage' },
    { text: "Any digs, gouges, or scratches on inner surface of glass", categoryId: 'glass-damage' },
    { text: "Any complete break on the outer surface of windshield glass", categoryId: 'glass-damage' },
  ],
  'm1151-b-048': [
    { text: "Light Switches — defect found", categoryId: 'electrical' },
  ],
  'm1151-b-049': [
    { text: "Hand Throttle — defect found", categoryId: 'controls' },
  ],
  'm1151-b-050': [
    { text: "Any tread is worn even to height of tread wear indicator (1/16 in. (1.59 mm) or less)", categoryId: 'tire-damage' },
    { text: "Any cut, gouge, or crack that extends to the cord body or any bulges", categoryId: 'tire-damage' },
    { text: "Tires exhibit excessive inner and outer wear or balance", categoryId: 'tire-damage' },
    { text: "Any wheel stud nut or lug nut is broken or missing", categoryId: 'tire-damage' },
  ],
  'm1151-b-051': [
    { text: "Any mounts are broken, pipes are rusted through or broken, or any indication of an exhaust leak", categoryId: 'unusual-noise' },
  ],
  'm1151-b-052': [
    { text: "Class III leakage or damage is evident; mounting damaged or loose", categoryId: 'fluid-leak' },
  ],
  'm1151-b-054': [
    { text: "Doors and Windows — defect found", categoryId: 'body-damage' },
  ],
  'm1151-b-055': [
    { text: "Tailgate — defect found", categoryId: 'body-damage' },
  ],
  'm1151-b-056': [
    { text: "Lift cylinders or latches bent, warped, binding, or inoperative", categoryId: 'body-damage' },
    { text: "Retaining wire rope is damaged, missing, or not secured", categoryId: 'body-damage' },
    { text: "Armor components are cracked", categoryId: 'body-damage' },
    { text: "Vehicle missing a retainer plate or more than one screw", categoryId: 'body-damage' },
    { text: "Deformation is visually detected", categoryId: 'body-damage' },
    { text: "C-partition door will not close and lock in all three positions, or inoperative", categoryId: 'body-damage' },
  ],
  'm1151-b-057': [
    { text: "One or more grease fittings missing", categoryId: 'missing-bii' },
  ],
  'm1151-b-058': [
    { text: "Heater inoperable and mission requires heater", categoryId: 'electrical' },
    { text: "Class III fuel leakage is evident and mission requires heater", categoryId: 'fuel-system' },
    { text: "Wires frayed or broken", categoryId: 'electrical' },
    { text: "Heater exhaust damaged or components missing", categoryId: 'electrical' },
    { text: "Class III leak evident", categoryId: 'fluid-leak' },
  ],
  'm1151-b-059': [
    { text: "Damage to air cleaner weathercap, body, air intake hose, or mounting allows unfiltered air to enter the engine", categoryId: 'engine-smoke' },
  ],
  'm1151-b-060': [
    { text: "Bracket is cracked or bolts damaged or loose", categoryId: 'electrical' },
  ],
  'm1151-b-061': [
    { text: "Fan blade or pulley is bent, broken, cracked, or loose", categoryId: 'cooling-system' },
    { text: "Class III leakage evident", categoryId: 'fluid-leak' },
    { text: "Support mounts broken, damaged, or missing hardware", categoryId: 'cooling-system' },
    { text: "Side brackets damaged or two or more weldments broken, allowing movement of radiator", categoryId: 'cooling-system' },
    { text: "Fan shroud broken, cracked, or loose", categoryId: 'cooling-system' },
    { text: "Class III leak evident", categoryId: 'fluid-leak' },
  ],
  'm1151-b-062': [
    { text: "One or more batteries missing, unserviceable, or leaking; terminal or cables loose, corroded, or holddowns not secure", categoryId: 'electrical' },
  ],
  'm1151-b-063': [
    { text: "One or more batteries missing, unserviceable, or leaking; terminal or cables loose, corroded, or holddowns not secure", categoryId: 'weapon-station' },
  ],
  'm1151-b-064': [
    { text: "Hatch or hinges inoperable", categoryId: 'weapon-station' },
    { text: "Brake does not operate", categoryId: 'weapon-station' },
    { text: "Sling is torn, shows wear, or hook is damaged", categoryId: 'body-damage' },
  ],
  'm1151-b-065': [
    { text: "Tiedowns — defect found", categoryId: 'missing-bii' },
  ],
  'm1151-b-066': [
    { text: "Tow Pintle — defect found", categoryId: 'body-damage' },
  ],
  'm1151-b-067': [
    { text: "Actuating lever or spring is broken or missing", categoryId: 'brake-issue' },
  ],
  'm1151-b-068': [
    { text: "Any movement observed in steering gear mounting area", categoryId: 'steering' },
  ],
  'm1151-b-069': [
    { text: "Windshield Washer — defect found", categoryId: 'electrical' },
  ],
  'm1151-b-070': [
    { text: "Heater inoperable and mission requires heater", categoryId: 'electrical' },
    { text: "Class III fuel leakage is evident and mission requires heater", categoryId: 'fuel-system' },
    { text: "Frayed or broken wires", categoryId: 'electrical' },
    { text: "Heater exhaust damaged or components missing", categoryId: 'electrical' },
    { text: "Class III leak evident", categoryId: 'fluid-leak' },
  ],
  'm1151-b-071': [
    { text: "Vent lines cracked, plugged, or missing", categoryId: 'body-damage' },
  ],
  'm1151-b-072': [
    { text: "Any corroded-through condition, cracks or breaks that would affect vehicle operation", categoryId: 'body-damage' },
  ],
  'm1151-b-073': [
    { text: "Any corroded-through condition, or damage that would affect vehicle operation", categoryId: 'body-damage' },
  ],
  'm1151-b-074': [
    { text: "Winch — defect found", categoryId: 'body-damage' },
  ],
  'm1151-b-075': [
    { text: "Zippers — defect found", categoryId: 'body-damage' },
  ],
  'm1152-b-001': [
    { text: "Any brake fluid leaks; class III leak of oil, fuel, or coolant", categoryId: 'fluid-leak' },
    { text: "Any damage prevents operation", categoryId: 'body-damage' },
  ],
  'm1152-b-002': [
    { text: "Tire missing, deflated, or unserviceable", categoryId: 'tire-damage' },
  ],
  'm1152-b-003': [
    { text: "Any brake fluid leaks; class III leak of oil, fuel, or coolant", categoryId: 'fluid-leak' },
    { text: "Any damage prevents operation", categoryId: 'body-damage' },
    { text: "Any damage that would prevent operation", categoryId: 'body-damage' },
  ],
  'm1152-b-004': [
    { text: "Any brake fluid leaks; class III leak of oil, fuel, or coolant", categoryId: 'fluid-leak' },
    { text: "Any damage prevents operation", categoryId: 'body-damage' },
  ],
  'm1152-b-005': [
    { text: "Tire missing, deflated, or unserviceable", categoryId: 'tire-damage' },
  ],
  'm1152-b-006': [
    { text: "Any damage prevents operation", categoryId: 'body-damage' },
    { text: "Any brake fluid leaks; class III leak of oil, fuel, or coolant", categoryId: 'fluid-leak' },
  ],
  'm1152-b-007': [
    { text: "Power Steering Reservoir (P/N RCSK 18330) — defect found", categoryId: 'fluid-leak' },
  ],
  'm1152-b-008': [
    { text: "Power Steering Reservoir (P/N 94252A) — defect found", categoryId: 'fluid-leak' },
  ],
  'm1152-b-009': [
    { text: "Pulleys worn, broken, or misaligned", categoryId: 'electrical' },
    { text: "Serpentine drivebelt is missing or broken", categoryId: 'electrical' },
    { text: "Drivebelt fiber has more than one crack 1/8 in. (3.2 mm) in depth or 50%, or frays more than 2-in. (5.1-cm) long", categoryId: 'electrical' },
    { text: "Drivebelt is loose or misaligned (off one or more grooves on any pulley)", categoryId: 'electrical' },
  ],
  'm1152-b-010': [
    { text: "Cooling System — defect found", categoryId: 'fluid-leak' },
  ],
  'm1152-b-011': [
    { text: "Excessive force is required to operate", categoryId: 'body-damage' },
    { text: "Door does not latch", categoryId: 'body-damage' },
    { text: "Combat lock does not lock", categoryId: 'body-damage' },
  ],
  'm1152-b-012': [
    { text: "Seat adjustment lock broken or missing", categoryId: 'body-damage' },
  ],
  'm1152-b-013': [
    { text: "Fire extinguisher missing or damaged", categoryId: 'missing-bii' },
    { text: "Pressure gauge needle in recharge area", categoryId: 'missing-bii' },
    { text: "Seal broken or missing", categoryId: 'missing-bii' },
  ],
  'm1152-b-014': [
    { text: "Pressure gauge reads below pressure shown on label", categoryId: 'electrical' },
    { text: "Wiring harness or sensor box is disconnected, improperly installed, damaged or missing", categoryId: 'electrical' },
    { text: "Fire extinguisher, manual lever lock pin or tube assembly missing", categoryId: 'missing-bii' },
    { text: "Green LED indicator light is off, steady blink, slow blink, or double blink", categoryId: 'electrical' },
    { text: "LED light does not come on, is blinking, or covered with dust or any foreign object", categoryId: 'electrical' },
  ],
  'm1152-b-015': [
    { text: "Lever inoperable or binds between range detents", categoryId: 'transmission' },
    { text: "Lever inoperable or does not engage in all ranges with engine not running", categoryId: 'transmission' },
  ],
  'm1152-b-018': [
    { text: "Wait-to-start light does not come on when engine is cold, or wait light stays on continually", categoryId: 'wont-start' },
    { text: "Brake warning light does not come on", categoryId: 'brake-issue' },
    { text: "Engine will not start", categoryId: 'wont-start' },
    { text: "Oil pressure is less than 6 psi (41 kPa) at idle or 15 psi (103 kPa) under load", categoryId: 'engine-oil-pressure' },
    { text: "Voltmeter needle stays in yellow or red range", categoryId: 'electrical' },
    { text: "Air restriction indicator reaches red zone", categoryId: 'engine-smoke' },
  ],
  'm1152-b-022': [
    { text: "Steering wheel inoperable or binds", categoryId: 'steering' },
  ],
  'm1152-b-023': [
    { text: "Brakes will not stop the vehicle", categoryId: 'brake-issue' },
    { text: "Parking brake inoperable or unable to hold vehicle", categoryId: 'brake-issue' },
    { text: "Parking brake lever safety mechanism is not functioning properly", categoryId: 'brake-issue' },
  ],
  'm1152-b-026': [
    { text: "Engine oil pressure gauge reads less than approximately 30 psi (207 kPa) under normal driving conditions or less than 10 psi (69 kPa) at idle", categoryId: 'engine-oil-pressure' },
    { text: "Coolant temperature gauge reads greater than 250°F (120°C) and/or overheat lamp illuminates", categoryId: 'engine-overheat' },
    { text: "Air restriction gauge indicates restriction in the air cleaner", categoryId: 'engine-smoke' },
    { text: "Voltmeter indicates a loss of voltage", categoryId: 'electrical' },
    { text: "If light stays lit, brakes may not function properly", categoryId: 'brake-issue' },
    { text: "Speedometer needle does not move, jerks unevenly during sustained speeds, or appears stuck", categoryId: 'electrical' },
  ],
  'm1152-b-027': [
    { text: "Brakes pull or grab", categoryId: 'brake-issue' },
  ],
  'm1152-b-028': [
    { text: "Handling is unstable; turning is difficult or free play, binding, or shimmy detected", categoryId: 'steering' },
  ],
  'm1152-b-029': [
    { text: "Pedal sticking or binding", categoryId: 'controls' },
  ],
  'm1152-b-030': [
    { text: "Unusual noise or vibration detected", categoryId: 'unusual-noise' },
  ],
  'm1152-b-031': [
    { text: "Transmission slips or will not shift", categoryId: 'transmission' },
  ],
  'm1152-b-032': [
    { text: "Climatic conditions require air-conditioning and A/C is inoperable, or outlet duct air is not cooler than ambient temperature", categoryId: 'electrical' },
  ],
  'm1152-b-033': [
    { text: "Lever inoperable or binds between range detents", categoryId: 'transmission' },
    { text: "Lever inoperable or does not engage in all ranges with engine not running", categoryId: 'transmission' },
  ],
  'm1152-b-034': [
    { text: "Transmission Fluid — defect found", categoryId: 'transmission' },
  ],
  'm1152-b-035': [
    { text: "Fuel is not clear after draining 1 pt. (0.47 L)", categoryId: 'fuel-system' },
    { text: "Class III leakage evident", categoryId: 'fluid-leak' },
  ],
  'm1152-b-036': [
    { text: "Tire deflated or otherwise unserviceable", categoryId: 'tire-damage' },
  ],
  'm1152-b-037': [
    { text: "Mirror (Left Side) — defect found", categoryId: 'glass-damage' },
  ],
  'm1152-b-038': [
    { text: "Any brake fluid leaks; class III leak of oil, fuel, or coolant", categoryId: 'fluid-leak' },
    { text: "Crossmembers or underbody support are missing any hardware, are cracked, broken, or bent or rusted-through condition is present that would affect vehicle operation", categoryId: 'body-damage' },
    { text: "Any damage will prevent operation", categoryId: 'body-damage' },
  ],
  'm1152-b-039': [
    { text: "Any brake fluid leaks; class III leak of oil, fuel, or coolant", categoryId: 'fluid-leak' },
    { text: "Crossmembers or underbody support are missing any hardware, are cracked, broken, or bent or rusted-through condition is present that would affect vehicle operation", categoryId: 'body-damage' },
    { text: "Bumper, crossmember or an inner brace is cracked or broken", categoryId: 'body-damage' },
  ],
  'm1152-b-040': [
    { text: "Tire deflated or otherwise unserviceable", categoryId: 'tire-damage' },
  ],
  'm1152-b-041': [
    { text: "Mirror (Right Side) — defect found", categoryId: 'glass-damage' },
  ],
  'm1152-b-042': [
    { text: "Any brake fluid leaks; class III leak of oil, fuel, or coolant", categoryId: 'fluid-leak' },
    { text: "Crossmembers or underbody support are missing any hardware, are cracked, broken, or bent or rusted-through condition is present that would affect vehicle operation", categoryId: 'body-damage' },
    { text: "Any damage will prevent operation", categoryId: 'body-damage' },
  ],
  'm1152-b-043': [
    { text: "Oil appears milky", categoryId: 'engine-oil-pressure' },
  ],
  'm1152-b-044': [
    { text: "Class III leakage evident", categoryId: 'fluid-leak' },
  ],
  'm1152-b-045': [
    { text: "Class III leakage evident", categoryId: 'fluid-leak' },
  ],
  'm1152-b-046': [
    { text: "Any leak, or cover missing", categoryId: 'fluid-leak' },
  ],
  'm1152-b-016': [
    { text: "Lights — defect found", categoryId: 'electrical' },
  ],
  'm1152-b-047': [
    { text: "Horn — defect found", categoryId: 'electrical' },
  ],
  'm1152-b-017': [
    { text: "Windshield is cracked, broken, or discolored (cloudy) sufficiently to impair operator's vision", categoryId: 'glass-damage' },
    { text: "The bond between glass and frame is separated from glass or frame", categoryId: 'glass-damage' },
    { text: "Any complete break on inner surface of glass", categoryId: 'glass-damage' },
    { text: "Any digs, gouges, or scratches on inner surface of glass", categoryId: 'glass-damage' },
    { text: "Any complete break on the outer surface of windshield glass", categoryId: 'glass-damage' },
  ],
  'm1152-b-048': [
    { text: "Light Switches — defect found", categoryId: 'electrical' },
  ],
  'm1152-b-049': [
    { text: "Hand Throttle — defect found", categoryId: 'controls' },
  ],
  'm1152-b-050': [
    { text: "Any tread is worn even to height of tread wear indicator (1/16 in. (1.59 mm) or less)", categoryId: 'tire-damage' },
    { text: "Any cut, gouge, or crack that extends to the cord body or any bulges", categoryId: 'tire-damage' },
    { text: "Tires exhibit excessive inner and outer wear or balance", categoryId: 'tire-damage' },
    { text: "Any wheel stud nut or lug nut is broken or missing", categoryId: 'tire-damage' },
  ],
  'm1152-b-051': [
    { text: "Any mounts are broken, pipes are rusted through or broken, or any indication of an exhaust leak", categoryId: 'unusual-noise' },
  ],
  'm1152-b-052': [
    { text: "Class III leakage or damage is evident; mounting damaged or loose", categoryId: 'fluid-leak' },
  ],
  'm1152-b-053': [
    { text: "Visible cracks or door does not secure properly", categoryId: 'body-damage' },
    { text: "Loose, missing, or unserviceable parts", categoryId: 'body-damage' },
  ],
  'm1152-b-054': [
    { text: "Doors and Windows (M1152A1 ONLY) — defect found", categoryId: 'body-damage' },
  ],
  'm1152-b-055': [
    { text: "Tailgate — defect found", categoryId: 'body-damage' },
  ],
  'm1152-b-057': [
    { text: "One or more grease fittings missing", categoryId: 'missing-bii' },
  ],
  'm1152-b-058': [
    { text: "Heater inoperable and mission requires heater", categoryId: 'electrical' },
    { text: "Class III fuel leakage is evident and mission requires heater", categoryId: 'fuel-system' },
    { text: "Wires frayed or broken", categoryId: 'electrical' },
    { text: "Heater exhaust damaged or components missing", categoryId: 'electrical' },
    { text: "Class III leak evident", categoryId: 'fluid-leak' },
  ],
  'm1152-b-059': [
    { text: "Damage to air cleaner weathercap, body, air intake hose, or mounting allows unfiltered air to enter the engine", categoryId: 'engine-smoke' },
  ],
  'm1152-b-060': [
    { text: "Bracket is cracked or bolts damaged or loose", categoryId: 'electrical' },
  ],
  'm1152-b-061': [
    { text: "Fan blade or pulley is bent, broken, cracked, or loose", categoryId: 'cooling-system' },
    { text: "Class III leakage evident", categoryId: 'fluid-leak' },
    { text: "Support mounts broken, damaged, or missing hardware", categoryId: 'cooling-system' },
    { text: "Side brackets damaged or two or more weldments broken, allowing movement of radiator", categoryId: 'cooling-system' },
    { text: "Fan shroud broken, cracked, or loose", categoryId: 'cooling-system' },
    { text: "Class III leak evident", categoryId: 'fluid-leak' },
  ],
  'm1152-b-062': [
    { text: "One or more batteries missing, unserviceable, or leaking; terminal or cables loose, corroded, or holddowns not secure", categoryId: 'electrical' },
  ],
  'm1152-b-065': [
    { text: "Tiedowns — defect found", categoryId: 'missing-bii' },
  ],
  'm1152-b-066': [
    { text: "Tow Pintle — defect found", categoryId: 'body-damage' },
  ],
  'm1152-b-067': [
    { text: "Actuating lever or spring is broken or missing", categoryId: 'brake-issue' },
  ],
  'm1152-b-068': [
    { text: "Any movement observed in steering gear mounting area", categoryId: 'steering' },
  ],
  'm1152-b-069': [
    { text: "Windshield Washer — defect found", categoryId: 'electrical' },
  ],
  'm1152-b-070': [
    { text: "Heater inoperable and mission requires heater", categoryId: 'electrical' },
    { text: "Class III fuel leakage is evident and mission requires heater", categoryId: 'fuel-system' },
    { text: "Frayed or broken wires", categoryId: 'electrical' },
    { text: "Heater exhaust damaged or components missing", categoryId: 'electrical' },
    { text: "Class III leak evident", categoryId: 'fluid-leak' },
  ],
  'm1152-b-071': [
    { text: "Vent lines cracked, plugged, or missing", categoryId: 'body-damage' },
  ],
  'm1152-b-072': [
    { text: "Any corroded-through condition, cracks or breaks that would affect vehicle operation", categoryId: 'body-damage' },
  ],
  'm1152-b-073': [
    { text: "Any corroded-through condition, or damage that would affect vehicle operation", categoryId: 'body-damage' },
  ],
  'm1152-b-074': [
    { text: "Winch — defect found", categoryId: 'body-damage' },
  ],
  'm1152-b-075': [
    { text: "Zippers — defect found", categoryId: 'body-damage' },
  ],

  // ── LMTV M1078 (TM 9-2320-365-10) — readiness per Table 2-1 "Not Fully Mission Capable If" ──
  'm1078-b-001': [
    { text: 'Windshield cracked — impairs vision', categoryId: 'glass-damage', readiness: 'NMC' },
    { text: 'Windshield cracked — does not impair vision', categoryId: 'glass-damage', readiness: 'PMC' },
    { text: 'Wiper blade missing or unserviceable', categoryId: 'electrical', readiness: 'PMC' },
    { text: 'Washer reservoir low', categoryId: 'electrical', readiness: 'PMC' },
  ],
  'm1078-b-003': [
    { text: 'Class III leak evident', categoryId: 'fluid-leak', readiness: 'NMC' },
    { text: 'Fuel leak under vehicle', categoryId: 'fluid-leak' },
    { text: 'Oil leak under vehicle', categoryId: 'fluid-leak' },
    { text: 'Coolant leak under vehicle', categoryId: 'fluid-leak' },
  ],
  'm1078-b-004': [
    { text: 'Coolant level below lower sightglass', categoryId: 'cooling-system', readiness: 'NMC' },
    { text: 'Engine oil present in coolant', categoryId: 'cooling-system', readiness: 'NMC' },
    { text: 'Coolant leak at hose/fitting', categoryId: 'fluid-leak' },
    { text: 'Overflow tank cracked', categoryId: 'cooling-system' },
  ],
  'm1078-b-005': [
    { text: 'No fuel in tank', categoryId: 'fuel-system' },
    { text: 'Fuel cap missing/damaged', categoryId: 'fuel-system', readiness: 'PMC' },
    { text: 'Fuel strainer missing/damaged', categoryId: 'fuel-system', readiness: 'PMC' },
  ],
  'm1078-b-006': [
    { text: 'Spare tire strap loose', categoryId: 'body-damage', readiness: 'PMC' },
    { text: 'Spare tire strap torn/frayed', categoryId: 'body-damage', readiness: 'PMC' },
    { text: 'SPARE TIRE knob not in RAISE position', categoryId: 'body-damage', readiness: 'PMC' },
    { text: 'CAB knob (Air Springs) not pushed in', categoryId: 'body-damage', readiness: 'PMC' },
  ],
  'm1078-b-007': [
    { text: 'Cab will not securely latch', categoryId: 'body-damage', readiness: 'NMC' },
    { text: 'Latch indicator button not in latched position', categoryId: 'body-damage' },
  ],
  'm1078-b-008': [
    { text: 'Air/hydraulic power unit oil low', categoryId: 'fluid-leak', readiness: 'PMC' },
    { text: 'Oil level below ADD on dipstick', categoryId: 'fluid-leak', readiness: 'PMC' },
  ],
  'm1078-b-009': [
    { text: 'Driver seat belt and at least one other unserviceable', categoryId: 'missing-bii', readiness: 'NMC' },
    { text: 'Driver seat belt does not latch', categoryId: 'missing-bii' },
    { text: 'Seat belt frayed/cut', categoryId: 'missing-bii' },
    { text: 'Seat belt does not retract', categoryId: 'missing-bii' },
  ],
  'm1078-b-010': [
    { text: 'Seat adjustment broken', categoryId: 'body-damage', readiness: 'NMC' },
    { text: 'Seat adjustment missing', categoryId: 'missing-bii', readiness: 'NMC' },
    { text: 'Seat does not move forward/backward', categoryId: 'body-damage', readiness: 'NMC' },
  ],
  'm1078-b-011': [
    { text: 'Fire extinguisher missing', categoryId: 'missing-bii', readiness: 'NMC' },
    { text: 'Fire extinguisher damaged', categoryId: 'missing-bii', readiness: 'NMC' },
    { text: 'Pressure gage in discharge band', categoryId: 'missing-bii', readiness: 'NMC' },
    { text: 'Seal is missing', categoryId: 'missing-bii', readiness: 'NMC' },
  ],
  'm1078-b-012': [
    { text: 'STOP indicator not illuminated', categoryId: 'electrical', readiness: 'NMC' },
    { text: 'PARK BRAKE indicator not illuminated', categoryId: 'electrical', readiness: 'NMC' },
    { text: 'EMERGENCY BRAKE indicator not illuminated', categoryId: 'electrical', readiness: 'NMC' },
    { text: 'BRAKE AIR indicator not illuminated (pressure under 65 psi)', categoryId: 'electrical', readiness: 'NMC' },
    { text: 'ENGINE OIL PRESSURE indicator not illuminated', categoryId: 'electrical', readiness: 'NMC' },
  ],
  'm1078-b-014': [
    { text: 'Oil pressure in red zone — indicator on', categoryId: 'engine-oil-pressure', readiness: 'NMC' },
    { text: 'Oil pressure below 15 psi', categoryId: 'engine-oil-pressure', readiness: 'NMC' },
    { text: 'Oil pressure indicator did not illuminate at start', categoryId: 'engine-oil-pressure', readiness: 'NMC' },
    { text: 'Oil pressure indicator stays on after start', categoryId: 'engine-oil-pressure', readiness: 'NMC' },
  ],
  'm1078-b-015': [
    { text: 'Tachometer reads outside 750-850 rpm at idle', categoryId: 'electrical', readiness: 'PMC' },
    { text: 'Tachometer inoperative', categoryId: 'electrical', readiness: 'PMC' },
  ],
  'm1078-b-016': [
    { text: 'Water temp in red zone — high temp indicator on', categoryId: 'engine-overheat', readiness: 'NMC' },
    { text: 'Engine fan running continuously', categoryId: 'engine-overheat' },
  ],
  'm1078-b-017': [
    { text: 'Air filter gauge still in red after reset and service', categoryId: 'engine-smoke', readiness: 'NMC' },
    { text: 'Air filter restriction gauge in red (>25 in.)', categoryId: 'engine-smoke' },
  ],
  'm1078-b-018': [
    { text: 'Front brake air below 65 psi', categoryId: 'brake-issue', readiness: 'NMC' },
    { text: 'Rear brake air below 65 psi', categoryId: 'brake-issue', readiness: 'NMC' },
    { text: 'Brake air indicator illuminated', categoryId: 'brake-issue', readiness: 'NMC' },
    { text: 'Audible alarm sounding', categoryId: 'brake-issue', readiness: 'NMC' },
  ],
  'm1078-b-019': [
    { text: 'Volts gage above 30 volts', categoryId: 'electrical', readiness: 'NMC' },
    { text: 'Volts gage below 26 volts', categoryId: 'electrical', readiness: 'NMC' },
  ],
  'm1078-b-020': [
    { text: 'Fuel gage inoperative', categoryId: 'electrical', readiness: 'PMC' },
    { text: 'Fuel gage reading does not match tank level', categoryId: 'electrical', readiness: 'PMC' },
  ],
  'm1078-b-021': [
    { text: 'Vehicle moves with SYSTEM PARK on', categoryId: 'brake-issue', readiness: 'NMC' },
    { text: 'SYSTEM PARK control does not pull out', categoryId: 'brake-issue' },
    { text: 'SYSTEM PARK control does not push in', categoryId: 'brake-issue' },
  ],
  'm1078-b-022': [
    { text: 'Gear range does not operate', categoryId: 'transmission', readiness: 'NMC' },
    { text: 'Service message cannot be reset', categoryId: 'transmission', readiness: 'NMC' },
    { text: 'Transmission shifts erratically', categoryId: 'transmission' },
  ],
  'm1078-b-023': [
    { text: 'Turn signal inoperative — left', categoryId: 'electrical' },
    { text: 'Turn signal inoperative — right', categoryId: 'electrical' },
    { text: 'Turn signal indicator not working', categoryId: 'electrical', readiness: 'PMC' },
  ],
  'm1078-b-024': [
    { text: 'Hazard lights switch inoperative', categoryId: 'electrical', readiness: 'PMC' },
    { text: 'Hazard lights do not flash', categoryId: 'electrical', readiness: 'PMC' },
  ],
  'm1078-b-026': [
    { text: 'Warning light/buzzer — operator cannot correct', categoryId: 'electrical', readiness: 'NMC' },
    { text: 'Gage reading outside normal limits', categoryId: 'electrical' },
  ],
  'm1078-b-027': [
    { text: 'Excessive exhaust smoke', categoryId: 'engine-smoke', readiness: 'NMC' },
    { text: 'Unusual engine noise', categoryId: 'unusual-noise', readiness: 'NMC' },
    { text: 'Engine runs rough or misfires', categoryId: 'unusual-noise', readiness: 'NMC' },
  ],
  'm1078-b-028': [
    { text: 'CTIS does not inflate/deflate', categoryId: 'tire-damage' },
    { text: 'CTIS ECU fault lights flashing', categoryId: 'tire-damage' },
  ],
  'm1078-b-030': [
    { text: 'Steering binds', categoryId: 'steering', readiness: 'NMC' },
    { text: 'Steering unresponsive', categoryId: 'steering', readiness: 'NMC' },
    { text: 'Unusual steering noise', categoryId: 'steering', readiness: 'PMC' },
  ],
  'm1078-b-031': [
    { text: 'Service brakes do not stop vehicle', categoryId: 'brake-issue', readiness: 'NMC' },
    { text: 'Vehicle pulls to one side when braking', categoryId: 'brake-issue', readiness: 'NMC' },
    { text: 'Brakes chatter/grind/squeal', categoryId: 'brake-issue', readiness: 'PMC' },
  ],
  'm1078-b-033': [
    { text: 'Hydraulic manifold Class III leak', categoryId: 'fluid-leak', readiness: 'NMC' },
  ],
  'm1078-b-034': [
    { text: 'Cab hydraulic cylinder Class III leak', categoryId: 'fluid-leak', readiness: 'NMC' },
    { text: 'Cab will not raise or lower', categoryId: 'body-damage', readiness: 'NMC' },
    { text: 'Cab tilt linkage damaged or missing hardware', categoryId: 'body-damage', readiness: 'NMC' },
  ],
  'm1078-b-035': [
    { text: 'Cab latch Class III leak and cab will not latch', categoryId: 'fluid-leak', readiness: 'NMC' },
    { text: 'Cab latch hose seeping (Class I/II)', categoryId: 'fluid-leak', readiness: 'PMC' },
  ],
  'm1078-b-036': [
    { text: 'Fuel/water separator Class III leak', categoryId: 'fuel-system', readiness: 'NMC' },
    { text: 'Water in fuel/water separator bowl', categoryId: 'fuel-system', readiness: 'PMC' },
  ],
  'm1078-b-038': [
    { text: 'Engine oil over FULL line', categoryId: 'engine-oil-pressure', readiness: 'NMC' },
    { text: 'Engine oil milky or discolored', categoryId: 'engine-oil-pressure', readiness: 'NMC' },
    { text: 'Engine oil low — added', categoryId: 'engine-oil-pressure', readiness: 'PMC' },
  ],
  'm1078-b-039': [
    { text: 'Transmission oil over HOT FULL', categoryId: 'transmission', readiness: 'NMC' },
    { text: 'Transmission oil milky or discolored', categoryId: 'transmission', readiness: 'NMC' },
    { text: 'Transmission oil low — added', categoryId: 'transmission', readiness: 'PMC' },
  ],
  'm1078-b-041': [
    { text: 'Air leak heard at air tanks', categoryId: 'brake-issue', readiness: 'NMC' },
  ],
  'm1078-b-042': [
    { text: 'Tire deflated or missing', categoryId: 'tire-damage', readiness: 'NMC' },
    { text: 'Tire worn to wear bar', categoryId: 'tire-damage', readiness: 'NMC' },
    { text: 'Tire cut/gouge/bulge', categoryId: 'tire-damage' },
  ],
  'm1078-b-044': [
    { text: 'Headlight inoperative', categoryId: 'electrical', readiness: 'NMC' },
    { text: 'Stoplight or taillight inoperative', categoryId: 'electrical', readiness: 'NMC' },
    { text: 'Turn signal inoperative', categoryId: 'electrical', readiness: 'NMC' },
    { text: 'Marker or blackout light inoperative', categoryId: 'electrical', readiness: 'PMC' },
  ],
  'm1078-b-051': [
    { text: 'Tread worn to wear bar (1/8 in. or less)', categoryId: 'tire-damage', readiness: 'NMC' },
    { text: 'Cut/gouge/crack to cord body or bulge', categoryId: 'tire-damage', readiness: 'NMC' },
    { text: 'Wheel cracked, broken, or bent', categoryId: 'tire-damage', readiness: 'NMC' },
    { text: 'Two or more lug nuts/studs missing or loose', categoryId: 'tire-damage', readiness: 'NMC' },
    { text: 'Tire pressure off ±3 psi for CTIS mode', categoryId: 'tire-damage', readiness: 'PMC' },
  ],
  'm1078-b-053': [
    { text: 'Battery missing, unserviceable, or leaking', categoryId: 'electrical', readiness: 'NMC' },
    { text: 'Battery cable clamp loose', categoryId: 'electrical', readiness: 'NMC' },
    { text: 'Battery fluid low', categoryId: 'electrical', readiness: 'PMC' },
  ],
  'm1078-b-055': [
    { text: 'Frame rail/crossmember broken or loose', categoryId: 'body-damage', readiness: 'NMC' },
    { text: 'Air hose or fitting leaking', categoryId: 'brake-issue', readiness: 'NMC' },
    { text: 'Shock absorber leak greater than Class I', categoryId: 'body-damage', readiness: 'NMC' },
    { text: 'Loose drive shaft hardware', categoryId: 'unusual-noise', readiness: 'NMC' },
  ],
  'm1078-b-065': [
    { text: 'Drive belt cracked beyond limits', categoryId: 'engine-overheat', readiness: 'NMC' },
    { text: 'Drive belt frayed more than 2 in.', categoryId: 'engine-overheat', readiness: 'NMC' },
    { text: 'Drive belt excessive play', categoryId: 'engine-overheat', readiness: 'NMC' },
  ],
  'm1078-b-067': [
    { text: 'Radiator hose Class III leak', categoryId: 'cooling-system', readiness: 'NMC' },
    { text: 'Radiator Class III leak', categoryId: 'cooling-system', readiness: 'NMC' },
    { text: 'Radiator fins damaged', categoryId: 'cooling-system' },
  ],
  'm1078-b-069': [
    { text: 'Power steering reservoir Class III leak', categoryId: 'steering', readiness: 'NMC' },
    { text: 'Power steering oil over full mark', categoryId: 'steering', readiness: 'PMC' },
    { text: 'Power steering oil low — added', categoryId: 'steering', readiness: 'PMC' },
  ],
  'm1078-b-070': [
    { text: 'Charge air clamp missing or will not tighten', categoryId: 'engine-smoke', readiness: 'NMC' },
    { text: 'Intake air hose damaged', categoryId: 'engine-smoke', readiness: 'NMC' },
  ],
  'm1078-b-073': [
    { text: 'Spare tire worn to wear bar / cut / bulge', categoryId: 'tire-damage', readiness: 'NMC' },
    { text: 'Spare tire retainer will not lock up', categoryId: 'body-damage', readiness: 'NMC' },
    { text: 'Spare tire pressure low — inflated to 60 psi', categoryId: 'tire-damage', readiness: 'PMC' },
  ],
  'm1078-b-002': [
    { text: 'Shackle pin loose — front', categoryId: 'body-damage' },
    { text: 'Shackle pin loose — rear', categoryId: 'body-damage' },
    { text: 'Shackle pin missing', categoryId: 'missing-bii' },
  ],
  'm1078-b-013': [
    { text: 'Windshield washer switch inoperative', categoryId: 'electrical', readiness: 'PMC' },
    { text: 'Windshield wiper switch inoperative', categoryId: 'electrical', readiness: 'PMC' },
  ],
  'm1078-b-046': [
    { text: 'Front gladhand air leak', categoryId: 'brake-issue', readiness: 'NMC' },
    { text: 'Front gladhand obstructed', categoryId: 'brake-issue', readiness: 'NMC' },
    { text: 'Coupler seal faulty', categoryId: 'brake-issue', readiness: 'NMC' },
  ],

  // ── M1101/M1102 trailer (TM 9-2330-392-14&P Table 2-1) ──
  'm1101-b-002': [
    { text: 'Breakaway cable or lever missing/damaged', categoryId: 'trailer-brakes', readiness: 'NMC' },
    { text: 'Actuator mounting nuts/bolts missing', categoryId: 'trailer-brakes', readiness: 'NMC' },
    { text: 'Breakaway lever not in down position', categoryId: 'trailer-brakes' },
  ],
  'm1101-b-004': [
    { text: 'Left handbrake fails to engage or release', categoryId: 'trailer-brakes', readiness: 'NMC' },
    { text: 'Left handbrake lever damaged', categoryId: 'trailer-brakes', readiness: 'NMC' },
    { text: 'Left handbrake needs adjustment', categoryId: 'trailer-brakes' },
  ],
  'm1101-b-005': [
    { text: 'Left tire flat/deflated', categoryId: 'tire-damage', readiness: 'NMC' },
    { text: 'Left tire cut, gouge, crack, or bulge', categoryId: 'tire-damage', readiness: 'NMC' },
    { text: 'Left tire underinflated — inflated to 17 psi', categoryId: 'tire-damage', readiness: 'PMC' },
  ],
  'm1101-b-006': [
    { text: 'Right tire flat/deflated', categoryId: 'tire-damage', readiness: 'NMC' },
    { text: 'Right tire cut, gouge, crack, or bulge', categoryId: 'tire-damage', readiness: 'NMC' },
    { text: 'Right tire underinflated — inflated to 17 psi', categoryId: 'tire-damage', readiness: 'PMC' },
  ],
  'm1101-b-007': [
    { text: 'Right handbrake fails to engage or release', categoryId: 'trailer-brakes', readiness: 'NMC' },
    { text: 'Right handbrake lever damaged', categoryId: 'trailer-brakes', readiness: 'NMC' },
    { text: 'Right handbrake needs adjustment', categoryId: 'trailer-brakes' },
  ],
  'm1101-b-008': [
    { text: 'Trailer lights do not operate', categoryId: 'trailer-electrical', readiness: 'NMC' },
    { text: 'Intervehicular cable connector corroded', categoryId: 'trailer-electrical' },
  ],
  'm1101-b-010': [
    { text: 'Shock absorber leaking', categoryId: 'trailer-suspension', readiness: 'NMC' },
    { text: 'Shock absorber mounting nut missing', categoryId: 'trailer-suspension', readiness: 'NMC' },
  ],
  'm1101-b-011': [
    { text: 'Safety chain damaged', categoryId: 'trailer-hitch', readiness: 'NMC' },
    { text: 'Safety chain missing', categoryId: 'trailer-hitch', readiness: 'NMC' },
  ],
  'm1101-b-013': [
    { text: 'Brake line/hose leaking', categoryId: 'trailer-brakes', readiness: 'NMC' },
    { text: 'Brake line clamp missing', categoryId: 'trailer-brakes' },
  ],
  'm1101-b-019': [
    { text: 'Master cylinder leaking', categoryId: 'trailer-brakes', readiness: 'NMC' },
    { text: 'Master cylinder cap damaged/missing — replaced', categoryId: 'trailer-brakes', readiness: 'PMC' },
    { text: 'Brake fluid low — added', categoryId: 'trailer-brakes', readiness: 'PMC' },
  ],
};
