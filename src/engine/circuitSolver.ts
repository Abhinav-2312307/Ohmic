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
    if (comp.type === 'BATTERY_9V' || comp.type === 'DC_SOURCE') {
      const negPin = comp.pins.find((p) => p.name === 'NEGATIVE' || p.name === '-' || p.id === 'neg');
      if (negPin?.connectedHoleId) {
        groundRoot = uf.find(negPin.connectedHoleId);
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

    if (comp.type === 'BATTERY_9V' || comp.type === 'DC_SOURCE') {
      const pPin = comp.pins.find((p) => p.name === '+' || p.name === 'POSITIVE' || p.id === 'pos');
      const nPin = comp.pins.find((p) => p.name === '-' || p.name === 'NEGATIVE' || p.id === 'neg');

      if (pPin?.connectedHoleId && nPin?.connectedHoleId) {
        const rootPos = uf.find(pPin.connectedHoleId);
        const rootNeg = uf.find(nPin.connectedHoleId);
        const nodePos = rootToNodeId.get(rootPos) ?? 0;
        const nodeNeg = rootToNodeId.get(rootNeg) ?? 0;

        vSources.push({
          nodePos,
          nodeNeg,
          voltage: comp.value,
          index: vSourceIdx++,
          componentId: comp.id,
        });
      }
    }
  });

  const matrixSize = (numNodes - 1) + vSources.length;

  if (matrixSize <= 0) {
    // Empty or no non-ground nodes
    return generateEmptyResult(components, wires, multimeter, ambientTemperature);
  }

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
    } else if (comp.type === 'LED') {
      const anode = comp.pins.find((p) => p.name === 'ANODE');
      const cathode = comp.pins.find((p) => p.name === 'CATHODE');
      if (anode?.connectedHoleId && cathode?.connectedHoleId) {
        const nA = rootToNodeId.get(uf.find(anode.connectedHoleId)) ?? 0;
        const nK = rootToNodeId.get(uf.find(cathode.connectedHoleId)) ?? 0;
        // Diode model: forward conducts through low dynamic resistance
        stampConductance(nA, nK, 1 / 18);
      }
    } else if (comp.type === 'BULB_INCANDESCENT') {
      const pinA = comp.pins[0];
      const pinB = comp.pins[1];
      if (pinA?.connectedHoleId && pinB?.connectedHoleId) {
        const n1 = rootToNodeId.get(uf.find(pinA.connectedHoleId)) ?? 0;
        const n2 = rootToNodeId.get(uf.find(pinB.connectedHoleId)) ?? 0;
        // Dynamic filament cold/hot resistance
        const filamentR = Math.max(5, comp.value);
        stampConductance(n1, n2, 1 / filamentR);
      }
    } else if (comp.type === 'SPEAKER') {
      const pinA = comp.pins[0];
      const pinB = comp.pins[1];
      if (pinA?.connectedHoleId && pinB?.connectedHoleId) {
        const n1 = rootToNodeId.get(uf.find(pinA.connectedHoleId)) ?? 0;
        const n2 = rootToNodeId.get(uf.find(pinB.connectedHoleId)) ?? 0;
        stampConductance(n1, n2, 1 / 8); // 8 Ohm voice coil
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
        stampConductance(n1, n2, 1 / 0.1); // DC coil resistance
      }
    } else if (comp.type === 'CAPACITOR_ELECTROLYTIC' || comp.type === 'CAPACITOR_CERAMIC') {
      const pinA = comp.pins[0];
      const pinB = comp.pins[1];
      if (pinA?.connectedHoleId && pinB?.connectedHoleId) {
        const n1 = rootToNodeId.get(uf.find(pinA.connectedHoleId)) ?? 0;
        const n2 = rootToNodeId.get(uf.find(pinB.connectedHoleId)) ?? 0;
        stampConductance(n1, n2, 1 / 1e7); // DC leakage
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
  const x = solveLinearSystem(A, z);

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
    } else if (updated.type === 'LED') {
      const a = updated.pins.find((p) => p.name === 'ANODE')?.connectedHoleId;
      const k = updated.pins.find((p) => p.name === 'CATHODE')?.connectedHoleId;
      if (a && k) {
        const va = holeVoltages.get(a) ?? 0;
        const vk = holeVoltages.get(k) ?? 0;
        const forwardBias = va - vk;
        const vf = updated.forwardVoltage ?? 2.0;

        if (forwardBias > vf * 0.75) {
          vDrop = Math.max(0, forwardBias);
          iCurrent = Math.max(0, (forwardBias - vf * 0.7) / 18);
          updated.isEmitting = true;
          updated.emissionIntensity = Math.min(2.5, iCurrent / 0.02); // 20mA is full brightness
        } else {
          updated.isEmitting = false;
          updated.emissionIntensity = 0;
        }
      }
    } else if (updated.type === 'BULB_INCANDESCENT') {
      const p1 = updated.pins[0]?.connectedHoleId;
      const p2 = updated.pins[1]?.connectedHoleId;
      if (p1 && p2) {
        const v1 = holeVoltages.get(p1) ?? 0;
        const v2 = holeVoltages.get(p2) ?? 0;
        vDrop = Math.abs(v1 - v2);
        iCurrent = vDrop / Math.max(5, updated.value);
        updated.isEmitting = vDrop > 0.5;
        updated.emissionIntensity = Math.min(2.0, (vDrop / 6.0) ** 1.8);
      }
    } else if (updated.type === 'SPEAKER') {
      const p1 = updated.pins[0]?.connectedHoleId;
      const p2 = updated.pins[1]?.connectedHoleId;
      if (p1 && p2) {
        const v1 = holeVoltages.get(p1) ?? 0;
        const v2 = holeVoltages.get(p2) ?? 0;
        vDrop = Math.abs(v1 - v2);
        iCurrent = vDrop / 8;
      }
    }

    const power = vDrop * iCurrent;
    updated.voltageDrop = vDrop;
    updated.current = iCurrent;
    updated.powerDissipated = power;
    totalPower += power;

    // Thermal calculation: deltaT = Power * Thermal_Resistance
    const thetaJA = 120; // °C / W
    const tempRise = power * thetaJA;
    updated.temperature = ambientTemperature + tempRise;

    // Check Overheating and Burnout
    const maxP = updated.maxPowerRating ?? 0.25; // 0.25W default
    if (power > maxP * 2.5 || updated.temperature > 160) {
      updated.health = 'BURNED_OUT';
      updated.isEmitting = false;
      updated.emissionIntensity = 0;
    } else if (power > maxP * 1.2 || updated.temperature > 90) {
      updated.health = 'OVERHEATING';
    } else if (power > maxP * 0.7) {
      updated.health = 'WARM';
    } else {
      updated.health = 'NORMAL';
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
