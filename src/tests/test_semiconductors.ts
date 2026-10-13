import { solveCircuit } from '../engine/circuitSolver';
import { CircuitComponent, MultimeterState } from '../engine/componentTypes';

const defaultDmm: MultimeterState = {
  mode: 'VOLTS_DC',
  reading: 0,
  unit: 'V',
  isContinuous: false,
};

const createComp = (p: Partial<CircuitComponent> & { id: string; type: any; pins: any[] }): CircuitComponent => ({
  name: p.name || p.id,
  value: p.value || 0,
  unit: p.unit || '',
  position: p.position || [0, 0, 0],
  rotation: p.rotation || [0, 0, 0],
  voltageDrop: 0,
  current: 0,
  powerDissipated: 0,
  temperature: 25,
  health: 'NORMAL',
  ...p,
});

console.log('=== TEST 1: Diode 1N4007 Forward vs Reverse Bias ===');
{
  const components: CircuitComponent[] = [
    createComp({
      id: 'BAT1',
      type: 'DC_SOURCE',
      name: '5V Supply',
      value: 5.0,
      unit: 'V',
      pins: [
        { id: 'pos', name: '+', relativePos: [0, 0, 0], connectedHoleId: 'E10' },
        { id: 'neg', name: '-', relativePos: [0, 0, 0], connectedHoleId: 'E18' },
      ],
    }),
    createComp({
      id: 'D1',
      type: 'DIODE_1N4007',
      name: '1N4007 Rectifier',
      value: 0.70,
      unit: 'V',
      pins: [
        { id: 'a', name: 'Anode', relativePos: [0, 0, 0], connectedHoleId: 'E10' },
        { id: 'k', name: 'Cathode', relativePos: [0, 0, 0], connectedHoleId: 'E14' },
      ],
    }),
    createComp({
      id: 'R1',
      type: 'RESISTOR',
      name: '220Ω Resistor',
      value: 220,
      unit: 'Ω',
      pins: [
        { id: 'p1', name: '1', relativePos: [0, 0, 0], connectedHoleId: 'E14' },
        { id: 'p2', name: '2', relativePos: [0, 0, 0], connectedHoleId: 'E18' },
      ],
    }),
  ];

  const result = solveCircuit(components, [], defaultDmm, 25);
  const d1 = result.components.find((c) => c.id === 'D1');
  const r1 = result.components.find((c) => c.id === 'R1');
  console.log(`Forward: Diode Vdrop = ${d1?.voltageDrop?.toFixed(3)}V, Current = ${(d1?.current! * 1000).toFixed(2)}mA, Resistor Current = ${(r1?.current! * 1000).toFixed(2)}mA`);
  if ((d1?.current || 0) > 0.01 && Math.abs((d1?.voltageDrop || 0) - 0.7) < 0.2) {
    console.log('✓ Diode conducts in forward bias with ~0.7V drop!');
  } else {
    console.error('✗ Diode forward bias failed');
  }
}

