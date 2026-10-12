// ─────────────────────────────────────────────────────────────────────────────
// OhmScript Serializer — JSON Circuit Schema, Import/Export & File Helpers
// ─────────────────────────────────────────────────────────────────────────────

import { CompiledCircuit } from './types';
import { CircuitComponent, JumperWire } from '../engine/componentTypes';
import { decompile } from './decompiler';
import { Lexer } from './lexer';
import { Parser } from './parser';
import { compile } from './compiler';

export interface OhmCircuitJSON {
  version: '1.0';
  format: 'ohmic-circuit';
  metadata: {
    title: string;
    description: string;
    author: string;
    version: string;
    createdAt: string;
    updatedAt: string;
  };
  ohmscript: string;
  simulation?: {
    ambientTemperature: number;
    simulationEnabled: boolean;
  };
  multimeter?: {
    mode: string;
    redProbeHoleId?: string;
    blackProbeHoleId?: string;
  };
  rawState?: {
    components: CircuitComponent[];
    wires: JumperWire[];
  };
}

/**
 * Serialize a live circuit or compiled circuit to a standardized JSON interchange string
 */
export function exportCircuitToJSON(
  circuit: {
    title?: string;
    description?: string;
    author?: string;
    version?: string;
    components: CircuitComponent[];
    wires: JumperWire[];
    ambientTemperature?: number;
    simulationEnabled?: boolean;
    multimeterConfig?: {
      mode: string;
      redProbeHoleId?: string;
      blackProbeHoleId?: string;
    };
    ohmscriptSource?: string;
  },
  pretty = true
): string {
  const ohmscript = circuit.ohmscriptSource || decompile(circuit.components, circuit.wires, {
    title: circuit.title,
    description: circuit.description,
    author: circuit.author,
    version: circuit.version,
    ambientTemperature: circuit.ambientTemperature,
    simulationEnabled: circuit.simulationEnabled,
  });

  const now = new Date().toISOString();
  const payload: OhmCircuitJSON = {
    version: '1.0',
    format: 'ohmic-circuit',
    metadata: {
      title: circuit.title || 'Untitled Circuit',
      description: circuit.description || '',
      author: circuit.author || 'Anonymous',
      version: circuit.version || '1.0',
      createdAt: now,
      updatedAt: now,
    },
    ohmscript,
    simulation: {
      ambientTemperature: circuit.ambientTemperature ?? 25,
      simulationEnabled: circuit.simulationEnabled ?? true,
    },
    multimeter: circuit.multimeterConfig,
    rawState: {
      components: circuit.components,
      wires: circuit.wires,
    },
  };

  return JSON.stringify(payload, null, pretty ? 2 : undefined);
}

/**
 * Import a circuit from an exported JSON file string
 */
export function importCircuitFromJSON(jsonStr: string): {
  circuit: CompiledCircuit;
  source: string;
} {
  const data = JSON.parse(jsonStr) as Partial<OhmCircuitJSON>;

  if (data.format && data.format !== 'ohmic-circuit') {
    throw new Error(`Unsupported circuit format: ${data.format}`);
  }

  // If ohmscript is present, compile it fresh
  if (data.ohmscript && typeof data.ohmscript === 'string') {
    const lexer = new Lexer(data.ohmscript);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const compiled = compile(ast);

    // Merge metadata if present
    if (data.metadata?.title && compiled.title === 'Untitled Circuit') {
      compiled.title = data.metadata.title;
    }
    if (data.metadata?.description && !compiled.description) {
      compiled.description = data.metadata.description;
    }
    if (data.metadata?.author && !compiled.author) {
      compiled.author = data.metadata.author;
    }

    return { circuit: compiled, source: data.ohmscript };
  }

  // Fallback to rawState if present
  if (data.rawState?.components && data.rawState?.wires) {
    const source = decompile(data.rawState.components, data.rawState.wires, {
      title: data.metadata?.title,
      description: data.metadata?.description,
      author: data.metadata?.author,
    });
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const compiled = compile(ast);

    return { circuit: compiled, source };
  }

  throw new Error('Invalid circuit JSON: missing ohmscript or rawState');
}

/**
 * Helper to download text to file in the browser
 */
export function downloadFile(filename: string, content: string, mimeType = 'text/plain') {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
