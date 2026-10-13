import { CircuitComponent, JumperWire, MultimeterState } from './componentTypes';
import { BREADBOARD_HOLES } from './breadboardModel';

export interface SolverResult {
  nodeVoltages: Map<number, number>;
  holeVoltages: Map<string, number>;
  components: CircuitComponent[];
  wires: JumperWire[];
  multimeter: MultimeterState;
  hasShortCircuit: boolean;
  totalPowerDrawn: number;
}

// Disjoint Set Union (Union-Find) for electrical nets
class UnionFind {
  parent: Map<string, string> = new Map();

  find(id: string): string {
    if (!this.parent.has(id)) {
      this.parent.set(id, id);
      return id;
    }
    if (this.parent.get(id) !== id) {
      this.parent.set(id, this.find(this.parent.get(id)!));
    }
    return this.parent.get(id)!;
  }

  union(idA: string, idB: string) {
    const rootA = this.find(idA);
    const rootB = this.find(idB);
    if (rootA !== rootB) {
      this.parent.set(rootA, rootB);
    }
  }
}

// Robust semiconductor pin matching helpers
export const getDiodePins = (comp: CircuitComponent) => {
  const anode = comp.pins.find((p) => {
    const n = (p.name || '').toUpperCase();
    const id = (p.id || '').toLowerCase();
    return n.includes('ANODE') || n === 'A' || n === '+' || id === 'a' || id === 'pos' || id === 'l1' || id === 'd1' || id === 'p1';
  });
  const cathode = comp.pins.find((p) => {
    const n = (p.name || '').toUpperCase();
    const id = (p.id || '').toLowerCase();
    return n.includes('CATHODE') || n === 'K' || n === '-' || id === 'k' || id === 'neg' || id === 'l2' || id === 'd2' || id === 'p2';
  });
  return { anode, cathode };
};

export const getBjtPins = (comp: CircuitComponent) => {
  const pinC = comp.pins.find((p) => {
    const n = (p.name || '').toUpperCase();
    const id = (p.id || '').toLowerCase();
    return n.includes('COLLECTOR') || n === 'C' || id === 'c' || id === 'p1';
  });
  const pinB = comp.pins.find((p) => {
    const n = (p.name || '').toUpperCase();
    const id = (p.id || '').toLowerCase();
    return n.includes('BASE') || n === 'B' || id === 'b' || id === 'p2';
  });
  const pinE = comp.pins.find((p) => {
    const n = (p.name || '').toUpperCase();
    const id = (p.id || '').toLowerCase();
    return n.includes('EMITTER') || n === 'E' || id === 'e' || id === 'p3';
  });
  return { pinC, pinB, pinE };
};

export const getMosfetPins = (comp: CircuitComponent) => {
  const pinG = comp.pins.find((p) => {
    const n = (p.name || '').toUpperCase();
    const id = (p.id || '').toLowerCase();
    return n.includes('GATE') || n === 'G' || id === 'g' || id === 'p1';
  });
  const pinD = comp.pins.find((p) => {
    const n = (p.name || '').toUpperCase();
    const id = (p.id || '').toLowerCase();
    return n.includes('DRAIN') || n === 'D' || id === 'd' || id === 'p2';
  });
  const pinS = comp.pins.find((p) => {
    const n = (p.name || '').toUpperCase();
    const id = (p.id || '').toLowerCase();
    return n.includes('SOURCE') || n === 'S' || id === 's' || id === 'p3';
  });
  return { pinG, pinD, pinS };
};

