// ─────────────────────────────────────────────────────────────────────────────
// Arduino Virtual Machine & Sketch Runtime Engine
// Simulates ATmega328P / Arduino Nano & Uno firmware execution in the browser
// ─────────────────────────────────────────────────────────────────────────────

import { ArduinoBoardState, ArduinoPinState } from './componentTypes';

export interface SketchTemplate {
  id: string;
  name: string;
  description: string;
  code: string;
}

export const ARDUINO_TEMPLATES: SketchTemplate[] = [
  {
    id: 'happy_birthday',
    name: 'Happy Birthday (Buzzer D8)',
    description: 'Plays the complete Happy Birthday melody on a passive buzzer or speaker on digital pin 8.',
    code: `// ── Happy Birthday Melody on Arduino ─────────────────
// Connect Passive Buzzer (+) to Pin 8 and (-) to GND

const int buzzerPin = 8;

// Note Frequencies in Hz
const int melody[] = {
  262, 262, 294, 262, 349, 330,
  262, 262, 294, 262, 392, 349,
  262, 262, 523, 440, 349, 330, 294,
  466, 466, 440, 349, 392, 349
};

// Note Durations in Milliseconds
const int durations[] = {
  250, 250, 500, 500, 500, 1000,
  250, 250, 500, 500, 500, 1000,
  250, 250, 500, 500, 500, 500, 1000,
  250, 250, 500, 500, 500, 1000
};

void setup() {
  pinMode(buzzerPin, OUTPUT);
  Serial.begin(9600);
  Serial.println(">>> Starting Happy Birthday melody on Pin 8!");

  for (int i = 0; i < 25; i++) {
    Serial.print("Playing note #");
    Serial.print(i + 1);
    Serial.print(" @ ");
    Serial.print(melody[i]);
    Serial.println(" Hz");

    tone(buzzerPin, melody[i]);
    delay(durations[i]);
    noTone(buzzerPin);
    delay(80); // Brief pause between notes
  }

  Serial.println(">>> Song finished! Restarting in 3 seconds...");
  delay(3000);
}

void loop() {
  // Re-run the melody in loop
  for (int i = 0; i < 25; i++) {
    tone(buzzerPin, melody[i]);
    delay(durations[i]);
    noTone(buzzerPin);
    delay(80);
  }
  delay(3000);
}
`,
  },
  {
    id: 'mario',
    name: 'Super Mario Bros Theme (Buzzer D8)',
    description: 'Iconic 8-bit Super Mario opening tune played on Pin 8.',
    code: `// ── Super Mario Bros Theme ────────────────────────────
// Connect Passive Buzzer (+) to Pin 8 and (-) to GND

const int buzzerPin = 8;

const int melody[] = {
  660, 660, 660, 510, 660, 770, 380,
  510, 380, 320, 440, 480, 450, 430,
  380, 660, 760, 860, 700, 760, 660
};

const int durations[] = {
  150, 300, 300, 150, 300, 550, 550,
  450, 450, 450, 300, 300, 150, 300,
  200, 200, 200, 300, 150, 300, 300
};

void setup() {
  pinMode(buzzerPin, OUTPUT);
  Serial.begin(9600);
  Serial.println(">>> Super Mario Theme Starting!");

  for (int i = 0; i < 21; i++) {
    tone(buzzerPin, melody[i]);
    delay(durations[i]);
    noTone(buzzerPin);
    delay(60);
  }
}

void loop() {
  delay(2000);
  for (int i = 0; i < 21; i++) {
    tone(buzzerPin, melody[i]);
    delay(durations[i]);
    noTone(buzzerPin);
    delay(60);
  }
}
`,
  },
  {
    id: 'blink',
    name: 'Blink (Built-in LED D13)',
    description: 'Classic starter sketch. Toggles Pin 13 HIGH and LOW every second.',
    code: `// ── Arduino Blink ─────────────────────────────────────
// Toggles the onboard built-in LED (Pin 13) every second

const int ledPin = 13;

void setup() {
  pinMode(ledPin, OUTPUT);
  Serial.begin(9600);
  Serial.println("Arduino Blink initialized on Pin 13.");
}

void loop() {
  digitalWrite(ledPin, HIGH);
  Serial.println("LED ON (5V)");
  delay(1000);

  digitalWrite(ledPin, LOW);
  Serial.println("LED OFF (0V)");
  delay(1000);
}
`,
  },
  {
    id: 'button_led',
    name: 'Pushbutton & LED (D2 → D13)',
    description: 'Reads tactile button on Pin 2 with internal pullup; lights LED on Pin 13.',
    code: `// ── Pushbutton & LED ──────────────────────────────────
// Connect Tactile switch between Pin 2 and GND
// Connect LED (+) via 330Ω to Pin 13 and (-) to GND

const int buttonPin = 2;
const int ledPin = 13;

void setup() {
  pinMode(buttonPin, INPUT_PULLUP);
  pinMode(ledPin, OUTPUT);
  Serial.begin(9600);
  Serial.println("Pushbutton system ready. Press button to light LED.");
}

void loop() {
  int buttonState = digitalRead(buttonPin);

  // With INPUT_PULLUP, pressed button connects to GND (LOW)
  if (buttonState == LOW) {
    digitalWrite(ledPin, HIGH);
    Serial.println("Button Pressed -> LED ON");
  } else {
    digitalWrite(ledPin, LOW);
  }

  delay(50);
}
`,
  },
  {
    id: 'analog_serial',
    name: 'Analog Sensor & Serial Monitor (A0)',
    description: 'Reads analog voltage from potentiometer or LDR on A0 and prints to Serial.',
    code: `// ── Analog Sensor Reader ──────────────────────────────
// Connect Potentiometer wiper or LDR divider to Pin A0

const int sensorPin = A0;

void setup() {
  Serial.begin(9600);
  Serial.println("Analog Reader initialized on Pin A0.");
}

void loop() {
  int rawValue = analogRead(sensorPin);
  float voltage = rawValue * (5.0 / 1023.0);

  Serial.print("Raw: ");
  Serial.print(rawValue);
  Serial.print(" | Voltage: ");
  Serial.print(voltage);
  Serial.println(" V");

  delay(500);
}
`,
  },
  {
    id: 'blank',
    name: 'Bare Minimum / Blank Sketch',
    description: 'Empty starter template with setup() and loop().',
    code: `// ── Arduino Custom Sketch ─────────────────────────────

void setup() {
  // Put your setup code here, to run once:
  Serial.begin(9600);
  Serial.println("Arduino ready!");
}

void loop() {
  // Put your main code here, to run repeatedly:
  
  delay(100);
}
`,
  },
];

