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
} from '../engine/breadboardModel';
import { WorkbenchTool } from './TopToolbar';
import { audioEngine } from '../engine/audioEngine';

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
    defaultValue?: number
  ) => void;
  onSelectComponent: (comp: CircuitComponent | null) => void;
  onSelectWire: (wire: JumperWire | null) => void;
  onComponentStateChange: (id: string, newState: Partial<CircuitComponent['state']>) => void;
  onSetProbeHole: (probe: 'RED' | 'BLACK', holeId: string) => void;
  activeProbe: 'RED' | 'BLACK' | null;
  selectedComponentId: string | null;
  selectedWireId: string | null;
  onCancelAction: () => void;
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
  const wireMeshesRef = useRef<THREE.Group | null>(null);
  const activeLightsRef = useRef<THREE.PointLight[]>([]);

  // Dynamic Wire Stretching Preview Mesh
  const previewWireMeshRef = useRef<THREE.Mesh | null>(null);
  const previewDupontHeadRef = useRef<THREE.Mesh | null>(null);
  const snapRingMeshRef = useRef<THREE.Mesh | null>(null);

  // Component Placement Ghost Group
  const ghostGroupRef = useRef<THREE.Group | null>(null);

  // Camera Orbit State
  const isDraggingRef = useRef(false);
  const isPanningRef = useRef(false);
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
    keyLight.shadow.bias = -0.0004;
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

    // Load Breadboard Model (with high-detail procedural fallback)
    const gltfLoader = new GLTFLoader();
    gltfLoader.load(
      '/models/boards/breadboard_830.glb',
      (gltf) => {
        const bbModel = gltf.scene;
        bbModel.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        breadboardGroup.add(bbModel);
      },
      undefined,
      () => {
        createProceduralBreadboard(breadboardGroup);
      }
    );

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

  // Procedural Breadboard Generator (Authentic details)
  const createProceduralBreadboard = (group: THREE.Group) => {
    // Plastic base with subtle cream ABS finish
    const baseGeo = new THREE.BoxGeometry(0.165, 0.0085, 0.055);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0xf5f3ee,
      roughness: 0.35,
      metalness: 0.02,
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.set(0, 0.00425, 0);
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    // Center DIP IC gutter trough
    const troughGeo = new THREE.BoxGeometry(0.160, 0.0018, 0.00762);
    const troughMat = new THREE.MeshStandardMaterial({ color: 0xdedcd7, roughness: 0.5 });
    const trough = new THREE.Mesh(troughGeo, troughMat);
    trough.position.set(0, 0.008, 0);
    group.add(trough);

    // Red & Blue Power Rails
    const railGeo = new THREE.BoxGeometry(0.155, 0.0002, 0.0008);
    const redMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const blueMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6 });

    const topRed = new THREE.Mesh(railGeo, redMat);
    topRed.position.set(0, 0.0086, -0.0245);
    group.add(topRed);

    const topBlue = new THREE.Mesh(railGeo, blueMat);
    topBlue.position.set(0, 0.0086, -0.021);
    group.add(topBlue);

    const botBlue = new THREE.Mesh(railGeo, blueMat);
    botBlue.position.set(0, 0.0086, 0.021);
    group.add(botBlue);

    const botRed = new THREE.Mesh(railGeo, redMat);
    botRed.position.set(0, 0.0086, 0.0245);
    group.add(botRed);

    // 830 Nickel Spring Contact Holes (Instanced Mesh for high-performance realism)
    const holeSquareGeo = new THREE.BoxGeometry(0.0011, 0.0006, 0.0011);
    const holeContactMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.3,
      metalness: 0.8,
    });
    const instancedHoles = new THREE.InstancedMesh(
      holeSquareGeo,
      holeContactMat,
      BREADBOARD_HOLES.size
    );
    const dummy = new THREE.Object3D();
    let idx = 0;
    BREADBOARD_HOLES.forEach((h) => {
      dummy.position.set(h.x, 0.0083, h.y);
      dummy.updateMatrix();
      instancedHoles.setMatrixAt(idx++, dummy.matrix);
    });
    instancedHoles.instanceMatrix.needsUpdate = true;
    group.add(instancedHoles);
  };

  // 2. Render Placed Components
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Clear existing component meshes
    componentMeshesRef.current.forEach((group) => scene.remove(group));
    componentMeshesRef.current.clear();
    activeLightsRef.current = [];

    const gltfLoader = new GLTFLoader();

    components.forEach((comp) => {
      const compGroup = new THREE.Group();
      compGroup.position.set(comp.position[0], comp.position[2], comp.position[1]);
      compGroup.rotation.set(comp.rotation[0], comp.rotation[1], comp.rotation[2]);
      compGroup.userData = { componentId: comp.id, isCircuitComponent: true };
      scene.add(compGroup);
      componentMeshesRef.current.set(comp.id, compGroup);

      // Selected Highlight Ring
      if (comp.id === selectedComponentId) {
        const selRingGeo = new THREE.RingGeometry(0.008, 0.011, 24);
        const selRingMat = new THREE.MeshBasicMaterial({
          color: 0xf59e0b,
          side: THREE.DoubleSide,
        });
        const selRing = new THREE.Mesh(selRingGeo, selRingMat);
        selRing.rotation.x = -Math.PI / 2;
        selRing.position.y = 0.001;
        compGroup.add(selRing);
      }

      if (comp.modelUrl) {
        gltfLoader.load(
          comp.modelUrl,
          (gltf) => {
            const m = gltf.scene;
            m.traverse((child) => {
              if ((child as THREE.Mesh).isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                child.userData = { componentId: comp.id, isCircuitComponent: true };

                // Overheating & Burnout visual degradation
                if (comp.health === 'BURNED_OUT') {
                  const burntMat = new THREE.MeshStandardMaterial({
                    color: 0x18181b,
                    roughness: 0.9,
                    metalness: 0.1,
                  });
                  (child as THREE.Mesh).material = burntMat;
                } else if (comp.health === 'OVERHEATING') {
                  const overMat = new THREE.MeshStandardMaterial({
                    color: 0x9a3412,
                    roughness: 0.6,
                    emissive: 0x7c2d12,
                    emissiveIntensity: 0.4,
                  });
                  (child as THREE.Mesh).material = overMat;
                }
              }
            });
            compGroup.add(m);
          },
          undefined,
          () => {
            // Fallback geometric representation
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

      // Dynamic LED / Bulb Emission
      if (
        (comp.type === 'LED' || comp.type === 'BULB_INCANDESCENT') &&
        comp.health !== 'BURNED_OUT' &&
        comp.current > 0.001
      ) {
        const intensity = Math.min(2.5, (comp.current / 0.02) * 1.5);
        const lightColor = comp.type === 'LED' ? 0xff3333 : 0xffaa44;

        const emitLight = new THREE.PointLight(lightColor, intensity, 0.08);
        emitLight.position.set(0, 0.008, 0);
        emitLight.userData = { targetIntensity: intensity };
        compGroup.add(emitLight);
        activeLightsRef.current.push(emitLight);
      }
    });
  }, [components, selectedComponentId]);

  // 3. Render Permanent Jumper Wires & DMM Physical Leads
  useEffect(() => {
    const group = wireMeshesRef.current;
    if (!group) return;
    group.clear();

    wires.forEach((wire) => {
      const p1 = new THREE.Vector3(wire.startPos[0], wire.startPos[2], wire.startPos[1]);
      const p2 = new THREE.Vector3(wire.endPos[0], wire.endPos[2], wire.endPos[1]);

      // Calculate middle sag point (catenary curve droop)
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

      const isSelected = wire.id === selectedWireId;
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
      group.add(tubeMesh);

      // DuPont terminal pin heads at both ends
      const pinGeo = new THREE.BoxGeometry(0.0025, 0.008, 0.0025);
      const pinMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.5 });

      const pin1 = new THREE.Mesh(pinGeo, pinMat);
      pin1.position.set(p1.x, p1.y + 0.004, p1.z);
      pin1.userData = { isWire: true, wireId: wire.id };
      group.add(pin1);

      const pin2 = new THREE.Mesh(pinGeo, pinMat);
      pin2.position.set(p2.x, p2.y + 0.004, p2.z);
      pin2.userData = { isWire: true, wireId: wire.id };
      group.add(pin2);
    });

    // Render DMM Red Probe Lead in 3D
    if (multimeter.redProbeHoleId) {
      const pos = getHolePosition(multimeter.redProbeHoleId);
      if (pos) {
        const pinPos = new THREE.Vector3(pos[0], pos[2], pos[1]);
        const dmmOrigin = new THREE.Vector3(0.09, 0.02, 0.09); // Cable leads towards bottom-right instrument
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
        group.add(leadMesh);

        // Gold needle tip probe housing
        const probeGeo = new THREE.CylinderGeometry(0.002, 0.0008, 0.02, 12);
        const probeMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 });
        const probe = new THREE.Mesh(probeGeo, probeMat);
        probe.position.set(pinPos.x, pinPos.y + 0.01, pinPos.z);
        group.add(probe);
      }
    }

    // Render DMM Black Probe Lead in 3D
    if (multimeter.blackProbeHoleId) {
      const pos = getHolePosition(multimeter.blackProbeHoleId);
      if (pos) {
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
        group.add(leadMesh);

        const probeGeo = new THREE.CylinderGeometry(0.002, 0.0008, 0.02, 12);
        const probeMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.4 });
        const probe = new THREE.Mesh(probeGeo, probeMat);
        probe.position.set(pinPos.x, pinPos.y + 0.01, pinPos.z);
        group.add(probe);
      }
    }
  }, [wires, selectedWireId, multimeter.redProbeHoleId, multimeter.blackProbeHoleId]);

  // 4. Mouse Handlers: Orbit, Panning, Real-Time Wire Stretching, and Component Placement
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      isDraggingRef.current = true;
    } else if (e.button === 2) {
      isPanningRef.current = true;
    }
    prevMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const dx = e.clientX - prevMouseRef.current.x;
    const dy = e.clientY - prevMouseRef.current.y;
    prevMouseRef.current = { x: e.clientX, y: e.clientY };

    // Orbit Camera
    if (isDraggingRef.current && activeTool === 'SELECT' && !wiringStartHole && !placingComponent) {
      cameraSphericalRef.current.theta -= dx * 0.008;
      cameraSphericalRef.current.phi = Math.max(
        0.1,
        Math.min(Math.PI / 2 - 0.05, cameraSphericalRef.current.phi + dy * 0.008)
      );
      updateCameraPosition();
      return;
    }

    // Pan Camera (Right-click drag)
    if (isPanningRef.current && cameraTargetRef.current) {
      cameraTargetRef.current.x -= dx * 0.0003;
      cameraTargetRef.current.z -= dy * 0.0003;
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

    // Breadboard horizontal surface plane (Y = 0.0085)
    const breadboardPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.0085);
    const planeIntersect = new THREE.Vector3();
    raycaster.ray.intersectPlane(breadboardPlane, planeIntersect);

    // Find nearest hole to cursor
    const nearestHole = findNearestHole(planeIntersect.x, planeIntersect.z, 0.009);
    setHoveredHoleId(nearestHole ? nearestHole.id : null);

    // Snap Ring Positioning
    if (snapRingMeshRef.current) {
      if (nearestHole) {
        snapRingMeshRef.current.position.set(nearestHole.x, 0.0088, nearestHole.y);
        snapRingMeshRef.current.visible = true;
      } else {
        snapRingMeshRef.current.visible = false;
      }
    }

    // A. Dynamic Wire Stretching Preview
    if (wiringStartHole) {
      const p1Coords = getHolePosition(wiringStartHole);
      if (p1Coords) {
        const p1 = new THREE.Vector3(p1Coords[0], p1Coords[2], p1Coords[1]);
        const p2 = nearestHole
          ? new THREE.Vector3(nearestHole.x, nearestHole.z, nearestHole.y)
          : planeIntersect.clone();

        const dist = p1.distanceTo(p2);
        const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
        mid.y += Math.max(0.01, Math.min(0.03, dist * 0.4));

        const curve = new THREE.CatmullRomCurve3([
          p1,
          new THREE.Vector3(p1.x, p1.y + 0.006, p1.z),
          mid,
          new THREE.Vector3(p2.x, p2.y + 0.006, p2.z),
          p2,
        ]);

        if (previewWireMeshRef.current) {
          sceneRef.current.remove(previewWireMeshRef.current);
          previewWireMeshRef.current.geometry.dispose();
        }

        const previewGeo = new THREE.TubeGeometry(curve, 24, 0.0013, 8, false);
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
          nearestHole
            ? `Connect Wire: ${wiringStartHole} ➔ ${nearestHole.id} (Click to attach)`
            : `Stretching Wire from ${wiringStartHole}... Click target pin`
        );
      }
      return;
    }

    // B. Component Placement Hologram Ghost
    if (placingComponent && ghostGroupRef.current) {
      const ghost = ghostGroupRef.current;
      ghost.visible = true;

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
      setStatusMessage('Wire Tool: Click any hole to begin stretching a jumper wire');
    } else if (activeProbe) {
      setStatusMessage(`Click pin to attach Multimeter ${activeProbe} Probe`);
    } else {
      setStatusMessage(nearestHole ? `Hole ${nearestHole.id}` : '');
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    isPanningRef.current = false;
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
    // 1. Probe Attachment
    if (activeProbe && hoveredHoleId) {
      audioEngine.playSnapSound();
      onSetProbeHole(activeProbe, hoveredHoleId);
      return;
    }

    // 2. Component Placement Mode
    if (placingComponent && hoveredHoleId) {
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

      {/* Floating Viewport Controls Hint */}
      <div className="absolute bottom-4 left-4 z-10 pointer-events-none glass-dock px-3 py-2 rounded-xl text-[11px] font-mono text-zinc-400 flex items-center gap-3 border border-white/[0.06]">
        <span>• Left-drag: Orbit</span>
        <span>• Right-drag: Pan</span>
        <span>• Scroll: Zoom</span>
        <span>• &apos;R&apos;: Rotate 90°</span>
        <span>• &apos;Esc&apos;: Cancel</span>
      </div>
    </div>
  );
}
