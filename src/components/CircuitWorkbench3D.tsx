'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  CircuitComponent,
  JumperWire,
  MultimeterState,
  ComponentType,
} from '../engine/componentTypes';
import {
  BREADBOARD_HOLES,
  getHolePosition,
  findNearestHole,
  getComponentFootprint,
  getHoleDescription,
  moveComponentToHole,
  getComponentDefaultElevation,
} from '../engine/breadboardModel';
import { WorkbenchTool } from './TopToolbar';
import { audioEngine } from '../engine/audioEngine';
import { Keyboard } from 'lucide-react';

interface CircuitWorkbench3DProps {
  components: CircuitComponent[];
  wires: JumperWire[];
  multimeter: MultimeterState;
  wireColor: string;
  isSimulating: boolean;
  activeTool: WorkbenchTool;
  placingComponent: { type: ComponentType; defaultValue?: number } | null;
  onAddWire: (startHoleId: string, endHoleId: string, color: string) => void;
  onPlaceComponent: (
    type: ComponentType,
    holeIds: string[],
    rotationDeg: number,
    defaultValue?: number,
    positionOverride?: [number, number, number]
  ) => void;
  onSelectComponent: (comp: CircuitComponent | null) => void;
  onSelectWire: (wire: JumperWire | null) => void;
  onComponentStateChange: (id: string, newState: Partial<CircuitComponent['state']>) => void;
  onSetProbeHole: (probe: 'RED' | 'BLACK', holeId: string) => void;
  activeProbe: 'RED' | 'BLACK' | null;
  selectedComponentId: string | null;
  selectedWireId: string | null;
  onCancelAction: () => void;
  onMoveComponent?: (id: string, updatedComp: CircuitComponent) => void;
  onOpenControlsGuide?: () => void;
}

interface ComponentRecord {
  group: THREE.Group;
  proceduralMesh?: THREE.Group;
  loadedModel?: THREE.Group;
  selRing: THREE.Mesh;
  light?: THREE.PointLight;
  health: string;
}

interface WireRecord {
  group: THREE.Group;
  key: string;
}

const gltfLoader = new GLTFLoader();
const modelPrefabCache = new Map<string, THREE.Group>();

export const isBenchComponent = (type: string) =>
  type === 'BATTERY_9V' ||
  type === 'DC_SOURCE' ||
  type === 'BATTERY_HOLDER_4AA' ||
  type === 'SPEAKER' ||
  type === 'DC_GEAR_MOTOR' ||
  type === 'SERVO_SG90' ||
  type === 'RELAY_MODULE_5V' ||
  type === 'KEYPAD_4X4' ||
  type === 'ARDUINO_UNO_R3' ||
  type === 'TOOL_SOLDERING_IRON';

function loadModelPrefab(url: string, callback: (clone: THREE.Group) => void, onError?: () => void) {
  if (modelPrefabCache.has(url)) {
    callback(modelPrefabCache.get(url)!.clone(true));
    return;
  }
  gltfLoader.load(
    url,
    (gltf) => {
      gltf.scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      modelPrefabCache.set(url, gltf.scene);
      callback(gltf.scene.clone(true));
    },
    undefined,
    onError
  );
}

function createBreadboardCanvasTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // 1. Base plastic casing (clean off-white / light cream ABS plastic)
  ctx.fillStyle = '#f5f3ec';
  ctx.fillRect(0, 0, 2048, 1024);

  // Subtle outer beveled rim border
  ctx.strokeStyle = '#dedad0';
  ctx.lineWidth = 12;
  ctx.strokeRect(6, 6, 2036, 1012);

  // 2. Central DIP IC Trough (recessed groove at Z=0, width 7.62mm)
  // With flipY=true: canvas Y = ((Z + 0.0275) / 0.055) * 1024
  // Z=0 -> Y=512. Trough height 7.62mm -> ~142px (from Y=441 to 583)
  const troughTop = 441;
  const troughBot = 583;
  const troughGrad = ctx.createLinearGradient(0, troughTop, 0, troughBot);
  troughGrad.addColorStop(0, '#d1cec5');
  troughGrad.addColorStop(0.15, '#e4e1d8');
  troughGrad.addColorStop(0.5, '#ece9e0');
  troughGrad.addColorStop(0.85, '#e4e1d8');
  troughGrad.addColorStop(1, '#d1cec5');
  ctx.fillStyle = troughGrad;
  ctx.fillRect(20, troughTop, 2008, troughBot - troughTop);

  // Center trough divider shadow line
  ctx.strokeStyle = '#c4c0b5';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(20, 512);
  ctx.lineTo(2028, 512);
  ctx.stroke();

  // Helper coordinate mappers
  const toX = (wx: number) => ((wx + 0.0825) / 0.165) * 2048;
  const toY = (wz: number) => ((wz + 0.0275) / 0.055) * 1024;

  // 3. Power Rail Stripes & Polarity Signs
  // TOP_POS: wz = 0.0245 -> Y = 968
  // TOP_NEG: wz = 0.0210 -> Y = 903
  // BOT_NEG: wz = -0.0210 -> Y = 121
  // BOT_POS: wz = -0.0245 -> Y = 56
  const railStartX = toX(-0.078);
  const railEndX = toX(0.078);

  // TOP_POS (Red stripe)
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(railStartX, toY(0.0245));
  ctx.lineTo(railEndX, toY(0.0245));
  ctx.stroke();

  // TOP_NEG (Blue stripe)
  ctx.strokeStyle = '#2563eb';
  ctx.beginPath();
  ctx.moveTo(railStartX, toY(0.0210));
  ctx.lineTo(railEndX, toY(0.0210));
  ctx.stroke();

  // BOT_NEG (Blue stripe)
  ctx.strokeStyle = '#2563eb';
  ctx.beginPath();
  ctx.moveTo(railStartX, toY(-0.0210));
  ctx.lineTo(railEndX, toY(-0.0210));
  ctx.stroke();

  // BOT_POS (Red stripe)
  ctx.strokeStyle = '#dc2626';
  ctx.beginPath();
  ctx.moveTo(railStartX, toY(-0.0245));
  ctx.lineTo(railEndX, toY(-0.0245));
  ctx.stroke();

  // Draw Polarity Symbols (+ and -) along the power rails
  ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let c = 1; c <= 63; c += 8) {
    const wx = -((63 - 1) * 0.00254) / 2 + (c - 1) * 0.00254;
    const px = toX(wx);

    // Top Red (+)
    ctx.fillStyle = '#dc2626';
    ctx.fillText('+', px, toY(0.0245) - 18);
    // Top Blue (-)
    ctx.fillStyle = '#2563eb';
    ctx.fillText('−', px, toY(0.0210) - 16);
    // Bottom Blue (-)
    ctx.fillStyle = '#2563eb';
    ctx.fillText('−', px, toY(-0.0210) + 16);
    // Bottom Red (+)
    ctx.fillStyle = '#dc2626';
    ctx.fillText('+', px, toY(-0.0245) + 18);
  }

  // 4. Column Numbers (1, 5, 10, 15, ..., 60, 63)
  ctx.font = 'bold 15px ui-monospace, Menlo, Monaco, monospace';
  ctx.fillStyle = '#475569';
  const labeledCols = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 63];
  labeledCols.forEach((col) => {
    const wx = -((63 - 1) * 0.00254) / 2 + (col - 1) * 0.00254;
    const px = toX(wx);
    ctx.fillText(`${col}`, px, toY(0.0185));
    ctx.fillText(`${col}`, px, toY(-0.0185));
  });

  // 5. Row Letters (A, B, C, D, E and F, G, H, I, J)
  ctx.font = 'bold 16px ui-monospace, Menlo, Monaco, monospace';
  ctx.fillStyle = '#334155';
  const rowLabels: [string, number][] = [
    ['A', 0.01651],
    ['B', 0.01397],
    ['C', 0.01143],
    ['D', 0.00889],
    ['E', 0.00635],
    ['F', -0.00635],
    ['G', -0.00889],
    ['H', -0.01143],
    ['I', -0.01397],
    ['J', -0.01651],
  ];

  const leftX = toX(-((63 - 1) * 0.00254) / 2 - 0.0038);
  const rightX = toX(((63 - 1) * 0.00254) / 2 + 0.0038);

  rowLabels.forEach(([letter, wz]) => {
    const py = toY(wz);
    ctx.fillText(letter, leftX, py);
    ctx.fillText(letter, rightX, py);
  });

  // 6. Draw all 830 Socket Holes with high-contrast socket details
  BREADBOARD_HOLES.forEach((hole) => {
    const px = toX(hole.x);
    const py = toY(hole.y);

    // Outer socket bevel chamfer
    ctx.fillStyle = '#dedbd2';
    ctx.strokeStyle = '#c8c4b8';
    ctx.lineWidth = 1;
    ctx.fillRect(px - 7, py - 7, 14, 14);
    ctx.strokeRect(px - 7, py - 7, 14, 14);

    // Inner cavity socket (deep dark opening)
    ctx.fillStyle = '#111215';
    ctx.fillRect(px - 5, py - 5, 10, 10);

    // Spring clip glint reflection inside cavity (nickel contact)
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(px - 3, py - 4, 2, 8);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(px + 1, py - 4, 2, 8);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export default function CircuitWorkbench3D({
  components,
  wires,
  multimeter,
  wireColor,
  isSimulating,
  activeTool,
  placingComponent,
  onAddWire,
  onPlaceComponent,
  onSelectComponent,
  onSelectWire,
  onComponentStateChange,
  onSetProbeHole,
  activeProbe,
  selectedComponentId,
  selectedWireId,
  onCancelAction,
  onMoveComponent,
  onOpenControlsGuide,
}: CircuitWorkbench3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Interaction State
  const [wiringStartHole, setWiringStartHole] = useState<string | null>(null);
  const [hoveredHoleId, setHoveredHoleId] = useState<string | null>(null);
  const [placementRotationDeg, setPlacementRotationDeg] = useState<number>(0);
  const [hoveredTargetHoles, setHoveredTargetHoles] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Three.js References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const holeHitboxesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const componentMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const componentRecordsRef = useRef<Map<string, ComponentRecord>>(new Map());
  const componentsGroupRef = useRef<THREE.Group | null>(null);
  const wireMeshesRef = useRef<THREE.Group | null>(null);
  const wireRecordsRef = useRef<Map<string, WireRecord>>(new Map());
  const dmmLeadsRef = useRef<{ red?: THREE.Group; redHole?: string; black?: THREE.Group; blackHole?: string }>({});
  const activeLightsRef = useRef<THREE.PointLight[]>([]);
  const batteryTerminalsRef = useRef<THREE.Mesh[]>([]);

  // Dynamic Wire Stretching Preview Mesh
  const previewWireMeshRef = useRef<THREE.Mesh | null>(null);
  const previewDupontHeadRef = useRef<THREE.Mesh | null>(null);
  const snapRingMeshRef = useRef<THREE.Mesh | null>(null);

  // Component Placement Ghost Group
  const ghostGroupRef = useRef<THREE.Group | null>(null);

  // Camera Orbit & Component Drag State
  const isDraggingRef = useRef(false);
  const isPanningRef = useRef(false);
  const isDraggingComponentRef = useRef(false);
  const draggedCompIdRef = useRef<string | null>(null);
  const dragPlaneOffsetRef = useRef({ x: 0, z: 0 });
  const dragPin0OffsetRef = useRef({ x: 0, z: 0 });
  const dragCandidateCompRef = useRef<CircuitComponent | null>(null);
  const statusMessageRef = useRef<string>('');
  const hoveredHoleIdRef = useRef<string | null>(null);
  const mouseDownPosRef = useRef({ x: 0, y: 0 });
  const prevMouseRef = useRef({ x: 0, y: 0 });
  const cameraTargetRef = useRef<THREE.Vector3 | null>(new THREE.Vector3(-0.040, 0.012, 0.005));
  const cameraSphericalRef = useRef({ radius: 0.30, theta: Math.PI / 4.1, phi: Math.PI / 3.2 });

  // Deduplicated HUD message and hovered hole helpers to prevent unneeded re-renders
  const updateStatus = useCallback((msg: string) => {
    if (statusMessageRef.current !== msg) {
      statusMessageRef.current = msg;
      setStatusMessage(msg);
    }
  }, []);

  const updateHoveredHole = useCallback((id: string | null) => {
    if (hoveredHoleIdRef.current !== id) {
      hoveredHoleIdRef.current = id;
      setHoveredHoleId(id);
    }
  }, []);

  // Update Camera Orbit
  const updateCameraPosition = useCallback(() => {
    if (!cameraRef.current) return;
    const { radius, theta, phi } = cameraSphericalRef.current;
    const target = cameraTargetRef.current || { x: 0, y: 0, z: 0 };

    cameraRef.current.position.set(
      target.x + radius * Math.sin(phi) * Math.sin(theta),
      target.y + radius * Math.cos(phi),
      target.z + radius * Math.sin(phi) * Math.cos(theta)
    );
    cameraRef.current.lookAt(target.x, target.y, target.z);
  }, []);

  // Keyboard Shortcuts (R to Rotate, Esc to Cancel, V for Select, W for Wire)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      if (e.key === 'r' || e.key === 'R') {
        audioEngine.playKnobClick();
        setPlacementRotationDeg((prev) => (prev === 0 ? 90 : 0));
      } else if (e.key === 'Escape') {
        setWiringStartHole(null);
        if (previewWireMeshRef.current && sceneRef.current) {
          sceneRef.current.remove(previewWireMeshRef.current);
          previewWireMeshRef.current = null;
        }
        if (previewDupontHeadRef.current && sceneRef.current) {
          sceneRef.current.remove(previewDupontHeadRef.current);
          previewDupontHeadRef.current = null;
        }
        onCancelAction();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancelAction]);

  // 1. Scene Initialization
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    if (!cameraTargetRef.current) cameraTargetRef.current = new THREE.Vector3(-0.040, 0.012, 0.005);
    if (wireMeshesRef.current) {
      while (wireMeshesRef.current.children.length > 0) {
        wireMeshesRef.current.remove(wireMeshesRef.current.children[0]);
      }
    } else {
      wireMeshesRef.current = new THREE.Group();
    }

    if (componentsGroupRef.current) {
      while (componentsGroupRef.current.children.length > 0) {
        componentsGroupRef.current.remove(componentsGroupRef.current.children[0]);
      }
    } else {
      componentsGroupRef.current = new THREE.Group();
    }

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x0e0f14); // Sleek modern studio graphite

    // Camera
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.01, 10);
    cameraRef.current = camera;
    updateCameraPosition();

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xfff8ee, 0.85);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfffaea, 2.4);
    keyLight.position.set(0.18, 0.42, 0.28);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.05;
    keyLight.shadow.camera.far = 1.0;
    keyLight.shadow.bias = -0.0001;
    keyLight.shadow.normalBias = 0.001;
    const d = 0.16;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xaad4f5, 0.7);
    fillLight.position.set(-0.25, 0.2, -0.2);
    scene.add(fillLight);

    // Dynamic ESD Anti-Static Mat Canvas Texture
    const esdCanvas = document.createElement('canvas');
    esdCanvas.width = 1024;
    esdCanvas.height = 1024;
    const ctx = esdCanvas.getContext('2d')!;

    // Rich Dark Slate Blue Vinyl
    ctx.fillStyle = '#141b24';
    ctx.fillRect(0, 0, 1024, 1024);

    // Grid Lines (10mm / 50mm)
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 1024; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 1024);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(1024, i);
      ctx.stroke();
    }
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 1024; i += 160) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 1024);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(1024, i);
      ctx.stroke();
    }

    // Silkscreen text on mat
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('ESD STATIC-DISSIPATIVE WORKBENCH • 10^6 - 10^9 Ω/SQ', 40, 60);
    ctx.fillText('OHMIC INSTRUMENTATION SYSTEMS • BENCH 01', 40, 80);

    const esdTexture = new THREE.CanvasTexture(esdCanvas);
    esdTexture.anisotropy = 8;

    const matGeo = new THREE.PlaneGeometry(0.52, 0.38);
    const matMat = new THREE.MeshStandardMaterial({
      map: esdTexture,
      roughness: 0.65,
      metalness: 0.1,
    });
    const benchMat = new THREE.Mesh(matGeo, matMat);
    benchMat.rotation.x = -Math.PI / 2;
    benchMat.position.y = -0.0005;
    benchMat.receiveShadow = true;
    scene.add(benchMat);

    // Breadboard Group
    const breadboardGroup = new THREE.Group();
    scene.add(breadboardGroup);

    // Build High-Fidelity Authentic Procedural Breadboard
    createProceduralBreadboard(breadboardGroup);

    // Generate invisible raycast hitboxes for all 830 breadboard holes
    const holeHitboxGeo = new THREE.CylinderGeometry(0.00095, 0.00095, 0.003, 8);
    const holeHitboxMat = new THREE.MeshBasicMaterial({ visible: false });

    BREADBOARD_HOLES.forEach((hole) => {
      const hitbox = new THREE.Mesh(holeHitboxGeo, holeHitboxMat);
      hitbox.position.set(hole.x, hole.z, hole.y);
      hitbox.userData = { isBreadboardHole: true, holeId: hole.id };
      breadboardGroup.add(hitbox);
      holeHitboxesRef.current.set(hole.id, hitbox);
    });

    // Components Group
    if (componentsGroupRef.current) {
      scene.add(componentsGroupRef.current);
    }

    // Wire Meshes Group
    if (wireMeshesRef.current) {
      scene.add(wireMeshesRef.current);
    }

    // Ghost Placement Group
    const ghostGroup = new THREE.Group();
    scene.add(ghostGroup);
    ghostGroupRef.current = ghostGroup;

    // Glowing Target Snap Ring
    const snapRingGeo = new THREE.RingGeometry(0.0012, 0.0024, 24);
    const snapRingMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const snapRing = new THREE.Mesh(snapRingGeo, snapRingMat);
    snapRing.rotation.x = -Math.PI / 2;
    snapRing.position.y = 0.009;
    snapRing.visible = false;
    scene.add(snapRing);
    snapRingMeshRef.current = snapRing;

    // Render Loop
    let animationId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      // Subtle pulse on emitting components
      activeLightsRef.current.forEach((light) => {
        light.intensity = THREE.MathUtils.lerp(
          light.intensity,
          light.userData.targetIntensity,
          delta * 8
        );
      });

      // Subtle rotation on snap ring for alive feel
      if (snapRingMeshRef.current && snapRingMeshRef.current.visible) {
        snapRingMeshRef.current.rotation.z += delta * 2;
      }

      renderer.render(scene, camera);
    };
    animate();

    // Resize Handler
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (wireMeshesRef.current) {
        while (wireMeshesRef.current.children.length > 0) {
          const c = wireMeshesRef.current.children[0];
          wireMeshesRef.current.remove(c);
          c.traverse((m) => {
            if ((m as THREE.Mesh).geometry) (m as THREE.Mesh).geometry.dispose();
          });
        }
      }
      if (componentsGroupRef.current) {
        while (componentsGroupRef.current.children.length > 0) {
          const c = componentsGroupRef.current.children[0];
          componentsGroupRef.current.remove(c);
          c.traverse((m) => {
            if ((m as THREE.Mesh).geometry) (m as THREE.Mesh).geometry.dispose();
          });
        }
      }
      componentRecordsRef.current.clear();
      componentMeshesRef.current.clear();
      wireRecordsRef.current.clear();
      dmmLeadsRef.current = {};
      activeLightsRef.current = [];
    };
  }, [updateCameraPosition]);

  // Procedural Breadboard Generator (High-Contrast Visible Sockets & Markings)
  const createProceduralBreadboard = (group: THREE.Group) => {
    const topTexture = createBreadboardCanvasTexture();

    // Box Materials: [right (+X), left (-X), top (+Y), bottom (-Y), front (+Z), back (-Z)]
    const sideMat = new THREE.MeshStandardMaterial({
      color: 0xf5f3ec,
      roughness: 0.45,
      metalness: 0.02,
    });
    const topMat = new THREE.MeshStandardMaterial({
      map: topTexture,
      roughness: 0.35,
      metalness: 0.05,
    });

    const materials = [sideMat, sideMat, topMat, sideMat, sideMat, sideMat];
    const baseGeo = new THREE.BoxGeometry(0.165, 0.0085, 0.055);
    const base = new THREE.Mesh(baseGeo, materials);
    base.position.set(0, 0.00425, 0);
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    // 830 Nickel Spring Contact Holes (Instanced 3D Depth Meshes)
    const holeSquareGeo = new THREE.BoxGeometry(0.0011, 0.0006, 0.0011);
    const holeContactMat = new THREE.MeshStandardMaterial({
      color: 0x141518,
      roughness: 0.25,
      metalness: 0.85,
    });
    const instancedHoles = new THREE.InstancedMesh(
      holeSquareGeo,
      holeContactMat,
      BREADBOARD_HOLES.size
    );
    const dummy = new THREE.Object3D();
    let idx = 0;
    BREADBOARD_HOLES.forEach((h) => {
      dummy.position.set(h.x, 0.00845, h.y);
      dummy.updateMatrix();
      instancedHoles.setMatrixAt(idx++, dummy.matrix);
    });
    instancedHoles.instanceMatrix.needsUpdate = true;
    group.add(instancedHoles);
  };

  // Update material visual states (Emissive LED glow / Filament warmth / Burnout / Overheating)
  const updateModelMaterials = (model: THREE.Group, comp: CircuitComponent) => {
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat && mat.isMeshStandardMaterial) {
          if (comp.health === 'BURNED_OUT') {
            mat.color.setHex(0x18181b);
            mat.emissive.setHex(0x000000);
            mat.emissiveIntensity = 0;
          } else if (comp.health === 'OVERHEATING') {
            mat.color.setHex(0x9a3412);
            mat.emissive.setHex(0x7c2d12);
            mat.emissiveIntensity = 0.5;
          } else if (comp.type === 'LED') {
            // Keep metal pins shiny tin-lead
            if (mat.name && (mat.name.includes('Tin') || mat.name.includes('Lead') || mat.name.includes('Leg'))) {
              return;
            }
            const isEmitting = (comp as any).isEmitting ?? false;
            const emissionIntensity = (comp as any).emissionIntensity ?? 0;
            const colorHex =
              comp.ledColor === 'GREEN'
                ? 0x22c55e
                : comp.ledColor === 'BLUE'
                ? 0x3b82f6
                : comp.ledColor === 'YELLOW'
                ? 0xeab308
                : 0xef4444;
            if (isEmitting) {
              mat.color.setHex(colorHex);
              mat.emissive.setHex(colorHex);
              mat.emissiveIntensity = Math.min(3.0, Math.max(0.4, emissionIntensity * 2.2));
            } else {
              const offColor =
                comp.ledColor === 'GREEN'
                  ? 0x14532d
                  : comp.ledColor === 'BLUE'
                  ? 0x1e3a8a
                  : comp.ledColor === 'YELLOW'
                  ? 0x713f12
                  : 0x7f1d1d;
              mat.color.setHex(offColor);
              mat.emissive.setHex(0x000000);
              mat.emissiveIntensity = 0;
            }
          } else if (comp.type === 'BULB_INCANDESCENT') {
            const isEmitting = (comp as any).isEmitting ?? false;
            const emissionIntensity = (comp as any).emissionIntensity ?? 0;
            const mName = (mat.name || '').toLowerCase();
            const meshName = (mesh.name || '').toLowerCase();

            if (mName.includes('filament') || meshName.includes('filament') || meshName.includes('tungsten')) {
              // Internal coiled tungsten filament
              if (isEmitting) {
                // Incandescent radiant filament: brilliant white-hot core with intense amber bloom
                mat.color.setHex(0xffffff);
                mat.emissive.setHex(0xffaa22);
                mat.emissiveIntensity = Math.min(6.5, Math.max(0.8, emissionIntensity * 4.2));
                mat.roughness = 0.1;
              } else {
                // Cold tungsten wire: dark graphite grey
                mat.color.setHex(0x27272a);
                mat.emissive.setHex(0x000000);
                mat.emissiveIntensity = 0;
                mat.roughness = 0.45;
              }
            } else if (
              mName.includes('glass') ||
              meshName.includes('glass') ||
              meshName.includes('dome') ||
              meshName.includes('sphere.001') ||
              meshName.includes('neck')
            ) {
              // Crystal clear glass envelope
              const physicalMat = mat as THREE.MeshPhysicalMaterial;
              if (isEmitting) {
                // Radiant amber incandescent glow
                mat.color.setHex(0xffedd5);
                mat.emissive.setHex(0xff9900);
                mat.emissiveIntensity = Math.min(2.2, Math.max(0.15, emissionIntensity * 1.3));
                mat.transparent = true;
                mat.opacity = 0.85;
                if (physicalMat.transmission !== undefined) physicalMat.transmission = 0.82;
                mat.roughness = 0.12;
              } else {
                // Clear, transparent glass envelope showing filament inside
                mat.color.setHex(0xf8fafc);
                mat.emissive.setHex(0x000000);
                mat.emissiveIntensity = 0;
                mat.transparent = true;
                mat.opacity = 0.35;
                if (physicalMat.transmission !== undefined) physicalMat.transmission = 0.95;
                mat.roughness = 0.05;
              }
            } else if (mName.includes('base') || mName.includes('brass') || meshName.includes('screw') || meshName.includes('torus')) {
              // Polished brass threaded base
              mat.color.setHex(0xd4af37);
              mat.metalness = 0.88;
              mat.roughness = 0.28;
              mat.emissive.setHex(0x000000);
              mat.emissiveIntensity = 0;
            } else if (mName.includes('support') || mName.includes('wire') || meshName.includes('cylinder.001')) {
              // Lead support wires
              mat.color.setHex(0xa1a1aa);
              mat.metalness = 0.92;
              mat.roughness = 0.2;
              mat.emissive.setHex(isEmitting ? 0x7c2d12 : 0x000000);
              mat.emissiveIntensity = isEmitting ? 0.3 : 0;
            } else if (mName.includes('insulator')) {
              mat.color.setHex(0x18181b);
              mat.roughness = 0.85;
            } else if (mName.includes('contact') || mName.includes('solder')) {
              mat.color.setHex(0xa1a1aa);
              mat.metalness = 0.95;
              mat.roughness = 0.2;
            } else {
              // Fallback for custom or unified mesh
              if (isEmitting) {
                mat.color.setHex(0xfffbeb);
                mat.emissive.setHex(0xf59e0b);
                mat.emissiveIntensity = Math.min(3.0, emissionIntensity * 2.2);
              } else {
                mat.color.setHex(0xa1a1aa);
                mat.emissive.setHex(0x000000);
                mat.emissiveIntensity = 0;
              }
            }
          }
        }
      }
    });
  };

  // Helper: Build procedural 3D meshes for components that lack external GLTF files
  const buildProceduralMesh = (comp: { type: ComponentType; id?: string; [key: string]: any }): THREE.Group => {
    const group = new THREE.Group();

    switch (comp.type) {
      case 'DIODE_1N4148': {
        // DO-35 glass envelope with orange interior and black cathode band
        const bodyGeo = new THREE.CylinderGeometry(0.0012, 0.0012, 0.004, 16);
        const bodyMat = new THREE.MeshPhysicalMaterial({
          color: 0xf97316,
          roughness: 0.15,
          transmission: 0.8,
          transparent: true,
          opacity: 0.85,
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.rotation.z = Math.PI / 2;
        body.position.y = 0.003;
        group.add(body);

        // Black cathode stripe
        const bandGeo = new THREE.CylinderGeometry(0.00122, 0.00122, 0.0008, 16);
        const bandMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.5 });
        const band = new THREE.Mesh(bandGeo, bandMat);
        band.rotation.z = Math.PI / 2;
        band.position.set(0.0012, 0.003, 0);
        group.add(band);

        // Axial silver leads
        const leadMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.9, roughness: 0.2 });
        [-0.00381, 0.00381].forEach((x) => {
          const lead = new THREE.Mesh(new THREE.CylinderGeometry(0.0003, 0.0003, 0.007, 8), leadMat);
          lead.position.set(x, 0.0005, 0);
          group.add(lead);
        });
        break;
      }

      case 'DIODE_1N4007': {
        // DO-41 molded black epoxy cylinder with silver cathode stripe
        const bodyGeo = new THREE.CylinderGeometry(0.0016, 0.0016, 0.0055, 16);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.45 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.rotation.z = Math.PI / 2;
        body.position.y = 0.003;
        group.add(body);

        // Silver cathode stripe
        const stripeGeo = new THREE.CylinderGeometry(0.00162, 0.00162, 0.001, 16);
        const stripeMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.85, roughness: 0.25 });
        const stripe = new THREE.Mesh(stripeGeo, stripeMat);
        stripe.rotation.z = Math.PI / 2;
        stripe.position.set(0.0018, 0.003, 0);
        group.add(stripe);

        // Axial silver leads
        const leadMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.9, roughness: 0.2 });
        [-0.00381, 0.00381].forEach((x) => {
          const lead = new THREE.Mesh(new THREE.CylinderGeometry(0.0004, 0.0004, 0.007, 8), leadMat);
          lead.position.set(x, 0.0005, 0);
          group.add(lead);
        });
        break;
      }

      case 'TRANSISTOR_NPN_BC547':
      case 'TRANSISTOR_PNP_BC557':
      case 'TRANSISTOR_NPN_2N2222': {
        // TO-92 D-shaped molded body
        const bodyGeo = new THREE.CylinderGeometry(0.0025, 0.0025, 0.005, 16, 1, false, 0, Math.PI);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.35 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.0035;
        group.add(body);

        const flatFace = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.005, 0.0004), bodyMat);
        flatFace.position.set(0, 0.0035, 0);
        group.add(flatFace);

        // 3 inline leads (C, B, E)
        const leadMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.9, roughness: 0.2 });
        [-0.00254, 0, 0.00254].forEach((x) => {
          const lead = new THREE.Mesh(new THREE.CylinderGeometry(0.0003, 0.0003, 0.007, 8), leadMat);
          lead.position.set(x, 0.0005, 0);
          group.add(lead);
        });
        break;
      }

      case 'MOSFET_N_LOGIC': {
        // Power package with rear silver heatsink tab
        const bodyGeo = new THREE.BoxGeometry(0.005, 0.006, 0.0025);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.4 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.004;
        group.add(body);

        const tabGeo = new THREE.BoxGeometry(0.0045, 0.004, 0.0006);
        const tabMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.95, roughness: 0.15 });
        const tab = new THREE.Mesh(tabGeo, tabMat);
        tab.position.set(0, 0.006, -0.0013);
        group.add(tab);

        // 3 inline leads (G, D, S)
        const leadMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.9, roughness: 0.2 });
        [-0.00254, 0, 0.00254].forEach((x) => {
          const lead = new THREE.Mesh(new THREE.CylinderGeometry(0.0003, 0.0003, 0.007, 8), leadMat);
          lead.position.set(x, 0.0005, 0);
          group.add(lead);
        });
        break;
      }

      case 'LDR_PHOTORESISTOR': {
        // 5mm ceramic disc with serpentine CdS trace
        const discGeo = new THREE.CylinderGeometry(0.0026, 0.0026, 0.0012, 20);
        const discMat = new THREE.MeshStandardMaterial({ color: 0xf4f4f5, roughness: 0.5 });
        const disc = new THREE.Mesh(discGeo, discMat);
        disc.position.y = 0.004;
        group.add(disc);

        const trackGeo = new THREE.BoxGeometry(0.0035, 0.0002, 0.0035);
        const trackMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.3 });
        const track = new THREE.Mesh(trackGeo, trackMat);
        track.position.y = 0.0047;
        group.add(track);

        // 2 leads
        const leadMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.9, roughness: 0.2 });
        [-0.00127, 0.00127].forEach((x) => {
          const lead = new THREE.Mesh(new THREE.CylinderGeometry(0.0003, 0.0003, 0.007, 8), leadMat);
          lead.position.set(x, 0.0005, 0);
          group.add(lead);
        });
        break;
      }

      case 'POWER_MODULE_MB102': {
        // Blue Dual-Rail Breadboard Power Supply Board
        const pcbGeo = new THREE.BoxGeometry(0.052, 0.0018, 0.032);
        const pcbMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.35 });
        const pcb = new THREE.Mesh(pcbGeo, pcbMat);
        pcb.position.y = 0.006;
        group.add(pcb);

        // USB socket
        const usbGeo = new THREE.BoxGeometry(0.012, 0.006, 0.010);
        const usbMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.9, roughness: 0.2 });
        const usb = new THREE.Mesh(usbGeo, usbMat);
        usb.position.set(-0.016, 0.009, 0.008);
        group.add(usb);

        // DC Barrel Jack
        const jackGeo = new THREE.CylinderGeometry(0.0045, 0.0045, 0.011, 16);
        const jackMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.5 });
        const jack = new THREE.Mesh(jackGeo, jackMat);
        jack.rotation.z = Math.PI / 2;
        jack.position.set(-0.016, 0.009, -0.008);
        group.add(jack);

        // Yellow power latch button
        const btnGeo = new THREE.CylinderGeometry(0.0025, 0.0025, 0.004, 16);
        const btnMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.3 });
        const btn = new THREE.Mesh(btnGeo, btnMat);
        btn.position.set(0.008, 0.008, 0);
        group.add(btn);

        // Green power indicator LED
        const pwrLedGeo = new THREE.SphereGeometry(0.0015, 12, 12);
        const pwrLedMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 0.9 });
        const pwrLed = new THREE.Mesh(pwrLedGeo, pwrLedMat);
        pwrLed.position.set(0.016, 0.0075, 0.008);
        group.add(pwrLed);
        break;
      }

      case 'DIP8_LM393': {
        // DIP-8 package with notch and 8 pins
        const bodyGeo = new THREE.BoxGeometry(0.0096, 0.0035, 0.0064);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.4 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.004;
        group.add(body);

        // Notch
        const notchGeo = new THREE.CylinderGeometry(0.0008, 0.0008, 0.0036, 12, 1, false, 0, Math.PI);
        const notch = new THREE.Mesh(notchGeo, new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.6 }));
        notch.rotation.y = -Math.PI / 2;
        notch.position.set(-0.0048, 0.004, 0);
        group.add(notch);

        // 8 DIP pins
        const pinMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.9, roughness: 0.2 });
        for (let i = 0; i < 4; i++) {
          const x = (i - 1.5) * 0.00254;
          const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.0006, 0.006, 0.0006), pinMat);
          p1.position.set(x, 0.001, -0.00381);
          group.add(p1);
          const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.0006, 0.006, 0.0006), pinMat);
          p2.position.set(x, 0.001, 0.00381);
          group.add(p2);
        }
        break;
      }

      case 'DIP16_CD4017':
      case 'DIP16_74HC595':
      case 'DIP16_L293D':
      case 'IC_SOCKET_DIP': {
        // DIP-16 molded package (19.2mm long x 6.4mm wide)
        const isSocket = comp.type === 'IC_SOCKET_DIP';
        const bodyGeo = new THREE.BoxGeometry(0.0198, isSocket ? 0.0025 : 0.0035, 0.0076);
        const bodyMat = new THREE.MeshStandardMaterial({
          color: isSocket ? 0x27272a : 0x18181b,
          roughness: isSocket ? 0.6 : 0.35,
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.004;
        group.add(body);

        // Notch
        const notchGeo = new THREE.CylinderGeometry(0.001, 0.001, 0.0036, 12, 1, false, 0, Math.PI);
        const notch = new THREE.Mesh(notchGeo, new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.6 }));
        notch.rotation.y = -Math.PI / 2;
        notch.position.set(-0.0099, 0.004, 0);
        group.add(notch);

        // 16 DIP pins (8 per side at 2.54mm pitch)
        const pinMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.9, roughness: 0.2 });
        for (let i = 0; i < 8; i++) {
          const x = (i - 3.5) * 0.00254;
          const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.0006, 0.006, 0.0006), pinMat);
          p1.position.set(x, 0.001, -0.00381);
          group.add(p1);
          const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.0006, 0.006, 0.0006), pinMat);
          p2.position.set(x, 0.001, 0.00381);
          group.add(p2);
        }
        break;
      }

      case 'CAPACITOR_FILM': {
        // Box polypropylene film capacitor (orange/yellow)
        const boxGeo = new THREE.BoxGeometry(0.0072, 0.0065, 0.0035);
        const boxMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3 });
        const box = new THREE.Mesh(boxGeo, boxMat);
        box.position.y = 0.004;
        group.add(box);

        const leadMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.9, roughness: 0.2 });
        [-0.00127, 0.00127].forEach((x) => {
          const lead = new THREE.Mesh(new THREE.CylinderGeometry(0.0003, 0.0003, 0.007, 8), leadMat);
          lead.position.set(x, 0.0005, 0);
          group.add(lead);
        });
        break;
      }

      case 'LED_RGB': {
        // 5mm 4-pin RGB LED with clear diffused dome
        const domeGeo = new THREE.SphereGeometry(0.0025, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        const domeMat = new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          roughness: 0.1,
          transmission: 0.85,
          transparent: true,
          opacity: 0.8,
        });
        const dome = new THREE.Mesh(domeGeo, domeMat);
        dome.position.y = 0.0065;
        group.add(dome);

        const cylGeo = new THREE.CylinderGeometry(0.0025, 0.0025, 0.0035, 16);
        const cyl = new THREE.Mesh(cylGeo, domeMat);
        cyl.position.y = 0.0045;
        group.add(cyl);

        // 4 silver leads (R, Cathode, G, B)
        const leadMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.9, roughness: 0.2 });
        [-0.00381, -0.00127, 0.00127, 0.00381].forEach((x, idx) => {
          const lead = new THREE.Mesh(new THREE.CylinderGeometry(0.0003, 0.0003, 0.007, 8), leadMat);
          lead.position.set(x, 0.0005, 0);
          group.add(lead);
        });
        break;
      }

      case 'SWITCH_SLIDE': {
        // Miniature 3-pin SPDT slide switch
        const baseGeo = new THREE.BoxGeometry(0.0085, 0.0035, 0.004);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.85, roughness: 0.25 });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.y = 0.0035;
        group.add(base);

        // Slide knob
        const knobGeo = new THREE.BoxGeometry(0.002, 0.003, 0.002);
        const knobMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.5 });
        const knob = new THREE.Mesh(knobGeo, knobMat);
        const isClosed = comp.state?.isClosed ?? false;
        knob.position.set(isClosed ? 0.002 : -0.002, 0.006, 0);
        group.add(knob);

        // 3 pins
        const leadMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.9, roughness: 0.2 });
        [-0.00254, 0, 0.00254].forEach((x) => {
          const lead = new THREE.Mesh(new THREE.BoxGeometry(0.0005, 0.006, 0.0005), leadMat);
          lead.position.set(x, 0.0005, 0);
          group.add(lead);
        });
        break;
      }

      case 'BUZZER_ACTIVE':
      case 'BUZZER_PASSIVE': {
        // Black round sound chamber
        const isActive = comp.type === 'BUZZER_ACTIVE';
        const bodyGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.009, 24);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.4 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.0055;
        group.add(body);

        // Top sound hole
        const holeGeo = new THREE.CylinderGeometry(0.0015, 0.0015, 0.001, 16);
        const holeMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.7 });
        const hole = new THREE.Mesh(holeGeo, holeMat);
        hole.position.y = 0.0101;
        group.add(hole);

        if (isActive) {
          // Yellow peel-off tab
          const tabGeo = new THREE.BoxGeometry(0.004, 0.0004, 0.006);
          const tabMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.5 });
          const tab = new THREE.Mesh(tabGeo, tabMat);
          tab.position.set(0.002, 0.0102, 0);
          group.add(tab);
        }

        // 2 pins
        const leadMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.9, roughness: 0.2 });
        [-0.00254, 0.00254].forEach((x) => {
          const lead = new THREE.Mesh(new THREE.CylinderGeometry(0.0003, 0.0003, 0.007, 8), leadMat);
          lead.position.set(x, 0.0005, 0);
          group.add(lead);
        });
        break;
      }

      case 'BATTERY_HOLDER_4AA': {
        // 4xAA battery sled (black ABS body with 4 AA cells)
        const sledGeo = new THREE.BoxGeometry(0.058, 0.016, 0.032);
        const sledMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.6 });
        const sled = new THREE.Mesh(sledGeo, sledMat);
        sled.position.y = 0.008;
        group.add(sled);

        // 4 cylindrical battery cells
        const cellGeo = new THREE.CylinderGeometry(0.0065, 0.0065, 0.050, 16);
        const cellMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.5, roughness: 0.3 });
        [-0.010, -0.0033, 0.0033, 0.010].forEach((z) => {
          const cell = new THREE.Mesh(cellGeo, cellMat);
          cell.rotation.z = Math.PI / 2;
          cell.position.set(0, 0.010, z);
          group.add(cell);
        });
        break;
      }

      case 'ROTARY_ENCODER_KY040': {
        // Blue PCB with metal rotary shaft
        const pcbGeo = new THREE.BoxGeometry(0.020, 0.0016, 0.018);
        const pcbMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.35 });
        const pcb = new THREE.Mesh(pcbGeo, pcbMat);
        pcb.position.y = 0.006;
        group.add(pcb);

        // Knurled shaft
        const shaftGeo = new THREE.CylinderGeometry(0.003, 0.003, 0.014, 16);
        const shaftMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.85, roughness: 0.25 });
        const shaft = new THREE.Mesh(shaftGeo, shaftMat);
        shaft.position.set(0, 0.014, 0);
        group.add(shaft);

        // Hex nut
        const nutGeo = new THREE.CylinderGeometry(0.0045, 0.0045, 0.002, 6);
        const nut = new THREE.Mesh(nutGeo, shaftMat);
        nut.position.set(0, 0.008, 0);
        group.add(nut);
        break;
      }

      case 'KEYPAD_4X4': {
        // 4x4 matrix membrane keypad
        const padGeo = new THREE.BoxGeometry(0.045, 0.0015, 0.045);
        const padMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.7 });
        const pad = new THREE.Mesh(padGeo, padMat);
        pad.position.y = 0.002;
        group.add(pad);

        // 16 button pads
        const btnGeo = new THREE.BoxGeometry(0.007, 0.001, 0.007);
        const btnMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.4 });
        for (let r = 0; r < 4; r++) {
          for (let c = 0; c < 4; c++) {
            const b = new THREE.Mesh(btnGeo, btnMat);
            b.position.set((c - 1.5) * 0.009, 0.003, (r - 1.5) * 0.009);
            group.add(b);
          }
        }
        break;
      }

      case 'REGULATOR_AMS1117_3V3': {
        // SOT-223 / TO-220 3-pin tab
        const bodyGeo = new THREE.BoxGeometry(0.0065, 0.004, 0.003);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.4 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.004;
        group.add(body);

        const tabGeo = new THREE.BoxGeometry(0.0055, 0.003, 0.0006);
        const tabMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.9, roughness: 0.2 });
        const tab = new THREE.Mesh(tabGeo, tabMat);
        tab.position.set(0, 0.006, -0.0015);
        group.add(tab);

        // 3 pins
        [-0.00254, 0, 0.00254].forEach((x) => {
          const lead = new THREE.Mesh(new THREE.CylinderGeometry(0.0003, 0.0003, 0.007, 8), tabMat);
          lead.position.set(x, 0.0005, 0);
          group.add(lead);
        });
        break;
      }

      case 'SCREW_TERMINAL_2P': {
        // Blue 2-pole terminal block with brass clamping screw holes
        const bodyGeo = new THREE.BoxGeometry(0.010, 0.009, 0.0075);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.35 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.0055;
        group.add(body);

        const screwGeo = new THREE.CylinderGeometry(0.0015, 0.0015, 0.001, 12);
        const screwMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.9, roughness: 0.2 });
        [-0.00254, 0.00254].forEach((x) => {
          const screw = new THREE.Mesh(screwGeo, screwMat);
          screw.position.set(x, 0.0101, 0);
          group.add(screw);
        });
        break;
      }

      case 'RELAY_MODULE_5V': {
        // Blue cube 5V Songle relay box on PCB
        const pcbGeo = new THREE.BoxGeometry(0.032, 0.0016, 0.024);
        const pcbMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.4 });
        const pcb = new THREE.Mesh(pcbGeo, pcbMat);
        pcb.position.y = 0.006;
        group.add(pcb);

        const cubeGeo = new THREE.BoxGeometry(0.019, 0.015, 0.015);
        const cubeMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.3 });
        const cube = new THREE.Mesh(cubeGeo, cubeMat);
        cube.position.set(0.003, 0.014, 0);
        group.add(cube);

        // Terminal block
        const termGeo = new THREE.BoxGeometry(0.008, 0.010, 0.018);
        const termMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.4 });
        const term = new THREE.Mesh(termGeo, termMat);
        term.position.set(-0.011, 0.011, 0);
        group.add(term);
        break;
      }

      case 'SERVO_SG90': {
        // Translucent blue 9g micro servo casing with horn
        const bodyGeo = new THREE.BoxGeometry(0.023, 0.022, 0.012);
        const bodyMat = new THREE.MeshPhysicalMaterial({
          color: 0x3b82f6,
          roughness: 0.2,
          transmission: 0.6,
          transparent: true,
          opacity: 0.85,
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.011;
        group.add(body);

        // Splined shaft + white horn arm
        const hornGeo = new THREE.BoxGeometry(0.018, 0.002, 0.004);
        const hornMat = new THREE.MeshStandardMaterial({ color: 0xf4f4f5, roughness: 0.3 });
        const horn = new THREE.Mesh(hornGeo, hornMat);
        horn.position.set(0.005, 0.023, 0);
        const angleDeg = comp.state?.servoAngle ?? 90;
        horn.rotation.y = (angleDeg * Math.PI) / 180;
        group.add(horn);
        break;
      }

      case 'DC_GEAR_MOTOR': {
        // Yellow TT-style gearbox + motor can + black rubber tire wheel
        const gearGeo = new THREE.BoxGeometry(0.035, 0.018, 0.018);
        const gearMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.4 });
        const gear = new THREE.Mesh(gearGeo, gearMat);
        gear.position.y = 0.015;
        group.add(gear);

        // Motor cylinder
        const motorGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.022, 16);
        const motorMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.8, roughness: 0.3 });
        const motor = new THREE.Mesh(motorGeo, motorMat);
        motor.rotation.z = Math.PI / 2;
        motor.position.set(-0.022, 0.015, 0);
        group.add(motor);

        // Wheel + rubber tire
        const tireGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.008, 24);
        const tireMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.85 });
        const tire = new THREE.Mesh(tireGeo, tireMat);
        tire.rotation.x = Math.PI / 2;
        tire.position.set(0.012, 0.018, 0.014);
        group.add(tire);
        break;
      }

      case 'WS2812B_STRIP': {
        // White flexible PCB strip with 6 SMD 5050 RGB LEDs
        const stripGeo = new THREE.BoxGeometry(0.042, 0.001, 0.010);
        const stripMat = new THREE.MeshStandardMaterial({ color: 0xf4f4f5, roughness: 0.3 });
        const strip = new THREE.Mesh(stripGeo, stripMat);
        strip.position.y = 0.005;
        group.add(strip);

        const ledGeo = new THREE.BoxGeometry(0.0045, 0.0015, 0.0045);
        const ledMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
        for (let i = 0; i < 5; i++) {
          const l = new THREE.Mesh(ledGeo, ledMat);
          l.position.set((i - 2) * 0.008, 0.006, 0);
          group.add(l);
        }
        break;
      }

      case 'MOSFET_DRIVER_MODULE': {
        // Red double-MOSFET trigger board
        const pcbGeo = new THREE.BoxGeometry(0.028, 0.0016, 0.016);
        const pcbMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.4 });
        const pcb = new THREE.Mesh(pcbGeo, pcbMat);
        pcb.position.y = 0.006;
        group.add(pcb);
        break;
      }

      case 'SENSOR_HC_SR04': {
        // Dual aluminum ultrasonic transducers ("T" and "R")
        const pcbGeo = new THREE.BoxGeometry(0.042, 0.0016, 0.020);
        const pcbMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.35 });
        const pcb = new THREE.Mesh(pcbGeo, pcbMat);
        pcb.position.y = 0.006;
        group.add(pcb);

        const tubeGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.012, 20);
        const tubeMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.85, roughness: 0.2 });
        [-0.013, 0.013].forEach((x) => {
          const tube = new THREE.Mesh(tubeGeo, tubeMat);
          tube.position.set(x, 0.012, 0);
          group.add(tube);
        });
        break;
      }

      case 'SENSOR_DHT22': {
        // White slotted hygrometer cage
        const cageGeo = new THREE.BoxGeometry(0.014, 0.018, 0.008);
        const cageMat = new THREE.MeshStandardMaterial({ color: 0xf4f4f5, roughness: 0.4 });
        const cage = new THREE.Mesh(cageGeo, cageMat);
        cage.position.y = 0.012;
        group.add(cage);
        break;
      }

      case 'SENSOR_PIR': {
        // White translucent faceted Fresnel dome lens on green PCB
        const pcbGeo = new THREE.BoxGeometry(0.030, 0.0016, 0.024);
        const pcbMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.4 });
        const pcb = new THREE.Mesh(pcbGeo, pcbMat);
        pcb.position.y = 0.006;
        group.add(pcb);

        const domeGeo = new THREE.SphereGeometry(0.008, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        const domeMat = new THREE.MeshPhysicalMaterial({ color: 0xf4f4f5, roughness: 0.3, transmission: 0.5, transparent: true, opacity: 0.9 });
        const dome = new THREE.Mesh(domeGeo, domeMat);
        dome.position.y = 0.007;
        group.add(dome);
        break;
      }

      case 'SENSOR_SOUND': {
        // Silver electret microphone capsule on red PCB
        const pcbGeo = new THREE.BoxGeometry(0.028, 0.0016, 0.014);
        const pcbMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.4 });
        const pcb = new THREE.Mesh(pcbGeo, pcbMat);
        pcb.position.y = 0.006;
        group.add(pcb);

        const micGeo = new THREE.CylinderGeometry(0.0045, 0.0045, 0.006, 16);
        const micMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.85, roughness: 0.25 });
        const mic = new THREE.Mesh(micGeo, micMat);
        mic.position.set(-0.008, 0.009, 0);
        group.add(mic);
        break;
      }

      case 'SENSOR_SOIL': {
        // Dual ENIG gold capacitive moisture prongs
        const probeGeo = new THREE.BoxGeometry(0.018, 0.038, 0.0016);
        const probeMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.5 });
        const probe = new THREE.Mesh(probeGeo, probeMat);
        probe.position.y = 0.020;
        group.add(probe);
        break;
      }

      case 'SENSOR_IR_RECEIVER':
      case 'SENSOR_HALL': {
        // Miniature 3-pin epoxy sensor
        const bodyGeo = new THREE.BoxGeometry(0.0045, 0.0045, 0.002);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.35 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.004;
        group.add(body);

        const leadMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.9, roughness: 0.2 });
        [-0.00127, 0, 0.00127].forEach((x) => {
          const lead = new THREE.Mesh(new THREE.CylinderGeometry(0.0003, 0.0003, 0.007, 8), leadMat);
          lead.position.set(x, 0.0005, 0);
          group.add(lead);
        });
        break;
      }

      case 'DISPLAY_OLED_I2C': {
        // 0.96" I2C OLED display (Blue PCB with dark glass display)
        const pcbGeo = new THREE.BoxGeometry(0.027, 0.0016, 0.027);
        const pcbMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.35 });
        const pcb = new THREE.Mesh(pcbGeo, pcbMat);
        pcb.position.y = 0.006;
        group.add(pcb);

        const glassGeo = new THREE.BoxGeometry(0.023, 0.0012, 0.016);
        const glassMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.1 });
        const glass = new THREE.Mesh(glassGeo, glassMat);
        glass.position.set(0, 0.0075, 0.002);
        group.add(glass);

        // Glowing OLED header pixels
        const pixGeo = new THREE.BoxGeometry(0.020, 0.0005, 0.003);
        const pixMat = new THREE.MeshStandardMaterial({ color: 0xeab308, emissive: 0xeab308, emissiveIntensity: 0.8 });
        const pix = new THREE.Mesh(pixGeo, pixMat);
        pix.position.set(0, 0.0082, -0.004);
        group.add(pix);
        break;
      }

      case 'DISPLAY_LCD_1602_I2C': {
        // 16x2 Character LCD with I2C adapter backpack
        const pcbGeo = new THREE.BoxGeometry(0.075, 0.0018, 0.034);
        const pcbMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.4 });
        const pcb = new THREE.Mesh(pcbGeo, pcbMat);
        pcb.position.y = 0.006;
        group.add(pcb);

        const bezelGeo = new THREE.BoxGeometry(0.065, 0.004, 0.024);
        const bezelMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.3 });
        const bezel = new THREE.Mesh(bezelGeo, bezelMat);
        bezel.position.y = 0.008;
        group.add(bezel);

        // Blue LCD backlit screen
        const screenGeo = new THREE.BoxGeometry(0.058, 0.001, 0.018);
        const screenMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, emissive: 0x1d4ed8, emissiveIntensity: 0.6 });
        const screen = new THREE.Mesh(screenGeo, screenMat);
        screen.position.set(0, 0.0102, 0);
        group.add(screen);
        break;
      }

      case 'ARDUINO_NANO': {
        // Blue DIP-30 microcontroller board
        const pcbGeo = new THREE.BoxGeometry(0.043, 0.0018, 0.018);
        const pcbMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.35 });
        const pcb = new THREE.Mesh(pcbGeo, pcbMat);
        pcb.position.y = 0.006;
        group.add(pcb);

        // ATmega328P chip
        const chipGeo = new THREE.BoxGeometry(0.008, 0.0015, 0.008);
        const chipMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.3 });
        const chip = new THREE.Mesh(chipGeo, chipMat);
        chip.position.set(0.004, 0.0075, 0);
        group.add(chip);

        // USB socket
        const usbGeo = new THREE.BoxGeometry(0.008, 0.004, 0.007);
        const usbMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.9, roughness: 0.2 });
        const usb = new THREE.Mesh(usbGeo, usbMat);
        usb.position.set(-0.018, 0.0085, 0);
        group.add(usb);
        break;
      }

      case 'ESP32_DEVKIT': {
        // Black 30-pin dev board with metal RF can
        const pcbGeo = new THREE.BoxGeometry(0.051, 0.0018, 0.026);
        const pcbMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.4 });
        const pcb = new THREE.Mesh(pcbGeo, pcbMat);
        pcb.position.y = 0.006;
        group.add(pcb);

        // Metal RF shield can ("ESP-WROOM-32")
        const canGeo = new THREE.BoxGeometry(0.018, 0.0028, 0.016);
        const canMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.95, roughness: 0.15 });
        const can = new THREE.Mesh(canGeo, canMat);
        can.position.set(0.006, 0.008, 0);
        group.add(can);
        break;
      }

      case 'ARDUINO_UNO_R3': {
        // Italian blue board with USB-B, DC jack, headers
        const pcbGeo = new THREE.BoxGeometry(0.068, 0.002, 0.053);
        const pcbMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.35 });
        const pcb = new THREE.Mesh(pcbGeo, pcbMat);
        pcb.position.y = 0.006;
        group.add(pcb);

        // USB Type-B port
        const usbGeo = new THREE.BoxGeometry(0.016, 0.011, 0.012);
        const usbMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.9, roughness: 0.2 });
        const usb = new THREE.Mesh(usbGeo, usbMat);
        usb.position.set(-0.027, 0.011, -0.015);
        group.add(usb);

        // DC barrel jack
        const dcGeo = new THREE.BoxGeometry(0.014, 0.011, 0.009);
        const dcMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.6 });
        const dc = new THREE.Mesh(dcGeo, dcMat);
        dc.position.set(-0.027, 0.011, 0.016);
        group.add(dc);
        break;
      }

      case 'TOOL_SOLDERING_IRON': {
        // Soldering station base stand and iron handle
        const baseGeo = new THREE.BoxGeometry(0.055, 0.012, 0.038);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.5 });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.y = 0.006;
        group.add(base);

        // Handle and heater tip
        const handleGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.055, 16);
        const handleMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.4 });
        const handle = new THREE.Mesh(handleGeo, handleMat);
        handle.rotation.z = Math.PI / 4;
        handle.position.set(0.015, 0.025, 0);
        group.add(handle);

        const tipGeo = new THREE.ConeGeometry(0.002, 0.012, 16);
        const tipMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.5, metalness: 0.9 });
        const tip = new THREE.Mesh(tipGeo, tipMat);
        tip.rotation.z = -Math.PI / 4;
        tip.position.set(0.038, 0.046, 0);
        group.add(tip);
        break;
      }

      default: {
        const fallbackGeo = new THREE.BoxGeometry(0.012, 0.006, 0.006);
        const fallbackMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.4 });
        group.add(new THREE.Mesh(fallbackGeo, fallbackMat));
      }
    }

    group.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) {
        c.userData = { componentId: comp.id, isCircuitComponent: true };
      }
    });

    return group;
  };

  // 2. Render & Reconcile Placed Components (Flicker-Free Diffing)
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const compContainer = componentsGroupRef.current || scene;
    const currentRecords = componentRecordsRef.current;
    const incomingCompMap = new Map(components.map((c) => [c.id, c]));

    // 1. Remove deleted components
    for (const [id, record] of Array.from(currentRecords.entries())) {
      if (!incomingCompMap.has(id)) {
        if (record.group.parent) {
          record.group.parent.remove(record.group);
        }
        compContainer.remove(record.group);
        if (record.light) {
          const lIdx = activeLightsRef.current.indexOf(record.light);
          if (lIdx !== -1) activeLightsRef.current.splice(lIdx, 1);
        }
        record.group.traverse((c) => {
          if ((c as THREE.Mesh).geometry) (c as THREE.Mesh).geometry.dispose();
          if ((c as THREE.Mesh).material) {
            if (Array.isArray((c as THREE.Mesh).material)) {
              ((c as THREE.Mesh).material as THREE.Material[]).forEach((m) => m.dispose());
            } else {
              ((c as THREE.Mesh).material as THREE.Material).dispose();
            }
          }
        });
        currentRecords.delete(id);
        componentMeshesRef.current.delete(id);
      }
    }

    // 2. Add new or update existing components
    components.forEach((comp) => {
      let record = currentRecords.get(comp.id);

      if (!record) {
        // Create new group once
        const compGroup = new THREE.Group();
        compGroup.position.set(comp.position[0], comp.position[2], comp.position[1]);
        compGroup.rotation.set(comp.rotation[0], comp.rotation[1], comp.rotation[2]);
        compGroup.userData = { componentId: comp.id, isCircuitComponent: true };

        // Selection highlight ring (sized appropriately for component)
        const isBatt = comp.type === 'BATTERY_9V';
        const isSpk = comp.type === 'SPEAKER';
        const isBench = isBenchComponent(comp.type);
        const selRingGeo = isBatt || isSpk
          ? new THREE.RingGeometry(0.018, 0.024, 32)
          : new THREE.RingGeometry(0.008, 0.012, 24);
        const selRingMat = new THREE.MeshBasicMaterial({
          color: 0xf59e0b,
          side: THREE.DoubleSide,
        });
        const selRing = new THREE.Mesh(selRingGeo, selRingMat);
        selRing.rotation.x = -Math.PI / 2;
        selRing.position.y = isBench ? 0.001 : Math.max(0.001, 0.0089 - comp.position[2]);
        selRing.visible = comp.id === selectedComponentId;
        compGroup.add(selRing);

        // Invisible Hit-box proxy for reliable selection and dragging
        const hitBoxGeo = isBatt
          ? new THREE.BoxGeometry(0.032, 0.054, 0.022)
          : isSpk
          ? new THREE.BoxGeometry(0.036, 0.024, 0.036)
          : new THREE.BoxGeometry(0.024, 0.024, 0.016);
        const hitBoxMat = new THREE.MeshBasicMaterial({ visible: false });
        const hitBox = new THREE.Mesh(hitBoxGeo, hitBoxMat);
        hitBox.position.y = isBatt ? 0.025 : isSpk ? 0.012 : 0.008;
        hitBox.userData = { componentId: comp.id, isHitProxy: true };
        compGroup.add(hitBox);

        // Optional LED / Bulb point light
        let light: THREE.PointLight | undefined;
        if (comp.type === 'LED' || comp.type === 'BULB_INCANDESCENT') {
          const isBulb = comp.type === 'BULB_INCANDESCENT';
          const lightColor = isBulb
            ? 0xffaa33
            : comp.ledColor === 'GREEN'
            ? 0x22c55e
            : comp.ledColor === 'BLUE'
            ? 0x3b82f6
            : comp.ledColor === 'YELLOW'
            ? 0xf59e0b
            : 0xef4444;
          // Incandescent bulb has wide radiant coverage (0.35m); LED has focused 0.18m
          const lightRadius = isBulb ? 0.35 : 0.18;
          light = new THREE.PointLight(lightColor, 0, lightRadius, 1.8);
          // Filament center is at Y=0.024; LED dome is at Y=0.012
          light.position.set(0, isBulb ? 0.024 : 0.012, 0);
          light.userData = { targetIntensity: 0 };
          compGroup.add(light);
          activeLightsRef.current.push(light);
        }

        record = {
          group: compGroup,
          selRing,
          light,
          health: comp.health,
        };
        currentRecords.set(comp.id, record);
        componentMeshesRef.current.set(comp.id, compGroup);
        compContainer.add(compGroup);

        // Attach interactive snap terminals for 9V Battery or DC Power Supply
        if (comp.type === 'BATTERY_9V' || comp.type === 'DC_SOURCE') {
          // Positive Stud (+) with red collar ring
          const posTermGeo = new THREE.CylinderGeometry(0.0032, 0.0032, 0.005, 16);
          const posTermMat = new THREE.MeshStandardMaterial({
            color: 0xd4d4d8,
            metalness: 0.95,
            roughness: 0.15,
          });
          const posTerm = new THREE.Mesh(posTermGeo, posTermMat);
          posTerm.position.set(0.0064, 0.048, 0);
          posTerm.userData = {
            isBatteryTerminal: true,
            terminalId: `${comp.id}:pos`,
            componentId: comp.id,
            name: '9V Battery (+) Positive Terminal',
          };
          compGroup.add(posTerm);

          const posRingGeo = new THREE.RingGeometry(0.0032, 0.0052, 16);
          const posRingMat = new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide });
          const posRing = new THREE.Mesh(posRingGeo, posRingMat);
          posRing.rotation.x = -Math.PI / 2;
          posRing.position.set(0.0064, 0.0456, 0);
          compGroup.add(posRing);

          // Negative Stud (-) with black collar ring
          const negTermGeo = new THREE.CylinderGeometry(0.0036, 0.0036, 0.005, 6);
          const negTermMat = new THREE.MeshStandardMaterial({
            color: 0xa1a1aa,
            metalness: 0.9,
            roughness: 0.25,
          });
          const negTerm = new THREE.Mesh(negTermGeo, negTermMat);
          negTerm.position.set(-0.0064, 0.048, 0);
          negTerm.userData = {
            isBatteryTerminal: true,
            terminalId: `${comp.id}:neg`,
            componentId: comp.id,
            name: '9V Battery (-) Negative Terminal',
          };
          compGroup.add(negTerm);

          const negRingGeo = new THREE.RingGeometry(0.0036, 0.0056, 16);
          const negRingMat = new THREE.MeshBasicMaterial({ color: 0x18181b, side: THREE.DoubleSide });
          const negRing = new THREE.Mesh(negRingGeo, negRingMat);
          negRing.rotation.x = -Math.PI / 2;
          negRing.position.set(-0.0064, 0.0456, 0);
          compGroup.add(negRing);
        }

        // Attach interactive snap terminals for 8Ω Mini Speaker (Dual top binding posts)
        if (comp.type === 'SPEAKER') {
          // Positive Terminal Stud (+) with red collar ring
          const posTermGeo = new THREE.CylinderGeometry(0.0028, 0.0028, 0.006, 16);
          const posTermMat = new THREE.MeshStandardMaterial({
            color: 0xd4d4d8,
            metalness: 0.95,
            roughness: 0.15,
          });
          const posTerm = new THREE.Mesh(posTermGeo, posTermMat);
          posTerm.position.set(-0.009, 0.014, 0);
          posTerm.userData = {
            isBatteryTerminal: true,
            terminalId: `${comp.id}:pos`,
            componentId: comp.id,
            name: '8Ω Mini Speaker (+) Positive Terminal',
          };
          compGroup.add(posTerm);

          const posRingGeo = new THREE.RingGeometry(0.0028, 0.005, 16);
          const posRingMat = new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide });
          const posRing = new THREE.Mesh(posRingGeo, posRingMat);
          posRing.rotation.x = -Math.PI / 2;
          posRing.position.set(-0.009, 0.0112, 0);
          compGroup.add(posRing);

          // Negative Terminal Stud (-) with black collar ring
          const negTermGeo = new THREE.CylinderGeometry(0.0028, 0.0028, 0.006, 16);
          const negTermMat = new THREE.MeshStandardMaterial({
            color: 0xa1a1aa,
            metalness: 0.9,
            roughness: 0.25,
          });
          const negTerm = new THREE.Mesh(negTermGeo, negTermMat);
          negTerm.position.set(0.009, 0.014, 0);
          negTerm.userData = {
            isBatteryTerminal: true,
            terminalId: `${comp.id}:neg`,
            componentId: comp.id,
            name: '8Ω Mini Speaker (-) Negative Terminal',
          };
          compGroup.add(negTerm);

          const negRingGeo = new THREE.RingGeometry(0.0028, 0.005, 16);
          const negRingMat = new THREE.MeshBasicMaterial({ color: 0x18181b, side: THREE.DoubleSide });
          const negRing = new THREE.Mesh(negRingGeo, negRingMat);
          negRing.rotation.x = -Math.PI / 2;
          compGroup.add(negRing);
        }

        if (comp.type === 'BATTERY_HOLDER_4AA' || comp.type === 'DC_GEAR_MOTOR') {
          const isBatt = comp.type === 'BATTERY_HOLDER_4AA';
          const posTerm = new THREE.Mesh(
            new THREE.CylinderGeometry(0.0028, 0.0028, 0.006, 16),
            new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.95, roughness: 0.15 })
          );
          posTerm.position.set(isBatt ? 0.0064 : -0.009, isBatt ? 0.018 : 0.014, 0);
          posTerm.userData = {
            isBatteryTerminal: true,
            terminalId: `${comp.id}:pos`,
            componentId: comp.id,
            name: isBatt ? '4xAA Battery (+) Positive' : 'DC Motor (+) Terminal',
          };
          compGroup.add(posTerm);

          const negTerm = new THREE.Mesh(
            new THREE.CylinderGeometry(0.0028, 0.0028, 0.006, 16),
            new THREE.MeshStandardMaterial({ color: 0xa1a1aa, metalness: 0.9, roughness: 0.25 })
          );
          negTerm.position.set(isBatt ? -0.0064 : 0.009, isBatt ? 0.018 : 0.014, 0);
          negTerm.userData = {
            isBatteryTerminal: true,
            terminalId: `${comp.id}:neg`,
            componentId: comp.id,
            name: isBatt ? '4xAA Battery (-) Negative' : 'DC Motor (-) Terminal',
          };
          compGroup.add(negTerm);
        }

        if (comp.type === 'SERVO_SG90') {
          const servoPins = [
            { id: 'gnd', name: 'GND (Brown)', offset: -0.00254, color: 0x3f3f46 },
            { id: 'vcc', name: 'VCC (Red, 5V)', offset: 0, color: 0xef4444 },
            { id: 'sig', name: 'PWM SIG (Orange)', offset: 0.00254, color: 0xf97316 },
          ];
          servoPins.forEach((sp) => {
            const pinMesh = new THREE.Mesh(
              new THREE.CylinderGeometry(0.0016, 0.0016, 0.006, 12),
              new THREE.MeshStandardMaterial({ color: sp.color, metalness: 0.8, roughness: 0.2 })
            );
            pinMesh.position.set(sp.offset, 0.018, 0);
            pinMesh.userData = {
              isBatteryTerminal: true,
              terminalId: `${comp.id}:${sp.id}`,
              componentId: comp.id,
              name: `SG90 Servo ${sp.name}`,
            };
            compGroup.add(pinMesh);
          });
        }

        if (comp.type === 'RELAY_MODULE_5V') {
          const relayPins = [
            { id: 'vcc', name: 'VCC (5V)', offset: -0.007, color: 0xef4444 },
            { id: 'gnd', name: 'GND', offset: -0.0035, color: 0x18181b },
            { id: 'in', name: 'IN (Trigger)', offset: 0, color: 0x3b82f6 },
            { id: 'no', name: 'NO (Normally Open)', offset: 0.0035, color: 0x10b981 },
            { id: 'com', name: 'COM (Common)', offset: 0.007, color: 0xf59e0b },
            { id: 'nc', name: 'NC (Normally Closed)', offset: 0.0105, color: 0x6366f1 },
          ];
          relayPins.forEach((rp) => {
            const rMesh = new THREE.Mesh(
              new THREE.CylinderGeometry(0.0018, 0.0018, 0.007, 12),
              new THREE.MeshStandardMaterial({ color: rp.color, metalness: 0.85, roughness: 0.2 })
            );
            rMesh.position.set(rp.offset, 0.016, 0);
            rMesh.userData = {
              isBatteryTerminal: true,
              terminalId: `${comp.id}:${rp.id}`,
              componentId: comp.id,
              name: `Relay ${rp.name}`,
            };
            compGroup.add(rMesh);
          });
        }

        if (comp.type === 'ARDUINO_UNO_R3') {
          const unoPins = [
            { id: '5v', name: '5V Power Output', offset: -0.02, color: 0xef4444 },
            { id: '3v3', name: '3.3V Output', offset: -0.015, color: 0xf97316 },
            { id: 'gnd', name: 'GND', offset: -0.01, color: 0x18181b },
            { id: 'vin', name: 'VIN Power Input', offset: -0.005, color: 0x8b5cf6 },
          ];
          unoPins.forEach((up) => {
            const uMesh = new THREE.Mesh(
              new THREE.CylinderGeometry(0.0018, 0.0018, 0.006, 12),
              new THREE.MeshStandardMaterial({ color: up.color, metalness: 0.85, roughness: 0.2 })
            );
            uMesh.position.set(up.offset, 0.014, 0.012);
            uMesh.userData = {
              isBatteryTerminal: true,
              terminalId: `${comp.id}:${up.id}`,
              componentId: comp.id,
              name: `Uno R3 ${up.name}`,
            };
            compGroup.add(uMesh);
          });
        }

        if (comp.modelUrl) {
          loadModelPrefab(
            comp.modelUrl,
            (model) => {
              model.traverse((child) => {
                if ((child as THREE.Mesh).isMesh) {
                  const m = child as THREE.Mesh;
                  m.userData = { componentId: comp.id, isCircuitComponent: true };
                  if (Array.isArray(m.material)) {
                    m.material = m.material.map((mat) => mat.clone());
                  } else if (m.material) {
                    m.material = m.material.clone();
                  }
                }
              });
              record!.loadedModel = model;
              compGroup.add(model);
              updateModelMaterials(model, comp);
            },
            () => {
              const geo = new THREE.BoxGeometry(0.012, 0.006, 0.006);
              const mat = new THREE.MeshStandardMaterial({
                color: comp.type === 'LED' ? 0xef4444 : 0x06b6d4,
                roughness: 0.4,
              });
              const fallbackMesh = new THREE.Mesh(geo, mat);
              fallbackMesh.userData = { componentId: comp.id, isCircuitComponent: true };
              compGroup.add(fallbackMesh);
            }
          );
        } else {
          // Procedurally modeled 3D semiconductor / passive component
          const procMesh = buildProceduralMesh(comp);
          record!.loadedModel = procMesh;
          compGroup.add(procMesh);
          updateModelMaterials(procMesh, comp);
        }
      }

      // Ensure group is attached to active compContainer
      if (record.group.parent !== compContainer) {
        compContainer.add(record.group);
      }

      // Smooth position and rotation update
      record.group.position.set(comp.position[0], comp.position[2], comp.position[1]);
      record.group.rotation.set(comp.rotation[0], comp.rotation[1], comp.rotation[2]);

      // Selection indicator
      record.selRing.visible = comp.id === selectedComponentId;
      if (comp.type !== 'BATTERY_9V' && comp.type !== 'SPEAKER') {
        record.selRing.position.y = Math.max(0.001, 0.0089 - comp.position[2]);
      }

      // Light emission update
      if (record.light) {
        if (comp.health !== 'BURNED_OUT' && (comp as any).isEmitting) {
          const isBulb = comp.type === 'BULB_INCANDESCENT';
          const lightColor = isBulb
            ? 0xffaa33
            : comp.ledColor === 'GREEN'
            ? 0x22c55e
            : comp.ledColor === 'BLUE'
            ? 0x3b82f6
            : comp.ledColor === 'YELLOW'
            ? 0xf59e0b
            : 0xef4444;
          record.light.color.setHex(lightColor);

          // Bulbs radiate significantly higher luminous flux than 5mm LEDs
          const target = isBulb
            ? Math.min(5.5, Math.max(0.6, ((comp as any).emissionIntensity || 1.0) * 3.8))
            : Math.min(2.5, Math.max(0.3, ((comp as any).emissionIntensity || 1.0) * 1.8));
          record.light.userData.targetIntensity = target;
        } else {
          record.light.userData.targetIntensity = 0;
          record.light.intensity = 0;
        }
      }

      // Visual Material State (Emissive LED glow / Filament warmth / Burnout / Overheating)
      if (record.loadedModel) {
        updateModelMaterials(record.loadedModel, comp);
      }
    });

    // Sweep any orphaned component groups in compContainer
    const validCompGroups = new Set<THREE.Object3D>();
    for (const rec of currentRecords.values()) {
      validCompGroups.add(rec.group);
    }
    for (let i = compContainer.children.length - 1; i >= 0; i--) {
      const child = compContainer.children[i];
      if (!validCompGroups.has(child)) {
        compContainer.remove(child);
        child.traverse((c) => {
          if ((c as THREE.Mesh).geometry) (c as THREE.Mesh).geometry.dispose();
        });
      }
    }

    // Rebuild active battery terminals cache for raycasting
    const activeTerminals: THREE.Mesh[] = [];
    currentRecords.forEach((rec) => {
      rec.group.traverse((child) => {
        if ((child as THREE.Mesh).userData?.isBatteryTerminal) {
          activeTerminals.push(child as THREE.Mesh);
        }
      });
    });
    batteryTerminalsRef.current = activeTerminals;
  }, [components, selectedComponentId]);

  // Hologram Ghost Preview for Component Placement
  useEffect(() => {
    const ghost = ghostGroupRef.current;
    if (!ghost) return;

    while (ghost.children.length > 0) {
      const child = ghost.children[0];
      ghost.remove(child);
      if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose();
    }

    if (!placingComponent) {
      ghost.visible = false;
      return;
    }

    ghost.visible = true;

    let modelUrl = '';
    switch (placingComponent.type) {
      case 'RESISTOR':
        modelUrl = '/models/components/resistor_1k.glb';
        break;
      case 'LED':
        modelUrl = '/models/components/led_5mm_red.glb';
        break;
      case 'BULB_INCANDESCENT':
        modelUrl = '/models/components/bulb_incandescent.glb';
        break;
      case 'BATTERY_9V':
      case 'DC_SOURCE':
        modelUrl = '/models/power/battery_9v.glb';
        break;
      case 'POTENTIOMETER':
        modelUrl = '/models/components/potentiometer_10k.glb';
        break;
      case 'SPEAKER':
        modelUrl = '/models/components/speaker_8ohm.glb';
        break;
      case 'SWITCH_TACTILE':
      case 'SWITCH_TOGGLE':
        modelUrl = '/models/components/button_tactile_6mm.glb';
        break;
      case 'CAPACITOR_ELECTROLYTIC':
      case 'CAPACITOR_CERAMIC':
        modelUrl = '/models/components/capacitor_electrolytic.glb';
        break;
      case 'INDUCTOR_TOROID':
        modelUrl = '/models/components/inductor_toroid.glb';
        break;
      case 'DISPLAY_7SEG':
        modelUrl = '/models/components/display_7seg_1digit.glb';
        break;
      case 'DIP8_555':
      case 'DIP8_LM358':
        modelUrl = '/models/components/dip8_ic.glb';
        break;
    }

    if (modelUrl) {
      loadModelPrefab(
        modelUrl,
        (clone) => {
          clone.traverse((c) => {
            if ((c as THREE.Mesh).isMesh) {
              (c as THREE.Mesh).material = new THREE.MeshStandardMaterial({
                color: 0x06b6d4,
                transparent: true,
                opacity: 0.65,
                roughness: 0.3,
                emissive: 0x0891b2,
                emissiveIntensity: 0.3,
              });
            }
          });
          ghost.add(clone);
        },
        () => {
          const fallback = new THREE.Mesh(
            new THREE.BoxGeometry(0.015, 0.008, 0.008),
            new THREE.MeshStandardMaterial({
              color: 0x06b6d4,
              transparent: true,
              opacity: 0.65,
            })
          );
          ghost.add(fallback);
        }
      );
    } else {
      // Holographic ghost preview from procedural 3D model
      const procClone = buildProceduralMesh(placingComponent);
      procClone.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) {
          (c as THREE.Mesh).material = new THREE.MeshStandardMaterial({
            color: 0x06b6d4,
            transparent: true,
            opacity: 0.65,
            roughness: 0.3,
            emissive: 0x0891b2,
            emissiveIntensity: 0.3,
          });
        }
      });
      ghost.add(procClone);
    }
  }, [placingComponent]);

  // 3. Render Permanent Jumper Wires & DMM Physical Leads (Flicker-Free Diffing)
  useEffect(() => {
    const mainGroup = wireMeshesRef.current;
    if (!mainGroup) return;

    const currentWires = wireRecordsRef.current;
    const incomingWireMap = new Map(wires.map((w) => [w.id, w]));

    // 1. Remove deleted wires
    for (const [id, record] of Array.from(currentWires.entries())) {
      if (!incomingWireMap.has(id)) {
        if (record.group.parent) {
          record.group.parent.remove(record.group);
        }
        mainGroup.remove(record.group);
        record.group.traverse((c) => {
          if ((c as THREE.Mesh).geometry) (c as THREE.Mesh).geometry.dispose();
          if ((c as THREE.Mesh).material) {
            if (Array.isArray((c as THREE.Mesh).material)) {
              ((c as THREE.Mesh).material as THREE.Material[]).forEach((m) => m.dispose());
            } else {
              ((c as THREE.Mesh).material as THREE.Material).dispose();
            }
          }
        });
        currentWires.delete(id);
      }
    }

    // 2. Add or update wires only if route or color or selection changed
    wires.forEach((wire) => {
      const isSelected = wire.id === selectedWireId;
      const wireKey = `${wire.startHoleId}_${wire.endHoleId}_${wire.color}_${isSelected ? 1 : 0}`;

      const existing = currentWires.get(wire.id);
      if (existing && existing.key === wireKey) {
        if (existing.group.parent !== mainGroup) {
          mainGroup.add(existing.group);
        }
        return;
      }

      if (existing) {
        if (existing.group.parent) {
          existing.group.parent.remove(existing.group);
        }
        mainGroup.remove(existing.group);
        existing.group.traverse((c) => {
          if ((c as THREE.Mesh).geometry) (c as THREE.Mesh).geometry.dispose();
          if ((c as THREE.Mesh).material) {
            if (Array.isArray((c as THREE.Mesh).material)) {
              ((c as THREE.Mesh).material as THREE.Material[]).forEach((m) => m.dispose());
            } else {
              ((c as THREE.Mesh).material as THREE.Material).dispose();
            }
          }
        });
        currentWires.delete(wire.id);
      }

      const p1 = new THREE.Vector3(wire.startPos[0], wire.startPos[2], wire.startPos[1]);
      const p2 = new THREE.Vector3(wire.endPos[0], wire.endPos[2], wire.endPos[1]);

      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      const dist = p1.distanceTo(p2);
      mid.y += Math.max(0.008, Math.min(0.025, dist * 0.35));

      const curve = new THREE.CatmullRomCurve3([
        p1,
        new THREE.Vector3(p1.x, p1.y + 0.006, p1.z),
        mid,
        new THREE.Vector3(p2.x, p2.y + 0.006, p2.z),
        p2,
      ]);

      const wireGroup = new THREE.Group();
      wireGroup.userData = { isWire: true, wireId: wire.id };

      const tubeGeo = new THREE.TubeGeometry(curve, 32, isSelected ? 0.0015 : 0.0011, 8, false);
      const tubeMat = new THREE.MeshStandardMaterial({
        color: isSelected ? 0xffffff : wire.color,
        roughness: 0.35,
        metalness: 0.1,
        emissive: isSelected ? 0xf59e0b : wire.color,
        emissiveIntensity: isSelected ? 0.4 : 0.05,
      });

      const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
      tubeMesh.castShadow = true;
      tubeMesh.userData = { isWire: true, wireId: wire.id };
      wireGroup.add(tubeMesh);

      // Thicker invisible raycast hit proxy for effortless selection clicking
      const hitProxyGeo = new THREE.TubeGeometry(curve, 16, 0.004, 6, false);
      const hitProxyMat = new THREE.MeshBasicMaterial({ visible: false });
      const hitProxy = new THREE.Mesh(hitProxyGeo, hitProxyMat);
      hitProxy.userData = { isWire: true, wireId: wire.id, isHitProxy: true };
      wireGroup.add(hitProxy);

      // DuPont pins
      const pinGeo = new THREE.BoxGeometry(0.0025, 0.008, 0.0025);
      const pinMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.5 });

      const pin1 = new THREE.Mesh(pinGeo, pinMat);
      pin1.position.set(p1.x, p1.y + 0.004, p1.z);
      pin1.userData = { isWire: true, wireId: wire.id };
      wireGroup.add(pin1);

      const pin2 = new THREE.Mesh(pinGeo, pinMat);
      pin2.position.set(p2.x, p2.y + 0.004, p2.z);
      pin2.userData = { isWire: true, wireId: wire.id };
      wireGroup.add(pin2);

      mainGroup.add(wireGroup);
      currentWires.set(wire.id, { group: wireGroup, key: wireKey });
    });

    // 3. Reconcile DMM Red Probe Lead
    if (multimeter.redProbeHoleId !== dmmLeadsRef.current.redHole) {
      if (dmmLeadsRef.current.red) {
        mainGroup.remove(dmmLeadsRef.current.red);
        dmmLeadsRef.current.red.traverse((c) => {
          if ((c as THREE.Mesh).geometry) (c as THREE.Mesh).geometry.dispose();
        });
        dmmLeadsRef.current.red = undefined;
      }
      dmmLeadsRef.current.redHole = multimeter.redProbeHoleId;

      if (multimeter.redProbeHoleId) {
        const pos = getHolePosition(multimeter.redProbeHoleId, components);
        if (pos) {
          const redGroup = new THREE.Group();
          const pinPos = new THREE.Vector3(pos[0], pos[2], pos[1]);
          // Plugs into red banana jack of 3D multimeter
          const dmmOrigin = new THREE.Vector3(0.070, 0.034, 0.093);
          const mid = new THREE.Vector3().addVectors(pinPos, dmmOrigin).multiplyScalar(0.5);
          mid.y += 0.03;

          const curve = new THREE.CatmullRomCurve3([pinPos, mid, dmmOrigin]);
          const tubeGeo = new THREE.TubeGeometry(curve, 24, 0.0012, 6, false);
          const tubeMat = new THREE.MeshStandardMaterial({
            color: 0xef4444,
            roughness: 0.4,
            emissive: 0xef4444,
            emissiveIntensity: 0.2,
          });
          const leadMesh = new THREE.Mesh(tubeGeo, tubeMat);
          leadMesh.userData = { isDmmProbe: true, probeType: 'RED' };
          redGroup.add(leadMesh);

          const probeGeo = new THREE.CylinderGeometry(0.002, 0.0008, 0.02, 12);
          const probeMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 });
          const probe = new THREE.Mesh(probeGeo, probeMat);
          probe.position.set(pinPos.x, pinPos.y + 0.01, pinPos.z);
          probe.userData = { isDmmProbe: true, probeType: 'RED' };
          redGroup.add(probe);

          mainGroup.add(redGroup);
          dmmLeadsRef.current.red = redGroup;
        }
      }
    }

    // 4. Reconcile DMM Black Probe Lead
    if (multimeter.blackProbeHoleId !== dmmLeadsRef.current.blackHole) {
      if (dmmLeadsRef.current.black) {
        mainGroup.remove(dmmLeadsRef.current.black);
        dmmLeadsRef.current.black.traverse((c) => {
          if ((c as THREE.Mesh).geometry) (c as THREE.Mesh).geometry.dispose();
        });
        dmmLeadsRef.current.black = undefined;
      }
      dmmLeadsRef.current.blackHole = multimeter.blackProbeHoleId;

      if (multimeter.blackProbeHoleId) {
        const pos = getHolePosition(multimeter.blackProbeHoleId, components);
        if (pos) {
          const blackGroup = new THREE.Group();
          const pinPos = new THREE.Vector3(pos[0], pos[2], pos[1]);
          // Plugs into black COM jack of 3D multimeter
          const dmmOrigin = new THREE.Vector3(0.088, 0.034, 0.093);
          const mid = new THREE.Vector3().addVectors(pinPos, dmmOrigin).multiplyScalar(0.5);
          mid.y += 0.025;

          const curve = new THREE.CatmullRomCurve3([pinPos, mid, dmmOrigin]);
          const tubeGeo = new THREE.TubeGeometry(curve, 24, 0.0012, 6, false);
          const tubeMat = new THREE.MeshStandardMaterial({
            color: 0x27272a,
            roughness: 0.5,
          });
          const leadMesh = new THREE.Mesh(tubeGeo, tubeMat);
          leadMesh.userData = { isDmmProbe: true, probeType: 'BLACK' };
          blackGroup.add(leadMesh);

          const probeGeo = new THREE.CylinderGeometry(0.002, 0.0008, 0.02, 12);
          const probeMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.4 });
          const probe = new THREE.Mesh(probeGeo, probeMat);
          probe.position.set(pinPos.x, pinPos.y + 0.01, pinPos.z);
          probe.userData = { isDmmProbe: true, probeType: 'BLACK' };
          blackGroup.add(probe);

          mainGroup.add(blackGroup);
          dmmLeadsRef.current.black = blackGroup;
        }
      }
    }

    // 5. Sweep any orphaned wire groups in mainGroup that don't belong to any active wire or DMM lead
    const validWireGroups = new Set<THREE.Object3D>();
    for (const record of currentWires.values()) {
      validWireGroups.add(record.group);
    }
    if (dmmLeadsRef.current.red) validWireGroups.add(dmmLeadsRef.current.red);
    if (dmmLeadsRef.current.black) validWireGroups.add(dmmLeadsRef.current.black);

    for (let i = mainGroup.children.length - 1; i >= 0; i--) {
      const child = mainGroup.children[i];
      if (!validWireGroups.has(child)) {
        mainGroup.remove(child);
        child.traverse((c) => {
          if ((c as THREE.Mesh).geometry) (c as THREE.Mesh).geometry.dispose();
          if ((c as THREE.Mesh).material) {
            if (Array.isArray((c as THREE.Mesh).material)) {
              ((c as THREE.Mesh).material as THREE.Material[]).forEach((m) => m.dispose());
            } else {
              ((c as THREE.Mesh).material as THREE.Material).dispose();
            }
          }
        });
      }
    }
  }, [wires, selectedWireId, multimeter.redProbeHoleId, multimeter.blackProbeHoleId, components]);

  // 4. Mouse Handlers: Orbit, Panning, Real-Time Wire Stretching, Component Dragging & Placement
  const handleMouseDown = (e: React.MouseEvent) => {
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
    prevMouseRef.current = { x: e.clientX, y: e.clientY };

    if (e.button === 2) {
      isPanningRef.current = true;
      return;
    }

    if (e.button !== 0) return;

    // Check if clicking directly on a component in SELECT mode to drag it
    if (activeTool === 'SELECT' && !wiringStartHole && !placingComponent && !activeProbe) {
      if (containerRef.current && cameraRef.current && sceneRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const mouse = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, cameraRef.current);

        const allObjects: THREE.Object3D[] = [];
        componentMeshesRef.current.forEach((g) => allObjects.push(g));

        const intersects = raycaster.intersectObjects(allObjects, true);
        if (intersects.length > 0) {
          let hit = intersects[0].object;
          while (hit.parent && !hit.userData.componentId && !hit.userData.wireId) {
            hit = hit.parent;
          }
          if (hit.userData.componentId) {
            const hitComp = components.find((c) => c.id === hit.userData.componentId);
            if (hitComp) {
              isDraggingComponentRef.current = true;
              draggedCompIdRef.current = hitComp.id;
              dragCandidateCompRef.current = null;
              onSelectComponent(hitComp);
              onSelectWire(null);
              audioEngine.playKnobClick();

              if (isBenchComponent(hitComp.type)) {
                const matPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
                const matIntersect = new THREE.Vector3();
                raycaster.ray.intersectPlane(matPlane, matIntersect);
                dragPlaneOffsetRef.current = {
                  x: hitComp.position[0] - matIntersect.x,
                  z: hitComp.position[1] - matIntersect.z,
                };
              }
              return;
            }
          }
        }
      }
    }

    // Default: Orbit camera on empty space
    isDraggingRef.current = true;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const dx = e.clientX - prevMouseRef.current.x;
    const dy = e.clientY - prevMouseRef.current.y;
    prevMouseRef.current = { x: e.clientX, y: e.clientY };

    // Pan Camera (Right-click drag)
    if (isPanningRef.current && cameraTargetRef.current) {
      cameraTargetRef.current.x -= dx * 0.0003;
      cameraTargetRef.current.z -= dy * 0.0003;
      updateCameraPosition();
      return;
    }

    // Orbit Camera (Left-drag on empty space)
    if (isDraggingRef.current && !isDraggingComponentRef.current && activeTool === 'SELECT' && !wiringStartHole && !placingComponent) {
      cameraSphericalRef.current.theta -= dx * 0.008;
      cameraSphericalRef.current.phi = Math.max(
        0.1,
        Math.min(Math.PI / 2 - 0.05, cameraSphericalRef.current.phi + dy * 0.008)
      );
      updateCameraPosition();
      return;
    }

    if (!containerRef.current || !cameraRef.current || !sceneRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);

    // Dynamic Drag-to-Move for Component
    if (isDraggingComponentRef.current && draggedCompIdRef.current) {
      const draggedComp = components.find((c) => c.id === draggedCompIdRef.current);
      const record = componentRecordsRef.current.get(draggedCompIdRef.current);

      if (draggedComp && record) {
        if (isBenchComponent(draggedComp.type)) {
          const matPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
          const matIntersect = new THREE.Vector3();
          raycaster.ray.intersectPlane(matPlane, matIntersect);

          const targetX = Math.max(-0.25, Math.min(0.25, matIntersect.x + dragPlaneOffsetRef.current.x));
          const targetZ = Math.max(-0.16, Math.min(0.16, matIntersect.z + dragPlaneOffsetRef.current.z));

          record.group.position.set(targetX, 0, targetZ);
          dragCandidateCompRef.current = {
            ...draggedComp,
            position: [targetX, targetZ, 0],
          };
          updateStatus(`Dragging ${draggedComp.name} • Release to place on workbench mat`);
        } else {
          const bbPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.0085);
          const bbIntersect = new THREE.Vector3();
          raycaster.ray.intersectPlane(bbPlane, bbIntersect);

          // Find the nearest hole directly under cursor (generous 18mm threshold across breadboard)
          const nearestHole = findNearestHole(bbIntersect.x, bbIntersect.z, 0.018);
          let snappedComp: CircuitComponent | null = null;
          if (nearestHole) {
            snappedComp = moveComponentToHole(draggedComp, nearestHole.id);
          }

          if (snappedComp) {
            record.group.position.set(
              snappedComp.position[0],
              snappedComp.position[2],
              snappedComp.position[1]
            );
            const snappedHoles = snappedComp.pins
              .map((p) => p.connectedHoleId)
              .filter((id): id is string => Boolean(id));
            setHoveredTargetHoles(snappedHoles);
            updateStatus(`Moving ${draggedComp.name} ➔ Holes [${snappedHoles.join(', ')}] • Release to place`);
            dragCandidateCompRef.current = snappedComp;
          } else {
            // Free floating smoothly with cursor (slight 4mm lift) when outside breadboard
            const compY = getComponentDefaultElevation(draggedComp.type);
            record.group.position.set(bbIntersect.x, compY + 0.004, bbIntersect.z);
            setHoveredTargetHoles([]);
            updateStatus(`Moving ${draggedComp.name} • Drag over breadboard to place`);
            dragCandidateCompRef.current = null;
          }
        }
        if (snapRingMeshRef.current) snapRingMeshRef.current.visible = false;
        return;
      }
    }

    // 1. Raycast priority for battery snap terminals (+ and -)
    let hoveredTerminalId: string | null = null;
    let hoveredTerminalName = '';
    let terminalWorldPos: THREE.Vector3 | null = null;

    if (batteryTerminalsRef.current.length > 0) {
      const termHits = raycaster.intersectObjects(batteryTerminalsRef.current, false);
      if (termHits.length > 0) {
        const hit = termHits[0].object;
        hoveredTerminalId = hit.userData.terminalId;
        hoveredTerminalName = hit.userData.name || 'Battery Terminal';
        terminalWorldPos = new THREE.Vector3();
        hit.getWorldPosition(terminalWorldPos);
      }
    }

    // 2. Breadboard horizontal surface plane (Y = 0.0085)
    const breadboardPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.0085);
    const planeIntersect = new THREE.Vector3();
    raycaster.ray.intersectPlane(breadboardPlane, planeIntersect);

    // Find nearest hole to cursor (tight 4mm threshold so it snaps only to real socket openings)
    const nearestHole = hoveredTerminalId ? null : findNearestHole(planeIntersect.x, planeIntersect.z, 0.004);
    const activeTargetId = hoveredTerminalId || (nearestHole ? nearestHole.id : null);
    updateHoveredHole(activeTargetId);

    // Snap Ring Positioning
    if (snapRingMeshRef.current) {
      if (terminalWorldPos) {
        snapRingMeshRef.current.position.set(terminalWorldPos.x, terminalWorldPos.y + 0.003, terminalWorldPos.z);
        snapRingMeshRef.current.visible = true;
      } else if (nearestHole) {
        snapRingMeshRef.current.position.set(nearestHole.x, 0.0088, nearestHole.y);
        snapRingMeshRef.current.visible = true;
      } else {
        snapRingMeshRef.current.visible = false;
      }
    }

    // A. Dynamic Wire Stretching Preview
    if (wiringStartHole) {
      const p1Coords = getHolePosition(wiringStartHole, components);
      if (p1Coords) {
        const p1 = new THREE.Vector3(p1Coords[0], p1Coords[2], p1Coords[1]);
        const p2 = terminalWorldPos
          ? terminalWorldPos.clone()
          : nearestHole
          ? new THREE.Vector3(nearestHole.x, 0.0088, nearestHole.y)
          : planeIntersect.clone();

        const dist = p1.distanceTo(p2);
        const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
        mid.y = Math.max(p1.y, p2.y) + Math.max(0.008, Math.min(0.045, dist * 0.45));

        const curve = new THREE.CatmullRomCurve3([
          p1,
          new THREE.Vector3(p1.x, p1.y + 0.008, p1.z),
          mid,
          new THREE.Vector3(p2.x, p2.y + 0.008, p2.z),
          p2,
        ]);

        if (previewWireMeshRef.current) {
          sceneRef.current.remove(previewWireMeshRef.current);
          previewWireMeshRef.current.geometry.dispose();
        }

        const previewGeo = new THREE.TubeGeometry(curve, 28, 0.0013, 8, false);
        const previewMat = new THREE.MeshStandardMaterial({
          color: wireColor,
          emissive: wireColor,
          emissiveIntensity: 0.35,
          roughness: 0.3,
        });
        const previewMesh = new THREE.Mesh(previewGeo, previewMat);
        sceneRef.current.add(previewMesh);
        previewWireMeshRef.current = previewMesh;

        updateStatus(
          activeTargetId
            ? `Connect Wire: ${wiringStartHole} ➔ ${activeTargetId} (Click to attach)`
            : `Stretching Wire from ${wiringStartHole}... Hover over target hole or battery terminal`
        );
      }
      return;
    }

    // B. Component Placement Hologram Ghost
    if (placingComponent && ghostGroupRef.current) {
      const ghost = ghostGroupRef.current;
      ghost.visible = true;

      if (isBenchComponent(placingComponent.type)) {
        // External bench component rests outside breadboard on ESD bench mat (Y = 0)
        const benchMatPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const matIntersect = new THREE.Vector3();
        raycaster.ray.intersectPlane(benchMatPlane, matIntersect);

        ghost.position.set(matIntersect.x, 0, matIntersect.z);
        ghost.rotation.set(0, (placementRotationDeg * Math.PI) / 180, 0);

        updateStatus(
          `Place ${placingComponent.type} on Bench Mat outside breadboard • Press 'R' to Rotate • Click to Place`
        );
        return;
      }

      if (nearestHole) {
        const fp = getComponentFootprint(
          placingComponent.type,
          nearestHole.id,
          placementRotationDeg
        );
        setHoveredTargetHoles(fp.holeIds);

        // Position ghost right between terminal pins
        const firstHolePos = getHolePosition(fp.holeIds[0]);
        const lastHolePos = getHolePosition(fp.holeIds[fp.holeIds.length - 1]);

        if (firstHolePos && lastHolePos) {
          const midX = (firstHolePos[0] + lastHolePos[0]) / 2;
          const midZ = (firstHolePos[1] + lastHolePos[1]) / 2;
          const compY = getComponentDefaultElevation(placingComponent.type);
          ghost.position.set(midX, compY, midZ);
          ghost.rotation.set(0, (placementRotationDeg * Math.PI) / 180, 0);
        }

        updateStatus(
          `Place ${placingComponent.type} on [${fp.holeIds.join(', ')}] • Press 'R' to Rotate • Click to Attach`
        );
      } else {
        const compY = getComponentDefaultElevation(placingComponent.type);
        ghost.position.set(planeIntersect.x, compY, planeIntersect.z);
        updateStatus(`Hover over breadboard holes to place ${placingComponent.type}`);
      }
      return;
    }

    // Default HUD Message
    if (activeTool === 'WIRE') {
      if (hoveredTerminalId) {
        updateStatus(`${hoveredTerminalName} • Click to start jumper wire`);
      } else if (nearestHole) {
        updateStatus(`${getHoleDescription(nearestHole.id)} • Click to start jumper wire`);
      } else {
        updateStatus('Wire Tool: Click any hole or battery terminal to stretch wire');
      }
    } else if (activeProbe) {
      if (hoveredTerminalId) {
        updateStatus(`Click to attach Multimeter ${activeProbe} Probe to ${hoveredTerminalName}`);
      } else if (nearestHole) {
        updateStatus(`Click to attach Multimeter ${activeProbe} Probe to ${nearestHole.id}`);
      } else {
        updateStatus(`Click pin or terminal to attach Multimeter ${activeProbe} Probe`);
      }
    } else {
      if (hoveredTerminalId) {
        updateStatus(hoveredTerminalName);
      } else if (nearestHole) {
        updateStatus(getHoleDescription(nearestHole.id));
      } else {
        updateStatus('');
      }
    }
  };

  const handleMouseUp = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      isDraggingRef.current = false;
      isPanningRef.current = false;

      if (isDraggingComponentRef.current && draggedCompIdRef.current) {
        const dragDist = Math.hypot(
          e.clientX - mouseDownPosRef.current.x,
          e.clientY - mouseDownPosRef.current.y
        );

        const draggedComp = components.find((c) => c.id === draggedCompIdRef.current);
        const record = componentRecordsRef.current.get(draggedCompIdRef.current);

        if (dragDist >= 4 && onMoveComponent && draggedComp) {
          if (dragCandidateCompRef.current) {
            audioEngine.playSnapSound();
            onMoveComponent(draggedComp.id, dragCandidateCompRef.current);
            updateStatus(`Placed ${draggedComp.name}`);
          } else {
            // Revert mesh back to exact original position if released in invalid spot
            if (record) {
              record.group.position.set(
                draggedComp.position[0],
                draggedComp.position[2],
                draggedComp.position[1]
              );
            }
            audioEngine.playPopSound();
            updateStatus(`${draggedComp.name} returned to original position`);
          }
        } else if (record && draggedComp) {
          // Just a click without dragging - restore exact original position
          record.group.position.set(
            draggedComp.position[0],
            draggedComp.position[2],
            draggedComp.position[1]
          );
        }

        setHoveredTargetHoles([]);
        isDraggingComponentRef.current = false;
        draggedCompIdRef.current = null;
        dragCandidateCompRef.current = null;
      }
    },
    [components, onMoveComponent, updateStatus]
  );

  useEffect(() => {
    const handleGlobalMouseUp = (e: MouseEvent) => {
      if (isDraggingComponentRef.current || isDraggingRef.current || isPanningRef.current) {
        handleMouseUp(e);
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [handleMouseUp]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    cameraSphericalRef.current.radius = Math.max(
      0.08,
      Math.min(0.65, cameraSphericalRef.current.radius + e.deltaY * 0.0005)
    );
    updateCameraPosition();
  };

  // Click Handler: Place Component, Stretch Wire, Attach Probe, or Select Object
  const handleClick = (e: React.MouseEvent) => {
    const dragDist = Math.hypot(
      e.clientX - mouseDownPosRef.current.x,
      e.clientY - mouseDownPosRef.current.y
    );
    if (dragDist >= 6) return;

    if (!containerRef.current || !cameraRef.current || !sceneRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);

    // 1. Probe Attachment
    if (activeProbe && hoveredHoleId) {
      audioEngine.playSnapSound();
      onSetProbeHole(activeProbe, hoveredHoleId);
      return;
    }

    // 2. Component Placement Mode
    if (placingComponent) {
      if (isBenchComponent(placingComponent.type)) {
        const benchMatPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const matIntersect = new THREE.Vector3();
        raycaster.ray.intersectPlane(benchMatPlane, matIntersect);

        audioEngine.playSnapSound();
        const defVal =
          placingComponent.defaultValue ??
          (placingComponent.type === 'SPEAKER' ? 8 : placingComponent.type === 'DC_SOURCE' ? 5 : placingComponent.type === 'BATTERY_HOLDER_4AA' ? 6 : 9);
        onPlaceComponent(
          placingComponent.type,
          [],
          placementRotationDeg,
          defVal,
          [matIntersect.x, matIntersect.z, 0]
        );
        setHoveredTargetHoles([]);
        if (ghostGroupRef.current) ghostGroupRef.current.visible = false;
        return;
      }

      if (hoveredHoleId) {
        const fp = getComponentFootprint(
          placingComponent.type,
          hoveredHoleId,
          placementRotationDeg
        );
        if (fp.isValid && fp.holeIds.length > 0) {
          audioEngine.playSnapSound();
          onPlaceComponent(
            placingComponent.type,
            fp.holeIds,
            placementRotationDeg,
            placingComponent.defaultValue
          );
          setHoveredTargetHoles([]);
          if (ghostGroupRef.current) ghostGroupRef.current.visible = false;
        }
        return;
      }
    }

    // 3. Jumper Wire Tool
    if (activeTool === 'WIRE' || wiringStartHole) {
      if (!wiringStartHole) {
        if (hoveredHoleId) {
          audioEngine.playSnapSound();
          setWiringStartHole(hoveredHoleId);
        }
      } else {
        if (hoveredHoleId && hoveredHoleId !== wiringStartHole) {
          audioEngine.playSnapSound();
          onAddWire(wiringStartHole, hoveredHoleId, wireColor);
        }
        setWiringStartHole(null);
        if (previewWireMeshRef.current && sceneRef.current) {
          sceneRef.current.remove(previewWireMeshRef.current);
          previewWireMeshRef.current = null;
        }
      }
      return;
    }

    // 4. Select Mode (Select Component or Wire)
    if (activeTool === 'SELECT') {
      if (!containerRef.current || !cameraRef.current || !sceneRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, cameraRef.current);

      const allObjects: THREE.Object3D[] = [];
      componentMeshesRef.current.forEach((g) => allObjects.push(g));
      if (wireMeshesRef.current) allObjects.push(wireMeshesRef.current);

      const intersects = raycaster.intersectObjects(allObjects, true);

      if (intersects.length > 0) {
        for (const intersect of intersects) {
          let hit = intersect.object;
          while (hit.parent && !hit.userData.componentId && !hit.userData.wireId && !hit.userData.isDmmProbe) {
            hit = hit.parent;
          }

          if (hit.userData.isDmmProbe) {
            audioEngine.playKnobClick();
            onSetProbeHole(hit.userData.probeType, '');
            return;
          }

          if (hit.userData.componentId) {
            const comp = components.find((c) => c.id === hit.userData.componentId) || null;
            if (comp) {
              if (comp.type === 'SWITCH_TACTILE' || comp.type === 'SWITCH_TOGGLE') {
                const nextClosed = !(comp.state?.isClosed ?? false);
                if (nextClosed) {
                  audioEngine.playSnapSound();
                } else {
                  audioEngine.playPopSound();
                }
                onComponentStateChange(comp.id, { isClosed: nextClosed });
              } else {
                audioEngine.playKnobClick();
              }
              onSelectComponent(comp);
              onSelectWire(null);
              return;
            }
          }

          if (hit.userData.wireId) {
            const wire = wires.find((w) => w.id === hit.userData.wireId) || null;
            if (wire) {
              audioEngine.playKnobClick();
              onSelectWire(wire);
              onSelectComponent(null);
              return;
            }
          }
        }
      }

      // Clicked on empty space: deselect
      onSelectComponent(null);
      onSelectWire(null);
    }
  };

  return (
    <div
      className="relative w-full h-full select-none overflow-hidden cursor-crosshair bg-[#0a0b0e]"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onClick={handleClick}
      onContextMenu={(e) => {
        e.preventDefault();
        setWiringStartHole(null);
        if (previewWireMeshRef.current && sceneRef.current) {
          sceneRef.current.remove(previewWireMeshRef.current);
          previewWireMeshRef.current = null;
        }
      }}
    >
      {/* Dedicated Three.js canvas mount container - isolated from React virtual DOM */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* Floating Status & Instruction Banner */}
      {statusMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none glass-dock px-4 py-2 rounded-xl text-xs font-mono text-amber-300 shadow-xl border border-amber-500/30 flex items-center gap-2 animate-in fade-in duration-150">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Context-Aware Dynamic Viewport Controls Bar */}
      <div className="absolute bottom-4 left-4 right-4 z-10 pointer-events-none flex items-center justify-between gap-3">
        <div className="glass-dock px-3.5 py-2 rounded-xl text-xs font-mono text-zinc-300 flex items-center gap-2.5 border border-white/[0.08] shadow-2xl backdrop-blur-xl">
          {components.find((c) => c.id === selectedComponentId) ? (
            (() => {
              const comp = components.find((c) => c.id === selectedComponentId)!;
              return (
                <>
                  <span className="flex items-center gap-1.5 font-bold text-amber-300">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    {comp.name}
                  </span>
                  <span className="text-zinc-600">|</span>
                  <span className="text-zinc-300">
                    🔄 Rotate:{' '}
                    <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-amber-300 border border-white/[0.1]">←</kbd>{' '}
                    <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-amber-300 border border-white/[0.1]">→</kbd>{' '}
                    <span className="text-zinc-400">or</span>{' '}
                    <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-amber-300 border border-white/[0.1]">R</kbd>
                  </span>
                  <span className="text-zinc-600">|</span>
                  <span className="text-zinc-300">
                    🖐 Move:{' '}
                    <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-amber-300 border border-white/[0.1]">Drag</kbd>{' '}
                    <span className="text-zinc-400">or</span>{' '}
                    <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-amber-300 border border-white/[0.1]">WASD</kbd>
                  </span>
                  <span className="text-zinc-600">|</span>
                  <span className="text-zinc-400">
                    <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-rose-300 border border-white/[0.1]">Del</kbd> Delete
                  </span>
                  <span className="text-zinc-600">|</span>
                  <span className="text-zinc-400">
                    <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-white/[0.1]">Esc</kbd> Deselect
                  </span>
                </>
              );
            })()
          ) : wires.find((w) => w.id === selectedWireId) ? (
            (() => {
              const wire = wires.find((w) => w.id === selectedWireId)!;
              return (
                <>
                  <span className="flex items-center gap-1.5 font-bold text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Wire {wire.startHoleId} ➔ {wire.endHoleId}
                  </span>
                  <span className="text-zinc-600">|</span>
                  <span className="text-zinc-300">
                    Color: <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-amber-300 border border-white/[0.1]">1–7</kbd>
                  </span>
                  <span className="text-zinc-600">|</span>
                  <span className="text-zinc-400">
                    <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-rose-300 border border-white/[0.1]">Del</kbd> Delete
                  </span>
                  <span className="text-zinc-600">|</span>
                  <span className="text-zinc-400">
                    <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-white/[0.1]">Esc</kbd> Deselect
                  </span>
                </>
              );
            })()
          ) : activeTool === 'WIRE' || wiringStartHole ? (
            <>
              <span className="flex items-center gap-1.5 font-bold text-cyan-400">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                {wiringStartHole ? `Stretching from ${wiringStartHole}` : 'Wire Tool Active'}
              </span>
              <span className="text-zinc-600">|</span>
              <span className="text-zinc-300">Click hole or terminal to connect</span>
              <span className="text-zinc-600">|</span>
              <span className="text-zinc-300">
                Color:{' '}
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-amber-300 border border-white/[0.1]">1–7</kbd>
              </span>
              <span className="text-zinc-600">|</span>
              <span className="text-zinc-400">
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-white/[0.1]">Esc</kbd> Cancel
              </span>
            </>
          ) : placingComponent ? (
            <>
              <span className="flex items-center gap-1.5 font-bold text-amber-300">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                Placing {placingComponent.type}
              </span>
              <span className="text-zinc-600">|</span>
              <span className="text-zinc-300">
                Rotate:{' '}
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-amber-300 border border-white/[0.1]">←</kbd>{' '}
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-amber-300 border border-white/[0.1]">→</kbd>{' '}
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-amber-300 border border-white/[0.1]">R</kbd>
              </span>
              <span className="text-zinc-600">|</span>
              <span className="text-zinc-300">Click hole / mat to place</span>
              <span className="text-zinc-600">|</span>
              <span className="text-zinc-400">
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-white/[0.1]">Esc</kbd> Cancel
              </span>
            </>
          ) : (
            <>
              <span>Left-Click: Select</span>
              <span className="text-zinc-600">•</span>
              <span>Drag Mat: Orbit</span>
              <span className="text-zinc-600">•</span>
              <span>Right-Drag: Pan</span>
              <span className="text-zinc-600">•</span>
              <span>Scroll: Zoom</span>
              <span className="text-zinc-600">•</span>
              <span>
                <kbd className="px-1 py-0.2 rounded bg-zinc-800 text-amber-300 border border-white/[0.1]">W</kbd> Wire
              </span>
              <span className="text-zinc-600">•</span>
              <span>
                <kbd className="px-1 py-0.2 rounded bg-zinc-800 text-amber-300 border border-white/[0.1]">C</kbd> Catalog
              </span>
              <span className="text-zinc-600">•</span>
              <span>
                <kbd className="px-1 py-0.2 rounded bg-zinc-800 text-amber-300 border border-white/[0.1]">Space</kbd> Sim
              </span>
            </>
          )}
        </div>

        {/* Clickable Controls Guide Pill Button */}
        {onOpenControlsGuide && (
          <button
            onClick={onOpenControlsGuide}
            className="pointer-events-auto glass-dock px-3 py-2 rounded-xl text-xs font-mono text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 border border-amber-500/30 flex items-center gap-1.5 shadow-lg transition-all"
            title="Open Full Controls & Shortcuts Guide (Press ? or H)"
          >
            <Keyboard className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-bold">Controls Guide (?)</span>
          </button>
        )}
      </div>
    </div>
  );
}