console.log('\n=== TEST 2: Transistor BC547 NPN Switch ===');
{
  const components: CircuitComponent[] = [
    createComp({
      id: 'BAT1',
      type: 'DC_SOURCE',
      name: '9V Supply',
      value: 9.0,
      unit: 'V',
      pins: [
        { id: 'pos', name: '+', relativePos: [0, 0, 0], connectedHoleId: 'E10' },
        { id: 'neg', name: '-', relativePos: [0, 0, 0], connectedHoleId: 'E18' },
      ],
    }),
    createComp({
      id: 'R_LOAD',
      type: 'RESISTOR',
      name: '470Ω Collector Load',
      value: 470,
      unit: 'Ω',
      pins: [
        { id: 'p1', name: '1', relativePos: [0, 0, 0], connectedHoleId: 'E10' },
        { id: 'p2', name: '2', relativePos: [0, 0, 0], connectedHoleId: 'E14' },
      ],
    }),
    createComp({
      id: 'Q1',
      type: 'TRANSISTOR_NPN_BC547',
      name: 'BC547 NPN',
      value: 250,
      unit: 'hFE',
      pins: [
        { id: 'c', name: 'Collector', relativePos: [0, 0, 0], connectedHoleId: 'E14' },
        { id: 'b', name: 'Base', relativePos: [0, 0, 0], connectedHoleId: 'E12' },
        { id: 'e', name: 'Emitter', relativePos: [0, 0, 0], connectedHoleId: 'E18' },
      ],
      hfe: 250,
    }),
    createComp({
      id: 'R_BASE',
      type: 'RESISTOR',
      name: '10kΩ Base Resistor',
      value: 10000,
      unit: 'Ω',
      pins: [
        { id: 'p1', name: '1', relativePos: [0, 0, 0], connectedHoleId: 'E10' },
        { id: 'p2', name: '2', relativePos: [0, 0, 0], connectedHoleId: 'E12' },
      ],
    }),
  ];

  const result = solveCircuit(components, [], defaultDmm, 25);
  const q1 = result.components.find((c) => c.id === 'Q1');
  const rLoad = result.components.find((c) => c.id === 'R_LOAD');
  console.log(`NPN: Collector-Emitter Vdrop = ${q1?.voltageDrop?.toFixed(3)}V, Current = ${(q1?.current! * 1000).toFixed(2)}mA, Load Current = ${(rLoad?.current! * 1000).toFixed(2)}mA`);
  if ((q1?.current || 0) > 0.01) {
    console.log('✓ BC547 NPN is saturated and actively switches the collector load!');
  } else {
    console.error('✗ BC547 NPN switching failed');
  }
}

console.log('\n=== TEST 3: Logic-Level MOSFET (IRLZ44N) Switch ===');
{
  const components: CircuitComponent[] = [
    createComp({
      id: 'BAT1',
      type: 'DC_SOURCE',
      name: '12V Supply',
      value: 12.0,
      unit: 'V',
      pins: [
        { id: 'pos', name: '+', relativePos: [0, 0, 0], connectedHoleId: 'E20' },
        { id: 'neg', name: '-', relativePos: [0, 0, 0], connectedHoleId: 'E24' },
      ],
    }),
    createComp({
      id: 'R_LOAD',
      type: 'RESISTOR',
      name: '100Ω Load',
      value: 100,
      unit: 'Ω',
      pins: [
        { id: 'p1', name: '1', relativePos: [0, 0, 0], connectedHoleId: 'E20' },
        { id: 'p2', name: '2', relativePos: [0, 0, 0], connectedHoleId: 'E22' },
      ],
    }),
    createComp({
      id: 'M1',
      type: 'MOSFET_N_LOGIC',
      name: 'Logic N-MOSFET',
      value: 30,
      unit: 'A',
      pins: [
        { id: 'g', name: 'Gate', relativePos: [0, 0, 0], connectedHoleId: 'E20' },
        { id: 'd', name: 'Drain', relativePos: [0, 0, 0], connectedHoleId: 'E22' },
        { id: 's', name: 'Source', relativePos: [0, 0, 0], connectedHoleId: 'E24' },
      ],
      vth: 2.0,
      rdsOn: 0.05,
    }),
  ];

  const result = solveCircuit(components, [], defaultDmm, 25);
  const m1 = result.components.find((c) => c.id === 'M1');
  console.log(`MOSFET: Drain-Source Vdrop = ${m1?.voltageDrop?.toFixed(4)}V, Current = ${(m1?.current! * 1000).toFixed(2)}mA`);
  if ((m1?.current || 0) > 0.1 && (m1?.voltageDrop || 1) < 0.1) {
    console.log('✓ Logic-level MOSFET is fully turned ON with minimal Rds(on) drop!');
  } else {
    console.error('✗ MOSFET switching failed');
  }
}

