// ─────────────────────────────────────────────────────────────────────────────
// OhmScript DSL — Token Types & Abstract Syntax Tree Interfaces
// ─────────────────────────────────────────────────────────────────────────────

// ── Token Types ──────────────────────────────────────────────────────────────
export enum TokenType {
  // Literals
  IDENTIFIER   = 'IDENTIFIER',    // BAT1, R1, LED1, E15, TOP_POS_10
  NUMBER       = 'NUMBER',        // 470, 9, 0.25, 10000
  STRING       = 'STRING',        // "Basic LED Circuit"
  COLOR_HEX    = 'COLOR_HEX',    // #ef4444

  // Keywords — Component types
  KW_BAT       = 'KW_BAT',
  KW_RES       = 'KW_RES',
  KW_LED       = 'KW_LED',
  KW_POT       = 'KW_POT',
  KW_BULB      = 'KW_BULB',
  KW_SPK       = 'KW_SPK',
  KW_SW        = 'KW_SW',
  KW_CAP       = 'KW_CAP',
  KW_IND       = 'KW_IND',
  KW_IC555     = 'KW_IC555',
  KW_SEG7      = 'KW_SEG7',
  KW_DIODE     = 'KW_DIODE',
  KW_NPN       = 'KW_NPN',
  KW_PNP       = 'KW_PNP',
  KW_MOSFET    = 'KW_MOSFET',
  KW_LDR       = 'KW_LDR',
  KW_LM358     = 'KW_LM358',
  KW_MB102     = 'KW_MB102',
  KW_BUZZER    = 'KW_BUZZER',
  KW_RELAY     = 'KW_RELAY',
  KW_SERVO     = 'KW_SERVO',
  KW_MOTOR     = 'KW_MOTOR',
  KW_SENSOR    = 'KW_SENSOR',
  KW_DISP      = 'KW_DISP',
  KW_MCU       = 'KW_MCU',
  KW_IC        = 'KW_IC',
  KW_KEYPAD    = 'KW_KEYPAD',
  KW_ENCODER   = 'KW_ENCODER',

  // Keywords — Commands
  KW_PLACE     = 'KW_PLACE',
  KW_WIRE      = 'KW_WIRE',
  KW_SET       = 'KW_SET',
  KW_PROBE     = 'KW_PROBE',

  // Keywords — Directives
  DIR_CIRCUIT     = 'DIR_CIRCUIT',
  DIR_DESCRIPTION = 'DIR_DESCRIPTION',
  DIR_AUTHOR      = 'DIR_AUTHOR',
  DIR_VERSION     = 'DIR_VERSION',
  DIR_BOARD       = 'DIR_BOARD',
  DIR_TEMP        = 'DIR_TEMP',
  DIR_SIM         = 'DIR_SIM',
  DIR_PROBE_MODE  = 'DIR_PROBE_MODE',

  // Symbols
  ARROW        = 'ARROW',         // ->
  DASH         = 'DASH',          // -
  COLON        = 'COLON',         // :
  DOT          = 'DOT',           // .
  EQUALS       = 'EQUALS',        // =
  NEWLINE      = 'NEWLINE',
  EOF          = 'EOF',

  // Special value tokens
  VALUE_WITH_UNIT = 'VALUE_WITH_UNIT', // 470Ω, 9V, 0.25W, 100uF, 10mH, 10k, 4.7k
}

// ── Token ────────────────────────────────────────────────────────────────────
export interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
}

// ── AST Node Types ───────────────────────────────────────────────────────────

export interface SourceLocation {
  line: number;
  col: number;
}

export interface DirectiveNode {
  kind: 'directive';
  name: 'circuit' | 'description' | 'author' | 'version' | 'board' | 'temp' | 'sim' | 'probe_mode';
  value: string;
  loc: SourceLocation;
}

export interface ComponentOption {
  key: string;   // e.g., "maxP", "Vf", "wiper", "electrolytic", "ceramic"
  value: string;  // e.g., "0.25W", "1.9V", "0.5"
}

