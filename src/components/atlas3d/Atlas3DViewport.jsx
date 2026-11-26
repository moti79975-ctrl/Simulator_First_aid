import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { ATLAS_SYSTEMS, ATLAS_STRUCTURES_MAP } from '../../data/atlas3DDatabase';
import { buildFullBody3D } from './HumanBody3DBuilder';
import { computeArterialWave } from '../../engines/PhysiologyEngine';

const SYSTEM_IDS = ['skin', 'muscular', 'skeletal', 'organs', 'vascular', 'nervous'];

const DEFAULT_EXPLODE_OFFSETS = {
  skin: -1.25,
  muscular: -0.75,
  skeletal: -0.25,
  organs: 0.25,
  vascular: 0.75,
  nervous: 1.25,
};

const DEFAULT_LAYER_STATE = {
  skin: { visible: true, opacity: 0.34 },
  muscular: { visible: true, opacity: 0.28 },
  skeletal: { visible: true, opacity: 1 },
  organs: { visible: true, opacity: 1 },
  vascular: { visible: true, opacity: 1 },
  nervous: { visible: true, opacity: 0.9 },
};

const COLOR_SELECTED_EMISSIVE = new THREE.Color(0x00e5ff);
const COLOR_HOVERED_EMISSIVE = new THREE.Color(0x38bdf8);
const COLOR_ARTERIAL_PULSE = new THREE.Color(0xdc2626);

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function getSystemsList() {
  if (Array.isArray(ATLAS_SYSTEMS)) return ATLAS_SYSTEMS;
  if (ATLAS_SYSTEMS && typeof ATLAS_SYSTEMS === 'object') {
    return Object.values(ATLAS_SYSTEMS);
  }
  return [];
}

function getExplodeOffsetMap() {
  const map = { ...DEFAULT_EXPLODE_OFFSETS };
  const list = getSystemsList();
  list.forEach((sys) => {
    if (sys && sys.id && typeof sys.explodeOffsetX === 'number') {
      map[sys.id] = sys.explodeOffsetX;
    }
  });
  return map;
}

function getSystemMetaMap() {
  const map = {};
  const list = getSystemsList();
  list.forEach((sys) => {
    if (sys && sys.id) {
      map[sys.id] = sys;
    }
  });
  return map;
}

/**
 * Generates a high-resolution procedural CanvasTexture for the calibrated
 * glass medical pedestal degree dial (0°-360° ticks + anatomical orientation).
 */
