import React, { useEffect, useRef, useState } from 'react';
import { Scan, Tag, ZoomIn, ZoomOut, Eye, AlertTriangle, User } from 'lucide-react';
import { ANATOMY_LAYERS, ANATOMY_MAP, BODY_REGIONS } from '../data/anatomyDatabase';
import { computeArterialWave, CAT_OCCLUSION_MMHG } from '../engines/PhysiologyEngine';

const LOGICAL_W = 880;
const LOGICAL_H = 510;
const PIVOT_X = 770;
const PIVOT_Y = 262;
const WOUND_X = 435;
const WOUND_Y = 262;

function mulberry32(seed) {
  let a = seed;
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Precompute deterministic organic fat lobules & skin hairs once (zero flicker)
const rng = mulberry32(202611);
const FAT_LOBULES = Array.from({ length: 68 }, (_, i) => {
  const angle = (i / 68) * Math.PI * 2 + (rng() - 0.5) * 0.08;
  const rx = 100 + (rng() - 0.5) * 14;
  const ry = 52 + (rng() - 0.5) * 10;
  return {
    x: Math.cos(angle) * rx,
    y: Math.sin(angle) * ry,
    r: 6.2 + rng() * 5.0,
    shade: rng(),
  };
});

const SKIN_HAIRS = Array.from({ length: 145 }, () => ({
  x: 115 + rng() * 675,
  y: 148 + rng() * 224,
  len: 3 + rng() * 5.5,
  ang: -0.38 + (rng() - 0.5) * 0.36,
}));

const CALLOUT_PINS = [
  { id: 'epidermis', label: 'אפידרמיס', tx: 326, ty: 222, lx: 120, ly: 86 },
  { id: 'dermis', label: 'דרמיס', tx: 368, ty: 204, lx: 238, ly: 74 },
  { id: 'fascia', label: 'פאשיה', tx: 405, ty: 220, lx: 350, ly: 56 },
  { id: 'artery', label: 'עורק פועם', tx: 448, ty: 239, lx: 565, ly: 74 },
  { id: 'capillaries', label: 'נימים', tx: 486, ty: 210, lx: 690, ly: 86 },

  { id: 'subcutaneous', label: 'שומן תת-עורי', tx: 356, ty: 306, lx: 125, ly: 438 },
  { id: 'muscle', label: 'שרירים', tx: 398, ty: 296, lx: 268, ly: 446 },
  { id: 'tendon', label: 'גידים לבנים', tx: 438, ty: 263, lx: 418, ly: 446 },
  { id: 'nerve', label: 'עצב היקפי', tx: 465, ty: 277, lx: 564, ly: 446 },
  { id: 'vein', label: 'וריד', tx: 492, ty: 288, lx: 696, ly: 438 },
];

/**
 * src/components/AnatomyMacroView.jsx
 * חלון תקריב אנטומי ברזולוציה גבוהה (HTML5 Canvas מתקדם):
 * - 10 שכבות מלאות: אפידרמיס, דרמיס, שומן תת-עורי, פאשיה, שריר, גידים לבנים, עצב, נימים, וריד ועורק פועם
 * - פיזיקת חלקיקי התזה עורקית בסיסטולה + זרימה ורידית כהה + רשת קרישת פיברין
 * - לחץ ישיר אינטראקטיבי בלחיצה ממושכת והנחת חוסם עורקים CAT במיקום אנטומי מדויק
 */
export default function AnatomyMacroView({
  gender,
  bodyRegionId,
  physiologyRef,
  interventionsRef,
  interventions,
  scenario,
  mode,
  selectedLayerId,
  onSelectLayer,
  onOpenXRay,
  onSwitchToFullBody,
  onCanvasPressChange,
  onAttemptCatPlacement,
  onAdjustWindlass,
  onStampCatTime,
  toast,
}) {
  const canvasRef = useRef(null);
  const [showLabels, setShowLabels] = useState(true);
  const [zoomed, setZoomed] = useState(false);
  const [hoveredLayer, setHoveredLayer] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const viewStateRef = useRef({
    showLabels: true,
    zoomed: false,
    zoomLevel: 1.0,
    elevationAngle: 0,
    hoveredLayer: null,
    selectedLayerId: null,
    particles: [],
    rivulets: [],
    lastDisruptions: 0,
  });

  useEffect(() => {
    viewStateRef.current.showLabels = showLabels;
  }, [showLabels]);

  useEffect(() => {
    viewStateRef.current.zoomed = zoomed;
  }, [zoomed]);

  useEffect(() => {
    viewStateRef.current.selectedLayerId = selectedLayerId;
  }, [selectedLayerId]);

  // Reset fluid particles on scenario change
  useEffect(() => {
    viewStateRef.current.particles = [];
    viewStateRef.current.rivulets = [];
    viewStateRef.current.lastDisruptions = 0;
  }, [scenario.id]);

  // Coordinate helpers
  function getFitTransform(canvas) {
    const sx = canvas.width / LOGICAL_W;
    const sy = canvas.height / LOGICAL_H;
    const scaleFit = Math.min(sx, sy);
    const offsetX = (canvas.width - LOGICAL_W * scaleFit) * 0.5;
    const offsetY = (canvas.height - LOGICAL_H * scaleFit) * 0.5;
    return { scaleFit, offsetX, offsetY };
  }

  function screenToForearmLocal(clientX, clientY) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const dprX = (clientX - rect.left) * (canvas.width / rect.width);
    const dprY = (clientY - rect.top) * (canvas.height / rect.height);
    const { scaleFit, offsetX, offsetY } = getFitTransform(canvas);

    let lx = (dprX - offsetX) / scaleFit;
    let ly = (dprY - offsetY) / scaleFit;

    const z = viewStateRef.current.zoomLevel;
    lx = (lx - LOGICAL_W * 0.5) / z + WOUND_X + (LOGICAL_W * 0.5 - WOUND_X) / z;
    ly = (ly - LOGICAL_H * 0.5) / z + WOUND_Y + (LOGICAL_H * 0.5 - WOUND_Y) / z;

    const dx = lx - PIVOT_X;
    const dy = ly - PIVOT_Y;
    const ang = -viewStateRef.current.elevationAngle;
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    return {
      x: PIVOT_X + dx * cos - dy * sin,
      y: PIVOT_Y + dx * sin + dy * cos,
    };
  }

  function hitTestCalloutPill(fx, fy) {
    if (!viewStateRef.current.showLabels || interventionsRef.current.personalBandageOn) return null;
    for (const p of CALLOUT_PINS) {
      if (Math.abs(fx - p.lx) < 52 && Math.abs(fy - p.ly) < 16) return p.id;
    }
    return null;
  }

  function hitTestLayer(fx, fy) {
    const ang = 0.085;
    const rx = (fx - WOUND_X) * Math.cos(ang) - (fy - WOUND_Y) * Math.sin(ang);
    const ry = (fx - WOUND_X) * Math.sin(ang) + (fy - WOUND_Y) * Math.cos(ang);

    const outer = (rx * rx) / (122 * 122) + (ry * ry) / (70 * 70);
    if (outer > 1.2) {
      if (fx > 110 && fx < 825 && fy > 158 && fy < 368) return 'epidermis';
      return null;
    }

    // Specific internal structures front-to-back
    if (Math.abs(rx) < 88 && Math.abs(ry - (-22 + Math.sin(rx * 0.024) * 2.5)) < 10.5) return 'artery';
    if (Math.abs(rx) < 86 && Math.abs(ry - (25 + Math.cos(rx * 0.024) * 2.5)) < 11) return 'vein';
    if (Math.abs(rx) < 86 && Math.abs(ry - 13) < 6) return 'nerve';
    if (Math.abs(rx) < 86 && (Math.abs(ry + 5) < 6 || Math.abs(ry - 4) < 5)) return 'tendon';

    const muscleEll = (rx * rx) / (86 * 86) + (ry * ry) / (41 * 41);
    if (muscleEll <= 1.0) return 'muscle';

    const fasciaEll = (rx * rx) / (93 * 93) + (ry * ry) / (46 * 46);
    if (fasciaEll <= 1.0) return 'fascia';

    const fatEll = (rx * rx) / (105 * 105) + (ry * ry) / (55 * 55);
    if (fatEll <= 1.0) return 'subcutaneous';

    const dermEll = (rx * rx) / (115 * 115) + (ry * ry) / (63 * 63);
    if (dermEll <= 1.0) {
      if ((rx > 15 && ry < -26) || (rx < -15 && ry > 26)) return 'capillaries';
      return 'dermis';
    }
    return 'epidermis';
  }

  // Main Canvas Animation & Rendering Effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = Math.max(320, Math.floor(rect.width * dpr));
      canvas.height = Math.max(240, Math.floor(rect.height * dpr));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement);

    let rafId = 0;
    let lastTs = 0;
    let animTime = 0;

    function traceWoundPath(rx, ry) {
      ctx.beginPath();
      ctx.moveTo(-rx, 0);
      ctx.bezierCurveTo(-rx * 0.72, -ry * 0.95, -rx * 0.25, -ry * 1.06, 0, -ry);
      ctx.bezierCurveTo(rx * 0.3, -ry * 1.04, rx * 0.74, -ry * 0.9, rx, 0);
      ctx.bezierCurveTo(rx * 0.72, ry * 0.92, rx * 0.28, ry * 1.06, 0, ry);
      ctx.bezierCurveTo(-rx * 0.28, ry * 1.04, -rx * 0.72, ry * 0.94, -rx, 0);
      ctx.closePath();
    }

    function forearmToWorld(fx, fy) {
      const ang = viewStateRef.current.elevationAngle;
      const cos = Math.cos(ang);
      const sin = Math.sin(ang);
      const dx = fx - PIVOT_X;
      const dy = fy - PIVOT_Y;
      return { x: PIVOT_X + dx * cos - dy * sin, y: PIVOT_Y + dx * sin + dy * cos };
    }

    function spawnAndUpdateParticles(dt, phys, interv) {
      const vs = viewStateRef.current;
      const wave = computeArterialWave(phys.pulsePhase);

      // Burst visual particles when a fragile clot shatters!
      if (phys.clotDisruptions > vs.lastDisruptions) {
        vs.lastDisruptions = phys.clotDisruptions;
        const burstOrigin = forearmToWorld(WOUND_X, WOUND_Y);
        for (let i = 0; i < 28; i++) {
          const ang = -Math.PI * 0.85 + Math.random() * Math.PI * 0.7;
          const spd = 90 + Math.random() * 190;
          vs.particles.push({
            type: 'clot_burst',
            x: burstOrigin.x + (Math.random() - 0.5) * 20,
            y: burstOrigin.y + (Math.random() - 0.5) * 10,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            r: 2.8 + Math.random() * 2.5,
            life: 0,
            maxLife: 0.75 + Math.random() * 0.4,
          });
        }
      }

      // Arterial systolic jet
      if (phys.arterialRate > 0.25) {
        const origin = forearmToWorld(WOUND_X - 5, WOUND_Y - 22);
        const strength = Math.min(1.4, phys.arterialRate / 15.0);
        const pulsePower = 0.16 + Math.pow(wave, 1.45) * 1.4;
        const count = Math.floor(pulsePower * strength * 92 * dt + Math.random());
        const covered = interv.gauzeLayers > 0 || interv.personalBandageOn;
        for (let i = 0; i < count; i++) {
          const baseAng = covered
            ? -Math.PI * 0.5 + (Math.random() - 0.5) * 2.4
            : -Math.PI * 0.53 + (Math.random() - 0.5) * 0.26;
          const speed = covered
            ? (24 + Math.random() * 52) * strength * (0.4 + wave * 0.6)
            : (148 + wave * 255 + Math.random() * 60) * Math.max(0.45, strength);
          vs.particles.push({
            type: 'arterial',
            x: origin.x + (Math.random() - 0.5) * (covered ? 24 : 5),
            y: origin.y + (Math.random() - 0.5) * (covered ? 14 : 4),
            vx: Math.cos(baseAng) * speed,
            vy: Math.sin(baseAng) * speed,
            r: covered ? 1.8 + Math.random() * 2 : 2.1 + wave * 2.2 + Math.random() * 1.3,
            life: 0,
            maxLife: covered ? 0.42 + Math.random() * 0.4 : 0.72 + Math.random() * 0.6,
          });
        }
      }

      // Venous dark continuous flow
      if (phys.venousRate > 0.2) {
        const origin = forearmToWorld(WOUND_X + 14, WOUND_Y + 24);
        const strength = Math.min(1.3, phys.venousRate / 10.0);
        const count = Math.floor(strength * 40 * dt + Math.random() * 0.8);
        for (let i = 0; i < count; i++) {
          vs.particles.push({
            type: 'venous',
            x: origin.x + (Math.random() - 0.5) * 18,
            y: origin.y + (Math.random() - 0.5) * 8,
            vx: (Math.random() - 0.5) * 26,
            vy: 15 + Math.random() * 34 * strength,
            r: 2.6 + Math.random() * 2.3,
            life: 0,
            maxLife: 0.72 + Math.random() * 0.62,
          });
        }
      }

      // Skin blood rivulets
      if (phys.totalBleedRate > 1.2 && Math.random() < dt * Math.min(4.2, phys.totalBleedRate * 0.24)) {
        if (vs.rivulets.length < 32) {
          vs.rivulets.push({
            fx: WOUND_X - 54 + Math.random() * 112,
            fy: WOUND_Y + 44 + Math.random() * 10,
            len: 7,
            maxLen: 46 + Math.random() * 64,
            width: 2.1 + Math.random() * 2.2,
            speed: 14 + Math.random() * 20,
            type: phys.arterialRate > phys.venousRate ? 'arterial' : 'venous',
            alpha: 0.86,
          });
        }
      }

      // Integrate particle physics
      const g = 520;
      for (let i = vs.particles.length - 1; i >= 0; i--) {
        const p = vs.particles[i];
        p.life += dt;
        if (p.life >= p.maxLife || p.y > LOGICAL_H + 15) {
          vs.particles.splice(i, 1);
          continue;
        }
        p.vy += (p.type === 'venous' ? g * 0.3 : g) * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }

      for (let i = vs.rivulets.length - 1; i >= 0; i--) {
        const r = vs.rivulets[i];
        if (r.len < r.maxLen && !phys.bleedingStopped) {
          r.len += r.speed * dt;
        } else if (phys.bleedingStopped) {
          r.alpha = Math.max(0.24, r.alpha - dt * 0.04);
        }
      }
    }

    function drawCapillaryTree(x, y, rot, scale, stopped) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.scale(scale, scale);
      ctx.strokeStyle = 'rgba(225, 29, 72, 0.8)';
      ctx.lineCap = 'round';
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(-16, 0);
      ctx.quadraticCurveTo(-4, -3, 16, 2);
      ctx.moveTo(-5, -1);
      ctx.quadraticCurveTo(2, -9, 11, -10);
      ctx.moveTo(2, 0);
      ctx.quadraticCurveTo(9, 7, 15, 9);
      ctx.moveTo(-10, -1);
      ctx.quadraticCurveTo(-6, 6, 0, 8);
      ctx.stroke();
      if (!stopped) {
        ctx.fillStyle = 'rgba(244, 63, 94, 0.58)';
        ctx.beginPath();
        ctx.arc(6, -2, 2.2 + Math.sin(animTime * 2 + x) * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    function drawTendon(yCenter, thickness) {
      ctx.save();
      ctx.strokeStyle = 'rgba(35, 5, 8, 0.55)';
      ctx.lineWidth = thickness + 3;
      ctx.beginPath();
      ctx.moveTo(-90, yCenter + 2.2);
      ctx.bezierCurveTo(-30, yCenter + 1, 30, yCenter + 3.5, 90, yCenter + 1.5);
      ctx.stroke();

      const tGrad = ctx.createLinearGradient(0, yCenter - thickness, 0, yCenter + thickness);
      tGrad.addColorStop(0, '#c8c0b4');
      tGrad.addColorStop(0.35, '#fbf9f4');
      tGrad.addColorStop(0.7, '#e2dbd0');
      tGrad.addColorStop(1, '#a89f92');
      ctx.strokeStyle = tGrad;
      ctx.lineWidth = thickness;
      ctx.beginPath();
      ctx.moveTo(-90, yCenter);
      ctx.bezierCurveTo(-30, yCenter - 1.5, 30, yCenter + 1.5, 90, yCenter - 0.5);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 1.05;
      ctx.beginPath();
      ctx.moveTo(-88, yCenter - thickness * 0.2);
      ctx.bezierCurveTo(-30, yCenter - 2.1, 30, yCenter + 0.8, 88, yCenter - 1.2);
      ctx.stroke();
      ctx.restore();
    }

    function drawPeripheralNerve(yCenter) {
      ctx.save();
      // Subtle shadow
      ctx.strokeStyle = 'rgba(30, 8, 10, 0.52)';
      ctx.lineWidth = 7.4;
      ctx.beginPath();
      ctx.moveTo(-90, yCenter + 1.8);
      ctx.bezierCurveTo(-25, yCenter + 4, 25, yCenter - 2.5, 90, yCenter + 1.5);
      ctx.stroke();

      // Creamy yellow fasciculated nerve cord
      const nGrad = ctx.createLinearGradient(0, yCenter - 5, 0, yCenter + 5);
      nGrad.addColorStop(0, '#ca9a1e');
      nGrad.addColorStop(0.35, '#fef08a');
      nGrad.addColorStop(0.7, '#facc15');
      nGrad.addColorStop(1, '#92670d');
      ctx.strokeStyle = nGrad;
      ctx.lineWidth = 5.2;
      ctx.beginPath();
      ctx.moveTo(-90, yCenter);
      ctx.bezierCurveTo(-25, yCenter + 2.5, 25, yCenter - 3.5, 90, yCenter);
      ctx.stroke();

      // Fine red epineurial vasa nervorum vessel along nerve sheath
      ctx.strokeStyle = 'rgba(220, 38, 38, 0.48)';
      ctx.lineWidth = 0.9;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(-84, yCenter - 0.8);
      ctx.bezierCurveTo(-25, yCenter + 1.8, 25, yCenter - 4.2, 84, yCenter - 0.8);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    function renderFrame(ts) {
      rafId = requestAnimationFrame(renderFrame);
      if (!lastTs) lastTs = ts;
      const dt = Math.min(0.05, (ts - lastTs) / 1000);
      lastTs = ts;
      animTime += dt;

      const phys = physiologyRef.current;
      const interv = interventionsRef.current;
      const vs = viewStateRef.current;
      if (!phys || !interv) return;

      // Smooth elevation & zoom
      const targetElev = interv.elevated ? 0.3 : 0;
      vs.elevationAngle += (targetElev - vs.elevationAngle) * Math.min(1, dt * 5);
      const targetZoom = vs.zoomed ? 1.5 : 1.0;
      vs.zoomLevel += (targetZoom - vs.zoomLevel) * Math.min(1, dt * 6);

      spawnAndUpdateParticles(dt, phys, interv);

      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Clinical dark stage background
      const bgGrad = ctx.createRadialGradient(
        canvas.width * 0.5,
        canvas.height * 0.5,
        35,
        canvas.width * 0.5,
        canvas.height * 0.5,
        canvas.width * 0.72
      );
      bgGrad.addColorStop(0, '#132038');
      bgGrad.addColorStop(1, '#060b16');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const { scaleFit, offsetX, offsetY } = getFitTransform(canvas);
      ctx.translate(offsetX, offsetY);
      ctx.scale(scaleFit, scaleFit);

      // Medical grid
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.045)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx <= LOGICAL_W; gx += 40) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, LOGICAL_H);
        ctx.stroke();
      }
      for (let gy = 0; gy <= LOGICAL_H; gy += 40) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(LOGICAL_W, gy);
        ctx.stroke();
      }

      // Smooth Zoom around wound
      const z = vs.zoomLevel;
      ctx.save();
      ctx.translate(LOGICAL_W * 0.5, LOGICAL_H * 0.5);
      ctx.scale(z, z);
      ctx.translate(
        -(WOUND_X + (LOGICAL_W * 0.5 - WOUND_X) / z),
        -(WOUND_Y + (LOGICAL_H * 0.5 - WOUND_Y) / z)
      );

      // Heart-level dashed reference line when elevated
      if (vs.elevationAngle > 0.04) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, vs.elevationAngle * 3.6);
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.58)';
        ctx.setLineDash([7, 6]);
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(38, 294);
        ctx.lineTo(842, 294);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#6ee7b7';
        ctx.font = 'bold 12px "Segoe UI", Arial';
        ctx.textAlign = 'left';
        ctx.fillText('❤️ קו גובה הלב — הגפה מורמת (הפחתת לחץ הידרוסטטי)', 48, 312);
        ctx.restore();
      }

      // Proximal / Distal outward vector arrows
      if (!vs.zoomed) {
        ctx.save();
        ctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.8)';
        ctx.lineWidth = 1.6;
        ctx.font = 'bold 12px "Segoe UI", Arial';
        ctx.textBaseline = 'middle';
        const ry = LOGICAL_H - 18;

        ctx.textAlign = 'right';
        ctx.fillText('לכיוון המרפק והלב (פרוקסימלי)', LOGICAL_W - 44, ry);
        ctx.beginPath();
        ctx.moveTo(LOGICAL_W - 38, ry);
        ctx.lineTo(LOGICAL_W - 18, ry);
        ctx.moveTo(LOGICAL_W - 24, ry - 4.5);
        ctx.lineTo(LOGICAL_W - 18, ry);
        ctx.lineTo(LOGICAL_W - 24, ry + 4.5);
        ctx.stroke();

        ctx.textAlign = 'left';
        ctx.fillText('לכיוון שורש כף היד (דיסטלי)', 44, ry);
        ctx.beginPath();
        ctx.moveTo(38, ry);
        ctx.lineTo(18, ry);
        ctx.moveTo(24, ry - 4.5);
        ctx.lineTo(18, ry);
        ctx.lineTo(24, ry + 4.5);
        ctx.stroke();
        ctx.restore();
      }

      // ========= FOREARM LOCAL SPACE =========
      ctx.save();
      ctx.translate(PIVOT_X, PIVOT_Y);
      ctx.rotate(vs.elevationAngle);
      ctx.translate(-PIVOT_X, -PIVOT_Y);

      // 1. Forearm shadow + intact sculpted volar forearm silhouette
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.44)';
      ctx.beginPath();
      ctx.ellipse(460, 368, 360, 34, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(860, 142);
      ctx.bezierCurveTo(750, 144, 650, 154, 520, 166);
      ctx.bezierCurveTo(380, 179, 255, 192, 175, 200);
      ctx.bezierCurveTo(132, 196, 95, 176, 56, 174);
      ctx.bezierCurveTo(28, 174, 24, 204, 46, 224);
      ctx.bezierCurveTo(18, 242, 18, 294, 52, 314);
      ctx.bezierCurveTo(96, 332, 138, 326, 178, 322);
      ctx.bezierCurveTo(275, 336, 405, 354, 540, 364);
      ctx.bezierCurveTo(675, 372, 765, 376, 860, 372);
      ctx.closePath();

      const skinGrad = ctx.createLinearGradient(0, 144, 0, 374);
      skinGrad.addColorStop(0.0, '#b57d5d');
      skinGrad.addColorStop(0.16, '#dca988');
      skinGrad.addColorStop(0.45, '#ecc1a3');
      skinGrad.addColorStop(0.75, '#d69e7c');
      skinGrad.addColorStop(1.0, '#966044');
      ctx.fillStyle = skinGrad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(72, 38, 22, 0.56)';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      ctx.save();
      ctx.clip();

      // Elbow & wrist flexor creases
      ctx.strokeStyle = 'rgba(120, 68, 44, 0.28)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(745, 165);
      ctx.quadraticCurveTo(725, 260, 748, 355);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(130, 75, 48, 0.34)';
      ctx.lineWidth = 1.8;
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.moveTo(168 - i * 11, 205);
        ctx.quadraticCurveTo(160 - i * 11, 262, 170 - i * 11, 318);
        ctx.stroke();
      }

      // Subcutaneous veins faintly visible beneath intact skin
      ctx.strokeStyle = 'rgba(56, 84, 138, 0.24)';
      ctx.lineCap = 'round';
      ctx.lineWidth = 5.4;
      ctx.beginPath();
      ctx.moveTo(145, 286);
      ctx.bezierCurveTo(260, 294, 340, 292, 540, 286);
      ctx.bezierCurveTo(640, 280, 720, 268, 840, 254);
      ctx.stroke();

      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.moveTo(155, 232);
      ctx.bezierCurveTo(260, 218, 350, 212, 505, 204);
      ctx.bezierCurveTo(620, 198, 725, 194, 835, 188);
      ctx.stroke();

      // Fine skin hairs (lighter on female skin)
      if (gender === 'male') {
        ctx.strokeStyle = 'rgba(92, 56, 36, 0.16)';
        ctx.lineWidth = 0.85;
        for (const h of SKIN_HAIRS) {
          ctx.beginPath();
          ctx.moveTo(h.x, h.y);
          ctx.lineTo(h.x + Math.cos(h.ang) * h.len, h.y + Math.sin(h.ang) * h.len);
          ctx.stroke();
        }
      }

      // Real-time skin pallor with hypovolemic shock!
      if (phys.bloodLossPct > 10) {
        const pallor = Math.min(0.45, ((phys.bloodLossPct - 10) / 40) * 0.45);
        ctx.fillStyle = `rgba(210, 222, 236, ${pallor})`;
        ctx.fillRect(0, 130, LOGICAL_W, 260);
      }

      // Mild distal cyanotic tint under tight CAT tourniquet
      if (interv.catPlaced && interv.catWindlassTurns >= 2) {
        const cGrad = ctx.createLinearGradient(interv.catX, 0, 80, 0);
        cGrad.addColorStop(0, 'rgba(67, 56, 135, 0.05)');
        cGrad.addColorStop(1, 'rgba(76, 65, 140, 0.16)');
        ctx.fillStyle = cGrad;
        ctx.fillRect(20, 140, interv.catX - 20, 250);
      }
      ctx.restore();
      ctx.restore();

      // 2. DEEP ANATOMICAL LACERATION CUTAWAY (10 LAYERS!)
      const wave = computeArterialWave(phys.pulsePhase);
      const catBlocked = interv.catPlaced && interv.catWindlassTurns >= 3;
      const pulseScale = catBlocked ? 0.04 : interv.catPlaced ? 1 - interv.catWindlassTurns * 0.3 : 1;
      const arteryPulsePx = wave * 2.6 * pulseScale * Math.max(0.45, phys.sbp / 122);

      ctx.save();
      ctx.translate(WOUND_X, WOUND_Y);
      ctx.rotate(-0.085);

      // Layer 1: Epidermis beveled rim
      traceWoundPath(126, 73);
      ctx.fillStyle = 'rgba(72, 22, 18, 0.34)';
      ctx.fill();

      traceWoundPath(120, 68);
      const epiGrad = ctx.createLinearGradient(0, -68, 0, 68);
      epiGrad.addColorStop(0, '#c89171');
      epiGrad.addColorStop(0.5, '#e8be9e');
      epiGrad.addColorStop(1, '#b87d5e');
      ctx.fillStyle = epiGrad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 228, 206, 0.58)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Layer 2: Dermis rim + Layer 3: Capillaries
      ctx.save();
      traceWoundPath(115, 63);
      const dermGrad = ctx.createRadialGradient(0, 0, 34, 0, 0, 118);
      dermGrad.addColorStop(0, '#c95c55');
      dermGrad.addColorStop(0.76, '#e2887f');
      dermGrad.addColorStop(1, '#c4635c');
      ctx.fillStyle = dermGrad;
      ctx.fill();
      ctx.clip();
      drawCapillaryTree(44, -49, 0.45, 1.0, phys.bleedingStopped);
      drawCapillaryTree(-56, -43, 0.88, 0.88, phys.bleedingStopped);
      drawCapillaryTree(-46, 45, -0.7, 0.95, phys.bleedingStopped);
      drawCapillaryTree(58, 42, -1.08, 0.88, phys.bleedingStopped);
      ctx.restore();

      // Layer 4: Subcutaneous Adipose Tissue (Lobulated golden fat)
      ctx.save();
      traceWoundPath(106, 55);
      ctx.fillStyle = '#ce9322';
      ctx.fill();
      ctx.clip();
      for (const lob of FAT_LOBULES) {
        const g = ctx.createRadialGradient(lob.x - lob.r * 0.3, lob.y - lob.r * 0.3, 1, lob.x, lob.y, lob.r);
        g.addColorStop(0, lob.shade > 0.5 ? '#ffe794' : '#ffdd73');
        g.addColorStop(0.7, '#ebb332');
        g.addColorStop(1, '#b67317');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(lob.x, lob.y, lob.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(176, 58, 46, 0.38)';
        ctx.lineWidth = 0.85;
        ctx.stroke();
      }
      ctx.restore();

      // Layer 5: Deep Antebrachial Fascia (glistening silvery-blue fibrous membrane border!)
      ctx.save();
      traceWoundPath(94, 47);
      const fasGrad = ctx.createLinearGradient(-90, -47, 90, 47);
      fasGrad.addColorStop(0, '#cbd5e1');
      fasGrad.addColorStop(0.35, '#f1f5f9');
      fasGrad.addColorStop(0.65, '#94a3b8');
      fasGrad.addColorStop(1, '#e2e8f0');
      ctx.fillStyle = fasGrad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.78)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.restore();

      // Layer 6: Deep Skeletal Muscle Bed
      ctx.save();
      traceWoundPath(87, 42);
      const musGrad = ctx.createLinearGradient(0, -42, 0, 42);
      musGrad.addColorStop(0, '#5a1017');
      musGrad.addColorStop(0.28, '#961e28');
      musGrad.addColorStop(0.55, '#ad2934');
      musGrad.addColorStop(0.85, '#7c1620');
      musGrad.addColorStop(1, '#490c12');
      ctx.fillStyle = musGrad;
      ctx.fill();
      ctx.clip();

      for (let my = -40; my <= 40; my += 3.5) {
        ctx.beginPath();
        ctx.moveTo(-92, my);
        ctx.bezierCurveTo(-30, my - 3.5, 30, my + 3.5, 92, my);
        ctx.strokeStyle = Math.abs(my) % 7 < 3.5 ? 'rgba(220, 78, 86, 0.36)' : 'rgba(55, 8, 12, 0.45)';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }

      // Layer 7: White Tendons
      drawTendon(-5, 5.8);
      drawTendon(4.5, 4.4);

      // Layer 8: Peripheral Nerve (creamy-yellow fasciculated cord!)
      drawPeripheralNerve(13.5);

      // Layer 9: Forearm Vein
      ctx.save();
      const vy = 25.5;
      ctx.strokeStyle = 'rgba(15, 6, 22, 0.6)';
      ctx.lineWidth = 13;
      ctx.beginPath();
      ctx.moveTo(-90, vy + 2);
      ctx.bezierCurveTo(-30, vy + 5, 30, vy - 2, 90, vy + 1);
      ctx.stroke();

      const vGrad = ctx.createLinearGradient(0, vy - 8, 0, vy + 8);
      vGrad.addColorStop(0, '#2a3363');
      vGrad.addColorStop(0.32, '#6274ba');
      vGrad.addColorStop(0.68, '#384682');
      vGrad.addColorStop(1, '#1c2142');
      ctx.strokeStyle = vGrad;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(-90, vy);
      ctx.bezierCurveTo(-30, vy + 3.5, 30, vy - 3.5, 90, vy - 1);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(191, 219, 254, 0.35)';
      ctx.lineWidth = 1.9;
      ctx.beginPath();
      ctx.moveTo(-85, vy - 2.4);
      ctx.bezierCurveTo(-30, vy + 1, 30, vy - 6, 85, vy - 3.4);
      ctx.stroke();

      if (scenario.hasVenous) {
        ctx.fillStyle = '#38020d';
        ctx.beginPath();
        ctx.ellipse(14, vy - 1.5, 9.2, 4.2, -0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#7f1d38';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Coagulation fibrin mesh visually forming over venous tear!
        if (phys.clotProgress > 12) {
          const cf = phys.clotProgress / 100;
          ctx.fillStyle = `rgba(128, 12, 26, ${0.45 + cf * 0.5})`;
          ctx.beginPath();
          ctx.ellipse(14, vy - 1.5, 9.5 * cf, 4.6 * cf, -0.15, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = `rgba(254, 240, 138, ${cf * 0.85})`;
          ctx.lineWidth = 1.1;
          for (let k = -6; k <= 6; k += 3) {
            ctx.beginPath();
            ctx.moveTo(14 + k, vy - 5);
            ctx.lineTo(14 - k * 0.7, vy + 2);
            ctx.stroke();
          }
        }
      }
      ctx.restore();

      // Layer 10: Pulsing Radial Artery!
      ctx.save();
      const ay = -22;
      const thick = 9.2 + arteryPulsePx;
      ctx.strokeStyle = 'rgba(28, 3, 6, 0.65)';
      ctx.lineWidth = thick + 4;
      ctx.beginPath();
      ctx.moveTo(-92, ay + 2.5);
      ctx.bezierCurveTo(-30, ay - 2, 30, ay + 4, 92, ay + 1);
      ctx.stroke();

      const aGrad = ctx.createLinearGradient(0, ay - 8, 0, ay + 8);
      aGrad.addColorStop(0, '#9e1120');
      aGrad.addColorStop(0.3, arteryPulsePx > 1.2 ? '#ff6b78' : '#f44353');
      aGrad.addColorStop(0.65, '#d61c2e');
      aGrad.addColorStop(1, '#750c16');
      ctx.strokeStyle = aGrad;
      ctx.lineWidth = thick;
      ctx.beginPath();
      ctx.moveTo(-92, ay);
      ctx.bezierCurveTo(-30, ay - 4.2, 30, ay + 1.5, 92, ay - 1.5);
      ctx.stroke();

      ctx.strokeStyle = `rgba(255, 225, 228, ${0.42 + wave * 0.34})`;
      ctx.lineWidth = 2.1;
      ctx.beginPath();
      ctx.moveTo(-88, ay - thick * 0.24);
      ctx.bezierCurveTo(-30, ay - 4.2 - thick * 0.24, 30, ay + 1.5 - thick * 0.24, 88, ay - 1.5 - thick * 0.24);
      ctx.stroke();

      if (scenario.hasArterial) {
        const gapY = 2.8 + (phys.arterialRate > 0.3 ? wave * 2.2 : 0);
        ctx.fillStyle = '#4a020a';
        ctx.beginPath();
        ctx.ellipse(-5, ay - 1.5, 6.2, gapY, 0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ff9aa2';
        ctx.lineWidth = 1.1;
        ctx.stroke();

        // Arterial pressurized spurt stream base
        if (phys.arterialRate > 0.3 && interv.gauzeLayers === 0 && !interv.personalBandageOn) {
          const jetLen = (15 + wave * 44) * Math.min(1.25, phys.arterialRate / 14);
          const jetGrad = ctx.createLinearGradient(-5, ay, -5 - jetLen * 0.2, ay - jetLen);
          jetGrad.addColorStop(0, 'rgba(255, 28, 42, 0.98)');
          jetGrad.addColorStop(0.6, 'rgba(255, 48, 58, 0.78)');
          jetGrad.addColorStop(1, 'rgba(255, 48, 58, 0)');
          ctx.strokeStyle = jetGrad;
          ctx.lineWidth = 2.2 + wave * 3.1;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(-5, ay - 2);
          ctx.quadraticCurveTo(-8, ay - jetLen * 0.6, -5 - jetLen * 0.2, ay - jetLen);
          ctx.stroke();
        }
      }
      ctx.restore();

      // Wound cavity liquid pool & depth shadow
      const poolAlpha = Math.min(0.72, 0.16 + phys.woundPoolLevel * 0.48);
      const poolGrad = ctx.createLinearGradient(0, 8, 0, 44);
      poolGrad.addColorStop(0, 'rgba(120, 5, 18, 0)');
      poolGrad.addColorStop(
        0.48,
        scenario.hasVenous && !scenario.hasArterial
          ? `rgba(74, 4, 18, ${poolAlpha})`
          : `rgba(145, 8, 22, ${poolAlpha * 0.85})`
      );
      poolGrad.addColorStop(1, 'rgba(55, 3, 12, 0.85)');
      ctx.fillStyle = poolGrad;
      ctx.fillRect(-95, 4, 190, 44);

      ctx.strokeStyle = 'rgba(18, 2, 5, 0.62)';
      ctx.lineWidth = 7.5;
      traceWoundPath(88, 43);
      ctx.stroke();

      ctx.restore(); // End muscle clip
      ctx.restore(); // End wound transform

      // 3. Rivulets down forearm skin
      ctx.save();
      ctx.lineCap = 'round';
      for (const r of vs.rivulets) {
        ctx.strokeStyle =
          r.type === 'arterial' ? `rgba(215, 16, 30, ${r.alpha})` : `rgba(88, 6, 22, ${r.alpha})`;
        ctx.lineWidth = r.width;
        ctx.beginPath();
        ctx.moveTo(r.fx, r.fy);
        ctx.quadraticCurveTo(r.fx + Math.sin(r.fx) * 5, r.fy + r.len * 0.55, r.fx + Math.cos(r.fx) * 4, r.fy + r.len);
        ctx.stroke();
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath();
        ctx.arc(r.fx + Math.cos(r.fx) * 4, r.fy + r.len, r.width * 0.72, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // 4. CAT Placement Guide Zone
      if (interv.catMode && !interv.catPlaced) {
        ctx.save();
        const pulse = 0.45 + 0.35 * Math.sin(animTime * 6);
        ctx.fillStyle = `rgba(245, 158, 11, ${0.14 + pulse * 0.14})`;
        ctx.strokeStyle = `rgba(251, 191, 36, ${0.65 + pulse * 0.3})`;
        ctx.lineWidth = 2.2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.roundRect(560, 152, 130, 224, 14);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#fef3c7';
        ctx.font = 'bold 12.5px "Segoe UI", Arial';
        ctx.textAlign = 'center';
        ctx.fillText('לחץ כאן להנחת CAT', 625, 144);
        ctx.font = '11px "Segoe UI", Arial';
        ctx.fillText('(5–7 ס"מ מעל הפצע)', 625, 392);
        ctx.restore();
      }

      // 5. Applied Equipment Overlays
      // Gauze
      if (interv.gauzeLayers > 0) {
        ctx.save();
        ctx.translate(WOUND_X, WOUND_Y);
        for (let layer = 0; layer < interv.gauzeLayers; layer++) {
          ctx.save();
          ctx.rotate(-0.07 + layer * 0.06);
          ctx.translate(layer * 3, -layer * 3);
          const w = 186,
            h = 128;
          ctx.fillStyle = 'rgba(0,0,0,0.28)';
          ctx.beginPath();
          ctx.roundRect(-w / 2 + 4, -h / 2 + 5, w, h, 8);
          ctx.fill();
          ctx.fillStyle = '#f8fafc';
          ctx.beginPath();
          ctx.roundRect(-w / 2, -h / 2, w, h, 8);
          ctx.fill();
          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = 1.4;
          ctx.stroke();
          ctx.save();
          ctx.clip();
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.24)';
          ctx.lineWidth = 0.8;
          for (let gx = -w / 2; gx < w / 2; gx += 7) {
            ctx.beginPath();
            ctx.moveTo(gx, -h / 2);
            ctx.lineTo(gx, h / 2);
            ctx.stroke();
          }
          for (let gy = -h / 2; gy < h / 2; gy += 7) {
            ctx.beginPath();
            ctx.moveTo(-w / 2, gy);
            ctx.lineTo(w / 2, gy);
            ctx.stroke();
          }
          if (layer === interv.gauzeLayers - 1 && phys.gauzeSaturation > 0.02) {
            const rad = 18 + phys.gauzeSaturation * 88;
            const stain = ctx.createRadialGradient(0, 0, 6, 0, 0, rad);
            stain.addColorStop(0, scenario.hasArterial ? 'rgba(205, 16, 30, 0.94)' : 'rgba(98, 8, 26, 0.94)');
            stain.addColorStop(0.65, scenario.hasArterial ? 'rgba(225, 36, 48, 0.72)' : 'rgba(120, 16, 36, 0.72)');
            stain.addColorStop(1, 'rgba(220, 38, 38, 0)');
            ctx.fillStyle = stain;
            ctx.beginPath();
            ctx.ellipse(0, 0, rad * 1.15, rad * 0.82, 0.1, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
          ctx.restore();
        }
        ctx.restore();
      }

      // Personal Bandage
      if (interv.personalBandageOn) {
        ctx.save();
        ctx.translate(WOUND_X, WOUND_Y);
        [-54, -18, 18, 54].forEach((wx) => {
          const bGrad = ctx.createLinearGradient(0, -108, 0, 108);
          bGrad.addColorStop(0, '#505c44');
          bGrad.addColorStop(0.25, '#7c8b6a');
          bGrad.addColorStop(0.55, '#8c9c78');
          bGrad.addColorStop(0.85, '#647255');
          bGrad.addColorStop(1, '#3e4735');
          ctx.fillStyle = bGrad;
          ctx.beginPath();
          ctx.roundRect(wx - 22, -102, 44, 206, 7);
          ctx.fill();
          ctx.strokeStyle = 'rgba(30, 38, 25, 0.45)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        });
        ctx.fillStyle = '#e5e7eb';
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(-26, -18, 52, 36, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#334155';
        ctx.font = 'bold 9.5px "Segoe UI", Arial';
        ctx.textAlign = 'center';
        ctx.fillText('תחבושת', 0, -2);
        ctx.fillText('אישית', 0, 10);
        if (phys.arterialRate > 1.0) {
          const soak = Math.min(0.85, 0.25 + phys.gauzeSaturation * 0.65);
          const sGrad = ctx.createRadialGradient(0, 0, 8, 0, 0, 64);
          sGrad.addColorStop(0, `rgba(220, 18, 32, ${soak})`);
          sGrad.addColorStop(1, 'rgba(220, 18, 32, 0)');
          ctx.fillStyle = sGrad;
          ctx.beginPath();
          ctx.arc(0, 0, 64, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // CAT Tourniquet
      if (interv.catPlaced) {
        ctx.save();
        const x = interv.catX;
        const pinch = interv.catWindlassTurns * 3.5;
        const topY = 152 + pinch;
        const botY = 368 - pinch;
        const h = botY - topY;
        ctx.fillStyle = 'rgba(0,0,0,0.48)';
        ctx.beginPath();
        ctx.roundRect(x - 24, topY + 2, 52, h + 4, 8);
        ctx.fill();

        const bandGrad = ctx.createLinearGradient(0, topY, 0, botY);
        bandGrad.addColorStop(0, '#111827');
        bandGrad.addColorStop(0.35, '#27303f');
        bandGrad.addColorStop(0.7, '#1f2937');
        bandGrad.addColorStop(1, '#0b0f19');
        ctx.fillStyle = bandGrad;
        ctx.beginPath();
        ctx.roundRect(x - 22, topY, 44, h, 7);
        ctx.fill();
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.4;
        ctx.stroke();

        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.roundRect(x - 14, botY - 8, 28, 22, 4);
        ctx.fill();

        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.roundRect(x - 19, topY + 14, 38, 26, 3);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 8.5px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('TIME', x, topY + 24);
        ctx.fillStyle = interv.catTimeStamped ? '#059669' : '#dc2626';
        ctx.font = 'bold 9.5px Arial';
        ctx.fillText(interv.catTimeStamped || '--:--', x, topY + 35);

        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.roundRect(x - 17, 232, 34, 58, 5);
        ctx.fill();
        ctx.strokeStyle = '#64748b';
        ctx.stroke();

        ctx.save();
        ctx.translate(x, 261);
        ctx.rotate(interv.catWindlassTurns * 0.92 + 0.35);
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.roundRect(-5.5, -38, 11, 76, 5);
        ctx.fill();
        ctx.strokeStyle = interv.catWindlassTurns === 3 ? '#10b981' : '#f59e0b';
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.restore();
        ctx.restore();
      }

      // Triangular Bandage Sling
      if (interv.triangleOn) {
        ctx.save();
        ctx.strokeStyle = 'rgba(226, 232, 240, 0.78)';
        ctx.lineWidth = 16;
        ctx.beginPath();
        ctx.moveTo(220, 325);
        ctx.lineTo(310, 40);
        ctx.moveTo(645, 360);
        ctx.lineTo(540, 40);
        ctx.stroke();

        const slingGrad = ctx.createLinearGradient(0, 295, 0, 412);
        slingGrad.addColorStop(0, '#f1f5f9');
        slingGrad.addColorStop(0.5, '#e2e8f0');
        slingGrad.addColorStop(1, '#cbd5e1');
        ctx.fillStyle = slingGrad;
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(195, 304);
        ctx.quadraticCurveTo(435, 336, 680, 344);
        ctx.lineTo(665, 392);
        ctx.quadraticCurveTo(430, 412, 205, 352);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 11px "Segoe UI", Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('מתלה משולש בד — קיבוע והגבהה ✓', 436, 366);
        ctx.restore();
      }

      // Direct Pressure Hands
      if (interv.pressureStrength > 0.05) {
        ctx.save();
        ctx.translate(WOUND_X, WOUND_Y);
        ctx.globalAlpha = Math.min(0.92, interv.pressureStrength);
        const ringR = 54 + Math.sin(animTime * 7) * 6;
        ctx.strokeStyle = interv.glovesOn ? 'rgba(56, 189, 248, 0.78)' : 'rgba(239, 68, 68, 0.85)';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.arc(0, 0, ringR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = interv.glovesOn ? '#38bdf8' : '#e5b293';
        ctx.strokeStyle = interv.glovesOn ? '#0284c7' : '#b45309';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-48, -32, 96, 62, 22);
        ctx.fill();
        ctx.stroke();
        for (let i = -1.5; i <= 1.5; i++) {
          ctx.beginPath();
          ctx.roundRect(i * 21 - 8.5, -56, 17, 36, 8);
          ctx.fill();
          ctx.stroke();
        }
        ctx.fillStyle = interv.glovesOn ? '#082f49' : '#450a0a';
        ctx.font = 'bold 11.5px "Segoe UI", Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(interv.glovesOn ? 'לחץ ישיר' : 'ללא כפפות!', 0, 2);
        ctx.restore();
      }

      // Layer highlight outline
      const hl = vs.hoveredLayer || vs.selectedLayerId;
      if (hl && !interv.personalBandageOn) {
        ctx.save();
        ctx.translate(WOUND_X, WOUND_Y);
        ctx.rotate(-0.085);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 12;
        if (hl === 'epidermis') {
          traceWoundPath(120, 68);
          ctx.stroke();
        } else if (hl === 'dermis') {
          traceWoundPath(114, 62);
          ctx.stroke();
        } else if (hl === 'subcutaneous') {
          traceWoundPath(105, 54);
          ctx.stroke();
        } else if (hl === 'fascia') {
          traceWoundPath(94, 47);
          ctx.stroke();
        } else if (hl === 'muscle') {
          traceWoundPath(86, 41);
          ctx.stroke();
        } else if (hl === 'artery') {
          ctx.beginPath();
          ctx.roundRect(-86, -31, 172, 19, 9);
          ctx.stroke();
        } else if (hl === 'vein') {
          ctx.beginPath();
          ctx.roundRect(-86, 16, 172, 19, 9);
          ctx.stroke();
        } else if (hl === 'tendon') {
          ctx.beginPath();
          ctx.roundRect(-86, -11, 172, 22, 8);
          ctx.stroke();
        } else if (hl === 'nerve') {
          ctx.beginPath();
          ctx.roundRect(-86, 8, 172, 12, 6);
          ctx.stroke();
        } else if (hl === 'capillaries') {
          ctx.beginPath();
          ctx.arc(44, -49, 20, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      // 10-Layer Callout Labels
      if (vs.showLabels && !interv.personalBandageOn) {
        ctx.save();
        for (const p of CALLOUT_PINS) {
          const active = vs.hoveredLayer === p.id || vs.selectedLayerId === p.id;
          const color = ANATOMY_MAP[p.id]?.color || '#38bdf8';
          ctx.strokeStyle = active ? '#38bdf8' : 'rgba(203, 213, 225, 0.48)';
          ctx.lineWidth = active ? 2 : 1.1;
          ctx.beginPath();
          ctx.moveTo(p.lx, p.ly + (p.ly < 250 ? 12 : -12));
          ctx.lineTo(p.tx, p.ty);
          ctx.stroke();

          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(p.tx, p.ty, active ? 4.4 : 3.1, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.font = 'bold 11px "Segoe UI", Arial';
          const tw = ctx.measureText(p.label).width;
          const pw = tw + 22;
          const ph = 23;
          ctx.fillStyle = active ? 'rgba(14, 116, 144, 0.96)' : 'rgba(10, 17, 32, 0.88)';
          ctx.strokeStyle = active ? '#7dd3fc' : 'rgba(148, 163, 184, 0.4)';
          ctx.lineWidth = active ? 1.8 : 1;
          ctx.beginPath();
          ctx.roundRect(p.lx - pw / 2, p.ly - ph / 2, pw, ph, 11.5);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(p.lx + pw / 2 - 9, p.ly, 3.8, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#f8fafc';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(p.label, p.lx - 4, p.ly + 0.5);
        }
        ctx.restore();
      }

      ctx.restore(); // END FOREARM LOCAL SPACE

      // World-space ballistic blood droplets & clot-burst particles
      ctx.save();
      for (const p of vs.particles) {
        const fade = Math.max(0, 1 - p.life / p.maxLife);
        if (p.type === 'arterial') {
          ctx.strokeStyle = `rgba(255, 24, 38, ${0.93 * fade})`;
          ctx.lineWidth = p.r * 1.15;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.022, p.y - p.vy * 0.022);
          ctx.stroke();
        } else if (p.type === 'clot_burst') {
          ctx.fillStyle = `rgba(185, 28, 28, ${0.95 * fade})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = `rgba(92, 6, 22, ${0.9 * fade})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      ctx.restore(); // END ZOOM
      ctx.restore(); // END LOGICAL SCALE
    }

    rafId = requestAnimationFrame(renderFrame);
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [physiologyRef, interventionsRef, scenario, gender, bodyRegionId]);

  // Interactive Pointer Handlers
  const pressTimerRef = useRef(null);
  const pointerDownRef = useRef(null);
  const ignoreNextUpRef = useRef(false);
  const isHoldingRef = useRef(false);

  const handlePointerDown = (e) => {
    const pt = screenToForearmLocal(e.clientX, e.clientY);
    pointerDownRef.current = { x: e.clientX, y: e.clientY };

    if (interventionsRef.current.catMode && !interventionsRef.current.catPlaced) {
      ignoreNextUpRef.current = true;
      onAttemptCatPlacement(pt.x, pt.y);
      return;
    }

    const distWound = Math.hypot((pt.x - WOUND_X) / 1.4, pt.y - WOUND_Y);
    if (distWound < 92) {
      pressTimerRef.current = setTimeout(() => {
        isHoldingRef.current = true;
        onCanvasPressChange(true);
      }, 170);
    }
  };

  const handlePointerUp = (e) => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    if (ignoreNextUpRef.current) {
      ignoreNextUpRef.current = false;
      pointerDownRef.current = null;
      return;
    }
    if (isHoldingRef.current) {
      isHoldingRef.current = false;
      onCanvasPressChange(false);
      return;
    }
    if (!pointerDownRef.current || interventionsRef.current.catMode) return;
    const moved = Math.hypot(e.clientX - pointerDownRef.current.x, e.clientY - pointerDownRef.current.y);
    if (moved < 10) {
      const pt = screenToForearmLocal(e.clientX, e.clientY);
      const pinId = hitTestCalloutPill(pt.x, pt.y);
      const hit = pinId || hitTestLayer(pt.x, pt.y);
      if (hit) onSelectLayer(hit);
    }
    pointerDownRef.current = null;
  };

  const handlePointerMove = (e) => {
    const pt = screenToForearmLocal(e.clientX, e.clientY);
    if (interventionsRef.current.catMode && !interventionsRef.current.catPlaced) {
      setHoveredLayer(null);
      viewStateRef.current.hoveredLayer = null;
      return;
    }
    const pinId = hitTestCalloutPill(pt.x, pt.y);
    const layer = pinId || hitTestLayer(pt.x, pt.y);
    viewStateRef.current.hoveredLayer = layer;
    setHoveredLayer(layer);
    if (layer && canvasRef.current) {
      const rect = canvasRef.current.parentElement.getBoundingClientRect();
      setTooltipPos({
        x: Math.min(rect.width - 220, Math.max(10, e.clientX - rect.left + 12)),
        y: Math.max(10, e.clientY - rect.top - 34),
      });
    }
  };

  const handlePointerLeave = () => {
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    if (isHoldingRef.current) {
      isHoldingRef.current = false;
      onCanvasPressChange(false);
    }
    viewStateRef.current.hoveredLayer = null;
    setHoveredLayer(null);
  };

  const phys = physiologyRef.current;
  const bleedRate = phys ? phys.totalBleedRate : 0;
  const stopped = phys ? phys.bleedingStopped : false;
  const selectedLayer = selectedLayerId ? ANATOMY_MAP[selectedLayerId] : null;
  const catPressure = CAT_OCCLUSION_MMHG[interventions.catWindlassTurns] || 0;

  return (
    <div className="panel macro-panel">
      <div className="macro-canvas-wrapper">
        <canvas
          ref={canvasRef}
          className="macro-canvas"
          style={{
            cursor: interventions.catMode && !interventions.catPlaced ? 'crosshair' : hoveredLayer ? 'pointer' : 'default',
          }}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
        />

        {/* Top Floating Controls */}
        <div className="macro-overlay-top">
          <div className="macro-toolbar">
            {onSwitchToFullBody && (
              <button className="mini-chip on" onClick={onSwitchToFullBody}>
                <User size={12} /> חזור לתצוגת גוף מלא ({gender === 'male' ? 'זכר' : 'נקבה'})
              </button>
            )}
            <button className={`mini-chip ${showLabels ? 'on' : ''}`} onClick={() => setShowLabels((v) => !v)}>
              <Tag size={12} /> תוויות (10)
            </button>
            <button className={`mini-chip ${zoomed ? 'on' : ''}`} onClick={() => setZoomed((v) => !v)}>
              {zoomed ? <ZoomOut size={12} /> : <ZoomIn size={12} />} {zoomed ? 'מבט מלא' : 'זום לפצע'}
            </button>
            <button className="mini-chip xray-accent" onClick={() => onOpenXRay(selectedLayerId || 'artery')}>
              <Scan size={12} /> סורק X-Ray גוף מלא
            </button>
          </div>

          <div className={`bleed-pill ${stopped ? 'ok' : bleedRate < 6 ? 'slow' : 'crit'}`}>
            <span className="pulse-dot" />
            <span>
              {stopped
                ? 'הדימום נעצר בהצלחה ✓'
                : `${BODY_REGIONS[bodyRegionId]?.shortHe || 'אמה'}: ${scenario.shortTitle} (~${bleedRate.toFixed(1)} מ"ל/שנ')`}
            </span>
          </div>
        </div>

        {/* Toast Alert */}
        {toast && (
          <div className={`canvas-toast show toast-${toast.kind || 'info'}`}>
            {toast.text}
          </div>
        )}

        {/* Hover Tooltip */}
        {hoveredLayer && !interventions.personalBandageOn && (
          <div className="anatomy-tooltip" style={{ left: tooltipPos.x, top: tooltipPos.y }}>
            {ANATOMY_MAP[hoveredLayer]?.nameHe} — לחץ לחקירה
          </div>
        )}

        {/* Interactive CAT Control Bar */}
        {(interventions.catMode || interventions.catPlaced) && (
          <div className="cat-control-bar visible">
            <div className="cat-bar-text">
              <strong style={{ color: '#fcd34d' }}>
                {interventions.catPlaced
                  ? `חוסם עורקים CAT (לחץ חסימה: ~${catPressure} ממ"כ):`
                  : 'בחירת מיקום אנטומי ל-CAT:'}
              </strong>{' '}
              <span>
                {!interventions.catPlaced
                  ? 'לחץ על האמה 5–7 ס"מ מעל הפצע (בצד המרפק/ימין, לא על מפרק!)'
                  : interventions.catWindlassTurns < 3
                  ? 'סובב את מקל ההידוק עד עצירה מוחלטת של התזת הדם!'
                  : interventions.catTimeStamped
                  ? `מהודק ונעול + שעת הנחה (${interventions.catTimeStamped}) ✓`
                  : 'הדימום נעצר! כעת חובה לרשום את שעת ההנחה ←'}
              </span>
            </div>
            {interventions.catPlaced && (
              <div className="cat-controls-group">
                <button
                  className="cat-btn"
                  disabled={interventions.catWindlassTurns >= 3}
                  onClick={() => onAdjustWindlass(1)}
                >
                  ↻ הדק מקל ({interventions.catWindlassTurns}/3)
                </button>
                <button
                  className="cat-btn"
                  disabled={interventions.catWindlassTurns <= 0}
                  onClick={() => onAdjustWindlass(-1)}
                >
                  ↺ שחרר
                </button>
                <button
                  className={`cat-btn time-btn ${interventions.catTimeStamped ? 'stamped' : ''}`}
                  onClick={onStampCatTime}
                >
                  {interventions.catTimeStamped ? `✓ שעה: ${interventions.catTimeStamped}` : '🕒 רשום שעת הנחה'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 10 Clickable Anatomical Layer Explorer Pills */}
      <div className="layers-strip">
        <div className="layers-strip-header">
          <span>🔬 חקירת 10 השכבות האנטומיות (לחץ על רקמה בציור או כאן):</span>
          <span style={{ color: '#38bdf8' }}>
            {mode === 'learn' ? 'מצב לימוד פעיל — כולל הסברי פיזיולוגיה' : 'חקירת אנטומיה זמינה'}
          </span>
        </div>
        <div className="layer-pills">
          {ANATOMY_LAYERS.map((layer) => (
            <button
              key={layer.id}
              type="button"
              className={`layer-pill ${selectedLayerId === layer.id ? 'selected' : ''}`}
              onClick={() => onSelectLayer(layer.id)}
            >
              <span className="layer-swatch" style={{ background: layer.color }} />
              {layer.nameHe.split(' (')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Selected Layer Compact Info Card */}
      {selectedLayer && (
        <div className="anatomy-card">
          <div className="anatomy-card-head">
            <div className="anatomy-card-title">
              <span className="layer-swatch" style={{ background: selectedLayer.color, width: 13, height: 13 }} />
              <span>{selectedLayer.nameHe}</span>
              <span className="anatomy-card-latin">({selectedLayer.latin}) • עומק: {selectedLayer.depthMm}</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="mini-chip xray-accent" onClick={() => onOpenXRay(selectedLayer.id)}>
                <Eye size={12} /> פתח בסורק X-Ray
              </button>
              <button className="mini-chip" onClick={() => onSelectLayer(null)}>✕</button>
            </div>
          </div>
          <div className="anatomy-grid">
            <div className="anatomy-fact">
              <h5>📌 אנטומיה ופיזיולוגיה</h5>
              <p>{selectedLayer.anatomyDetails}</p>
            </div>
            <div className="anatomy-fact">
              <h5>🩸 מאפייני פגיעה ודימום</h5>
              <p>{selectedLayer.injuryCharacteristics}</p>
            </div>
            <div className="anatomy-fact">
              <h5>🚑 הנחיות למע"ר</h5>
              <p>{selectedLayer.firstAidGuidance}</p>
              {selectedLayer.redFlags?.[0] && (
                <div className="red-flag-inline">
                  <AlertTriangle size={12} /> {selectedLayer.redFlags[0]}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