export interface ComponentNode {
  kind: 'component';
  componentType: string;  // "bat", "res", "led", "pot", "bulb", "spk", "sw", "cap", "ind", "ic555", "seg7"
  id: string;             // "BAT1", "R1", etc.
  primaryValue: string;   // "9V", "470", "red", "tactile", "100uF"
  options: ComponentOption[];
  loc: SourceLocation;
}

export interface PlacementNode {
  kind: 'placement';
  componentId: string;
  location: string;       // "bench", "E15-E19", "E10:E11:E12"
  loc: SourceLocation;
}

export interface WireNode {
  kind: 'wire';
  from: string;           // "BAT1.pos", "TOP_POS_10", "A15"
  to: string;             // "TOP_POS_10", "A15"
  color?: string;         // "red", "#ef4444"
  loc: SourceLocation;
}

export interface SetNode {
  kind: 'set';
  target: string;         // "POT1.wiper", "SW1.closed"
  value: string;          // "0.5", "false", "true"
  loc: SourceLocation;
}

export interface ProbeNode {
  kind: 'probe';
  probeColor: 'red' | 'black';
  holeId: string;
  loc: SourceLocation;
}

export type ASTNode =
  | DirectiveNode
  | ComponentNode
  | PlacementNode
  | WireNode
  | SetNode
  | ProbeNode;

export interface OhmScriptAST {
  nodes: ASTNode[];
  errors: DiagnosticMessage[];
}

// ── Diagnostics ──────────────────────────────────────────────────────────────
export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export interface DiagnosticMessage {
  severity: DiagnosticSeverity;
  message: string;
  line: number;
  col: number;
  endCol?: number;
}

// ── Compiled Output ──────────────────────────────────────────────────────────
export interface CompiledCircuit {
  title: string;
  description: string;
  author: string;
  version: string;
  components: import('../engine/componentTypes').CircuitComponent[];
  wires: import('../engine/componentTypes').JumperWire[];
  ambientTemperature: number;
  simulationEnabled: boolean;
  multimeterConfig?: {
    mode: string;
    redProbeHoleId?: string;
    blackProbeHoleId?: string;
  };
  diagnostics: DiagnosticMessage[];
}

// ── Color Map ────────────────────────────────────────────────────────────────
export const COLOR_NAME_MAP: Record<string, string> = {
  red:    '#ef4444',
  black:  '#18181b',
  blue:   '#2563eb',
  green:  '#22c55e',
  orange: '#f4a261',
  yellow: '#eab308',
  white:  '#e4e4e7',
  teal:   '#2a9d8f',
  purple: '#a855f7',
};

// ── Component Keyword Map ────────────────────────────────────────────────────
export const COMPONENT_KEYWORDS: Record<string, TokenType> = {
  bat:    TokenType.KW_BAT,
  res:    TokenType.KW_RES,
  led:    TokenType.KW_LED,
  pot:    TokenType.KW_POT,
  bulb:   TokenType.KW_BULB,
  spk:    TokenType.KW_SPK,
  sw:     TokenType.KW_SW,
  cap:    TokenType.KW_CAP,
  ind:    TokenType.KW_IND,
  ic555:  TokenType.KW_IC555,
  seg7:   TokenType.KW_SEG7,
  diode:  TokenType.KW_DIODE,
  npn:    TokenType.KW_NPN,
  pnp:    TokenType.KW_PNP,
  mosfet: TokenType.KW_MOSFET,
  ldr:    TokenType.KW_LDR,
  lm358:   TokenType.KW_LM358,
  mb102:   TokenType.KW_MB102,
  buzzer:  TokenType.KW_BUZZER,
  relay:   TokenType.KW_RELAY,
  servo:   TokenType.KW_SERVO,
  motor:   TokenType.KW_MOTOR,
  sensor:  TokenType.KW_SENSOR,
  disp:    TokenType.KW_DISP,
  mcu:     TokenType.KW_MCU,
  ic:      TokenType.KW_IC,
  keypad:  TokenType.KW_KEYPAD,
  encoder: TokenType.KW_ENCODER,
};

export const COMMAND_KEYWORDS: Record<string, TokenType> = {
  place: TokenType.KW_PLACE,
  wire:  TokenType.KW_WIRE,
  set:   TokenType.KW_SET,
  probe: TokenType.KW_PROBE,
};
