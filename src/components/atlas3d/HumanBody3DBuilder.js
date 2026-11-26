import * as THREE from 'three';

/**
 * Procedural 3D Human Anatomy Sculptor (Pure Three.js)
 * Coordinate system:
 *  - Standing human from y = 0.0 (soles of feet) to y = 1.76 (crown of head)
 *  - Centered at x = 0, z = 0, facing +Z
 *  - Patient anatomical RIGHT is -X; patient anatomical LEFT is +X
 */

// ---------------------------------------------------------------------------
// Deterministic pseudo-random helper for repeatable procedural textures
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(width, height) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function createMuscleTextures(texturesSet) {
  const cColor = makeCanvas(512, 512);
  const cBump = makeCanvas(512, 512);
  if (!cColor || !cBump) return { map: null, bumpMap: null };

  const ctx = cColor.getContext('2d');
  const bCtx = cBump.getContext('2d');
  const rand = mulberry32(104729);

  // Rich crimson muscle base gradient
  const grad = ctx.createLinearGradient(0, 0, 512, 0);
  grad.addColorStop(0.0, '#7d1620');
  grad.addColorStop(0.25, '#a82230');
  grad.addColorStop(0.5, '#921b27');
  grad.addColorStop(0.75, '#b22735');
  grad.addColorStop(1.0, '#7d1620');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  bCtx.fillStyle = '#707070';
  bCtx.fillRect(0, 0, 512, 512);

  // Parallel wavy muscle fascicles (vertical fibers along V axis)
  for (let i = 0; i < 240; i++) {
    const x0 = rand() * 512;
    const amp = 2 + rand() * 4.5;
    const freq = 1 + Math.floor(rand() * 3);
    const phase = rand() * Math.PI * 2;
    const isFascia = rand() < 0.22;
    const isDarkGroove = !isFascia && rand() < 0.35;

    ctx.beginPath();
    bCtx.beginPath();
    for (let y = 0; y <= 512; y += 16) {
      const x = x0 + Math.sin((y / 512) * Math.PI * 2 * freq + phase) * amp;
      if (y === 0) {
        ctx.moveTo(x, y);
        bCtx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
        bCtx.lineTo(x, y);
      }
    }

    if (isFascia) {
      // Fine pale silvery-pink epimysium/fascia striation
      ctx.strokeStyle = `rgba(246, 214, 212, ${0.18 + rand() * 0.26})`;
      ctx.lineWidth = 0.8 + rand() * 1.4;
      bCtx.strokeStyle = `rgba(235, 235, 235, ${0.4 + rand() * 0.35})`;
      bCtx.lineWidth = 1.4;
    } else if (isDarkGroove) {
      // Deep perimysium septum shadow
      ctx.strokeStyle = `rgba(68, 9, 16, ${0.28 + rand() * 0.28})`;
      ctx.lineWidth = 1.0 + rand() * 2.0;
      bCtx.strokeStyle = `rgba(30, 30, 30, ${0.45 + rand() * 0.3})`;
      bCtx.lineWidth = 1.8;
    } else {
      // Bright myofibril highlight
      ctx.strokeStyle = `rgba(196, 52, 66, ${0.2 + rand() * 0.24})`;
      ctx.lineWidth = 1.2 + rand() * 2.2;
      bCtx.strokeStyle = `rgba(190, 190, 190, ${0.35 + rand() * 0.3})`;
      bCtx.lineWidth = 1.6;
    }
    ctx.stroke();
    bCtx.stroke();
  }

  // Subtle horizontal sarcomere micro-banding
  ctx.fillStyle = 'rgba(255, 225, 225, 0.035)';
  for (let y = 0; y < 512; y += 8) {
    ctx.fillRect(0, y, 512, 2);
  }

  const map = new THREE.CanvasTexture(cColor);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2, 2);
  map.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = new THREE.CanvasTexture(cBump);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(2, 2);

  texturesSet.add(map);
  texturesSet.add(bumpMap);
  return { map, bumpMap };
}

