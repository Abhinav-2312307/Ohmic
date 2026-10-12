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
  const ledStates = new Map<string, boolean>();
  components.forEach((comp) => {
    if (comp.type === 'LED' && comp.health !== 'BURNED_OUT') {
      ledStates.set(comp.id, false); // initial guess: non-conducting
    }
  });

  let x: number[] = [];
  const maxIterations = 3;

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
      } else if (comp.type === 'LED') {
        const anode = comp.pins.find((p) => p.name === 'ANODE' || p.id === 'l1' || p.id === 'pos');
        const cathode = comp.pins.find((p) => p.name === 'CATHODE' || p.id === 'l2' || p.id === 'neg');
        if (anode?.connectedHoleId && cathode?.connectedHoleId) {
          const nA = rootToNodeId.get(uf.find(anode.connectedHoleId)) ?? 0;
          const nK = rootToNodeId.get(uf.find(cathode.connectedHoleId)) ?? 0;
          const vf = comp.forwardVoltage ?? 1.9;
          const rd = 18;
          const isForward = ledStates.get(comp.id) ?? true;

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
      } else if (comp.type === 'CAPACITOR_ELECTROLYTIC' || comp.type === 'CAPACITOR_CERAMIC') {
        const pinA = comp.pins[0];
        const pinB = comp.pins[1];
        if (pinA?.connectedHoleId && pinB?.connectedHoleId) {
          const n1 = rootToNodeId.get(uf.find(pinA.connectedHoleId)) ?? 0;
          const n2 = rootToNodeId.get(uf.find(pinB.connectedHoleId)) ?? 0;
          stampConductance(n1, n2, 1 / 1e7);
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
      if (comp.type === 'LED' && comp.health !== 'BURNED_OUT') {
        const anode = comp.pins.find((p) => p.name === 'ANODE' || p.id === 'l1' || p.id === 'pos');
        const cathode = comp.pins.find((p) => p.name === 'CATHODE' || p.id === 'l2' || p.id === 'neg');
        if (anode?.connectedHoleId && cathode?.connectedHoleId) {
          const nA = rootToNodeId.get(uf.find(anode.connectedHoleId)) ?? 0;
          const nK = rootToNodeId.get(uf.find(cathode.connectedHoleId)) ?? 0;
          const vA = nA === 0 ? 0 : x[nA - 1] || 0;
          const vK = nK === 0 ? 0 : x[nK - 1] || 0;
          const vf = comp.forwardVoltage ?? 1.9;
          const vDiff = vA - vK;
          const currentState = ledStates.get(comp.id) ?? true;
          if (currentState && vDiff < vf * 0.75) {
            ledStates.set(comp.id, false);
            stateChanged = true;
          } else if (!currentState && vDiff >= vf * 0.85) {
            ledStates.set(comp.id, true);
            stateChanged = true;
          }
        }
      }
    });

    if (!stateChanged) break;
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
    } else if (updated.type === 'LED') {
      const a = updated.pins.find((p) => p.name === 'ANODE' || p.id === 'l1' || p.id === 'pos')?.connectedHoleId;
      const k = updated.pins.find((p) => p.name === 'CATHODE' || p.id === 'l2' || p.id === 'neg')?.connectedHoleId;
      if (a && k) {
        const va = holeVoltages.get(a) ?? 0;
        const vk = holeVoltages.get(k) ?? 0;
        const forwardBias = va - vk;
        const vf = updated.forwardVoltage ?? 1.9;
        const isConducting = ledStates.get(updated.id) ?? false;

        if (isConducting && forwardBias >= vf * 0.8) {
          vDrop = Math.max(0, forwardBias);
          iCurrent = Math.max(0, (forwardBias - vf) / 18);
          // If forward bias is near threshold, allow a smooth emission threshold
          if (forwardBias >= vf * 0.95 && iCurrent < 0.002) {
            iCurrent = Math.max(0.002, (forwardBias - vf * 0.9) / 25);
          }
          updated.isEmitting = iCurrent > 0.0005;
          updated.emissionIntensity = Math.min(2.5, Math.max(0.2, (iCurrent / 0.015) ** 0.85));
        } else {
          vDrop = Math.max(0, forwardBias);
          iCurrent = 0;
          updated.isEmitting = false;
          updated.emissionIntensity = 0;
        }
      }
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