export function solveCircuit(
  components: CircuitComponent[],
  wires: JumperWire[],
  multimeter: MultimeterState,
  ambientTemperature: number = 25
): SolverResult {
  const uf = new UnionFind();

  // 1. Unify all holes within their internal breadboard tie-clips
  BREADBOARD_HOLES.forEach((hole) => {
    uf.union(hole.id, hole.nodeGroup);
  });

  // 2. Unify nodes connected by jumper wires
  wires.forEach((wire) => {
    if (wire.startHoleId && wire.endHoleId) {
      uf.union(wire.startHoleId, wire.endHoleId);
    }
  });

  // 3. Map connected nets to numeric Node IDs (0 = Ground, 1..N)
  const netRoots = new Set<string>();
  BREADBOARD_HOLES.forEach((hole) => {
    netRoots.add(uf.find(hole.id));
  });

  // Also ensure component pin nodes (such as battery terminals) and wire endpoints are included in netRoots
  components.forEach((comp) => {
    comp.pins.forEach((pin) => {
      if (pin.connectedHoleId) {
        netRoots.add(uf.find(pin.connectedHoleId));
      }
    });
  });
  wires.forEach((wire) => {
    if (wire.startHoleId) netRoots.add(uf.find(wire.startHoleId));
    if (wire.endHoleId) netRoots.add(uf.find(wire.endHoleId));
  });

  // Find preferred ground: negative terminal of power sources or negative rails
  let groundRoot = '';
  for (const comp of components) {
    if (comp.type === 'BATTERY_9V' || comp.type === 'DC_SOURCE' || comp.type === 'BATTERY_HOLDER_4AA') {
      const negPin = comp.pins.find((p) => p.name === 'NEGATIVE' || p.name === '-' || p.id === 'neg' || p.id === 'black');
      if (negPin?.connectedHoleId) {
        groundRoot = uf.find(negPin.connectedHoleId);
        break;
      }
    } else if (comp.type === 'POWER_MODULE_MB102') {
      groundRoot = uf.find('TOP_NEG_1') || uf.find('BUS_TOP_NEG');
      break;
    } else if (comp.type === 'ARDUINO_NANO' || comp.type === 'ARDUINO_UNO_R3' || comp.type === 'ESP32_DEVKIT') {
      const gndPin = comp.pins.find((p) => p.name?.includes('GND'));
      if (gndPin?.connectedHoleId) {
        groundRoot = uf.find(gndPin.connectedHoleId);
        break;
      }
    }
  }
  if (!groundRoot) {
    groundRoot = uf.find('BUS_TOP_NEG') || uf.find('BUS_BOT_NEG');
  }

  const rootToNodeId = new Map<string, number>();
  rootToNodeId.set(groundRoot, 0); // Node 0 is Reference Ground

  let nextNodeId = 1;
  netRoots.forEach((root) => {
    if (root !== groundRoot) {
      rootToNodeId.set(root, nextNodeId++);
    }
  });

  const numNodes = nextNodeId; // Nodes: 0 to numNodes-1

  // Voltage source identification (requires MNA row expansion)
  interface VSourceStamp {
    nodePos: number;
    nodeNeg: number;
    voltage: number;
    index: number;
    componentId: string;
  }

  const vSources: VSourceStamp[] = [];
  let vSourceIdx = 0;

  components.forEach((comp) => {
    if (comp.health === 'BURNED_OUT') return;

    if (comp.type === 'BATTERY_9V' || comp.type === 'DC_SOURCE' || comp.type === 'BATTERY_HOLDER_4AA') {
      const pPin = comp.pins.find((p) => p.name === '+' || p.name === 'POSITIVE' || p.id === 'pos' || p.id === 'red');
      const nPin = comp.pins.find((p) => p.name === '-' || p.name === 'NEGATIVE' || p.id === 'neg' || p.id === 'black');

      if (pPin?.connectedHoleId && nPin?.connectedHoleId) {
        const rootPos = uf.find(pPin.connectedHoleId);
        const rootNeg = uf.find(nPin.connectedHoleId);
        const nodePos = rootToNodeId.get(rootPos) ?? 0;
        const nodeNeg = rootToNodeId.get(rootNeg) ?? 0;

        vSources.push({
          nodePos,
          nodeNeg,
          voltage: comp.value || (comp.type === 'BATTERY_HOLDER_4AA' ? 6.0 : 9.0),
          index: vSourceIdx++,
          componentId: comp.id,
        });
      }
    } else if (comp.type === 'REGULATOR_AMS1117_3V3') {
      const pGND = comp.pins.find((p) => p.id === 'p1' || p.name?.includes('GND'));
      const pVOUT = comp.pins.find((p) => p.id === 'p2' || p.name?.includes('OUT'));
      if (pGND?.connectedHoleId && pVOUT?.connectedHoleId) {
        const rootGnd = uf.find(pGND.connectedHoleId);
        const rootOut = uf.find(pVOUT.connectedHoleId);
        const nodeGnd = rootToNodeId.get(rootGnd) ?? 0;
        const nodeOut = rootToNodeId.get(rootOut) ?? 0;
        vSources.push({
          nodePos: nodeOut,
          nodeNeg: nodeGnd,
          voltage: 3.3,
          index: vSourceIdx++,
          componentId: `${comp.id}_reg`,
        });
      }
    } else if (comp.type === 'ARDUINO_NANO' || comp.type === 'ARDUINO_UNO_R3' || comp.type === 'ESP32_DEVKIT') {
      const pGND = comp.pins.find((p) => p.name?.includes('GND'));
      const p5V = comp.pins.find((p) => p.name?.includes('5V') || p.id === '5v');
      const p3V3 = comp.pins.find((p) => p.name?.includes('3V3') || p.name?.includes('3.3V') || p.id === '3v3');
      const rootGnd = pGND?.connectedHoleId ? uf.find(pGND.connectedHoleId) : null;
      const nodeGnd = rootGnd ? (rootToNodeId.get(rootGnd) ?? 0) : 0;

      if (p5V?.connectedHoleId && rootGnd) {
        const root5V = uf.find(p5V.connectedHoleId);
        const node5V = rootToNodeId.get(root5V) ?? 0;
        vSources.push({
          nodePos: node5V,
          nodeNeg: nodeGnd,
          voltage: 5.0,
          index: vSourceIdx++,
          componentId: `${comp.id}_5v`,
        });
      }
      if (p3V3?.connectedHoleId && rootGnd) {
        const root3V3 = uf.find(p3V3.connectedHoleId);
        const node3V3 = rootToNodeId.get(root3V3) ?? 0;
        vSources.push({
          nodePos: node3V3,
          nodeNeg: nodeGnd,
          voltage: 3.3,
          index: vSourceIdx++,
          componentId: `${comp.id}_3v3`,
        });
      }
    } else if (comp.type === 'POWER_MODULE_MB102') {
      const vOut = comp.state?.outputVoltageRail ?? (comp.value || 5.0);
      const topPosRoot = uf.find('TOP_POS_1');
      const topNegRoot = uf.find('TOP_NEG_1');
      const botPosRoot = uf.find('BOT_POS_1');
      const botNegRoot = uf.find('BOT_NEG_1');

      const nodeTopPos = rootToNodeId.get(topPosRoot) ?? 0;
      const nodeTopNeg = rootToNodeId.get(topNegRoot) ?? 0;
      const nodeBotPos = rootToNodeId.get(botPosRoot) ?? 0;
      const nodeBotNeg = rootToNodeId.get(botNegRoot) ?? 0;

      vSources.push({
        nodePos: nodeTopPos,
        nodeNeg: nodeTopNeg,
        voltage: vOut,
        index: vSourceIdx++,
        componentId: `${comp.id}_top`,
      });

      vSources.push({
        nodePos: nodeBotPos,
        nodeNeg: nodeBotNeg,
        voltage: vOut,
        index: vSourceIdx++,
        componentId: `${comp.id}_bot`,
      });
    }
  });

  // If there are no independent voltage sources, there is no energy in the circuit
  if (vSources.length === 0) {
    return generateEmptyResult(components, wires, multimeter, ambientTemperature);
  }

  const matrixSize = (numNodes - 1) + vSources.length;

  if (matrixSize <= 0) {
    // Empty or no non-ground nodes
    return generateEmptyResult(components, wires, multimeter, ambientTemperature);
  }

  // Multi-pass diode solver to determine which LEDs/Diodes are forward-conducting
  // Physical initial state is ALWAYS FALSE (non-conducting) so diodes never act as phantom energy sources
  const diodeStates = new Map<string, boolean>();
  components.forEach((comp) => {
    if (
      (comp.type === 'LED' || comp.type === 'DIODE_1N4148' || comp.type === 'DIODE_1N4007') &&
      comp.health !== 'BURNED_OUT'
    ) {
      diodeStates.set(comp.id, false); // initial guess: non-conducting
    }
  });

  let x: number[] = [];
  const maxIterations = 4;

  for (let iter = 0; iter < maxIterations; iter++) {
    // Linear system: A * x = z
    const A: number[][] = Array(matrixSize)
      .fill(0)
      .map(() => Array(matrixSize).fill(0));
    const z: number[] = Array(matrixSize).fill(0);

    // Helper to stamp conductance g between two node indices
    const stampConductance = (n1: number, n2: number, g: number) => {
      if (isNaN(g) || !isFinite(g) || g <= 0) return;
      const i1 = n1 - 1; // 1-based to 0-based index for non-ground nodes
      const i2 = n2 - 1;

      if (i1 >= 0) A[i1][i1] += g;
      if (i2 >= 0) A[i2][i2] += g;
      if (i1 >= 0 && i2 >= 0) {
        A[i1][i2] -= g;
        A[i2][i1] -= g;
      }
    };

    // Stamp components
    components.forEach((comp) => {
      if (comp.health === 'BURNED_OUT') return;

      if (comp.type === 'RESISTOR') {
        const pinA = comp.pins[0];
        const pinB = comp.pins[1];
        if (pinA?.connectedHoleId && pinB?.connectedHoleId) {
          const n1 = rootToNodeId.get(uf.find(pinA.connectedHoleId)) ?? 0;
          const n2 = rootToNodeId.get(uf.find(pinB.connectedHoleId)) ?? 0;
          const g = 1 / Math.max(0.1, comp.value);
          stampConductance(n1, n2, g);
        }
      } else if (comp.type === 'POTENTIOMETER') {
        const pin1 = comp.pins[0];
        const pinW = comp.pins[1];
        const pin2 = comp.pins[2];
        const ratio = Math.max(0.001, Math.min(0.999, comp.state?.wiperRatio ?? 0.5));

        if (pin1?.connectedHoleId && pinW?.connectedHoleId) {
          const n1 = rootToNodeId.get(uf.find(pin1.connectedHoleId)) ?? 0;
          const nw = rootToNodeId.get(uf.find(pinW.connectedHoleId)) ?? 0;
          stampConductance(n1, nw, 1 / (comp.value * ratio));
        }
        if (pinW?.connectedHoleId && pin2?.connectedHoleId) {
          const nw = rootToNodeId.get(uf.find(pinW.connectedHoleId)) ?? 0;
          const n2 = rootToNodeId.get(uf.find(pin2.connectedHoleId)) ?? 0;
          stampConductance(nw, n2, 1 / (comp.value * (1 - ratio)));
        }
      } else if (comp.type === 'LED' || comp.type === 'DIODE_1N4148' || comp.type === 'DIODE_1N4007') {
        const { anode, cathode } = getDiodePins(comp);
        if (anode?.connectedHoleId && cathode?.connectedHoleId) {
          const nA = rootToNodeId.get(uf.find(anode.connectedHoleId)) ?? 0;
          const nK = rootToNodeId.get(uf.find(cathode.connectedHoleId)) ?? 0;
          const vf = comp.type === 'DIODE_1N4148' ? 0.72 : comp.type === 'DIODE_1N4007' ? 0.70 : (comp.forwardVoltage ?? 1.9);
          const rd = comp.type === 'DIODE_1N4007' ? 0.4 : comp.type === 'DIODE_1N4148' ? 6.0 : 18.0;
          const isForward = diodeStates.get(comp.id) ?? false;

          if (isForward) {
            stampConductance(nA, nK, 1 / rd);
            // Independent companion current source: Ieq = vf / rd
            const ieq = vf / rd;
            const iA = nA - 1;
            const iK = nK - 1;
            if (iA >= 0) z[iA] += ieq;
            if (iK >= 0) z[iK] -= ieq;
          } else {
            // Reverse-biased / below knee: high impedance
            stampConductance(nA, nK, 1 / 1e7);
          }
        }
      } else if (comp.type === 'TRANSISTOR_NPN_BC547' || comp.type === 'TRANSISTOR_NPN_2N2222') {
        // NPN BJT: Pin mapping (Collector, Base, Emitter)
        const { pinC, pinB, pinE } = getBjtPins(comp);
        if (pinC?.connectedHoleId && pinB?.connectedHoleId && pinE?.connectedHoleId) {
          const nC = rootToNodeId.get(uf.find(pinC.connectedHoleId)) ?? 0;
          const nB = rootToNodeId.get(uf.find(pinB.connectedHoleId)) ?? 0;
          const nE = rootToNodeId.get(uf.find(pinE.connectedHoleId)) ?? 0;
          const vB = nB === 0 ? 0 : x[nB - 1] || 0;
          const vE = nE === 0 ? 0 : x[nE - 1] || 0;
          const vC = nC === 0 ? 0 : x[nC - 1] || 0;
          const vBE = vB - vE;
          const beta = comp.hfe ?? (comp.type === 'TRANSISTOR_NPN_2N2222' ? 100 : 200);

          if (vBE >= 0.60) {
            // Base-Emitter forward conducts with 0.65V knee
            const rBE = 45;
            stampConductance(nB, nE, 1 / rBE);
            const ieqB = 0.65 / rBE;
            if (nB - 1 >= 0) z[nB - 1] += ieqB;
            if (nE - 1 >= 0) z[nE - 1] -= ieqB;

            // Collector-Emitter controlled channel
            const iBase = Math.max(0, (vBE - 0.65) / rBE);
            const vCE = Math.max(0.05, vC - vE);
            const iTarget = Math.min(comp.type === 'TRANSISTOR_NPN_2N2222' ? 0.8 : 0.2, beta * iBase);
            const gCE = Math.min(20.0, Math.max(0.001, iTarget / vCE));
            stampConductance(nC, nE, gCE);
          } else {
            // Cutoff
            stampConductance(nB, nE, 1 / 1e7);
            stampConductance(nC, nE, 1 / 1e7);
          }
        }
      } else if (comp.type === 'TRANSISTOR_PNP_BC557') {
        // PNP BJT: Pin mapping (Collector, Base, Emitter)
        const { pinC, pinB, pinE } = getBjtPins(comp);
        if (pinC?.connectedHoleId && pinB?.connectedHoleId && pinE?.connectedHoleId) {
          const nC = rootToNodeId.get(uf.find(pinC.connectedHoleId)) ?? 0;
          const nB = rootToNodeId.get(uf.find(pinB.connectedHoleId)) ?? 0;
          const nE = rootToNodeId.get(uf.find(pinE.connectedHoleId)) ?? 0;
          const vB = nB === 0 ? 0 : x[nB - 1] || 0;
          const vE = nE === 0 ? 0 : x[nE - 1] || 0;
          const vC = nC === 0 ? 0 : x[nC - 1] || 0;
          const vEB = vE - vB;
          const beta = comp.hfe ?? 200;

          if (vEB >= 0.60) {
            // Emitter-Base forward conducts with 0.65V knee
            const rEB = 45;
            stampConductance(nE, nB, 1 / rEB);
            const ieqB = 0.65 / rEB;
            if (nE - 1 >= 0) z[nE - 1] += ieqB;
            if (nB - 1 >= 0) z[nB - 1] -= ieqB;

            // Emitter-Collector controlled channel
            const iBase = Math.max(0, (vEB - 0.65) / rEB);
            const vEC = Math.max(0.05, vE - vC);
            const iTarget = Math.min(0.2, beta * iBase);
            const gEC = Math.min(20.0, Math.max(0.001, iTarget / vEC));
            stampConductance(nE, nC, gEC);
          } else {
            // Cutoff
            stampConductance(nE, nB, 1 / 1e7);
            stampConductance(nE, nC, 1 / 1e7);
          }
        }
      } else if (comp.type === 'MOSFET_N_LOGIC') {
        // N-channel logic MOSFET: Gate, Drain, Source
        const { pinG, pinD, pinS } = getMosfetPins(comp);
        if (pinG?.connectedHoleId && pinD?.connectedHoleId && pinS?.connectedHoleId) {
          const nG = rootToNodeId.get(uf.find(pinG.connectedHoleId)) ?? 0;
          const nD = rootToNodeId.get(uf.find(pinD.connectedHoleId)) ?? 0;
          const nS = rootToNodeId.get(uf.find(pinS.connectedHoleId)) ?? 0;
          const vG = nG === 0 ? 0 : x[nG - 1] || 0;
          const vS = nS === 0 ? 0 : x[nS - 1] || 0;
          const vGS = vG - vS;
          const vth = comp.vth ?? 2.0;

          // Gate is fully isolated
          stampConductance(nG, nS, 1 / 1e9);

          if (vGS >= vth) {
            // Conductive channel: low Rds(on)
            const rOn = comp.rdsOn ?? 0.05;
            stampConductance(nD, nS, 1 / rOn);
          } else {
            // Cutoff
            stampConductance(nD, nS, 1 / 1e7);
          }
        }
      } else if (comp.type === 'LDR_PHOTORESISTOR') {
        const pinA = comp.pins[0];
        const pinB = comp.pins[1];
        if (pinA?.connectedHoleId && pinB?.connectedHoleId) {
          const n1 = rootToNodeId.get(uf.find(pinA.connectedHoleId)) ?? 0;
          const n2 = rootToNodeId.get(uf.find(pinB.connectedHoleId)) ?? 0;
          const light = Math.max(0, Math.min(1, comp.lightLevel ?? 0.5));
          const rLDR = 100 + 100000 * ((1 - light) ** 2);
          stampConductance(n1, n2, 1 / rLDR);
        }
      } else if (comp.type === 'DIP8_LM358') {
        // LM358 Dual Op-Amp
        // Pin 1: OUT1, Pin 2: IN1-, Pin 3: IN1+, Pin 4: GND
        // Pin 5: IN2+, Pin 6: IN2-, Pin 7: OUT2, Pin 8: VCC
        const pVCC = comp.pins.find((p) => p.name?.includes('VCC') || p.id === 'p8');
        const pGND = comp.pins.find((p) => p.name?.includes('GND') || p.id === 'p4');
        const nVCC = pVCC?.connectedHoleId ? (rootToNodeId.get(uf.find(pVCC.connectedHoleId)) ?? 0) : 0;
        const nGND = pGND?.connectedHoleId ? (rootToNodeId.get(uf.find(pGND.connectedHoleId)) ?? 0) : 0;
        const vcc = nVCC === 0 ? 0 : x[nVCC - 1] || 0;
        const gnd = nGND === 0 ? 0 : x[nGND - 1] || 0;

        if (vcc - gnd >= 2.5) {
          // Op-Amp 1 (Pins 1, 2, 3)
          const pOUT1 = comp.pins.find((p) => p.name?.includes('OUT1') || p.id === 'p1');
          const pIN1M = comp.pins.find((p) => p.name?.includes('IN1-') || p.id === 'p2');
          const pIN1P = comp.pins.find((p) => p.name?.includes('IN1+') || p.id === 'p3');
          if (pOUT1?.connectedHoleId && pIN1M?.connectedHoleId && pIN1P?.connectedHoleId) {
            const nO1 = rootToNodeId.get(uf.find(pOUT1.connectedHoleId)) ?? 0;
            const nM1 = rootToNodeId.get(uf.find(pIN1M.connectedHoleId)) ?? 0;
            const nP1 = rootToNodeId.get(uf.find(pIN1P.connectedHoleId)) ?? 0;
            const vm1 = nM1 === 0 ? 0 : x[nM1 - 1] || 0;
            const vp1 = nP1 === 0 ? 0 : x[nP1 - 1] || 0;
            const vDiff = vp1 - vm1;
            const vOutTarget = Math.max(gnd + 0.05, Math.min(vcc - 1.2, gnd + (vcc - gnd) / 2 + vDiff * 5000));
            const rOut = 20;
            stampConductance(nO1, nGND, 1 / rOut);
            const ieq = vOutTarget / rOut;
            if (nO1 - 1 >= 0) z[nO1 - 1] += ieq;
            if (nGND - 1 >= 0) z[nGND - 1] -= ieq;
          }

          // Op-Amp 2 (Pins 5, 6, 7)
          const pOUT2 = comp.pins.find((p) => p.name?.includes('OUT2') || p.id === 'p7');
          const pIN2M = comp.pins.find((p) => p.name?.includes('IN2-') || p.id === 'p6');
          const pIN2P = comp.pins.find((p) => p.name?.includes('IN2+') || p.id === 'p5');
          if (pOUT2?.connectedHoleId && pIN2M?.connectedHoleId && pIN2P?.connectedHoleId) {
            const nO2 = rootToNodeId.get(uf.find(pOUT2.connectedHoleId)) ?? 0;
            const nM2 = rootToNodeId.get(uf.find(pIN2M.connectedHoleId)) ?? 0;
            const nP2 = rootToNodeId.get(uf.find(pIN2P.connectedHoleId)) ?? 0;
            const vm2 = nM2 === 0 ? 0 : x[nM2 - 1] || 0;
            const vp2 = nP2 === 0 ? 0 : x[nP2 - 1] || 0;
            const vDiff = vp2 - vm2;
            const vOutTarget = Math.max(gnd + 0.05, Math.min(vcc - 1.2, gnd + (vcc - gnd) / 2 + vDiff * 5000));
            const rOut = 20;
            stampConductance(nO2, nGND, 1 / rOut);
            const ieq = vOutTarget / rOut;
            if (nO2 - 1 >= 0) z[nO2 - 1] += ieq;
            if (nGND - 1 >= 0) z[nGND - 1] -= ieq;
          }
        }
      } else if (comp.type === 'DIP8_555') {
        // NE555 Timer IC
        // Pin 1: GND, Pin 2: TRIG, Pin 3: OUT, Pin 4: RESET
        // Pin 5: CTRL, Pin 6: THRES, Pin 7: DISCH, Pin 8: VCC
        const pVCC = comp.pins.find((p) => p.id === 'p8' || p.name?.includes('VCC'));
        const pGND = comp.pins.find((p) => p.id === 'p1' || p.name?.includes('GND'));
        const nVCC = pVCC?.connectedHoleId ? (rootToNodeId.get(uf.find(pVCC.connectedHoleId)) ?? 0) : 0;
        const nGND = pGND?.connectedHoleId ? (rootToNodeId.get(uf.find(pGND.connectedHoleId)) ?? 0) : 0;
        const vcc = nVCC === 0 ? 0 : x[nVCC - 1] || 0;
        const gnd = nGND === 0 ? 0 : x[nGND - 1] || 0;

        // Stamp internal 3 x 5k divider string
        const pCTRL = comp.pins.find((p) => p.id === 'p5' || p.name?.includes('CTRL'));
        const nCTRL = pCTRL?.connectedHoleId ? (rootToNodeId.get(uf.find(pCTRL.connectedHoleId)) ?? 0) : 0;
        if (nCTRL && nVCC && nGND) {
          stampConductance(nVCC, nCTRL, 1 / 5000);
          stampConductance(nCTRL, nGND, 1 / 10000);
        }

        if (vcc - gnd >= 3.0) {
          const pOUT = comp.pins.find((p) => p.id === 'p3' || p.name?.includes('OUT'));
          const pTRIG = comp.pins.find((p) => p.id === 'p2' || p.name?.includes('TRIG'));
          const pTHRES = comp.pins.find((p) => p.id === 'p6' || p.name?.includes('THRES'));
          const pDISCH = comp.pins.find((p) => p.id === 'p7' || p.name?.includes('DISCH'));

          const nOUT = pOUT?.connectedHoleId ? (rootToNodeId.get(uf.find(pOUT.connectedHoleId)) ?? 0) : 0;
          const nTRIG = pTRIG?.connectedHoleId ? (rootToNodeId.get(uf.find(pTRIG.connectedHoleId)) ?? 0) : 0;
          const nTHRES = pTHRES?.connectedHoleId ? (rootToNodeId.get(uf.find(pTHRES.connectedHoleId)) ?? 0) : 0;
          const nDISCH = pDISCH?.connectedHoleId ? (rootToNodeId.get(uf.find(pDISCH.connectedHoleId)) ?? 0) : 0;

          const vTrig = nTRIG === 0 ? 0 : x[nTRIG - 1] || 0;
          const vThres = nTHRES === 0 ? 0 : x[nTHRES - 1] || 0;

          const vTrigRef = gnd + (vcc - gnd) / 3;
          const vThresRef = gnd + (2 * (vcc - gnd)) / 3;

          // Astable / Monostable trigger comparison
          let isHigh = true;
          const isAstable = pTRIG?.connectedHoleId && pTHRES?.connectedHoleId && uf.find(pTRIG.connectedHoleId) === uf.find(pTHRES.connectedHoleId);
          if (isAstable && pDISCH?.connectedHoleId && pVCC?.connectedHoleId && pGND?.connectedHoleId && pTRIG?.connectedHoleId) {
            // Find timing components connected to NE555
            const r1Comp = components.find(c => c.type === 'RESISTOR' && c.pins.some(p => p.connectedHoleId && uf.find(p.connectedHoleId) === uf.find(pVCC.connectedHoleId!)) && c.pins.some(p => p.connectedHoleId && uf.find(p.connectedHoleId) === uf.find(pDISCH.connectedHoleId!)));
            const r2Comp = components.find(c => c.type === 'RESISTOR' && c.pins.some(p => p.connectedHoleId && uf.find(p.connectedHoleId) === uf.find(pDISCH.connectedHoleId!)) && c.pins.some(p => p.connectedHoleId && uf.find(p.connectedHoleId) === uf.find(pTRIG.connectedHoleId!)));
            const c1Comp = components.find(c => (c.type === 'CAPACITOR_ELECTROLYTIC' || c.type === 'CAPACITOR_CERAMIC' || c.type === 'CAPACITOR_FILM') && c.pins.some(p => p.connectedHoleId && uf.find(p.connectedHoleId) === uf.find(pTRIG.connectedHoleId!)) && c.pins.some(p => p.connectedHoleId && uf.find(p.connectedHoleId) === uf.find(pGND.connectedHoleId!)));


            const r1Val = r1Comp?.value || 10000;
            const r2Val = r2Comp?.value || 47000;
            const c1Val = c1Comp?.value || 0.00001;

            const tHigh = Math.max(0.04, 0.693 * (r1Val + r2Val) * c1Val);
            const tLow = Math.max(0.04, 0.693 * r2Val * c1Val);
            const tPeriod = tHigh + tLow;

            const now = Date.now() / 1000;
            const phase = now % tPeriod;
            isHigh = phase < tHigh;
          } else {
            if (vThres > vThresRef) {
              isHigh = false;
            } else if (vTrig < vTrigRef) {
              isHigh = true;
            }
          }


          if (nOUT) {
            const vOutTarget = isHigh ? vcc - 1.4 : gnd + 0.1;
            const rOut = 15;
            stampConductance(nOUT, nGND, 1 / rOut);
            const ieq = vOutTarget / rOut;
            if (nOUT - 1 >= 0) z[nOUT - 1] += ieq;
            if (nGND - 1 >= 0) z[nGND - 1] -= ieq;
          }

          if (nDISCH && !isHigh) {
            // Pin 7 (Discharge) conducts to GND when output is low
            stampConductance(nDISCH, nGND, 1 / 5);
          }
        }
      } else if (comp.type === 'BULB_INCANDESCENT') {
        const pinA = comp.pins[0];
        const pinB = comp.pins[1];
        if (pinA?.connectedHoleId && pinB?.connectedHoleId) {
          const n1 = rootToNodeId.get(uf.find(pinA.connectedHoleId)) ?? 0;
          const n2 = rootToNodeId.get(uf.find(pinB.connectedHoleId)) ?? 0;
          const filamentR = Math.max(5, comp.value);
          stampConductance(n1, n2, 1 / filamentR);
        }
      } else if (comp.type === 'SPEAKER') {
        const pinA = comp.pins[0];
        const pinB = comp.pins[1];
        if (pinA?.connectedHoleId && pinB?.connectedHoleId) {
          const n1 = rootToNodeId.get(uf.find(pinA.connectedHoleId)) ?? 0;
          const n2 = rootToNodeId.get(uf.find(pinB.connectedHoleId)) ?? 0;
          stampConductance(n1, n2, 1 / 8);
        }
      } else if (comp.type === 'SWITCH_TACTILE' || comp.type === 'SWITCH_TOGGLE') {
        const isClosed = comp.state?.isClosed ?? false;
        const pinA = comp.pins[0];
        const pinB = comp.pins[1];
        if (pinA?.connectedHoleId && pinB?.connectedHoleId) {
          const n1 = rootToNodeId.get(uf.find(pinA.connectedHoleId)) ?? 0;
          const n2 = rootToNodeId.get(uf.find(pinB.connectedHoleId)) ?? 0;
          const r = isClosed ? 0.005 : 1e8;
          stampConductance(n1, n2, 1 / r);
        }
      } else if (comp.type === 'INDUCTOR_TOROID') {
        const pinA = comp.pins[0];
        const pinB = comp.pins[1];
        if (pinA?.connectedHoleId && pinB?.connectedHoleId) {
          const n1 = rootToNodeId.get(uf.find(pinA.connectedHoleId)) ?? 0;
          const n2 = rootToNodeId.get(uf.find(pinB.connectedHoleId)) ?? 0;
          stampConductance(n1, n2, 1 / 0.1);
        }
      } else if (comp.type === 'CAPACITOR_ELECTROLYTIC' || comp.type === 'CAPACITOR_CERAMIC' || comp.type === 'CAPACITOR_FILM') {
        const pinA = comp.pins[0];
        const pinB = comp.pins[1];
        if (pinA?.connectedHoleId && pinB?.connectedHoleId) {
          const n1 = rootToNodeId.get(uf.find(pinA.connectedHoleId)) ?? 0;
          const n2 = rootToNodeId.get(uf.find(pinB.connectedHoleId)) ?? 0;
          stampConductance(n1, n2, 1 / 1e7);
        }
      } else if (comp.type === 'LED_RGB') {
        // Pin 0: R, Pin 1: Common Cathode, Pin 2: G, Pin 3: B
        const pR = comp.pins[0]?.connectedHoleId;
        const pK = comp.pins[1]?.connectedHoleId;
        const pG = comp.pins[2]?.connectedHoleId;
        const pB = comp.pins[3]?.connectedHoleId;
        if (pK) {
          const nK = rootToNodeId.get(uf.find(pK)) ?? 0;
          const vK = nK === 0 ? 0 : x[nK - 1] || 0;
          if (pR) {
            const nR = rootToNodeId.get(uf.find(pR)) ?? 0;
            const vR = nR === 0 ? 0 : x[nR - 1] || 0;
            if (vR - vK >= 1.7) {
              stampConductance(nR, nK, 1 / 18);
              const ieq = 1.9 / 18;
              if (nR - 1 >= 0) z[nR - 1] += ieq;
              if (nK - 1 >= 0) z[nK - 1] -= ieq;
            } else {
              stampConductance(nR, nK, 1 / 1e7);
            }
          }
          if (pG) {
            const nG = rootToNodeId.get(uf.find(pG)) ?? 0;
            const vG = nG === 0 ? 0 : x[nG - 1] || 0;
            if (vG - vK >= 2.5) {
              stampConductance(nG, nK, 1 / 18);
              const ieq = 2.8 / 18;
              if (nG - 1 >= 0) z[nG - 1] += ieq;
              if (nK - 1 >= 0) z[nK - 1] -= ieq;
            } else {
              stampConductance(nG, nK, 1 / 1e7);
            }
          }
          if (pB) {
            const nB = rootToNodeId.get(uf.find(pB)) ?? 0;
            const vB = nB === 0 ? 0 : x[nB - 1] || 0;
            if (vB - vK >= 2.7) {
              stampConductance(nB, nK, 1 / 18);
              const ieq = 3.0 / 18;
              if (nB - 1 >= 0) z[nB - 1] += ieq;
              if (nK - 1 >= 0) z[nK - 1] -= ieq;
            } else {
              stampConductance(nB, nK, 1 / 1e7);
            }
          }
        }
      } else if (comp.type === 'BUZZER_ACTIVE') {
        const p1 = comp.pins[0]?.connectedHoleId;
        const p2 = comp.pins[1]?.connectedHoleId;
        if (p1 && p2) {
          const n1 = rootToNodeId.get(uf.find(p1)) ?? 0;
          const n2 = rootToNodeId.get(uf.find(p2)) ?? 0;
          stampConductance(n1, n2, 1 / 120);
        }
      } else if (comp.type === 'BUZZER_PASSIVE') {
        const p1 = comp.pins[0]?.connectedHoleId;
        const p2 = comp.pins[1]?.connectedHoleId;
        if (p1 && p2) {
          const n1 = rootToNodeId.get(uf.find(p1)) ?? 0;
          const n2 = rootToNodeId.get(uf.find(p2)) ?? 0;
          stampConductance(n1, n2, 1 / 1000);
        }
      } else if (comp.type === 'SWITCH_SLIDE') {
        const isClosed = comp.state?.isClosed ?? false;
        const p1 = comp.pins[0]?.connectedHoleId;
        const pCOM = comp.pins[1]?.connectedHoleId;
        const p2 = comp.pins[2]?.connectedHoleId;
        if (pCOM) {
          const nCOM = rootToNodeId.get(uf.find(pCOM)) ?? 0;
          if (p1) {
            const n1 = rootToNodeId.get(uf.find(p1)) ?? 0;
            stampConductance(nCOM, n1, isClosed ? 1 / 1e8 : 1 / 0.005);
          }
          if (p2) {
            const n2 = rootToNodeId.get(uf.find(p2)) ?? 0;
            stampConductance(nCOM, n2, isClosed ? 1 / 0.005 : 1 / 1e8);
          }
        }
      } else if (comp.type === 'DIP8_LM393') {
        const pGND = comp.pins.find((p) => p.id === 'p4' || p.name?.includes('GND'))?.connectedHoleId;
        const nGND = pGND ? (rootToNodeId.get(uf.find(pGND)) ?? 0) : 0;
        const pO1 = comp.pins.find((p) => p.id === 'p1' || p.name?.includes('OUT1'))?.connectedHoleId;
        const pI1M = comp.pins.find((p) => p.id === 'p2' || p.name?.includes('IN1-'))?.connectedHoleId;
        const pI1P = comp.pins.find((p) => p.id === 'p3' || p.name?.includes('IN1+'))?.connectedHoleId;
        if (pO1 && pI1M && pI1P) {
          const nO1 = rootToNodeId.get(uf.find(pO1)) ?? 0;
          const vM1 = pI1M ? (x[(rootToNodeId.get(uf.find(pI1M)) ?? 0) - 1] || 0) : 0;
          const vP1 = pI1P ? (x[(rootToNodeId.get(uf.find(pI1P)) ?? 0) - 1] || 0) : 0;
          if (vP1 <= vM1) {
            stampConductance(nO1, nGND, 1 / 15);
          } else {
            stampConductance(nO1, nGND, 1 / 1e8);
          }
        }
        const pO2 = comp.pins.find((p) => p.id === 'p7' || p.name?.includes('OUT2'))?.connectedHoleId;
        const pI2M = comp.pins.find((p) => p.id === 'p6' || p.name?.includes('IN2-'))?.connectedHoleId;
        const pI2P = comp.pins.find((p) => p.id === 'p5' || p.name?.includes('IN2+'))?.connectedHoleId;
        if (pO2 && pI2M && pI2P) {
          const nO2 = rootToNodeId.get(uf.find(pO2)) ?? 0;
          const vM2 = pI2M ? (x[(rootToNodeId.get(uf.find(pI2M)) ?? 0) - 1] || 0) : 0;
          const vP2 = pI2P ? (x[(rootToNodeId.get(uf.find(pI2P)) ?? 0) - 1] || 0) : 0;
          if (vP2 <= vM2) {
            stampConductance(nO2, nGND, 1 / 15);
          } else {
            stampConductance(nO2, nGND, 1 / 1e8);
          }
        }
      } else if (comp.type === 'DIP16_CD4017') {
        const pVDD = comp.pins.find((p) => p.id === 'p16' || p.name?.includes('VDD'))?.connectedHoleId;
        const pVSS = comp.pins.find((p) => p.id === 'p8' || p.name?.includes('VSS') || p.name?.includes('GND'))?.connectedHoleId;
        if (pVDD && pVSS) {
          const nVDD = rootToNodeId.get(uf.find(pVDD)) ?? 0;
          const nVSS = rootToNodeId.get(uf.find(pVSS)) ?? 0;
          const activeIdx = (comp.state?.counterIndex ?? 0) % 10;
          const qPinIds = ['p3', 'p2', 'p4', 'p7', 'p10', 'p1', 'p5', 'p6', 'p9', 'p11'];
          qPinIds.forEach((pid, qIdx) => {
            const pinHole = comp.pins.find((p) => p.id === pid)?.connectedHoleId;
            if (pinHole) {
              const nQ = rootToNodeId.get(uf.find(pinHole)) ?? 0;
              if (qIdx === activeIdx) {
                stampConductance(nQ, nVDD, 1 / 25);
              } else {
                stampConductance(nQ, nVSS, 1 / 25);
              }
            }
          });
        }
      } else if (comp.type === 'DIP16_74HC595') {
        const pVCC = comp.pins.find((p) => p.id === 'p16' || p.name?.includes('VCC'))?.connectedHoleId;
        const pGND = comp.pins.find((p) => p.id === 'p8' || p.name?.includes('GND'))?.connectedHoleId;
        if (pVCC && pGND) {
          const nVCC = rootToNodeId.get(uf.find(pVCC)) ?? 0;
          const nGND = rootToNodeId.get(uf.find(pGND)) ?? 0;
          const bits = comp.state?.shiftRegisterBits ?? 0b10101010;
          const qPins = ['p15', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'];
          qPins.forEach((pid, bitIdx) => {
            const pinHole = comp.pins.find((p) => p.id === pid)?.connectedHoleId;
            if (pinHole) {
              const nQ = rootToNodeId.get(uf.find(pinHole)) ?? 0;
              const isHigh = Boolean((bits >> bitIdx) & 1);
              if (isHigh) {
                stampConductance(nQ, nVCC, 1 / 25);
              } else {
                stampConductance(nQ, nGND, 1 / 25);
              }
            }
          });
        }
      } else if (comp.type === 'RELAY_MODULE_5V') {
        const pGND = comp.pins.find((p) => p.id === 'gnd')?.connectedHoleId;
        const pIN = comp.pins.find((p) => p.id === 'in')?.connectedHoleId;
        const pCOM = comp.pins.find((p) => p.id === 'com')?.connectedHoleId;
        const pNO = comp.pins.find((p) => p.id === 'no')?.connectedHoleId;
        const pNC = comp.pins.find((p) => p.id === 'nc')?.connectedHoleId;
        let isEnergized = Boolean(comp.state?.relayEnergized);
        if (pIN && pGND) {
          const nIN = rootToNodeId.get(uf.find(pIN)) ?? 0;
          const nGND = rootToNodeId.get(uf.find(pGND)) ?? 0;
          const vIn = nIN === 0 ? 0 : x[nIN - 1] || 0;
          const vGnd = nGND === 0 ? 0 : x[nGND - 1] || 0;
          if (vIn - vGnd >= 2.0) isEnergized = true;
        }
        if (pCOM) {
          const nCOM = rootToNodeId.get(uf.find(pCOM)) ?? 0;
          if (pNO) {
            const nNO = rootToNodeId.get(uf.find(pNO)) ?? 0;
            stampConductance(nCOM, nNO, isEnergized ? 1 / 0.01 : 1 / 1e8);
          }
          if (pNC) {
            const nNC = rootToNodeId.get(uf.find(pNC)) ?? 0;
            stampConductance(nCOM, nNC, isEnergized ? 1 / 1e8 : 1 / 0.01);
          }
        }
      } else if (comp.type === 'DC_GEAR_MOTOR') {
        const p1 = comp.pins[0]?.connectedHoleId;
        const p2 = comp.pins[1]?.connectedHoleId;
        if (p1 && p2) {
          const n1 = rootToNodeId.get(uf.find(p1)) ?? 0;
          const n2 = rootToNodeId.get(uf.find(p2)) ?? 0;
          stampConductance(n1, n2, 1 / 25);
        }
      } else if (comp.type === 'SCREW_TERMINAL_2P' || comp.type === 'IC_SOCKET_DIP') {
        for (let i = 0; i < comp.pins.length; i += 2) {
          const pA = comp.pins[i]?.connectedHoleId;
          const pB = comp.pins[i + 1]?.connectedHoleId;
          if (pA && pB) {
            const nA = rootToNodeId.get(uf.find(pA)) ?? 0;
            const nB = rootToNodeId.get(uf.find(pB)) ?? 0;
            stampConductance(nA, nB, 1 / 0.005);
          }
        }
      }
    });

    // Stamp Independent Voltage Sources (MNA B and C sub-matrices)
    vSources.forEach((vs) => {
      const row = (numNodes - 1) + vs.index;
      const col = row;

      const ip = vs.nodePos - 1;
      const ineg = vs.nodeNeg - 1;

      if (ip >= 0) {
        A[row][ip] = 1;
        A[ip][col] = 1;
      }
      if (ineg >= 0) {
        A[row][ineg] = -1;
        A[ineg][col] = -1;
      }

      z[row] = vs.voltage;
    });

    // Solve linear system A * x = z using Gaussian elimination with partial pivoting
    x = solveLinearSystem(A, z);

    // Check diode states against solution
    let stateChanged = false;
    components.forEach((comp) => {
      if ((comp.type === 'LED' || comp.type === 'DIODE_1N4148' || comp.type === 'DIODE_1N4007') && comp.health !== 'BURNED_OUT') {
        const { anode, cathode } = getDiodePins(comp);
        if (anode?.connectedHoleId && cathode?.connectedHoleId) {
          const nA = rootToNodeId.get(uf.find(anode.connectedHoleId)) ?? 0;
          const nK = rootToNodeId.get(uf.find(cathode.connectedHoleId)) ?? 0;
          const vA = nA === 0 ? 0 : x[nA - 1] || 0;
          const vK = nK === 0 ? 0 : x[nK - 1] || 0;
          const vf = comp.type === 'DIODE_1N4148' ? 0.72 : comp.type === 'DIODE_1N4007' ? 0.70 : (comp.forwardVoltage ?? 1.9);
          const vDiff = vA - vK;
          const currentState = diodeStates.get(comp.id) ?? false;
          if (currentState && vDiff < vf * 0.75) {
            diodeStates.set(comp.id, false);
            stateChanged = true;
          } else if (!currentState && vDiff >= vf * 0.85) {
            diodeStates.set(comp.id, true);
            stateChanged = true;
          }
        }
      }
    });

    // Check if active nonlinear semiconductor devices are present
    const hasActiveDevices = components.some(
      (c) =>
        c.type === 'TRANSISTOR_NPN_BC547' ||
        c.type === 'TRANSISTOR_NPN_2N2222' ||
        c.type === 'TRANSISTOR_PNP_BC557' ||
        c.type === 'MOSFET_N_LOGIC' ||
        c.type === 'DIP8_LM358' ||
        c.type === 'DIP8_LM393' ||
        c.type === 'DIP16_CD4017' ||
        c.type === 'DIP16_74HC595' ||
        c.type === 'RELAY_MODULE_5V' ||
        c.type === 'LED_RGB' ||
        c.type === 'DIP8_555'
    );

    if (!stateChanged && iter >= (hasActiveDevices ? 2 : 1)) break;
  }

  // Extract node voltages
  const nodeVoltages = new Map<number, number>();
  nodeVoltages.set(0, 0); // Ground is 0V
  for (let i = 1; i < numNodes; i++) {
    nodeVoltages.set(i, x[i - 1] || 0);
  }

  // Helper to extract voltage for any hole or component pin ID
  const getNodeVoltage = (pinOrHoleId?: string): number => {
    if (!pinOrHoleId) return 0;
    const root = uf.find(pinOrHoleId);
    const nId = rootToNodeId.get(root) ?? 0;
    return nodeVoltages.get(nId) ?? 0;
  };

  // Map voltages back to every breadboard hole
  const holeVoltages = new Map<string, number>();
  BREADBOARD_HOLES.forEach((hole) => {
    holeVoltages.set(hole.id, getNodeVoltage(hole.id));
  });

  // Also map voltages for all component pins and wire endpoints
  components.forEach((c) => {
    c.pins.forEach((p) => {
      if (p.connectedHoleId) {
        holeVoltages.set(p.connectedHoleId, getNodeVoltage(p.connectedHoleId));
      }
    });
  });
  wires.forEach((w) => {
    if (w.startHoleId) holeVoltages.set(w.startHoleId, getNodeVoltage(w.startHoleId));
    if (w.endHoleId) holeVoltages.set(w.endHoleId, getNodeVoltage(w.endHoleId));
  });

  // Update component states (voltages, currents, power, temperature, health)
  let totalPower = 0;
  let shortCircuitDetected = false;

  const updatedComponents = components.map((comp) => {
    const updated = { ...comp };
    if (updated.health === 'BURNED_OUT') {
      updated.voltageDrop = 0;
      updated.current = 0;
      updated.powerDissipated = 0;
      updated.isEmitting = false;
      updated.emissionIntensity = 0;
      return updated;
    }

    let vDrop = 0;
    let iCurrent = 0;

    if (updated.type === 'RESISTOR') {
      const p1 = updated.pins[0]?.connectedHoleId;
      const p2 = updated.pins[1]?.connectedHoleId;
      if (p1 && p2) {
        const v1 = holeVoltages.get(p1) ?? 0;
        const v2 = holeVoltages.get(p2) ?? 0;
        vDrop = Math.abs(v1 - v2);
        iCurrent = vDrop / Math.max(0.1, updated.value);
      }
    } else if (updated.type === 'LED' || updated.type === 'DIODE_1N4148' || updated.type === 'DIODE_1N4007') {
      const { anode, cathode } = getDiodePins(updated);
      if (anode?.connectedHoleId && cathode?.connectedHoleId) {
        const va = holeVoltages.get(anode.connectedHoleId) ?? 0;
        const vk = holeVoltages.get(cathode.connectedHoleId) ?? 0;
        const forwardBias = va - vk;
        const vf = updated.type === 'DIODE_1N4148' ? 0.72 : updated.type === 'DIODE_1N4007' ? 0.70 : (updated.forwardVoltage ?? 1.9);
        const rd = updated.type === 'DIODE_1N4007' ? 0.4 : updated.type === 'DIODE_1N4148' ? 6.0 : 18.0;
        const isConducting = diodeStates.get(updated.id) ?? false;

        if (isConducting && forwardBias >= vf * 0.75) {
          vDrop = Math.max(0, forwardBias);
          iCurrent = Math.max(0.001, (forwardBias - vf * 0.98) / rd);
          if (updated.type === 'LED') {
            if (forwardBias >= vf * 0.95 && iCurrent < 0.002) {
              iCurrent = Math.max(0.002, (forwardBias - vf * 0.9) / 25);
            }
            updated.isEmitting = iCurrent > 0.0005;
            updated.emissionIntensity = Math.min(2.5, Math.max(0.2, (iCurrent / 0.015) ** 0.85));
          }
        } else {
          vDrop = Math.max(0, forwardBias);
          iCurrent = 0;
          if (updated.type === 'LED') {
            updated.isEmitting = false;
            updated.emissionIntensity = 0;
          }
        }
      }
    } else if (updated.type === 'TRANSISTOR_NPN_BC547' || updated.type === 'TRANSISTOR_NPN_2N2222' || updated.type === 'TRANSISTOR_PNP_BC557') {
      const { pinC, pinB, pinE } = getBjtPins(updated);
      if (pinC?.connectedHoleId && pinB?.connectedHoleId && pinE?.connectedHoleId) {
        const vC = getNodeVoltage(pinC.connectedHoleId);
        const vB = getNodeVoltage(pinB.connectedHoleId);
        const vE = getNodeVoltage(pinE.connectedHoleId);
        vDrop = Math.abs(vC - vE);
        const isNPN = updated.type !== 'TRANSISTOR_PNP_BC557';
        const vBE = isNPN ? vB - vE : vE - vB;
        if (vBE >= 0.60) {
          const rSat = 4; // Typical BC547 / 2N2222 Vce(sat) internal bulk resistance (~4Ω)
          const iBase = Math.max(0, (vBE - 0.65) / 45);
          const beta = updated.hfe ?? 200;
          const iMax = isNPN && updated.type === 'TRANSISTOR_NPN_2N2222' ? 0.8 : 0.2;
          iCurrent = Math.min(iMax, Math.min(beta * iBase, Math.max(0.001, vDrop / rSat)));
        } else {
          iCurrent = 0;
        }
      }
    } else if (updated.type === 'MOSFET_N_LOGIC') {
      const { pinG, pinD, pinS } = getMosfetPins(updated);
      if (pinD?.connectedHoleId && pinS?.connectedHoleId && pinG?.connectedHoleId) {
        const vD = getNodeVoltage(pinD.connectedHoleId);
        const vS = getNodeVoltage(pinS.connectedHoleId);
        const vG = getNodeVoltage(pinG.connectedHoleId);
        vDrop = Math.abs(vD - vS);
        const vGS = vG - vS;
        const vth = updated.vth ?? 2.0;
        if (vGS >= vth) {
          const rOn = updated.rdsOn ?? 0.05;
          iCurrent = vDrop / rOn;
        } else {
          iCurrent = 0;
        }
      }
    } else if (updated.type === 'LDR_PHOTORESISTOR') {
      const p1 = updated.pins[0]?.connectedHoleId;
      const p2 = updated.pins[1]?.connectedHoleId;
      if (p1 && p2) {
        const v1 = getNodeVoltage(p1);
        const v2 = getNodeVoltage(p2);
        vDrop = Math.abs(v1 - v2);
        const light = Math.max(0, Math.min(1, updated.lightLevel ?? 0.5));
        const rLDR = 100 + 100000 * ((1 - light) ** 2);
        iCurrent = vDrop / rLDR;
      }
    } else if (updated.type === 'DIP8_LM358') {
      const pO1 = updated.pins.find((p) => p.name?.includes('OUT1') || p.id === 'p1')?.connectedHoleId;
      const pGND = updated.pins.find((p) => p.name?.includes('GND') || p.id === 'p4')?.connectedHoleId;
      if (pO1 && pGND) {
        vDrop = Math.abs(getNodeVoltage(pO1) - getNodeVoltage(pGND));
        iCurrent = vDrop / 50;
      }
    } else if (updated.type === 'DIP8_555') {
      const pO = updated.pins.find((p) => p.name?.includes('OUT') || p.id === 'p3')?.connectedHoleId;
      const pG = updated.pins.find((p) => p.name?.includes('GND') || p.id === 'p1')?.connectedHoleId;
      if (pO && pG) {
        vDrop = Math.abs(getNodeVoltage(pO) - getNodeVoltage(pG));
        iCurrent = vDrop / 30;
      }
    } else if (updated.type === 'POWER_MODULE_MB102') {
      vDrop = updated.state?.outputVoltageRail ?? (updated.value || 5.0);
      iCurrent = 0.05; // quiescent operating current
    } else if (updated.type === 'POTENTIOMETER') {
      const pin1 = updated.pins[0]?.connectedHoleId;
      const pinW = updated.pins[1]?.connectedHoleId;
      const pin2 = updated.pins[2]?.connectedHoleId;
      const ratio = Math.max(0.001, Math.min(0.999, updated.state?.wiperRatio ?? 0.5));
      const v1 = pin1 ? (holeVoltages.get(pin1) ?? 0) : 0;
      const vw = pinW ? (holeVoltages.get(pinW) ?? 0) : 0;
      const v2 = pin2 ? (holeVoltages.get(pin2) ?? 0) : 0;

      const vDrop1W = pin1 && pinW ? Math.abs(v1 - vw) : 0;
      const vDropW2 = pinW && pin2 ? Math.abs(vw - v2) : 0;
      const r1W = Math.max(0.1, updated.value * ratio);
      const rW2 = Math.max(0.1, updated.value * (1 - ratio));
      const i1W = pin1 && pinW ? vDrop1W / r1W : 0;
      const iW2 = pinW && pin2 ? vDropW2 / rW2 : 0;

      vDrop = Math.max(vDrop1W, vDropW2, Math.abs(v1 - v2));
      iCurrent = Math.max(i1W, iW2);
    } else if (updated.type === 'BULB_INCANDESCENT') {
      const p1 = updated.pins[0]?.connectedHoleId;
      const p2 = updated.pins[1]?.connectedHoleId;
      if (p1 && p2) {
        const v1 = getNodeVoltage(p1);
        const v2 = getNodeVoltage(p2);
        vDrop = Math.abs(v1 - v2);
        const filamentResistance = Math.max(1, updated.value || 25);
        iCurrent = vDrop / filamentResistance;
        // Miniature incandescent bulb begins visible filament glow at >= 0.1V, reaching full brilliance at 4.5V - 6V
        updated.isEmitting = vDrop > 0.1;
        updated.emissionIntensity = updated.isEmitting
          ? Math.min(3.0, Math.max(0.08, (vDrop / 4.5) ** 1.5))
          : 0;
      } else {
        vDrop = 0;
        iCurrent = 0;
        updated.isEmitting = false;
        updated.emissionIntensity = 0;
      }
    } else if (updated.type === 'SPEAKER') {
      const p1 = updated.pins[0]?.connectedHoleId;
      const p2 = updated.pins[1]?.connectedHoleId;
      if (p1 && p2) {
        const v1 = getNodeVoltage(p1);
        const v2 = getNodeVoltage(p2);
        vDrop = Math.abs(v1 - v2);
        iCurrent = vDrop / Math.max(1, updated.value || 8);
      }
    } else if (updated.type === 'LED_RGB') {
      const pR = updated.pins[0]?.connectedHoleId;
      const pK = updated.pins[1]?.connectedHoleId;
      const pG = updated.pins[2]?.connectedHoleId;
      const pB = updated.pins[3]?.connectedHoleId;
      const vK = pK ? getNodeVoltage(pK) : 0;
      const vR = pR ? Math.max(0, getNodeVoltage(pR) - vK) : 0;
      const vG = pG ? Math.max(0, getNodeVoltage(pG) - vK) : 0;
      const vB = pB ? Math.max(0, getNodeVoltage(pB) - vK) : 0;
      const iR = vR >= 1.8 ? (vR - 1.8) / 18 : 0;
      const iG = vG >= 2.6 ? (vG - 2.6) / 18 : 0;
      const iB = vB >= 2.8 ? (vB - 2.8) / 18 : 0;
      iCurrent = iR + iG + iB;
      vDrop = Math.max(vR, vG, vB);
      updated.isEmitting = iCurrent > 0.001;
      const rByte = Math.min(255, Math.round((iR / 0.02) * 255));
      const gByte = Math.min(255, Math.round((iG / 0.02) * 255));
      const bByte = Math.min(255, Math.round((iB / 0.02) * 255));
      updated.state = { ...updated.state, rgbColor: [rByte, gByte, bByte] };
      updated.emissionIntensity = Math.min(2.5, iCurrent / 0.02);
    } else if (updated.type === 'BUZZER_ACTIVE') {
      const p1 = updated.pins[0]?.connectedHoleId;
      const p2 = updated.pins[1]?.connectedHoleId;
      if (p1 && p2) {
        const v1 = getNodeVoltage(p1);
        const v2 = getNodeVoltage(p2);
        vDrop = Math.abs(v1 - v2);
        iCurrent = vDrop / 120;
        const isActive = vDrop >= 2.5;
        updated.isEmitting = isActive;
        updated.state = { ...updated.state, frequency: isActive ? 2400 : 0 };
      }
    } else if (updated.type === 'BUZZER_PASSIVE') {
      const p1 = updated.pins[0]?.connectedHoleId;
      const p2 = updated.pins[1]?.connectedHoleId;
      if (p1 && p2) {
        const v1 = getNodeVoltage(p1);
        const v2 = getNodeVoltage(p2);
        vDrop = Math.abs(v1 - v2);
        iCurrent = vDrop / 1000;
        updated.isEmitting = vDrop > 0.5;
      }
    } else if (updated.type === 'DC_GEAR_MOTOR') {
      const p1 = updated.pins[0]?.connectedHoleId;
      const p2 = updated.pins[1]?.connectedHoleId;
      if (p1 && p2) {
        const v1 = getNodeVoltage(p1);
        const v2 = getNodeVoltage(p2);
        const vDiff = v1 - v2;
        vDrop = Math.abs(vDiff);
        iCurrent = vDrop / 25;
        const rpm = Math.round((vDrop / 6) * 200);
        const dir = vDiff > 0.5 ? 'CW' : vDiff < -0.5 ? 'CCW' : 'STOP';
        updated.state = { ...updated.state, motorRpm: rpm, motorDirection: dir };
      }
    } else if (updated.type === 'SERVO_SG90') {
      const pV = updated.pins.find((p) => p.name?.includes('VCC') || p.id === 'vcc')?.connectedHoleId;
      const pG = updated.pins.find((p) => p.name?.includes('GND') || p.id === 'gnd')?.connectedHoleId;
      if (pV && pG) {
        vDrop = Math.abs(getNodeVoltage(pV) - getNodeVoltage(pG));
        iCurrent = vDrop >= 4.0 ? 0.025 : 0;
        if (updated.state?.servoAngle === undefined) {
          updated.state = { ...updated.state, servoAngle: 90 };
        }
      }
    } else if (updated.type === 'RELAY_MODULE_5V') {
      const pV = updated.pins.find((p) => p.id === 'vcc')?.connectedHoleId;
      const pG = updated.pins.find((p) => p.id === 'gnd')?.connectedHoleId;
      const pIN = updated.pins.find((p) => p.id === 'in')?.connectedHoleId;
      if (pV && pG) {
        vDrop = Math.abs(getNodeVoltage(pV) - getNodeVoltage(pG));
        const vIn = pIN ? getNodeVoltage(pIN) : 0;
        const vGnd = getNodeVoltage(pG);
        const isEnergized = (vIn - vGnd >= 2.0) || Boolean(updated.state?.relayEnergized);
        iCurrent = isEnergized ? 0.07 : 0.005; // 70mA coil current
        updated.state = { ...updated.state, relayEnergized: isEnergized };
      }
    } else if (updated.type === 'DIP8_LM393') {
      const pV = updated.pins.find((p) => p.id === 'p8')?.connectedHoleId;
      const pG = updated.pins.find((p) => p.id === 'p4')?.connectedHoleId;
      if (pV && pG) {
        vDrop = Math.abs(getNodeVoltage(pV) - getNodeVoltage(pG));
        iCurrent = 0.002;
      }
    } else if (updated.type === 'DIP16_CD4017') {
      const pV = updated.pins.find((p) => p.id === 'p16' || p.name?.includes('VDD'))?.connectedHoleId;
      const pG = updated.pins.find((p) => p.id === 'p8' || p.name?.includes('VSS') || p.name?.includes('GND'))?.connectedHoleId;
      const pCLK = updated.pins.find((p) => p.id === 'p14' || p.name?.includes('CLK'))?.connectedHoleId;
      const pRST = updated.pins.find((p) => p.id === 'p15' || p.name?.includes('RESET'))?.connectedHoleId;
      const pINH = updated.pins.find((p) => p.id === 'p13' || p.name?.includes('INH') || p.name?.includes('ENABLE'))?.connectedHoleId;

      if (pV && pG) {
        vDrop = Math.abs(getNodeVoltage(pV) - getNodeVoltage(pG));
        iCurrent = 0.005;

        const vClk = pCLK ? getNodeVoltage(pCLK) : 0;
        const vRst = pRST ? getNodeVoltage(pRST) : 0;
        const vInh = pINH ? getNodeVoltage(pINH) : 0;
        const vGnd = getNodeVoltage(pG);

        let activeIdx = comp.state?.counterIndex ?? 0;
        const prevClk = Boolean((comp.state as any)?.lastClkHigh);
        const isClkHigh = (vClk - vGnd) >= 2.0;
        const isInhibited = (vInh - vGnd) >= 2.0;

        const qPinIds = ['p3', 'p2', 'p4', 'p7', 'p10', 'p1', 'p5', 'p6', 'p9', 'p11'];
        const resetQIndex = qPinIds.findIndex((pid) => {
          const pinHole = updated.pins.find((p) => p.id === pid)?.connectedHoleId;
          return pinHole && pRST && uf.find(pinHole) === uf.find(pRST);
        });

        // Rising clock edge detected!
        if (!isInhibited && !prevClk && isClkHigh) {
          activeIdx = (activeIdx + 1) % 10;
          if (resetQIndex !== -1 && activeIdx >= resetQIndex) {
            activeIdx = 0;
          }
        }

        // Active high reset pin
        if ((vRst - vGnd) >= 2.0 && resetQIndex === -1) {
          activeIdx = 0;
        }

        updated.state = {
          ...updated.state,
          counterIndex: activeIdx,
          lastClkHigh: isClkHigh,
        };
      }
    } else if (updated.type === 'DIP16_74HC595' || updated.type === 'DIP16_L293D') {
      const pV = updated.pins.find((p) => p.id === 'p16')?.connectedHoleId;
      const pG = updated.pins.find((p) => p.id === 'p8')?.connectedHoleId;
      if (pV && pG) {
        vDrop = Math.abs(getNodeVoltage(pV) - getNodeVoltage(pG));
        iCurrent = 0.005;
      }
    } else if (updated.type.startsWith('SENSOR_') || updated.type.startsWith('DISPLAY_')) {
      const pV = updated.pins.find((p) => p.name?.includes('VCC') || p.id === 'vcc' || p.id === 'p1')?.connectedHoleId;
      const pG = updated.pins.find((p) => p.name?.includes('GND') || p.id === 'gnd' || p.id === 'p2')?.connectedHoleId;
      if (pV && pG) {
        vDrop = Math.abs(getNodeVoltage(pV) - getNodeVoltage(pG));
        iCurrent = 0.015;
      }
    }

    const power = vDrop * iCurrent;
    updated.voltageDrop = vDrop;
    updated.current = iCurrent;
    updated.powerDissipated = power;
    totalPower += power;

    // Component-specific thermal and power limits
    let thetaJA = 120; // °C / W
    let defaultMaxP = 0.25;
    let maxCurrent = 2.0;

    switch (updated.type) {
      case 'LED':
        defaultMaxP = 0.15;
        maxCurrent = 0.045;
        thetaJA = 120;
        break;
      case 'BULB_INCANDESCENT':
        defaultMaxP = 5.0;
        maxCurrent = 1.5;
        thetaJA = 20;
        break;
      case 'SPEAKER':
        defaultMaxP = 15.0;
        maxCurrent = 2.5;
        thetaJA = 6;
        break;
      case 'POTENTIOMETER':
        defaultMaxP = 1.0;
        maxCurrent = 1.0;
        thetaJA = 40;
        break;
      case 'RESISTOR':
      default:
        defaultMaxP = 0.25;
        maxCurrent = 2.0;
        thetaJA = 120;
        break;
    }

    const maxP = updated.maxPowerRating ?? defaultMaxP;
    const targetTemp = ambientTemperature + power * thetaJA;
    const currentTemp = comp.temperature ?? ambientTemperature;

    // Smooth progressive thermal rise (~1.5-2s for severe thermal runaway demo)
    if (targetTemp > currentTemp) {
      const overloadRatio = power / Math.max(0.1, maxP);
      const riseRate = Math.min(6, Math.max(0.4, overloadRatio * 0.2));
      updated.temperature = Math.min(targetTemp, currentTemp + riseRate);
    } else {
      updated.temperature = Math.max(targetTemp, currentTemp - Math.max(0.5, (currentTemp - targetTemp) * 0.1));
    }

    // Check Overheating and Burnout according to component class
    if (updated.type === 'BULB_INCANDESCENT') {
      if (power > maxP * 2.5 || vDrop > 16 || iCurrent > maxCurrent * 2.0) {
        updated.health = 'BURNED_OUT';
        updated.isEmitting = false;
        updated.emissionIntensity = 0;
      } else if (power > maxP * 1.5 || updated.temperature > 140) {
        updated.health = 'OVERHEATING';
      } else if (power > maxP * 0.8 || updated.temperature > 60) {
        updated.health = 'WARM';
      } else {
        updated.health = 'NORMAL';
      }
    } else if (updated.type === 'SPEAKER') {
      if (updated.temperature > 160 || (power > maxP * 2.0 && updated.temperature > 130) || iCurrent > maxCurrent * 2.0) {
        updated.health = 'BURNED_OUT';
      } else if (power > maxP * 1.2 || updated.temperature > 85) {
        updated.health = 'OVERHEATING';
      } else if (power > maxP * 0.7 || updated.temperature > 45) {
        updated.health = 'WARM';
      } else {
        updated.health = 'NORMAL';
      }
    } else {
      if (updated.temperature > 150 || (power > maxP * 2.5 && updated.temperature > 110) || iCurrent > maxCurrent * 2.0) {
        updated.health = 'BURNED_OUT';
        updated.isEmitting = false;
        updated.emissionIntensity = 0;
      } else if (power > maxP * 1.2 || updated.temperature > 85 || iCurrent > maxCurrent) {
        updated.health = 'OVERHEATING';
      } else if (power > maxP * 0.7 || updated.temperature > 45) {
        updated.health = 'WARM';
      } else {
        updated.health = 'NORMAL';
      }
    }

    return updated;
  });

  // Calculate live current flowing through jumper wires
  const updatedWires = wires.map((wire) => {
    const v1 = holeVoltages.get(wire.startHoleId) ?? 0;
    const v2 = holeVoltages.get(wire.endHoleId) ?? 0;
    return {
      ...wire,
      voltage: v1,
      current: Math.abs(v1 - v2) / 0.01,
    };
  });

  // Calculate Multimeter reading based on probe placements
  const updatedMultimeter = { ...multimeter };
  if (multimeter.redProbeHoleId && multimeter.blackProbeHoleId) {
    const vRed = holeVoltages.get(multimeter.redProbeHoleId) ?? 0;
    const vBlack = holeVoltages.get(multimeter.blackProbeHoleId) ?? 0;
    const vDiff = vRed - vBlack;

    if (multimeter.mode === 'VOLTS_DC') {
      updatedMultimeter.reading = vDiff;
      updatedMultimeter.unit = 'V';
      updatedMultimeter.isContinuous = false;
    } else if (multimeter.mode === 'CONTINUITY') {
      // Direct connection check
      const root1 = uf.find(multimeter.redProbeHoleId);
      const root2 = uf.find(multimeter.blackProbeHoleId);
      const isShort = root1 === root2;
      updatedMultimeter.isContinuous = isShort;
      updatedMultimeter.reading = isShort ? 0.05 : 999999;
      updatedMultimeter.unit = 'Ω';
    } else if (multimeter.mode === 'RESISTANCE') {
      const root1 = uf.find(multimeter.redProbeHoleId);
      const root2 = uf.find(multimeter.blackProbeHoleId);
      if (root1 === root2) {
        updatedMultimeter.reading = 0.05;
      } else {
        // Find component between probes
        const bridgeComp = components.find((c) => {
          const cPins = c.pins.map((p) => p.connectedHoleId);
          return (
            cPins.includes(multimeter.redProbeHoleId) &&
            cPins.includes(multimeter.blackProbeHoleId)
          );
        });
        updatedMultimeter.reading = bridgeComp ? bridgeComp.value : 999999;
      }
      updatedMultimeter.unit = 'Ω';
    }
  }

  return {
    nodeVoltages,
    holeVoltages,
    components: updatedComponents,
    wires: updatedWires,
    multimeter: updatedMultimeter,
    hasShortCircuit: shortCircuitDetected,
    totalPowerDrawn: totalPower,
  };
}

function generateEmptyResult(
  components: CircuitComponent[],
  wires: JumperWire[],
  multimeter: MultimeterState,
  ambientTemp: number
): SolverResult {
  const holeVoltages = new Map<string, number>();
  BREADBOARD_HOLES.forEach((h) => holeVoltages.set(h.id, 0));

  return {
    nodeVoltages: new Map([[0, 0]]),
    holeVoltages,
    components: components.map((c) => ({
      ...c,
      voltageDrop: 0,
      current: 0,
      powerDissipated: 0,
      temperature: ambientTemp,
      health: 'NORMAL',
      isEmitting: false,
      emissionIntensity: 0,
    })),
    wires: wires.map((w) => ({ ...w, current: 0, voltage: 0 })),
    multimeter,
    hasShortCircuit: false,
    totalPowerDrawn: 0,
  };
}

// Robust Gaussian elimination with partial pivoting
function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = b.length;
  if (n === 0) return [];

  // Augmented matrix
  const M = A.map((row, i) => [...row, b[i]]);

  for (let i = 0; i < n; i++) {
    // Pivot selection
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) {
        maxRow = k;
      }
    }

    const temp = M[i];
    M[i] = M[maxRow];
    M[maxRow] = temp;

    if (Math.abs(M[i][i]) < 1e-12) {
      M[i][i] = 1e-12; // Regularization to prevent division by zero
    }

    // Eliminate column
    for (let k = i + 1; k < n; k++) {
      const factor = M[k][i] / M[i][i];
      for (let j = i; j <= n; j++) {
        M[k][j] -= factor * M[i][j];
      }
    }
  }

  // Back-substitution
  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = M[i][n];
    for (let j = i + 1; j < n; j++) {
      sum -= M[i][j] * x[j];
    }
    x[i] = sum / M[i][i];
  }

  return x;
}
