// ─────────────────────────────────────────────────────────────────────────────
// OhmScript Comprehensive Test Suite
// ─────────────────────────────────────────────────────────────────────────────

import { tokenize, Lexer } from './src/dsl/lexer';
import { parse, Parser } from './src/dsl/parser';
import { compile } from './src/dsl/compiler';
import { decompile } from './src/dsl/decompiler';
import { exportCircuitToJSON, importCircuitFromJSON } from './src/dsl/serializer';
import { buildCircuitFromOhmScript, buildOhmScriptFromCircuit } from './src/dsl/index';
import { getPresetCircuits } from './src/presets/sampleCircuits';

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`  ✅ ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ FAILED: ${msg}`);
    failed++;
  }
}

console.log('🧪 Testing OhmScript DSL Suite...\n');

// ── Test 1: Lexer ────────────────────────────────────────────────────────────
console.log('1. Lexer & Tokenizer:');
const sampleOhm = `
# Test circuit
@circuit "Test 101"
@temp 30
bat BAT1 9V
res R1 470 maxP=0.25W
led LED1 red Vf=1.9V
place BAT1 bench
place R1 E15-E19
place LED1 D19-D20
wire BAT1.pos -> TOP_POS_10 red
wire TOP_POS_10 -> A15 red
set R1.value 500
probe red TOP_POS_10
@probe_mode VOLTS_DC
`;

const lexResult = tokenize(sampleOhm);
assert(lexResult.errors.length === 0, 'Lexer produces 0 errors on valid code');
assert(lexResult.tokens.length > 20, `Tokenized ${lexResult.tokens.length} tokens`);
assert(lexResult.tokens.some(t => t.value === '@circuit'), 'Contains @circuit directive');
assert(lexResult.tokens.some(t => t.value === 'BAT1'), 'Contains BAT1 identifier');

// ── Test 2: Parser ───────────────────────────────────────────────────────────
console.log('\n2. Recursive-descent Parser:');
const ast = parse(sampleOhm);
assert(ast.errors.length === 0, 'Parser produces 0 errors');
assert(ast.nodes.length >= 10, `Parsed ${ast.nodes.length} AST nodes`);

const directives = ast.nodes.filter(n => n.kind === 'directive');
assert(directives.length === 3, 'Found 3 directives (@circuit, @temp, @probe_mode)');

const components = ast.nodes.filter(n => n.kind === 'component');
assert(components.length === 3, 'Found 3 components (bat, res, led)');

const wires = ast.nodes.filter(n => n.kind === 'wire');
assert(wires.length === 2, 'Found 2 wires');

const sets = ast.nodes.filter(n => n.kind === 'set');
assert(sets.length === 1, 'Found 1 set statement');

const probes = ast.nodes.filter(n => n.kind === 'probe');
assert(probes.length === 1, 'Found 1 probe statement');

// ── Test 3: Compiler ─────────────────────────────────────────────────────────
console.log('\n3. Compiler (AST → CircuitComponent[] + JumperWire[]):');
const compiled = compile(ast);
assert(compiled.title === 'Test 101', 'Compiled title matches directive');
assert(compiled.ambientTemperature === 30, 'Compiled ambient temperature = 30°C');
assert(compiled.components.length === 3, `Compiled 3 components (got ${compiled.components.length})`);
assert(compiled.wires.length === 2, `Compiled 2 wires (got ${compiled.wires.length})`);

const compiledBat = compiled.components.find(c => c.id === 'BAT1');
assert(!!compiledBat && compiledBat.type === 'BATTERY_9V', 'Battery compiled correctly');
assert(compiledBat?.value === 9, 'Battery voltage is 9V');

const compiledRes = compiled.components.find(c => c.id === 'R1');
// Note: set R1.value 500 should override primary value 470
assert(compiledRes?.value === 500, `Resistor value updated by set command to 500 (got ${compiledRes?.value})`);
assert(compiledRes?.maxPowerRating === 0.25, 'Resistor maxPowerRating = 0.25W');

