'use client';

import React, { useState } from 'react';
import { ComponentType } from '../engine/componentTypes';
import {
  Search,
  Plus,
  Zap,
  Lightbulb,
  Volume2,
  Cpu,
  Battery,
  Gauge,
  X,
  CircleDot,
  ToggleLeft,
  Radio,
  Compass,
  Thermometer,
  Eye,
  Mic,
  Droplets,
  Magnet,
  Monitor,
  Wrench,
} from 'lucide-react';
import { audioEngine } from '../engine/audioEngine';

interface ComponentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onStartPlacement: (type: ComponentType, defaultValue?: number) => void;
}

interface ComponentCatalogItem {
  type: ComponentType;
  title: string;
  category: 'power' | 'passives' | 'semiconductors' | 'output' | 'logic' | 'sensors';
  description: string;
  value: number;
  unit: string;
  icon: React.ReactNode;
  badge?: string;
}

const CATALOG: ComponentCatalogItem[] = [
  {
    type: 'BATTERY_9V',
    title: '9V Alkaline Battery',
    category: 'power',
    description: 'High-current DC voltage source with polarized snap terminals for breadboard rails.',
    value: 9,
    unit: 'V',
    icon: <Battery className="w-4 h-4 text-amber-400" />,
    badge: '9.0V DC Source',
  },
  {
    type: 'DC_SOURCE',
    title: 'Bench DC Power Supply',
    category: 'power',
    description: 'Regulated adjustable 5V bench power rails with low ripple.',
    value: 5,
    unit: 'V',
    icon: <Zap className="w-4 h-4 text-amber-400" />,
    badge: '5.0V Regulated',
  },
  {
    type: 'RESISTOR',
    title: '1kΩ Resistor (1/4W)',
    category: 'passives',
    description: 'Through-hole metal film resistor with 1kΩ color bands. 0.25W rated.',
    value: 1000,
    unit: 'Ω',
    icon: <Gauge className="w-4 h-4 text-emerald-400" />,
    badge: '0.25W Rated',
  },
  {
    type: 'RESISTOR',
    title: '330Ω Current Limiter',
    category: 'passives',
    description: 'Ideal current-limiting resistor for 5mm LEDs on 5V/9V circuits.',
    value: 330,
    unit: 'Ω',
    icon: <Gauge className="w-4 h-4 text-emerald-400" />,
    badge: '330Ω Limiter',
  },
  {
    type: 'RESISTOR',
    title: '100Ω Power Resistor',
    category: 'passives',
    description: 'Low-value resistor for testing thermal burnout and overload physics.',
    value: 100,
    unit: 'Ω',
    icon: <Gauge className="w-4 h-4 text-emerald-400" />,
    badge: 'Burnout Test',
  },
  {
    type: 'POTENTIOMETER',
    title: '10kΩ Rotary Potentiometer',
    category: 'passives',
    description: 'Adjustable 3-terminal voltage divider with rotary knurled dial.',
    value: 10000,
    unit: 'Ω',
    icon: <Gauge className="w-4 h-4 text-cyan-400" />,
    badge: 'Linear Taper',
  },
  {
    type: 'CAPACITOR_ELECTROLYTIC',
    title: '100µF Electrolytic Cap',
    category: 'passives',
    description: 'Polarized aluminum filter capacitor (25V rating) for power decoupling.',
    value: 0.0001,
    unit: 'F',
    icon: <CircleDot className="w-4 h-4 text-blue-400" />,
    badge: '100µF 25V',
  },
  {
    type: 'INDUCTOR_TOROID',
    title: '10mH Toroid Inductor',
    category: 'passives',
    description: 'Ferrite core toroid choke for LC filters and resonant circuits.',
    value: 0.01,
    unit: 'H',
    icon: <CircleDot className="w-4 h-4 text-amber-500" />,
    badge: '10mH Choke',
  },
  {
    type: 'LED',
    title: '5mm Red Diffused LED',
    category: 'semiconductors',
    description: '1.9V forward voltage drop, 20mA nominal operating current, radiant glow.',
    value: 1.9,
    unit: 'Vf',
    icon: <Lightbulb className="w-4 h-4 text-rose-400" />,
    badge: 'Red Vf=1.9V',
  },
  {
    type: 'BULB_INCANDESCENT',
    title: 'Incandescent Indicator Bulb',
    category: 'output',
    description: 'Miniature glass bulb with coiled tungsten filament and dynamic thermal glow.',
    value: 40,
    unit: 'Ω',
    icon: <Lightbulb className="w-4 h-4 text-amber-400" />,
    badge: 'Tungsten 40Ω',
  },
  {
    type: 'SPEAKER',
    title: '8Ω Mini Dynamic Speaker',
    category: 'output',
    description: 'Bench-top voice coil transducer with dual top wire terminals (+/-). Rests on workbench mat.',
    value: 8,
    unit: 'Ω',
    icon: <Volume2 className="w-4 h-4 text-indigo-400" />,
    badge: 'Bench 8Ω',
  },
  {
    type: 'SWITCH_TACTILE',
    title: '6mm Momentary Pushbutton',
    category: 'logic',
    description: 'Tactile push switch bridging adjacent breadboard columns or across center trough.',
    value: 0.01,
    unit: 'Ω',
    icon: <ToggleLeft className="w-4 h-4 text-teal-400" />,
    badge: 'SPST NO',
  },
  {
    type: 'DIP8_555',
    title: 'NE555 Precision Timer IC',
    category: 'logic',
    description: 'Classic 8-pin dual-in-line package timer for multivibrator pulse generation.',
    value: 555,
    unit: 'IC',
    icon: <Cpu className="w-4 h-4 text-purple-400" />,
    badge: 'DIP-8 Package',
  },
  {
    type: 'CAPACITOR_CERAMIC',
    title: '0.1µF Ceramic Capacitor (104)',
    category: 'passives',
    description: 'High-frequency decoupling disc capacitor for IC power rails.',
    value: 0.0000001,
    unit: 'F',
    icon: <CircleDot className="w-4 h-4 text-amber-400" />,
    badge: '0.1µF Disc',
  },
  {
    type: 'SWITCH_TOGGLE',
    title: 'Mini Toggle Switch (SPDT)',
    category: 'logic',
    description: 'Bistable on/off circuit latching power switch.',
    value: 0.01,
    unit: 'Ω',
    icon: <ToggleLeft className="w-4 h-4 text-cyan-400" />,
    badge: 'SPDT Latch',
  },
  {
    type: 'DISPLAY_7SEG',
    title: '1-Digit 7-Segment LED Display',
    category: 'output',
    description: 'Common cathode 10-pin DIP numerical digit display across center trough.',
    value: 1,
    unit: 'DISP',
    icon: <Lightbulb className="w-4 h-4 text-rose-400" />,
    badge: '10-Pin DIP',
  },
  {
    type: 'DIODE_1N4148',
    title: '1N4148 High-Speed Signal Diode',
    category: 'semiconductors',
    description: 'DO-35 glass package, 0.72V forward voltage drop, 4ns reverse recovery for switching.',
    value: 0.72,
    unit: 'Vf',
    icon: <Zap className="w-4 h-4 text-orange-400" />,
    badge: 'DO-35 0.72V',
  },
  {
    type: 'DIODE_1N4007',
    title: '1N4007 1A Rectifier Diode',
    category: 'semiconductors',
    description: 'DO-41 black plastic rectifier diode with silver cathode stripe. 1000V PRV / 1A forward.',
    value: 0.70,
    unit: 'Vf',
    icon: <Zap className="w-4 h-4 text-zinc-300" />,
    badge: '1A 1000V',
  },
  {
    type: 'TRANSISTOR_NPN_BC547',
    title: 'BC547 NPN Transistor',
    category: 'semiconductors',
    description: 'TO-92 general purpose small signal NPN amplifier / switch (C-B-E, hFE ~200).',
    value: 200,
    unit: 'hFE',
    icon: <Cpu className="w-4 h-4 text-sky-400" />,
    badge: 'TO-92 NPN',
  },
  {
    type: 'TRANSISTOR_PNP_BC557',
    title: 'BC557 PNP Transistor',
    category: 'semiconductors',
    description: 'TO-92 complementary small signal PNP transistor (C-B-E, hFE ~200).',
    value: 200,
    unit: 'hFE',
    icon: <Cpu className="w-4 h-4 text-emerald-400" />,
    badge: 'TO-92 PNP',
  },
  {
    type: 'TRANSISTOR_NPN_2N2222',
    title: '2N2222 High-Current NPN Transistor',
    category: 'semiconductors',
    description: 'TO-92 high-speed medium-power NPN switching transistor (800mA max, hFE ~100).',
    value: 100,
    unit: 'hFE',
    icon: <Cpu className="w-4 h-4 text-blue-400" />,
    badge: '800mA NPN',
  },
  {
    type: 'MOSFET_N_LOGIC',
    title: 'Logic-Level N-Channel MOSFET',
    category: 'semiconductors',
    description: 'Ultra-low Rds(on) ~0.05Ω power switch driven directly by logic gate voltages (Vth ~2.0V).',
    value: 2.0,
    unit: 'Vth',
    icon: <Zap className="w-4 h-4 text-amber-300" />,
    badge: 'N-MOS Rds 50mΩ',
  },
  {
    type: 'LDR_PHOTORESISTOR',
    title: 'CdS LDR Photoresistor (5mm)',
    category: 'passives',
    description: 'Light-dependent variable sensor (100Ω direct sunlight to 100kΩ dark).',
    value: 10000,
    unit: 'Ω',
    icon: <Lightbulb className="w-4 h-4 text-yellow-300" />,
    badge: 'Light Sensor',
  },
  {
    type: 'DIP8_LM358',
    title: 'LM358 Dual Operational Amplifier',
    category: 'logic',
    description: '8-pin DIP dual low-power general purpose op-amp with single supply operation.',
    value: 358,
    unit: 'IC',
    icon: <Cpu className="w-4 h-4 text-violet-400" />,
    badge: 'Dual Op-Amp',
  },
  {
    type: 'POWER_MODULE_MB102',
    title: 'MB102 Breadboard Power Module',
    category: 'power',
    description: 'Dual-rail regulated 3.3V / 5.0V power supply board with USB & DC barrel jack input.',
    value: 5.0,
    unit: 'V',
    icon: <Battery className="w-4 h-4 text-emerald-400" />,
    badge: '3.3V / 5.0V Dual',
  },
  {
    type: 'BATTERY_HOLDER_4AA',
    title: '4×AA Battery Holder (6V)',
    category: 'power',
    description: '4×AA cells series pack delivering nominal 6.0V DC with heavy-duty snap terminals.',
    value: 6,
    unit: 'V',
    icon: <Battery className="w-4 h-4 text-amber-500" />,
    badge: '6.0V DC 4xAA',
  },
  {
    type: 'REGULATOR_AMS1117_3V3',
    title: 'AMS1117-3.3V LDO Regulator',
    category: 'power',
    description: 'Low-dropout linear voltage regulator dropping 5V/9V down to clean 3.3V.',
    value: 3.3,
    unit: 'V',
    icon: <Zap className="w-4 h-4 text-emerald-400" />,
    badge: '3.3V LDO',
  },
  {
    type: 'TOOL_SOLDERING_IRON',
    title: 'ESD Soldering Iron Station',
    category: 'power',
    description: 'Benchtop temperature-controlled soldering station with brass sponge stand.',
    value: 350,
    unit: '°C',
    icon: <Wrench className="w-4 h-4 text-amber-500" />,
    badge: '350°C Bench Tool',
  },
  {
    type: 'RESISTOR',
    title: '220Ω Resistor (1/4W)',
    category: 'passives',
    description: 'Standard 220Ω color-coded current-limiting resistor for LEDs.',
    value: 220,
    unit: 'Ω',
    icon: <Gauge className="w-4 h-4 text-emerald-400" />,
    badge: '220Ω LED Limiter',
  },
  {
    type: 'RESISTOR',
    title: '470Ω Resistor (1/4W)',
    category: 'passives',
    description: '470Ω 0.25W metal film resistor for logic pull-ups and line termination.',
    value: 470,
    unit: 'Ω',
    icon: <Gauge className="w-4 h-4 text-emerald-400" />,
    badge: '470Ω 0.25W',
  },
  {
    type: 'RESISTOR',
    title: '4.7kΩ Pull-Up Resistor',
    category: 'passives',
    description: 'Standard pull-up resistor for I2C SCL/SDA bus lines and 1-Wire sensors.',
    value: 4700,
    unit: 'Ω',
    icon: <Gauge className="w-4 h-4 text-emerald-400" />,
    badge: '4.7kΩ I2C Pullup',
  },
  {
    type: 'RESISTOR',
    title: '10kΩ Resistor (1/4W)',
    category: 'passives',
    description: 'Essential 10kΩ pull-up/pull-down resistor for buttons and switches.',
    value: 10000,
    unit: 'Ω',
    icon: <Gauge className="w-4 h-4 text-emerald-400" />,
    badge: '10kΩ Pullup',
  },
  {
    type: 'RESISTOR',
    title: '47kΩ Resistor (1/4W)',
    category: 'passives',
    description: 'High-value biasing resistor for analog amplifier stages.',
    value: 47000,
    unit: 'Ω',
    icon: <Gauge className="w-4 h-4 text-emerald-400" />,
    badge: '47kΩ Biasing',
  },
  {
    type: 'RESISTOR',
    title: '100kΩ Resistor (1/4W)',
    category: 'passives',
    description: 'High-resistance voltage divider and 555 long-period timer network resistor.',
    value: 100000,
    unit: 'Ω',
    icon: <Gauge className="w-4 h-4 text-emerald-400" />,
    badge: '100kΩ Network',
  },
  {
    type: 'RESISTOR',
    title: '1MΩ High-Z Resistor',
    category: 'passives',
    description: '1 Megaohm resistor for CMOS inputs, crystal oscillators, and high-impedance probes.',
    value: 1000000,
    unit: 'Ω',
    icon: <Gauge className="w-4 h-4 text-emerald-400" />,
    badge: '1MΩ High-Z',
  },
  {
    type: 'CAPACITOR_CERAMIC',
    title: '100pF Ceramic Disc (101)',
    category: 'passives',
    description: '100 picofarad RF and high-frequency noise decoupling ceramic disc.',
    value: 0.0000000001,
    unit: 'F',
    icon: <CircleDot className="w-4 h-4 text-amber-400" />,
    badge: '100pF Disc',
  },
  {
    type: 'CAPACITOR_CERAMIC',
    title: '1nF Ceramic Disc (102)',
    category: 'passives',
    description: '1 nanofarad ceramic capacitor for tone control and spark suppression.',
    value: 0.000000001,
    unit: 'F',
    icon: <CircleDot className="w-4 h-4 text-amber-400" />,
    badge: '1nF Disc',
  },
  {
    type: 'CAPACITOR_CERAMIC',
    title: '10nF Ceramic Disc (103)',
    category: 'passives',
    description: '10 nanofarad decoupling capacitor for IC power pins.',
    value: 0.00000001,
    unit: 'F',
    icon: <CircleDot className="w-4 h-4 text-amber-400" />,
    badge: '10nF Disc',
  },
  {
    type: 'CAPACITOR_ELECTROLYTIC',
    title: '1µF Electrolytic Cap',
    category: 'passives',
    description: 'Polarized 1µF 50V miniature electrolytic capacitor.',
    value: 0.000001,
    unit: 'F',
    icon: <CircleDot className="w-4 h-4 text-blue-400" />,
    badge: '1µF 50V',
  },
  {
    type: 'CAPACITOR_ELECTROLYTIC',
    title: '10µF Electrolytic Cap',
    category: 'passives',
    description: 'Polarized 10µF 25V capacitor for audio coupling and timer circuits.',
    value: 0.00001,
    unit: 'F',
    icon: <CircleDot className="w-4 h-4 text-blue-400" />,
    badge: '10µF 25V',
  },
  {
    type: 'CAPACITOR_ELECTROLYTIC',
    title: '47µF Electrolytic Cap',
    category: 'passives',
    description: '47µF polarized reservoir capacitor.',
    value: 0.000047,
    unit: 'F',
    icon: <CircleDot className="w-4 h-4 text-blue-400" />,
    badge: '47µF 25V',
  },
  {
    type: 'CAPACITOR_ELECTROLYTIC',
    title: '470µF Electrolytic Cap',
    category: 'passives',
    description: '470µF high-capacity ripple filtering electrolytic capacitor.',
    value: 0.00047,
    unit: 'F',
    icon: <CircleDot className="w-4 h-4 text-blue-400" />,
    badge: '470µF 25V',
  },
  {
    type: 'CAPACITOR_ELECTROLYTIC',
    title: '1000µF Bulk Reservoir Cap',
    category: 'passives',
    description: '1000µF large-can power reservoir capacitor for high-current loads.',
    value: 0.001,
    unit: 'F',
    icon: <CircleDot className="w-4 h-4 text-blue-400" />,
    badge: '1000µF Filter',
  },
  {
    type: 'CAPACITOR_FILM',
    title: '0.1µF Film Capacitor',
    category: 'passives',
    description: 'Low-loss metallized polyester film box capacitor for low-distortion audio & filters.',
    value: 0.0000001,
    unit: 'F',
    icon: <CircleDot className="w-4 h-4 text-amber-300" />,
    badge: 'Film Box Cap',
  },
  {
    type: 'SCREW_TERMINAL_2P',
    title: '2-Pin 5mm Screw Terminal',
    category: 'passives',
    description: 'PCB terminal block with clamp screws for external heavy-gauge wire hookups.',
    value: 0,
    unit: 'TERM',
    icon: <CircleDot className="w-4 h-4 text-blue-400" />,
    badge: '2-Pin 5mm Block',
  },
  {
    type: 'IC_SOCKET_DIP',
    title: '16-Pin DIP IC Socket',
    category: 'passives',
    description: 'Dual-in-line 16-pin prototyping socket with dual wipe contacts.',
    value: 16,
    unit: 'DIP',
    icon: <Cpu className="w-4 h-4 text-zinc-400" />,
    badge: 'DIP-16 Socket',
  },
  {
    type: 'POTENTIOMETER',
    title: '100kΩ Rotary Potentiometer',
    category: 'passives',
    description: 'High-value 3-terminal variable voltage divider with knurled rotary dial.',
    value: 100000,
    unit: 'Ω',
    icon: <Gauge className="w-4 h-4 text-cyan-400" />,
    badge: '100kΩ Taper',
  },
  {
    type: 'SWITCH_SLIDE',
    title: 'SPDT Mini Slide Switch',
    category: 'logic',
    description: '3-pin single pole double throw slide switch for circuit routing and power selection.',
    value: 0.01,
    unit: 'Ω',
    icon: <ToggleLeft className="w-4 h-4 text-cyan-400" />,
    badge: 'SPDT Slide',
  },
  {
    type: 'ROTARY_ENCODER_KY040',
    title: 'KY-040 Rotary Encoder Module',
    category: 'logic',
    description: '360° continuous incremental quadrature encoder with integral push button.',
    value: 20,
    unit: 'PULSE',
    icon: <Gauge className="w-4 h-4 text-teal-400" />,
    badge: 'Quadrature + SW',
  },
  {
    type: 'KEYPAD_4X4',
    title: '4×4 Matrix Keypad (16-Key)',
    category: 'logic',
    description: '16-button matrix keypad (0-9, A-D, *, #) with 8-pin row/col header.',
    value: 16,
    unit: 'KEY',
    icon: <Cpu className="w-4 h-4 text-indigo-400" />,
    badge: '16-Key Matrix',
  },
  {
    type: 'LED_RGB',
    title: '5mm RGB LED (Common Cathode)',
    category: 'semiconductors',
    description: '4-lead tri-color LED blending vibrant Red, Green, and Blue light.',
    value: 2.1,
    unit: 'RGB',
    icon: <Lightbulb className="w-4 h-4 text-pink-400" />,
    badge: '4-Pin RGB LED',
  },
  {
    type: 'DIP8_LM393',
    title: 'LM393 Dual Comparator IC',
    category: 'logic',
    description: '8-pin DIP precision voltage comparator with open-collector outputs.',
    value: 393,
    unit: 'IC',
    icon: <Cpu className="w-4 h-4 text-purple-400" />,
    badge: 'Dual Comparator',
  },
  {
    type: 'DIP16_CD4017',
    title: 'CD4017 Decade Counter IC',
    category: 'logic',
    description: '16-pin DIP 5-stage Johnson decade counter with 10 sequential decoded outputs.',
    value: 4017,
    unit: 'IC',
    icon: <Cpu className="w-4 h-4 text-fuchsia-400" />,
    badge: '10-Step Chaser',
  },
  {
    type: 'DIP16_74HC595',
    title: '74HC595 8-Bit Shift Register',
    category: 'logic',
    description: '16-pin high-speed serial-in, parallel-out 8-bit shift register with storage latch.',
    value: 595,
    unit: 'IC',
    icon: <Cpu className="w-4 h-4 text-violet-400" />,
    badge: '8-Bit Shift Reg',
  },
  {
    type: 'DIP16_L293D',
    title: 'L293D Dual H-Bridge Motor Driver',
    category: 'logic',
    description: '16-pin quadruple half-H driver for bidirectional control of 2 DC motors or 1 stepper.',
    value: 293,
    unit: 'IC',
    icon: <Cpu className="w-4 h-4 text-cyan-400" />,
    badge: 'Dual H-Bridge',
  },
  {
    type: 'MODULE_TB6612FNG',
    title: 'TB6612FNG MOSFET Motor Driver',
    category: 'logic',
    description: 'Dual MOSFET H-bridge motor driver module with standby mode and PWM speed control.',
    value: 6612,
    unit: 'MOD',
    icon: <Cpu className="w-4 h-4 text-emerald-400" />,
    badge: 'MOSFET Driver',
  },
  {
    type: 'BUZZER_ACTIVE',
    title: 'Active Buzzer (5V, 2.4kHz)',
    category: 'output',
    description: 'Acoustic buzzer with built-in oscillator producing a loud fixed 2.4kHz tone.',
    value: 2400,
    unit: 'Hz',
    icon: <Volume2 className="w-4 h-4 text-rose-400" />,
    badge: '2.4kHz Tone',
  },
  {
    type: 'BUZZER_PASSIVE',
    title: 'Passive Piezo Buzzer',
    category: 'output',
    description: 'Wideband piezo sounder reproducing custom frequencies, square waves, and melodies.',
    value: 16,
    unit: 'Ω',
    icon: <Volume2 className="w-4 h-4 text-amber-400" />,
    badge: 'PWM Sounder',
  },
  {
    type: 'RELAY_MODULE_5V',
    title: '5V 1-Channel Relay Module',
    category: 'output',
    description: 'Electromechanical power relay with status LED, flyback diode, and NO/NC terminals.',
    value: 5,
    unit: 'V',
    icon: <Zap className="w-4 h-4 text-blue-400" />,
    badge: '10A Isolation',
  },
  {
    type: 'SERVO_SG90',
    title: 'SG90 Micro Servo (9g, 180°)',
    category: 'output',
    description: 'Geared micro positional servo motor with rotating horn driven by 50Hz PWM.',
    value: 90,
    unit: 'deg',
    icon: <Compass className="w-4 h-4 text-blue-500" />,
    badge: '180° Servo',
  },
  {
    type: 'DC_GEAR_MOTOR',
    title: 'TT DC Gearbox Motor + Wheel',
    category: 'output',
    description: 'Dual-shaft 3-6V gear reduction DC motor with rubber wheel. Rests on workbench mat.',
    value: 200,
    unit: 'RPM',
    icon: <Compass className="w-4 h-4 text-yellow-500" />,
    badge: 'Gear Motor',
  },
  {
    type: 'WS2812B_STRIP',
    title: 'WS2812B Addressable LED Strip',
    category: 'output',
    description: '8 individually addressable RGB LEDs linked over a single digital serial DIN line.',
    value: 8,
    unit: 'RGB',
    icon: <Lightbulb className="w-4 h-4 text-pink-400" />,
    badge: '8-Pixel Strip',
  },
  {
    type: 'MOSFET_DRIVER_MODULE',
    title: 'High-Power MOSFET Switch Module',
    category: 'output',
    description: 'Dual parallel MOSFET power trigger switch capable of controlling up to 15A loads.',
    value: 15,
    unit: 'A',
    icon: <Zap className="w-4 h-4 text-rose-500" />,
    badge: '400W 15A PWM',
  },
  {
    type: 'DISPLAY_OLED_I2C',
    title: '0.96" SSD1306 I2C OLED Display',
    category: 'output',
    description: 'High-contrast 128×64 blue/white monochrome graphical display via 4-pin I2C bus.',
    value: 12864,
    unit: 'OLED',
    icon: <Monitor className="w-4 h-4 text-sky-400" />,
    badge: '128x64 OLED',
  },
  {
    type: 'DISPLAY_LCD_1602_I2C',
    title: '16×2 Character LCD (I2C Backpack)',
    category: 'output',
    description: 'Blue backlight 16-column by 2-row alphanumeric display with PCF8574 I2C backpack.',
    value: 1602,
    unit: 'LCD',
    icon: <Monitor className="w-4 h-4 text-emerald-400" />,
    badge: '16x2 I2C',
  },
  {
    type: 'SENSOR_HC_SR04',
    title: 'HC-SR04 Ultrasonic Distance Sensor',
    category: 'sensors',
    description: 'Non-contact sonar ranging module with dual sonic transducers (2cm to 400cm).',
    value: 25,
    unit: 'cm',
    icon: <Radio className="w-4 h-4 text-cyan-400" />,
    badge: '2cm-400cm Sonar',
  },
  {
    type: 'SENSOR_DHT22',
    title: 'DHT22 Temp & Humidity Sensor',
    category: 'sensors',
    description: 'Digital temperature and relative humidity sensor (-40..80°C / 0..100% RH).',
    value: 24,
    unit: '°C',
    icon: <Thermometer className="w-4 h-4 text-rose-400" />,
    badge: 'Temp & RH',
  },
  {
    type: 'SENSOR_PIR',
    title: 'HC-SR501 PIR Motion Sensor',
    category: 'sensors',
    description: 'Passive infrared body motion sensor with dome lens and 3.3V TTL trigger.',
    value: 1,
    unit: 'PIR',
    icon: <Eye className="w-4 h-4 text-amber-400" />,
    badge: 'PIR Motion',
  },
  {
    type: 'SENSOR_SOUND',
    title: 'Microphone Sound Sensor Module',
    category: 'sensors',
    description: 'High-sensitivity electret microphone module with analog sound envelope output.',
    value: 45,
    unit: 'dB',
    icon: <Mic className="w-4 h-4 text-teal-400" />,
    badge: 'Sound / Clap',
  },
  {
    type: 'SENSOR_SOIL',
    title: 'Capacitive Soil Moisture Sensor',
    category: 'sensors',
    description: 'Corrosion-resistant probe measuring analog soil dielectric permittivity.',
    value: 65,
    unit: '%',
    icon: <Droplets className="w-4 h-4 text-blue-400" />,
    badge: 'Soil Moisture',
  },
  {
    type: 'SENSOR_IR_RECEIVER',
    title: 'VS1838B 38kHz IR Receiver',
    category: 'sensors',
    description: '38kHz infrared receiver with epoxy shielding for handheld remote controls.',
    value: 38,
    unit: 'kHz',
    icon: <Radio className="w-4 h-4 text-purple-400" />,
    badge: '38kHz NEC IR',
  },
  {
    type: 'SENSOR_HALL',
    title: 'A3144 Hall-Effect Magnetic Sensor',
    category: 'sensors',
    description: 'Solid-state magnetic switch triggered by north/south magnetic field proximity.',
    value: 1,
    unit: 'MAG',
    icon: <Magnet className="w-4 h-4 text-red-400" />,
    badge: 'Magnetic Switch',
  },
  {
    type: 'ARDUINO_NANO',
    title: 'Arduino Nano V3 (ATmega328P)',
    category: 'logic',
    description: 'Breadboard-friendly 30-pin microcontroller board with onboard 5V regulator.',
    value: 328,
    unit: 'MCU',
    icon: <Cpu className="w-4 h-4 text-teal-400" />,
    badge: 'ATmega328P DIP-30',
  },
  {
    type: 'ESP32_DEVKIT',
    title: 'ESP32 NodeMCU DevKit V1',
    category: 'logic',
    description: 'Dual-core 240MHz SoC with integrated Wi-Fi and Bluetooth LE across 30 breadboard pins.',
    value: 32,
    unit: 'MCU',
    icon: <Cpu className="w-4 h-4 text-red-400" />,
    badge: 'Wi-Fi + BLE',
  },
  {
    type: 'ARDUINO_UNO_R3',
    title: 'Arduino Uno R3 Dev Board',
    category: 'logic',
    description: 'Standard ATmega328P microcontroller board with USB interface and power rails.',
    value: 328,
    unit: 'MCU',
    icon: <Cpu className="w-4 h-4 text-cyan-400" />,
    badge: 'ATmega328P Uno',
  },
];