// ── C++ to JavaScript Generator Transpiler ───────────────────────────────────

export function transpileArduinoToJs(cpp: string): { js: string; error?: string } {
  try {
    let code = cpp;

    // 1. Normalize line endings and preserve string literals
    const stringLiterals: string[] = [];
    code = code.replace(/"((?:\\.|[^"\\])*)"/g, (_, str) => {
      stringLiterals.push(str);
      return `__STR_${stringLiterals.length - 1}__`;
    });

    // 2. Strip single line and multi-line comments
    code = code.replace(/\/\*[\s\S]*?\*\//g, '');
    code = code.replace(/\/\/.*$/gm, '');

    // 3. Remove #include <...> and #include "..."
    code = code.replace(/#include\s+[<"][^>"]+[>"]/g, '');

    // 4. Handle #define NAME VAL
    code = code.replace(/#define\s+([a-zA-Z0-9_]+)\s+([^\r\n]+)/g, 'const $1 = $2;');

    // 5. Replace typed array declarations:
    // e.g. const int melody[] = { 262, 262, ... }; -> let melody = [ 262, 262, ... ];
    code = code.replace(
      /(?:const\s+)?(?:unsigned\s+)?(?:int|float|double|long|bool|boolean|char|byte|uint8_t|uint16_t|uint32_t|String)\s+([a-zA-Z0-9_]+)\s*\[\s*\]\s*=\s*\{([^}]+)\};?/g,
      'let $1 = [$2];'
    );

    // 6. Replace array of fixed size without initializer:
    // int arr[10]; -> let arr = new Array(10).fill(0);
    code = code.replace(
      /(?:const\s+)?(?:unsigned\s+)?(?:int|float|double|long|bool|boolean|char|byte|uint8_t|uint16_t|uint32_t|String)\s+([a-zA-Z0-9_]+)\s*\[\s*(\d+)\s*\]\s*;/g,
      'let $1 = new Array($2).fill(0);'
    );

    // 7. Replace typed variable declarations:
    // const int buzzerPin = 8; -> let buzzerPin = 8;
    code = code.replace(
      /(?:const\s+)?(?:unsigned\s+)?(?:int|float|double|long|bool|boolean|char|byte|uint8_t|uint16_t|uint32_t|String)\s+([a-zA-Z0-9_]+)\s*(=|;)/g,
      'let $1 $2'
    );

    // 8. Replace void setup() and void loop() with generator functions
    code = code.replace(/void\s+setup\s*\(\s*\)/g, 'function* setup()');
    code = code.replace(/void\s+loop\s*\(\s*\)/g, 'function* loop()');

    // 9. Replace custom functions: void myFunc(...) or int myFunc(...) -> function* myFunc(...)
    code = code.replace(
      /(?:void|(?:unsigned\s+)?(?:int|float|double|long|bool|boolean|char|String))\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*\{/g,
      (match, fnName, rawArgs) => {
        if (fnName === 'setup' || fnName === 'loop') return match;
        const cleanArgs = rawArgs
          .split(',')
          .map((a: string) => a.trim().replace(/^.*?\s+([a-zA-Z0-9_]+)$/, '$1'))
          .filter(Boolean)
          .join(', ');
        return `function* ${fnName}(${cleanArgs}) {`;
      }
    );

    // 10. Replace delay(ms) and delayMicroseconds(us) with yield operations
    code = code.replace(/delay\s*\(\s*([^)]+)\s*\)\s*;/g, 'yield { op: "delay", ms: Number($1) };');
    code = code.replace(/delayMicroseconds\s*\(\s*([^)]+)\s*\)\s*;/g, 'yield { op: "delay", ms: Number($1) / 1000 };');

    // 11. Restore string literals
    code = code.replace(/__STR_(\d+)__/g, (_, idx) => {
      const original = stringLiterals[parseInt(idx, 10)] ?? '';
      return JSON.stringify(original);
    });

    // 12. Wrap inside runner generator factory
    const wrapped = `
      return function*(ctx) {
        with (ctx) {
          ${code}

          if (typeof setup === 'function') {
            yield* setup();
          }

          while (true) {
            if (typeof loop === 'function') {
              yield* loop();
            }
            yield { op: 'tick' };
          }
        }
      };
    `;

    return { js: wrapped };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { js: '', error: `Syntax error in Arduino code: ${message}` };
  }
}