function createBrainTextures(texturesSet) {
  const cColor = makeCanvas(512, 512);
  const cBump = makeCanvas(512, 512);
  if (!cColor || !cBump) return { map: null, bumpMap: null };

  const ctx = cColor.getContext('2d');
  const bCtx = cBump.getContext('2d');
  const rand = mulberry32(88317);

  // Soft pinkish cerebral cortex base
  ctx.fillStyle = '#dfa9a2';
  ctx.fillRect(0, 0, 512, 512);

  bCtx.fillStyle = '#c8c8c8';
  bCtx.fillRect(0, 0, 512, 512);

  // Draw convoluted gyri ridges and sulci troughs
  const drawSulcus = (startX, startY, steps, stepLen) => {
    let x = startX;
    let y = startY;
    let angle = rand() * Math.PI * 2;
    const pts = [[x, y]];
    for (let s = 0; s < steps; s++) {
      angle += (rand() - 0.5) * 1.15;
      x += Math.cos(angle) * stepLen;
      y += Math.sin(angle) * stepLen;
      pts.push([x, y]);
    }

    // Soft raised gyrus halo
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach(([px, py], idx) => (idx === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
    ctx.strokeStyle = 'rgba(244, 206, 198, 0.55)';
    ctx.lineWidth = 17;
    ctx.stroke();

    bCtx.lineCap = 'round';
    bCtx.lineJoin = 'round';
    bCtx.beginPath();
    pts.forEach(([px, py], idx) => (idx === 0 ? bCtx.moveTo(px, py) : bCtx.lineTo(px, py)));
    bCtx.strokeStyle = 'rgba(248, 248, 248, 0.72)';
    bCtx.lineWidth = 17;
    bCtx.stroke();

    // Deep rosy-maroon sulcus crease
    ctx.strokeStyle = 'rgba(128, 56, 62, 0.72)';
    ctx.lineWidth = 5.2;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(84, 28, 36, 0.6)';
    ctx.lineWidth = 2.0;
    ctx.stroke();

    bCtx.strokeStyle = 'rgba(22, 22, 22, 0.88)';
    bCtx.lineWidth = 5.6;
    bCtx.stroke();
  };

  for (let i = 0; i < 68; i++) {
    drawSulcus(rand() * 512, rand() * 512, 6 + Math.floor(rand() * 7), 14 + rand() * 10);
  }

  // Subtle fine pial vessels
  ctx.lineWidth = 0.85;
  for (let i = 0; i < 36; i++) {
    let x = rand() * 512;
    let y = rand() * 512;
    let ang = rand() * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 5; s++) {
      ang += (rand() - 0.5) * 0.9;
      x += Math.cos(ang) * 16;
      y += Math.sin(ang) * 16;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(176, 42, 54, 0.34)';
    ctx.stroke();
  }

  const map = new THREE.CanvasTexture(cColor);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = new THREE.CanvasTexture(cBump);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;

  texturesSet.add(map);
  texturesSet.add(bumpMap);
  return { map, bumpMap };
}

function createBoneTexture(texturesSet) {
  const c = makeCanvas(256, 256);
  if (!c) return null;
  const ctx = c.getContext('2d');
  const rand = mulberry32(44101);

  ctx.fillStyle = '#efeae0';
  ctx.fillRect(0, 0, 256, 256);

  // Subtle periosteal longitudinal striations & warm organic tone
  for (let i = 0; i < 180; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    const h = 24 + rand() * 80;
    ctx.fillStyle =
      rand() > 0.5
        ? `rgba(218, 206, 186, ${0.08 + rand() * 0.14})`
        : `rgba(255, 252, 245, ${0.12 + rand() * 0.16})`;
    ctx.fillRect(x, y, 1 + rand() * 2, h);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  texturesSet.add(tex);
  return tex;
}

function createLungTexture(texturesSet) {
  const c = makeCanvas(256, 256);
  if (!c) return null;
  const ctx = c.getContext('2d');
  const rand = mulberry32(55213);

  const g = ctx.createRadialGradient(128, 128, 20, 128, 128, 180);
  g.addColorStop(0, '#df939b');
  g.addColorStop(1, '#c8737f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);

  // Secondary pulmonary lobule delicate polygonal marbling
  for (let i = 0; i < 85; i++) {
    const cx = rand() * 256;
    const cy = rand() * 256;
    const r = 8 + rand() * 14;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + rand() * 0.35;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(148, 76, 92, 0.22)';
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.fillStyle = `rgba(242, 182, 188, ${0.06 + rand() * 0.08})`;
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  texturesSet.add(tex);
  return tex;
}

function createHeartTexture(texturesSet) {
  const c = makeCanvas(256, 256);
  if (!c) return null;
  const ctx = c.getContext('2d');
  const rand = mulberry32(91921);

  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#9e1c2b');
  g.addColorStop(0.55, '#b62435');
  g.addColorStop(1, '#7d111e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);

  // Swirling helical myocardial muscle fibers
  for (let i = 0; i < 120; i++) {
    const y0 = rand() * 256;
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.bezierCurveTo(85, y0 + 28, 170, y0 - 18, 256, y0 + 36);
    ctx.strokeStyle =
      rand() > 0.3
        ? `rgba(220, 74, 86, ${0.14 + rand() * 0.16})`
        : `rgba(74, 8, 16, ${0.22 + rand() * 0.2})`;
    ctx.lineWidth = 1 + rand() * 2;
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  texturesSet.add(tex);
  return tex;
}

function createSliceDiscTexture(texturesSet) {
  const c = makeCanvas(512, 512);
  if (!c) return null;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 512, 512);

  // Radial cyan CT/MRI laser wash
  const grad = ctx.createRadialGradient(256, 256, 16, 256, 256, 252);
  grad.addColorStop(0.0, 'rgba(34, 211, 238, 0.14)');
  grad.addColorStop(0.65, 'rgba(6, 182, 212, 0.22)');
  grad.addColorStop(0.92, 'rgba(34, 211, 238, 0.55)');
  grad.addColorStop(1.0, 'rgba(103, 232, 249, 0.92)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(256, 256, 252, 0, Math.PI * 2);
  ctx.fill();

  // Subtle concentric calibration rings & crosshairs
  ctx.strokeStyle = 'rgba(165, 243, 252, 0.35)';
  ctx.lineWidth = 1.5;
  for (const r of [64, 128, 192, 238]) {
    ctx.beginPath();
    ctx.arc(256, 256, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(165, 243, 252, 0.26)';
  ctx.beginPath();
  ctx.moveTo(16, 256);
  ctx.lineTo(496, 256);
  ctx.moveTo(256, 16);
  ctx.lineTo(256, 496);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  texturesSet.add(tex);
  return tex;
}

// ---------------------------------------------------------------------------
// Custom Procedural Geometry Builders (Strictly Verified Outward Normals!)
// ---------------------------------------------------------------------------

/**
 * Builds a smooth closed lofted surface from an array of cross-section rings.
 * Each ring is an array of `radialSegments` Vector3 points ordered by theta in [0, 2*PI)
 * starting at +Z (theta=0) and sweeping toward +X (theta=PI/2), ordered bottom-to-top.
 * Outward normal verified: (dP/dtheta) x (dP/dy) = (+X) x (+Y) = +Z (OUTWARD).
 */
function createLoftedGeometry(rings, capBottom = true, capTop = true) {
  const ringCount = rings.length;
  const segs = rings[0].length;
  const stride = segs + 1;

  const positions = [];
  const uvs = [];
  const indices = [];

  for (let r = 0; r < ringCount; r++) {
    const v = r / Math.max(1, ringCount - 1);
    const ring = rings[r];
    for (let s = 0; s <= segs; s++) {
      const p = ring[s % segs];
      positions.push(p.x, p.y, p.z);
      uvs.push(s / segs, v);
    }
  }

  for (let r = 0; r < ringCount - 1; r++) {
    const row0 = r * stride;
    const row1 = (r + 1) * stride;
    for (let s = 0; s < segs; s++) {
      const a = row0 + s;
      const b = row0 + s + 1;
      const c = row1 + s;
      const d = row1 + s + 1;
      indices.push(a, b, d);
      indices.push(a, d, c);
    }
  }

  if (capBottom) {
    const first = rings[0];
    const center = new THREE.Vector3();
    for (let s = 0; s < segs; s++) center.add(first[s]);
    center.divideScalar(segs);
    const centerIdx = positions.length / 3;
    positions.push(center.x, center.y, center.z);
    uvs.push(0.5, 0.0);
    for (let s = 0; s < segs; s++) {
      indices.push(centerIdx, s + 1, s);
    }
  }

  if (capTop) {
    const last = rings[ringCount - 1];
    const center = new THREE.Vector3();
    for (let s = 0; s < segs; s++) center.add(last[s]);
    center.divideScalar(segs);
    const centerIdx = positions.length / 3;
    const baseRow = (ringCount - 1) * stride;
    positions.push(center.x, center.y, center.z);
    uvs.push(0.5, 1.0);
    for (let s = 0; s < segs; s++) {
      indices.push(centerIdx, baseRow + s, baseRow + s + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a smooth limb loft along ordered station centers (bottom -> top)
 * with perpendicular elliptical cross-sections (rx lateral, rz anteroposterior).
 */
function createLimbLoft(stations, radialSegments = 24, capBottom = true, capTop = true) {
  const rings = [];
  const count = stations.length;
  const defaultFwd = new THREE.Vector3(0, 0, 1);

  for (let i = 0; i < count; i++) {
    const st = stations[i];
    const pCurr = new THREE.Vector3(st.x, st.y, st.z);
    let tangent;
    if (i === 0) {
      tangent = new THREE.Vector3(
        stations[1].x - st.x,
        stations[1].y - st.y,
        stations[1].z - st.z
      );
    } else if (i === count - 1) {
      tangent = new THREE.Vector3(
        st.x - stations[i - 1].x,
        st.y - stations[i - 1].y,
        st.z - stations[i - 1].z
      );
    } else {
      tangent = new THREE.Vector3(
        stations[i + 1].x - stations[i - 1].x,
        stations[i + 1].y - stations[i - 1].y,
        stations[i + 1].z - stations[i - 1].z
      );
    }
    if (tangent.lengthSq() < 1e-8) tangent.set(0, 1, 0);
    tangent.normalize();

    // Right (+X) = T x F, Forward (+Z) = R x T => (R, T, F) right-handed, outward normal verified!
    const right = new THREE.Vector3().crossVectors(tangent, defaultFwd);
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
    else right.normalize();
    const fwd = new THREE.Vector3().crossVectors(right, tangent).normalize();

    const rx = st.rx;
    const rzF = st.rzFront !== undefined ? st.rzFront : st.rz;
    const rzB = st.rzBack !== undefined ? st.rzBack : st.rz;

    const ring = [];
    for (let s = 0; s < radialSegments; s++) {
      const theta = (s / radialSegments) * Math.PI * 2;
      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);
      const localX = sinT * rx;
      const localZ = cosT * (cosT >= 0 ? rzF : rzB);
      const pt = pCurr
        .clone()
        .addScaledVector(right, localX)
        .addScaledVector(fwd, localZ);
      ring.push(pt);
    }
    rings.push(ring);
  }

  return createLoftedGeometry(rings, capBottom, capTop);
}

/**
 * Custom TubeGeometry with variable radius function `radiusFn(t)` (t in [0, 1])
 * and optional cross-section oval aspect `(scaleN, scaleB)` + end caps.
 * Verified outward normals: (dP/dv) x (dP/du) = B x T = +N.
 */
function createModulatedTubeGeometry(
  curve,
  tubularSegments = 32,
  radiusFn = () => 0.01,
  radialSegments = 12,
  scaleN = 1.0,
  scaleB = 1.0,
  capped = true
) {
  const frames = curve.computeFrenetFrames(tubularSegments, false);
  const positions = [];
  const uvs = [];
  const indices = [];
  const stride = radialSegments + 1;

  const p = new THREE.Vector3();
  const vertex = new THREE.Vector3();

  for (let i = 0; i <= tubularSegments; i++) {
    const u = i / tubularSegments;
    curve.getPointAt(u, p);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    const r = Math.max(0.0004, radiusFn(u));

    for (let j = 0; j <= radialSegments; j++) {
      const v = (j / radialSegments) * Math.PI * 2;
      const cosV = Math.cos(v) * r * scaleN;
      const sinV = Math.sin(v) * r * scaleB;
      vertex.x = p.x + cosV * N.x + sinV * B.x;
      vertex.y = p.y + cosV * N.y + sinV * B.y;
      vertex.z = p.z + cosV * N.z + sinV * B.z;
      positions.push(vertex.x, vertex.y, vertex.z);
      uvs.push(j / radialSegments, u);
    }
  }

  for (let i = 0; i < tubularSegments; i++) {
    const row0 = i * stride;
    const row1 = (i + 1) * stride;
    for (let j = 0; j < radialSegments; j++) {
      const a = row0 + j;
      const b = row1 + j;
      const c = row0 + j + 1;
      const d = row1 + j + 1;
      indices.push(a, c, d);
      indices.push(a, d, b);
    }
  }

  if (capped) {
    // Start cap (normal -T)
    const pStart = curve.getPointAt(0);
    const startCenter = positions.length / 3;
    positions.push(pStart.x, pStart.y, pStart.z);
    uvs.push(0.5, 0);
    for (let j = 0; j < radialSegments; j++) {
      indices.push(startCenter, j + 1, j);
    }

    // End cap (normal +T)
    const pEnd = curve.getPointAt(1);
    const endCenter = positions.length / 3;
    const lastRow = tubularSegments * stride;
    positions.push(pEnd.x, pEnd.y, pEnd.z);
    uvs.push(0.5, 1);
    for (let j = 0; j < radialSegments; j++) {
      indices.push(endCenter, lastRow + j, lastRow + j + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds an anatomical muscle spindle along a 3D curve that bulges smoothly in its belly
 * and tapers gracefully into tendinous insertions at both ends.
 */
function createMuscleBellyGeometry(
  points,
  maxRadius,
  aspectN = 1.0,
  aspectB = 0.68,
  tubularSegments = 22,
  radialSegments = 12,
  bellyPeak = 0.48
) {
  const curve = new THREE.CatmullRomCurve3(points);
  const radiusFn = (u) => {
    // Smooth asymmetric spindle profile peaking near bellyPeak
    const shaped =
      u < bellyPeak
        ? Math.sin((u / Math.max(0.05, bellyPeak)) * (Math.PI / 2))
        : Math.sin(((1 - u) / Math.max(0.05, 1 - bellyPeak)) * (Math.PI / 2));
    return maxRadius * (0.14 + 0.86 * Math.pow(Math.max(0, shaped), 0.78));
  };
  return createModulatedTubeGeometry(
    curve,
    tubularSegments,
    radiusFn,
    radialSegments,
    aspectN,
    aspectB,
    true
  );
}

/**
 * Helper to orient a bone/segment mesh smoothly between two 3D points.
 */
function alignMeshBetween(mesh, pA, pB) {
  const mid = new THREE.Vector3().addVectors(pA, pB).multiplyScalar(0.5);
  const dir = new THREE.Vector3().subVectors(pB, pA);
  const len = dir.length();
  mesh.position.copy(mid);
  if (len > 1e-6) {
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  }
  return len;
}

// ---------------------------------------------------------------------------
// Main Exported Builder
// ---------------------------------------------------------------------------

export function buildFullBody3D(gender = 'male') {
  const isF = gender === 'female';

  // Master anthropometric dimensions (height 0.0 -> 1.76 m)
  const P = {
    isF,
    shX: isF ? 0.178 : 0.215,
    shY: isF ? 1.410 : 1.415,
    shZ: -0.012,
    waistW: isF ? 0.114 : 0.142,
    pelW: isF ? 0.172 : 0.145,
    ribW: isF ? 0.124 : 0.145,
    hipX: isF ? 0.112 : 0.098,
    hipY: isF ? 0.840 : 0.845,
    kneeX: isF ? 0.090 : 0.095,
    kneeY: 0.465,
    ankleX: isF ? 0.086 : 0.092,
    ankleY: 0.082,
    elbowX: isF ? 0.236 : 0.268,
    elbowY: 1.115,
    elbowZ: -0.018,
    wristX: isF ? 0.278 : 0.302,
    wristY: 0.845,
    wristZ: 0.012,
    chestZFront: isF ? 0.118 : 0.132,
    chestZBack: isF ? 0.112 : 0.122,
  };

  // Root & 6 anatomical system containers
  const rootGroup = new THREE.Group();
  rootGroup.name = `human_body_${isF ? 'female' : 'male'}`;

  const systems = {
    skin: new THREE.Group(),
    muscular: new THREE.Group(),
    skeletal: new THREE.Group(),
    organs: new THREE.Group(),
    vascular: new THREE.Group(),
    nervous: new THREE.Group(),
  };

  Object.entries(systems).forEach(([sysId, group]) => {
    group.name = sysId;
    rootGroup.add(group);
  });

  // Resource tracking for leak-free disposal
  const trackedGeometries = new Set();
  const trackedMaterials = new Set();
  const trackedTextures = new Set();
  const clickableMeshes = [];

  function trackGeo(geo) {
    trackedGeometries.add(geo);
    return geo;
  }

  function trackMat(mat) {
    trackedMaterials.add(mat);
    return mat;
  }

  function addMesh(parent, geometry, material, structureId, systemId, opts = {}) {
    trackGeo(geometry);
    trackMat(material);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = structureId;
    mesh.userData = { structureId, systemId };
    mesh.castShadow = opts.castShadow !== undefined ? opts.castShadow : systemId !== 'skin';
    mesh.receiveShadow = opts.receiveShadow !== undefined ? opts.receiveShadow : systemId !== 'skin';
    if (opts.renderOrder !== undefined) mesh.renderOrder = opts.renderOrder;
    if (opts.position) mesh.position.set(...opts.position);
    if (opts.rotation) mesh.rotation.set(...opts.rotation);
    if (opts.scale) mesh.scale.set(...opts.scale);
    parent.add(mesh);
    if (opts.clickable !== false) {
      clickableMeshes.push(mesh);
    }
    return mesh;
  }

  // -------------------------------------------------------------------------
  // Procedural Textures & Shared Materials
  // -------------------------------------------------------------------------
  const muscleTex = createMuscleTextures(trackedTextures);
  const brainTex = createBrainTextures(trackedTextures);
  const boneTex = createBoneTexture(trackedTextures);
  const lungTex = createLungTexture(trackedTextures);
  const heartTex = createHeartTexture(trackedTextures);
  const sliceDiscTex = createSliceDiscTexture(trackedTextures);

  // Skin translucent clinical sculpture material
  const skinMaterial = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: isF ? 0xf0c7b2 : 0xe9bfa8,
      roughness: 0.48,
      metalness: 0.02,
      clearcoat: 0.14,
      clearcoatRoughness: 0.48,
      transparent: true,
      opacity: 0.32,
      side: THREE.FrontSide,
      depthWrite: false,
    })
  );

  const hairMaterial = trackMat(
    new THREE.MeshStandardMaterial({
      color: isF ? 0x4e3222 : 0x3f2a1e,
      roughness: 0.56,
      metalness: 0.04,
      transparent: true,
      opacity: 0.38,
      side: THREE.FrontSide,
      depthWrite: false,
    })
  );

  // Muscular materials
  const muscleMaterial = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xc22b38,
      map: muscleTex.map,
      bumpMap: muscleTex.bumpMap,
      bumpScale: 0.0045,
      roughness: 0.5,
      metalness: 0.05,
    })
  );

  const muscleDeepMaterial = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xa4202c,
      map: muscleTex.map,
      bumpMap: muscleTex.bumpMap,
      bumpScale: 0.004,
      roughness: 0.54,
      metalness: 0.04,
    })
  );

  const fasciaMaterial = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xeee7dc,
      roughness: 0.46,
      metalness: 0.04,
    })
  );

  // Skeletal materials
  const boneMaterial = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xefeae0,
      map: boneTex,
      roughness: 0.42,
      metalness: 0.03,
    })
  );

  const cartilageMaterial = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd3dde2,
      roughness: 0.36,
      metalness: 0.04,
    })
  );

  const orbitShadowMaterial = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x3b342e,
      roughness: 0.85,
      metalness: 0.0,
    })
  );

  // Organ materials (glossy clinical organic surfaces)
  const brainMaterial = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xe3b1a8,
      map: brainTex.map,
      bumpMap: brainTex.bumpMap,
      bumpScale: 0.0065,
      roughness: 0.38,
      metalness: 0.02,
      clearcoat: 0.28,
      clearcoatRoughness: 0.35,
    })
  );

  const cerebellumMaterial = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xd19892,
      bumpMap: muscleTex.bumpMap,
      bumpScale: 0.004,
      roughness: 0.42,
      clearcoat: 0.2,
    })
  );

  const tracheaMaterial = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xd99ca0,
      roughness: 0.38,
      clearcoat: 0.25,
    })
  );

  const lungMaterial = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xda8a92,
      map: lungTex,
      roughness: 0.4,
      metalness: 0.02,
      clearcoat: 0.28,
      clearcoatRoughness: 0.38,
    })
  );

  const diaphragmMaterial = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xb8404d,
      roughness: 0.48,
      metalness: 0.04,
      side: THREE.DoubleSide,
    })
  );

  const heartVentricleMaterial = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xb01b2c,
      map: heartTex,
      roughness: 0.3,
      metalness: 0.04,
      clearcoat: 0.42,
      clearcoatRoughness: 0.25,
    })
  );

  const heartAtriaMaterial = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x91172a,
      roughness: 0.34,
      metalness: 0.04,
      clearcoat: 0.35,
      clearcoatRoughness: 0.3,
    })
  );

  const coronaryMaterial = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xff2e44,
      emissive: 0x5c0712,
      emissiveIntensity: 0.35,
      roughness: 0.28,
    })
  );

  const pulmonaryTrunkMaterial = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x4b6cb7,
      roughness: 0.34,
      clearcoat: 0.32,
    })
  );

  const liverMaterial = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x742521,
      roughness: 0.26,
      metalness: 0.05,
      clearcoat: 0.48,
      clearcoatRoughness: 0.22,
    })
  );

  const gallbladderMaterial = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x4d7c4a,
      roughness: 0.3,
      clearcoat: 0.4,
    })
  );

  const stomachMaterial = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xd87f74,
      roughness: 0.34,
      clearcoat: 0.38,
      clearcoatRoughness: 0.28,
    })
  );

  const spleenMaterial = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x6c1d45,
      roughness: 0.3,
      clearcoat: 0.42,
      clearcoatRoughness: 0.24,
    })
  );

  const kidneyMaterial = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x86312d,
      roughness: 0.32,
      clearcoat: 0.38,
    })
  );

  const adrenalMaterial = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd9a84e,
      roughness: 0.45,
    })
  );

  const colonMaterial = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xc9887a,
      roughness: 0.36,
      clearcoat: 0.32,
    })
  );

  const smallIntestineMaterial = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xe0afa0,
      roughness: 0.38,
      clearcoat: 0.3,
    })
  );

  // Shared vascular materials (arterialMaterial exposed for HR-synchronized emissive pulsation!)
  const arterialMaterial = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xef233c,
      emissive: 0x6b0814,
      emissiveIntensity: 0.35,
      roughness: 0.3,
      metalness: 0.08,
    })
  );

  const venousMaterial = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x2563eb,
      emissive: 0x0c2459,
      emissiveIntensity: 0.28,
      roughness: 0.34,
      metalness: 0.08,
    })
  );

  // Glowing golden-yellow nervous system material
  const nerveMaterial = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0x713f12,
      emissiveIntensity: 0.48,
      roughness: 0.34,
      metalness: 0.06,
    })
  );

  // Animated references returned to viewport
  const animatedRefs = {
    heartGroup: null,
    ventriclesGroup: null,
    atriaGroup: null,
    leftLung: null,
    rightLung: null,
    diaphragm: null,
    arterialMaterial,
    venousMaterial,
    nerveMaterial,
    skinMaterial,
    sliceLaserRing: null,
    sliceDiscMaterial: null,
  };

  // Spine master S-curve (reused accurately across skeletal spine, ribs, spinal cord, aorta)
  const spineCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 1.545, -0.026), // C1-C2 atlas/axis
    new THREE.Vector3(0, 1.475, -0.022), // Mid-cervical lordosis
    new THREE.Vector3(0, 1.405, -0.052), // C7-T1 transition
    new THREE.Vector3(0, 1.295, -0.084), // Mid-thoracic kyphosis peak
    new THREE.Vector3(0, 1.165, -0.074), // Lower thoracic
    new THREE.Vector3(0, 1.045, -0.046), // Lumbar lordosis
    new THREE.Vector3(0, 0.945, -0.050), // L5
    new THREE.Vector3(0, 0.875, -0.068), // Sacral promontory
  ]);

  // =========================================================================
  // 1. SKIN SYSTEM ('skin_envelope')
  // =========================================================================
  (function buildSkinSystem() {
    const g = systems.skin;
    const sid = 'skin_envelope';
    const sys = 'skin';
    const skinOpts = { renderOrder: 10, castShadow: false, receiveShadow: false };

    // --- 1A. Lofted Anatomical Torso (Perineum -> Neck base) ---
    // Rings defined from bottom (y=0.785) to top (y=1.475)
    const torsoSpecs = isF
      ? [
          { y: 0.785, rx: 0.135, rzF: 0.086, rzB: 0.105, zc: -0.008, glute: 0.015 },
          { y: 0.825, rx: 0.184, rzF: 0.104, rzB: 0.132, zc: -0.008, glute: 0.024 },
          { y: 0.875, rx: 0.194, rzF: 0.108, rzB: 0.134, zc: -0.006, glute: 0.022 },
          { y: 0.930, rx: 0.174, rzF: 0.105, rzB: 0.114, zc: -0.004, glute: 0.010 },
          { y: 0.985, rx: 0.136, rzF: 0.098, rzB: 0.098, zc: -0.002 },
          { y: 1.045, rx: 0.114, rzF: 0.095, rzB: 0.092, zc: 0.000 }, // Graceful tapered female waist
          { y: 1.105, rx: 0.124, rzF: 0.102, rzB: 0.098, zc: 0.000 },
          { y: 1.165, rx: 0.138, rzF: 0.112, rzB: 0.106, zc: -0.002 },
          { y: 1.215, rx: 0.148, rzF: 0.116, rzB: 0.112, zc: -0.004, bust: 0.58 },
          { y: 1.260, rx: 0.155, rzF: 0.118, rzB: 0.114, zc: -0.005, bust: 1.00 },
          { y: 1.305, rx: 0.156, rzF: 0.114, rzB: 0.112, zc: -0.006, bust: 0.62 },
          { y: 1.355, rx: 0.168, rzF: 0.106, rzB: 0.106, zc: -0.008, bust: 0.14 },
          { y: 1.405, rx: 0.184, rzF: 0.096, rzB: 0.098, zc: -0.010 },
          { y: 1.442, rx: 0.125, rzF: 0.072, rzB: 0.076, zc: -0.012 },
          { y: 1.472, rx: 0.056, rzF: 0.056, rzB: 0.060, zc: -0.014 },
        ]
      : [
          { y: 0.785, rx: 0.130, rzF: 0.090, rzB: 0.102, zc: -0.006, glute: 0.010 },
          { y: 0.830, rx: 0.164, rzF: 0.106, rzB: 0.118, zc: -0.006, glute: 0.016 },
          { y: 0.880, rx: 0.168, rzF: 0.110, rzB: 0.116, zc: -0.005, glute: 0.014 },
          { y: 0.935, rx: 0.158, rzF: 0.108, rzB: 0.108, zc: -0.004, glute: 0.006 },
          { y: 0.990, rx: 0.146, rzF: 0.108, rzB: 0.102, zc: -0.002 },
          { y: 1.045, rx: 0.142, rzF: 0.110, rzB: 0.102, zc: 0.000 }, // Straighter male waist
          { y: 1.110, rx: 0.152, rzF: 0.116, rzB: 0.108, zc: -0.002 },
          { y: 1.175, rx: 0.165, rzF: 0.124, rzB: 0.116, zc: -0.003 },
          { y: 1.235, rx: 0.178, rzF: 0.132, rzB: 0.122, zc: -0.004, pec: 0.75 },
          { y: 1.295, rx: 0.188, rzF: 0.134, rzB: 0.124, zc: -0.005, pec: 1.00 },
          { y: 1.355, rx: 0.204, rzF: 0.122, rzB: 0.118, zc: -0.007, pec: 0.50 },
          { y: 1.408, rx: 0.220, rzF: 0.106, rzB: 0.106, zc: -0.010 },
          { y: 1.445, rx: 0.148, rzF: 0.080, rzB: 0.082, zc: -0.012 },
          { y: 1.472, rx: 0.064, rzF: 0.062, rzB: 0.066, zc: -0.014 },
        ];

    const torsoSegs = 40;
    const torsoRings = torsoSpecs.map((sp) => {
      const ring = [];
      for (let s = 0; s < torsoSegs; s++) {
        const theta = (s / torsoSegs) * Math.PI * 2;
        const sinT = Math.sin(theta);
        const cosT = Math.cos(theta);
        let x = sinT * sp.rx;
        let z = sp.zc + cosT * (cosT >= 0 ? sp.rzF : sp.rzB);

        // Subtle anatomical posterior spinal furrow
        if (cosT < -0.55 && sp.y > 0.86 && sp.y < 1.42) {
          const furrow = Math.exp(-Math.pow(sinT / 0.22, 2)) * 0.012;
          z += furrow;
        }

        // Subtle gluteal bilateral contour posteriorly
        if (sp.glute && cosT < -0.1) {
          const lobeL = Math.exp(-Math.pow((sinT - 0.42) / 0.34, 2));
          const lobeR = Math.exp(-Math.pow((sinT + 0.42) / 0.34, 2));
          z -= (lobeL + lobeR) * sp.glute * Math.abs(cosT);
        }

        // Tasteful clinical anatomical bust contour for female
        if (sp.bust && cosT > 0.15) {
          const bL = Math.exp(-Math.pow((sinT - 0.45) / 0.30, 2));
          const bR = Math.exp(-Math.pow((sinT + 0.45) / 0.30, 2));
          const bustProj = (bL + bR) * 0.044 * sp.bust * Math.pow(cosT, 0.8);
          z += bustProj;
          // Slight lateral fullness
          x += Math.sign(sinT) * (bL + bR) * 0.008 * sp.bust;
        }

        // Subtle anterior sternal valley & muscular pectoral shelf for male
        if (sp.pec && cosT > 0.25) {
          const pL = Math.exp(-Math.pow((sinT - 0.46) / 0.36, 2));
          const pR = Math.exp(-Math.pow((sinT + 0.46) / 0.36, 2));
          const valley = Math.exp(-Math.pow(sinT / 0.14, 2)) * 0.007 * sp.pec;
          z += (pL + pR) * 0.016 * sp.pec * cosT - valley;
        }

        ring.push(new THREE.Vector3(x, sp.y, z));
      }
      return ring;
    });

    addMesh(g, createLoftedGeometry(torsoRings, true, false), skinMaterial, sid, sys, skinOpts);

    // --- 1B. Sculpted Neck + Contoured Head (chin, nose ridge, cheekbones, cranium) ---
    const headSpecs = [
      { y: 1.468, rx: isF ? 0.055 : 0.063, rzF: isF ? 0.055 : 0.061, rzB: isF ? 0.058 : 0.065, zc: -0.014 },
      { y: 1.505, rx: isF ? 0.049 : 0.057, rzF: isF ? 0.050 : 0.056, rzB: isF ? 0.054 : 0.060, zc: -0.015 },
      { y: 1.542, rx: isF ? 0.048 : 0.056, rzF: isF ? 0.052 : 0.058, rzB: isF ? 0.056 : 0.062, zc: -0.014 },
      // Jaw & Chin
      { y: 1.552, rx: isF ? 0.046 : 0.055, rzF: isF ? 0.080 : 0.088, rzB: isF ? 0.058 : 0.062, zc: -0.008, chin: 1.0 },
      { y: 1.578, rx: isF ? 0.062 : 0.070, rzF: isF ? 0.090 : 0.096, rzB: isF ? 0.074 : 0.078, zc: -0.008, lips: 1.0 },
      { y: 1.608, rx: isF ? 0.070 : 0.076, rzF: isF ? 0.093 : 0.099, rzB: isF ? 0.088 : 0.092, zc: -0.008, cheek: 1.0, nose: 0.7 },
      { y: 1.630, rx: isF ? 0.073 : 0.078, rzF: isF ? 0.092 : 0.098, rzB: isF ? 0.095 : 0.099, zc: -0.008, nose: 1.0 },
      { y: 1.652, rx: isF ? 0.074 : 0.079, rzF: isF ? 0.090 : 0.096, rzB: isF ? 0.099 : 0.103, zc: -0.010, orbit: 1.0 },
      { y: 1.676, rx: isF ? 0.076 : 0.081, rzF: isF ? 0.093 : 0.098, rzB: isF ? 0.101 : 0.105, zc: -0.011, brow: 1.0 },
      { y: 1.708, rx: isF ? 0.073 : 0.077, rzF: isF ? 0.088 : 0.092, rzB: isF ? 0.095 : 0.099, zc: -0.012 },
      { y: 1.738, rx: isF ? 0.057 : 0.060, rzF: isF ? 0.068 : 0.071, rzB: isF ? 0.074 : 0.077, zc: -0.012 },
      { y: 1.756, rx: isF ? 0.028 : 0.030, rzF: isF ? 0.034 : 0.036, rzB: isF ? 0.036 : 0.038, zc: -0.012 },
      { y: 1.760, rx: 0.004, rzF: 0.005, rzB: 0.005, zc: -0.012 },
    ];

    const headSegs = 36;
    const headRings = headSpecs.map((sp) => {
      const ring = [];
      for (let s = 0; s < headSegs; s++) {
        const theta = (s / headSegs) * Math.PI * 2;
        const sinT = Math.sin(theta);
        const cosT = Math.cos(theta);
        let x = sinT * sp.rx;
        let z = sp.zc + cosT * (cosT >= 0 ? sp.rzF : sp.rzB);

        if (sp.chin && cosT > 0.65) {
          const chinNarrow = isF ? 0.28 : 0.40;
          z += Math.exp(-Math.pow(sinT / chinNarrow, 2)) * 0.010;
        }
        if (sp.lips && cosT > 0.72) {
          z += Math.exp(-Math.pow(sinT / 0.28, 2)) * 0.008;
        }
        if (sp.nose && cosT > 0.78) {
          z += Math.exp(-Math.pow(sinT / 0.13, 2)) * 0.019 * sp.nose;
        }
        if (sp.cheek && cosT > 0.25 && cosT < 0.85) {
          const cL = Math.exp(-Math.pow((sinT - 0.62) / 0.24, 2));
          const cR = Math.exp(-Math.pow((sinT + 0.62) / 0.24, 2));
          x += Math.sign(sinT) * (cL + cR) * 0.005;
          z += (cL + cR) * 0.005;
        }
        if (sp.orbit && cosT > 0.65) {
          // Gentle orbital socket depression around eyes + nasal bridge center
          const eyeL = Math.exp(-Math.pow((sinT - 0.34) / 0.16, 2));
          const eyeR = Math.exp(-Math.pow((sinT + 0.34) / 0.16, 2));
          const bridge = Math.exp(-Math.pow(sinT / 0.11, 2));
          z -= (eyeL + eyeR) * 0.009;
          z += bridge * 0.008;
        }
        if (sp.brow && cosT > 0.65) {
          z += Math.exp(-Math.pow(sinT / 0.55, 2)) * (isF ? 0.003 : 0.006);
        }

        ring.push(new THREE.Vector3(x, sp.y, z));
      }
      return ring;
    });

    addMesh(g, createLoftedGeometry(headRings, false, true), skinMaterial, sid, sys, skinOpts);

    // Bilateral sculpted ears
    for (const side of [-1, 1]) {
      const earGeo = new THREE.SphereGeometry(0.018, 12, 12);
      earGeo.scale(0.42, 1.35, 0.78);
      addMesh(g, earGeo, skinMaterial, sid, sys, {
        ...skinOpts,
        position: [side * (isF ? 0.075 : 0.080), 1.635, -0.018],
        rotation: [0.08, side * 0.18, side * -0.08],
      });
    }

    // --- 1C. Sculpted Gender-Specific Hair ---
    if (isF) {
      // Graceful sculpted shoulder-length hair framing face & draping behind shoulders
      const hairCrownGeo = new THREE.SphereGeometry(0.081, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.56);
      hairCrownGeo.scale(0.96, 0.99, 1.18);
      addMesh(g, hairCrownGeo, hairMaterial, sid, sys, {
        ...skinOpts,
        position: [0, 1.678, -0.014],
        rotation: [-0.22, 0, 0],
      });

      // Flowing shoulder-length tresses (left, right, and sculpted back curtain)
      const backCurtainCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 1.695, -0.078),
        new THREE.Vector3(0, 1.610, -0.106),
        new THREE.Vector3(0, 1.512, -0.100),
        new THREE.Vector3(0, 1.422, -0.090),
      ]);
      const backHairGeo = createModulatedTubeGeometry(
        backCurtainCurve,
        18,
        (u) => 0.056 + 0.015 * Math.sin(u * Math.PI),
        16,
        1.52,
        0.50,
        true
      );
      addMesh(g, backHairGeo, hairMaterial, sid, sys, skinOpts);

      for (const side of [-1, 1]) {
        const sideWave = new THREE.CatmullRomCurve3([
          new THREE.Vector3(side * 0.062, 1.702, -0.008),
          new THREE.Vector3(side * 0.085, 1.630, -0.022),
          new THREE.Vector3(side * 0.092, 1.535, -0.028),
          new THREE.Vector3(side * 0.096, 1.445, -0.012),
          new THREE.Vector3(side * 0.090, 1.395, 0.008),
        ]);
        const sideHairGeo = createModulatedTubeGeometry(
          sideWave,
          18,
          (u) => 0.023 + 0.011 * Math.sin(u * Math.PI) * (1 - u * 0.25),
          12,
          0.75,
          1.22,
          true
        );
        addMesh(g, sideHairGeo, hairMaterial, sid, sys, skinOpts);
      }
    } else {
      // Short sculpted male hair cap
      const maleHairGeo = new THREE.SphereGeometry(0.082, 26, 16, 0, Math.PI * 2, 0, Math.PI * 0.54);
      maleHairGeo.scale(0.98, 0.99, 1.19);
      addMesh(g, maleHairGeo, hairMaterial, sid, sys, {
        ...skinOpts,
        position: [0, 1.678, -0.014],
        rotation: [-0.24, 0, 0],
      });
    }

    // --- 1D. Bilateral Lofted Arms + Sculpted Hands & Fingers ---
    for (const side of [-1, 1]) {
      const sx = side * P.shX;
      const ex = side * P.elbowX;
      const wx = side * P.wristX;
      const armScale = isF ? 0.85 : 1.0;

      const armStations = [
        // Wrist -> Forearm -> Elbow -> Upper Arm -> Deltoid shoulder cap
        { x: wx, y: P.wristY, z: P.wristZ, rx: 0.027 * armScale, rz: 0.022 * armScale },
        { x: THREE.MathUtils.lerp(wx, ex, 0.3), y: 0.925, z: 0.004, rx: 0.033 * armScale, rz: 0.030 * armScale },
        { x: THREE.MathUtils.lerp(wx, ex, 0.72), y: 1.040, z: -0.008, rx: 0.044 * armScale, rz: 0.041 * armScale },
        { x: ex, y: P.elbowY, z: P.elbowZ, rx: 0.041 * armScale, rz: 0.039 * armScale },
        { x: THREE.MathUtils.lerp(ex, sx, 0.42), y: 1.240, z: -0.016, rx: 0.048 * armScale, rz: 0.047 * armScale },
        { x: THREE.MathUtils.lerp(ex, sx, 0.78), y: 1.350, z: -0.014, rx: 0.056 * armScale, rz: 0.054 * armScale },
        { x: sx - side * 0.014, y: P.shY + 0.012, z: P.shZ, rx: 0.054 * armScale, rz: 0.052 * armScale },
      ];
      addMesh(g, createLimbLoft(armStations, 22, true, true), skinMaterial, sid, sys, skinOpts);

      // Sculpted Palm
      const handGroup = new THREE.Group();
      handGroup.position.set(wx + side * 0.006, P.wristY - 0.044, P.wristZ + 0.008);
      handGroup.rotation.set(0.05, side * -0.18, side * 0.1);
      g.add(handGroup);

      const palmGeo = new THREE.BoxGeometry(0.068 * armScale, 0.078 * armScale, 0.024 * armScale, 3, 3, 2);
      // Round box corners slightly for organic palm feel
      const posAttr = palmGeo.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        const vx = posAttr.getX(i);
        const vy = posAttr.getY(i);
        const vz = posAttr.getZ(i);
        const dist = Math.hypot(vx / (0.036 * armScale), vy / (0.042 * armScale));
        if (dist > 1.0) {
          posAttr.setZ(i, vz * 0.65);
        }
      }
      palmGeo.computeVertexNormals();
      addMesh(handGroup, palmGeo, skinMaterial, sid, sys, skinOpts);

      // Thumb (lateral/outer side in anatomical position: same sign as `side`)
      const thumbGeo = new THREE.CapsuleGeometry(0.0085 * armScale, 0.038 * armScale, 6, 10);
      addMesh(handGroup, thumbGeo, skinMaterial, sid, sys, {
        ...skinOpts,
        position: [side * 0.042 * armScale, -0.008 * armScale, 0.009],
        rotation: [0.15, 0, side * 0.56],
      });

      // 4 Fingers (index, middle, ring, pinky)
      const fingerSpecs = [
        { offset: 0.023, len: 0.064, rad: 0.0072 }, // Index
        { offset: 0.008, len: 0.072, rad: 0.0074 }, // Middle
        { offset: -0.008, len: 0.066, rad: 0.0070 }, // Ring
        { offset: -0.023, len: 0.052, rad: 0.0062 }, // Pinky
      ];
      for (const f of fingerSpecs) {
        const fGeo = new THREE.CapsuleGeometry(f.rad * armScale, f.len * armScale, 5, 8);
        addMesh(handGroup, fGeo, skinMaterial, sid, sys, {
          ...skinOpts,
          position: [side * f.offset * armScale, -(0.042 + f.len * 0.52) * armScale, 0.003],
          rotation: [0.12, 0, side * f.offset * 1.4],
        });
      }
    }

    // --- 1E. Bilateral Lofted Legs + Sculpted Feet ---
    for (const side of [-1, 1]) {
      const hx = side * P.hipX;
      const kx = side * P.kneeX;
      const ax = side * P.ankleX;
      const thighScale = isF ? 1.04 : 1.0;
      const calfScale = isF ? 0.90 : 1.0;

      const legStations = [
        // Ankle -> Lower shin -> Calf bulge -> Knee -> Mid-thigh -> Upper thigh/hip blend
        { x: ax, y: P.ankleY, z: -0.012, rx: 0.034 * calfScale, rzFront: 0.040 * calfScale, rzBack: 0.038 * calfScale },
        { x: ax, y: 0.165, z: -0.012, rx: 0.040 * calfScale, rzFront: 0.042 * calfScale, rzBack: 0.046 * calfScale },
        { x: THREE.MathUtils.lerp(ax, kx, 0.48), y: 0.275, z: -0.010, rx: 0.054 * calfScale, rzFront: 0.048 * calfScale, rzBack: 0.066 * calfScale },
        { x: THREE.MathUtils.lerp(ax, kx, 0.76), y: 0.370, z: -0.004, rx: 0.057 * calfScale, rzFront: 0.052 * calfScale, rzBack: 0.062 * calfScale },
        { x: kx, y: P.kneeY, z: 0.006, rx: 0.056, rzFront: 0.056, rzBack: 0.052 },
        { x: THREE.MathUtils.lerp(kx, hx, 0.35), y: 0.595, z: 0.002, rx: 0.072 * thighScale, rzFront: 0.074 * thighScale, rzBack: 0.072 * thighScale },
        { x: THREE.MathUtils.lerp(kx, hx, 0.72), y: 0.725, z: -0.004, rx: 0.086 * thighScale, rzFront: 0.084 * thighScale, rzBack: 0.092 * thighScale },
        { x: hx, y: 0.825, z: -0.006, rx: 0.088 * thighScale, rzFront: 0.086 * thighScale, rzBack: 0.098 * thighScale },
      ];
      addMesh(g, createLimbLoft(legStations, 24, true, true), skinMaterial, sid, sys, skinOpts);

      // Sculpted Foot resting cleanly at y = 0.0
      const footPts = [
        new THREE.Vector3(ax, 0.028, -0.052), // Heel
        new THREE.Vector3(ax, 0.036, 0.005),  // Instep/arch
        new THREE.Vector3(ax, 0.026, 0.082),  // Ball of foot
        new THREE.Vector3(ax, 0.015, 0.148),  // Toes
      ];
      const footCurve = new THREE.CatmullRomCurve3(footPts);
      const footGeo = createModulatedTubeGeometry(
        footCurve,
        16,
        (u) => {
          const base = u < 0.25 ? 0.034 : u < 0.75 ? 0.036 : 0.038 * (1 - (u - 0.75) * 1.4);
          return base * (isF ? 0.90 : 1.0);
        },
        14,
        1.15,
        0.64,
        true
      );
      // Flatten sole smoothly to y = 0.0
      const fPos = footGeo.attributes.position;
      for (let i = 0; i < fPos.count; i++) {
        if (fPos.getY(i) < 0.0) fPos.setY(i, 0.0);
      }
      footGeo.computeVertexNormals();
      addMesh(g, footGeo, skinMaterial, sid, sys, skinOpts);
    }
  })();

  // =========================================================================
  // 2. MUSCULAR SYSTEM (Striated Crimson Bellies + Fascia Tendons)
  // =========================================================================
  (function buildMuscularSystem() {
    const g = systems.muscular;
    const sys = 'muscular';
    const mScale = isF ? 0.84 : 1.0;

    // --- 2A. Trapezius (posterior diamond hood + anterior sternocleidomastoid straps) ---
    for (const side of [-1, 1]) {
      // Upper trapezius sweeping from occiput to acromion
      const trapUpper = createMuscleBellyGeometry(
        [
          new THREE.Vector3(side * 0.018, 1.545, -0.044),
          new THREE.Vector3(side * 0.058, 1.475, -0.055),
          new THREE.Vector3(side * (P.shX - 0.032), 1.435, -0.036),
        ],
        0.025 * mScale,
        1.1,
        0.55,
        16,
        10
      );
      addMesh(g, trapUpper, muscleMaterial, 'trapezius', sys);

      // Middle & lower trapezius triangular back fibers
      const trapLower = createMuscleBellyGeometry(
        [
          new THREE.Vector3(side * (P.shX - 0.055), 1.385, -0.088),
          new THREE.Vector3(side * 0.056, 1.315, -0.106),
          new THREE.Vector3(side * 0.016, 1.185, -0.095),
        ],
        0.032 * mScale,
        1.35,
        0.42,
        16,
        10
      );
      addMesh(g, trapLower, muscleDeepMaterial, 'trapezius', sys);

      // Sternocleidomastoid V-strap (mastoid process -> manubrium)
      const scm = createMuscleBellyGeometry(
        [
          new THREE.Vector3(side * 0.044, 1.545, -0.020),
          new THREE.Vector3(side * 0.034, 1.488, 0.015),
          new THREE.Vector3(side * 0.012, 1.432, 0.068),
        ],
        0.011 * mScale,
        1.0,
        0.65,
        12,
        8
      );
      addMesh(g, scm, muscleMaterial, 'trapezius', sys);
    }

    // --- 2B. Deltoid (bilateral 3-headed shoulder caps) ---
    for (const side of [-1, 1]) {
      const sx = side * P.shX;
      const ex = side * P.elbowX;
      const deltoidInsertion = new THREE.Vector3(
        THREE.MathUtils.lerp(sx, ex, 0.34),
        1.310,
        -0.014
      );

      // Lateral head (main rounded shoulder cap)
      const latHead = createMuscleBellyGeometry(
        [
          new THREE.Vector3(sx - side * 0.022, P.shY + 0.032, -0.014),
          new THREE.Vector3(sx + side * 0.026, P.shY - 0.018, -0.014),
          deltoidInsertion,
        ],
        0.032 * mScale,
        1.15,
        0.72,
        18,
        12,
        0.42
      );
      addMesh(g, latHead, muscleMaterial, 'deltoid', sys);

      // Anterior head (clavicular fibers)
      const antHead = createMuscleBellyGeometry(
        [
          new THREE.Vector3(sx - side * 0.056, P.shY + 0.022, 0.036),
          new THREE.Vector3(sx + side * 0.008, P.shY - 0.020, 0.028),
          deltoidInsertion,
        ],
        0.024 * mScale,
        1.05,
        0.65,
        14,
        10
      );
      addMesh(g, antHead, muscleMaterial, 'deltoid', sys);

      // Posterior head (scapular spine fibers)
      const postHead = createMuscleBellyGeometry(
        [
          new THREE.Vector3(sx - side * 0.064, P.shY + 0.012, -0.068),
          new THREE.Vector3(sx + side * 0.008, P.shY - 0.022, -0.056),
          deltoidInsertion,
        ],
        0.024 * mScale,
        1.05,
        0.65,
        14,
        10
      );
      addMesh(g, postHead, muscleDeepMaterial, 'deltoid', sys);
    }

    // --- 2C. Pectoralis Major (bilateral fan-shaped chest muscles) ---
    for (const side of [-1, 1]) {
      const humInsert = new THREE.Vector3(side * (P.shX - 0.016), 1.348, 0.018);
      const pecZ = isF ? 0.098 : 0.114;

      // Clavicular (upper) fan bundle
      const pecUpper = createMuscleBellyGeometry(
        [
          new THREE.Vector3(side * 0.016, 1.402, pecZ - 0.016),
          new THREE.Vector3(side * (isF ? 0.072 : 0.092), 1.382, pecZ),
          humInsert,
        ],
        0.026 * mScale,
        1.35,
        0.48,
        16,
        10,
        0.46
      );
      addMesh(g, pecUpper, muscleMaterial, 'pectoralis', sys);

      // Sternocostal (mid-main) fan bundle
      const pecMid = createMuscleBellyGeometry(
        [
          new THREE.Vector3(side * 0.012, 1.330, pecZ + 0.002),
          new THREE.Vector3(side * (isF ? 0.076 : 0.098), 1.326, pecZ + 0.006),
          humInsert,
        ],
        0.036 * mScale,
        1.45,
        0.45,
        18,
        12,
        0.46
      );
      addMesh(g, pecMid, muscleMaterial, 'pectoralis', sys);

      // Abdominal (inferior) fan border
      const pecLower = createMuscleBellyGeometry(
        [
          new THREE.Vector3(side * 0.018, 1.255, pecZ - 0.004),
          new THREE.Vector3(side * (isF ? 0.074 : 0.098), 1.275, pecZ),
          humInsert,
        ],
        0.028 * mScale,
        1.35,
        0.44,
        16,
        10,
        0.44
      );
      addMesh(g, pecLower, muscleDeepMaterial, 'pectoralis', sys);
    }

    // --- 2D. Rectus Abdominis (8 sculpted blocks + pale Linea Alba + intersections) ---
    const abDepth = isF ? 0.082 : 0.096;
    const abX = isF ? 0.028 : 0.034;
    const abBlocks = [
      { y: 1.180, h: 0.036, w: isF ? 0.025 : 0.031, z: abDepth - 0.002 },
      { y: 1.118, h: 0.038, w: isF ? 0.025 : 0.031, z: abDepth + 0.001 },
      { y: 1.052, h: 0.039, w: isF ? 0.024 : 0.030, z: abDepth + 0.002 },
      { y: 0.960, h: 0.068, w: isF ? 0.021 : 0.026, z: abDepth - 0.003 },
    ];

    for (const blk of abBlocks) {
      for (const side of [-1, 1]) {
        const blockGeo = new THREE.SphereGeometry(1, 14, 12);
        blockGeo.scale(blk.w, blk.h * 0.72, 0.016 * mScale);
        addMesh(g, blockGeo, muscleMaterial, 'rectus_abdominis', sys, {
          position: [side * abX, blk.y, blk.z],
        });
      }
    }

    // Pale white Linea Alba central tendon strip
    const lineaAlbaCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 1.215, abDepth + 0.002),
      new THREE.Vector3(0, 1.090, abDepth + 0.007),
      new THREE.Vector3(0, 0.960, abDepth + 0.003),
      new THREE.Vector3(0, 0.855, abDepth - 0.014),
    ]);
    const lineaAlbaGeo = createModulatedTubeGeometry(
      lineaAlbaCurve,
      20,
      () => 0.0065,
      8,
      1.2,
      0.45,
      true
    );
    addMesh(g, lineaAlbaGeo, fasciaMaterial, 'rectus_abdominis', sys);

    // 3 horizontal pale tendinous intersections
    for (const iy of [1.148, 1.084, 1.018]) {
      const bandCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-abX * 1.85, iy, abDepth - 0.004),
        new THREE.Vector3(0, iy, abDepth + 0.006),
        new THREE.Vector3(abX * 1.85, iy, abDepth - 0.004),
      ]);
      const bandGeo = createModulatedTubeGeometry(bandCurve, 12, () => 0.0042, 6, 1.0, 0.6, true);
      addMesh(g, bandGeo, fasciaMaterial, 'rectus_abdominis', sys);
    }

    // --- 2E. Obliques (bilateral flank muscles + lateral rib serratus bands) ---
    for (const side of [-1, 1]) {
      const flankX = isF ? 0.104 : 0.128;
      const oblAnt = createMuscleBellyGeometry(
        [
          new THREE.Vector3(side * (flankX + 0.006), 1.155, 0.025),
          new THREE.Vector3(side * (flankX - 0.008), 1.045, 0.042),
          new THREE.Vector3(side * (flankX - 0.002), 0.925, 0.048),
        ],
        0.026 * mScale,
        0.55,
        1.45,
        18,
        10
      );
      addMesh(g, oblAnt, muscleDeepMaterial, 'obliques', sys);

      const oblLat = createMuscleBellyGeometry(
        [
          new THREE.Vector3(side * (flankX + 0.014), 1.175, -0.028),
          new THREE.Vector3(side * (flankX - 0.002), 1.055, -0.015),
          new THREE.Vector3(side * (P.pelW - 0.015), 0.940, -0.005),
        ],
        0.025 * mScale,
        0.52,
        1.4,
        18,
        10
      );
      addMesh(g, oblLat, muscleMaterial, 'obliques', sys);

      // Latissimus dorsi back sweep (adds rich posterior torso depth)
      const latDorsi = createMuscleBellyGeometry(
        [
          new THREE.Vector3(side * (P.shX - 0.032), 1.335, -0.045),
          new THREE.Vector3(side * (flankX + 0.012), 1.185, -0.088),
          new THREE.Vector3(side * 0.052, 0.995, -0.078),
        ],
        0.032 * mScale,
        1.35,
        0.42,
        18,
        10
      );
      addMesh(g, latDorsi, muscleDeepMaterial, 'obliques', sys);
    }

    // --- 2F. Biceps (bilateral upper arm: biceps brachii + posterior triceps heads) ---
    for (const side of [-1, 1]) {
      const shPt = new THREE.Vector3(side * P.shX, P.shY - 0.02, P.shZ);
      const elPt = new THREE.Vector3(side * P.elbowX, P.elbowY + 0.01, P.elbowZ);

      // Anterior Biceps Brachii (long & short fused sculpted belly)
      const bicMid = new THREE.Vector3().lerpVectors(shPt, elPt, 0.52);
      bicMid.z += 0.024;
      const bicepsGeo = createMuscleBellyGeometry(
        [
          shPt.clone().add(new THREE.Vector3(-side * 0.006, -0.01, 0.018)),
          bicMid,
          elPt.clone().add(new THREE.Vector3(0, -0.015, 0.016)),
        ],
        0.025 * mScale,
        1.0,
        0.85,
        18,
        12,
        0.52
      );
      addMesh(g, bicepsGeo, muscleMaterial, 'biceps', sys);

      // Posterior Triceps Brachii (long + lateral heads)
      const triMid = new THREE.Vector3().lerpVectors(shPt, elPt, 0.45);
      triMid.z -= 0.024;
      const tricepsGeo = createMuscleBellyGeometry(
        [
          shPt.clone().add(new THREE.Vector3(-side * 0.010, -0.02, -0.018)),
          triMid,
          elPt.clone().add(new THREE.Vector3(0, -0.005, -0.016)),
        ],
        0.024 * mScale,
        1.05,
        0.82,
        18,
        12,
        0.42
      );
      addMesh(g, tricepsGeo, muscleDeepMaterial, 'biceps', sys);
    }

    // --- 2G. Forearm Flexors (anterior flexors + lateral brachioradialis + posterior extensors) ---
    for (const side of [-1, 1]) {
      const elPt = new THREE.Vector3(side * P.elbowX, P.elbowY, P.elbowZ);
      const wrPt = new THREE.Vector3(side * P.wristX, P.wristY, P.wristZ);

      const flexMid = new THREE.Vector3().lerpVectors(elPt, wrPt, 0.34);
      flexMid.x -= side * 0.008;
      flexMid.z += 0.014;
      const flexorGeo = createMuscleBellyGeometry(
        [
          elPt.clone().add(new THREE.Vector3(-side * 0.014, 0.005, 0.008)),
          flexMid,
          wrPt.clone().add(new THREE.Vector3(-side * 0.004, 0.015, 0.008)),
        ],
        0.021 * mScale,
        0.95,
        0.82,
        18,
        10,
        0.32
      );
      addMesh(g, flexorGeo, muscleMaterial, 'forearm_flexors', sys);

      const brachioMid = new THREE.Vector3().lerpVectors(elPt, wrPt, 0.30);
      brachioMid.x += side * 0.015;
      brachioMid.z += 0.004;
      const brachioGeo = createMuscleBellyGeometry(
        [
          elPt.clone().add(new THREE.Vector3(side * 0.014, 0.032, 0.004)),
          brachioMid,
          wrPt.clone().add(new THREE.Vector3(side * 0.010, 0.015, 0.002)),
        ],
        0.018 * mScale,
        0.88,
        0.88,
        16,
        10,
        0.32
      );
      addMesh(g, brachioGeo, muscleDeepMaterial, 'forearm_flexors', sys);

      const extMid = new THREE.Vector3().lerpVectors(elPt, wrPt, 0.36);
      extMid.z -= 0.014;
      const extGeo = createMuscleBellyGeometry(
        [
          elPt.clone().add(new THREE.Vector3(side * 0.006, 0.008, -0.010)),
          extMid,
          wrPt.clone().add(new THREE.Vector3(0, 0.015, -0.008)),
        ],
        0.018 * mScale,
        1.0,
        0.78,
        16,
        10,
        0.34
      );
      addMesh(g, extGeo, muscleDeepMaterial, 'forearm_flexors', sys);
    }

    // --- 2H. Quadriceps (rectus femoris, vastus lateralis, vastus medialis + hamstrings/gluteals) ---
    for (const side of [-1, 1]) {
      const hx = side * P.hipX;
      const kx = side * P.kneeX;
      const legM = isF ? 0.92 : 1.0;

      // Rectus Femoris (anterior central teardrop)
      const rfGeo = createMuscleBellyGeometry(
        [
          new THREE.Vector3(hx, 0.855, 0.038),
          new THREE.Vector3(THREE.MathUtils.lerp(hx, kx, 0.45), 0.675, 0.054),
          new THREE.Vector3(kx, 0.495, 0.038),
        ],
        0.033 * legM,
        1.05,
        0.82,
        20,
        12,
        0.44
      );
      addMesh(g, rfGeo, muscleMaterial, 'quadriceps', sys);

      // Vastus Lateralis (sweeping outer thigh)
      const vlGeo = createMuscleBellyGeometry(
        [
          new THREE.Vector3(hx + side * 0.038, 0.820, 0.006),
          new THREE.Vector3(THREE.MathUtils.lerp(hx, kx, 0.48) + side * 0.044, 0.655, 0.014),
          new THREE.Vector3(kx + side * 0.022, 0.495, 0.022),
        ],
        0.034 * legM,
        0.88,
        1.12,
        20,
        12,
        0.46
      );
      addMesh(g, vlGeo, muscleDeepMaterial, 'quadriceps', sys);

      // Vastus Medialis Obliquus (teardrop just above medial knee)
      const vmGeo = createMuscleBellyGeometry(
        [
          new THREE.Vector3(hx - side * 0.022, 0.785, 0.020),
          new THREE.Vector3(THREE.MathUtils.lerp(hx, kx, 0.70) - side * 0.030, 0.575, 0.028),
          new THREE.Vector3(kx - side * 0.020, 0.492, 0.025),
        ],
        0.030 * legM,
        0.92,
        0.92,
        18,
        12,
        0.65
      );
      addMesh(g, vmGeo, muscleMaterial, 'quadriceps', sys);

      // Posterior Hamstring bundle (biceps femoris / semitendinosus)
      const hamGeo = createMuscleBellyGeometry(
        [
          new THREE.Vector3(hx - side * 0.010, 0.805, -0.038),
          new THREE.Vector3(THREE.MathUtils.lerp(hx, kx, 0.48), 0.655, -0.048),
          new THREE.Vector3(kx, 0.475, -0.024),
        ],
        0.036 * legM,
        1.15,
        0.85,
        18,
        12,
        0.45
      );
      addMesh(g, hamGeo, muscleDeepMaterial, 'quadriceps', sys);

      // Gluteus Maximus muscular contour posteriorly
      const glutGeo = new THREE.SphereGeometry(0.068 * (isF ? 1.04 : 0.95), 16, 14);
      glutGeo.scale(1.08, 1.18, 0.68);
      addMesh(g, glutGeo, muscleMaterial, 'quadriceps', sys, {
        position: [side * (P.hipX - 0.012), 0.865, -0.072],
        rotation: [0.12, side * -0.18, 0],
      });
    }

    // --- 2I. Gastrocnemius (bilateral medial & lateral calf heads + Achilles tendon + tibialis) ---
    for (const side of [-1, 1]) {
      const kx = side * P.kneeX;
      const ax = side * P.ankleX;
      const calfM = isF ? 0.88 : 1.0;

      // Medial Gastrocnemius head (slightly lower & fuller)
      const gMedGeo = createMuscleBellyGeometry(
        [
          new THREE.Vector3(kx - side * 0.016, 0.460, -0.018),
          new THREE.Vector3(THREE.MathUtils.lerp(kx, ax, 0.34) - side * 0.020, 0.335, -0.044),
          new THREE.Vector3(ax - side * 0.006, 0.215, -0.032),
        ],
        0.025 * calfM,
        0.92,
        0.98,
        16,
        10,
        0.48
      );
      addMesh(g, gMedGeo, muscleMaterial, 'gastrocnemius', sys);

      // Lateral Gastrocnemius head
      const gLatGeo = createMuscleBellyGeometry(
        [
          new THREE.Vector3(kx + side * 0.018, 0.460, -0.018),
          new THREE.Vector3(THREE.MathUtils.lerp(kx, ax, 0.30) + side * 0.022, 0.352, -0.042),
          new THREE.Vector3(ax + side * 0.006, 0.225, -0.032),
        ],
        0.023 * calfM,
        0.9,
        0.95,
        16,
        10,
        0.45
      );
      addMesh(g, gLatGeo, muscleMaterial, 'gastrocnemius', sys);

      // Achilles Tendon (pale glistening cord into calcaneus heel)
      const achillesCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(ax, 0.235, -0.034),
        new THREE.Vector3(ax, 0.145, -0.038),
        new THREE.Vector3(ax, 0.048, -0.046),
      ]);
      const achillesGeo = createModulatedTubeGeometry(
        achillesCurve,
        14,
        (u) => 0.0105 * (1.2 - 0.35 * Math.sin(u * Math.PI)),
        10,
        1.1,
        0.72,
        true
      );
      addMesh(g, achillesGeo, fasciaMaterial, 'gastrocnemius', sys);

      // Anterior Tibialis lateral shin belly
      const tibAntGeo = createMuscleBellyGeometry(
        [
          new THREE.Vector3(kx + side * 0.020, 0.435, 0.012),
          new THREE.Vector3(THREE.MathUtils.lerp(kx, ax, 0.42) + side * 0.020, 0.305, 0.022),
          new THREE.Vector3(ax + side * 0.006, 0.115, 0.016),
        ],
        0.017 * calfM,
        0.82,
        1.05,
        16,
        10,
        0.36
      );
      addMesh(g, tibAntGeo, muscleDeepMaterial, 'gastrocnemius', sys);
    }
  })();

  // =========================================================================
  // 3. SKELETAL SYSTEM (Warm Ivory Bones + Cartilage Discs & Costal Arches)
  // =========================================================================
  (function buildSkeletalSystem() {
    const g = systems.skeletal;
    const sys = 'skeletal';

    // --- 3A. Skull (Cranium + Cheekbones + Eye Orbit Recesses + Mandible) ---
    const skullGroup = new THREE.Group();
    skullGroup.position.set(0, 1.662, -0.012);
    g.add(skullGroup);

    // Sculpted cranial vault
    const craniumGeo = new THREE.SphereGeometry(0.072, 28, 22);
    craniumGeo.scale(isF ? 0.94 : 0.98, 1.08, 1.24);
    addMesh(skullGroup, craniumGeo, boneMaterial, 'skull', sys, {
      position: [0, 0.015, -0.006],
    });

    // Frontal brow & upper facial block (maxilla)
    const faceGeo = new THREE.CylinderGeometry(0.056, 0.044, 0.082, 20);
    faceGeo.scale(isF ? 0.92 : 0.98, 1.0, 0.85);
    addMesh(skullGroup, faceGeo, boneMaterial, 'skull', sys, {
      position: [0, -0.036, 0.034],
    });

    // Bilateral orbital recesses + zygomatic (cheekbone) arches
    for (const side of [-1, 1]) {
      // Dark eye orbit socket recess
      const orbitGeo = new THREE.SphereGeometry(0.017, 14, 12);
      orbitGeo.scale(1.12, 0.92, 0.72);
      addMesh(skullGroup, orbitGeo, orbitShadowMaterial, 'skull', sys, {
        position: [side * 0.026, -0.014, 0.067],
      });

      // Raised orbital rim ring
      const rimGeo = new THREE.TorusGeometry(0.018, 0.0036, 8, 18);
      addMesh(skullGroup, rimGeo, boneMaterial, 'skull', sys, {
        position: [side * 0.026, -0.014, 0.071],
        rotation: [0.08, side * 0.22, 0],
      });

      // Zygomatic arch curving back to temporal bone
      const zygoCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.034, -0.032, 0.068),
        new THREE.Vector3(side * (isF ? 0.056 : 0.060), -0.032, 0.034),
        new THREE.Vector3(side * (isF ? 0.058 : 0.062), -0.026, -0.006),
      ]);
      const zygoGeo = new THREE.TubeGeometry(zygoCurve, 12, 0.0055, 8, false);
      addMesh(skullGroup, zygoGeo, boneMaterial, 'skull', sys);
    }

    // Nasal piriform recess + nasal bridge bone
    const nasalHoleGeo = new THREE.ConeGeometry(0.0095, 0.022, 10);
    nasalHoleGeo.scale(0.95, 1.0, 0.55);
    addMesh(skullGroup, nasalHoleGeo, orbitShadowMaterial, 'skull', sys, {
      position: [0, -0.034, 0.074],
    });

    const nasalBridgeGeo = new THREE.BoxGeometry(0.011, 0.022, 0.012);
    addMesh(skullGroup, nasalBridgeGeo, boneMaterial, 'skull', sys, {
      position: [0, -0.016, 0.078],
      rotation: [-0.28, 0, 0],
    });

    // Mandible (U-shaped lower jawbone with ascending rami & chin)
    const jawW = isF ? 0.044 : 0.050;
    const jawCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-jawW, -0.032, 0.004), // Right condyle
      new THREE.Vector3(-jawW * 0.96, -0.074, 0.014), // Right gonial angle
      new THREE.Vector3(-jawW * 0.58, -0.098, 0.054),
      new THREE.Vector3(0, -0.104, 0.070), // Chin (mentum)
      new THREE.Vector3(jawW * 0.58, -0.098, 0.054),
      new THREE.Vector3(jawW * 0.96, -0.074, 0.014), // Left gonial angle
      new THREE.Vector3(jawW, -0.032, 0.004), // Left condyle
    ]);
    const jawGeo = createModulatedTubeGeometry(
      jawCurve,
      26,
      (u) => 0.0085 + 0.0032 * Math.sin(u * Math.PI),
      10,
      0.82,
      1.32,
      true
    );
    addMesh(skullGroup, jawGeo, boneMaterial, 'skull', sys);

    // Subtle upper & lower dental arches
    const teethCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.026, -0.072, 0.044),
      new THREE.Vector3(-0.016, -0.073, 0.064),
      new THREE.Vector3(0, -0.073, 0.071),
      new THREE.Vector3(0.016, -0.073, 0.064),
      new THREE.Vector3(0.026, -0.072, 0.044),
    ]);
    const teethGeo = new THREE.TubeGeometry(teethCurve, 14, 0.0048, 8, false);
    addMesh(skullGroup, teethGeo, boneMaterial, 'skull', sys);

    // --- 3B. Spine (22 stacked individual vertebrae + intervertebral discs along S-curve) ---
    const numVertebrae = 22;
    for (let i = 0; i < numVertebrae; i++) {
      const t = i / (numVertebrae - 1); // 0 = C2 (top), 1 = L5 (bottom)
      const pt = spineCurve.getPointAt(t * 0.92);
      const tan = spineCurve.getTangentAt(t * 0.92).normalize();
      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), tan);

      const vertGroup = new THREE.Group();
      vertGroup.position.copy(pt);
      vertGroup.quaternion.copy(quat);
      g.add(vertGroup);

      // Vertebral body smoothly enlarges from cervical (top) -> lumbar (bottom)
      const bodyR = THREE.MathUtils.lerp(0.013, 0.023, t);
      const bodyH = THREE.MathUtils.lerp(0.013, 0.022, t);
      const bodyGeo = new THREE.CylinderGeometry(bodyR, bodyR * 1.04, bodyH, 12);
      bodyGeo.scale(1.15, 1.0, 0.92);
      addMesh(vertGroup, bodyGeo, boneMaterial, 'spine', sys);

      // Posterior spinous process (angled slightly inferiorly in thoracic region)
      const spinousLen = THREE.MathUtils.lerp(0.020, 0.028, Math.sin(t * Math.PI));
      const spinousGeo = new THREE.BoxGeometry(0.0065, bodyH * 0.65, spinousLen);
      addMesh(vertGroup, spinousGeo, boneMaterial, 'spine', sys, {
        position: [0, -0.004, -(bodyR + spinousLen * 0.45)],
        rotation: [t > 0.25 && t < 0.78 ? -0.45 : -0.15, 0, 0],
      });

      // Bilateral transverse processes
      const transW = THREE.MathUtils.lerp(0.042, 0.066, Math.pow(t, 0.7));
      const transGeo = new THREE.BoxGeometry(transW, bodyH * 0.48, 0.008);
      addMesh(vertGroup, transGeo, boneMaterial, 'spine', sys, {
        position: [0, 0, -bodyR * 0.95],
      });

      // Intervertebral disc below each vertebra (except last)
      if (i < numVertebrae - 1) {
        const nextPt = spineCurve.getPointAt(((i + 1) / (numVertebrae - 1)) * 0.92);
        const discMid = new THREE.Vector3().addVectors(pt, nextPt).multiplyScalar(0.5);
        const discGeo = new THREE.CylinderGeometry(bodyR * 0.98, bodyR * 0.98, 0.006, 12);
        discGeo.scale(1.14, 1.0, 0.90);
        addMesh(g, discGeo, cartilageMaterial, 'spine', sys, {
          position: [discMid.x, discMid.y, discMid.z],
        });
      }
    }

    // --- 3C. Sternum (Manubrium + Body + Xiphoid Process) ---
    const sternZ = isF ? 0.088 : 0.098;
    // Manubrium (upper broad hexagonal shield)
    const manuGeo = new THREE.CylinderGeometry(0.024, 0.017, 0.044, 6);
    manuGeo.scale(1.12, 1.0, 0.34);
    addMesh(g, manuGeo, boneMaterial, 'sternum', sys, {
      position: [0, 1.404, sternZ - 0.008],
      rotation: [0.22, 0, 0],
    });

    // Sternal Body (Gladiolus)
    const sternBodyGeo = new THREE.BoxGeometry(0.030, 0.132, 0.011, 2, 4, 1);
    addMesh(g, sternBodyGeo, boneMaterial, 'sternum', sys, {
      position: [0, 1.316, sternZ + 0.002],
      rotation: [-0.06, 0, 0],
    });

    // Xiphoid Process (tapered inferior tip)
    const xiphGeo = new THREE.ConeGeometry(0.011, 0.036, 8);
    xiphGeo.scale(1.0, 1.0, 0.45);
    addMesh(g, xiphGeo, cartilageMaterial, 'sternum', sys, {
      position: [0, 1.233, sternZ - 0.001],
      rotation: [Math.PI, 0, 0],
    });

    // --- 3D. Ribcage (10 pairs of curved 3D TubeGeometry ribs + 2 floating stubs) ---
    const ribConfigs = [
      { yBack: 1.418, yFront: 1.408, w: 0.56, zF: sternZ - 0.008, attachX: 0.020, trueRib: true },
      { yBack: 1.394, yFront: 1.380, w: 0.76, zF: sternZ - 0.002, attachX: 0.016, trueRib: true },
      { yBack: 1.368, yFront: 1.350, w: 0.88, zF: sternZ + 0.002, attachX: 0.016, trueRib: true },
      { yBack: 1.342, yFront: 1.320, w: 0.96, zF: sternZ + 0.004, attachX: 0.016, trueRib: true },
      { yBack: 1.315, yFront: 1.290, w: 1.00, zF: sternZ + 0.004, attachX: 0.016, trueRib: true },
      { yBack: 1.288, yFront: 1.262, w: 1.01, zF: sternZ + 0.002, attachX: 0.015, trueRib: true },
      { yBack: 1.260, yFront: 1.236, w: 0.99, zF: sternZ - 0.002, attachX: 0.016, trueRib: true },
      // Ribs 8–10 (false ribs sweeping up smoothly into the anterior costal arch!)
      { yBack: 1.232, yFront: 1.214, w: 0.95, zF: sternZ - 0.008, attachX: 0.036, trueRib: false },
      { yBack: 1.204, yFront: 1.186, w: 0.89, zF: sternZ - 0.016, attachX: 0.056, trueRib: false },
      { yBack: 1.176, yFront: 1.158, w: 0.81, zF: sternZ - 0.026, attachX: 0.072, trueRib: false },
    ];

    for (const rc of ribConfigs) {
      const latW = P.ribW * rc.w;
      const spineZ = -0.078;
      for (const side of [-1, 1]) {
        // Bony rib portion (spine -> posterior gutter -> lateral curve -> anterolateral costochondral junction)
        const bonePts = [
          new THREE.Vector3(side * 0.015, rc.yBack, spineZ),
          new THREE.Vector3(side * latW * 0.56, rc.yBack - 0.008, spineZ - 0.024),
          new THREE.Vector3(side * latW, (rc.yBack + rc.yFront) * 0.5 - 0.016, -0.015),
          new THREE.Vector3(side * latW * 0.78, rc.yFront - 0.020, rc.zF - 0.020),
        ];
        const ribCurve = new THREE.CatmullRomCurve3(bonePts);
        const ribGeo = createModulatedTubeGeometry(
          ribCurve,
          20,
          () => 0.0056,
          8,
          0.62,
          1.22,
          true
        );
        addMesh(g, ribGeo, boneMaterial, 'ribcage', sys);

        // Costal cartilage tip connecting rib anteriorly to sternum or costal arch
        const cartPts = [
          bonePts[3],
          new THREE.Vector3(
            side * THREE.MathUtils.lerp(latW * 0.78, rc.attachX, 0.52),
            rc.yFront - (rc.trueRib ? 0.008 : 0.010),
            rc.zF - 0.004
          ),
          new THREE.Vector3(side * rc.attachX, rc.yFront, rc.zF),
        ];
        const cartCurve = new THREE.CatmullRomCurve3(cartPts);
        const cartGeo = createModulatedTubeGeometry(
          cartCurve,
          10,
          () => 0.0052,
          8,
          0.68,
          1.12,
          true
        );
        addMesh(g, cartGeo, cartilageMaterial, 'ribcage', sys);
      }
    }

    // Floating Ribs 11 & 12 (short posterior-lateral curved ribs)
    for (let f = 0; f < 2; f++) {
      const yB = 1.148 - f * 0.026;
      const wScale = f === 0 ? 0.66 : 0.48;
      for (const side of [-1, 1]) {
        const flCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(side * 0.016, yB, -0.068),
          new THREE.Vector3(side * P.ribW * wScale * 0.65, yB - 0.012, -0.088),
          new THREE.Vector3(side * P.ribW * wScale, yB - 0.028, -0.044),
        ]);
        const flGeo = createModulatedTubeGeometry(flCurve, 12, () => 0.0048, 7, 0.65, 1.15, true);
        addMesh(g, flGeo, boneMaterial, 'ribcage', sys);
      }
    }

    // --- 3E. Clavicles (S-curved collarbones) + Dorsal Scapulae Plates ---
    for (const side of [-1, 1]) {
      const clavCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.016, 1.422, sternZ - 0.012),
        new THREE.Vector3(side * P.shX * 0.36, 1.430, sternZ + 0.004),
        new THREE.Vector3(side * P.shX * 0.72, 1.432, 0.026),
        new THREE.Vector3(side * (P.shX - 0.010), 1.434, -0.016),
      ]);
      const clavGeo = createModulatedTubeGeometry(
        clavCurve,
        18,
        (u) => 0.0072 * (1 + 0.18 * Math.cos(u * Math.PI * 2)),
        10,
        1.1,
        0.85,
        true
      );
      addMesh(g, clavGeo, boneMaterial, 'clavicle', sys);

      // Dorsal Scapula blade (triangular plate on upper back)
      const scapShape = new THREE.Shape();
      scapShape.moveTo(0, 0); // Inferior angle
      scapShape.lineTo(side * 0.072, 0.135); // Lateral acromial corner
      scapShape.lineTo(side * 0.005, 0.148); // Superior medial angle
      scapShape.closePath();

      const scapGeo = new THREE.ExtrudeGeometry(scapShape, {
        depth: 0.008,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.003,
        bevelThickness: 0.003,
      });
      addMesh(g, scapGeo, boneMaterial, 'clavicle', sys, {
        position: [side * (P.shX - 0.110), 1.275, -0.105],
        rotation: [0.14, side * -0.28, 0],
      });

      // Scapular spine ridge & acromion meeting lateral clavicle
      const acromCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * (P.shX - 0.100), 1.390, -0.105),
        new THREE.Vector3(side * (P.shX - 0.032), 1.418, -0.078),
        new THREE.Vector3(side * (P.shX - 0.008), 1.434, -0.018),
      ]);
      const acromGeo = createModulatedTubeGeometry(acromCurve, 12, () => 0.0085, 8, 1.2, 0.72, true);
      addMesh(g, acromGeo, boneMaterial, 'clavicle', sys);
    }

    // --- 3F. Pelvis (Sexually Dimorphic Iliac Wings + Sacrum + Pubic Arch) ---
    // Sacrum & Coccyx wedge
    const sacrumGeo = new THREE.ConeGeometry(isF ? 0.056 : 0.048, 0.118, 8);
    sacrumGeo.scale(1.05, 1.0, 0.42);
    addMesh(g, sacrumGeo, boneMaterial, 'pelvis', sys, {
      position: [0, 0.858, -0.068],
      rotation: [Math.PI + 0.24, 0, 0],
    });

    // Bilateral Iliac Wings (clearly wider & flared for female, narrower & taller for male!)
    const iliacH = isF ? 0.115 : 0.132;
    const iliacFlare = isF ? 0.48 : 0.30; // Outward tilt angle
    for (const side of [-1, 1]) {
      const wingShape = new THREE.Shape();
      wingShape.moveTo(0, 0);
      wingShape.bezierCurveTo(
        side * 0.025,
        iliacH * 0.55,
        side * 0.068,
        iliacH * 1.08,
        side * (P.pelW - 0.052),
        iliacH * 0.86
      );
      wingShape.bezierCurveTo(
        side * (P.pelW - 0.022),
        iliacH * 0.52,
        side * (P.pelW - 0.036),
        0.015,
        side * (P.hipX - 0.036),
        -0.028
      );
      wingShape.lineTo(0, -0.022);
      wingShape.closePath();

      const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
        depth: 0.012,
        bevelEnabled: true,
        bevelSegments: 3,
        steps: 1,
        bevelSize: 0.005,
        bevelThickness: 0.005,
      });
      addMesh(g, wingGeo, boneMaterial, 'pelvis', sys, {
        position: [side * 0.038, 0.875, -0.052],
        rotation: [0.16, side * -0.58, side * -iliacFlare * 0.35],
      });

      // Iliac crest thickened superior rim
      const crestCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.048, 0.935, -0.068),
        new THREE.Vector3(side * (P.pelW * 0.86), isF ? 0.972 : 0.986, -0.028),
        new THREE.Vector3(side * (P.pelW * 0.92), 0.946, 0.044), // ASIS
      ]);
      const crestGeo = createModulatedTubeGeometry(crestCurve, 14, () => 0.0105, 8, 1.0, 1.15, true);
      addMesh(g, crestGeo, boneMaterial, 'pelvis', sys);

      // Superior Pubic Ramus & Ischial Loop (wider open arch for female!)
      const pubisLoop = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * P.hipX, 0.845, 0.002), // Acetabulum
        new THREE.Vector3(side * (isF ? 0.058 : 0.044), 0.835, 0.058), // Superior pubic ramus
        new THREE.Vector3(side * 0.006, 0.822, 0.068), // Pubic symphysis
        new THREE.Vector3(side * (isF ? 0.054 : 0.038), 0.788, 0.030), // Inferior pubic ramus (wider angle for F!)
        new THREE.Vector3(side * (isF ? 0.088 : 0.072), 0.785, -0.024), // Ischial tuberosity
        new THREE.Vector3(side * P.hipX, 0.840, -0.012), // Back to acetabulum
      ]);
      const loopGeo = new THREE.TubeGeometry(pubisLoop, 24, 0.0092, 8, false);
      addMesh(g, loopGeo, boneMaterial, 'pelvis', sys);

      // Acetabular socket cup
      const acetGeo = new THREE.SphereGeometry(0.022, 12, 10);
      addMesh(g, acetGeo, boneMaterial, 'pelvis', sys, {
        position: [side * P.hipX, P.hipY, 0.0],
      });
    }

    // Pubic symphysis fibrocartilage pad
    const symphGeo = new THREE.BoxGeometry(0.012, 0.028, 0.016);
    addMesh(g, symphGeo, cartilageMaterial, 'pelvis', sys, {
      position: [0, 0.818, 0.068],
    });

    // --- 3G. Humerus (bilateral upper arm bone) ---
    for (const side of [-1, 1]) {
      const shPt = new THREE.Vector3(side * P.shX, P.shY, P.shZ);
      const elPt = new THREE.Vector3(side * P.elbowX, P.elbowY, P.elbowZ);
      const len = shPt.distanceTo(elPt);

      // Humeral shaft
      const humShaftGeo = new THREE.CylinderGeometry(0.0125, 0.0115, len * 0.90, 12);
      const humMesh = addMesh(g, humShaftGeo, boneMaterial, 'humerus', sys);
      alignMeshBetween(humMesh, elPt, shPt);

      // Humeral head seated at glenohumeral joint
      const headGeo = new THREE.SphereGeometry(0.022, 14, 12);
      addMesh(g, headGeo, boneMaterial, 'humerus', sys, {
        position: [shPt.x - side * 0.006, shPt.y + 0.006, shPt.z],
      });

      // Distal epicondyle flare at elbow
      const epiGeo = new THREE.CylinderGeometry(0.013, 0.013, 0.042, 10);
      epiGeo.rotateZ(Math.PI / 2);
      addMesh(g, epiGeo, boneMaterial, 'humerus', sys, {
        position: [elPt.x, elPt.y + 0.004, elPt.z],
      });
    }

    // --- 3H. Radius & Ulna (paired forearm bones + skeletal hand) ---
    for (const side of [-1, 1]) {
      const elPt = new THREE.Vector3(side * P.elbowX, P.elbowY, P.elbowZ);
      const wrPt = new THREE.Vector3(side * P.wristX, P.wristY, P.wristZ);

      // Ulna (medial bone: thicker near elbow olecranon, tapers to wrist)
      const ulnaCurve = new THREE.CatmullRomCurve3([
        elPt.clone().add(new THREE.Vector3(-side * 0.012, 0.012, -0.006)),
        new THREE.Vector3().lerpVectors(elPt, wrPt, 0.5).add(new THREE.Vector3(-side * 0.013, 0, -0.004)),
        wrPt.clone().add(new THREE.Vector3(-side * 0.012, 0.004, 0.0)),
      ]);
      const ulnaGeo = createModulatedTubeGeometry(
        ulnaCurve,
        16,
        (u) => THREE.MathUtils.lerp(0.0095, 0.0062, u),
        10,
        1.0,
        1.0,
        true
      );
      addMesh(g, ulnaGeo, boneMaterial, 'radius_ulna', sys);

      // Radius (lateral/thumb-side bone: subtle lateral bow, wider distally at wrist)
      const radCurve = new THREE.CatmullRomCurve3([
        elPt.clone().add(new THREE.Vector3(side * 0.012, 0.0, 0.004)),
        new THREE.Vector3().lerpVectors(elPt, wrPt, 0.5).add(new THREE.Vector3(side * 0.018, 0, 0.005)),
        wrPt.clone().add(new THREE.Vector3(side * 0.013, 0.0, 0.004)),
      ]);
      const radGeo = createModulatedTubeGeometry(
        radCurve,
        16,
        (u) => THREE.MathUtils.lerp(0.0068, 0.0102, u),
        10,
        1.0,
        1.0,
        true
      );
      addMesh(g, radGeo, boneMaterial, 'radius_ulna', sys);

      // Skeletal Carpal cluster & 5 Metacarpal/Phalangeal rays
      const wristBone = new THREE.SphereGeometry(0.014, 10, 8);
      wristBone.scale(1.6, 0.72, 0.68);
      addMesh(g, wristBone, boneMaterial, 'radius_ulna', sys, {
        position: [wrPt.x + side * 0.003, wrPt.y - 0.012, wrPt.z + 0.004],
      });

      const rayOffsets = [
        { dx: 0.022, len: 0.088, ang: 0.42 }, // Thumb
        { dx: 0.014, len: 0.118, ang: 0.05 }, // Index
        { dx: 0.004, len: 0.128, ang: 0.0 },  // Middle
        { dx: -0.006, len: 0.120, ang: -0.04 }, // Ring
        { dx: -0.016, len: 0.100, ang: -0.08 }, // Pinky
      ];
      for (const ray of rayOffsets) {
        const start = new THREE.Vector3(
          wrPt.x + side * ray.dx * 0.75,
          wrPt.y - 0.018,
          wrPt.z + 0.006
        );
        const end = new THREE.Vector3(
          wrPt.x + side * (ray.dx + Math.sin(ray.ang) * ray.len * 0.55),
          wrPt.y - 0.018 - ray.len * Math.cos(ray.ang * 0.6),
          wrPt.z + 0.015
        );
        const rayCurve = new THREE.CatmullRomCurve3([start, end]);
        const rayGeo = createModulatedTubeGeometry(
          rayCurve,
          8,
          (u) => THREE.MathUtils.lerp(0.0044, 0.0028, u),
          6,
          1,
          1,
          true
        );
        addMesh(g, rayGeo, boneMaterial, 'radius_ulna', sys);
      }
    }

    // --- 3I. Femur (with angled femoral neck, head, greater trochanter & condyles) ---
    for (const side of [-1, 1]) {
      const headPt = new THREE.Vector3(side * P.hipX, P.hipY, 0.0);
      const trochPt = new THREE.Vector3(side * (P.hipX + 0.036), P.hipY - 0.018, -0.004);
      const kneePt = new THREE.Vector3(side * P.kneeX, P.kneeY + 0.012, 0.006);

      // Femoral Head
      const fHeadGeo = new THREE.SphereGeometry(0.020, 14, 12);
      addMesh(g, fHeadGeo, boneMaterial, 'femur', sys, {
        position: [headPt.x, headPt.y, headPt.z],
      });

      // Angled Femoral Neck
      const neckGeo = new THREE.CylinderGeometry(0.0125, 0.0145, headPt.distanceTo(trochPt), 10);
      const neckMesh = addMesh(g, neckGeo, boneMaterial, 'femur', sys);
      alignMeshBetween(neckMesh, trochPt, headPt);

      // Greater Trochanter prominence
      const trochGeo = new THREE.SphereGeometry(0.020, 12, 10);
      trochGeo.scale(0.95, 1.25, 0.92);
      addMesh(g, trochGeo, boneMaterial, 'femur', sys, {
        position: [trochPt.x + side * 0.004, trochPt.y + 0.008, trochPt.z],
      });

      // Femoral Shaft (subtle anatomical anterior bow)
      const shaftMid = new THREE.Vector3().lerpVectors(trochPt, kneePt, 0.5);
      shaftMid.z += 0.012;
      const femurCurve = new THREE.CatmullRomCurve3([trochPt, shaftMid, kneePt]);
      const femurGeo = createModulatedTubeGeometry(
        femurCurve,
        20,
        (u) => 0.0165 - 0.002 * Math.sin(u * Math.PI),
        12,
        1.0,
        1.0,
        true
      );
      addMesh(g, femurGeo, boneMaterial, 'femur', sys);

      // Paired Distal Femoral Condyles
      for (const cSide of [-1, 1]) {
        const condGeo = new THREE.SphereGeometry(0.019, 12, 10);
        condGeo.scale(0.88, 1.05, 1.25);
        addMesh(g, condGeo, boneMaterial, 'femur', sys, {
          position: [kneePt.x + cSide * 0.018, kneePt.y - 0.004, kneePt.z - 0.004],
        });
      }
    }

    // --- 3J. Patella (bilateral kneecap) ---
    for (const side of [-1, 1]) {
      const patGeo = new THREE.SphereGeometry(0.0185, 14, 12);
      patGeo.scale(1.08, 1.15, 0.56);
      addMesh(g, patGeo, boneMaterial, 'patella', sys, {
        position: [side * P.kneeX, P.kneeY + 0.008, 0.036],
      });
    }

    // --- 3K. Tibia & Fibula (paired lower leg bones + skeletal foot) ---
    for (const side of [-1, 1]) {
      const kneePt = new THREE.Vector3(side * P.kneeX, P.kneeY - 0.014, 0.002);
      const anklePt = new THREE.Vector3(side * P.ankleX, P.ankleY, -0.010);

      // Tibia (sturdy medial shinbone)
      const tibCurve = new THREE.CatmullRomCurve3([
        kneePt.clone().add(new THREE.Vector3(-side * 0.004, 0, 0.002)),
        new THREE.Vector3().lerpVectors(kneePt, anklePt, 0.5).add(new THREE.Vector3(-side * 0.006, 0, 0.002)),
        anklePt.clone().add(new THREE.Vector3(-side * 0.006, 0, 0.0)),
      ]);
      const tibGeo = createModulatedTubeGeometry(
        tibCurve,
        18,
        (u) => {
          if (u < 0.12) return THREE.MathUtils.lerp(0.025, 0.016, u / 0.12);
          if (u > 0.88) return THREE.MathUtils.lerp(0.014, 0.018, (u - 0.88) / 0.12);
          return THREE.MathUtils.lerp(0.016, 0.013, u);
        },
        12,
        1.05,
        0.95,
        true
      );
      addMesh(g, tibGeo, boneMaterial, 'tibia_fibula', sys);

      // Fibula (slender lateral companion bone)
      const fibCurve = new THREE.CatmullRomCurve3([
        kneePt.clone().add(new THREE.Vector3(side * 0.024, -0.018, -0.008)),
        new THREE.Vector3().lerpVectors(kneePt, anklePt, 0.5).add(new THREE.Vector3(side * 0.020, 0, -0.010)),
        anklePt.clone().add(new THREE.Vector3(side * 0.016, -0.006, -0.010)),
      ]);
      const fibGeo = createModulatedTubeGeometry(fibCurve, 16, () => 0.0062, 8, 1, 1, true);
      addMesh(g, fibGeo, boneMaterial, 'tibia_fibula', sys);

      // Calcaneus heel + talus + skeletal metatarsal arch
      const calcGeo = new THREE.BoxGeometry(0.028, 0.032, 0.056);
      addMesh(g, calcGeo, boneMaterial, 'tibia_fibula', sys, {
        position: [anklePt.x, 0.028, -0.022],
      });

      for (let t = -2; t <= 2; t++) {
        const toeCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(anklePt.x + t * 0.0085, 0.036, 0.005),
          new THREE.Vector3(anklePt.x + t * 0.0105, 0.024, 0.075),
          new THREE.Vector3(anklePt.x + t * 0.0110, 0.015, 0.132 - Math.abs(t) * 0.006),
        ]);
        const toeGeo = createModulatedTubeGeometry(
          toeCurve,
          10,
          (u) => THREE.MathUtils.lerp(0.0052, 0.0034, u),
          6,
          1,
          1,
          true
        );
        addMesh(g, toeGeo, boneMaterial, 'tibia_fibula', sys);
      }
    }
  })();

  // =========================================================================
  // 4. ORGANS SYSTEM (Brain, Trachea, Lungs, Diaphragm, 4-Chamber Heart, Viscera)
  // =========================================================================
  (function buildOrgansSystem() {
    const g = systems.organs;
    const sys = 'organs';

    // --- 4A. Brain (Bi-hemispheric folded cortex + cerebellum + brainstem) ---
    const brainGroup = new THREE.Group();
    brainGroup.position.set(0, 1.676, -0.015);
    g.add(brainGroup);

    for (const side of [-1, 1]) {
      // Cerebral hemisphere (flattened medially along longitudinal fissure)
      const hemiGeo = new THREE.SphereGeometry(0.056, 26, 20);
      hemiGeo.scale(0.56, 0.88, 1.30);
      const pos = hemiGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i);
        // Flatten medial surface near x=0
        if (side * vx < 0) pos.setX(i, vx * 0.35);
      }
      hemiGeo.computeVertexNormals();
      addMesh(brainGroup, hemiGeo, brainMaterial, 'brain', sys, {
        position: [side * 0.022, 0.008, -0.002],
      });

      // Temporal lobe lateral bulge
      const tempGeo = new THREE.SphereGeometry(0.024, 16, 12);
      tempGeo.scale(0.75, 0.72, 1.55);
      addMesh(brainGroup, tempGeo, brainMaterial, 'brain', sys, {
        position: [side * 0.036, -0.024, 0.008],
        rotation: [0.22, side * 0.14, 0],
      });

      // Bilateral Cerebellum lobes postero-inferiorly
      const cerebGeo = new THREE.SphereGeometry(0.024, 16, 12);
      cerebGeo.scale(1.05, 0.76, 0.92);
      addMesh(brainGroup, cerebGeo, cerebellumMaterial, 'brain', sys, {
        position: [side * 0.022, -0.056, -0.042],
      });
    }

    // Brainstem (Pons + Medulla Oblongata descending to spinal cord)
    const stemCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.032, -0.012),
      new THREE.Vector3(0, -0.068, -0.016),
      new THREE.Vector3(0, -0.125, -0.014),
    ]);
    const stemGeo = createModulatedTubeGeometry(
      stemCurve,
      14,
      (u) => (u < 0.45 ? 0.0155 : THREE.MathUtils.lerp(0.0155, 0.009, (u - 0.45) / 0.55)),
      12,
      1.05,
      1.15,
      true
    );
    addMesh(brainGroup, stemGeo, cerebellumMaterial, 'brain', sys);

    // --- 4B. Trachea (Larynx + Cartilaginous Ringed Tube + Primary Bronchi) ---
    // Thyroid cartilage / Larynx shield
    const larynxGeo = new THREE.CylinderGeometry(0.014, 0.012, 0.028, 12);
    larynxGeo.scale(1.08, 1.0, 0.92);
    addMesh(g, larynxGeo, cartilageMaterial, 'trachea', sys, {
      position: [0, 1.495, 0.016],
    });

    const tracheaCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 1.485, 0.014),
      new THREE.Vector3(0, 1.410, 0.004),
      new THREE.Vector3(0, 1.335, -0.010), // Carina bifurcation
    ]);
    const tracheaTubeGeo = new THREE.TubeGeometry(tracheaCurve, 18, 0.0095, 12, false);
    addMesh(g, tracheaTubeGeo, tracheaMaterial, 'trachea', sys);

    // 14 Pale C-shaped cartilaginous tracheal rings
    for (let r = 0; r < 14; r++) {
      const u = 0.06 + (r / 13) * 0.88;
      const pt = tracheaCurve.getPointAt(u);
      const ringGeo = new THREE.TorusGeometry(0.0102, 0.0018, 6, 16);
      ringGeo.rotateX(Math.PI / 2);
      addMesh(g, ringGeo, cartilageMaterial, 'trachea', sys, {
        position: [pt.x, pt.y, pt.z],
      });
    }

    // Right Primary Bronchus (-X: shorter, wider, steeper)
    const rBronchCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 1.335, -0.010),
      new THREE.Vector3(-0.032, 1.312, -0.012),
      new THREE.Vector3(-0.056, 1.295, -0.010),
    ]);
    addMesh(g, new THREE.TubeGeometry(rBronchCurve, 10, 0.0076, 10, false), tracheaMaterial, 'trachea', sys);

    // Left Primary Bronchus (+X: longer, more horizontal passing beneath aortic arch)
    const lBronchCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 1.335, -0.010),
      new THREE.Vector3(0.036, 1.315, -0.012),
      new THREE.Vector3(0.066, 1.298, -0.010),
    ]);
    addMesh(g, new THREE.TubeGeometry(lBronchCurve, 10, 0.0068, 10, false), tracheaMaterial, 'trachea', sys);

    // --- 4C. Lungs (Right Lung 3 lobes at -X, Left Lung 2 lobes + cardiac notch at +X) ---
    const lungScaleX = isF ? 0.88 : 1.0;

    // Right Lung (-X, larger, 3 distinct lobes)
    const rightLungGroup = new THREE.Group();
    rightLungGroup.name = 'rightLung';
    rightLungGroup.position.set(-0.070 * lungScaleX, 1.275, -0.008);
    g.add(rightLungGroup);
    animatedRefs.rightLung = rightLungGroup;

    const rLungGeo = new THREE.SphereGeometry(1, 28, 22);
    const rPos = rLungGeo.attributes.position;
    for (let i = 0; i < rPos.count; i++) {
      let vx = rPos.getX(i);
      let vy = rPos.getY(i);
      let vz = rPos.getZ(i);

      // Taper toward rounded apex (+Y) & broaden smoothly toward concave diaphragmatic base (-Y)
      const apexTaper = vy > 0 ? 1 - 0.56 * Math.pow(vy, 1.45) : 1 + 0.14 * Math.abs(vy);
      vx *= 0.052 * lungScaleX * apexTaper;
      vz *= 0.068 * apexTaper;
      vy *= 0.122;

      // Flatten mediastinal (medial, +X relative to right lung) face
      if (vx > 0.014 * lungScaleX) {
        vx = 0.014 * lungScaleX + (vx - 0.014 * lungScaleX) * 0.45;
      }

      // Concave inferior diaphragmatic dome
      if (vy < -0.088) {
        const rRad = Math.hypot(vx / (0.052 * lungScaleX), vz / 0.068);
        vy += Math.max(0, 1 - rRad * rRad) * 0.022;
      }

      // Subtle anatomical fissures separating 3 lobes (horizontal & oblique fissures)
      const horizFissure = Math.exp(-Math.pow((vy - 0.015) / 0.008, 2)) * (vz > -0.01 ? 1 : 0);
      const obliqueFissure = Math.exp(-Math.pow((vy + vz * 0.75 + 0.018) / 0.009, 2));
      const pinch = 1 - (horizFissure * 0.08 + obliqueFissure * 0.09);
      vx *= pinch;
      vz *= pinch;

      rPos.setXYZ(i, vx, vy, vz);
    }
    rLungGeo.computeVertexNormals();
    addMesh(rightLungGroup, rLungGeo, lungMaterial, 'lungs', sys);

    // Left Lung (+X, slightly narrower, 2 lobes + sculpted Cardiac Notch!)
    const leftLungGroup = new THREE.Group();
    leftLungGroup.name = 'leftLung';
    leftLungGroup.position.set(0.072 * lungScaleX, 1.278, -0.008);
    g.add(leftLungGroup);
    animatedRefs.leftLung = leftLungGroup;

    const lLungGeo = new THREE.SphereGeometry(1, 28, 22);
    const lPos = lLungGeo.attributes.position;
    for (let i = 0; i < lPos.count; i++) {
      let vx = lPos.getX(i);
      let vy = lPos.getY(i);
      let vz = lPos.getZ(i);

      const apexTaper = vy > 0 ? 1 - 0.56 * Math.pow(vy, 1.45) : 1 + 0.12 * Math.abs(vy);
      vx *= 0.047 * lungScaleX * apexTaper;
      vz *= 0.066 * apexTaper;
      vy *= 0.120;

      // Flatten medial face (-X relative to left lung)
      if (vx < -0.012 * lungScaleX) {
        vx = -0.012 * lungScaleX + (vx + 0.012 * lungScaleX) * 0.45;
      }

      // Prominent anatomical CARDIAC NOTCH carved into anterior-medial-inferior surface!
      if (vx < 0.012 && vy < 0.012 && vz > -0.025) {
        const notchFactor =
          Math.exp(-Math.pow((vy + 0.046) / 0.052, 2)) *
          Math.exp(-Math.pow((vz - 0.032) / 0.055, 2));
        vx += notchFactor * 0.030 * lungScaleX;
      }

      // Concave diaphragmatic base
      if (vy < -0.086) {
        const rRad = Math.hypot(vx / (0.047 * lungScaleX), vz / 0.066);
        vy += Math.max(0, 1 - rRad * rRad) * 0.020;
      }

      // Oblique fissure separating superior & inferior lobes
      const oblique = Math.exp(-Math.pow((vy + vz * 0.8 + 0.010) / 0.009, 2));
      vx *= 1 - oblique * 0.09;
      vz *= 1 - oblique * 0.09;

      lPos.setXYZ(i, vx, vy, vz);
    }
    lLungGeo.computeVertexNormals();
    addMesh(leftLungGroup, lLungGeo, lungMaterial, 'lungs', sys);

    // --- 4D. Diaphragm (muscular double-cupola dome beneath lungs) ---
    const diaphragmGroup = new THREE.Group();
    diaphragmGroup.name = 'diaphragm';
    diaphragmGroup.position.set(0, 1.148, -0.008);
    g.add(diaphragmGroup);
    animatedRefs.diaphragm = diaphragmGroup;

    const diaphGeo = new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.48);
    const dPos = diaphGeo.attributes.position;
    for (let i = 0; i < dPos.count; i++) {
      const vx = dPos.getX(i) * (P.ribW * 0.90);
      const vz = dPos.getZ(i) * 0.082;
      let vy = dPos.getY(i) * 0.042;
      // Right cupola (-X) sits slightly higher over the liver; slight central cardiac saddle
      if (vx < 0) vy += 0.009 * Math.sin((Math.abs(vx) / (P.ribW * 0.9)) * Math.PI);
      vy -= 0.006 * Math.exp(-Math.pow(vx / 0.036, 2));
      dPos.setXYZ(i, vx, vy - 0.022, vz);
    }
    diaphGeo.computeVertexNormals();
    addMesh(diaphragmGroup, diaphGeo, diaphragmMaterial, 'diaphragm', sys);

    // Central pearlescent tendon patch on top of diaphragm
    const centralTendonGeo = new THREE.CircleGeometry(0.034, 18);
    centralTendonGeo.rotateX(-Math.PI / 2);
    centralTendonGeo.scale(1.45, 1.0, 0.85);
    addMesh(diaphragmGroup, centralTendonGeo, fasciaMaterial, 'diaphragm', sys, {
      position: [0, 0.017, 0.006],
    });

    // --- 4E. 4-Chamber Sculpted 3D Heart (Hero Organ!) ---
    // Positioned realistically at (0.025, 1.24, 0.032) tilted slightly toward patient's left (+X)
    const heartGroup = new THREE.Group();
    heartGroup.name = 'heartGroup';
    heartGroup.position.set(0.025, 1.24, 0.032);
    heartGroup.rotation.set(0.14, -0.16, -0.32);
    g.add(heartGroup);
    animatedRefs.heartGroup = heartGroup;

    // Ventricles Group (muscular pointed LV + anterior crescentic RV + coronary arteries)
    const ventriclesGroup = new THREE.Group();
    ventriclesGroup.name = 'ventriclesGroup';
    heartGroup.add(ventriclesGroup);
    animatedRefs.ventriclesGroup = ventriclesGroup;

    // Left Ventricle (thick conical muscular chamber forming the cardiac apex)
    const lvGeo = new THREE.SphereGeometry(0.034, 24, 20);
    const lvPos = lvGeo.attributes.position;
    for (let i = 0; i < lvPos.count; i++) {
      let vx = lvPos.getX(i);
      let vy = lvPos.getY(i);
      let vz = lvPos.getZ(i);
      // Taper down toward pointed apex (-Y, slightly +X)
      const apexPinch = vy < 0 ? 1 - 0.54 * Math.pow(-vy / 0.034, 1.4) : 1.0;
      vx = vx * 0.92 * apexPinch + (vy < 0 ? -vy * 0.22 : 0);
      vy *= 1.48;
      vz *= 0.96 * apexPinch;
      lvPos.setXYZ(i, vx, vy, vz);
    }
    lvGeo.computeVertexNormals();
    addMesh(ventriclesGroup, lvGeo, heartVentricleMaterial, 'heart', sys, {
      position: [0.008, -0.014, -0.003],
    });

    // Right Ventricle (anterior-right crescentic muscular chamber tapering to conus arteriosus)
    const rvGeo = new THREE.SphereGeometry(0.028, 20, 16);
    rvGeo.scale(0.86, 1.28, 0.85);
    addMesh(ventriclesGroup, rvGeo, heartVentricleMaterial, 'heart', sys, {
      position: [-0.016, -0.006, 0.012],
      rotation: [0.12, 0.24, 0.22],
    });

    // Left Anterior Descending (LAD) Coronary Artery + Circumflex + Right Coronary streaks!
    const ladCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.002, 0.026, 0.024),
      new THREE.Vector3(0.002, 0.004, 0.035),
      new THREE.Vector3(0.010, -0.024, 0.030),
      new THREE.Vector3(0.016, -0.052, 0.014),
    ]);
    addMesh(
      ventriclesGroup,
      createModulatedTubeGeometry(ladCurve, 16, (u) => THREE.MathUtils.lerp(0.0024, 0.0012, u), 6, 1, 1, true),
      coronaryMaterial,
      'heart',
      sys
    );

    const diagCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.003, 0.002, 0.034),
      new THREE.Vector3(0.020, -0.012, 0.028),
      new THREE.Vector3(0.030, -0.030, 0.015),
    ]);
    addMesh(
      ventriclesGroup,
      createModulatedTubeGeometry(diagCurve, 10, (u) => THREE.MathUtils.lerp(0.0018, 0.0009, u), 6, 1, 1, true),
      coronaryMaterial,
      'heart',
      sys
    );

    const rcaCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.008, 0.024, 0.022),
      new THREE.Vector3(-0.026, 0.008, 0.026),
      new THREE.Vector3(-0.034, -0.016, 0.014),
      new THREE.Vector3(-0.024, -0.032, -0.008),
    ]);
    addMesh(
      ventriclesGroup,
      createModulatedTubeGeometry(rcaCurve, 14, (u) => THREE.MathUtils.lerp(0.0022, 0.0011, u), 6, 1, 1, true),
      coronaryMaterial,
      'heart',
      sys
    );

    // Atria Group (Right & Left Atria + Aortic Root + Pulmonary Trunk)
    const atriaGroup = new THREE.Group();
    atriaGroup.name = 'atriaGroup';
    heartGroup.add(atriaGroup);
    animatedRefs.atriaGroup = atriaGroup;

    // Right Atrium (upper right chamber with scalloped auricle)
    const raGeo = new THREE.SphereGeometry(0.024, 18, 14);
    raGeo.scale(0.95, 1.05, 0.92);
    addMesh(atriaGroup, raGeo, heartAtriaMaterial, 'heart', sys, {
      position: [-0.026, 0.026, 0.002],
    });

    // Left Atrium (upper posterior-left chamber)
    const laGeo = new THREE.SphereGeometry(0.022, 18, 14);
    laGeo.scale(1.08, 0.92, 0.90);
    addMesh(atriaGroup, laGeo, heartAtriaMaterial, 'heart', sys, {
      position: [0.016, 0.030, -0.016],
    });

    // Left Auricle peeking anteriorly
    const aurGeo = new THREE.SphereGeometry(0.012, 12, 10);
    aurGeo.scale(1.1, 0.72, 1.35);
    addMesh(atriaGroup, aurGeo, heartAtriaMaterial, 'heart', sys, {
      position: [0.024, 0.028, 0.008],
    });

    // Aortic Root emerging superiorly from Left Ventricle
    const aorticRootCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.002, 0.018, 0.004),
      new THREE.Vector3(-0.006, 0.046, 0.008),
      new THREE.Vector3(0.002, 0.064, 0.004),
    ]);
    addMesh(
      atriaGroup,
      new THREE.TubeGeometry(aorticRootCurve, 12, 0.0115, 12, false),
      arterialMaterial,
      'heart',
      sys
    );

    // Pulmonary Trunk twisting anteriorly from Right Ventricle & bifurcating
    const pulmTrunkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.012, 0.016, 0.022),
      new THREE.Vector3(0.004, 0.044, 0.020),
      new THREE.Vector3(0.014, 0.056, 0.004),
    ]);
    addMesh(
      atriaGroup,
      new THREE.TubeGeometry(pulmTrunkCurve, 12, 0.010, 12, false),
      pulmonaryTrunkMaterial,
      'heart',
      sys
    );

    const pulmBifCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.034, 0.052, -0.010),
      new THREE.Vector3(0.012, 0.056, 0.002),
      new THREE.Vector3(0.044, 0.050, -0.012),
    ]);
    addMesh(
      atriaGroup,
      new THREE.TubeGeometry(pulmBifCurve, 14, 0.0075, 10, false),
      pulmonaryTrunkMaterial,
      'heart',
      sys
    );

    // --- 4F. Liver (Deep mahogany wedge tucked under right lower ribs at x = -0.055, y = 1.07) ---
    const liverGeo = new THREE.SphereGeometry(1, 26, 20);
    const livPos = liverGeo.attributes.position;
    for (let i = 0; i < livPos.count; i++) {
      let vx = livPos.getX(i); // -1 (far right) -> +1 (left lobe tip)
      let vy = livPos.getY(i);
      let vz = livPos.getZ(i);

      // Wedge taper: bulky on right (-X), sharply tapering into thin left lobe (+X)
      const rightness = THREE.MathUtils.clamp((1 - vx) * 0.5, 0.14, 1.0);
      vx *= isF ? 0.072 : 0.082;
      vy *= 0.052 * Math.pow(rightness, 0.85);
      vz *= 0.050 * Math.pow(rightness, 0.65);

      // Slanted visceral undersurface
      if (vy < 0) {
        vy += vx * 0.24;
      }
      // Smooth convex diaphragmatic dome superiorly
      livPos.setXYZ(i, vx, vy, vz);
    }
    liverGeo.computeVertexNormals();
    addMesh(g, liverGeo, liverMaterial, 'liver', sys, {
      position: [isF ? -0.046 : -0.055, 1.072, 0.022],
      rotation: [0.06, 0.12, -0.14],
    });

    // Emerald Gallbladder tucked under right liver border
    const gbGeo = new THREE.SphereGeometry(0.012, 12, 10);
    gbGeo.scale(0.85, 1.45, 0.85);
    addMesh(g, gbGeo, gallbladderMaterial, 'liver', sys, {
      position: [isF ? -0.042 : -0.048, 1.028, 0.044],
      rotation: [0.35, 0, -0.25],
    });

    // --- 4G. Stomach (J-shaped pinkish-tan pouch on patient left x = 0.052, y = 1.04) ---
    const stomachCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.018, 1.125, 0.006), // Esophageal cardia
      new THREE.Vector3(0.062, 1.095, 0.018), // Superior rounded Fundus
      new THREE.Vector3(0.066, 1.042, 0.032), // Greater curvature Body
      new THREE.Vector3(0.038, 1.008, 0.034), // Pyloric antrum
      new THREE.Vector3(0.004, 1.018, 0.018), // Pyloric sphincter -> Duodenum
    ]);
    const stomachGeo = createModulatedTubeGeometry(
      stomachCurve,
      26,
      (u) => {
        if (u < 0.12) return THREE.MathUtils.lerp(0.009, 0.024, u / 0.12);
        if (u < 0.55) return 0.024 + 0.012 * Math.sin(((u - 0.12) / 0.43) * Math.PI);
        return THREE.MathUtils.lerp(0.026, 0.010, (u - 0.55) / 0.45);
      },
      16,
      1.05,
      0.86,
      true
    );
    addMesh(g, stomachGeo, stomachMaterial, 'stomach', sys);

    // --- 4H. Spleen (Deep purple-crimson oval tucked posterior-left) ---
    const spleenGeo = new THREE.SphereGeometry(0.024, 16, 14);
    spleenGeo.scale(0.68, 1.38, 1.02);
    addMesh(g, spleenGeo, spleenMaterial, 'spleen', sys, {
      position: [isF ? 0.086 : 0.095, 1.070, -0.035],
      rotation: [0.22, -0.35, 0.28],
    });

    // --- 4I. Kidneys (Paired bean-shaped retroperitoneal organs at x = ±0.055, y = 0.99, z = -0.055) ---
    for (const side of [-1, 1]) {
      const kY = side === -1 ? 0.984 : 0.996; // Right kidney slightly lower due to liver
      const kX = side * 0.055;
      const kZ = -0.055;

      // Bean-shaped sculpted kidney
      const beanCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(kX - side * 0.005, kY + 0.032, kZ),
        new THREE.Vector3(kX + side * 0.010, kY, kZ - 0.002),
        new THREE.Vector3(kX - side * 0.005, kY - 0.032, kZ),
      ]);
      const kidneyGeo = createModulatedTubeGeometry(
        beanCurve,
        16,
        (u) => 0.018 * (0.72 + 0.28 * Math.sin(u * Math.PI)),
        12,
        1.15,
        0.78,
        true
      );
      addMesh(g, kidneyGeo, kidneyMaterial, 'kidneys', sys);

      // Golden adrenal cap sitting atop superior pole
      const adrGeo = new THREE.ConeGeometry(0.012, 0.014, 8);
      adrGeo.scale(1.0, 1.0, 0.65);
      addMesh(g, adrGeo, adrenalMaterial, 'kidneys', sys, {
        position: [kX - side * 0.006, kY + 0.044, kZ],
        rotation: [0, 0, side * 0.24],
      });

      // Slender ureter descending retroperitoneally toward pelvis
      const ureterCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(kX - side * 0.006, kY - 0.004, kZ + 0.004),
        new THREE.Vector3(side * 0.038, 0.920, -0.034),
        new THREE.Vector3(side * 0.022, 0.845, 0.012),
      ]);
      addMesh(
        g,
        new THREE.TubeGeometry(ureterCurve, 14, 0.0024, 6, false),
        fasciaMaterial,
        'kidneys',
        sys
      );
    }

    // --- 4J. Intestines (Haustrated Large Colon Frame + Coiled Small Intestine Loops) ---
    const colW = isF ? 0.074 : 0.084;
    const colonCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-colW, 0.865, 0.016),           // Cecum (RLQ)
      new THREE.Vector3(-colW * 1.02, 0.925, 0.008),    // Ascending colon
      new THREE.Vector3(-colW * 0.92, 0.980, 0.022),    // Hepatic flexure
      new THREE.Vector3(-colW * 0.35, 0.970, 0.048),    // Transverse colon right
      new THREE.Vector3(colW * 0.35, 0.974, 0.048),     // Transverse colon left
      new THREE.Vector3(colW * 0.92, 0.985, 0.018),     // Splenic flexure
      new THREE.Vector3(colW * 1.02, 0.920, 0.004),     // Descending colon
      new THREE.Vector3(colW * 0.84, 0.858, 0.016),     // Sigmoid start
      new THREE.Vector3(colW * 0.30, 0.848, 0.006),     // Sigmoid loop
      new THREE.Vector3(0.0, 0.845, -0.022),            // Rectosigmoid
      new THREE.Vector3(0.0, 0.805, -0.028),            // Rectum
    ]);
    // Realistic periodic haustra sacculations along the colon!
    const colonGeo = createModulatedTubeGeometry(
      colonCurve,
      72,
      (u) => 0.0165 * (1 + 0.16 * Math.sin(u * 26 * Math.PI * 2)),
      12,
      1.0,
      1.0,
      true
    );
    addMesh(g, colonGeo, colonMaterial, 'intestines', sys);

    // Tiny appendix curving below cecum
    const appCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-colW, 0.858, 0.016),
      new THREE.Vector3(-colW + 0.012, 0.840, 0.018),
      new THREE.Vector3(-colW + 0.022, 0.842, 0.006),
    ]);
    addMesh(g, new THREE.TubeGeometry(appCurve, 8, 0.0038, 6, false), colonMaterial, 'intestines', sys);

    // Coiled Small Intestine (Jejunum & Ileum) densely filling y = 0.855..0.958
    const smW = colW * 0.68;
    const smallPts = [
      new THREE.Vector3(0.010, 0.958, 0.016),
      new THREE.Vector3(smW * 0.85, 0.952, 0.036),
      new THREE.Vector3(smW * 0.15, 0.942, 0.048),
      new THREE.Vector3(-smW * 0.82, 0.944, 0.038),
      new THREE.Vector3(-smW * 0.45, 0.924, 0.052),
      new THREE.Vector3(smW * 0.78, 0.922, 0.044),
      new THREE.Vector3(smW * 0.35, 0.902, 0.054),
      new THREE.Vector3(-smW * 0.80, 0.904, 0.042),
      new THREE.Vector3(-smW * 0.25, 0.884, 0.054),
      new THREE.Vector3(smW * 0.72, 0.884, 0.042),
      new THREE.Vector3(smW * 0.12, 0.866, 0.048),
      new THREE.Vector3(-smW * 0.68, 0.868, 0.034),
      new THREE.Vector3(-colW * 0.85, 0.868, 0.020), // Ileocecal junction
    ];
    const smallCurve = new THREE.CatmullRomCurve3(smallPts);
    const smallGeo = createModulatedTubeGeometry(
      smallCurve,
      96,
      (u) => 0.0108 * (1 + 0.08 * Math.sin(u * 40 * Math.PI)),
      10,
      1.0,
      1.0,
      true
    );
    addMesh(g, smallGeo, smallIntestineMaterial, 'intestines', sys);
  })();

  // =========================================================================
  // 5. VASCULAR SYSTEM (Arterial Crimson + Venous Sapphire Tree)
  // =========================================================================
  (function buildVascularSystem() {
    const g = systems.vascular;
    const sys = 'vascular';

    // --- 5A. Aorta (Ascending Arch -> Descending Thoracic -> Abdominal -> Iliacs) ---
    const aortaCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.016, 1.274, 0.028),   // Ascending aorta root
      new THREE.Vector3(0.002, 1.326, 0.024),   // Upper ascending aorta
      new THREE.Vector3(0.014, 1.356, 0.002),   // Peak of aortic arch
      new THREE.Vector3(0.026, 1.340, -0.030),  // Posterior arch over left bronchus
      new THREE.Vector3(0.018, 1.260, -0.046),  // Descending thoracic aorta
      new THREE.Vector3(0.012, 1.135, -0.042),  // Aortic hiatus of diaphragm
      new THREE.Vector3(0.008, 1.015, -0.030),  // Abdominal aorta
      new THREE.Vector3(0.004, 0.955, -0.026),  // L4 Bifurcation
    ]);
    const aortaGeo = createModulatedTubeGeometry(
      aortaCurve,
      44,
      (u) => THREE.MathUtils.lerp(0.0112, 0.0082, u),
      12,
      1,
      1,
      true
    );
    addMesh(g, aortaGeo, arterialMaterial, 'aorta', sys);

    // Renal arteries branching cleanly from abdominal aorta to kidneys
    for (const side of [-1, 1]) {
      const renArtCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.008, 0.996, -0.030),
        new THREE.Vector3(side * 0.030, side === -1 ? 0.988 : 0.996, -0.044),
        new THREE.Vector3(side * 0.050, side === -1 ? 0.984 : 0.996, -0.052),
      ]);
      addMesh(g, new THREE.TubeGeometry(renArtCurve, 10, 0.0032, 8, false), arterialMaterial, 'aorta', sys);
    }

    // Bilateral Common Iliac Arteries (bifurcating from L4 aorta)
    for (const side of [-1, 1]) {
      const comIliac = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.004, 0.955, -0.026),
        new THREE.Vector3(side * 0.042, 0.918, -0.020),
        new THREE.Vector3(side * (P.hipX - 0.024), 0.875, 0.004),
      ]);
      addMesh(
        g,
        createModulatedTubeGeometry(comIliac, 14, (u) => THREE.MathUtils.lerp(0.0068, 0.0056, u), 10, 1, 1, true),
        arterialMaterial,
        'aorta',
        sys
      );
    }

    // --- 5B. Carotid Arteries (Bilateral Common -> Internal & External Carotids) ---
    // Brachiocephalic trunk on patient right (-X)
    const brachioTrunk = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.005, 1.352, 0.010),
      new THREE.Vector3(-0.024, 1.396, 0.008),
    ]);
    addMesh(g, new THREE.TubeGeometry(brachioTrunk, 8, 0.0062, 10, false), arterialMaterial, 'carotid_artery', sys);

    for (const side of [-1, 1]) {
      const startPt =
        side === -1
          ? new THREE.Vector3(-0.024, 1.396, 0.008)
          : new THREE.Vector3(0.015, 1.354, 0.002);

      // Common & Internal Carotid ascending into skull base
      const carotidCurve = new THREE.CatmullRomCurve3([
        startPt,
        new THREE.Vector3(side * 0.026, 1.445, 0.008),
        new THREE.Vector3(side * 0.028, 1.525, 0.004), // Carotid bifurcation
        new THREE.Vector3(side * 0.026, 1.595, -0.004),
        new THREE.Vector3(side * 0.020, 1.648, -0.004), // Circle of Willis supply
      ]);
      addMesh(
        g,
        createModulatedTubeGeometry(carotidCurve, 22, (u) => THREE.MathUtils.lerp(0.0048, 0.0026, u), 8, 1, 1, true),
        arterialMaterial,
        'carotid_artery',
        sys
      );

      // External Carotid branching forward toward face/temple
      const extCarotid = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.028, 1.525, 0.004),
        new THREE.Vector3(side * 0.036, 1.575, 0.020),
        new THREE.Vector3(side * 0.044, 1.630, 0.016),
      ]);
      addMesh(
        g,
        createModulatedTubeGeometry(extCarotid, 12, (u) => THREE.MathUtils.lerp(0.0034, 0.0018, u), 8, 1, 1, true),
        arterialMaterial,
        'carotid_artery',
        sys
      );
    }

    // --- 5C. Brachial, Radial & Ulnar Arteries (Subclavian -> Axillary -> Brachial -> Radial/Ulnar) ---
    for (const side of [-1, 1]) {
      const subStart =
        side === -1
          ? new THREE.Vector3(-0.024, 1.396, 0.008)
          : new THREE.Vector3(0.022, 1.348, -0.014);

      const elPt = new THREE.Vector3(side * P.elbowX, P.elbowY, P.elbowZ + 0.008);
      const wrPt = new THREE.Vector3(side * P.wristX, P.wristY, P.wristZ + 0.008);

      // Subclavian -> Axillary -> Brachial
      const brachialCurve = new THREE.CatmullRomCurve3([
        subStart,
        new THREE.Vector3(side * (P.shX * 0.50), 1.426, 0.004), // Arching under clavicle
        new THREE.Vector3(side * (P.shX - 0.016), 1.390, -0.004), // Axillary
        new THREE.Vector3(side * THREE.MathUtils.lerp(P.shX, P.elbowX, 0.45) - side * 0.014, 1.255, 0.004), // Medial brachial
        elPt.clone().add(new THREE.Vector3(-side * 0.004, 0.0, 0.004)), // Cubital fossa bifurcation
      ]);
      addMesh(
        g,
        createModulatedTubeGeometry(brachialCurve, 26, (u) => THREE.MathUtils.lerp(0.0052, 0.0034, u), 8, 1, 1, true),
        arterialMaterial,
        'brachial_radial_artery',
        sys
      );

      // Radial Artery (lateral/thumb side down to wrist radial pulse!)
      const radialCurve = new THREE.CatmullRomCurve3([
        elPt.clone().add(new THREE.Vector3(-side * 0.004, 0.0, 0.004)),
        new THREE.Vector3().lerpVectors(elPt, wrPt, 0.45).add(new THREE.Vector3(side * 0.016, 0, 0.010)),
        wrPt.clone().add(new THREE.Vector3(side * 0.016, -0.005, 0.008)),
        wrPt.clone().add(new THREE.Vector3(side * 0.010, -0.048, 0.012)), // Palmar arch entry
      ]);
      addMesh(
        g,
        createModulatedTubeGeometry(radialCurve, 18, (u) => THREE.MathUtils.lerp(0.0028, 0.0018, u), 8, 1, 1, true),
        arterialMaterial,
        'brachial_radial_artery',
        sys
      );

      // Ulnar Artery (medial forearm -> palmar arch)
      const ulnarCurve = new THREE.CatmullRomCurve3([
        elPt.clone().add(new THREE.Vector3(-side * 0.004, 0.0, 0.004)),
        new THREE.Vector3().lerpVectors(elPt, wrPt, 0.48).add(new THREE.Vector3(-side * 0.014, 0, 0.008)),
        wrPt.clone().add(new THREE.Vector3(-side * 0.012, -0.005, 0.008)),
        wrPt.clone().add(new THREE.Vector3(side * 0.010, -0.048, 0.012)), // Closes palmar arch!
      ]);
      addMesh(
        g,
        createModulatedTubeGeometry(ulnarCurve, 18, (u) => THREE.MathUtils.lerp(0.0026, 0.0017, u), 8, 1, 1, true),
        arterialMaterial,
        'brachial_radial_artery',
        sys
      );
    }

    // --- 5D. Femoral, Popliteal & Tibial Arteries (BOTH legs!) ---
    for (const side of [-1, 1]) {
      const hx = side * P.hipX;
      const kx = side * P.kneeX;
      const ax = side * P.ankleX;

      // External Iliac -> Femoral -> Popliteal -> Posterior Tibial
      const femMainCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * (P.hipX - 0.024), 0.875, 0.004),
        new THREE.Vector3(hx - side * 0.014, 0.815, 0.036),        // Femoral triangle pulse point
        new THREE.Vector3(THREE.MathUtils.lerp(hx, kx, 0.45) - side * 0.018, 0.655, 0.022), // Adductor canal
        new THREE.Vector3(kx - side * 0.004, 0.470, -0.024),       // Popliteal fossa behind knee
        new THREE.Vector3(THREE.MathUtils.lerp(kx, ax, 0.45) - side * 0.004, 0.285, -0.020), // Posterior tibial
        new THREE.Vector3(ax - side * 0.010, 0.078, -0.018),       // Medial malleolus pulse point
        new THREE.Vector3(ax, 0.026, 0.042),                       // Plantar arch
      ]);
      addMesh(
        g,
        createModulatedTubeGeometry(femMainCurve, 38, (u) => THREE.MathUtils.lerp(0.0056, 0.0022, u), 8, 1, 1, true),
        arterialMaterial,
        'femoral_artery',
        sys
      );

      // Profunda Femoris (deep thigh arterial branch)
      const profCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(hx - side * 0.014, 0.800, 0.034),
        new THREE.Vector3(hx + side * 0.006, 0.710, 0.004),
        new THREE.Vector3(THREE.MathUtils.lerp(hx, kx, 0.55) + side * 0.012, 0.595, -0.010),
      ]);
      addMesh(
        g,
        createModulatedTubeGeometry(profCurve, 14, (u) => THREE.MathUtils.lerp(0.0038, 0.0018, u), 7, 1, 1, true),
        arterialMaterial,
        'femoral_artery',
        sys
      );

      // Anterior Tibial -> Dorsalis Pedis (front of shin onto top of foot!)
      const antTibCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(kx - side * 0.002, 0.435, -0.020),
        new THREE.Vector3(THREE.MathUtils.lerp(kx, ax, 0.25) + side * 0.010, 0.365, 0.014),
        new THREE.Vector3(ax + side * 0.004, 0.140, 0.018),
        new THREE.Vector3(ax, 0.056, 0.028),
        new THREE.Vector3(ax, 0.036, 0.095), // Dorsalis pedis pulse point on dorsum of foot
      ]);
      addMesh(
        g,
        createModulatedTubeGeometry(antTibCurve, 22, (u) => THREE.MathUtils.lerp(0.0030, 0.0018, u), 8, 1, 1, true),
        arterialMaterial,
        'femoral_artery',
        sys
      );
    }

    // --- 5E. Vena Cava (Superior & Inferior Vena Cava + Brachiocephalic & Renal Veins) ---
    // Superior Vena Cava entering Right Atrium (-X side of heart)
    const svcCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.024, 1.388, 0.016),
      new THREE.Vector3(-0.022, 1.326, 0.024),
      new THREE.Vector3(-0.008, 1.268, 0.032), // Right atrium entry
    ]);
    addMesh(
      g,
      createModulatedTubeGeometry(svcCurve, 14, () => 0.0096, 10, 1, 1, true),
      venousMaterial,
      'vena_cava',
      sys
    );

    // Inferior Vena Cava ascending right of aorta into inferior Right Atrium
    const ivcCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.018, 0.945, -0.028),
      new THREE.Vector3(-0.020, 1.045, -0.034),
      new THREE.Vector3(-0.022, 1.155, -0.022),
      new THREE.Vector3(-0.008, 1.224, 0.016), // Enters lower Right Atrium
    ]);
    addMesh(
      g,
      createModulatedTubeGeometry(ivcCurve, 24, (u) => THREE.MathUtils.lerp(0.0088, 0.0108, u), 10, 1, 1, true),
      venousMaterial,
      'vena_cava',
      sys
    );

    // Right & Left Brachiocephalic Veins converging into SVC
    const rBrachVein = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.042, 1.422, 0.016),
      new THREE.Vector3(-0.024, 1.388, 0.016),
    ]);
    addMesh(g, new THREE.TubeGeometry(rBrachVein, 8, 0.0068, 8, false), venousMaterial, 'vena_cava', sys);

    const lBrachVein = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.042, 1.422, 0.018),
      new THREE.Vector3(0.006, 1.404, 0.024),
      new THREE.Vector3(-0.024, 1.388, 0.016),
    ]);
    addMesh(g, new THREE.TubeGeometry(lBrachVein, 12, 0.0066, 8, false), venousMaterial, 'vena_cava', sys);

    // Bilateral Renal Veins entering IVC
    for (const side of [-1, 1]) {
      const rvCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.020, 0.992, -0.032),
        new THREE.Vector3(side * 0.022, side === -1 ? 0.986 : 0.996, -0.042),
        new THREE.Vector3(side * 0.050, side === -1 ? 0.984 : 0.996, -0.050),
      ]);
      addMesh(g, new THREE.TubeGeometry(rvCurve, 10, 0.0036, 8, false), venousMaterial, 'vena_cava', sys);
    }

    // --- 5F. Systemic Veins (Jugulars, Arm Cephalic/Basilic, Leg Femoral & Great Saphenous) ---
    for (const side of [-1, 1]) {
      // Internal Jugular Vein descending neck into brachiocephalic junction
      const jugCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.034, 1.635, -0.004),
        new THREE.Vector3(side * 0.036, 1.535, 0.004),
        new THREE.Vector3(side * 0.038, 1.455, 0.012),
        new THREE.Vector3(side * 0.042, 1.422, 0.016),
      ]);
      addMesh(
        g,
        createModulatedTubeGeometry(jugCurve, 18, (u) => THREE.MathUtils.lerp(0.0032, 0.0054, u), 8, 1, 1, true),
        venousMaterial,
        'systemic_veins',
        sys
      );

      // Subclavian -> Axillary -> Basilic Vein (medial arm)
      const elPt = new THREE.Vector3(side * P.elbowX, P.elbowY, P.elbowZ);
      const wrPt = new THREE.Vector3(side * P.wristX, P.wristY, P.wristZ);
      const basilicCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.042, 1.422, 0.016),
        new THREE.Vector3(side * (P.shX * 0.56), 1.420, 0.016),
        new THREE.Vector3(side * (P.shX - 0.012), 1.375, 0.002),
        new THREE.Vector3(side * THREE.MathUtils.lerp(P.shX, P.elbowX, 0.45) - side * 0.022, 1.245, 0.004),
        elPt.clone().add(new THREE.Vector3(-side * 0.018, 0, 0.012)),
        wrPt.clone().add(new THREE.Vector3(-side * 0.016, 0, 0.012)),
      ]);
      addMesh(
        g,
        createModulatedTubeGeometry(basilicCurve, 28, (u) => THREE.MathUtils.lerp(0.0052, 0.0022, u), 8, 1, 1, true),
        venousMaterial,
        'systemic_veins',
        sys
      );

      // Superficial Cephalic Vein (lateral/outer arm)
      const cephCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * (P.shX - 0.018), 1.404, 0.026),
        new THREE.Vector3(side * THREE.MathUtils.lerp(P.shX, P.elbowX, 0.42) + side * 0.024, 1.255, 0.018),
        elPt.clone().add(new THREE.Vector3(side * 0.022, 0, 0.018)),
        wrPt.clone().add(new THREE.Vector3(side * 0.020, 0, 0.014)),
      ]);
      addMesh(
        g,
        createModulatedTubeGeometry(cephCurve, 22, (u) => THREE.MathUtils.lerp(0.0036, 0.0020, u), 8, 1, 1, true),
        venousMaterial,
        'systemic_veins',
        sys
      );

      // Common/External Iliac -> Femoral -> Popliteal Vein (deep leg)
      const hx = side * P.hipX;
      const kx = side * P.kneeX;
      const ax = side * P.ankleX;

      const femVeinCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.018, 0.945, -0.028),
        new THREE.Vector3(side * 0.048, 0.910, -0.014),
        new THREE.Vector3(hx - side * 0.022, 0.815, 0.032),
        new THREE.Vector3(THREE.MathUtils.lerp(hx, kx, 0.48) - side * 0.024, 0.645, 0.016),
        new THREE.Vector3(kx - side * 0.010, 0.468, -0.028),
        new THREE.Vector3(ax - side * 0.014, 0.115, -0.020),
      ]);
      addMesh(
        g,
        createModulatedTubeGeometry(femVeinCurve, 34, (u) => THREE.MathUtils.lerp(0.0064, 0.0024, u), 8, 1, 1, true),
        venousMaterial,
        'systemic_veins',
        sys
      );

      // Great Saphenous Vein (iconic long superficial medial vein from ankle to groin!)
      const saphCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(hx - side * 0.024, 0.805, 0.038),
        new THREE.Vector3(THREE.MathUtils.lerp(hx, kx, 0.45) - side * 0.046, 0.655, 0.020),
        new THREE.Vector3(kx - side * 0.042, 0.465, -0.002),
        new THREE.Vector3(THREE.MathUtils.lerp(kx, ax, 0.5) - side * 0.034, 0.275, 0.008),
        new THREE.Vector3(ax - side * 0.022, 0.088, 0.010),
        new THREE.Vector3(ax - side * 0.012, 0.038, 0.068),
      ]);
      addMesh(
        g,
        createModulatedTubeGeometry(saphCurve, 32, (u) => THREE.MathUtils.lerp(0.0036, 0.0018, u), 7, 1, 1, true),
        venousMaterial,
        'systemic_veins',
        sys
      );
    }
  })();

  // =========================================================================
  // 6. NERVOUS SYSTEM (Glowing Golden-Yellow Spinal Cord, Plexuses & Peripheral Nerves)
  // =========================================================================
  (function buildNervousSystem() {
    const g = systems.nervous;
    const sys = 'nervous';

    // --- 6A. Spinal Cord (inside vertebral canal + Cauda Equina + bilateral nerve root sprigs) ---
    const cordPts = [];
    for (let i = 0; i <= 14; i++) {
      const t = (i / 14) * 0.72; // Down to conus medullaris around L1-L2 (y ≈ 1.02)
      const pt = spineCurve.getPointAt(t);
      // Tucked snugly inside vertebral canal just posterior to vertebral bodies
      cordPts.push(new THREE.Vector3(pt.x, pt.y, pt.z - 0.015));
    }
    const cordCurve = new THREE.CatmullRomCurve3(cordPts);
    const cordGeo = createModulatedTubeGeometry(
      cordCurve,
      36,
      (u) => {
        // Cervical & lumbar physiological enlargements, tapering to conus medullaris
        if (u > 0.88) return THREE.MathUtils.lerp(0.0056, 0.0022, (u - 0.88) / 0.12);
        const cerv = Math.exp(-Math.pow((u - 0.16) / 0.10, 2)) * 0.0014;
        const lumb = Math.exp(-Math.pow((u - 0.80) / 0.10, 2)) * 0.0012;
        return 0.0052 + cerv + lumb;
      },
      10,
      1.15,
      0.88,
      true
    );
    addMesh(g, cordGeo, nerveMaterial, 'spinal_cord', sys);

    // Cauda Equina filaments descending from conus medullaris into sacral canal
    const conusPt = cordPts[cordPts.length - 1];
    for (const dx of [-0.008, -0.003, 0.003, 0.008]) {
      const ceCurve = new THREE.CatmullRomCurve3([
        conusPt.clone(),
        new THREE.Vector3(dx, 0.945, -0.064),
        new THREE.Vector3(dx * 1.4, 0.868, -0.078),
      ]);
      addMesh(g, new THREE.TubeGeometry(ceCurve, 12, 0.0018, 6, false), nerveMaterial, 'spinal_cord', sys);
    }

    // 16 Pairs of bilateral spinal nerve root sprigs (cervical, intercostal, lumbar)
    for (let i = 1; i <= 16; i++) {
      const t = (i / 17) * 0.78;
      const pt = spineCurve.getPointAt(t);
      const isThoracic = i >= 4 && i <= 13;
      const span = isThoracic ? P.ribW * 0.62 : 0.044;
      for (const side of [-1, 1]) {
        const sprigCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, pt.y, pt.z - 0.014),
          new THREE.Vector3(side * span * 0.45, pt.y - 0.008, pt.z - 0.022),
          new THREE.Vector3(side * span, pt.y - 0.022, isThoracic ? pt.z + 0.032 : pt.z + 0.008),
        ]);
        addMesh(
          g,
          createModulatedTubeGeometry(sprigCurve, 10, (u) => THREE.MathUtils.lerp(0.0024, 0.0011, u), 6, 1, 1, true),
          nerveMaterial,
          'spinal_cord',
          sys
        );
      }
    }

    // --- 6B. Brachial Plexus (C5-T1 roots -> trunks/cords -> Median, Ulnar & Radial Nerves) ---
    for (const side of [-1, 1]) {
      const cordJoin = new THREE.Vector3(side * (P.shX * 0.64), 1.418, -0.018);
      const axillaNode = new THREE.Vector3(side * (P.shX - 0.012), 1.380, -0.014);

      // 4 converging cervical/thoracic plexus roots (C5, C6, C7, C8-T1)
      const rootYs = [1.488, 1.466, 1.444, 1.418];
      for (const ry of rootYs) {
        const rCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(side * 0.008, ry, -0.038),
          new THREE.Vector3(side * (P.shX * 0.34), ry - 0.015, -0.026),
          cordJoin,
        ]);
        addMesh(g, new THREE.TubeGeometry(rCurve, 10, 0.0024, 6, false), nerveMaterial, 'brachial_plexus', sys);
      }

      // Plexus trunk cord into axilla
      const trunkCurve = new THREE.CatmullRomCurve3([cordJoin, axillaNode]);
      addMesh(g, new THREE.TubeGeometry(trunkCurve, 8, 0.0034, 7, false), nerveMaterial, 'brachial_plexus', sys);

      const elPt = new THREE.Vector3(side * P.elbowX, P.elbowY, P.elbowZ);
      const wrPt = new THREE.Vector3(side * P.wristX, P.wristY, P.wristZ);

      // Median Nerve (central anterior arm -> carpal tunnel -> palm)
      const medianCurve = new THREE.CatmullRomCurve3([
        axillaNode,
        new THREE.Vector3(side * THREE.MathUtils.lerp(P.shX, P.elbowX, 0.48) - side * 0.008, 1.255, 0.008),
        elPt.clone().add(new THREE.Vector3(-side * 0.004, 0, 0.010)),
        new THREE.Vector3().lerpVectors(elPt, wrPt, 0.5).add(new THREE.Vector3(0, 0, 0.012)),
        wrPt.clone().add(new THREE.Vector3(0, -0.045, 0.014)),
      ]);
      addMesh(
        g,
        createModulatedTubeGeometry(medianCurve, 26, (u) => THREE.MathUtils.lerp(0.0028, 0.0015, u), 7, 1, 1, true),
        nerveMaterial,
        'brachial_plexus',
        sys
      );

      // Ulnar Nerve (medial arm -> behind medial epicondyle -> medial hand)
      const ulnarNerve = new THREE.CatmullRomCurve3([
        axillaNode,
        new THREE.Vector3(side * THREE.MathUtils.lerp(P.shX, P.elbowX, 0.52) - side * 0.020, 1.245, -0.008),
        elPt.clone().add(new THREE.Vector3(-side * 0.022, 0, -0.012)), // Funny bone groove!
        new THREE.Vector3().lerpVectors(elPt, wrPt, 0.5).add(new THREE.Vector3(-side * 0.016, 0, 0.002)),
        wrPt.clone().add(new THREE.Vector3(-side * 0.016, -0.042, 0.008)),
      ]);
      addMesh(
        g,
        createModulatedTubeGeometry(ulnarNerve, 26, (u) => THREE.MathUtils.lerp(0.0026, 0.0014, u), 7, 1, 1, true),
        nerveMaterial,
        'brachial_plexus',
        sys
      );

      // Radial Nerve (spiraling posteriorly around humerus -> lateral forearm)
      const radialNerve = new THREE.CatmullRomCurve3([
        axillaNode,
        new THREE.Vector3(side * THREE.MathUtils.lerp(P.shX, P.elbowX, 0.42), 1.280, -0.026), // Spiral groove
        elPt.clone().add(new THREE.Vector3(side * 0.020, 0.012, -0.004)),
        new THREE.Vector3().lerpVectors(elPt, wrPt, 0.5).add(new THREE.Vector3(side * 0.020, 0, -0.006)),
        wrPt.clone().add(new THREE.Vector3(side * 0.018, -0.015, -0.006)),
      ]);
      addMesh(
        g,
        createModulatedTubeGeometry(radialNerve, 26, (u) => THREE.MathUtils.lerp(0.0027, 0.0014, u), 7, 1, 1, true),
        nerveMaterial,
        'brachial_plexus',
        sys
      );
    }

    // --- 6C. Sciatic & Femoral Nerves (Lumbar/Sacral Plexus down BOTH legs!) ---
    for (const side of [-1, 1]) {
      const hx = side * P.hipX;
      const kx = side * P.kneeX;
      const ax = side * P.ankleX;

      // Lumbosacral plexus rootlets converging into thick Sciatic trunk
      for (const ry of [0.955, 0.925, 0.895]) {
        const plexCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(side * 0.012, ry, -0.058),
          new THREE.Vector3(side * 0.054, ry - 0.026, -0.052),
          new THREE.Vector3(hx - side * 0.014, 0.835, -0.048),
        ]);
        addMesh(g, new THREE.TubeGeometry(plexCurve, 10, 0.0028, 6, false), nerveMaterial, 'sciatic_femoral_nerve', sys);
      }

      // Thick Posterior Sciatic Nerve -> Tibial Nerve all the way down calf to sole!
      const sciaticCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(hx - side * 0.014, 0.835, -0.048), // Greater sciatic notch
        new THREE.Vector3(THREE.MathUtils.lerp(hx, kx, 0.35), 0.705, -0.036),
        new THREE.Vector3(THREE.MathUtils.lerp(hx, kx, 0.72), 0.555, -0.032), // Sciatic bifurcation
        new THREE.Vector3(kx, 0.462, -0.028), // Tibial nerve through popliteal fossa
        new THREE.Vector3(THREE.MathUtils.lerp(kx, ax, 0.5), 0.275, -0.026),
        new THREE.Vector3(ax - side * 0.012, 0.072, -0.024),
        new THREE.Vector3(ax, 0.024, 0.036),
      ]);
      addMesh(
        g,
        createModulatedTubeGeometry(
          sciaticCurve,
          38,
          (u) => (u < 0.42 ? THREE.MathUtils.lerp(0.0054, 0.0042, u / 0.42) : THREE.MathUtils.lerp(0.0036, 0.0018, (u - 0.42) / 0.58)),
          8,
          1.15,
          0.85,
          true
        ),
        nerveMaterial,
        'sciatic_femoral_nerve',
        sys
      );

      // Common Fibular (Peroneal) Nerve wrapping laterally around fibular neck down outer shin
      const fibNerveCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(THREE.MathUtils.lerp(hx, kx, 0.72), 0.555, -0.032),
        new THREE.Vector3(kx + side * 0.030, 0.445, -0.014), // Wraps fibular head
        new THREE.Vector3(THREE.MathUtils.lerp(kx, ax, 0.42) + side * 0.026, 0.295, 0.014),
        new THREE.Vector3(ax + side * 0.014, 0.095, 0.020),
        new THREE.Vector3(ax + side * 0.008, 0.034, 0.095),
      ]);
      addMesh(
        g,
        createModulatedTubeGeometry(fibNerveCurve, 24, (u) => THREE.MathUtils.lerp(0.0030, 0.0015, u), 7, 1, 1, true),
        nerveMaterial,
        'sciatic_femoral_nerve',
        sys
      );

      // Anterior Femoral Nerve (from Lumbar plexus down anterior thigh + saphenous branch)
      const femoralNerveCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.014, 0.995, -0.048),
        new THREE.Vector3(side * 0.068, 0.915, -0.010),
        new THREE.Vector3(hx + side * 0.002, 0.822, 0.036), // Lateral to femoral artery
        new THREE.Vector3(THREE.MathUtils.lerp(hx, kx, 0.45) + side * 0.004, 0.655, 0.034),
        new THREE.Vector3(kx - side * 0.024, 0.475, 0.022), // Saphenous cutaneous continuation
        new THREE.Vector3(ax - side * 0.018, 0.145, 0.014),
      ]);
      addMesh(
        g,
        createModulatedTubeGeometry(femoralNerveCurve, 30, (u) => THREE.MathUtils.lerp(0.0036, 0.0015, u), 7, 1, 1, true),
        nerveMaterial,
        'sciatic_femoral_nerve',
        sys
      );
    }
  })();

  // =========================================================================
  // 7. AXIAL SLICE PLANE (Sleek Horizontal Glowing Cyan Scanning Ring + Laser Disc)
  // =========================================================================
  const slicePlane = new THREE.Group();
  slicePlane.name = 'axial_slice_plane';
  slicePlane.position.set(0, 1.18, 0);
  slicePlane.userData = { isSlicePlane: true };

  // Outer glowing cyan elliptical scanning ring (width ~0.82, depth ~0.48 -> rx=0.41, rz=0.24)
  const ringPts = [];
  const ringSegs = 64;
  for (let i = 0; i < ringSegs; i++) {
    const a = (i / ringSegs) * Math.PI * 2;
    ringPts.push(new THREE.Vector3(Math.cos(a) * 0.41, 0, Math.sin(a) * 0.24));
  }
  const sliceRingCurve = new THREE.CatmullRomCurve3(ringPts, true);
  const sliceRingGeo = trackGeo(new THREE.TubeGeometry(sliceRingCurve, 72, 0.0055, 10, true));
  const sliceRingMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x06b6d4,
      emissiveIntensity: 1.45,
      roughness: 0.15,
      metalness: 0.2,
    })
  );
  const sliceRingMesh = new THREE.Mesh(sliceRingGeo, sliceRingMat);
  sliceRingMesh.name = 'slice_laser_ring';
  slicePlane.add(sliceRingMesh);
  animatedRefs.sliceLaserRing = sliceRingMesh;

  // Inner subtle precision calibration halo
  const innerRingPts = [];
  for (let i = 0; i < ringSegs; i++) {
    const a = (i / ringSegs) * Math.PI * 2;
    innerRingPts.push(new THREE.Vector3(Math.cos(a) * 0.37, 0, Math.sin(a) * 0.215));
  }
  const innerRingCurve = new THREE.CatmullRomCurve3(innerRingPts, true);
  const innerRingGeo = trackGeo(new THREE.TubeGeometry(innerRingCurve, 64, 0.002, 6, true));
  const innerRingMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    })
  );
  slicePlane.add(new THREE.Mesh(innerRingGeo, innerRingMat));

  // 4 Cardinal CT/MRI alignment ticks
  const tickGeo = trackGeo(new THREE.BoxGeometry(0.032, 0.003, 0.006));
  const tickSpecs = [
    { pos: [0.425, 0, 0], rotY: 0 },
    { pos: [-0.425, 0, 0], rotY: 0 },
    { pos: [0, 0, 0.255], rotY: Math.PI / 2 },
    { pos: [0, 0, -0.255], rotY: Math.PI / 2 },
  ];
  for (const tk of tickSpecs) {
    const tick = new THREE.Mesh(tickGeo, sliceRingMat);
    tick.position.set(...tk.pos);
    tick.rotation.y = tk.rotY;
    slicePlane.add(tick);
  }

  // Semi-transparent glowing cyan laser disc
  const discGeo = trackGeo(new THREE.CircleGeometry(1, 64));
  discGeo.rotateX(-Math.PI / 2);
  discGeo.scale(0.408, 1, 0.238);
  const discMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      map: sliceDiscTex,
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  const discMesh = new THREE.Mesh(discGeo, discMat);
  discMesh.name = 'slice_laser_disc';
  discMesh.renderOrder = 15;
  slicePlane.add(discMesh);
  animatedRefs.sliceDiscMaterial = discMat;

  // Add slicePlane to rootGroup (explicitly excluded from clickableMeshes!)
  rootGroup.add(slicePlane);

  // =========================================================================
  // 8. Thorough Memory Cleanup (dispose)
  // =========================================================================
  function dispose() {
    rootGroup.traverse((obj) => {
      if (obj.isMesh) {
        if (obj.geometry) trackedGeometries.add(obj.geometry);
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => trackedMaterials.add(m));
          } else {
            trackedMaterials.add(obj.material);
          }
        }
      }
    });

    trackedTextures.forEach((tex) => {
      if (tex && typeof tex.dispose === 'function') tex.dispose();
    });
    trackedMaterials.forEach((mat) => {
      if (mat && typeof mat.dispose === 'function') mat.dispose();
    });
    trackedGeometries.forEach((geo) => {
      if (geo && typeof geo.dispose === 'function') geo.dispose();
    });

    trackedTextures.clear();
    trackedMaterials.clear();
    trackedGeometries.clear();
    clickableMeshes.length = 0;
  }

  return {
    rootGroup,
    systems,
    slicePlane,
    clickableMeshes,
    animatedRefs,
    dispose,
  };
}
