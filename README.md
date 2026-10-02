# Ohmic ⚡
### Realistic 3D/2D Electronic Simulator, Circuit Builder & CAD Suite

Ohmic is an engineering-grade electrical simulation and circuit building suite designed for interactive physical testing, PCB development, and macro electrical systems.

---

## 🎯 Vision & Core Systems

1. **Precision Simulation Core**:
   - Modified Nodal Analysis (MNA) & transient SPICE engine.
   - Coupled electro-thermal simulation ($P = I^2 R$, component thermal rise, breakdown limits, burnout animations).
   - Real-time PCM audio synthesis for speakers and oscillators.

2. **Multi-Scale Modes**:
   - **3D Breadboard Workbench**: Photorealistic interactive prototyping with dynamic catenary wire splines.
   - **2D Schematic CAD**: IEEE/IEC symbol netlists, automated connection routing, and SPICE directive injection.
   - **PCB Designer**: Solder mask, copper trace layers, via drills, and 3D board previews.
   - **Macro Electrical (Household)**: Distribution panels, MCBs/RCDs with trip curves, and mains AC wiring.

---

## 📦 3D Component Models (`assets/models/`)

All models are built with exact physical dimensions (2.54mm breadboard pitch, JEDEC MS-001 IC specs, DIN rail modules) and Physically Based Rendering (PBR) materials:

### 🔌 Boards & Prototyping
- `boards/breadboard_830.glb`: Full 830-point MB-102 breadboard with dual power rails and DIP trough.
- `boards/xiao-esp32s3.glb`: Microcontroller development board.

### 💡 Components
- `components/resistor_1k.glb`: 1/4W axial resistor with 1kΩ color bands (Brown-Black-Red-Gold) and pre-bent leads.
- `components/led_5mm_red.glb`: 5mm red through-hole LED with translucent epoxy dome and internal anvil/post.
- `components/led_5mm_green.glb`: 5mm green through-hole LED.
- `components/led_5mm_blue.glb`: 5mm blue through-hole LED.
- `components/dip8_ic.glb`: Standard 8-pin Dual In-Line Package chip (NE555 / Op-Amps).
- `components/capacitor_electrolytic.glb`: Radial can capacitor with polarity band and top safety vent.
- `components/button_tactile_6mm.glb`: 6x6mm momentary tactile push-button switch.

### 🔋 Power & Instruments
- `power/battery_9v.glb`: 9V battery with polarized snap terminals.
- `instruments/multimeter_dmm.glb`: Digital multimeter with rotary knob, LCD display, and probe jacks.

### ⚡ Macro / Household
- `macro/circuit_breaker_mcb.glb`: Single-pole DIN-rail miniature circuit breaker with toggle lever and trip indicator.