// ── Arduino Virtual Machine Instance ─────────────────────────────────────────

export class ArduinoVM {
  public id: string;
  public sourceCode: string = '';
  public isCompiled: boolean = false;
  public isRunning: boolean = true;
  public compileError?: string;
  public serialBuffer: string[] = [];
  public virtualMillis: number = 0;

  // Pin state registry (D0..D13, A0..A7)
  public pins: Record<string, ArduinoPinState> = {};

  private generator: Generator<{ op: string; ms?: number }, void, unknown> | null = null;
  private delayRemainingMs: number = 0;
  private activeTonePin: string | null = null;
  private activeToneFreq: number = 0;

  constructor(id: string, initialCode?: string) {
    this.id = id;
    this.initPins();
    this.loadCode(initialCode || ARDUINO_TEMPLATES[0].code);
  }

  private initPins() {
    // Standard Arduino Pins
    const pinNames = [
      '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13',
      'D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12', 'D13',
      'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7',
    ];
    this.pins = {};
    for (const name of pinNames) {
      this.pins[name] = {
        mode: 'INPUT',
        digitalValue: false,
        analogValue: 0,
        toneFreq: 0,
        inputVoltage: 0,
      };
    }
  }

  public normalizePin(pin: string | number): string {
    const p = String(pin).trim().toUpperCase();
    if (/^\d+$/.test(p)) return `D${p}`;
    return p;
  }

