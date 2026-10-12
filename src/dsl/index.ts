// ─────────────────────────────────────────────────────────────────────────────
// OhmScript — Domain-Specific Language for Ohmic Circuit Engine
// ─────────────────────────────────────────────────────────────────────────────

export * from './types';
export * from './lexer';
export * from './parser';
export * from './compiler';
export * from './decompiler';
export * from './serializer';

import { Lexer } from './lexer';
import { Parser } from './parser';
import { compile } from './compiler';
import { decompile } from './decompiler';
import { CompiledCircuit, DiagnosticMessage } from './types';
import { CircuitComponent, JumperWire } from '../engine/componentTypes';

/**
 * Convenience single-call function: Parse and compile OhmScript source directly
 */
export function buildCircuitFromOhmScript(source: string): {
  circuit: CompiledCircuit;
  diagnostics: DiagnosticMessage[];
} {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const circuit = compile(ast);

  return {
    circuit,
    diagnostics: circuit.diagnostics,
  };
}

/**
 * Convenience single-call function: Decompile visual circuit directly to OhmScript source
 */
export function buildOhmScriptFromCircuit(
  components: CircuitComponent[],
  wires: JumperWire[],
  options?: {
    title?: string;
    description?: string;
    author?: string;
    version?: string;
    ambientTemperature?: number;
    simulationEnabled?: boolean;
  }
): string {
  return decompile(components, wires, options);
}