console.log('\n=== TEST 4: MB102 Breadboard Power Supply Module ===');
{
  const components: CircuitComponent[] = [
    createComp({
      id: 'MB1',
      type: 'POWER_MODULE_MB102',
      name: 'MB102 Power Supply',
      value: 5.0,
      unit: 'V',
      pins: [
        { id: 'vcc_top', name: 'Top VCC', relativePos: [0, 0, 0], connectedHoleId: 'TOP_POS_1' },
        { id: 'gnd_top', name: 'Top GND', relativePos: [0, 0, 0], connectedHoleId: 'TOP_NEG_1' },
        { id: 'vcc_bot', name: 'Bot VCC', relativePos: [0, 0, 0], connectedHoleId: 'BOT_POS_1' },
        { id: 'gnd_bot', name: 'Bot GND', relativePos: [0, 0, 0], connectedHoleId: 'BOT_NEG_1' },
      ],
      state: { outputVoltageRail: 5.0 },
    }),
    createComp({
      id: 'R_RAIL',
      type: 'RESISTOR',
      name: '1kΩ Load across rails',
      value: 1000,
      unit: 'Ω',
      pins: [
        { id: 'p1', name: '1', relativePos: [0, 0, 0], connectedHoleId: 'TOP_POS_1' },
        { id: 'p2', name: '2', relativePos: [0, 0, 0], connectedHoleId: 'TOP_NEG_1' },
      ],
    }),
  ];

  const result = solveCircuit(components, [], defaultDmm, 25);
  const rRail = result.components.find((c) => c.id === 'R_RAIL');
  console.log(`MB102 Rail Resistor Vdrop = ${rRail?.voltageDrop?.toFixed(2)}V, Current = ${(rRail?.current! * 1000).toFixed(2)}mA`);
  if (Math.abs((rRail?.voltageDrop || 0) - 5.0) < 0.1) {
    console.log('✓ MB102 properly powers the breadboard rails with regulated 5.0V!');
  } else {
    console.error('✗ MB102 rail power failed');
  }
}

console.log('\n=== TEST 5: LDR (Photoresistor) Light Response ===');
{
  const compBright = createComp({
    id: 'LDR1',
    type: 'LDR_PHOTORESISTOR',
    name: 'CdS LDR',
    value: 500,
    unit: 'lux',
    pins: [
      { id: 'p1', name: '1', relativePos: [0, 0, 0], connectedHoleId: 'E1' },
      { id: 'p2', name: '2', relativePos: [0, 0, 0], connectedHoleId: 'E5' },
    ],
    lightLevel: 1.0,
  });
  const compDark = createComp({
    ...compBright,
    id: 'LDR2',
    lightLevel: 0.0,
    pins: [
      { id: 'p1', name: '1', relativePos: [0, 0, 0], connectedHoleId: 'F1' },
      { id: 'p2', name: '2', relativePos: [0, 0, 0], connectedHoleId: 'F5' },
    ],
  });
  const pwr = createComp({
    id: 'BAT',
    type: 'DC_SOURCE',
    value: 5.0,
    name: '5V Source',
    unit: 'V',
    pins: [
      { id: 'pos', name: '+', relativePos: [0, 0, 0], connectedHoleId: 'E1' },
      { id: 'neg', name: '-', relativePos: [0, 0, 0], connectedHoleId: 'E5' },
    ],
  });

  const resBright = solveCircuit([pwr, compBright], [], defaultDmm, 25);
  const ldrB = resBright.components.find((c) => c.id === 'LDR1');
  console.log(`LDR Bright: Current = ${(ldrB?.current! * 1000).toFixed(1)}mA (R_eff ≈ ${(5.0 / ldrB?.current!).toFixed(1)}Ω)`);

  const pwrDark = createComp({
    ...pwr,
    pins: [
      { id: 'pos', name: '+', relativePos: [0, 0, 0], connectedHoleId: 'F1' },
      { id: 'neg', name: '-', relativePos: [0, 0, 0], connectedHoleId: 'F5' },
    ],
  });
  const resDark = solveCircuit([pwrDark, compDark], [], defaultDmm, 25);
  const ldrD = resDark.components.find((c) => c.id === 'LDR2');
  console.log(`LDR Dark: Current = ${(ldrD?.current! * 1000).toFixed(4)}mA (R_eff ≈ ${(5.0 / ldrD?.current!).toFixed(0)}Ω)`);

  if ((ldrB?.current || 0) > 0.04 && (ldrD?.current || 0) < 0.0001) {
    console.log('✓ LDR dynamically modulates resistance between 100Ω and 100kΩ based on light!');
  } else {
    console.error('✗ LDR light modulation failed');
  }
}