  public loadCode(cpp: string) {
    this.sourceCode = cpp;
    const { js, error } = transpileArduinoToJs(cpp);

    if (error) {
      this.isCompiled = false;
      this.compileError = error;
      this.generator = null;
      return false;
    }

    try {
      // Test compilation by creating Function
      const factory = new Function(js)();
      this.isCompiled = true;
      this.compileError = undefined;

      // Reset runtime state and start generator
      this.reset();
      this.generator = factory(this.createContext());
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.isCompiled = false;
      this.compileError = `Compilation error: ${message}`;
      this.generator = null;
      return false;
    }
  }

  public reset() {
    this.initPins();
    this.delayRemainingMs = 0;
    this.activeTonePin = null;
    this.activeToneFreq = 0;
    this.virtualMillis = 0;
    this.serialBuffer.push(`\n--- Arduino Reset @ ${new Date().toLocaleTimeString()} ---`);

    if (this.sourceCode) {
      const { js } = transpileArduinoToJs(this.sourceCode);
      if (js) {
        try {
          const factory = new Function(js)();
          this.generator = factory(this.createContext());
          this.isCompiled = true;
          this.compileError = undefined;
        } catch {}
      }
    }
  }

  private createContext() {
    return {
      HIGH: 1,
      LOW: 0,
      INPUT: 'INPUT',
      OUTPUT: 'OUTPUT',
      INPUT_PULLUP: 'INPUT_PULLUP',
      LED_BUILTIN: 13,
      A0: 'A0',
      A1: 'A1',
      A2: 'A2',
      A3: 'A3',
      A4: 'A4',
      A5: 'A5',
      A6: 'A6',
      A7: 'A7',

      pinMode: (pin: string | number, mode: 'INPUT' | 'OUTPUT' | 'INPUT_PULLUP') => {
        const norm = this.normalizePin(pin);
        if (this.pins[norm]) this.pins[norm].mode = mode;
        const numOnly = norm.replace(/^D/, '');
        if (this.pins[numOnly]) this.pins[numOnly].mode = mode;
      },

      digitalWrite: (pin: string | number, val: number | boolean) => {
        const norm = this.normalizePin(pin);
        const isHigh = Boolean(val);
        if (this.pins[norm]) this.pins[norm].digitalValue = isHigh;
        const numOnly = norm.replace(/^D/, '');
        if (this.pins[numOnly]) this.pins[numOnly].digitalValue = isHigh;
      },

      digitalRead: (pin: string | number): number => {
        const norm = this.normalizePin(pin);
        const pinState = this.pins[norm];
        if (!pinState) return 0;
        return pinState.inputVoltage >= 2.5 ? 1 : 0;
      },

      analogWrite: (pin: string | number, val: number) => {
        const norm = this.normalizePin(pin);
        const clamped = Math.max(0, Math.min(255, Math.round(Number(val))));
        if (this.pins[norm]) {
          this.pins[norm].analogValue = clamped;
          this.pins[norm].digitalValue = clamped > 127;
        }
        const numOnly = norm.replace(/^D/, '');
        if (this.pins[numOnly]) {
          this.pins[numOnly].analogValue = clamped;
          this.pins[numOnly].digitalValue = clamped > 127;
        }
      },

      analogRead: (pin: string | number): number => {
        const norm = this.normalizePin(pin);
        const pinState = this.pins[norm];
        if (!pinState) return 0;
        const v = Math.max(0, Math.min(5.0, pinState.inputVoltage));
        return Math.round((v / 5.0) * 1023);
      },

      tone: (pin: string | number, freq: number, _duration?: number) => {
        const norm = this.normalizePin(pin);
        const f = Math.max(20, Math.min(20000, Math.round(Number(freq))));
        this.activeTonePin = norm;
        this.activeToneFreq = f;
        if (this.pins[norm]) {
          this.pins[norm].toneFreq = f;
          this.pins[norm].digitalValue = true;
        }
        const numOnly = norm.replace(/^D/, '');
        if (this.pins[numOnly]) {
          this.pins[numOnly].toneFreq = f;
          this.pins[numOnly].digitalValue = true;
        }
      },

      noTone: (pin: string | number) => {
        const norm = this.normalizePin(pin);
        if (this.activeTonePin === norm) {
          this.activeTonePin = null;
          this.activeToneFreq = 0;
        }
        if (this.pins[norm]) {
          this.pins[norm].toneFreq = 0;
          this.pins[norm].digitalValue = false;
        }
        const numOnly = norm.replace(/^D/, '');
        if (this.pins[numOnly]) {
          this.pins[numOnly].toneFreq = 0;
          this.pins[numOnly].digitalValue = false;
        }
      },

      millis: (): number => this.virtualMillis,
      micros: (): number => this.virtualMillis * 1000,

      Serial: {
        begin: (_baud: number) => {},
        print: (val: any) => {
          const str = String(val);
          if (this.serialBuffer.length === 0) {
            this.serialBuffer.push(str);
          } else {
            this.serialBuffer[this.serialBuffer.length - 1] += str;
          }
          if (this.serialBuffer.length > 500) this.serialBuffer.shift();
        },
        println: (val?: any) => {
          const str = val !== undefined ? String(val) : '';
          this.serialBuffer.push(str);
          if (this.serialBuffer.length > 500) this.serialBuffer.shift();
        },
        write: (ch: any) => {
          this.serialBuffer.push(String(ch));
        },
      },

      map: (val: number, inMin: number, inMax: number, outMin: number, outMax: number) =>
        ((val - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin,
      constrain: (val: number, min: number, max: number) => Math.min(max, Math.max(min, val)),
      random: (minOrMax: number, maybeMax?: number) => {
        if (maybeMax !== undefined) {
          return Math.floor(Math.random() * (maybeMax - minOrMax)) + minOrMax;
        }
        return Math.floor(Math.random() * minOrMax);
      },
      min: Math.min,
      max: Math.max,
      abs: Math.abs,
      sqrt: Math.sqrt,
      pow: Math.pow,
    };
  }

  // Called in each simulation step (e.g. every 50ms)
  public step(elapsedMs: number, inputPinVoltages: Record<string, number>): ArduinoBoardState {
    this.virtualMillis += elapsedMs;

    // Update pin input voltages measured by circuit solver
    for (const [pin, v] of Object.entries(inputPinVoltages)) {
      const norm = this.normalizePin(pin);
      if (this.pins[norm]) this.pins[norm].inputVoltage = v;
      const numOnly = norm.replace(/^D/, '');
      if (this.pins[numOnly]) this.pins[numOnly].inputVoltage = v;
    }

    if (!this.isRunning || !this.generator) {
      return this.getState();
    }

    // Handle ongoing delay()
    if (this.delayRemainingMs > 0) {
      this.delayRemainingMs -= elapsedMs;
      if (this.delayRemainingMs > 0) {
        return this.getState();
      }
    }

    // Step generator until next delay or end
    try {
      let stepsInTick = 0;
      while (stepsInTick++ < 200) {
        const next = this.generator.next();
        if (next.done) {
          break;
        }
        if (next.value && typeof next.value === 'object') {
          if (next.value.op === 'delay' && next.value.ms) {
            this.delayRemainingMs = next.value.ms;
            break;
          }
          if (next.value.op === 'tick') {
            break;
          }
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.compileError = `Runtime Exception: ${message}`;
      this.generator = null;
    }

    return this.getState();
  }

  public getState(): ArduinoBoardState {
    return {
      sourceCode: this.sourceCode,
      isCompiled: this.isCompiled,
      isRunning: this.isRunning,
      compileError: this.compileError,
      serialBuffer: [...this.serialBuffer],
      activeToneFreq: this.activeToneFreq,
      pins: { ...this.pins },
      virtualMillis: this.virtualMillis,
    };
  }

  public sendSerialInput(input: string) {
    this.serialBuffer.push(`> ${input}`);
  }

  public clearSerial() {
    this.serialBuffer = [];
  }
}

// ── Global MCU VM Registry ───────────────────────────────────────────────────

const arduinoRegistry = new Map<string, ArduinoVM>();

export function getArduinoVM(mcuId: string, initialCode?: string): ArduinoVM {
  let vm = arduinoRegistry.get(mcuId);
  if (!vm) {
    vm = new ArduinoVM(mcuId, initialCode);
    arduinoRegistry.set(mcuId, vm);
  }
  return vm;
}

export function resetAllArduinoVMs() {
  for (const vm of arduinoRegistry.values()) {
    vm.reset();
  }
}
