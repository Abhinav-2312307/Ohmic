export type ComponentType =
  | 'RESISTOR'
  | 'CAPACITOR_ELECTROLYTIC'
  | 'CAPACITOR_CERAMIC'
  | 'CAPACITOR_FILM'
  | 'INDUCTOR_TOROID'
  | 'LED'
  | 'LED_RGB'
  | 'BULB_INCANDESCENT'
  | 'POTENTIOMETER'
  | 'SPEAKER'
  | 'BUZZER_ACTIVE'
  | 'BUZZER_PASSIVE'
  | 'BATTERY_9V'
  | 'BATTERY_HOLDER_4AA'
  | 'DC_SOURCE'
  | 'SWITCH_TACTILE'
  | 'SWITCH_TOGGLE'
  | 'SWITCH_SLIDE'
  | 'ROTARY_ENCODER_KY040'
  | 'KEYPAD_4X4'
  | 'DIP8_555'
  | 'DIP8_LM358'
  | 'DIP8_LM393'
  | 'DIP16_CD4017'
  | 'DIP16_74HC595'
  | 'DIP16_L293D'
  | 'MODULE_TB6612FNG'
  | 'DISPLAY_7SEG'
  | 'DISPLAY_OLED_I2C'
  | 'DISPLAY_LCD_1602_I2C'
  | 'DIODE_1N4148'
  | 'DIODE_1N4007'
  | 'TRANSISTOR_NPN_BC547'
  | 'TRANSISTOR_PNP_BC557'
  | 'TRANSISTOR_NPN_2N2222'
  | 'MOSFET_N_LOGIC'
  | 'MOSFET_DRIVER_MODULE'
  | 'LDR_PHOTORESISTOR'
  | 'SENSOR_HC_SR04'
  | 'SENSOR_DHT22'
  | 'SENSOR_PIR'
  | 'SENSOR_SOUND'
  | 'SENSOR_SOIL'
  | 'SENSOR_IR_RECEIVER'
  | 'SENSOR_HALL'
  | 'SERVO_SG90'
  | 'DC_GEAR_MOTOR'
  | 'RELAY_MODULE_5V'
  | 'WS2812B_STRIP'
  | 'ARDUINO_NANO'
  | 'ARDUINO_UNO_R3'
  | 'ESP32_DEVKIT'
  | 'POWER_MODULE_MB102'
  | 'REGULATOR_AMS1117_3V3'
  | 'SCREW_TERMINAL_2P'
  | 'IC_SOCKET_DIP'
  | 'TOOL_SOLDERING_IRON';

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
  isEmitting?: boolean; // For LED / Bulb / Indicators
  emissionIntensity?: number; // 0.0 to 1.0 (or > 1 for HDR overdriving)
  
  // Specific interactive & digital logic states
  state?: {
    isClosed?: boolean; // For switches / relays
    wiperRatio?: number; // 0.0 to 1.0 for Potentiometer
    activeSegments?: boolean[]; // For 7-segment display (A, B, C, D, E, F, G, DP)
    frequency?: number; // For speaker / oscillator / buzzers
    outputVoltageRail?: 3.3 | 5.0; // For MB102 Power Supply module
    timerState?: { flipFlop: boolean; lastTriggerTime: number }; // For 555 timer
    opAmpGain?: number; // For LM358
    comparatorState?: boolean; // For LM393
    counterIndex?: number; // For CD4017 (0 to 9)
    lastClkHigh?: boolean; // For CD4017 clock edge detection
    shiftRegisterBits?: number; // For 74HC595 (8 bits output byte 0-255)
    motorRpm?: number; // For DC gear motors (live RPM)
    motorDirection?: 'CW' | 'CCW' | 'STOP';
    servoAngle?: number; // For SG90 servo (0° to 180°)
    relayEnergized?: boolean; // For 5V relay module
    distanceCm?: number; // For HC-SR04 ultrasonic sensor (2 to 400 cm)
    temperatureC?: number; // For DHT22 sensor
    humidityPct?: number; // For DHT22 sensor
    motionDetected?: boolean; // For PIR sensor
    soundLevel?: number; // For Sound sensor
    moistureLevel?: number; // For Soil sensor (0 to 100%)
    magneticDetected?: boolean; // For Hall-effect sensor
    irCode?: string; // For IR receiver
    oledLines?: string[]; // For 0.96" OLED display
    lcdLines?: [string, string]; // For 16x2 LCD display
    rgbColor?: [number, number, number]; // [r, g, b] 0-255 for RGB LED & WS2812B
    encoderPosition?: number; // For KY-040 rotary encoder
    keypadKey?: string; // For 4x4 Keypad
    arduinoState?: ArduinoBoardState; // For Arduino Nano / Uno programmable firmware
  };
}

export interface ArduinoPinState {
  mode: 'INPUT' | 'OUTPUT' | 'INPUT_PULLUP';
  digitalValue: boolean;
  analogValue: number;
  toneFreq: number;
  inputVoltage: number;
}

export interface ArduinoBoardState {
  sourceCode: string;
  isCompiled: boolean;
  isRunning: boolean;
  compileError?: string;
  serialBuffer: string[];
  activeToneFreq?: number;
  pins: Record<string, ArduinoPinState>;
  virtualMillis?: number;
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
