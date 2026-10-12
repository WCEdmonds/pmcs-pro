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
  // ── M1097 (TM 9-2320-280-10 Table 2-2) ──
  'm1097-b-001': [
    { text: "Any brake fluid leak; class III leak of oil, fuel, or coolant.", categoryId: 'fluid-leak', readiness: 'NMC' },
    { text: "Any damage that will prevent operation.", categoryId: 'body-damage', readiness: 'NMC' },
  ],
  'm1097-b-002': [
    { text: "Tire missing, deflated, or unserviceable.", categoryId: 'tire-damage', readiness: 'NMC' },
  ],
  'm1097-b-003': [
    { text: "Any brake fluid leak; class III leak of oil, fuel, or coolant.", categoryId: 'fluid-leak', readiness: 'NMC' },
    { text: "Any damage that would prevent operation.", categoryId: 'body-damage', readiness: 'NMC' },
  ],
  'm1097-b-004': [
    { text: "Any brake fluid leak; class III leak of oil, fuel, or coolant.", categoryId: 'fluid-leak', readiness: 'NMC' },
    { text: "Any damage that would prevent operation.", categoryId: 'body-damage', readiness: 'NMC' },
  ],
  'm1097-b-005': [
    { text: "Tire missing, deflated, or unserviceable.", categoryId: 'tire-damage', readiness: 'NMC' },
  ],
  'm1097-b-006': [
    { text: "Any damage that will prevent operation.", categoryId: 'body-damage', readiness: 'NMC' },
    { text: "Any brake fluid leak; class III leak of oil, fuel, or coolant.", categoryId: 'fluid-leak', readiness: 'NMC' },
  ],
  'm1097-b-009': [
    { text: "Seat adjustment lock broken or missing.", categoryId: 'body-damage', readiness: 'NMC' },
  ],
  'm1097-b-010': [
    { text: "Fire extinguisher missing or damaged.", categoryId: 'missing-bii', readiness: 'NMC' },
    { text: "Pressure gauge needle in recharge area.", categoryId: 'missing-bii', readiness: 'NMC' },
    { text: "Seal broken or missing.", categoryId: 'missing-bii', readiness: 'NMC' },
  ],
  'm1097-b-011': [
    { text: "Wait-to-start light does not come on when engine is cold or wait light stays on continually. Brake warning light does not come on.", categoryId: 'wont-start', readiness: 'NMC' },
    { text: "Engine will not start.", categoryId: 'wont-start', readiness: 'NMC' },
    { text: "Oil pressure is less than 6 psi (103 kPa) at idle.", categoryId: 'engine-oil-pressure', readiness: 'NMC' },
    { text: "Voltmeter needle stays in yellow or red range.", categoryId: 'electrical', readiness: 'NMC' },
    { text: "Air restriction indicator reaches red zone.", categoryId: 'engine-smoke', readiness: 'NMC' },
    { text: "Brake warning light stays on after hand brake is released or comes on while driving.", categoryId: 'brake-issue', readiness: 'NMC' },
    { text: "Coolant temperature gauge inoperative or reads greater than 230°F (110°C).", categoryId: 'engine-overheat', readiness: 'NMC' },
  ],
  'm1097-b-012': [
    { text: "Brakes will not stop the vehicle.", categoryId: 'brake-issue', readiness: 'NMC' },
    { text: "Parking brake inoperable or unable to hold vehicle.", categoryId: 'brake-issue', readiness: 'NMC' },
    { text: "Parking brake lever safety mechanism (if equipped) is not functioning properly.", categoryId: 'brake-issue', readiness: 'NMC' },
  ],
  'm1097-b-013': [
    { text: "Engine oil pressure gauge reads less than approximately 40 psi (276 kPa) under normal driving conditions or less than 6 psi (41 kPa) at idle. Coolant temperature gauge reads greater than 230°F (110°C). Air restriction gauge indicates restriction in the air cleaner. Voltmeter indicates a loss of voltage.", categoryId: 'engine-oil-pressure', readiness: 'NMC' },
  ],
  'm1097-b-014': [
    { text: "Brakes pull or grab.", categoryId: 'brake-issue', readiness: 'NMC' },
  ],
  'm1097-b-015': [
    { text: "Handling is unstable turning is difficult or free play, binding, or shimming detected.", categoryId: 'steering', readiness: 'NMC' },
  ],
  'm1097-b-016': [
    { text: "Pedal sticking or binding.", categoryId: 'controls', readiness: 'NMC' },
  ],
  'm1097-b-017': [
    { text: "Unusual noise or vibration detected.", categoryId: 'unusual-noise', readiness: 'NMC' },
  ],
  'm1097-b-018': [
    { text: "Transmission slips or will not shift.", categoryId: 'transmission', readiness: 'NMC' },
  ],
  'm1097-b-019': [
    { text: "Lever inoperable or binds between range detents.", categoryId: 'transmission', readiness: 'NMC' },
    { text: "Lever inoperable or does not engage in all ranges with engine not running.", categoryId: 'transmission', readiness: 'NMC' },
  ],
  'm1097-b-021': [
    { text: "Fuel is not clear after draining 1 pint (0.47 L).", categoryId: 'fuel-system', readiness: 'NMC' },
    { text: "Class III leakage evident.", categoryId: 'fluid-leak', readiness: 'NMC' },
  ],
  'm1097-b-022': [
    { text: "Tire deflated or otherwise unserviceable.", categoryId: 'tire-damage', readiness: 'NMC' },
  ],
  'm1097-b-024': [
    { text: "Any brake fluid leak; Class III leak of oil, fuel, or coolant.", categoryId: 'fluid-leak', readiness: 'NMC' },
    { text: "Crossmembers or underbody support are missing any hardware, broken, cracked, or if a bent or rusted-through condition is present that would affect vehicle operation.", categoryId: 'body-damage', readiness: 'NMC' },
    { text: "Any damage that will prevent operation.", categoryId: 'body-damage', readiness: 'NMC' },
  ],
  'm1097-b-025': [
    { text: "Any brake fluid leak; class III leak of oil, fuel, or coolant.", categoryId: 'fluid-leak', readiness: 'NMC' },
    { text: "Crossmembers or underbody support are missing any hardware, broken, cracked, or if a bent or rusted-through condition is present that would affect vehicle operation.", categoryId: 'body-damage', readiness: 'NMC' },
    { text: "Bumper, crossmember or an inner brace is cracked or broken.", categoryId: 'body-damage', readiness: 'NMC' },
  ],
  'm1097-b-026': [
    { text: "Tire deflated, or otherwise unserviceable.", categoryId: 'tire-damage', readiness: 'NMC' },
  ],
  'm1097-b-028': [
    { text: "Any brake fluid leak; class III leak of oil, fuel, or coolant.", categoryId: 'fluid-leak', readiness: 'NMC' },
    { text: "Crossmembers or underbody support are missing any hardware, broken, cracked, or if a bent or rusted-through condition is present that would affect vehicle operation.", categoryId: 'body-damage', readiness: 'NMC' },
    { text: "Any damage that will prevent operation.", categoryId: 'body-damage', readiness: 'NMC' },
  ],
  'm1097-b-029': [
    { text: "Oil appears milky.", categoryId: 'engine-oil-pressure', readiness: 'NMC' },
  ],
  'm1097-b-030': [
    { text: "Class III leakage evident.", categoryId: 'steering', readiness: 'NMC' },
  ],
  'm1097-b-031': [
    { text: "Class III leakage evident.", categoryId: 'cooling-system', readiness: 'NMC' },
  ],
  'm1097-b-032': [
    { text: "Any leak or cover missing.", categoryId: 'brake-issue', readiness: 'NMC' },
  ],
  'm1097-b-036': [
    { text: "Windshield is cracked, broken, or discolored (cloudy) sufficiently to impair operator’s vision.", categoryId: 'glass-damage', readiness: 'NMC' },
  ],
  'm1097-b-039': [
    { text: "Any tread is worn to height of tread wear indicator (1/16 in. (1.59 mm) or less). Any cut, gouge, or crack that extends to the cord body or any bulges. Tires exhibit excessive inner and outer wear or balance.", categoryId: 'tire-damage', readiness: 'NMC' },
    { text: "Any wheel stud nut or lug nut is broken or missing.", categoryId: 'tire-damage', readiness: 'NMC' },
  ],
  'm1097-b-040': [
    { text: "Any mounts are broken, pipes are rusted through or broken, and any indication of an exhaust leak.", categoryId: 'unusual-noise', readiness: 'NMC' },
  ],
  'm1097-b-041': [
    { text: "Class III leakage or damage is evident; mounting damaged or loose.", categoryId: 'fluid-leak', readiness: 'NMC' },
    { text: "Spring coil has shifted off center.", categoryId: 'unusual-noise', readiness: 'NMC' },
  ],
  'm1097-b-044': [
    { text: "Heater inoperable and mission requires heater.", categoryId: 'heater', readiness: 'NMC' },
    { text: "Class III fuel leakage is evident and mission requires heater.", categoryId: 'fuel-system', readiness: 'NMC' },
    { text: "Frayed or broken wires.", categoryId: 'heater', readiness: 'NMC' },
    { text: "Heater exhaust damaged or components missing.", categoryId: 'heater', readiness: 'NMC' },
    { text: "Class III leak evident.", categoryId: 'fuel-system', readiness: 'NMC' },
  ],
  'm1097-b-045': [
    { text: "Evidence of damage to air cleaner weathercap, body, air intake hose, or mounting that will allow unfiltered air to enter the engine.", categoryId: 'engine-smoke', readiness: 'NMC' },
  ],
  'm1097-b-046': [
    { text: "Damaged or cracked bracket, or loose bolts.", categoryId: 'electrical', readiness: 'NMC' },
  ],
  'm1097-b-047': [
    { text: "Fan blade or pulley is bent, broken, cracked, or loose.", categoryId: 'cooling-system', readiness: 'NMC' },
    { text: "Class III leakage evident.", categoryId: 'fluid-leak', readiness: 'NMC' },
    { text: "Support mounts broken, damaged, or missing hardware. Side brackets damaged or weldments broken.", categoryId: 'cooling-system', readiness: 'NMC' },
    { text: "Any drivebelt is missing, broken, frayed or dry rotted. Belt fiber has more than one crack 1/8-in. (3.18 mm) in depth or 50% or frays more than 2 in. (5.1 cm) long.", categoryId: 'cooling-system', readiness: 'NMC' },
    { text: "Serpentine drivebelt is loose, misaligned (off one or more grooves on any pulley), breaks or splits in outer surface, frays on either edge if cord is broken.", categoryId: 'cooling-system', readiness: 'NMC' },
    { text: "Fan shroud broken, cracked, or loose.", categoryId: 'cooling-system', readiness: 'NMC' },
    { text: "Class III leak evident.", categoryId: 'fluid-leak', readiness: 'NMC' },
  ],
  'm1097-b-048': [
    { text: "One or more batteries missing, unserviceable, leaking, terminal or cables are loose, corroded, or holddowns are not secure.", categoryId: 'electrical', readiness: 'NMC' },
  ],
  'm1097-b-053': [
    { text: "Actuating lever or spring is missing or broken.", categoryId: 'brake-issue', readiness: 'NMC' },
  ],
  'm1097-b-054': [
    { text: "Any corroded-through condition or cracks or breaks that would affect vehicle operation.", categoryId: 'body-damage', readiness: 'NMC' },
  ],
  'm1097-b-055': [
    { text: "Any corroded-through condition or damage that would affect vehicle operation.", categoryId: 'body-damage', readiness: 'NMC' },
  ],
  'm1097-b-056': [
    { text: "Any mounting bolt missing.", categoryId: 'body-damage', readiness: 'NMC' },
  ],
  // ── MEP802A (TM 9-6115-641-10) — texts are TM NMC criteria ──
  'mep802a-b-001': [  // BEFORE 1 Housing
    { text: 'Cannot secure door.', categoryId: 'gen-housing', readiness: 'NMC' },
  ],
  'mep802a-b-003': [  // BEFORE 3 Skid Base
    { text: 'Skid base is cracked or shows signs of structural damage.', categoryId: 'gen-housing', readiness: 'NMC' },
  ],
  'mep802a-b-005': [  // BEFORE 5 Engine Assembly
    { text: 'Any loose, damaged, or missing hardware.', categoryId: 'gen-engine', readiness: 'NMC' },
  ],
  'mep802a-b-006': [  // BEFORE 6 Fuel System
    { text: 'Any fuel leaks, damage, loose or missing parts.', categoryId: 'gen-fuel', readiness: 'NMC' },
  ],
  'mep802a-b-007': [  // BEFORE 7 Fuel Filter/Water Separator
    { text: 'Any fuel leaks.', categoryId: 'gen-fuel', readiness: 'NMC' },
    { text: 'Water not drained.', categoryId: 'gen-fuel', readiness: 'NMC' },
  ],
  'mep802a-b-008': [  // BEFORE 8 Lubrication System
    { text: 'Class III leaks, damage, loose or missing parts.', categoryId: 'gen-oil-pressure', readiness: 'NMC' },
    { text: 'Oil level is low.', categoryId: 'gen-oil-pressure', readiness: 'NMC' },
    { text: 'Oil shows signs of contamination.', categoryId: 'gen-oil-pressure', readiness: 'NMC' },
  ],
  'mep802a-b-009': [  // BEFORE 9 Radiator
    { text: 'Class III leaks or missing radiator cap.', categoryId: 'gen-overheat', readiness: 'NMC' },
  ],
  'mep802a-b-010': [  // BEFORE 10 Hoses
    { text: 'Class III leaks or missing clamps or hoses.', categoryId: 'gen-overheat', readiness: 'NMC' },
  ],
  'mep802a-b-011': [  // BEFORE 11 Cooling Fan
    { text: 'Damaged or loose.', categoryId: 'gen-overheat', readiness: 'NMC' },
    { text: 'Unusual noise from fan area.', categoryId: 'gen-overheat', readiness: 'NMC' },
  ],
  'mep802a-b-012': [  // BEFORE 11.1 Water Pump
    { text: 'Class III leaks or unusual noise from area.', categoryId: 'gen-overheat', readiness: 'NMC' },
  ],
  'mep802a-b-013': [  // BEFORE 12 Fan Belt
    { text: 'Broken or missing belt.', categoryId: 'gen-overheat', readiness: 'NMC' },
  ],
  'mep802a-b-014': [  // BEFORE 13 Overflow Bottle
    { text: 'Class III leaks or missing hardware.', categoryId: 'gen-overheat', readiness: 'NMC' },
  ],
  'mep802a-b-015': [  // BEFORE 14 Exhaust System
    { text: 'Leaks, damaged, or missing parts.', categoryId: 'gen-exhaust', readiness: 'NMC' },
  ],
  'mep802a-b-016': [  // BEFORE 15 Air Cleaner Assembly
    { text: 'Loose, damaged, or missing parts.', categoryId: 'gen-engine', readiness: 'NMC' },
    { text: 'Clogged air cleaner element.', categoryId: 'gen-engine', readiness: 'NMC' },
  ],
  'mep802a-b-017': [  // BEFORE 16 Ground Rod Cable and Connections
    { text: 'Damaged, corroded, loose connections, or missing parts.', categoryId: 'gen-electrical', readiness: 'NMC' },
  ],
  'mep802a-b-018': [  // BEFORE 17 Batteries
    { text: 'Electrolyte is below battery plates.', categoryId: 'gen-electrical', readiness: 'NMC' },
    { text: 'Broken or missing mounting hardware.', categoryId: 'gen-electrical', readiness: 'NMC' },
  ],
  'mep802a-b-019': [  // BEFORE 18 Battery Cables
    { text: 'Damaged, loose, or missing parts.', categoryId: 'gen-electrical', readiness: 'NMC' },
  ],
  'mep802a-b-020': [  // BEFORE 19 Output Box Assembly
    { text: 'Damaged, loose, or missing parts.', categoryId: 'gen-electrical', readiness: 'NMC' },
    { text: 'Damaged or missing hardware.', categoryId: 'gen-electrical', readiness: 'NMC' },
  ],
  'mep802a-b-021': [  // BEFORE 20 Controls and Indicators
    { text: 'Damaged or missing parts.', categoryId: 'gen-electrical', readiness: 'NMC' },
  ],
  'mep802a-b-022': [  // BEFORE 21 Control Box Harness
    { text: 'Damaged or loose.', categoryId: 'gen-electrical', readiness: 'NMC' },
  ],
  'mep802a-b-023': [  // DURING 22 Housing
    { text: 'Cannot secure door.', categoryId: 'gen-housing', readiness: 'NMC' },
  ],
  'mep802a-b-024': [  // DURING 23 Engine Assembly
    { text: 'Any loose, damaged, or missing hardware.', categoryId: 'gen-engine', readiness: 'NMC' },
  ],
  'mep802a-b-025': [  // DURING 24 Fuel System
    { text: 'Any fuel leaks, damaged, loose, or missing parts.', categoryId: 'gen-fuel', readiness: 'NMC' },
  ],
  'mep802a-b-026': [  // DURING 25 Lubrication System
    { text: 'Class III leaks, damage, loose or missing parts.', categoryId: 'gen-oil-pressure', readiness: 'NMC' },
    { text: 'Oil level is low.', categoryId: 'gen-oil-pressure', readiness: 'NMC' },
    { text: 'Oil shows signs of contamination.', categoryId: 'gen-oil-pressure', readiness: 'NMC' },
  ],
  'mep802a-b-027': [  // DURING 26 Cooling Fan
    { text: 'Damaged or loose.', categoryId: 'gen-overheat', readiness: 'NMC' },
    { text: 'Unusual noise from fan area.', categoryId: 'gen-overheat', readiness: 'NMC' },
  ],
  'mep802a-b-028': [  // DURING 27 Overflow Bottle
    { text: 'Class III leaks or missing hardware.', categoryId: 'gen-overheat', readiness: 'NMC' },
  ],
  'mep802a-b-029': [  // DURING 28 Ground Rod Cable and Connections
    { text: 'Damaged, corroded, loose connections, or missing parts.', categoryId: 'gen-electrical', readiness: 'NMC' },
  ],
  'mep802a-b-030': [  // DURING 29 Controls and Indicators
    { text: 'Indicators are not operating properly.', categoryId: 'gen-electrical', readiness: 'NMC' },
  ],
  'mep802a-b-031': [  // AFTER 30 Housing
    { text: 'Cannot secure door.', categoryId: 'gen-housing', readiness: 'NMC' },
  ],
  'mep802a-b-033': [  // AFTER 32 Skid Base
    { text: 'Skid base is cracked or shows signs of structural damage.', categoryId: 'gen-housing', readiness: 'NMC' },
  ],
  'mep802a-b-034': [  // AFTER 33 Engine Assembly
    { text: 'Loose, damaged, or missing hardware.', categoryId: 'gen-engine', readiness: 'NMC' },
  ],
  'mep802a-b-035': [  // AFTER 34 Fuel System
    { text: 'Any fuel leaks, damage, loose or missing parts.', categoryId: 'gen-fuel', readiness: 'NMC' },
  ],
  'mep802a-b-036': [  // AFTER 35 Fuel Filter/Water Separator
    { text: 'Any fuel leaks.', categoryId: 'gen-fuel', readiness: 'NMC' },
    { text: 'Water not drained.', categoryId: 'gen-fuel', readiness: 'NMC' },
  ],
  'mep802a-b-037': [  // AFTER 36 Lubrication System
    { text: 'Class III leaks, damage, loose or missing parts.', categoryId: 'gen-oil-pressure', readiness: 'NMC' },
    { text: 'Oil level is low.', categoryId: 'gen-oil-pressure', readiness: 'NMC' },
    { text: 'Oil shows signs of contamination.', categoryId: 'gen-oil-pressure', readiness: 'NMC' },
  ],
  'mep802a-b-038': [  // AFTER 37 Radiator
    { text: 'Class III leaks or missing radiator cap.', categoryId: 'gen-overheat', readiness: 'NMC' },
  ],
  'mep802a-b-039': [  // AFTER 38 Hoses
    { text: 'Class III leaks or missing clamps or hoses.', categoryId: 'gen-overheat', readiness: 'NMC' },
  ],
  'mep802a-b-040': [  // AFTER 39 Fan Belt
    { text: 'Broken or missing belt.', categoryId: 'gen-overheat', readiness: 'NMC' },
  ],
  'mep802a-b-041': [  // AFTER 40 Controls and Indicators
    { text: 'Damaged or missing parts.', categoryId: 'gen-electrical', readiness: 'NMC' },
  ],
  'mep802a-b-042': [  // BEFORE 41 Heater Assembly
    { text: 'Damage that renders equipment unsafe. Heater not mounted securely.', categoryId: 'gen-winterization', readiness: 'NMC' },
  ],
  'mep802a-b-043': [  // BEFORE 42 Control Unit
    { text: 'Wires loose or broken or control unit damaged.', categoryId: 'gen-winterization', readiness: 'NMC' },
  ],
  'mep802a-b-044': [  // BEFORE 43 Fuel Pump
    { text: 'Any fuel leak.', categoryId: 'gen-winterization', readiness: 'NMC' },
  ],
  'mep802a-b-045': [  // BEFORE 44 Fuel Tank
    { text: 'Insufficient fuel.', categoryId: 'gen-winterization', readiness: 'NMC' },
  ],
  'mep802a-b-046': [  // BEFORE 45 Fuel Lines
    { text: 'Fuel lines damaged; clamps missing.', categoryId: 'gen-winterization', readiness: 'NMC' },
  ],
  'mep802a-b-047': [  // BEFORE 46 Heater
    { text: 'Class III coolant or any class fuel leak is detected.', categoryId: 'gen-winterization', readiness: 'NMC' },
  ],
  'mep802a-b-048': [  // BEFORE 47 Exhaust Hose
    { text: 'Hose obstructed; hose or clamp missing or damaged.', categoryId: 'gen-winterization', readiness: 'NMC' },
  ],
  'mep802a-b-049': [  // BEFORE 48 Air Inlet Hose
    { text: 'Inlet hose obstructed.', categoryId: 'gen-winterization', readiness: 'NMC' },
  ],
  'mep802a-b-050': [  // BEFORE 49 Winterization Kit Coolant Lines
    { text: 'Class III leaks or missing clamps or hoses.', categoryId: 'gen-winterization', readiness: 'NMC' },
  ],
  'mep802a-b-051': [  // BEFORE 50 Coolant Pump
    { text: 'Class III leaks or missing clamps or hoses.', categoryId: 'gen-winterization', readiness: 'NMC' },
  ],
  'mep802a-b-052': [  // BEFORE 51 Coolant Lines
    { text: 'Class III coolant leak is detected.', categoryId: 'gen-winterization', readiness: 'NMC' },
  ],
  'mep802a-b-053': [  // BEFORE 52 Wire Harness
    { text: 'Wiring is loose or damaged.', categoryId: 'gen-winterization', readiness: 'NMC' },
  ],
  'mep802a-b-054': [  // BEFORE 53 Heater Control and Switch Lamp
    { text: 'Light blinks showing failure in accordance with Heater Function Code Plate.', categoryId: 'gen-winterization', readiness: 'NMC' },
  ],
  'mep802a-b-056': [  // DURING 55 All Fuel Connections
    { text: 'Any class fuel leak detected.', categoryId: 'gen-winterization', readiness: 'NMC' },
  ],
  // ── MEP1030 (TM 9-6115-749-10) — texts are TM NMC criteria ──
  'mep1030-b-001': [  // BEFORE 1 Ground Rod, Clamp, and Cable
    { text: 'Ground rod, clamp, or cable missing, damaged, or connection loose.', categoryId: 'gen-electrical', readiness: 'NMC' },
  ],
  'mep1030-b-002': [  // BEFORE 2 Rear Panel
    { text: 'Rear panel missing or punctured.', categoryId: 'gen-housing', readiness: 'NMC' },
  ],
  'mep1030-b-005': [  // BEFORE 5 DCS
    { text: 'Damaged, loose, or missing parts.', categoryId: 'gen-electrical', readiness: 'NMC' },
  ],
  'mep1030-b-006': [  // BEFORE 6 Convenience Receptacle
    { text: 'Cover will not close.', categoryId: 'gen-electrical', readiness: 'NMC' },
    { text: 'Receptacles damaged or corroded.', categoryId: 'gen-electrical', readiness: 'NMC' },
  ],
  'mep1030-b-007': [  // BEFORE 7 Flexible Sleeve
    { text: 'Separated from rear panel.', categoryId: 'gen-housing', readiness: 'NMC' },
  ],
  'mep1030-b-008': [  // BEFORE 8 Fuel Fill
    { text: 'Damaged, corroded, or missing parts.', categoryId: 'gen-fuel', readiness: 'NMC' },
    { text: 'Damaged or missing cap, punctured or missing strainer.', categoryId: 'gen-fuel', readiness: 'NMC' },
    { text: 'Damaged or missing gasket.', categoryId: 'gen-fuel', readiness: 'NMC' },
    { text: 'Grounding stud (fuel fill static ground) missing or corroded.', categoryId: 'gen-fuel', readiness: 'NMC' },
  ],
  'mep1030-b-009': [  // BEFORE 9 Rear Door
    { text: 'Door cannot be secured.', categoryId: 'gen-housing', readiness: 'NMC' },
  ],
  'mep1030-b-010': [  // BEFORE 10 Fuel Tank
    { text: 'Fuel level is less than 4%.', categoryId: 'gen-fuel', readiness: 'NMC' },
    { text: 'Any classification of fuel leak or damage, or any loose or missing parts.', categoryId: 'gen-fuel', readiness: 'NMC' },
  ],
  'mep1030-b-011': [  // BEFORE 11 Fuel System Hoses
    { text: 'Any classification of fuel leak or damaged, loose, or missing parts.', categoryId: 'gen-fuel', readiness: 'NMC' },
  ],
  'mep1030-b-012': [  // BEFORE 12 Fuel Pumps and Fuel Manifold
    { text: 'Any classification of fuel leak or damage.', categoryId: 'gen-fuel', readiness: 'NMC' },
  ],
  'mep1030-b-013': [  // BEFORE 13 Electrical Connections
    { text: 'Connector looseness cannot be resolved.', categoryId: 'gen-electrical', readiness: 'NMC' },
  ],
  'mep1030-b-014': [  // BEFORE 14 Top Panel
    { text: 'Top panel missing or punctured.', categoryId: 'gen-housing', readiness: 'NMC' },
    { text: 'Clogged intake and/or exhaust grates cannot be resolved.', categoryId: 'gen-housing', readiness: 'NMC' },
  ],
  'mep1030-b-016': [  // BEFORE 16 Radiator, Exterior
    { text: 'Any Class III coolant leaks.', categoryId: 'gen-overheat', readiness: 'NMC' },
  ],
  'mep1030-b-017': [  // BEFORE 17 Radiator, Interior
    { text: 'Milky or dirty color.', categoryId: 'gen-overheat', readiness: 'NMC' },
  ],
  'mep1030-b-018': [  // BEFORE 18 Muffler
    { text: 'Muffler punctured, damaged, or corroded through to interior.', categoryId: 'gen-exhaust', readiness: 'NMC' },
    { text: 'Obstructions present.', categoryId: 'gen-exhaust', readiness: 'NMC' },
    { text: 'Rain cap missing or inoperable.', categoryId: 'gen-exhaust', readiness: 'NMC' },
  ],
  'mep1030-b-019': [  // BEFORE 19 Right-Side Panel
    { text: 'Right-side panel missing or punctured.', categoryId: 'gen-housing', readiness: 'NMC' },
  ],
  'mep1030-b-021': [  // BEFORE 21 Skid Base
    { text: 'Skid base cracked or shows signs of structural damage.', categoryId: 'gen-housing', readiness: 'NMC' },
    { text: 'If lifting ring shows signs of corrosion, bending, broken, or missing pin.', categoryId: 'gen-housing', readiness: 'NMC' },
  ],
  'mep1030-b-022': [  // BEFORE 22 Oil Drain Outlet
    { text: 'Class III leak.', categoryId: 'gen-oil-pressure', readiness: 'NMC' },
  ],
  'mep1030-b-023': [  // BEFORE 23 Output Box Door
    { text: 'Door cannot be secured.', categoryId: 'gen-housing', readiness: 'NMC' },
  ],
  'mep1030-b-024': [  // BEFORE 24 Right-Side Door
    { text: 'Door cannot be secured.', categoryId: 'gen-housing', readiness: 'NMC' },
  ],
  'mep1030-b-025': [  // BEFORE 25 Output Connections
    { text: 'Door cracked, missing, hinges missing or not working properly.', categoryId: 'gen-electrical', readiness: 'NMC' },
    { text: 'Ground and load cable connections are loose.', categoryId: 'gen-electrical', readiness: 'NMC' },
    { text: 'Ground or load cable cannot be secured.', categoryId: 'gen-electrical', readiness: 'NMC' },
    { text: 'Terminals, terminal nuts, damaged, missing, or corroded.', categoryId: 'gen-electrical', readiness: 'NMC' },
  ],
  'mep1030-b-026': [  // BEFORE 26 Output Terminal Board Protective Cover
    { text: 'Output terminal board protective cover missing, damaged or punctured. Missing or damaged hinge or hinge fasteners.', categoryId: 'gen-housing', readiness: 'NMC' },
  ],
  'mep1030-b-029': [  // BEFORE 29 Engine and Compartment Base
    { text: 'Any classification of fuel, Class III oil, or coolant leaks.', categoryId: 'gen-engine', readiness: 'NMC' },
  ],
  'mep1030-b-030': [  // BEFORE 30 Internal Exhaust Pipe
    { text: 'Any puncture to exhaust pipe.', categoryId: 'gen-exhaust', readiness: 'NMC' },
    { text: 'Missing clamp or separated exhaust joint.', categoryId: 'gen-exhaust', readiness: 'NMC' },
  ],
  'mep1030-b-031': [  // BEFORE 31 Radiator Hoses and Pipes
    { text: 'Class III coolant leak, missing clamp, or puncture of hoses or pipes.', categoryId: 'gen-overheat', readiness: 'NMC' },
  ],
  'mep1030-b-032': [  // BEFORE 32 Winterization Kit (If Installed)
    { text: 'Any classification of fuel leak or Class III coolant leak.', categoryId: 'gen-winterization', readiness: 'NMC' },
    { text: 'Any fuel leak or missing clamp.', categoryId: 'gen-winterization', readiness: 'NMC' },
    { text: 'Class III coolant leak, missing clamp, or punctured of hoses.', categoryId: 'gen-winterization', readiness: 'NMC' },
  ],
  'mep1030-b-033': [  // BEFORE 33 Oil Drain Line
    { text: 'Class III oil leak.', categoryId: 'gen-oil-pressure', readiness: 'NMC' },
  ],
  'mep1030-b-034': [  // BEFORE 34 Oil Level
    { text: 'Oil fill cap missing.', categoryId: 'gen-oil-pressure', readiness: 'NMC' },
  ],
  'mep1030-b-035': [  // BEFORE 35 Fuel Lines
    { text: 'Any fuel leak.', categoryId: 'gen-fuel', readiness: 'NMC' },
  ],
  'mep1030-b-036': [  // BEFORE 36 Fuel Filter/Water Separator
    { text: 'Any fuel leak.', categoryId: 'gen-fuel', readiness: 'NMC' },
  ],
  'mep1030-b-037': [  // BEFORE 37 Air Cleaner Assembly
    { text: 'Damage that restricts air flow, restriction indicator showing red band.', categoryId: 'gen-engine', readiness: 'NMC' },
  ],
  'mep1030-b-038': [  // BEFORE 38 AC Generator
    { text: 'Cracked generator housing, broken, or missing hardware.', categoryId: 'gen-electrical', readiness: 'NMC' },
    { text: 'Loose, broken, or missing wiring.', categoryId: 'gen-electrical', readiness: 'NMC' },
  ],
  'mep1030-b-040': [  // BEFORE 40 Front Panel
    { text: 'Front panel missing or punctured.', categoryId: 'gen-housing', readiness: 'NMC' },
    { text: 'Access panel missing.', categoryId: 'gen-housing', readiness: 'NMC' },
  ],
  'mep1030-b-042': [  // BEFORE 42 NATO Slave Receptacle
    { text: 'Safety cap missing.', categoryId: 'gen-electrical', readiness: 'NMC' },
    { text: 'Damaged, loose, or corroded connections.', categoryId: 'gen-electrical', readiness: 'NMC' },
  ],
  'mep1030-b-044': [  // BEFORE 44 Left-Side Panel
    { text: 'Left-side panel missing or punctured.', categoryId: 'gen-housing', readiness: 'NMC' },
    { text: 'Clogged intake grate cannot be resolved.', categoryId: 'gen-housing', readiness: 'NMC' },
  ],
  'mep1030-b-045': [  // BEFORE 45 Fuel Drain Fitting
    { text: 'Any fuel leak or missing cap.', categoryId: 'gen-fuel', readiness: 'NMC' },
  ],
  'mep1030-b-046': [  // BEFORE 46 Skid Base
    { text: 'Skid base cracked, dented, or shows signs of structural damage.', categoryId: 'gen-housing', readiness: 'NMC' },
    { text: 'Lifting ring corroded, bent, broken, or missing pin.', categoryId: 'gen-housing', readiness: 'NMC' },
  ],
  'mep1030-b-047': [  // BEFORE 47 Left-Side Door
    { text: 'Door cannot be secured.', categoryId: 'gen-housing', readiness: 'NMC' },
  ],
  'mep1030-b-048': [  // BEFORE 48 Oil Filter
    { text: 'Class III oil leak.', categoryId: 'gen-oil-pressure', readiness: 'NMC' },
    { text: 'Oil filter cannot be tightened by hand.', categoryId: 'gen-oil-pressure', readiness: 'NMC' },
  ],
  'mep1030-b-049': [  // BEFORE 49 Engine and Compartment Base
    { text: 'Any classification of fuel leak. Class III oil or coolant leaks.', categoryId: 'gen-engine', readiness: 'NMC' },
  ],
  'mep1030-b-050': [  // BEFORE 50 Coolant Overflow Bottle
    { text: 'Class III coolant leak. Missing cap.', categoryId: 'gen-overheat', readiness: 'NMC' },
    { text: 'Hose cannot be reconnected.', categoryId: 'gen-overheat', readiness: 'NMC' },
  ],
  'mep1030-b-051': [  // BEFORE 51 Battery-Charging Alternator
    { text: 'Loose wires or cracked housing.', categoryId: 'gen-electrical', readiness: 'NMC' },
    { text: 'Belt missing, loose, frayed, or cracked.', categoryId: 'gen-electrical', readiness: 'NMC' },
  ],
  'mep1030-b-052': [  // BEFORE 52 Batteries
    { text: 'Cracked or swollen casing, corroded terminals, or detached cables.', categoryId: 'gen-electrical', readiness: 'NMC' },
  ],
  'mep1030-b-053': [  // BEFORE 53 Starter
    { text: 'NATO slave receptacle (Figure 3, Item 1) terminal and wires loose, damaged, corroded, signs of arcing or other damage.', categoryId: 'gen-electrical', readiness: 'NMC' },
  ],
  'mep1030-b-054': [  // BEFORE 54 AC Generator
    { text: 'Cracked generator housing, or broken, loose, or missing hardware or wiring.', categoryId: 'gen-electrical', readiness: 'NMC' },
  ],
  'mep1030-b-056': [  // BEFORE 56 Radiator Hoses and Pipes
    { text: 'Class III coolant leak, missing clamp, or puncture of hoses or pipes.', categoryId: 'gen-overheat', readiness: 'NMC' },
  ],
  'mep1030-b-058': [  // DURING 58 DCS
    { text: 'Indicators not operating properly.', categoryId: 'gen-electrical', readiness: 'NMC' },
    { text: 'Battery voltage is below 16 VDC.', categoryId: 'gen-electrical', readiness: 'NMC' },
    { text: 'Circuit interrupter will not remain closed.', categoryId: 'gen-electrical', readiness: 'NMC' },
  ],
  'mep1030-b-059': [  // DURING 59 Engine
    { text: 'Exhaust smoke is black, white, or blue.', categoryId: 'gen-engine', readiness: 'NMC' },
    { text: 'Unusual, severe engine noises.', categoryId: 'gen-engine', readiness: 'NMC' },
  ],
  'mep1030-b-060': [  // DURING 60 Ground Rod and Connections
    { text: 'Arcing, damage, corrosion, or loose connections.', categoryId: 'gen-electrical', readiness: 'NMC' },
  ],
  'mep1030-b-061': [  // DURING 61 Rear Door
    { text: 'Door cannot be secured.', categoryId: 'gen-housing', readiness: 'NMC' },
  ],
  'mep1030-b-063': [  // DURING 63 Fuel Tank
    { text: 'Any classification of fuel leak, damage, or any loose or missing parts.', categoryId: 'gen-fuel', readiness: 'NMC' },
  ],
  'mep1030-b-064': [  // DURING 64 Fuel System Hoses
    { text: 'Any classification of fuel leak or damaged, loose, or missing parts.', categoryId: 'gen-fuel', readiness: 'NMC' },
  ],
  'mep1030-b-065': [  // DURING 65 Fuel Pumps and Fuel Manifold
    { text: 'Any classification of fuel leak or damage.', categoryId: 'gen-fuel', readiness: 'NMC' },
  ],
  'mep1030-b-066': [  // DURING 66 Electrical Connections
    { text: 'Connector loose.', categoryId: 'gen-electrical', readiness: 'NMC' },
  ],
  'mep1030-b-067': [  // DURING 67 Relay Panel and Electrical Connections
    { text: 'Relay panel cover punctured.', categoryId: 'gen-electrical', readiness: 'NMC' },
  ],
  'mep1030-b-068': [  // DURING 68 Engine and Compartment Base
    { text: 'Any classification of fuel leak. Class III oil or coolant leaks.', categoryId: 'gen-engine', readiness: 'NMC' },
  ],
  'mep1030-b-069': [  // DURING 69 Oil Drain Line
    { text: 'Class III oil leak.', categoryId: 'gen-oil-pressure', readiness: 'NMC' },
  ],
  'mep1030-b-070': [  // DURING 70 Fuel Lines and Fuel Filter/Water Separator
    { text: 'Any fuel leak.', categoryId: 'gen-fuel', readiness: 'NMC' },
  ],
  'mep1030-b-071': [  // DURING 71 Oil Level
    { text: 'Oil fill cap missing.', categoryId: 'gen-oil-pressure', readiness: 'NMC' },
  ],
  'mep1030-b-072': [  // DURING 72 AC Generator
    { text: 'Excessive noise and/or vibration.', categoryId: 'gen-electrical', readiness: 'NMC' },
    { text: 'Signs of damage, arcing, or loose connections.', categoryId: 'gen-electrical', readiness: 'NMC' },
  ],
  'mep1030-b-073': [  // DURING 73 Fuel Drain Fitting
    { text: 'Any classification of fuel leak or missing cap.', categoryId: 'gen-fuel', readiness: 'NMC' },
  ],
  'mep1030-b-074': [  // DURING 74 Cooling Fan
    { text: 'Damaged or loose fan.', categoryId: 'gen-overheat', readiness: 'NMC' },
  ],
  'mep1030-b-075': [  // DURING 75 Engine and Compartment Base
    { text: 'Any classification of fuel leak. Class III oil or coolant leaks.', categoryId: 'gen-engine', readiness: 'NMC' },
  ],
  'mep1030-b-076': [  // DURING 76 Coolant Overflow Bottle
    { text: 'Class III coolant leak or missing cap.', categoryId: 'gen-overheat', readiness: 'NMC' },
  ],
  'mep1030-b-077': [  // DURING 77 AC Generator
    { text: 'Excessive noise and/or vibration.', categoryId: 'gen-electrical', readiness: 'NMC' },
    { text: 'Signs of damage, arcing, or loose connections.', categoryId: 'gen-electrical', readiness: 'NMC' },
  ],
  'mep1030-b-078': [  // AFTER 78 Fuel Fill
    { text: 'Damaged, corroded, or missing parts.', categoryId: 'gen-fuel', readiness: 'NMC' },
    { text: 'Damaged or missing cap. Punctured or missing strainer.', categoryId: 'gen-fuel', readiness: 'NMC' },
    { text: 'Damaged or missing gasket.', categoryId: 'gen-fuel', readiness: 'NMC' },
    { text: 'Fuel fill cap will not seal.', categoryId: 'gen-fuel', readiness: 'NMC' },
    { text: 'Grounding stud (fuel fill static ground) missing or corroded.', categoryId: 'gen-fuel', readiness: 'NMC' },
  ],
  'mep1030-b-080': [  // AFTER 80 Output Connections
    { text: 'Terminal board shows evidence of arcing or high temperature', categoryId: 'gen-electrical', readiness: 'NMC' },
  ],
  'mep1030-b-081': [  // AFTER 81 Output Terminal Board Protective Cover
    { text: 'Output terminal board protective cover missing, cracked through, or melted. Missing or damaged hinge or hinge fasteners.', categoryId: 'gen-housing', readiness: 'NMC' },
  ],
  'mep1030-b-082': [  // AFTER 82 Oil Drain Outlet
    { text: 'Class III leak.', categoryId: 'gen-oil-pressure', readiness: 'NMC' },
  ],
  'mep1030-b-083': [  // AFTER 83 Engine and Compartment Base
    { text: 'Any classification of fuel leak. Class III oil or coolant leaks.', categoryId: 'gen-engine', readiness: 'NMC' },
  ],
  'mep1030-b-084': [  // AFTER 84 Oil Level
    { text: 'Oil fill cap missing.', categoryId: 'gen-oil-pressure', readiness: 'NMC' },
  ],
  'mep1030-b-085': [  // AFTER 85 Fuel Drain Fitting
    { text: 'Any fuel leak. Missing cap.', categoryId: 'gen-fuel', readiness: 'NMC' },
  ],
  'mep1030-b-086': [  // AFTER 86 Batteries
    { text: 'Cracked or swollen casing.', categoryId: 'gen-electrical', readiness: 'NMC' },
  ],
  'mep1030-b-088': [  // AFTER 88 Engine and Compartment Base
    { text: 'Any classification of fuel leak. Class III oil or coolant leaks.', categoryId: 'gen-engine', readiness: 'NMC' },
  ],
  'mep1030-b-089': [  // AFTER 89 Coolant Overflow Bottle
    { text: 'Class III coolant leak. Missing cap.', categoryId: 'gen-overheat', readiness: 'NMC' },
    { text: 'Hose cannot be reconnected.', categoryId: 'gen-overheat', readiness: 'NMC' },
  ],
  'mep1030-b-091': [  // AFTER 91 Radiator, Interior
    { text: 'Milky or dirty color.', categoryId: 'gen-overheat', readiness: 'NMC' },
    { text: 'Radiator cap missing or cannot be tightened.', categoryId: 'gen-overheat', readiness: 'NMC' },
  ],
  // ── MEP831A (TM 9-6115-639-13&P) — texts are TM NMC criteria ──
  'mep831a-b-001': [  // BEFORE 1 Overall Generator Set
    { text: 'Significant cracks in any generator set component.', categoryId: 'gen-housing', readiness: 'NMC' },
  ],
  'mep831a-b-002': [  // BEFORE 2 Generator Set Main Access Cover
    { text: 'Main access cover is not secure. Latches do not lock, allowing main access cover to rattle excessively.', categoryId: 'gen-housing', readiness: 'NMC' },
    { text: 'Intake or exhaust is blocked or damaged.', categoryId: 'gen-housing', readiness: 'NMC' },
  ],
  'mep831a-b-003': [  // BEFORE 3 Control Box and Output Panel
    { text: 'Any switch is not operable or any meter is damaged.', categoryId: 'gen-electrical', readiness: 'NMC' },
    { text: 'Fault indicator is defective or lamp does not light.', categoryId: 'gen-electrical', readiness: 'NMC' },
    { text: 'Wires or connectors are damaged.', categoryId: 'gen-electrical', readiness: 'NMC' },
  ],
  'mep831a-b-004': [  // BEFORE 4 Convenience Receptacle (60 Hz Only)
    { text: 'Receptacle damaged, shorted, or corroded.', categoryId: 'gen-electrical', readiness: 'NMC' },
  ],
  'mep831a-b-005': [  // BEFORE 5 NATO Slave Receptacle
    { text: 'Receptacle damaged, shorted, or corroded.', categoryId: 'gen-electrical', readiness: 'NMC' },
  ],
  'mep831a-b-006': [  // BEFORE 6 Output Panel
    { text: 'Terminals are loose, damaged, disconnected, shorted, or corroded.', categoryId: 'gen-electrical', readiness: 'NMC' },
    { text: 'Set is not grounded properly.', categoryId: 'gen-electrical', readiness: 'NMC' },
  ],
  'mep831a-b-007': [  // BEFORE 7 Exhaust System
    { text: 'Exhaust system is damaged to the extent it will affect operation or safety of personnel.', categoryId: 'gen-exhaust', readiness: 'NMC' },
  ],
  'mep831a-b-008': [  // BEFORE 8 Fuel Fill Ports
    { text: 'Strainer is damaged.', categoryId: 'gen-fuel', readiness: 'NMC' },
    { text: 'Fuel cap is damaged to the point where fuel leakage is likely.', categoryId: 'gen-fuel', readiness: 'NMC' },
  ],
  'mep831a-b-009': [  // BEFORE 9 Fuel Tank and Hoses
    { text: 'Fuel leaks of any kind are present. Fuel line is cut or damaged.', categoryId: 'gen-fuel', readiness: 'NMC' },
  ],
  'mep831a-b-010': [  // BEFORE 10 Fuel Filter/Water Separator
    { text: 'Water and fuel are mixed. Separator is damaged or leaking.', categoryId: 'gen-fuel', readiness: 'NMC' },
  ],
  'mep831a-b-011': [  // BEFORE 11 Skid Base
    { text: 'Drain ports are damaged to the extent they will leak.', categoryId: 'gen-housing', readiness: 'NMC' },
    { text: 'Lifting handles do not operate or are loose.', categoryId: 'gen-housing', readiness: 'NMC' },
    { text: 'Vibration mounts are damaged or worn.', categoryId: 'gen-housing', readiness: 'NMC' },
  ],
  'mep831a-b-013': [  // BEFORE 13 Frequency Converter (A8)
    { text: 'Water is in Frequency Converter (A8).', categoryId: 'gen-electrical', readiness: 'NMC' },
  ],
  'mep831a-b-014': [  // BEFORE 14 Engine Oil
    { text: 'Class III oil leaks, damage, or loose or missing parts are present.', categoryId: 'gen-oil-pressure', readiness: 'NMC' },
    { text: 'Oil shows signs of contamination.', categoryId: 'gen-oil-pressure', readiness: 'NMC' },
  ],
  'mep831a-b-015': [  // BEFORE 15 Engine Air Filter
    { text: 'Filter is clogged.', categoryId: 'gen-engine', readiness: 'NMC' },
  ],
  'mep831a-b-016': [  // BEFORE 16 Engine Alternator Compartment
    { text: 'Damaged wires, or broken or missing terminals.', categoryId: 'gen-electrical', readiness: 'NMC' },
  ],
  'mep831a-b-017': [  // DURING 17 VOLTAGE and LOAD Meters (Control Panel)
    { text: 'Adjustments cannot be made.', categoryId: 'gen-electrical', readiness: 'NMC' },
  ],
  'mep831a-b-018': [  // DURING 18 FUEL LEVEL Meter (Located on Control Panel)
    { text: 'Fuel level is empty or level meter is inoperable.', categoryId: 'gen-fuel', readiness: 'NMC' },
  ],
  'mep831a-b-019': [  // DURING 19 Engine Oil (After 8 Hours of Constant Use)
    { text: 'Oil level is at or below minimum oil level mark on dipstick.', categoryId: 'gen-oil-pressure', readiness: 'NMC' },
  ],
  'mep831a-b-020': [  // DURING 20 Fuel Filter/Water Separator (After 8 Hours of Constant Use)
    { text: 'Water and fuel are mixed. Separator is damaged or leaking.', categoryId: 'gen-fuel', readiness: 'NMC' },
  ],
  'mep831a-b-021': [  // AFTER 21 Fuel Lines
    { text: 'Fuel leaks of any kind are present. Lines are cut, torn, loose, or damaged.', categoryId: 'gen-fuel', readiness: 'NMC' },
  ],
  'mep831a-b-022': [  // AFTER 22 Overall Generator Set
    { text: 'Cracks allow water to enter Frequency Converter (A8) or dents adversely affect operation of generator set.', categoryId: 'gen-housing', readiness: 'NMC' },
  ],
  'mep831a-b-024': [  // AFTER 24 Engine
    { text: 'Fuel leaks of any kind are present. Pipes or hose are damaged.', categoryId: 'gen-fuel', readiness: 'NMC' },
  ],
};