function createPedestalDialTexture() {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;

  ctx.clearRect(0, 0, size, size);

  // Subtle radial glass glow backdrop
  const bgGrad = ctx.createRadialGradient(cx, cy, 30, cx, cy, 480);
  bgGrad.addColorStop(0, 'rgba(14, 165, 233, 0.22)');
  bgGrad.addColorStop(0.58, 'rgba(15, 23, 42, 0.45)');
  bgGrad.addColorStop(0.86, 'rgba(56, 189, 248, 0.16)');
  bgGrad.addColorStop(1, 'rgba(6, 13, 28, 0)');
  ctx.fillStyle = bgGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 485, 0, Math.PI * 2);
  ctx.fill();

  // Concentric calibrated measurement rings
  [120, 225, 330, 415, 462].forEach((r, idx) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle =
      idx === 4
        ? 'rgba(56, 189, 248, 0.78)'
        : idx === 3
        ? 'rgba(56, 189, 248, 0.35)'
        : 'rgba(148, 163, 184, 0.18)';
    ctx.lineWidth = idx === 4 ? 3 : 1.5;
    ctx.stroke();
  });

  // Subtle orthogonal crosshair axes
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 10]);
  ctx.beginPath();
  ctx.moveTo(cx - 410, cy);
  ctx.lineTo(cx + 410, cy);
  ctx.moveTo(cx, cy - 410);
  ctx.lineTo(cx, cy + 410);
  ctx.stroke();
  ctx.setLineDash([]);

  // 360-degree calibrated ticks (5° minor, 15° medium, 45° major)
  for (let deg = 0; deg < 360; deg += 5) {
    const rad = ((deg - 90) * Math.PI) / 180;
    const isCardinal = deg % 90 === 0;
    const isMajor = deg % 45 === 0;
    const isMedium = deg % 15 === 0;
    const outerR = 458;
    const innerR = isCardinal ? 416 : isMajor ? 426 : isMedium ? 436 : 445;

    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(rad) * innerR, cy + Math.sin(rad) * innerR);
    ctx.lineTo(cx + Math.cos(rad) * outerR, cy + Math.sin(rad) * outerR);
    ctx.strokeStyle = isCardinal
      ? 'rgba(125, 211, 252, 0.95)'
      : isMajor
      ? 'rgba(56, 189, 248, 0.72)'
      : isMedium
      ? 'rgba(148, 163, 184, 0.45)'
      : 'rgba(148, 163, 184, 0.24)';
    ctx.lineWidth = isCardinal ? 3.2 : isMajor ? 2.2 : 1.3;
    ctx.stroke();

    if (isMajor) {
      const labelR = 384;
      const lx = cx + Math.cos(rad) * labelR;
      const ly = cy + Math.sin(rad) * labelR;
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(rad + Math.PI / 2);
      ctx.fillStyle = isCardinal ? '#7dd3fc' : 'rgba(148, 163, 184, 0.75)';
      ctx.font = isCardinal ? 'bold 26px "Segoe UI", sans-serif' : '600 18px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let label = `${deg}°`;
      if (deg === 180) label = '0° ANT';
      else if (deg === 0) label = '180° POST';
      else if (deg === 90) label = '90° L';
      else if (deg === 270) label = '270° R';
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/**
 * Fallback glowing cyan laser slice plane in case the builder does not expose one.
 */
function createFallbackSlicePlane() {
  const group = new THREE.Group();
  group.name = 'fallbackSlicePlane';

  const discGeo = new THREE.CircleGeometry(0.46, 64);
  const discMat = new THREE.MeshBasicMaterial({
    color: 0x0ea5e9,
    transparent: true,
    opacity: 0.14,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const disc = new THREE.Mesh(discGeo, discMat);
  disc.rotation.x = -Math.PI / 2;
  group.add(disc);

  const ringGeo = new THREE.TorusGeometry(0.46, 0.0045, 10, 80);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.88,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  return { group, geometries: [discGeo, ringGeo], materials: [discMat, ringMat] };
}

/**
 * Walk up ancestor chain to resolve structureId and systemId attached via userData.
 */
function resolveMeshMeta(mesh, fallbackSystemId) {
  let structureId = null;
  let systemId = fallbackSystemId || null;
  let node = mesh;
  while (node) {
    if (!structureId && node.userData?.structureId) {
      structureId = node.userData.structureId;
    }
    if (!systemId && node.userData?.systemId) {
      systemId = node.userData.systemId;
    }
    node = node.parent;
  }
  if (!systemId && structureId) {
    const struct = ATLAS_STRUCTURES_MAP?.[structureId];
    if (struct) {
      systemId = struct.systemId || struct.system || null;
    }
  }
  return { structureId, systemId };
}

/**
 * Checks whether a mesh/structure represents an arterial blood vessel for live pulse glow.
 */
function isArterialStructure(structureId, mesh) {
  if (mesh?.userData?.isArterial) return true;
  if (!structureId) return false;
  const id = String(structureId).toLowerCase();
  return (
    id.includes('aorta') ||
    id.includes('artery') ||
    id.includes('arterial') ||
    id.includes('carotid') ||
    id.includes('subclavian') ||
    id.includes('brachial') ||
    id.includes('radial') ||
    id.includes('femoral') ||
    id.includes('coronary') ||
    id.includes('iliac_art') ||
    id.includes('pulmonary_trunk')
  );
}

/**
 * src/components/atlas3d/Atlas3DViewport.jsx
 * Pure Three.js interactive 3D Clinical Anatomy Studio Viewport:
 * - Dark clinical studio (#060d1c) + calibrated glowing glass pedestal + 3-point lighting
 * - Smooth 360° spherical orbit, zoom (0.55..4.4), vertical/horizontal pan & fly-to damping
 * - Real-time 6-system layer visibility & opacity without WebGL scene rebuild
 * - Smooth Exploded 3D anatomical layer separation
 * - Synchronized 3D CT laser slice plane
 * - Live beating 4-chamber heart, breathing lungs + diaphragm, & arterial pulse wave
 * - Smart translucent-skin raycaster picking + luminous cyan highlight + floating Hebrew/Latin tooltip
 */
export default function Atlas3DViewport({
  gender = 'male',
  layerState = DEFAULT_LAYER_STATE,
  exploded = false,
  sliceHeightPct = 68,
  showSlicePlane = true,
  cameraTargetReq = null,
  selectedStructureId = null,
  hoveredStructureId = null,
  hr = 76,
  rr = 15,
  autoRotate = false,
  onSelectStructure,
  onHoverStructure,
}) {
  const containerRef = useRef(null);
  const canvasHostRef = useRef(null);

  // Core Three.js scene references
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const bodyBundleRef = useRef(null);

  // Live prop refs for zero-recreation 60 FPS loop
  const layerStateRef = useRef(layerState || DEFAULT_LAYER_STATE);
  const explodedRef = useRef(exploded);
  const sliceHeightPctRef = useRef(sliceHeightPct);
  const showSlicePlaneRef = useRef(showSlicePlane);
  const selectedIdRef = useRef(selectedStructureId);
  const hoveredIdRef = useRef(hoveredStructureId);
  const hrRef = useRef(hr);
  const rrRef = useRef(rr);
  const autoRotateRef = useRef(autoRotate);
  const onSelectRef = useRef(onSelectStructure);
  const onHoverRef = useRef(onHoverStructure);

  // Spherical orbit camera state (smoothly damped current -> desired)
  const orbitRef = useRef({
    theta: 0.22,
    phi: 1.44,
    radius: 2.55,
    target: new THREE.Vector3(0, 0.92, 0),
    desiredTheta: 0.22,
    desiredPhi: 1.44,
    desiredRadius: 2.55,
    desiredTarget: new THREE.Vector3(0, 0.92, 0),
    isDragging: false,
    dragMode: 'orbit', // 'orbit' | 'pan'
    lastX: 0,
    lastY: 0,
    downX: 0,
    downY: 0,
    dragDist: 0,
    pinchDist: 0,
  });

  // Floating Hebrew + Latin tooltip UI state
  const [tooltip, setTooltip] = useState(null); // { id, x, y }
  const [cursorStyle, setCursorStyle] = useState('grab');

  // Sync live refs cleanly
  useEffect(() => {
    layerStateRef.current = layerState || DEFAULT_LAYER_STATE;
  }, [layerState]);

  useEffect(() => {
    const wasExploded = explodedRef.current;
    explodedRef.current = exploded;
    // Gently pull camera back if zoomed in when activating Exploded 3D view
    if (exploded && !wasExploded) {
      const orb = orbitRef.current;
      if (orb.desiredRadius < 3.15) {
        orb.desiredRadius = 3.45;
      }
      orb.desiredTarget.x = 0;
    }
  }, [exploded]);

  useEffect(() => {
    sliceHeightPctRef.current = sliceHeightPct;
  }, [sliceHeightPct]);

  useEffect(() => {
    showSlicePlaneRef.current = showSlicePlane;
  }, [showSlicePlane]);

  useEffect(() => {
    selectedIdRef.current = selectedStructureId;
  }, [selectedStructureId]);

  useEffect(() => {
    hoveredIdRef.current = hoveredStructureId;
  }, [hoveredStructureId]);

  useEffect(() => {
    hrRef.current = hr;
  }, [hr]);

  useEffect(() => {
    rrRef.current = rr;
  }, [rr]);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    onSelectRef.current = onSelectStructure;
  }, [onSelectStructure]);

  useEffect(() => {
    onHoverRef.current = onHoverStructure;
  }, [onHoverStructure]);

  // Smooth camera fly-to whenever cameraTargetReq changes
  useEffect(() => {
    if (!cameraTargetReq) return;
    const targetArr = cameraTargetReq.target || [0, 0.92, 0];
    const posArr = cameraTargetReq.pos || [0, 1.0, 2.55];

    const tx = clamp(Number(targetArr[0]) || 0, -1.35, 1.35);
    const ty = clamp(Number(targetArr[1]) || 0.92, 0.1, 1.7);
    const tz = clamp(Number(targetArr[2]) || 0, -0.45, 0.45);

    const dx = (Number(posArr[0]) || 0) - tx;
    const dy = (Number(posArr[1]) || 1.0) - ty;
    const dz = (Number(posArr[2]) || 2.55) - tz;

    const r = clamp(Math.hypot(dx, dy, dz) || 2.55, 0.55, 4.4);
    const phi = clamp(Math.acos(clamp(dy / r, -1, 1)), 0.18, Math.PI - 0.18);
    const rawTheta = Math.atan2(dx, dz);

    const orb = orbitRef.current;
    // Shortest-path angular interpolation so camera never spins the long way around
    let deltaTheta = rawTheta - orb.desiredTheta;
    while (deltaTheta > Math.PI) deltaTheta -= Math.PI * 2;
    while (deltaTheta < -Math.PI) deltaTheta += Math.PI * 2;

    orb.desiredTarget.set(tx, ty, tz);
    orb.desiredRadius = r;
    orb.desiredPhi = phi;
    orb.desiredTheta = orb.desiredTheta + deltaTheta;
  }, [cameraTargetReq]);

  // Quick viewport zoom / reset controls
  const handleQuickZoom = useCallback((factor) => {
    const orb = orbitRef.current;
    orb.desiredRadius = clamp(orb.desiredRadius * factor, 0.55, 4.4);
  }, []);

  const handleResetView = useCallback(() => {
    const orb = orbitRef.current;
    let deltaTheta = 0.22 - orb.desiredTheta;
    while (deltaTheta > Math.PI) deltaTheta -= Math.PI * 2;
    while (deltaTheta < -Math.PI) deltaTheta += Math.PI * 2;
    orb.desiredTheta += deltaTheta;
    orb.desiredPhi = 1.44;
    orb.desiredRadius = explodedRef.current ? 3.55 : 2.55;
    orb.desiredTarget.set(0, 0.92, 0);
  }, []);

  // =========================================================================
  // EFFECT 1: Initialize Persistent Three.js Clinical Studio Scene + Controls + RAF Loop
  // =========================================================================
  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060d1c);
    scene.fog = new THREE.FogExp2(0x060d1c, 0.082);
    sceneRef.current = scene;

    const initW = Math.max(320, host.clientWidth || 640);
    const initH = Math.max(360, host.clientHeight || 620);

    const camera = new THREE.PerspectiveCamera(40, initW / initH, 0.05, 40);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(initW, initH);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;

    host.innerHTML = '';
    host.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';

    // ---------------------------------------------------------
    // 3-Point Clinical Studio Lighting
    // ---------------------------------------------------------
    const hemiLight = new THREE.HemisphereLight(0xd0e9ff, 0x0e182d, 0.88);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1dc, 2.05);
    keyLight.position.set(2.3, 3.6, 2.9);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 11;
    keyLight.shadow.camera.left = -2.1;
    keyLight.shadow.camera.right = 2.1;
    keyLight.shadow.camera.top = 2.4;
    keyLight.shadow.camera.bottom = -0.5;
    keyLight.shadow.bias = -0.00045;
    keyLight.shadow.radius = 3;
    scene.add(keyLight);

    const cyanRimLight = new THREE.DirectionalLight(0x38bdf8, 1.38);
    cyanRimLight.position.set(-2.7, 2.35, -2.5);
    scene.add(cyanRimLight);

    const backFillLight = new THREE.DirectionalLight(0x818cf8, 0.56);
    backFillLight.position.set(2.0, 1.25, -2.6);
    scene.add(backFillLight);

    const pedestalUpLight = new THREE.PointLight(0x0ea5e9, 0.9, 3.2);
    pedestalUpLight.position.set(0, 0.16, 0.32);
    scene.add(pedestalUpLight);

    // ---------------------------------------------------------
    // Glowing Glass Medical Pedestal at y = 0 with Degree Rings
    // ---------------------------------------------------------
    const studioDisposables = [];
    const pedestalGroup = new THREE.Group();

    // Subtle matte studio shadow floor
    const floorGeo = new THREE.CircleGeometry(7.5, 48);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x060d1c,
      roughness: 0.94,
      metalness: 0.08,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -0.056;
    floorMesh.receiveShadow = true;
    pedestalGroup.add(floorMesh);
    studioDisposables.push(floorGeo, floorMat);

    // Beveled clinical titanium base
    const baseGeo = new THREE.CylinderGeometry(0.65, 0.72, 0.052, 64);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x10203a,
      roughness: 0.34,
      metalness: 0.78,
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = -0.028;
    baseMesh.receiveShadow = true;
    pedestalGroup.add(baseMesh);
    studioDisposables.push(baseGeo, baseMat);

    // Translucent frosted medical glass plate
    const glassGeo = new THREE.CylinderGeometry(0.62, 0.62, 0.01, 64);
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x0c2442,
      roughness: 0.16,
      metalness: 0.15,
      transparent: true,
      opacity: 0.78,
      clearcoat: 0.9,
      clearcoatRoughness: 0.12,
    });
    const glassMesh = new THREE.Mesh(glassGeo, glassMat);
    glassMesh.position.y = -0.004;
    glassMesh.receiveShadow = true;
    pedestalGroup.add(glassMesh);
    studioDisposables.push(glassGeo, glassMat);

    // Calibrated 360° degree dial disc at y = 0.002
    const dialTex = createPedestalDialTexture();
    const dialGeo = new THREE.CircleGeometry(0.62, 64);
    const dialMat = new THREE.MeshBasicMaterial({
      map: dialTex,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });
    const dialMesh = new THREE.Mesh(dialGeo, dialMat);
    dialMesh.rotation.x = -Math.PI / 2;
    dialMesh.position.y = 0.002;
    pedestalGroup.add(dialMesh);
    studioDisposables.push(dialTex, dialGeo, dialMat);

    // Luminous inner & outer cyan glass edge rings
    const innerRingGeo = new THREE.TorusGeometry(0.635, 0.006, 12, 96);
    const innerRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.85,
    });
    const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    innerRing.rotation.x = Math.PI / 2;
    innerRing.position.y = 0.001;
    pedestalGroup.add(innerRing);
    studioDisposables.push(innerRingGeo, innerRingMat);

    const outerRingGeo = new THREE.TorusGeometry(0.735, 0.004, 10, 96);
    const outerRingMat = new THREE.MeshBasicMaterial({
      color: 0x0ea5e9,
      transparent: true,
      opacity: 0.42,
    });
    const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
    outerRing.rotation.x = Math.PI / 2;
    outerRing.position.y = -0.05;
    pedestalGroup.add(outerRing);
    studioDisposables.push(outerRingGeo, outerRingMat);

    scene.add(pedestalGroup);

    // ---------------------------------------------------------
    // Raycaster & Smart Translucent-Skin Picking Helper
    // ---------------------------------------------------------
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();

    const pickStructureAtClient = (clientX, clientY) => {
      const bundle = bodyBundleRef.current;
      if (!bundle || !bundle.pickableMeshes.length) return null;

      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;

      pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);

      const layers = layerStateRef.current || DEFAULT_LAYER_STATE;

      // Filter strictly to currently visible systems with opacity > 0.05
      const activeMeshes = bundle.pickableMeshes.filter((entry) => {
        const cfg = layers[entry.systemId];
        if (!cfg) return true;
        return Boolean(cfg.visible) && (cfg.opacity ?? 1) > 0.05;
      });

      if (!activeMeshes.length) return null;

      const intersects = raycaster.intersectObjects(
        activeMeshes.map((e) => e.mesh),
        false
      );

      if (!intersects.length) return null;

      const validHits = [];
      for (let i = 0; i < intersects.length; i += 1) {
        const hitMesh = intersects[i].object;
        const meta = bundle.meshMetaMap.get(hitMesh);
        if (!meta || !meta.structureId) continue;
        const cfg = layers[meta.systemId];
        if (cfg && (!cfg.visible || (cfg.opacity ?? 1) <= 0.05)) continue;
        validHits.push({
          structureId: meta.structureId,
          systemId: meta.systemId,
          distance: intersects[i].distance,
        });
      }

      if (!validHits.length) return null;

      // Smart translucent-skin pass-through:
      // If skin is semi-transparent (opacity < 0.55), prefer internal structures behind it!
      const skinCfg = layers.skin;
      const skinOpacity = skinCfg ? (skinCfg.visible ? skinCfg.opacity : 0) : 1;
      if (skinOpacity < 0.55) {
        const internalHit = validHits.find((h) => h.systemId !== 'skin');
        if (internalHit) return internalHit;
      }

      return validHits[0];
    };

    // ---------------------------------------------------------
    // Pointer, Wheel & Touch Controls (360° Orbit + Zoom + Pan)
    // ---------------------------------------------------------
    const dom = renderer.domElement;
    const activePointers = new Map();

    const onContextMenu = (e) => e.preventDefault();

    const onPointerDown = (e) => {
      dom.setPointerCapture?.(e.pointerId);
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      const orb = orbitRef.current;
      if (activePointers.size === 1) {
        orb.isDragging = true;
        orb.dragMode = e.button === 2 || e.button === 1 || e.shiftKey ? 'pan' : 'orbit';
        orb.lastX = e.clientX;
        orb.lastY = e.clientY;
        orb.downX = e.clientX;
        orb.downY = e.clientY;
        orb.dragDist = 0;
        setCursorStyle('grabbing');
      } else if (activePointers.size === 2) {
        const pts = Array.from(activePointers.values());
        orb.pinchDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        orb.dragMode = 'pinch';
        orb.dragDist = 100;
      }
    };

    const onPointerMove = (e) => {
      const orb = orbitRef.current;
      if (activePointers.has(e.pointerId)) {
        activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }

      if (activePointers.size === 2) {
        const pts = Array.from(activePointers.values());
        const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        if (orb.pinchDist > 0 && dist > 0) {
          const scale = orb.pinchDist / dist;
          orb.desiredRadius = clamp(orb.desiredRadius * scale, 0.55, 4.4);
        }
        orb.pinchDist = dist;
        setTooltip(null);
        return;
      }

      if (orb.isDragging) {
        const dx = e.clientX - orb.lastX;
        const dy = e.clientY - orb.lastY;
        orb.lastX = e.clientX;
        orb.lastY = e.clientY;
        orb.dragDist += Math.hypot(dx, dy);

        if (orb.dragMode === 'orbit') {
          orb.desiredTheta -= dx * 0.0082;
          orb.desiredPhi = clamp(orb.desiredPhi - dy * 0.0072, 0.18, Math.PI - 0.18);
        } else if (orb.dragMode === 'pan') {
          const panScale = orb.desiredRadius * 0.00145;
          // Pan vertically along body (y = 0.1..1.7) and laterally relative to camera right
          orb.desiredTarget.y = clamp(orb.desiredTarget.y + dy * panScale, 0.1, 1.7);
          const rightX = Math.cos(orb.theta);
          const rightZ = -Math.sin(orb.theta);
          orb.desiredTarget.x = clamp(orb.desiredTarget.x - dx * panScale * rightX, -1.35, 1.35);
          orb.desiredTarget.z = clamp(orb.desiredTarget.z - dx * panScale * rightZ, -0.45, 0.45);
        }
        setTooltip(null);
        return;
      }

      // Hover raycasting when not dragging
      const hit = pickStructureAtClient(e.clientX, e.clientY);
      const nextHoverId = hit ? hit.structureId : null;
      if (nextHoverId !== hoveredIdRef.current) {
        hoveredIdRef.current = nextHoverId;
        onHoverRef.current?.(nextHoverId);
      }

      if (nextHoverId && containerRef.current) {
        const cRect = containerRef.current.getBoundingClientRect();
        setTooltip({
          id: nextHoverId,
          x: e.clientX - cRect.left,
          y: e.clientY - cRect.top,
        });
        setCursorStyle('pointer');
      } else {
        setTooltip(null);
        setCursorStyle('grab');
      }
    };

    const onPointerUp = (e) => {
      activePointers.delete(e.pointerId);
      dom.releasePointerCapture?.(e.pointerId);

      const orb = orbitRef.current;
      const wasClick = orb.isDragging && orb.dragDist < 6 && e.button === 0 && !e.shiftKey;

      if (activePointers.size === 0) {
        orb.isDragging = false;
        orb.pinchDist = 0;
      }

      if (wasClick) {
        const hit = pickStructureAtClient(e.clientX, e.clientY);
        if (hit?.structureId) {
          onSelectRef.current?.(hit.structureId);
        }
      }

      setCursorStyle(hoveredIdRef.current ? 'pointer' : 'grab');
    };

    const onPointerLeave = () => {
      if (!orbitRef.current.isDragging) {
        setTooltip(null);
        if (hoveredIdRef.current !== null) {
          hoveredIdRef.current = null;
          onHoverRef.current?.(null);
        }
      }
    };

    const onWheel = (e) => {
      e.preventDefault();
      const orb = orbitRef.current;
      const zoomFactor = e.deltaY > 0 ? 1.09 : 0.915;
      orb.desiredRadius = clamp(orb.desiredRadius * zoomFactor, 0.55, 4.4);
    };

    dom.addEventListener('contextmenu', onContextMenu);
    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    dom.addEventListener('pointerleave', onPointerLeave);
    dom.addEventListener('wheel', onWheel, { passive: false });

    // ResizeObserver for crisp responsive viewport
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(260, Math.floor(entry.contentRect.width));
        const h = Math.max(300, Math.floor(entry.contentRect.height));
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      }
    });
    resizeObserver.observe(host);

    // ---------------------------------------------------------
    // 60 FPS Animation Loop: Camera + Layers + Explode + Slice + Physiology + Highlights
    // ---------------------------------------------------------
    const explodeOffsetMap = getExplodeOffsetMap();
    let rafId = 0;
    let lastTs = 0;
    let elapsed = 0;
    let cardiacPhase = 0;
    let respPhase = 0;

    const animate = (ts) => {
      rafId = requestAnimationFrame(animate);
      if (!lastTs) lastTs = ts;
      const dt = Math.min(0.05, (ts - lastTs) / 1000);
      lastTs = ts;
      elapsed += dt;

      // 1. Update Smooth Spherical Orbit Camera
      const orb = orbitRef.current;
      if (autoRotateRef.current && !orb.isDragging) {
        orb.desiredTheta += dt * 0.42;
      }

      const damp = 1 - Math.exp(-9.0 * dt);
      orb.theta += (orb.desiredTheta - orb.theta) * damp;
      orb.phi += (orb.desiredPhi - orb.phi) * damp;
      orb.radius += (orb.desiredRadius - orb.radius) * damp;
      orb.target.lerp(orb.desiredTarget, damp);

      const sinPhi = Math.sin(orb.phi);
      camera.position.set(
        orb.target.x + orb.radius * sinPhi * Math.sin(orb.theta),
        orb.target.y + orb.radius * Math.cos(orb.phi),
        orb.target.z + orb.radius * sinPhi * Math.cos(orb.theta)
      );
      camera.lookAt(orb.target);

      // Subtle pedestal ring pulse
      innerRingMat.opacity = 0.72 + 0.18 * Math.sin(elapsed * 2.2);
      outerRingMat.opacity = 0.34 + 0.14 * Math.sin(elapsed * 2.2 + 1.1);

      const bundle = bodyBundleRef.current;
      if (bundle) {
        const layers = layerStateRef.current || DEFAULT_LAYER_STATE;
        const isExploded = Boolean(explodedRef.current);

        // 2. Real-Time Live Layer Visibility, Opacity & Smooth Exploded 3D Positions
        const lerpX = 1 - Math.exp(-7.5 * dt);
        SYSTEM_IDS.forEach((sysId) => {
          const group = bundle.systems[sysId];
          if (!group) return;

          const cfg = layers[sysId] || { visible: true, opacity: 1 };
          const userOpacity = clamp(cfg.opacity ?? 1, 0, 1);
          const groupVisible = Boolean(cfg.visible) && userOpacity > 0.01;
          group.visible = groupVisible;

          // Smooth exploded horizontal translation
          const targetX = isExploded ? (explodeOffsetMap[sysId] ?? 0) : 0;
          group.position.x += (targetX - group.position.x) * lerpX;

          // Update system materials cleanly without recreating WebGL resources
          const entries = bundle.systemMeshEntries[sysId] || [];
          const isOuterShell = sysId === 'skin' || sysId === 'muscular';

          for (let i = 0; i < entries.length; i += 1) {
            const item = entries[i];
            const mat = item.material;
            if (!mat) continue;

            const effOpacity = clamp(item.baseOpacity * userOpacity, 0, 1);
            mat.opacity = effOpacity;

            const shouldBeTransparent = item.baseTransparent || effOpacity < 0.99;
            if (mat.transparent !== shouldBeTransparent) {
              mat.transparent = shouldBeTransparent;
              mat.needsUpdate = true;
            }

            // Prevent z-buffer occlusion of internal organs through translucent skin/muscles
            if (isOuterShell) {
              const translucentShell = effOpacity < (sysId === 'skin' ? 0.88 : 0.76);
              mat.depthWrite = translucentShell ? false : item.baseDepthWrite;
              item.mesh.renderOrder = translucentShell ? (sysId === 'skin' ? 12 : 6) : 0;
            }
          }
        });

        // 3. Synchronized 3D Laser CT Slice Plane
        const sliceObj = bundle.slicePlane;
        if (sliceObj) {
          sliceObj.visible = Boolean(showSlicePlaneRef.current);
          const targetY = clamp((sliceHeightPctRef.current / 100) * 1.76, 0.04, 1.76);
          sliceObj.position.y += (targetY - sliceObj.position.y) * (1 - Math.exp(-13 * dt));

          // Gently widen laser plane in Exploded 3D mode so it sweeps across separated layers
          const targetScaleX = isExploded ? 2.95 : 1.0;
          sliceObj.scale.x += (targetScaleX - sliceObj.scale.x) * lerpX;

          const slicePulse = 0.5 + 0.5 * Math.sin(elapsed * 4.2);
          for (let i = 0; i < bundle.slicePlaneMaterials.length; i += 1) {
            const sm = bundle.slicePlaneMaterials[i];
            if (sm.mat.emissiveIntensity !== undefined && sm.baseEmissiveIntensity > 0) {
              sm.mat.emissiveIntensity = sm.baseEmissiveIntensity * (0.82 + 0.36 * slicePulse);
            }
            if (sm.baseOpacity < 0.99) {
              sm.mat.opacity = clamp(sm.baseOpacity * (0.8 + 0.35 * slicePulse), 0.06, 0.98);
            }
          }
        }

        // 4. Real-Time Animated Physiology (4-Chamber Heart, Lungs + Diaphragm, Arterial Pulse)
        const liveHr = clamp(Number(hrRef.current) || 76, 35, 210);
        const liveRr = clamp(Number(rrRef.current) || 15, 6, 50);
        cardiacPhase = (cardiacPhase + (liveHr / 60) * dt) % 10000;
        respPhase = (respPhase + (liveRr / 60) * dt) % 10000;

        const cPhase = cardiacPhase % 1;
        const rPhase = respPhase % 1;

        // 4a. Atria contract slightly ahead of ventricles (P-wave phase: 0.00..0.18)
        const atrialContract = cPhase < 0.18 ? Math.sin((cPhase / 0.18) * Math.PI) : 0;
        if (bundle.atriaGroup) {
          const bs = bundle.baseTransforms.atriaGroup.scale;
          bundle.atriaGroup.scale.set(
            bs.x * (1 - 0.088 * atrialContract),
            bs.y * (1 - 0.05 * atrialContract),
            bs.z * (1 - 0.088 * atrialContract)
          );
        }

        // 4b. Ventricles contract crisply during systole (QRS-ST phase: 0.15..0.44)
        let ventContract = 0;
        if (cPhase >= 0.15 && cPhase < 0.44) {
          const t = (cPhase - 0.15) / 0.29;
          ventContract = Math.pow(Math.sin(t * Math.PI), 0.72);
        }
        if (bundle.ventriclesGroup) {
          const bs = bundle.baseTransforms.ventriclesGroup.scale;
          const br = bundle.baseTransforms.ventriclesGroup.rotation;
          bundle.ventriclesGroup.scale.set(
            bs.x * (1 - 0.135 * ventContract),
            bs.y * (1 - 0.078 * ventContract),
            bs.z * (1 - 0.135 * ventContract)
          );
          bundle.ventriclesGroup.rotation.y = br.y + 0.045 * ventContract;
        }

        // 4c. Breathing Lungs & Diaphragm (realistic 1:2 inspiration-to-expiration curve)
        let breath = 0;
        if (rPhase < 0.36) {
          breath = 0.5 - 0.5 * Math.cos((rPhase / 0.36) * Math.PI);
        } else {
          breath = 0.5 + 0.5 * Math.cos(((rPhase - 0.36) / 0.64) * Math.PI);
        }

        if (bundle.leftLung) {
          const bs = bundle.baseTransforms.leftLung.scale;
          bundle.leftLung.scale.set(
            bs.x * (1 + 0.068 * breath),
            bs.y * (1 + 0.052 * breath),
            bs.z * (1 + 0.08 * breath)
          );
        }
        if (bundle.rightLung) {
          const bs = bundle.baseTransforms.rightLung.scale;
          bundle.rightLung.scale.set(
            bs.x * (1 + 0.068 * breath),
            bs.y * (1 + 0.052 * breath),
            bs.z * (1 + 0.08 * breath)
          );
        }
        if (bundle.diaphragm) {
          const bp = bundle.baseTransforms.diaphragm.position;
          const bs = bundle.baseTransforms.diaphragm.scale;
          bundle.diaphragm.position.y = bp.y - 0.022 * breath;
          bundle.diaphragm.scale.set(bs.x, bs.y * (1 - 0.15 * breath), bs.z);
        }

        // 4d. Arterial Pulse Wave via computeArterialWave (slight propagation delay after systole)
        const artWave = computeArterialWave((cPhase - 0.14 + 1) % 1);

        // 5. Apply Arterial Pulse + Luminous Cyan Hover/Selection Emissive Highlight
        const selId = selectedIdRef.current;
        const hovId = hoveredIdRef.current;
        const selGlowPulse = 0.62 + 0.18 * Math.sin(elapsed * 4.6);

        for (let i = 0; i < bundle.materialRecords.length; i += 1) {
          const rec = bundle.materialRecords[i];
          const mat = rec.material;
          if (!mat || !mat.emissive) continue;

          if (selId && rec.structureId === selId) {
            mat.emissive.copy(COLOR_SELECTED_EMISSIVE);
            mat.emissiveIntensity = selGlowPulse;
          } else if (hovId && rec.structureId === hovId) {
            mat.emissive.copy(COLOR_HOVERED_EMISSIVE);
            mat.emissiveIntensity = 0.46;
          } else if (rec.isArterial) {
            if (rec.baseEmissiveIsBlack) {
              mat.emissive.copy(COLOR_ARTERIAL_PULSE);
            } else {
              mat.emissive.copy(rec.baseEmissive);
            }
            mat.emissiveIntensity = rec.baseEmissiveIntensity + artWave * 0.56;
          } else {
            mat.emissive.copy(rec.baseEmissive);
            mat.emissiveIntensity = rec.baseEmissiveIntensity;
          }
        }
      }

      renderer.render(scene, camera);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      dom.removeEventListener('contextmenu', onContextMenu);
      dom.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('pointerleave', onPointerLeave);
      dom.removeEventListener('wheel', onWheel);

      studioDisposables.forEach((res) => res?.dispose?.());
      renderer.dispose();
      if (renderer.domElement.parentNode === host) {
        host.removeChild(renderer.domElement);
      }
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
    };
  }, []);

  // =========================================================================
  // EFFECT 2: Build / Rebuild Full 3D Male or Female Body when `gender` Changes
  // =========================================================================
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const body = buildFullBody3D(gender);
    if (!body) return;

    const root = body.rootGroup || body.root || body.bodyGroup || body.group || body;
    scene.add(root);

    // Resolve the 6 anatomical system groups cleanly
    const rawSystems = body.systems || body.systemGroups || body.groups || {};
    const systems = {};
    SYSTEM_IDS.forEach((sysId) => {
      if (rawSystems[sysId]) {
        systems[sysId] = rawSystems[sysId];
      } else {
        const found = root.getObjectByName?.(sysId);
        if (found) systems[sysId] = found;
      }
    });

    // Also scan immediate children by userData.systemId if any system wasn't mapped
    root.children?.forEach((child) => {
      const sid = child.userData?.systemId;
      if (sid && SYSTEM_IDS.includes(sid) && !systems[sid]) {
        systems[sid] = child;
      }
    });

    // Resolve slice plane (use builder's slicePlane or synthesize clean fallback)
    let slicePlane = body.slicePlane || body.ctSlicePlane || root.getObjectByName?.('slicePlane') || null;
    let fallbackSliceResources = null;
    if (!slicePlane) {
      const fb = createFallbackSlicePlane();
      slicePlane = fb.group;
      fallbackSliceResources = fb;
      scene.add(slicePlane);
    } else if (!slicePlane.parent) {
      root.add(slicePlane);
    }

    const slicePlaneMaterials = [];
    slicePlane.traverse((obj) => {
      if (obj.isMesh && obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((mat) => {
          slicePlaneMaterials.push({
            mat,
            baseOpacity: mat.opacity ?? 1,
            baseEmissiveIntensity: mat.emissiveIntensity ?? 0,
          });
        });
      }
    });

    // If builder returned an explicit structureMeshes dictionary, stamp userData.structureId cleanly
    if (body.structureMeshes && typeof body.structureMeshes === 'object') {
      Object.entries(body.structureMeshes).forEach(([structId, meshes]) => {
        const list = Array.isArray(meshes) ? meshes : [meshes];
        list.forEach((m) => {
          if (m && m.userData && !m.userData.structureId) {
            m.userData.structureId = structId;
          }
        });
      });
    }

    // Resolve animated physiological references (HumanBody3DBuilder exposes body.animatedRefs)
    const animSrc = body.animatedRefs || body.animated || body.physio || body;
    const ventriclesGroup =
      animSrc.ventriclesGroup ||
      body.ventriclesGroup ||
      body.heart?.ventriclesGroup ||
      root.getObjectByName?.('ventriclesGroup') ||
      null;
    const atriaGroup =
      animSrc.atriaGroup ||
      body.atriaGroup ||
      body.heart?.atriaGroup ||
      root.getObjectByName?.('atriaGroup') ||
      null;
    const leftLung =
      animSrc.leftLung ||
      body.leftLung ||
      body.lungs?.leftLung ||
      root.getObjectByName?.('leftLung') ||
      null;
    const rightLung =
      animSrc.rightLung ||
      body.rightLung ||
      body.lungs?.rightLung ||
      root.getObjectByName?.('rightLung') ||
      null;
    const diaphragm =
      animSrc.diaphragm ||
      body.diaphragm ||
      root.getObjectByName?.('diaphragm') ||
      null;
    const primaryArterialMat =
      animSrc.arterialMaterial ||
      body.arterialMaterial ||
      body.materials?.arterial ||
      null;

    const captureBaseTransform = (obj) =>
      obj
        ? {
            position: obj.position.clone(),
            scale: obj.scale.clone(),
            rotation: obj.rotation.clone(),
          }
        : null;

    const baseTransforms = {
      ventriclesGroup: captureBaseTransform(ventriclesGroup),
      atriaGroup: captureBaseTransform(atriaGroup),
      leftLung: captureBaseTransform(leftLung),
      rightLung: captureBaseTransform(rightLung),
      diaphragm: captureBaseTransform(diaphragm),
    };

    // Index all meshes per system, isolate shared materials per structureId so
    // highlighting ONE organ never bleeds onto an unrelated structure!
    const pickableMeshes = [];
    const meshMetaMap = new Map();
    const systemMeshEntries = {};
    SYSTEM_IDS.forEach((s) => {
      systemMeshEntries[s] = [];
    });

    const materialOwners = new Map(); // material -> Set<structureId>
    const allMeshRecords = [];

    SYSTEM_IDS.forEach((sysId) => {
      const grp = systems[sysId];
      if (!grp) return;
      grp.traverse((obj) => {
        if (!obj.isMesh || !obj.material) return;
        const { structureId, systemId } = resolveMeshMeta(obj, sysId);
        const resolvedSys = systemId || sysId;
        const ownerKey = structureId || `__sys_${resolvedSys}`;

        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => {
          if (!materialOwners.has(m)) materialOwners.set(m, new Set());
          materialOwners.get(m).add(ownerKey);
        });

        allMeshRecords.push({ mesh: obj, structureId, systemId: resolvedSys, ownerKey });
      });
    });

    const clonedMaterials = [];
    const perOwnerCloneMap = new Map(); // `${origMat.uuid}::${ownerKey}` -> clonedMat
    const recordedMaterialsSet = new Set();
    const materialRecords = [];

    allMeshRecords.forEach(({ mesh, structureId, systemId, ownerKey }) => {
      const processMaterial = (origMat) => {
        const owners = materialOwners.get(origMat);
        let finalMat = origMat;
        if (owners && owners.size > 1) {
          const cloneKey = `${origMat.uuid}::${ownerKey}`;
          if (perOwnerCloneMap.has(cloneKey)) {
            finalMat = perOwnerCloneMap.get(cloneKey);
          } else {
            finalMat = origMat.clone();
            perOwnerCloneMap.set(cloneKey, finalMat);
            clonedMaterials.push(finalMat);
          }
        }

        const isArterial =
          origMat === primaryArterialMat ||
          finalMat === primaryArterialMat ||
          isArterialStructure(structureId, mesh);

        if (!recordedMaterialsSet.has(finalMat)) {
          recordedMaterialsSet.add(finalMat);
          const baseEmissive = finalMat.emissive ? finalMat.emissive.clone() : new THREE.Color(0x000000);
          const baseEmissiveIsBlack =
            baseEmissive.r < 0.02 && baseEmissive.g < 0.02 && baseEmissive.b < 0.02;
          materialRecords.push({
            material: finalMat,
            structureId,
            systemId,
            isArterial,
            baseEmissive,
            baseEmissiveIsBlack,
            baseEmissiveIntensity: finalMat.emissiveIntensity ?? 0,
          });
        }

        systemMeshEntries[systemId]?.push({
          mesh,
          material: finalMat,
          baseOpacity: origMat.opacity ?? 1,
          baseTransparent: Boolean(origMat.transparent),
          baseDepthWrite: origMat.depthWrite !== undefined ? origMat.depthWrite : true,
        });

        return finalMat;
      };

      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map(processMaterial);
      } else {
        mesh.material = processMaterial(mesh.material);
      }

      if (structureId) {
        pickableMeshes.push({ mesh, structureId, systemId });
        meshMetaMap.set(mesh, { structureId, systemId });
      }
    });

    // Apply initial exploded & slice positions immediately to avoid a 1-frame jump on gender toggle
    const offsetMap = getExplodeOffsetMap();
    SYSTEM_IDS.forEach((sysId) => {
      const grp = systems[sysId];
      if (!grp) return;
      grp.position.x = explodedRef.current ? (offsetMap[sysId] ?? 0) : 0;
    });
    if (slicePlane) {
      slicePlane.position.y = clamp((sliceHeightPctRef.current / 100) * 1.76, 0.04, 1.76);
      slicePlane.visible = Boolean(showSlicePlaneRef.current);
      slicePlane.scale.x = explodedRef.current ? 2.95 : 1.0;
    }

    bodyBundleRef.current = {
      body,
      root,
      systems,
      slicePlane,
      slicePlaneMaterials,
      ventriclesGroup,
      atriaGroup,
      leftLung,
      rightLung,
      diaphragm,
      baseTransforms,
      pickableMeshes,
      meshMetaMap,
      systemMeshEntries,
      materialRecords,
    };

    return () => {
      bodyBundleRef.current = null;
      scene.remove(root);
      if (fallbackSliceResources) {
        scene.remove(fallbackSliceResources.group);
        fallbackSliceResources.geometries.forEach((g) => g.dispose());
        fallbackSliceResources.materials.forEach((m) => m.dispose());
      }
      clonedMaterials.forEach((m) => m.dispose());
      body.dispose?.();
    };
  }, [gender]);

  // Resolve floating cursor tooltip metadata
  const systemMetaMap = getSystemMetaMap();
  const tooltipStructure = tooltip?.id ? ATLAS_STRUCTURES_MAP?.[tooltip.id] : null;
  const tooltipSysId = tooltipStructure?.systemId || tooltipStructure?.system || null;
  const tooltipSystem = tooltipSysId ? systemMetaMap[tooltipSysId] : null;

  // Clamp tooltip position safely inside container
  let tipLeft = 0;
  let tipTop = 0;
  if (tooltip && containerRef.current) {
    const cw = containerRef.current.clientWidth || 600;
    const ch = containerRef.current.clientHeight || 600;
    tipLeft = clamp(tooltip.x + 16, 12, Math.max(12, cw - 245));
    tipTop = clamp(tooltip.y - 18, 12, Math.max(12, ch - 92));
  }

  return (
    <div
      ref={containerRef}
      className="atlas3d-viewport-stage"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '580px',
        background: '#060d1c',
        overflow: 'hidden',
        userSelect: 'none',
        cursor: cursorStyle,
      }}
    >
      {/* Pure Three.js WebGL Mount */}
      <div
        ref={canvasHostRef}
        className="atlas3d-canvas-host"
        style={{ width: '100%', height: '100%', minHeight: '580px' }}
      />

      {/* Compact Zoom / Reset Controls in Lower-Left Corner */}
      <div
        className="atlas3d-viewport-tools"
        style={{
          position: 'absolute',
          bottom: 14,
          left: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          zIndex: 12,
        }}
      >
        <button
          type="button"
          className="icon-btn"
          title="התקרב (Zoom In)"
          onClick={() => handleQuickZoom(0.84)}
          style={{
            padding: '7px',
            background: 'rgba(10, 19, 36, 0.86)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <ZoomIn size={15} />
        </button>
        <button
          type="button"
          className="icon-btn"
          title="התרחק (Zoom Out)"
          onClick={() => handleQuickZoom(1.18)}
          style={{
            padding: '7px',
            background: 'rgba(10, 19, 36, 0.86)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <ZoomOut size={15} />
        </button>
        <button
          type="button"
          className="icon-btn"
          title="אפס זווית מצלמה"
          onClick={handleResetView}
          style={{
            padding: '7px',
            background: 'rgba(10, 19, 36, 0.86)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <RotateCcw size={15} />
        </button>
      </div>

      {/* Floating Hebrew + Latin 3D Cursor Tooltip */}
      {tooltipStructure && (
        <div
          className="atlas3d-hover-tooltip"
          style={{
            position: 'absolute',
            left: tipLeft,
            top: tipTop,
            pointerEvents: 'none',
            zIndex: 25,
            maxWidth: 235,
            background: 'rgba(8, 15, 30, 0.94)',
            border: '1px solid rgba(56, 189, 248, 0.55)',
            borderRadius: 10,
            padding: '8px 11px',
            boxShadow: '0 10px 28px rgba(0, 0, 0, 0.62)',
            backdropFilter: 'blur(8px)',
            direction: 'rtl',
            textAlign: 'right',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: '50%',
                background: tooltipSystem?.color || '#38bdf8',
                boxShadow: `0 0 8px ${tooltipSystem?.color || '#38bdf8'}`,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: '0.67rem', color: '#94a3b8', fontWeight: 700 }}>
              {tooltipSystem?.nameHe || tooltipStructure.regionHe || 'מבנה אנטומי'}
            </span>
          </div>
          <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#f8fafc', lineHeight: 1.25 }}>
            {tooltipStructure.nameHe}
          </div>
          {tooltipStructure.latin && (
            <div style={{ fontSize: '0.72rem', color: '#7dd3fc', fontStyle: 'italic', marginTop: 1 }}>
              {tooltipStructure.latin}
            </div>
          )}
          <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: 4 }}>
            לחץ לחקירה אנטומית ורפואית ↵
          </div>
        </div>
      )}
    </div>
  );
}
