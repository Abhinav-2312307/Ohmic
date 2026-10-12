export type ComponentType =
  | 'RESISTOR'
  | 'CAPACITOR_ELECTROLYTIC'
  | 'CAPACITOR_CERAMIC'
  | 'INDUCTOR_TOROID'
  | 'LED'
  | 'BULB_INCANDESCENT'
  | 'POTENTIOMETER'
  | 'SPEAKER'
  | 'BATTERY_9V'
  | 'DC_SOURCE'
  | 'SWITCH_TACTILE'
  | 'SWITCH_TOGGLE'
  | 'DIP8_555'
  | 'DISPLAY_7SEG'
  | 'DIODE_1N4148'
  | 'DIODE_1N4007'
  | 'TRANSISTOR_NPN_BC547'
  | 'TRANSISTOR_PNP_BC557'
  | 'TRANSISTOR_NPN_2N2222'
  | 'MOSFET_N_LOGIC'
  | 'LDR_PHOTORESISTOR'
  | 'DIP8_LM358'
  | 'POWER_MODULE_MB102';

export type ComponentHealth = 'NORMAL' | 'WARM' | 'OVERHEATING' | 'BURNED_OUT';

export interface ComponentPin {
  id: string;
  name: string;
  relativePos: [number, number, number]; // [x, y, z] in local meters
  connectedHoleId?: string; // e.g. "C12", "TOP_POS_5", etc.
  connectedNodeId?: number;
}

export interface CircuitComponent {
  id: string;
  type: ComponentType;
  name: string;
  position: [number, number, number]; // [x, y, z] in 3D world meters
  rotation: [number, number, number]; // e.g. [0, Math.PI/2, 0]
  modelUrl?: string;
  pins: ComponentPin[];
  
  // Electrical Parameters
  value: number; // e.g., Ohms for resistor, Volts for battery, Farads for cap, etc.
  unit: string;  // e.g. "Ω", "V", "µF", "mH", "W"
  maxPowerRating?: number; // Watts (e.g. 0.25W for standard 1/4W resistor)
  maxVoltageRating?: number; // Volts
  forwardVoltage?: number; // for LED / Diode (e.g. 2.0V for Red, 3.2V for Blue)
  ledColor?: 'RED' | 'GREEN' | 'BLUE' | 'YELLOW' | 'WHITE';
  diodeThreshold?: number; // Forward conduction drop (e.g. 0.7V for 1N4007, 0.72V for 1N4148)
  hfe?: number; // DC current gain beta for BJTs (e.g. 200 for BC547, 100 for 2N2222)
  vth?: number; // Gate threshold voltage for MOSFETs (e.g. 2.0V)
  rdsOn?: number; // On-state channel resistance for MOSFETs (e.g. 0.05Ω)
  lightLevel?: number; // 0.0 (dark) to 1.0 (bright) for LDR
  
  // Dynamic Simulation Metrics
  voltageDrop: number; // V
  current: number;     // A
  powerDissipated: number; // W
  temperature: number; // °C
  health: ComponentHealth;
  isEmitting?: boolean; // For LED / Bulb
  emissionIntensity?: number; // 0.0 to 1.0 (or > 1 for HDR overdriving)
  
  // Specific interactive states
  state?: {
    isClosed?: boolean; // For switches
    wiperRatio?: number; // 0.0 to 1.0 for Potentiometer
    activeSegments?: boolean[]; // For 7-segment display (A, B, C, D, E, F, G, DP)
    frequency?: number; // For speaker / oscillator
    outputVoltageRail?: 3.3 | 5.0; // For MB102 Power Supply module
    timerState?: { flipFlop: boolean; lastTriggerTime: number }; // For 555 timer
    opAmpGain?: number; // For LM358 (open loop gain ~100000)
  };
}

export interface JumperWire {
  id: string;
  startHoleId: string;
  endHoleId: string;
  startPos: [number, number, number];
  endPos: [number, number, number];
  color: string;
  current: number; // Live current flowing through wire
  voltage: number; // Node voltage
}

export interface MultimeterState {
  mode: 'VOLTS_DC' | 'VOLTS_AC' | 'CURRENT_MA' | 'RESISTANCE' | 'CONTINUITY';
  redProbeHoleId?: string;
  blackProbeHoleId?: string;
  reading: number;
  unit: string;
  isContinuous: boolean;
}

export interface BreadboardHole {
  id: string;
  column: number; // 1 to 63
  row: string;    // 'A','B','C','D','E','F','G','H','I','J' or 'TOP_POS','TOP_NEG','BOT_POS','BOT_NEG'
  x: number;      // 3D coordinate in meters
  y: number;
  z: number;
  nodeGroup: string; // The internal clip identifier
  currentVoltage: number;
}
