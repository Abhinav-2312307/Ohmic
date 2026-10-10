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
  const mouseDownPosRef = useRef({ x: 0, y: 0 });
  const prevMouseRef = useRef({ x: 0, y: 0 });
  const cameraTargetRef = useRef<THREE.Vector3 | null>(null);
  const cameraSphericalRef = useRef({ radius: 0.28, theta: Math.PI / 4, phi: Math.PI / 3.2 });

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

    if (!cameraTargetRef.current) cameraTargetRef.current = new THREE.Vector3(0, 0, 0);
    if (!wireMeshesRef.current) wireMeshesRef.current = new THREE.Group();

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

  // 2. Render & Reconcile Placed Components (Flicker-Free Diffing)
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const currentRecords = componentRecordsRef.current;
    const incomingCompMap = new Map(components.map((c) => [c.id, c]));

    // 1. Remove deleted components
    for (const [id, record] of Array.from(currentRecords.entries())) {
      if (!incomingCompMap.has(id)) {
        scene.remove(record.group);
        if (record.light) {
          const lIdx = activeLightsRef.current.indexOf(record.light);
          if (lIdx !== -1) activeLightsRef.current.splice(lIdx, 1);
        }
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
        const selRingGeo = isBatt
          ? new THREE.RingGeometry(0.018, 0.024, 32)
          : new THREE.RingGeometry(0.008, 0.012, 24);
        const selRingMat = new THREE.MeshBasicMaterial({
          color: 0xf59e0b,
          side: THREE.DoubleSide,
        });
        const selRing = new THREE.Mesh(selRingGeo, selRingMat);
        selRing.rotation.x = -Math.PI / 2;
        selRing.position.y = 0.001;
        selRing.visible = comp.id === selectedComponentId;
        compGroup.add(selRing);

        // Invisible Hit-box proxy for reliable selection and dragging
        const hitBoxGeo = isBatt
          ? new THREE.BoxGeometry(0.032, 0.054, 0.022)
          : new THREE.BoxGeometry(0.024, 0.024, 0.016);
        const hitBoxMat = new THREE.MeshBasicMaterial({ visible: false });
        const hitBox = new THREE.Mesh(hitBoxGeo, hitBoxMat);
        hitBox.position.y = isBatt ? 0.025 : 0.008;
        hitBox.userData = { componentId: comp.id, isHitProxy: true };
        compGroup.add(hitBox);

        // Optional LED / Bulb point light
        let light: THREE.PointLight | undefined;
        if (comp.type === 'LED' || comp.type === 'BULB_INCANDESCENT') {
          const lightColor = comp.type === 'LED' ? 0xff3333 : 0xffaa44;
          light = new THREE.PointLight(lightColor, 0, 0.08);
          light.position.set(0, 0.008, 0);
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
        scene.add(compGroup);

        // Attach interactive snap terminals for 9V Battery
        if (comp.type === 'BATTERY_9V') {
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

        if (comp.modelUrl) {
          loadModelPrefab(
            comp.modelUrl,
            (model) => {
              model.traverse((child) => {
                if ((child as THREE.Mesh).isMesh) {
                  child.userData = { componentId: comp.id, isCircuitComponent: true };
                }
              });
              record!.loadedModel = model;
              compGroup.add(model);
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
        }
      }

      // Smooth position and rotation update
      record.group.position.set(comp.position[0], comp.position[2], comp.position[1]);
      record.group.rotation.set(comp.rotation[0], comp.rotation[1], comp.rotation[2]);

      // Selection indicator
      record.selRing.visible = comp.id === selectedComponentId;

      // Light emission update
      if (record.light) {
        if (comp.health !== 'BURNED_OUT' && comp.current > 0.001) {
          const target = Math.min(2.5, (comp.current / 0.02) * 1.5);
          record.light.userData.targetIntensity = target;
        } else {
          record.light.userData.targetIntensity = 0;
          record.light.intensity = 0;
        }
      }

      // Health / Burnout visual state update
      if (record.loadedModel && record.health !== comp.health) {
        record.health = comp.health;
        record.loadedModel.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            if (comp.health === 'BURNED_OUT') {
              (child as THREE.Mesh).material = new THREE.MeshStandardMaterial({
                color: 0x18181b,
                roughness: 0.9,
                metalness: 0.1,
              });
            } else if (comp.health === 'OVERHEATING') {
              (child as THREE.Mesh).material = new THREE.MeshStandardMaterial({
                color: 0x9a3412,
                roughness: 0.6,
                emissive: 0x7c2d12,
                emissiveIntensity: 0.4,
              });
            }
          }
        });
      }
    });

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
        modelUrl = '/models/power/battery_9v.glb';
        break;
      case 'POTENTIOMETER':
        modelUrl = '/models/components/potentiometer_10k.glb';
        break;
      case 'SPEAKER':
        modelUrl = '/models/components/speaker_8ohm.glb';
        break;
      case 'SWITCH_TACTILE':
        modelUrl = '/models/components/button_tactile_6mm.glb';
        break;
      case 'CAPACITOR_ELECTROLYTIC':
        modelUrl = '/models/components/capacitor_electrolytic.glb';
        break;
      case 'DIP8_555':
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
        mainGroup.remove(record.group);
        record.group.traverse((c) => {
          if ((c as THREE.Mesh).geometry) (c as THREE.Mesh).geometry.dispose();
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
        // Unchanged - zero re-creation!
        return;
      }

      if (existing) {
        mainGroup.remove(existing.group);
        existing.group.traverse((c) => {
          if ((c as THREE.Mesh).geometry) (c as THREE.Mesh).geometry.dispose();
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
          const dmmOrigin = new THREE.Vector3(0.09, 0.02, 0.09);
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
          redGroup.add(leadMesh);

          const probeGeo = new THREE.CylinderGeometry(0.002, 0.0008, 0.02, 12);
          const probeMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 });
          const probe = new THREE.Mesh(probeGeo, probeMat);
          probe.position.set(pinPos.x, pinPos.y + 0.01, pinPos.z);
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
          const dmmOrigin = new THREE.Vector3(0.08, 0.02, 0.095);
          const mid = new THREE.Vector3().addVectors(pinPos, dmmOrigin).multiplyScalar(0.5);
          mid.y += 0.025;

          const curve = new THREE.CatmullRomCurve3([pinPos, mid, dmmOrigin]);
          const tubeGeo = new THREE.TubeGeometry(curve, 24, 0.0012, 6, false);
          const tubeMat = new THREE.MeshStandardMaterial({
            color: 0x27272a,
            roughness: 0.5,
          });
          const leadMesh = new THREE.Mesh(tubeGeo, tubeMat);
          blackGroup.add(leadMesh);

          const probeGeo = new THREE.CylinderGeometry(0.002, 0.0008, 0.02, 12);
          const probeMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.4 });
          const probe = new THREE.Mesh(probeGeo, probeMat);
          probe.position.set(pinPos.x, pinPos.y + 0.01, pinPos.z);
          blackGroup.add(probe);

          mainGroup.add(blackGroup);
          dmmLeadsRef.current.black = blackGroup;
        }
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
    if (activeTool === 'SELECT' && !wiringStartHole && !placingComponent) {
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
              onSelectComponent(hitComp);
              onSelectWire(null);
              audioEngine.playKnobClick();
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
        if (draggedComp.type === 'BATTERY_9V') {
          const matPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
          const matIntersect = new THREE.Vector3();
          raycaster.ray.intersectPlane(matPlane, matIntersect);

          record.group.position.set(matIntersect.x, 0, matIntersect.z);
          setStatusMessage('Dragging 9V Battery • Release to place on workbench mat • Arrow keys (← / →) to rotate');
        } else {
          const bbPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.0085);
          const bbIntersect = new THREE.Vector3();
          raycaster.ray.intersectPlane(bbPlane, bbIntersect);

          const nearest = findNearestHole(bbIntersect.x, bbIntersect.z, 0.015);
          if (nearest) {
            const rotDeg = Math.round(((draggedComp.rotation ? draggedComp.rotation[1] : 0) * 180) / Math.PI) % 360;
            const fp = getComponentFootprint(draggedComp.type, nearest.id, rotDeg);
            if (fp.isValid && fp.holeIds.length > 0) {
              const p1 = getHolePosition(fp.holeIds[0]);
              const p2 = getHolePosition(fp.holeIds[fp.holeIds.length - 1]);
              if (p1 && p2) {
                record.group.position.set((p1[0] + p2[0]) / 2, 0.012, (p1[1] + p2[1]) / 2);
              }
              setStatusMessage(`Moving ${draggedComp.name} ➔ Holes [${fp.holeIds.join(', ')}] • Release to snap`);
            }
          }
        }
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
    setHoveredHoleId(activeTargetId);

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

        setStatusMessage(
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

      if (placingComponent.type === 'BATTERY_9V') {
        // Battery rests outside breadboard on ESD bench mat (Y = 0)
        const benchMatPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const matIntersect = new THREE.Vector3();
        raycaster.ray.intersectPlane(benchMatPlane, matIntersect);

        ghost.position.set(matIntersect.x, 0, matIntersect.z);
        ghost.rotation.set(0, (placementRotationDeg * Math.PI) / 180, 0);

        setStatusMessage(
          `Place 9V Battery on Bench Mat outside breadboard • Press 'R' to Rotate • Click to Place`
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
          ghost.position.set(midX, 0.012, midZ);
          ghost.rotation.set(0, (placementRotationDeg * Math.PI) / 180, 0);
        }

        setStatusMessage(
          `Place ${placingComponent.type} on [${fp.holeIds.join(', ')}] • Press 'R' to Rotate • Click to Attach`
        );
      } else {
        ghost.position.set(planeIntersect.x, 0.012, planeIntersect.z);
        setStatusMessage(`Hover over breadboard holes to place ${placingComponent.type}`);
      }
      return;
    }

    // Default HUD Message
    if (activeTool === 'WIRE') {
      if (hoveredTerminalId) {
        setStatusMessage(`${hoveredTerminalName} • Click to start jumper wire`);
      } else if (nearestHole) {
        setStatusMessage(`${getHoleDescription(nearestHole.id)} • Click to start jumper wire`);
      } else {
        setStatusMessage('Wire Tool: Click any hole or battery terminal to stretch wire');
      }
    } else if (activeProbe) {
      if (hoveredTerminalId) {
        setStatusMessage(`Click to attach Multimeter ${activeProbe} Probe to ${hoveredTerminalName}`);
      } else if (nearestHole) {
        setStatusMessage(`Click to attach Multimeter ${activeProbe} Probe to ${nearestHole.id}`);
      } else {
        setStatusMessage(`Click pin or terminal to attach Multimeter ${activeProbe} Probe`);
      }
    } else {
      if (hoveredTerminalId) {
        setStatusMessage(hoveredTerminalName);
      } else if (nearestHole) {
        setStatusMessage(getHoleDescription(nearestHole.id));
      } else {
        setStatusMessage('');
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    isDraggingRef.current = false;
    isPanningRef.current = false;

    if (isDraggingComponentRef.current && draggedCompIdRef.current) {
      const dragDist = Math.hypot(
        e.clientX - mouseDownPosRef.current.x,
        e.clientY - mouseDownPosRef.current.y
      );

      if (dragDist >= 6 && onMoveComponent) {
        const draggedComp = components.find((c) => c.id === draggedCompIdRef.current);
        if (draggedComp && containerRef.current && cameraRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const mouse = new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1
          );
          const raycaster = new THREE.Raycaster();
          raycaster.setFromCamera(mouse, cameraRef.current);

          if (draggedComp.type === 'BATTERY_9V') {
            const matPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            const matIntersect = new THREE.Vector3();
            raycaster.ray.intersectPlane(matPlane, matIntersect);

            const updatedComp: CircuitComponent = {
              ...draggedComp,
              position: [matIntersect.x, matIntersect.z, 0],
            };
            audioEngine.playSnapSound();
            onMoveComponent(draggedComp.id, updatedComp);
          } else {
            const bbPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.0085);
            const bbIntersect = new THREE.Vector3();
            raycaster.ray.intersectPlane(bbPlane, bbIntersect);

            const nearest = findNearestHole(bbIntersect.x, bbIntersect.z, 0.015);
            if (nearest) {
              const updatedComp = moveComponentToHole(draggedComp, nearest.id);
              if (updatedComp) {
                audioEngine.playSnapSound();
                onMoveComponent(draggedComp.id, updatedComp);
              }
            }
          }
        }
      }
      isDraggingComponentRef.current = false;
      draggedCompIdRef.current = null;
    }
  };

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
      if (placingComponent.type === 'BATTERY_9V') {
        const benchMatPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const matIntersect = new THREE.Vector3();
        raycaster.ray.intersectPlane(benchMatPlane, matIntersect);

        audioEngine.playSnapSound();
        onPlaceComponent(
          'BATTERY_9V',
          [],
          placementRotationDeg,
          9,
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
        let hit = intersects[0].object;
        while (hit.parent && !hit.userData.componentId && !hit.userData.wireId) {
          hit = hit.parent;
        }

        if (hit.userData.componentId) {
          const comp = components.find((c) => c.id === hit.userData.componentId) || null;
          audioEngine.playKnobClick();
          onSelectComponent(comp);
          onSelectWire(null);
          return;
        }

        if (hit.userData.wireId) {
          const wire = wires.find((w) => w.id === hit.userData.wireId) || null;
          audioEngine.playKnobClick();
          onSelectWire(wire);
          onSelectComponent(null);
          return;
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
