// Fault suggestion chips keyed by step ID
// Each entry provides 3-5 common fault descriptions for quick entry

export interface FaultSuggestion {
  text: string;
  categoryId: string;
}

export const FAULT_SUGGESTIONS: Record<string, FaultSuggestion[]> = {
  // ── M1151 Zone 1: Exterior Walk-Around ──
  'm1151-b-001': [
    { text: 'Oil leak under left front', categoryId: 'fluid-leak' },
    { text: 'Coolant leak — green/orange fluid', categoryId: 'fluid-leak' },
    { text: 'Brake fluid leak at wheel', categoryId: 'brake-issue' },
    { text: 'Fuel leak at fuel line connection', categoryId: 'fluid-leak' },
    { text: 'Body damage — left side', categoryId: 'body-damage' },
  ],
  'm1151-b-002': [
    { text: 'Tire flat — needs replacement', categoryId: 'tire-damage' },
    { text: 'Low tire pressure — left side', categoryId: 'tire-damage' },
    { text: 'Tread worn below minimum', categoryId: 'tire-damage' },
    { text: 'Sidewall cut/bulge', categoryId: 'tire-damage' },
  ],
  'm1151-b-003': [
    { text: 'Fluid leak under rear', categoryId: 'fluid-leak' },
    { text: 'Rear body damage', categoryId: 'body-damage' },
    { text: 'Bumper support cracked', categoryId: 'body-damage' },
    { text: 'Brake fluid leak — rear', categoryId: 'brake-issue' },
  ],
  'm1151-b-004': [
    { text: 'Oil leak under right front', categoryId: 'fluid-leak' },
    { text: 'Body damage — right side', categoryId: 'body-damage' },
    { text: 'Brake fluid leak — right side', categoryId: 'brake-issue' },
    { text: 'Coolant leak — right side', categoryId: 'fluid-leak' },
  ],
  'm1151-b-005': [
    { text: 'Tire flat — needs replacement', categoryId: 'tire-damage' },
    { text: 'Low tire pressure — right side', categoryId: 'tire-damage' },
    { text: 'Tread worn below minimum', categoryId: 'tire-damage' },
    { text: 'Sidewall cut/bulge', categoryId: 'tire-damage' },
  ],
  'm1151-b-006': [
    { text: 'Front body damage', categoryId: 'body-damage' },
    { text: 'Fluid leak under front', categoryId: 'fluid-leak' },
    { text: 'Brake fluid leak — front', categoryId: 'brake-issue' },
  ],

  // ── M1151 Zone 2: Under Hood ──
  'm1151-b-007': [
    { text: 'Power steering fluid low', categoryId: 'fluid-leak' },
    { text: 'Fluid below COLD mark', categoryId: 'fluid-leak' },
    { text: 'Fluid contaminated/dark', categoryId: 'fluid-leak' },
    { text: 'Reservoir cap missing', categoryId: 'missing-bii' },
  ],
  'm1151-b-008': [
    { text: 'Power steering fluid low', categoryId: 'fluid-leak' },
    { text: 'Fluid below COLD mark', categoryId: 'fluid-leak' },
    { text: 'Fluid contaminated/dark', categoryId: 'fluid-leak' },
    { text: 'Reservoir cap missing', categoryId: 'missing-bii' },
  ],
  'm1151-b-009': [
    { text: 'Belt cracked/fraying', categoryId: 'unusual-noise' },
    { text: 'Belt loose — excessive play', categoryId: 'unusual-noise' },
    { text: 'Belt missing or broken', categoryId: 'unusual-noise' },
    { text: 'Pulley worn or misaligned', categoryId: 'unusual-noise' },
    { text: 'Belt glazed — slipping', categoryId: 'unusual-noise' },
  ],
  'm1151-b-010': [
    { text: 'Coolant level below FULL COLD', categoryId: 'fluid-leak' },
    { text: 'Coolant discolored/rusty', categoryId: 'fluid-leak' },
    { text: 'Coolant leak at hose clamp', categoryId: 'fluid-leak' },
    { text: 'Surge tank cracked', categoryId: 'fluid-leak' },
  ],

  // ── M1151 Zone 3: Cab Interior ──
  'm1151-b-011': [
    { text: 'Door requires excessive force', categoryId: 'body-damage' },
    { text: 'Door does not latch', categoryId: 'body-damage' },
    { text: 'Combat lock does not engage', categoryId: 'body-damage' },
    { text: 'Door hinge damaged', categoryId: 'body-damage' },
  ],
  'm1151-b-012': [
    { text: 'Seat belt does not latch', categoryId: 'missing-bii' },
    { text: 'Seat belt does not retract', categoryId: 'missing-bii' },
    { text: 'Seat belt frayed/cut', categoryId: 'missing-bii' },
    { text: 'Seat adjustment lock broken', categoryId: 'body-damage' },
  ],
  'm1151-b-013': [
    { text: 'Fire extinguisher missing', categoryId: 'missing-bii' },
    { text: 'Gauge in recharge area', categoryId: 'missing-bii' },
    { text: 'Seal broken or missing', categoryId: 'missing-bii' },
    { text: 'Extinguisher damaged', categoryId: 'missing-bii' },
  ],
  'm1151-b-014': [
    { text: 'AFES pressure below minimum', categoryId: 'electrical' },
    { text: 'Wiring harness disconnected/damaged', categoryId: 'electrical' },
    { text: 'AFES extinguisher missing', categoryId: 'missing-bii' },
    { text: 'Green LED not steady on', categoryId: 'electrical' },
    { text: 'Fire sensor LED not on or dirty', categoryId: 'electrical' },
  ],
  'm1151-b-015': [
    { text: 'Transmission lever binds', categoryId: 'brake-issue' },
    { text: 'Transfer lever does not engage', categoryId: 'brake-issue' },
    { text: 'Lever inoperable', categoryId: 'brake-issue' },
  ],
  'm1151-b-016': [
    { text: 'Headlights inoperative', categoryId: 'electrical' },
    { text: 'Blackout drive light broken', categoryId: 'electrical' },
    { text: 'Turn signal inoperative', categoryId: 'electrical' },
    { text: 'Marker light inoperative', categoryId: 'electrical' },
  ],
  'm1151-b-017': [
    { text: 'Horn inoperative', categoryId: 'electrical' },
    { text: 'Windshield cracked — impairs vision', categoryId: 'glass-damage' },
    { text: 'Wipers inoperative', categoryId: 'electrical' },
    { text: 'Wiper blades torn/deteriorated', categoryId: 'electrical' },
    { text: 'Washer fluid empty', categoryId: 'fluid-leak' },
  ],

  // ── M1151 Zone 4: Engine Running ──
  'm1151-b-018': [
    { text: 'Wait-to-start light does not come on', categoryId: 'electrical' },
    { text: 'Wait-to-start light stays on continually', categoryId: 'electrical' },
    { text: 'Brake warning light does not come on', categoryId: 'brake-issue' },
  ],
  'm1151-b-019': [
    { text: 'Engine will not start', categoryId: 'wont-start' },
    { text: 'Oil pressure below 6 psi at idle', categoryId: 'fluid-leak' },
    { text: 'Oil pressure below 15 psi under load', categoryId: 'fluid-leak' },
    { text: 'Voltmeter in yellow/red range', categoryId: 'electrical' },
  ],
  'm1151-b-020': [
    { text: 'Air restriction gauge in red zone', categoryId: 'unusual-noise' },
    { text: 'Brake warning light stays on', categoryId: 'brake-issue' },
    { text: 'Fuel gauge inoperative', categoryId: 'electrical' },
    { text: 'Coolant temp above 250°F', categoryId: 'fluid-leak' },
    { text: 'Overheat lamp illuminated', categoryId: 'electrical' },
  ],
  'm1151-b-021': [
    { text: 'Weapon station binds during rotation', categoryId: 'body-damage' },
    { text: 'Mounting plate loose or damaged', categoryId: 'body-damage' },
    { text: 'Bearing sleeve missing', categoryId: 'missing-bii' },
    { text: 'Cannot mount armament weapons', categoryId: 'body-damage' },
  ],

  // ── M1152 Zone 1: Exterior Walk-Around ──
  'm1152-b-001': [
    { text: 'Oil leak under left front', categoryId: 'fluid-leak' },
    { text: 'Coolant leak — green/orange fluid', categoryId: 'fluid-leak' },
    { text: 'Brake fluid leak at wheel', categoryId: 'brake-issue' },
    { text: 'Fuel leak at fuel line connection', categoryId: 'fluid-leak' },
    { text: 'Body damage — left side', categoryId: 'body-damage' },
  ],
  'm1152-b-002': [
    { text: 'Tire flat — needs replacement', categoryId: 'tire-damage' },
    { text: 'Low tire pressure — left side', categoryId: 'tire-damage' },
    { text: 'Tread worn below minimum', categoryId: 'tire-damage' },
    { text: 'Sidewall cut/bulge', categoryId: 'tire-damage' },
  ],
  'm1152-b-003': [
    { text: 'Fluid leak under rear', categoryId: 'fluid-leak' },
    { text: 'Rear body damage', categoryId: 'body-damage' },
    { text: 'Bumper support cracked', categoryId: 'body-damage' },
    { text: 'Brake fluid leak — rear', categoryId: 'brake-issue' },
  ],
  'm1152-b-004': [
    { text: 'Oil leak under right front', categoryId: 'fluid-leak' },
    { text: 'Body damage — right side', categoryId: 'body-damage' },
    { text: 'Brake fluid leak — right side', categoryId: 'brake-issue' },
    { text: 'Coolant leak — right side', categoryId: 'fluid-leak' },
  ],
  'm1152-b-005': [
    { text: 'Tire flat — needs replacement', categoryId: 'tire-damage' },
    { text: 'Low tire pressure — right side', categoryId: 'tire-damage' },
    { text: 'Tread worn below minimum', categoryId: 'tire-damage' },
    { text: 'Sidewall cut/bulge', categoryId: 'tire-damage' },
  ],
  'm1152-b-006': [
    { text: 'Front body damage', categoryId: 'body-damage' },
    { text: 'Fluid leak under front', categoryId: 'fluid-leak' },
    { text: 'Brake fluid leak — front', categoryId: 'brake-issue' },
  ],

  // ── M1152 Zone 2: Under Hood ──
  'm1152-b-007': [
    { text: 'Power steering fluid low', categoryId: 'fluid-leak' },
    { text: 'Fluid below COLD mark', categoryId: 'fluid-leak' },
    { text: 'Fluid contaminated/dark', categoryId: 'fluid-leak' },
    { text: 'Reservoir cap missing', categoryId: 'missing-bii' },
  ],
  'm1152-b-008': [
    { text: 'Power steering fluid low', categoryId: 'fluid-leak' },
    { text: 'Fluid below COLD mark', categoryId: 'fluid-leak' },
    { text: 'Fluid contaminated/dark', categoryId: 'fluid-leak' },
    { text: 'Reservoir cap missing', categoryId: 'missing-bii' },
  ],
  'm1152-b-009': [
    { text: 'Belt cracked/fraying', categoryId: 'unusual-noise' },
    { text: 'Belt loose — excessive play', categoryId: 'unusual-noise' },
    { text: 'Belt missing or broken', categoryId: 'unusual-noise' },
    { text: 'Pulley worn or misaligned', categoryId: 'unusual-noise' },
    { text: 'Belt glazed — slipping', categoryId: 'unusual-noise' },
  ],
  'm1152-b-010': [
    { text: 'Coolant level below FULL COLD', categoryId: 'fluid-leak' },
    { text: 'Coolant discolored/rusty', categoryId: 'fluid-leak' },
    { text: 'Coolant leak at hose clamp', categoryId: 'fluid-leak' },
    { text: 'Surge tank cracked', categoryId: 'fluid-leak' },
  ],

  // ── M1152 Zone 3: Cab Interior ──
  'm1152-b-011': [
    { text: 'Door requires excessive force', categoryId: 'body-damage' },
    { text: 'Door does not latch', categoryId: 'body-damage' },
    { text: 'Combat lock does not engage', categoryId: 'body-damage' },
    { text: 'Door hinge damaged', categoryId: 'body-damage' },
  ],
  'm1152-b-012': [
    { text: 'Seat belt does not latch', categoryId: 'missing-bii' },
    { text: 'Seat belt does not retract', categoryId: 'missing-bii' },
    { text: 'Seat belt frayed/cut', categoryId: 'missing-bii' },
    { text: 'Seat adjustment lock broken', categoryId: 'body-damage' },
  ],
  'm1152-b-013': [
    { text: 'Fire extinguisher missing', categoryId: 'missing-bii' },
    { text: 'Gauge in recharge area', categoryId: 'missing-bii' },
    { text: 'Seal broken or missing', categoryId: 'missing-bii' },
    { text: 'Extinguisher damaged', categoryId: 'missing-bii' },
  ],
  'm1152-b-014': [
    { text: 'AFES pressure below minimum', categoryId: 'electrical' },
    { text: 'Wiring harness disconnected/damaged', categoryId: 'electrical' },
    { text: 'AFES extinguisher missing', categoryId: 'missing-bii' },
    { text: 'Green LED not steady on', categoryId: 'electrical' },
    { text: 'Fire sensor LED not on or dirty', categoryId: 'electrical' },
  ],
  'm1152-b-015': [
    { text: 'Transmission lever binds', categoryId: 'brake-issue' },
    { text: 'Transfer lever does not engage', categoryId: 'brake-issue' },
    { text: 'Lever inoperable', categoryId: 'brake-issue' },
  ],
  'm1152-b-016': [
    { text: 'Headlights inoperative', categoryId: 'electrical' },
    { text: 'Blackout drive light broken', categoryId: 'electrical' },
    { text: 'Turn signal inoperative', categoryId: 'electrical' },
    { text: 'Marker light inoperative', categoryId: 'electrical' },
  ],
  'm1152-b-017': [
    { text: 'Horn inoperative', categoryId: 'electrical' },
    { text: 'Windshield cracked — impairs vision', categoryId: 'glass-damage' },
    { text: 'Wipers inoperative', categoryId: 'electrical' },
    { text: 'Wiper blades torn/deteriorated', categoryId: 'electrical' },
    { text: 'Washer fluid empty', categoryId: 'fluid-leak' },
  ],

  // ── M1152 Zone 4: Engine Running ──
  'm1152-b-018': [
    { text: 'Wait-to-start light does not come on', categoryId: 'electrical' },
    { text: 'Wait-to-start light stays on continually', categoryId: 'electrical' },
    { text: 'Brake warning light does not come on', categoryId: 'brake-issue' },
  ],
  'm1152-b-019': [
    { text: 'Engine will not start', categoryId: 'wont-start' },
    { text: 'Oil pressure below 6 psi at idle', categoryId: 'fluid-leak' },
    { text: 'Oil pressure below 15 psi under load', categoryId: 'fluid-leak' },
    { text: 'Voltmeter in yellow/red range', categoryId: 'electrical' },
  ],
  'm1152-b-020': [
    { text: 'Air restriction gauge in red zone', categoryId: 'unusual-noise' },
    { text: 'Brake warning light stays on', categoryId: 'brake-issue' },
    { text: 'Fuel gauge inoperative', categoryId: 'electrical' },
    { text: 'Coolant temp above 250°F', categoryId: 'fluid-leak' },
    { text: 'Overheat lamp illuminated', categoryId: 'electrical' },
  ],

  // ── LMTV M1078 Zone 1: Approach / Exterior Walk-Around (TM 9-2320-365-10) ──
  'm1078-b-001': [
    { text: 'Windshield cracked — impairs vision', categoryId: 'glass-damage' },
    { text: 'Wiper blade missing', categoryId: 'missing-bii' },
    { text: 'Wiper blade damaged/unserviceable', categoryId: 'electrical' },
    { text: 'Washer reservoir empty', categoryId: 'fluid-leak' },
  ],
  'm1078-b-002': [
    { text: 'Shackle pin loose — front', categoryId: 'body-damage' },
    { text: 'Shackle pin loose — rear', categoryId: 'body-damage' },
    { text: 'Shackle pin missing', categoryId: 'missing-bii' },
  ],
  'm1078-b-003': [
    { text: 'Fuel leak under vehicle', categoryId: 'fluid-leak' },
    { text: 'Oil leak under vehicle', categoryId: 'fluid-leak' },
    { text: 'Coolant leak under vehicle', categoryId: 'fluid-leak' },
    { text: 'Class III leak evident', categoryId: 'fluid-leak' },
  ],
  'm1078-b-004': [
    { text: 'Coolant level below lower sightglass', categoryId: 'fluid-leak' },
    { text: 'Oil present in coolant', categoryId: 'fluid-leak' },
    { text: 'Coolant leak at hose/fitting', categoryId: 'fluid-leak' },
    { text: 'Overflow tank cracked', categoryId: 'fluid-leak' },
  ],
  'm1078-b-005': [
    { text: 'No fuel in tank', categoryId: 'fluid-leak' },
    { text: 'Fuel cap missing/damaged', categoryId: 'missing-bii' },
    { text: 'Fuel strainer missing/damaged', categoryId: 'missing-bii' },
  ],
  'm1078-b-006': [
    { text: 'Spare tire strap loose', categoryId: 'body-damage' },
    { text: 'Spare tire strap torn/frayed', categoryId: 'body-damage' },
    { text: 'SPARE TIRE knob not in RAISE position', categoryId: 'electrical' },
    { text: 'CAB knob (Air Springs) not pushed in', categoryId: 'electrical' },
  ],
  'm1078-b-007': [
    { text: 'Cab hydraulic latch not latched', categoryId: 'body-damage' },
    { text: 'Cab will not securely latch', categoryId: 'body-damage' },
    { text: 'Latch indicator button not in latched position', categoryId: 'body-damage' },
  ],
  'm1078-b-008': [
    { text: 'Air/hydraulic power unit oil low', categoryId: 'fluid-leak' },
    { text: 'Oil level below ADD on dipstick', categoryId: 'fluid-leak' },
  ],

  // ── LMTV M1078 Zone 2: Cab Interior ──
  'm1078-b-009': [
    { text: 'Driver seat belt does not latch', categoryId: 'missing-bii' },
    { text: 'Seat belt frayed/cut', categoryId: 'missing-bii' },
    { text: 'Seat belt does not retract', categoryId: 'missing-bii' },
    { text: 'Multiple seat belts unserviceable', categoryId: 'missing-bii' },
  ],
  'm1078-b-010': [
    { text: 'Seat adjustment broken', categoryId: 'body-damage' },
    { text: 'Seat adjustment missing', categoryId: 'missing-bii' },
    { text: 'Seat does not move forward/backward', categoryId: 'body-damage' },
  ],
  'm1078-b-011': [
    { text: 'Fire extinguisher missing', categoryId: 'missing-bii' },
    { text: 'Fire extinguisher damaged', categoryId: 'missing-bii' },
    { text: 'Pressure gage in discharge band', categoryId: 'missing-bii' },
    { text: 'Seal is missing', categoryId: 'missing-bii' },
  ],
  'm1078-b-012': [
    { text: 'STOP indicator not illuminated', categoryId: 'electrical' },
    { text: 'PARK BRAKE indicator not illuminated', categoryId: 'brake-issue' },
    { text: 'EMERGENCY BRAKE indicator not illuminated', categoryId: 'brake-issue' },
    { text: 'BRAKE AIR indicator not illuminated', categoryId: 'brake-issue' },
    { text: 'ENGINE OIL PRESSURE indicator not illuminated', categoryId: 'electrical' },
  ],
  'm1078-b-013': [
    { text: 'Windshield washer switch inoperative', categoryId: 'electrical' },
    { text: 'Windshield wiper switch inoperative', categoryId: 'electrical' },
  ],

  // ── LMTV M1078 Zone 3: Engine Running Checks ──
  'm1078-b-014': [
    { text: 'Oil pressure in red zone — indicator on', categoryId: 'fluid-leak' },
    { text: 'Oil pressure below 15 psi', categoryId: 'fluid-leak' },
    { text: 'Oil pressure indicator did not illuminate at start', categoryId: 'electrical' },
    { text: 'Oil pressure indicator stays on after start', categoryId: 'electrical' },
  ],
  'm1078-b-015': [
    { text: 'Tachometer reads outside 750-850 rpm at idle', categoryId: 'unusual-noise' },
    { text: 'Tachometer inoperative', categoryId: 'electrical' },
  ],
  'm1078-b-016': [
    { text: 'Water temp in red zone — high temp indicator on', categoryId: 'fluid-leak' },
    { text: 'Engine overheating', categoryId: 'fluid-leak' },
    { text: 'Engine fan running continuously', categoryId: 'unusual-noise' },
  ],
  'm1078-b-017': [
    { text: 'Air filter restriction gauge in red (>25 in.)', categoryId: 'unusual-noise' },
    { text: 'Gauge still in red after reset', categoryId: 'unusual-noise' },
    { text: 'Air filter needs service', categoryId: 'unusual-noise' },
  ],
  'm1078-b-018': [
    { text: 'Front brake air below 65 psi', categoryId: 'brake-issue' },
    { text: 'Rear brake air below 65 psi', categoryId: 'brake-issue' },
    { text: 'Brake air indicator illuminated', categoryId: 'brake-issue' },
    { text: 'Audible alarm sounding', categoryId: 'unusual-noise' },
  ],
  'm1078-b-019': [
    { text: 'Volts gage above 30 volts', categoryId: 'electrical' },
    { text: 'Volts gage below 26 volts', categoryId: 'electrical' },
    { text: 'Charging system malfunction', categoryId: 'electrical' },
  ],
  'm1078-b-020': [
    { text: 'Fuel gage inoperative', categoryId: 'electrical' },
    { text: 'Fuel gage reading does not match tank level', categoryId: 'electrical' },
  ],

  // ── LMTV M1078 Zone 4: Driving Checks ──
  'm1078-b-021': [
    { text: 'Vehicle moves with SYSTEM PARK on', categoryId: 'brake-issue' },
    { text: 'SYSTEM PARK control does not pull out', categoryId: 'brake-issue' },
    { text: 'SYSTEM PARK control does not push in', categoryId: 'brake-issue' },
  ],
  'm1078-b-022': [
    { text: 'Gear range does not operate', categoryId: 'unusual-noise' },
    { text: 'LED display shows service message', categoryId: 'electrical' },
    { text: 'Service message cannot be reset', categoryId: 'electrical' },
    { text: 'Transmission shifts erratically', categoryId: 'unusual-noise' },
  ],
  'm1078-b-023': [
    { text: 'Turn signal inoperative — left', categoryId: 'electrical' },
    { text: 'Turn signal inoperative — right', categoryId: 'electrical' },
    { text: 'Turn signal indicator not working', categoryId: 'electrical' },
  ],
  'm1078-b-024': [
    { text: 'Hazard lights switch inoperative', categoryId: 'electrical' },
    { text: 'Hazard lights do not flash', categoryId: 'electrical' },
  ],
};