const compiledLed = compiled.components.find(c => c.id === 'LED1');
assert(compiledLed?.ledColor === 'RED', 'LED color is RED');
assert(compiledLed?.forwardVoltage === 1.9, 'LED forwardVoltage is 1.9V');

assert(compiled.multimeterConfig?.mode === 'VOLTS_DC', 'Multimeter mode is VOLTS_DC');
assert(compiled.multimeterConfig?.redProbeHoleId === 'TOP_POS_10', 'Multimeter red probe hooked to TOP_POS_10');

// ── Test 4: Decompiler ───────────────────────────────────────────────────────
console.log('\n4. Decompiler (Live Circuit → OhmScript source):');
const presets = getPresetCircuits();
for (const preset of presets) {
  const code = decompile(preset.components, preset.wires, {
    title: preset.title,
    description: preset.description,
  });
  assert(code.length > 50, `Decompiled preset "${preset.title}" into ${code.split('\n').length} lines`);
  assert(code.includes(`@circuit "${preset.title}"`), `Decompiled code includes circuit title`);
  assert(code.includes('place '), `Decompiled code includes component placements`);
}

// ── Test 5: Roundtrip Fidelity ───────────────────────────────────────────────
console.log('\n5. Roundtrip Fidelity (Preset → OhmScript → Compile):');
for (const preset of presets) {
  const source = buildOhmScriptFromCircuit(preset.components, preset.wires, {
    title: preset.title,
    description: preset.description,
  });
  const { circuit: recompiled, diagnostics } = buildCircuitFromOhmScript(source);
  assert(diagnostics.length === 0, `Roundtrip compile "${preset.title}" had 0 diagnostics`);
  assert(recompiled.components.length === preset.components.length,
    `Roundtrip "${preset.title}": component count preserved (${recompiled.components.length}/${preset.components.length})`);
  assert(recompiled.wires.length === preset.wires.length,
    `Roundtrip "${preset.title}": wire count preserved (${recompiled.wires.length}/${preset.wires.length})`);
}

// ── Test 6: JSON Serialization ──────────────────────────────────────────────
console.log('\n6. JSON Serialization & Deserialization:');
const samplePreset = presets[0];
const jsonStr = exportCircuitToJSON({
  title: samplePreset.title,
  description: samplePreset.description,
  components: samplePreset.components,
  wires: samplePreset.wires,
});
assert(jsonStr.length > 100, 'Exported JSON is valid length');

const parsedJSON = JSON.parse(jsonStr);
assert(parsedJSON.format === 'ohmic-circuit', 'JSON format tag is ohmic-circuit');
assert(parsedJSON.metadata.title === samplePreset.title, 'JSON metadata matches preset title');

const { circuit: importedCircuit, source: importedSource } = importCircuitFromJSON(jsonStr);
assert(importedCircuit.components.length === samplePreset.components.length,
  `Imported JSON circuit preserved ${importedCircuit.components.length} components`);
assert(importedCircuit.wires.length === samplePreset.wires.length,
  `Imported JSON circuit preserved ${importedCircuit.wires.length} wires`);
assert(importedSource.length > 0, 'Imported source is non-empty');

// ── Test 7: Error Recovery & Diagnostics ────────────────────────────────────
console.log('\n7. Error Recovery & Diagnostics:');
const badSource = `
@circuit "Bad Syntax"
unknown_type X1 100
place X1
wire INVALID_ARROW TOP_POS_1
res R2 10k
`;
const badAst = parse(badSource);
assert(badAst.errors.length > 0, `Parser detected ${badAst.errors.length} syntax errors gracefully`);
const badCompiled = compile(badAst);
assert(badCompiled.diagnostics.length > 0, `Compiler returned diagnostics for broken statements`);
assert(badCompiled.components.length === 1, `Compiler still successfully recovered valid components (R2)`);

console.log(`\n========================================`);
console.log(`Summary: Passed: ${passed}, Failed: ${failed}`);
console.log(`========================================\n`);

if (failed > 0) process.exit(1);
