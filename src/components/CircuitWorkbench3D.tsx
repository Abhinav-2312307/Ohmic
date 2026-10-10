'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CircuitComponent, JumperWire, MultimeterState } from '../engine/componentTypes';
import { BREADBOARD_HOLES, getHolePosition } from '../engine/breadboardModel';

interface Workbench3DProps {
  components: CircuitComponent[];
  wires: JumperWire[];
  multimeter: MultimeterState;
  wireColor: string;
  isSimulating: boolean;
  onAddWire: (startHoleId: string, endHoleId: string, color: string) => void;
  onSelectComponent: (comp: CircuitComponent | null) => void;
  onComponentStateChange?: (id: string, newState: Partial<CircuitComponent['state']>) => void;
  onSetProbeHole?: (probe: 'RED' | 'BLACK', holeId: string) => void;
  activeProbe?: 'RED' | 'BLACK' | null;
}

export default function CircuitWorkbench3D({
  components,
  wires,
  multimeter,
  wireColor,
  isSimulating,
  onAddWire,
  onSelectComponent,
  onComponentStateChange,
  onSetProbeHole,
  activeProbe,
}: Workbench3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Interaction State
  const [wiringStartHole, setWiringStartHole] = useState<string | null>(null);
  const [hoveredHoleId, setHoveredHoleId] = useState<string | null>(null);
  const [hoverTooltip, setHoverTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  // Three.js References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const holeHitboxesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const componentMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const wireMeshesRef = useRef<THREE.Group | null>(null);
  const previewWireRef = useRef<THREE.Mesh | null>(null);
  const activeLightsRef = useRef<THREE.PointLight[]>([]);

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
    scene.background = new THREE.Color(0x0f1117); // Professional Dark CAD theme

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
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff8ee, 2.2);
    keyLight.position.set(0.2, 0.4, 0.3);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.05;
    keyLight.shadow.camera.far = 1.0;
    keyLight.shadow.bias = -0.0005;
    const d = 0.15;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xcceeff, 0.8);
    fillLight.position.set(-0.3, 0.2, -0.2);
    scene.add(fillLight);

    // Workbench ESD Anti-Static Ground Mat with Grid Lines
    const matGeo = new THREE.PlaneGeometry(0.5, 0.35);
    const matMat = new THREE.MeshStandardMaterial({
      color: 0x1a2130, // Navy ESD Bench Mat
      roughness: 0.7,
      metalness: 0.1,
    });
    const benchMat = new THREE.Mesh(matGeo, matMat);
    benchMat.rotation.x = -Math.PI / 2;
    benchMat.position.y = -0.001;
    benchMat.receiveShadow = true;
    scene.add(benchMat);

    // Subtle CAD Grid on the mat
    const gridHelper = new THREE.GridHelper(0.48, 48, 0x3d5a80, 0x223344);
    gridHelper.position.y = 0.0001;
    scene.add(gridHelper);

    // Breadboard Group
    const breadboardGroup = new THREE.Group();
    scene.add(breadboardGroup);

    // Load Breadboard GLB Model (with procedural fallback)
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
        // Fallback procedural breadboard
        createProceduralBreadboard(breadboardGroup);
      }
    );

    // Generate invisible raycast hitboxes for all 830 breadboard holes
    const holeHitboxGeo = new THREE.CylinderGeometry(0.0009, 0.0009, 0.002, 8);
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

    // Render Loop
    let animationId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      // Subtle pulse on emitting components
      activeLightsRef.current.forEach((light) => {
        light.intensity = THREE.MathUtils.lerp(light.intensity, light.userData.targetIntensity, delta * 8);
      });

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

  // Procedural breadboard fallback generator
  const createProceduralBreadboard = (group: THREE.Group) => {
    // Plastic base
    const baseGeo = new THREE.BoxGeometry(0.165, 0.0085, 0.055);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0xefede8,
      roughness: 0.4,
      metalness: 0.05,
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.set(0, 0.00425, 0);
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    // Center trough
    const troughGeo = new THREE.BoxGeometry(0.160, 0.0015, 0.00762);
    const troughMat = new THREE.MeshStandardMaterial({ color: 0xdedcd7, roughness: 0.6 });
    const trough = new THREE.Mesh(troughGeo, troughMat);
    trough.position.set(0, 0.008, 0);
    group.add(trough);

    // Red & Blue Power Rails
    const railGeo = new THREE.BoxGeometry(0.155, 0.0002, 0.0008);
    const redMat = new THREE.MeshBasicMaterial({ color: 0xcc2222 });
    const blueMat = new THREE.MeshBasicMaterial({ color: 0x2255cc });

    const topRed = new THREE.Mesh(railGeo, redMat);
    topRed.position.set(0, 0.0086, -0.0245);
    group.add(topRed);

    const topBlue = new THREE.Mesh(railGeo, blueMat);
    topBlue.position.set(0, 0.0086, -0.0210);
    group.add(topBlue);

    const botBlue = new THREE.Mesh(railGeo, blueMat);
    botBlue.position.set(0, 0.0086, 0.0210);
    group.add(botBlue);

    const botRed = new THREE.Mesh(railGeo, redMat);
    botRed.position.set(0, 0.0086, 0.0245);
    group.add(botRed);
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
      compGroup.userData = { componentId: comp.id };
      scene.add(compGroup);
      componentMeshesRef.current.set(comp.id, compGroup);

      if (comp.modelUrl) {
        gltfLoader.load(comp.modelUrl, (gltf) => {
          const model = gltf.scene.clone();
          model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;

              // Handle Burnout visual effect
              if (comp.health === 'BURNED_OUT' && mesh.material) {
                const burnedMat = new THREE.MeshStandardMaterial({
                  color: 0x111111, // Charred carbon black
                  roughness: 0.9,
                  metalness: 0.1,
                });
                mesh.material = burnedMat;
              }

              // Handle LED Emissive glow
              if (comp.type === 'LED' && comp.isEmitting && (mesh.name.includes('Dome') || mesh.name.includes('Epoxy'))) {
                const ledColorHex = comp.ledColor === 'GREEN' ? 0x00ff66 : comp.ledColor === 'BLUE' ? 0x0088ff : 0xff2222;
                const emissiveMat = new THREE.MeshStandardMaterial({
                  color: ledColorHex,
                  emissive: ledColorHex,
                  emissiveIntensity: Math.min(3.0, (comp.emissionIntensity || 1) * 2),
                  roughness: 0.2,
                });
                mesh.material = emissiveMat;
              }

              // Handle Bulb Tungsten Filament glow
              if (comp.type === 'BULB_INCANDESCENT' && comp.isEmitting && mesh.name.includes('Filament')) {
                const bulbMat = new THREE.MeshStandardMaterial({
                  color: 0xffe066,
                  emissive: 0xffaa00,
                  emissiveIntensity: Math.min(4.0, (comp.emissionIntensity || 1) * 3),
                  roughness: 0.1,
                });
                mesh.material = bulbMat;
              }
            }
          });
          compGroup.add(model);
        });
      }

      // Add dynamic point light for active LEDs and Bulbs
      if (comp.isEmitting) {
        const lightColor = comp.type === 'BULB_INCANDESCENT' ? 0xffbb44 : comp.ledColor === 'GREEN' ? 0x22ff55 : comp.ledColor === 'BLUE' ? 0x3388ff : 0xff3333;
        const pLight = new THREE.PointLight(lightColor, 0.4, 0.08);
        pLight.position.set(0, 0.015, 0);
        pLight.userData = { targetIntensity: Math.min(0.8, (comp.emissionIntensity || 1) * 0.5) };
        compGroup.add(pLight);
        activeLightsRef.current.push(pLight);
      }
    });
  }, [components]);

  // 3. Render Jumper Wires with Catmull-Rom Catenary Sag
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
      mid.y += Math.max(0.008, Math.min(0.025, dist * 0.35)); // Natural sag arc

      const curve = new THREE.CatmullRomCurve3([
        p1,
        new THREE.Vector3(p1.x, p1.y + 0.006, p1.z), // Vertical lift out of pin
        mid,
        new THREE.Vector3(p2.x, p2.y + 0.006, p2.z), // Vertical descent into pin
        p2,
      ]);

      const tubeGeo = new THREE.TubeGeometry(curve, 32, 0.00065, 8, false);
      const wireMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(wire.color),
        roughness: 0.35,
        metalness: 0.1,
      });

      const wireMesh = new THREE.Mesh(tubeGeo, wireMat);
      wireMesh.castShadow = true;
      group.add(wireMesh);

      // Add DuPont terminal pin heads at both ends
      const pinGeo = new THREE.BoxGeometry(0.0025, 0.008, 0.0025);
      const pinMat = new THREE.MeshStandardMaterial({ color: 0x111112, roughness: 0.5 });

      const pin1 = new THREE.Mesh(pinGeo, pinMat);
      pin1.position.set(p1.x, p1.y + 0.004, p1.z);
      group.add(pin1);

      const pin2 = new THREE.Mesh(pinGeo, pinMat);
      pin2.position.set(p2.x, p2.y + 0.004, p2.z);
      group.add(pin2);
    });
  }, [wires]);

  // 4. Mouse Handlers for Camera Orbit, Panning, and Wiring
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
    if (isDraggingRef.current) {
      cameraSphericalRef.current.theta -= dx * 0.008;
      cameraSphericalRef.current.phi = Math.max(
        0.1,
        Math.min(Math.PI / 2 - 0.05, cameraSphericalRef.current.phi + dy * 0.008)
      );
      updateCameraPosition();
      return;
    }

    // Pan Camera
    if (isPanningRef.current && cameraTargetRef.current) {
      cameraTargetRef.current.x -= dx * 0.0003;
      cameraTargetRef.current.z -= dy * 0.0003;
      updateCameraPosition();
      return;
    }

    // Raycast Hole Hover & Tooltip
    if (!containerRef.current || !cameraRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);

    const hitboxes = Array.from(holeHitboxesRef.current.values());
    const intersects = raycaster.intersectObjects(hitboxes);

    if (intersects.length > 0) {
      const hit = intersects[0].object as THREE.Mesh;
      const holeId = hit.userData.holeId;
      setHoveredHoleId(holeId);

      const hole = BREADBOARD_HOLES.get(holeId);
      if (hole) {
        setHoverTooltip({
          text: `Pin ${holeId} (${hole.nodeGroup})`,
          x: e.clientX - rect.left + 15,
          y: e.clientY - rect.top - 20,
        });
      }
    } else {
      setHoveredHoleId(null);
      setHoverTooltip(null);
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

  // Click handler to wire pins or attach multimeter probes
  const handleClick = (e: React.MouseEvent) => {
    if (!hoveredHoleId) return;

    // Probe Attachment Mode
    if (activeProbe && onSetProbeHole) {
      onSetProbeHole(activeProbe, hoveredHoleId);
      return;
    }

    // Jumper Wiring Mode
    if (!wiringStartHole) {
      setWiringStartHole(hoveredHoleId);
    } else {
      if (wiringStartHole !== hoveredHoleId) {
        onAddWire(wiringStartHole, hoveredHoleId, wireColor);
      }
      setWiringStartHole(null);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full cursor-crosshair select-none overflow-hidden"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onClick={handleClick}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* HUD Instructions Overlay */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none flex flex-col gap-1 text-xs text-slate-300 bg-slate-950/80 backdrop-blur-md p-3 rounded-lg border border-slate-800 shadow-xl">
        <div className="flex items-center gap-2 font-semibold text-amber-400">
          <span>⚡ 3D WORKBENCH CONTROLS</span>
        </div>
        <p>• Left-click drag: Orbit Camera</p>
        <p>• Right-click drag: Pan Workbench</p>
        <p>• Mouse scroll: Zoom In / Out</p>
        <p className="text-emerald-400 mt-1 font-medium">
          {wiringStartHole
            ? `Wiring from ${wiringStartHole}... Click target pin to connect!`
            : activeProbe
            ? `Click pin to attach ${activeProbe} probe!`
            : '• Click any hole to begin routing a jumper wire'}
        </p>
      </div>

      {/* Pin Tooltip */}
      {hoverTooltip && (
        <div
          className="absolute z-20 pointer-events-none bg-slate-900/95 text-emerald-400 font-mono text-[11px] px-2.5 py-1 rounded shadow-lg border border-emerald-500/40"
          style={{ left: hoverTooltip.x, top: hoverTooltip.y }}
        >
          {hoverTooltip.text}
        </div>
      )}
    </div>
  );
}