export default function ComponentDrawer({
  isOpen,
  onClose,
  onStartPlacement,
}: ComponentDrawerProps) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  if (!isOpen) return null;

  const filtered = CATALOG.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase());
    const matchesCat = activeCategory === 'all' || c.category === activeCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <aside className="absolute top-16 left-4 bottom-4 w-80 glass-panel rounded-2xl z-20 flex flex-col overflow-hidden shadow-2xl border border-white/[0.08] animate-in fade-in slide-in-from-left-4 duration-200 select-none">
      {/* Header */}
      <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold font-mono tracking-wider text-zinc-100">
              COMPONENT CATALOG
            </h2>
            <p className="text-[10px] text-zinc-400">Click any component to place</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          title="Close Catalog (C)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search & Categories */}
      <div className="p-3 border-b border-white/[0.06] bg-zinc-900/40">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search parts (e.g. Resistor, 555, LED)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-zinc-950/80 border border-white/[0.08] rounded-xl text-xs font-mono text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-amber-400/60"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1 mt-2.5 overflow-x-auto no-scrollbar">
          {[
            { id: 'all', label: 'All' },
            { id: 'passives', label: 'Passives' },
            { id: 'semiconductors', label: 'Semis' },
            { id: 'power', label: 'Power' },
            { id: 'output', label: 'Outputs' },
            { id: 'logic', label: 'Logic' },
            { id: 'sensors', label: 'Sensors' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-2.5 py-1 text-[10px] font-mono rounded-lg whitespace-nowrap transition-all ${
                activeCategory === cat.id
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Component Cards List */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {filtered.map((item, idx) => (
          <div
            key={idx}
            className="group flex flex-col p-3 rounded-xl glass-card cursor-pointer"
            onClick={() => {
              audioEngine.playKnobClick();
              onStartPlacement(item.type, item.value);
            }}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-zinc-850 border border-white/[0.06] group-hover:border-amber-500/30 transition-colors">
                  {item.icon}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-zinc-100 group-hover:text-amber-300 transition-colors">
                    {item.title}
                  </h3>
                  <span className="text-[10px] font-mono text-zinc-400">
                    {item.badge}
                  </span>
                </div>
              </div>

              <button
                className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400 group-hover:bg-amber-500 group-hover:text-zinc-950 text-[10px] font-mono font-bold transition-all border border-amber-500/30 flex items-center gap-1 shadow-sm"
                title="Place onto breadboard"
              >
                <Plus className="w-3 h-3" />
                <span>PLACE</span>
              </button>
            </div>

            <p className="text-[11px] text-zinc-400 mt-2 line-clamp-2 leading-relaxed">
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </aside>
  );
}