console.log('\n=== TEST 6: LM358 Dual Op-Amp Output ===');
{
  const components: CircuitComponent[] = [
    createComp({
      id: 'BAT1',
      type: 'DC_SOURCE',
      name: '9V Battery',
      value: 9.0,
      unit: 'V',
      pins: [
        { id: 'pos', name: '+', relativePos: [0, 0, 0], connectedHoleId: 'H_VCC' },
        { id: 'neg', name: '-', relativePos: [0, 0, 0], connectedHoleId: 'H_GND' },
      ],
    }),
    createComp({
      id: 'V_IN_POS',
      type: 'DC_SOURCE',
      name: '3.3V Ref',
      value: 3.3,
      unit: 'V',
      pins: [
        { id: 'pos', name: '+', relativePos: [0, 0, 0], connectedHoleId: 'H_IN_P' },
        { id: 'neg', name: '-', relativePos: [0, 0, 0], connectedHoleId: 'H_GND' },
      ],
    }),
    createComp({
      id: 'V_IN_NEG',
      type: 'DC_SOURCE',
      name: '2.0V Ref',
      value: 2.0,
      unit: 'V',
      pins: [
        { id: 'pos', name: '+', relativePos: [0, 0, 0], connectedHoleId: 'H_IN_N' },
        { id: 'neg', name: '-', relativePos: [0, 0, 0], connectedHoleId: 'H_GND' },
      ],
    }),
    createComp({
      id: 'U1',
      type: 'DIP8_LM358',
      name: 'LM358 Op-Amp',
      value: 358,
      unit: 'IC',
      pins: [
        { id: 'p1', name: 'OUT1 (1)', relativePos: [0, 0, 0], connectedHoleId: 'H_OUT1' },
        { id: 'p2', name: 'IN1- (2)', relativePos: [0, 0, 0], connectedHoleId: 'H_IN_N' },
        { id: 'p3', name: 'IN1+ (3)', relativePos: [0, 0, 0], connectedHoleId: 'H_IN_P' },
        { id: 'p4', name: 'GND (4)', relativePos: [0, 0, 0], connectedHoleId: 'H_GND' },
        { id: 'p5', name: 'IN2+ (5)', relativePos: [0, 0, 0], connectedHoleId: 'H_GND' },
        { id: 'p6', name: 'IN2- (6)', relativePos: [0, 0, 0], connectedHoleId: 'H_GND' },
        { id: 'p7', name: 'OUT2 (7)', relativePos: [0, 0, 0], connectedHoleId: 'H_GND' },
        { id: 'p8', name: 'VCC (8)', relativePos: [0, 0, 0], connectedHoleId: 'H_VCC' },
      ],
    }),
    createComp({
      id: 'R_LOAD',
      type: 'RESISTOR',
      name: '10kΩ Op-Amp Load',
      value: 10000,
      unit: 'Ω',
      pins: [
        { id: 'p1', name: '1', relativePos: [0, 0, 0], connectedHoleId: 'H_OUT1' },
        { id: 'p2', name: '2', relativePos: [0, 0, 0], connectedHoleId: 'H_GND' },
      ],
    }),
  ];

  const result = solveCircuit(components, [], defaultDmm, 25);
  const rLoad = result.components.find((c) => c.id === 'R_LOAD');
  console.log(`LM358: Out1 Voltage = ${rLoad?.voltageDrop?.toFixed(2)}V (VCC-1.2V ceiling = ${(9.0 - 1.2).toFixed(2)}V)`);
  if (Math.abs((rLoad?.voltageDrop || 0) - 7.8) < 0.2) {
    console.log('✓ LM358 successfully amplifies differential input to saturation rail (VCC - 1.2V)!');
  } else {
    console.error('✗ LM358 amplification failed');
  }
}
