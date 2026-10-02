# Ohmic ⚡
### Realistic Multi-Scale 3D/2D Circuit Simulator, Workbench & Electrical CAD

[![GitHub License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Engine](https://img.shields.io/badge/simulation-SPICE%20%2F%20MNA-orange.svg)](#-the-simulation-kernel)
[![Graphics](https://img.shields.io/badge/rendering-WebGPU%20%2F%20Three.js%20PBR-brightgreen.svg)](#-graphics--visual-philosophy)
[![CAD](https://img.shields.io/badge/CAD-2D%20Schematic%20%2B%203D%20PCB-purple.svg)](#-multi-scale-simulation-paradigms)

**Ohmic** is an engineering-grade electrical design and simulation software suite. It bridges the gap between pure mathematical SPICE tools (which lack physical intuition) and gamified web electronics tools (which lack engineering accuracy, realistic failure physics, and professional rendering).

With Ohmic, engineers, makers, and students can design, test, and troubleshoot circuits from **individual silicon chips on a breadboard**, to **multi-layer PCB design**, all the way to **high-voltage household electrical distribution panels**.

---

## 🧭 The Core Vision: Why Ohmic?

Most existing electronic software falls into two extreme categories:
1. **Abstract CAD/SPICE (Altium, KiCad, LTspice):** Incredibly accurate, but visually abstract 2D graphs and schematic symbols. They lack physical hands-on intuition for wire routing, thermal behavior, bench instrumentation, and physical assembly.
2. **Web Prototyping Toys (Tinkercad Circuits, Fritzing):** Intuitive, but visually simplistic ("fake polygon toys"), lacking true transient non-linear SPICE physics, breakdown voltages, realistic component destruction, or multi-scale engineering capability.

**Ohmic changes this by combining:**
* **True SPICE / MNA Physics Engine** (accurate non-linear transient, AC frequency sweep, and DC analysis).
* **Coupled Electro-Thermal Simulation** ($P = I^2 R$, temperature rise, component thermal failure, smoking/popping capacitors).
* **Physically Based Rendering (PBR) 3D Graphics** (real metals, translucent epoxy lenses, glowing tungsten filaments, textured FR-4 PCB substrates).
* **Dynamic Procedural Wiring** (Catmull-Rom splines with natural catenary gravity sagging).
* **Real-time Acoustic Synthesis** (live audio generation from circuit voltages feeding into speakers).

---

## 🔬 Multi-Scale Simulation Paradigms

Ohmic is structured into 4 seamless, interconnected workspaces:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             OHMIC CAD SUITE                                 │
├───────────────────────┬─────────────────────────────┬───────────────────────┤
│  1. 3D BREADBOARD     │     2. 2D SCHEMATIC CAD     │   3. 3D PCB VIEWER    │
│  - Photoreal Bench    │     - IEEE/IEC Symbols      │   - Multi-layer stack │
│  - Dynamic Jumper Wire│     - Automated Ratsnest    │   - Trace impedance   │
│  - Virtual DMM & Scope│     - SPICE Directives      │   - Solder mask / Via │
├───────────────────────┴─────────────────────────────┴───────────────────────┤
│                 4. MACRO / HOUSEHOLD ELECTRICAL PANEL                       │
│  - 110V/230V AC Mains, Neutral & Earth Loops, DIN-Rail Circuit Breakers     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1. 3D Breadboard Workbench (Prototyping & Education)
* Full 830-point and 400-point solderless breadboards with internal spring-clip connectivity.
* Jumper wires with real DuPont pin heads and procedural physics sag.
* Real-time bench instrumentation: dual-channel digital oscilloscope, function generator, and digital multimeter with functional interactive dials and probes.
* Realistic component stress: exceed a resistor's 1/4W rating and watch it discolor, smoke, and burn out into an open circuit.

### 2. 2D Precision Schematic CAD (Circuit Design)
* Vector infinite canvas with sub-millimeter snap grids.
* Standard IEEE / IEC electronic symbols for all components.
* Netlist generator with automated bus connection and node label propagation.
* Direct SPICE script injection (`.tran`, `.ac`, `.op`, `.step`).

### 3. PCB Layout & Manufacturing Preview
* Conversion of breadboard / schematic designs into multi-layer printed circuit boards.
* Layer stack management: Top Copper, Solder Mask (Green, Matte Black, Blue, Red), Silkscreen, Dielectric Core (FR-4), and Bottom Copper.
* Real-time 3D board raytracing: inspect drill holes, annular rings, traces, and SMD/THT solder fillets.

### 4. Macro Systems: Residential & Industrial Mains
* Household electrical distribution boards (Consumer Units).
* Miniature Circuit Breakers (MCBs) with authentic Type B, C, and D thermal-magnetic trip curves.
* Residual Current Devices (RCDs / GFCIs) with ground-fault leakage detection.
* AC single-phase and three-phase wiring with neutral return and earthing impedance loops.

---

## ⚡ Physics & Simulation Features

| Domain | Implementation | User Experience |
| :--- | :--- | :--- |
| **Electrical** | Modified Nodal Analysis (MNA) & Newton-Raphson non-linear solver | Accurate diode IV curves, transistor switching, operational amplifiers, and timer oscillations. |
| **Thermal** | $\frac{dT}{dt} = \frac{P_{in} - (T - T_{amb})/R_\theta}{C_{th}}$ | Components heat up based on dissipated power ($V \times I$). Exceeding maximum temperature triggers breakdown. |
| **Acoustic** | WebAudio API PCM Stream Buffer | Voltage across speaker terminals converts to real-time audio (e.g. hear a 555-timer square wave or audio amplifier). |
| **Optical** | HDR Bloom Shaders & Emissive Photometry | LEDs illuminate with wavelength-accurate colors; bulb tungsten filaments glow hotter and brighter with increased voltage. |
| **Destruction** | Morph targets & particle systems | Blown capacitors vent/split, resistors turn charred black, and semiconductors short out under over-voltage. |

---

## 🎨 3D Engineering Asset Library (`assets/models/`)

All models are engineered from real-world manufacturer specifications (JEDEC standards, 2.54mm pin pitch, DIN-rail 18mm modules) and rendered with **Physically Based Rendering (PBR)** materials:

### 🔌 Boards & Prototyping
* [`boards/breadboard_830.glb`](assets/models/boards/breadboard_830.glb): 830-point MB-102 solderless breadboard with dual power rails (red/blue) and center DIP trough.
* [`boards/xiao-esp32s3.glb`](assets/models/boards/xiao-esp32s3.glb): ESP32-S3 IoT microcontroller module with castellated pads and USB-C.

### 💡 Active & Passive Components
* [`components/resistor_1k.glb`](assets/models/components/resistor_1k.glb): 1/4W axial resistor with 1kΩ color bands and pre-bent leads (10.16mm pitch).
* [`components/led_5mm_red.glb`](assets/models/components/led_5mm_red.glb): 5mm through-hole LED with translucent epoxy, cathode flat edge, internal anvil & post.
* [`components/led_5mm_green.glb`](assets/models/components/led_5mm_green.glb): 5mm green LED variant.
* [`components/led_5mm_blue.glb`](assets/models/components/led_5mm_blue.glb): 5mm blue LED variant.
* [`components/bulb_incandescent.glb`](assets/models/components/bulb_incandescent.glb): Miniature screw-base incandescent bulb with glass dome, coiled tungsten filament, and brass base.
* [`components/potentiometer_10k.glb`](assets/models/components/potentiometer_10k.glb): 10kΩ rotary potentiometer with knurled rotating shaft and 3 breadboard pins.
* [`components/inductor_toroid.glb`](assets/models/components/inductor_toroid.glb): High-current toroidal inductor with ferrite core ring and 16 enameled copper coil windings.
* [`components/speaker_8ohm.glb`](assets/models/components/speaker_8ohm.glb): 8Ω dynamic mini speaker with mylar cone, dust cap, rear ferrite magnet, and solder lugs.
* [`components/dip8_ic.glb`](assets/models/components/dip8_ic.glb): Standard 8-pin Dual In-Line Package chip (NE555 / Op-Amps) with pin 1 index dot and orientation notch.
* [`components/capacitor_electrolytic.glb`](assets/models/components/capacitor_electrolytic.glb): Radial can capacitor with polarity band and top safety vent.
* [`components/button_tactile_6mm.glb`](assets/models/components/button_tactile_6mm.glb): 6x6mm momentary tactile push-button switch with metal shield plate and plunger.
* [`components/display_7seg_1digit.glb`](assets/models/components/display_7seg_1digit.glb): 1.0-inch 1-digit 7-segment LED display with individually addressable segments (A-G, DP) and 10 pins.
* [`components/dupont_male_pin.glb`](assets/models/components/dupont_male_pin.glb): Standard 2.54mm black shrouded DuPont connector pin head for dynamic jumper cables.

### 🔋 Power & Test Equipment
* [`power/battery_9v.glb`](assets/models/power/battery_9v.glb): 9V battery with polarized snap terminals (hexagonal socket and circular stud).
* [`instruments/multimeter_dmm.glb`](assets/models/instruments/multimeter_dmm.glb): Digital multimeter with rugged rubber holster, LCD display, rotary selector dial, and probe jacks.

### ⚡ Macro & High-Voltage
* [`macro/circuit_breaker_mcb.glb`](assets/models/macro/circuit_breaker_mcb.glb): Single-pole DIN-rail miniature circuit breaker with toggle lever and trip status indicator.

---

## 🏗️ Technology Stack

* **Application Shell:** [Tauri](https://tauri.app/) (Rust backend + ultra-lightweight native OS window).
* **3D Graphics Engine:** [WebGPU](https://gpuweb.github.io/gpuweb/) / [Three.js](https://threejs.org/) (PBR shaders, Bloom post-processing, screen-space ambient occlusion).
* **Simulation Core:** C++ / WebAssembly [ngspice](https://ngspice.sourceforge.io/) kernel + Custom real-time MNA solver.
* **Audio Engine:** WebAudio API + AudioWorklet (low-latency PCM voltage synthesis).
* **Asset Pipeline:** Blender (via Blender MCP) with parametric CAD conversion (.STEP / .SLDPRT).

---

## 🗺️ Engineering Roadmap

- [x] **Milestone 1:** Architecture definition, repository configuration, and git pipeline setup.
- [x] **Milestone 2:** 3D Asset creation pipeline established (18+ precision PBR components modeled and exported).
- [ ] **Milestone 3:** Application shell setup with interactive WebGPU / Three.js 3D viewport and orbital navigation.
- [ ] **Milestone 4:** Dynamic catenary wire spline physics (bendable jumper cables that snap to breadboard pins).
- [ ] **Milestone 5:** Modified Nodal Analysis (MNA) circuit solver implementation with live node voltage readouts.
- [ ] **Milestone 6:** Virtual bench instrumentation (Interactive Multimeter & Dual-Channel Oscilloscope with live waveforms).
- [ ] **Milestone 7:** Thermal dissipation engine & component burnout animations.
- [ ] **Milestone 8:** 2D Schematic editor synchronization & PCB layer visualization.
- [ ] **Milestone 9:** High-voltage household consumer unit & circuit breaker simulation.

---

## 📄 License
This project is open-source under the [MIT License](LICENSE).
