import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Layers, Scan, Info, Activity, Crosshair, Heart, Wind } from 'lucide-react';
import { AXIAL_SLICE_LEVELS, ATLAS_STRUCTURES_MAP } from '../../data/atlas3DDatabase';
import { computeArterialWave } from '../../engines/PhysiologyEngine';

const CW = 320;
const CH = 320;
const HALF = 160;
const SAFE_RADIUS = 132;

const IMAGING_MODES = [
  { id: 'anatomical', labelHe: 'אנטומיה צבעונית', badge: 'HISTO • ATLAS', icon: Layers },
  { id: 'ct', labelHe: 'CT קליני (HU)', badge: 'CT • W:400 L:40', icon: Scan },
  { id: 'mri', labelHe: 'MRI (T2)', badge: 'MRI • T2-W 3.0T', icon: Activity },
];

const CT_HU_LEGEND = [
  { label: 'אוויר', hu: '-1000', bg: '#070a0f', text: '#94a3b8' },
  { label: 'ריאה', hu: '-800', bg: '#18202a', text: '#cbd5e1' },
  { label: 'שומן', hu: '-100', bg: '#303945', text: '#cbd5e1' },
  { label: 'רקמה', hu: '+50', bg: '#737f8e', text: '#0b1324' },
  { label: 'ניגוד', hu: '+220', bg: '#cbd6e4', text: '#0b1324' },
  { label: 'עצם', hu: '+1000', bg: '#f8fafc', text: '#0b1324' },
];

const MRI_T2_LEGEND = [
  { label: 'אוויר/עצם', signal: 'כהה', bg: '#0d131d', text: '#94a3b8' },
  { label: 'זרימת דם', signal: 'Flow Void', bg: '#1a2434', text: '#cbd5e1' },
  { label: 'שריר/כבד', signal: 'בינוני', bg: '#4b5769', text: '#f1f5f9' },
  { label: 'איבר/מוח', signal: 'בהיר', bg: '#8a9ab0', text: '#0b1324' },
  { label: 'שומן/CSF', signal: 'היפר-אינטנסי', bg: '#e6effc', text: '#0b1324' },
];

/* ==========================================================================
   COLOR & RADIOLOGICAL PHYSICS HELPERS
   ========================================================================== */

function parseColorToRgb(colorStr, fallback = [148, 163, 184]) {
  if (!colorStr || typeof colorStr !== 'string') return fallback;
  const s = colorStr.trim();
  if (s.startsWith('#')) {
    let hex = s.slice(1);
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
        return [r, g, b];
      }
    }
  }
  const m = s.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (m) {
    return [
      Math.max(0, Math.min(255, Math.round(Number(m[1])))),
      Math.max(0, Math.min(255, Math.round(Number(m[2])))),
      Math.max(0, Math.min(255, Math.round(Number(m[3])))),
    ];
  }
  return fallback;
}

function shadeRgb(rgb, delta) {
  return [
    Math.max(0, Math.min(255, Math.round(rgb[0] + delta))),
    Math.max(0, Math.min(255, Math.round(rgb[1] + delta))),
    Math.max(0, Math.min(255, Math.round(rgb[2] + delta))),
  ];
}

function rgbStr(rgb, alpha = 1) {
  return alpha >= 1
    ? `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`
    : `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

function traceRoundedRect(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

function getSliceHeightPct(slice) {
  if (!slice) return 68;
  const raw =
    slice.heightPct ??
    slice.yPct ??
    slice.levelPct ??
    slice.pct ??
    slice.height ??
    68;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 68;
  return n <= 1 && n > 0 ? Math.round(n * 100) : Math.round(n);
}

function getSliceCode(slice) {
  if (!slice) return 'T6';
  if (slice.code) return String(slice.code).split(/[—–]/)[0].trim();
  if (slice.levelCode) return String(slice.levelCode).split(/[—–]/)[0].trim();
  if (slice.vertebra) return String(slice.vertebra);
  const combined = `${slice.titleHe || ''} ${slice.subtitleHe || ''} ${slice.id || ''}`;
  const match = combined.match(/\b(C\d+|T\d+|L\d+|S\d+)\b/i);
  if (match) return match[1].toUpperCase();
  if (/skull|brain|head|גולגולת|מוח/i.test(combined)) return 'Cranium';
  if (/forearm|אמה/i.test(combined)) return 'Forearm';
  if (/humerus|upper_arm|זרוע/i.test(combined)) return 'Humerus';
  if (/thigh|femur|ירך/i.test(combined)) return 'Femur';
  if (/knee|patella|ברך/i.test(combined)) return 'Patella';
  if (/calf|tibia|שוק/i.test(combined)) return 'Tibia';
  return String(slice.id || 'AX').slice(0, 6).toUpperCase();
}

const SLICE_CHIP_BY_ID = {
  head_brain: 'גולגולת',
  neck_c5: 'צוואר C5',
  upper_thorax_t3: 'חזה T3',
  mid_thorax_t6: 'לב T6',
  upper_arm_mid: 'זרוע',
  upper_abdomen_t11: 'כבד T11',
  mid_abdomen_l2: 'כליות L2',
  forearm_mid: 'אמה',
  pelvis_s1: 'אגן S1',
  mid_thigh: 'ירך',
  knee_level: 'ברך',
  mid_calf: 'שוק',
};

function getSliceChipLabel(slice) {
  if (!slice) return '';
  if (slice.shortHe) return slice.shortHe;
  if (slice.chipHe) return slice.chipHe;
  if (slice.shortLabel) return slice.shortLabel;
  if (slice.chipLabel) return slice.chipLabel;
  if (slice.badgeHe) return slice.badgeHe;
  if (slice.id && SLICE_CHIP_BY_ID[slice.id]) return SLICE_CHIP_BY_ID[slice.id];

  const title = String(slice.titleHe || slice.id || '');
  const code = getSliceCode(slice);
  if (/גולגולת|מוח/.test(title)) return 'גולגולת';
  if (/צוואר/.test(title)) return code.startsWith('C') ? `צוואר ${code}` : 'צוואר C5';
  if (/לב/.test(title)) return code.startsWith('T') ? `לב ${code}` : 'לב T6';
  if (/חזה/.test(title)) return code.startsWith('T') ? `חזה ${code}` : 'חזה T3';
  if (/כבד/.test(title)) return code.startsWith('T') ? `כבד ${code}` : 'כבד T11';
  if (/כליות/.test(title)) return code.startsWith('L') ? `כליות ${code}` : 'כליות L2';
  if (/אגן/.test(title)) return code.startsWith('S') ? `אגן ${code}` : 'אגן S1';
  if (/אמה/.test(title)) return 'אמה';
  if (/זרוע/.test(title)) return 'זרוע';
  if (/ירך/.test(title)) return 'ירך';
  if (/ברך/.test(title)) return 'ברך';
  if (/שוק/.test(title)) return 'שוק';

  const trimmed = title.split(/[—–\-:(]/)[0].trim();
  const words = trimmed.split(/\s+/).slice(0, 2).join(' ');
  return words || title.slice(0, 12);
}

function parseHuNumber(shape, structure) {
  if (typeof shape?.hu === 'number' && Number.isFinite(shape.hu)) return shape.hu;
  if (typeof structure?.hu === 'number' && Number.isFinite(structure.hu)) return structure.hu;
  const label = String(shape?.huLabel || structure?.huLabel || '');
  const rangeMatch = label.match(/([+-]?\d+)\s*[–\-~]\s*([+-]?\d+)/);
  if (rangeMatch) {
    return Math.round((Number(rangeMatch[1]) + Number(rangeMatch[2])) * 0.5);
  }
  const singleMatch = label.match(/([+-]?\d+)/);
  if (singleMatch) return Number(singleMatch[1]);
  return null;
}

function classifyTissue(shape, structure) {
  const explicit = String(shape?.tissue || shape?.tissueType || structure?.tissue || '').toLowerCase();
  if (explicit) return explicit;

  const token = [
    shape?.pulseType,
    shape?.structureId,
    shape?.labelHe,
    structure?.id,
    structure?.category,
    structure?.system,
    structure?.nameEn,
    structure?.nameHe,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (shape?.pulseType === 'heart' || /heart|myocard|ventric|atrium|לב|שריר הלב/.test(token)) return 'heart';
  if (shape?.pulseType === 'artery' || /arter|aort|carotid|subclav|brachial|radial|ulnar|femoral|popliteal|tibial|iliac|עורק|אבי העורקים/.test(token)) return 'artery';
  if (/vein|vena|jugular|saphen|cava|וריד|נבוב/.test(token)) return 'vein';
  if (shape?.pulseType === 'lung' || /lung|pulmon|ריאה|ריאות/.test(token)) return 'lung';
  if (/trachea|airway|bronch|larynx|sinus|air|קנה נשימה|נתיב אוויר|אוויר/.test(token)) return 'air';
  if (/csf|ventricle_brain|fluid|bladder|gallbladder|urine|נוזל|שלפוחית/.test(token)) return 'fluid';
  if (/skull|cranium|bone|verteb|rib|sternum|femur|tibia|fibula|humerus|radius|ulna|pelvis|sacrum|ilium|clavicle|patella|עצם|גולגולת|חוליה|צלע|אגן|ירך|שוקה/.test(token)) return 'bone';
  if (/brain|cerebr|cortex|stem|cerebell|מוח/.test(token)) return 'brain';
  if (/spinal|cord|nerve|sciatic|vagus|plexus|median|radial_n|עצב|חוט השדרה/.test(token)) return 'nerve';
  if (/liver|hepat|כבד/.test(token)) return 'liver';
  if (/spleen|טחול/.test(token)) return 'spleen';
  if (/kidney|renal|כליה|כליות/.test(token)) return 'kidney';
  if (/stomach|bowel|intest|colon|esophag|קיבה|מעי|ושט/.test(token)) return 'bowel';
  if (/fat|adipos|שומן/.test(token)) return 'fat';
  if (/cartilage|disc|סחוס/.test(token)) return 'cartilage';
  if (/muscle|musc|שריר|סרעפת/.test(token)) return 'muscle';
  return 'organ';
}

function inferDefaultHu(tissue) {
  switch (tissue) {
    case 'air': return -980;
    case 'lung': return -820;
    case 'fat': return -95;
    case 'fluid': return 8;
    case 'bowel': return -40;
    case 'brain': return 36;
    case 'nerve': return 32;
    case 'muscle': return 48;
    case 'heart': return 145;
    case 'kidney': return 52;
    case 'spleen': return 55;
    case 'liver': return 62;
    case 'cartilage': return 110;
    case 'vein': return 135;
    case 'artery': return 225;
    case 'bone': return 950;
    default: return 45;
  }
}

function getHuLabel(shape, structure, tissue) {
  if (shape?.huLabel) return String(shape.huLabel);
  const n = parseHuNumber(shape, structure);
  const val = n !== null ? n : inferDefaultHu(tissue);
  return `${val > 0 ? '+' : ''}${Math.round(val)} HU`;
}

function getCompactHu(huLabel) {
  if (!huLabel) return '';
  return String(huLabel).split('(')[0].trim();
}

function inferAnatomicalColor(shape, structure, tissue) {
  if (shape?.colorAnat) return shape.colorAnat;
  if (shape?.color) return shape.color;
  if (shape?.fill) return shape.fill;
  if (shape?.anatColor) return shape.anatColor;
  if (structure?.color) return structure.color;
  switch (tissue) {
    case 'bone': return '#efe5cf';
    case 'cartilage': return '#a5d8e6';
    case 'artery': return '#ef4444';
    case 'vein': return '#2563eb';
    case 'heart': return '#c83444';
    case 'lung': return '#8f5f6d';
    case 'air': return '#162032';
    case 'liver': return '#7d342d';
    case 'spleen': return '#6f2e49';
    case 'kidney': return '#8f4038';
    case 'brain': return '#d9b5a6';
    case 'nerve': return '#facc15';
    case 'fluid': return '#38bdf8';
    case 'bowel': return '#b87d68';
    case 'fat': return '#e5b95b';
    case 'muscle': return '#8a2f3a';
    default: return '#9b5968';
  }
}

/**
 * Authentic Hounsfield Unit (HU) -> Clinical Soft-Tissue/Contrast Window Grayscale LUT
 */
function huToCtRgb(hu) {
  if (hu <= -900) return [6, 9, 13];
  if (hu <= -550) {
    const t = (hu + 900) / 350;
    const v = Math.round(14 + t * 18);
    return [v, v + 2, v + 4];
  }
  if (hu <= -30) {
    const t = (hu + 550) / 520;
    const v = Math.round(32 + t * 24);
    return [v, v + 2, v + 5];
  }
  if (hu <= 25) {
    const t = (hu + 30) / 55;
    const v = Math.round(62 + t * 24);
    return [v, v + 2, v + 5];
  }
  if (hu <= 95) {
    const t = (hu - 25) / 70;
    const v = Math.round(92 + t * 44);
    return [v, v + 2, v + 5];
  }
  if (hu <= 340) {
    const t = (hu - 95) / 245;
    const v = Math.round(156 + t * 68);
    return [v, v + 3, Math.min(255, v + 6)];
  }
  const t = Math.min(1, (hu - 340) / 660);
  const v = Math.round(226 + t * 29);
  return [v, Math.min(255, v + 1), Math.min(255, v + 2)];
}

/**
 * Authentic T2-Weighted MRI Contrast Mapping
 * (Bright CSF/Fluid/Fat, Dark Cortical Bone & Air, Flow-Void Vessels, Soft Tissue Contrast)
 */
function tissueToMriT2Style(shape, tissue) {
  if (shape?.mriColor) {
    const base = parseColorToRgb(shape.mriColor);
    return {
      fill: base,
      edge: shadeRgb(base, 26),
      innerFill: shadeRgb(base, -18),
    };
  }
  switch (tissue) {
    case 'fluid':
      return { fill: [236, 245, 255], edge: [255, 255, 255], innerFill: [224, 238, 255] };
    case 'fat':
      return { fill: [204, 214, 228], edge: [224, 232, 244], innerFill: [190, 202, 218] };
    case 'air':
      return { fill: [7, 10, 16], edge: [34, 44, 58], innerFill: [5, 7, 11] };
    case 'lung':
      return { fill: [13, 18, 27], edge: [45, 56, 72], innerFill: [10, 14, 22] };
    case 'bone':
      // Cortical bone is dark signal void on T2; fatty trabecular marrow is medium-bright!
      return { fill: [18, 24, 34], edge: [62, 74, 92], innerFill: [152, 166, 184] };
    case 'artery':
      // Classic T2 fast-flow signal void with visible vessel wall
      return { fill: [20, 28, 42], edge: [132, 148, 170], innerFill: [14, 20, 32] };
    case 'vein':
      return { fill: [34, 45, 62], edge: [108, 124, 146], innerFill: [26, 35, 50] };
    case 'heart':
      return { fill: [60, 72, 90], edge: [122, 138, 158], innerFill: [36, 46, 62] };
    case 'brain':
      return { fill: [146, 160, 180], edge: [215, 228, 246], innerFill: [112, 126, 146] };
    case 'nerve':
      return { fill: [138, 154, 176], edge: [216, 230, 248], innerFill: [118, 134, 156] };
    case 'kidney':
      return { fill: [148, 164, 186], edge: [194, 208, 226], innerFill: [170, 186, 208] };
    case 'spleen':
      return { fill: [124, 138, 158], edge: [164, 178, 198], innerFill: [108, 122, 142] };
    case 'liver':
      return { fill: [76, 88, 104], edge: [114, 128, 146], innerFill: [68, 78, 94] };
    case 'bowel':
      return { fill: [108, 122, 140], edge: [176, 190, 208], innerFill: [64, 76, 92] };
    case 'cartilage':
      return { fill: [102, 114, 130], edge: [142, 156, 174], innerFill: [86, 98, 114] };
    case 'muscle':
      return { fill: [66, 77, 94], edge: [102, 116, 134], innerFill: [56, 66, 82] };
    default:
      return { fill: [112, 126, 146], edge: [154, 168, 188], innerFill: [96, 110, 130] };
  }
}

/* ==========================================================================
   COORDINATE NORMALIZER & DUAL-LIMB LAYOUT SOLVER
   Handles [-1..1], [0..1], [-160..160], [0..320], [0..100] transparently!
   ========================================================================== */

function expandMirroredShapes(rawShapes) {
  const out = [];
  for (let i = 0; i < rawShapes.length; i++) {
    const s = rawShapes[i];
    if (!s) continue;
    out.push(s);
    if (s.mirror || s.bilateral) {
      const xVal = s.x ?? s.cx ?? 0;
      if (Math.abs(xVal) > 0.0001) {
        out.push({
          ...s,
          x: -xVal,
          cx: s.cx != null ? -s.cx : undefined,
          rot: s.rot != null ? -s.rot : undefined,
          rotation: s.rotation != null ? -s.rotation : undefined,
          mirror: false,
          bilateral: false,
        });
      }
    }
  }
  return out;
}

function buildSliceGeometryTransform(slice, femaleBlend) {
  const bc = slice?.bodyContour || { rx: 112, ry: 84 };
  const rawShapes = expandMirroredShapes(Array.isArray(slice?.shapes) ? slice.shapes : []);

  const baseRx = Number(bc.rx ?? 112);
  const baseRy = Number(bc.ry ?? 84);
  const femRx = Number(bc.femaleRx ?? baseRx);
  const femRy = Number(bc.femaleRy ?? baseRy);
  const dataRx = baseRx + (femRx - baseRx) * femaleBlend;
  const dataRy = baseRy + (femRy - baseRy) * femaleBlend;
  const isDual = Boolean(bc.dualLimb);

  let hasNegative = false;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let sumX = 0;
  let sumY = 0;
  let count = 0;

  for (let i = 0; i < rawShapes.length; i++) {
    const s = rawShapes[i];
    const sx = Number(s.x ?? s.cx ?? 0);
    const sy = Number(s.y ?? s.cy ?? 0);
    if (sx < 0 || sy < 0) hasNegative = true;
    if (sx < minX) minX = sx;
    if (sx > maxX) maxX = sx;
    if (sy < minY) minY = sy;
    if (sy > maxY) maxY = sy;
    sumX += sx;
    sumY += sy;
    count += 1;
  }

  const avgX = count > 0 ? sumX / count : 0;
  const avgY = count > 0 ? sumY / count : 0;

  // Detect data origin & raw scale
  let originX = 0;
  let originY = 0;
  let baseScale = 1;

  if (bc.cx != null && bc.cy != null) {
    originX = Number(bc.cx);
    originY = Number(bc.cy);
    if (Math.max(dataRx, dataRy) <= 1.2) {
      baseScale = Math.abs(originX - 0.5) < 0.2 ? 276 : 124;
    } else if (Math.abs(originX - 50) < 15 && Math.max(dataRx, dataRy) <= 55) {
      baseScale = 2.6;
    }
  } else if (Math.max(dataRx, dataRy) <= 1.25) {
    // Normalized coordinates: either [-1, 1] or [0, 1]
    if (!hasNegative && count > 0 && avgX > 0.25 && avgX < 0.75 && avgY > 0.25 && avgY < 0.75 && dataRx <= 0.52) {
      originX = 0.5;
      originY = 0.5;
      baseScale = 270;
    } else {
      originX = 0;
      originY = 0;
      baseScale = 122;
    }
  } else if (!hasNegative && count > 0 && avgX > 105 && avgX < 215 && avgY > 105 && avgY < 215) {
    // Canvas pixel space [0, 320]
    originX = 160;
    originY = 160;
    baseScale = 1;
  } else if (!hasNegative && count > 0 && avgX > 32 && avgX < 68 && avgY > 32 && avgY < 68 && Math.max(dataRx, dataRy) <= 52) {
    // Percentage space [0, 100]
    originX = 50;
    originY = 50;
    baseScale = 2.6;
  } else {
    // Centered pixel space [-160, 160]
    originX = 0;
    originY = 0;
    baseScale = 1;
  }

  // Compute dual-limb center offset & per-limb radius in data space
  let effLimbRx = dataRx;
  let dataLimbOffset = 0;
  if (isDual) {
    const explicitOffset =
      bc.limbOffset ??
      bc.limbOffsetX ??
      bc.dualOffset ??
      bc.offsetX ??
      bc.cxOffset ??
      (bc.limbGap != null ? dataRx + Number(bc.limbGap) * 0.5 : null);

    if (explicitOffset != null && Number.isFinite(Number(explicitOffset))) {
      dataLimbOffset = Math.abs(Number(explicitOffset));
    } else if (dataRx > dataRy * 1.48) {
      // Combined dual-limb width was provided as total half-width; split into two realistic limb ovals
      effLimbRx = dataRx * 0.45;
      dataLimbOffset = dataRx * 0.54;
    } else {
      // Infer cleanly from right/left bilateral shapes when explicit offset omitted
      let posMin = Infinity;
      let posMax = -Infinity;
      let posCount = 0;
      for (let i = 0; i < rawShapes.length; i++) {
        const s = rawShapes[i];
        const dx = Number(s.x ?? s.cx ?? 0) - originX;
        const r = Number(s.rx ?? s.r ?? 0);
        if (dx > 0.001) {
          if (dx - r < posMin) posMin = dx - r;
          if (dx + r > posMax) posMax = dx + r;
          posCount += 1;
        }
      }
      if (posCount > 0 && Number.isFinite(posMin) && Number.isFinite(posMax)) {
        const mid = (posMin + posMax) * 0.5;
        dataLimbOffset = Math.max(effLimbRx * 1.08, mid);
      } else {
        dataLimbOffset = effLimbRx * 1.18;
      }
    }
  }

  // Gentle auto-fit so outer contour never clips the radiological A/P/R/L markers
  const extentX = (isDual ? dataLimbOffset + effLimbRx : effLimbRx) * baseScale;
  const extentY = dataRy * baseScale;
  const maxExtent = Math.max(extentX, extentY, 1);
  const fitFactor = maxExtent > SAFE_RADIUS ? SAFE_RADIUS / maxExtent : 1;
  const scale = baseScale * fitFactor;

  return {
    originX,
    originY,
    scale,
    isDual,
    rx: effLimbRx * scale,
    ry: dataRy * scale,
    limbOffset: dataLimbOffset * scale,
    rawShapes,
    toCanvasX: (x) => HALF + (Number(x) - originX) * scale,
    toCanvasY: (y) => HALF + (Number(y) - originY) * scale,
    toCanvasR: (r) => Math.max(1.2, Math.abs(Number(r)) * scale),
  };
}

function normalizeRotation(rot) {
  if (rot == null || !Number.isFinite(Number(rot))) return 0;
  const r = Number(rot);
  return Math.abs(r) > Math.PI * 2 + 0.01 ? (r * Math.PI) / 180 : r;
}

function createNoiseCanvas() {
  const off = document.createElement('canvas');
  off.width = CW;
  off.height = CH;
  const octx = off.getContext('2d');
  const img = octx.createImageData(CW, CH);
  const data = img.data;
  // Deterministic LCG for crisp zero-flicker radiological film grain
  let seed = 133791;
  for (let i = 0; i < data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const v = (seed >>> 24) & 255;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 255;
  }
  octx.putImageData(img, 0, 0);
  return off;
}

/* ==========================================================================
   MAIN COMPONENT
   ========================================================================== */

export default function AxialSliceViewer({
  sliceHeightPct = 68,
  onChangeSliceHeightPct,
  gender = 'male',
  hr = 76,
  rr = 15,
  selectedStructureId = null,
  hoveredStructureId = null,
  onSelectStructure,
  onHoverStructure,
}) {
  const [imagingMode, setImagingMode] = useState('anatomical'); // 'anatomical' | 'ct' | 'mri'
  const [tooltip, setTooltip] = useState(null);

  const canvasRef = useRef(null);
  const noiseCanvasRef = useRef(null);
  const renderedShapesRef = useRef([]);
  const femaleBlendRef = useRef(gender === 'female' ? 1 : 0);

  // Normalize slice list & sort head-to-toe for intuitive chip order
  const slices = useMemo(() => {
    const raw = Array.isArray(AXIAL_SLICE_LEVELS)
      ? AXIAL_SLICE_LEVELS
      : Object.values(AXIAL_SLICE_LEVELS || {});
    return [...raw].sort((a, b) => getSliceHeightPct(b) - getSliceHeightPct(a));
  }, []);

  const clampedHeightPct = useMemo(() => {
    const n = Number(sliceHeightPct);
    if (!Number.isFinite(n)) return 68;
    return Math.max(15, Math.min(95, Math.round(n)));
  }, [sliceHeightPct]);

  // Nearest slice matching
  const activeSlice = useMemo(() => {
    if (!slices.length) return null;
    let best = slices[0];
    let bestDist = Math.abs(getSliceHeightPct(best) - clampedHeightPct);
    for (let i = 1; i < slices.length; i++) {
      const d = Math.abs(getSliceHeightPct(slices[i]) - clampedHeightPct);
      if (d < bestDist) {
        best = slices[i];
        bestDist = d;
      }
    }
    return best;
  }, [slices, clampedHeightPct]);

  // Unique structures visible in current slice for quick-identify pills
  const sliceStructurePills = useMemo(() => {
    if (!activeSlice || !Array.isArray(activeSlice.shapes)) return [];
    const seen = new Set();
    const list = [];
    for (let i = 0; i < activeSlice.shapes.length; i++) {
      const sh = activeSlice.shapes[i];
      if (!sh) continue;
      const sid = sh.structureId || sh.id;
      if (!sid || seen.has(sid)) continue;
      seen.add(sid);
      const st = ATLAS_STRUCTURES_MAP?.[sid] || null;
      const tissue = classifyTissue(sh, st);
      const labelHe = sh.labelHe || sh.nameHe || sh.label || st?.nameHe || st?.titleHe || sid;
      const huLabel = getHuLabel(sh, st, tissue);
      const color = inferAnatomicalColor(sh, st, tissue);
      list.push({
        structureId: sid,
        labelHe,
        nameEn: st?.nameEn || st?.latin || '',
        huLabel,
        color,
        tissue,
        pulseType: sh.pulseType || null,
      });
    }
    return list;
  }, [activeSlice]);

  // Keep latest reactive values in ref for continuous 60 FPS loop
  const stateRef = useRef({
    activeSlice,
    clampedHeightPct,
    gender,
    hr,
    rr,
    imagingMode,
    selectedStructureId,
    hoveredStructureId,
  });

  stateRef.current = {
    activeSlice,
    clampedHeightPct,
    gender,
    hr,
    rr,
    imagingMode,
    selectedStructureId,
    hoveredStructureId,
  };

  // High-DPI 60FPS HTML5 Canvas Renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = CW * dpr;
    canvas.height = CH * dpr;

    if (!noiseCanvasRef.current) {
      noiseCanvasRef.current = createNoiseCanvas();
    }

    let rafId = 0;
    let lastTs = 0;
    let cardiacPhase = 0;
    let respPhase = 0;
    let clock = 0;

    function drawBodyContourEllipse(cx, cy, rx, ry, mode, femBlend, isDual) {
      const fatFrac = 0.082 + femBlend * 0.026;
      const skinThick = Math.max(2.2, Math.min(3.8, Math.min(rx, ry) * 0.045));
      const fatRx = Math.max(4, rx - skinThick);
      const fatRy = Math.max(4, ry - skinThick);
      const muscRx = Math.max(3, fatRx * (1 - fatFrac));
      const muscRy = Math.max(3, fatRy * (1 - fatFrac));

      ctx.save();

      // 1. Outer Epidermis / Dermis contour
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      if (mode === 'ct') {
        ctx.fillStyle = '#4e5764';
        ctx.fill();
        ctx.strokeStyle = 'rgba(180, 194, 212, 0.36)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      } else if (mode === 'mri') {
        ctx.fillStyle = '#556275';
        ctx.fill();
        ctx.strokeStyle = 'rgba(205, 220, 240, 0.28)';
        ctx.lineWidth = 1.1;
        ctx.stroke();
      } else {
        const skinGrad = ctx.createRadialGradient(
          cx - rx * 0.25,
          cy - ry * 0.25,
          rx * 0.1,
          cx,
          cy,
          Math.max(rx, ry) * 1.05
        );
        skinGrad.addColorStop(0, '#e0ac8c');
        skinGrad.addColorStop(0.75, '#c68a68');
        skinGrad.addColorStop(1, '#9f684c');
        ctx.fillStyle = skinGrad;
        ctx.fill();
        ctx.strokeStyle = 'rgba(248, 212, 186, 0.42)';
        ctx.lineWidth = 1.1;
        ctx.stroke();
      }

      // 2. Subcutaneous Adipose Rim (שומן תת-עורי)
      ctx.beginPath();
      ctx.ellipse(cx, cy, fatRx, fatRy, 0, 0, Math.PI * 2);
      if (mode === 'ct') {
        // Fat is -100 HU -> distinctly dark radiological gray on CT!
        const ctFat = ctx.createRadialGradient(cx, cy, muscRx * 0.7, cx, cy, Math.max(fatRx, fatRy));
        ctFat.addColorStop(0, '#2a313b');
        ctFat.addColorStop(1, '#1f252e');
        ctx.fillStyle = ctFat;
        ctx.fill();
      } else if (mode === 'mri') {
        // Fat is hyperintense bright on T2-weighted MRI!
        const mriFat = ctx.createRadialGradient(cx, cy, muscRx * 0.7, cx, cy, Math.max(fatRx, fatRy));
        mriFat.addColorStop(0, '#cfd9e6');
        mriFat.addColorStop(1, '#aebcd0');
        ctx.fillStyle = mriFat;
        ctx.fill();
      } else {
        const fatGrad = ctx.createRadialGradient(
          cx - fatRx * 0.2,
          cy - fatRy * 0.2,
          fatRx * 0.15,
          cx,
          cy,
          Math.max(fatRx, fatRy)
        );
        fatGrad.addColorStop(0, '#f0c96f');
        fatGrad.addColorStop(0.7, '#d9a848');
        fatGrad.addColorStop(1, '#b5842e');
        ctx.fillStyle = fatGrad;
        ctx.fill();
        // Delicate subcutaneous lobule ring
        ctx.strokeStyle = 'rgba(255, 236, 179, 0.22)';
        ctx.lineWidth = 0.8;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 3. Deep Fascia + Skeletal Muscle Bed (שרירים עמוקים ופאשיה)
      ctx.beginPath();
      ctx.ellipse(cx, cy, muscRx, muscRy, 0, 0, Math.PI * 2);
      if (mode === 'ct') {
        // Muscle ~ +45 to +55 HU -> soft-tissue medium gray
        const ctMusc = ctx.createRadialGradient(cx, cy, 4, cx, cy, Math.max(muscRx, muscRy));
        ctMusc.addColorStop(0, '#5a6370');
        ctMusc.addColorStop(0.75, '#6d7785');
        ctMusc.addColorStop(1, '#555f6c');
        ctx.fillStyle = ctMusc;
        ctx.fill();
        ctx.strokeStyle = 'rgba(180, 192, 208, 0.24)';
        ctx.lineWidth = 0.9;
        ctx.stroke();
      } else if (mode === 'mri') {
        // Muscle is dark-intermediate on T2-W MRI
        const mriMusc = ctx.createRadialGradient(cx, cy, 4, cx, cy, Math.max(muscRx, muscRy));
        mriMusc.addColorStop(0, '#364152');
        mriMusc.addColorStop(0.72, '#434f62');
        mriMusc.addColorStop(1, '#2c3645');
        ctx.fillStyle = mriMusc;
        ctx.fill();
        ctx.strokeStyle = 'rgba(20, 26, 36, 0.65)';
        ctx.lineWidth = 1.0;
        ctx.stroke();
      } else {
        const muscGrad = ctx.createRadialGradient(
          cx - muscRx * 0.18,
          cy - muscRy * 0.18,
          4,
          cx,
          cy,
          Math.max(muscRx, muscRy)
        );
        muscGrad.addColorStop(0, '#8d313d');
        muscGrad.addColorStop(0.68, '#6e222e');
        muscGrad.addColorStop(1, '#4c1620');
        ctx.fillStyle = muscGrad;
        ctx.fill();
        // Crisp glistening deep fascia envelope
        ctx.strokeStyle = 'rgba(241, 224, 212, 0.34)';
        ctx.lineWidth = 1.05;
        ctx.stroke();
      }

      // 4. Subtle Intermuscular Fascial Septa & Myofibril Texture inside Muscle Bed
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cy, muscRx, muscRy, 0, 0, Math.PI * 2);
      ctx.clip();

      const septaColor =
        mode === 'ct'
          ? 'rgba(30, 36, 44, 0.28)'
          : mode === 'mri'
            ? 'rgba(195, 208, 226, 0.14)'
            : 'rgba(235, 198, 178, 0.12)';
      ctx.strokeStyle = septaColor;
      ctx.lineWidth = 0.85;

      // Concentric fascial lamina
      ctx.beginPath();
      ctx.ellipse(cx, cy, muscRx * 0.84, muscRy * 0.84, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Intermuscular septa lines (bilateral compartment lines for limbs, sagittal/coronal raphes for torso)
      const septaAngles = isDual
        ? [0.35, 1.35, 2.55, 3.65, 4.95]
        : [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5, 0.6, 2.54, 3.74, 5.68];
      for (let i = 0; i < septaAngles.length; i++) {
        const a = septaAngles[i];
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * muscRx * 0.25, cy + Math.sin(a) * muscRy * 0.25);
        ctx.lineTo(cx + Math.cos(a) * muscRx * 0.99, cy + Math.sin(a) * muscRy * 0.99);
        ctx.stroke();
      }

      ctx.restore();
      ctx.restore();
    }

    function drawSingleShape(item, mode, arterialWave, breathWave, isSelected, isHovered, pulseGlow) {
      const {
        structureId,
        type,
        cx,
        cy,
        rx,
        ry,
        innerRx,
        innerRy,
        rot,
        tissue,
        hu,
        anatColor,
        ctGray,
        mriGray,
        ctColor,
        mriColor,
        pulseType,
        hasInnerNestedShape,
        opacity,
      } = item;

      ctx.save();
      ctx.translate(cx, cy);
      if (rot) ctx.rotate(rot);
      if (opacity != null && opacity < 1) ctx.globalAlpha = opacity;

      // Determine mode-specific fill & edge colors
      let baseRgb;
      let edgeRgb;
      let innerMarrowRgb = null;

      if (mode === 'ct') {
        if (typeof ctGray === 'number' && Number.isFinite(ctGray)) {
          const gVal = Math.max(4, Math.min(255, Math.round(ctGray)));
          baseRgb = [gVal, Math.min(255, gVal + 1), Math.min(255, gVal + 3)];
        } else {
          baseRgb = ctColor ? parseColorToRgb(ctColor) : huToCtRgb(hu);
        }
        // Enhance contrast pulse for contrast-filled heart/arteries during systole
        if (pulseType === 'artery' || pulseType === 'heart') {
          baseRgb = shadeRgb(baseRgb, Math.round(arterialWave * 16));
        }
        edgeRgb = tissue === 'bone' ? [255, 255, 255] : shadeRgb(baseRgb, tissue === 'air' || tissue === 'lung' ? 28 : 22);
        if (tissue === 'bone') innerMarrowRgb = [138, 148, 160]; // Trabecular marrow ~ +180 HU
        if (tissue === 'air') innerMarrowRgb = [5, 7, 10];
      } else if (mode === 'mri') {
        if (typeof mriGray === 'number' && Number.isFinite(mriGray)) {
          const mVal = Math.max(6, Math.min(255, Math.round(mriGray)));
          baseRgb = [mVal, Math.min(255, mVal + 2), Math.min(255, mVal + 6)];
          edgeRgb = shadeRgb(baseRgb, mVal < 60 ? 34 : 20);
          innerMarrowRgb = tissue === 'bone' ? [152, 166, 184] : shadeRgb(baseRgb, -14);
        } else {
          const t2 = tissueToMriT2Style({ mriColor }, tissue);
          baseRgb = t2.fill;
          edgeRgb = t2.edge;
          innerMarrowRgb = t2.innerFill;
        }
      } else {
        baseRgb = parseColorToRgb(anatColor);
        if (pulseType === 'artery') {
          baseRgb = shadeRgb(baseRgb, Math.round(arterialWave * 22));
        } else if (pulseType === 'heart') {
          baseRgb = shadeRgb(baseRgb, Math.round(arterialWave * 14));
        }
        edgeRgb =
          tissue === 'artery'
            ? [254, 180, 180]
            : tissue === 'vein'
              ? [147, 197, 253]
              : tissue === 'bone'
                ? [255, 250, 236]
                : shadeRgb(baseRgb, 34);
        if (tissue === 'bone') innerMarrowRgb = [166, 98, 86]; // Red bone marrow
        if (tissue === 'air') innerMarrowRgb = [14, 22, 36];
      }

      const maxR = Math.max(rx, ry, 2);

      if (type === 'ring') {
        // Fill interior only if NO other nested structure sits inside this ring (e.g., femur shaft marrow or trachea lumen)
        if (!hasInnerNestedShape && innerMarrowRgb && innerRx > 1.5 && innerRy > 1.5) {
          ctx.beginPath();
          ctx.ellipse(0, 0, innerRx + 0.5, innerRy + 0.5, 0, 0, Math.PI * 2);
          const innerGrad = ctx.createRadialGradient(-innerRx * 0.2, -innerRy * 0.2, 0.5, 0, 0, Math.max(innerRx, innerRy));
          innerGrad.addColorStop(0, rgbStr(shadeRgb(innerMarrowRgb, 16)));
          innerGrad.addColorStop(1, rgbStr(shadeRgb(innerMarrowRgb, -18)));
          ctx.fillStyle = innerGrad;
          ctx.fill();
        }

        // Draw annular cortical/cartilage ring using evenodd rule so nested brain/cord stays 100% crisp!
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        if (innerRx > 0.8 && innerRy > 0.8) {
          ctx.moveTo(innerRx, 0);
          ctx.ellipse(0, 0, innerRx, innerRy, 0, 0, Math.PI * 2, true);
        }

        const ringGrad = ctx.createRadialGradient(-rx * 0.22, -ry * 0.22, innerRx * 0.5, 0, 0, maxR * 1.05);
        ringGrad.addColorStop(0, rgbStr(shadeRgb(baseRgb, mode === 'anatomical' ? 24 : 14)));
        ringGrad.addColorStop(0.65, rgbStr(baseRgb));
        ringGrad.addColorStop(1, rgbStr(shadeRgb(baseRgb, mode === 'anatomical' ? -24 : -14)));
        ctx.fillStyle = ringGrad;
        ctx.fill('evenodd');

        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.strokeStyle = rgbStr(edgeRgb, mode === 'ct' && tissue === 'bone' ? 0.9 : 0.55);
        ctx.lineWidth = mode === 'ct' && tissue === 'bone' ? 1.25 : 0.95;
        ctx.stroke();
      } else {
        // Solid 'ellipse' or 'circle' with sculpted 3D bevel gradient
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);

        const grad = ctx.createRadialGradient(
          -rx * 0.28,
          -ry * 0.28,
          maxR * 0.08,
          0,
          0,
          maxR * 1.06
        );
        if (mode === 'anatomical') {
          grad.addColorStop(0, rgbStr(shadeRgb(baseRgb, 36)));
          grad.addColorStop(0.55, rgbStr(baseRgb));
          grad.addColorStop(1, rgbStr(shadeRgb(baseRgb, -34)));
        } else if (mode === 'ct') {
          grad.addColorStop(0, rgbStr(shadeRgb(baseRgb, 14)));
          grad.addColorStop(0.7, rgbStr(baseRgb));
          grad.addColorStop(1, rgbStr(shadeRgb(baseRgb, -16)));
        } else {
          grad.addColorStop(0, rgbStr(shadeRgb(baseRgb, 18)));
          grad.addColorStop(0.65, rgbStr(baseRgb));
          grad.addColorStop(1, rgbStr(shadeRgb(baseRgb, -18)));
        }

        ctx.fillStyle = grad;
        ctx.fill();

        // Histological & Radiological interior micro-detail clipped to shape
        ctx.save();
        ctx.clip();

        if (structureId === 'trachea' || tissue === 'air') {
          // Dark patent airway lumen inside tracheal cartilage ring
          ctx.fillStyle = mode === 'anatomical' ? 'rgba(9, 16, 29, 0.88)' : 'rgba(4, 6, 10, 0.92)';
          ctx.beginPath();
          ctx.ellipse(0, 0, rx * 0.72, ry * 0.72, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (tissue === 'lung' || pulseType === 'lung') {
          // Delicate pulmonary bronchial / vascular tree markings
          ctx.strokeStyle =
            mode === 'ct'
              ? 'rgba(130, 148, 168, 0.24)'
              : mode === 'mri'
                ? 'rgba(100, 118, 142, 0.16)'
                : 'rgba(225, 168, 178, 0.26)';
          ctx.lineWidth = 0.9;
          const bScale = 1 + (breathWave - 0.5) * 0.06;
          for (let b = -1; b <= 1; b++) {
            ctx.beginPath();
            ctx.moveTo(0, b * ry * 0.22);
            ctx.quadraticCurveTo(rx * 0.35 * bScale, b * ry * 0.4, rx * 0.68 * bScale, (b * 0.55 - 0.12) * ry);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, b * ry * 0.22);
            ctx.quadraticCurveTo(-rx * 0.35 * bScale, b * ry * 0.36, -rx * 0.62 * bScale, (b * 0.5 + 0.14) * ry);
            ctx.stroke();
          }
        } else if (pulseType === 'heart' || tissue === 'heart') {
          // Ventricular myocardial chamber cavity hint (LV + RV) synced with systole
          const lumenShrink = 1 - arterialWave * 0.22;
          ctx.fillStyle =
            mode === 'ct'
              ? `rgba(228, 238, 248, ${0.42 + arterialWave * 0.22})`
              : mode === 'mri'
                ? 'rgba(18, 26, 38, 0.72)'
                : `rgba(110, 14, 26, ${0.48 + arterialWave * 0.16})`;
          ctx.beginPath();
          ctx.ellipse(rx * 0.2, ry * 0.08, rx * 0.34 * lumenShrink, ry * 0.32 * lumenShrink, -0.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(-rx * 0.24, -ry * 0.12, rx * 0.26 * lumenShrink, ry * 0.22 * lumenShrink, 0.25, 0, Math.PI * 2);
          ctx.fill();
          // Interventricular septum sheen
          ctx.strokeStyle = mode === 'anatomical' ? 'rgba(255, 185, 195, 0.28)' : 'rgba(160, 175, 194, 0.28)';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(-rx * 0.06, -ry * 0.45);
          ctx.quadraticCurveTo(rx * 0.02, 0, -rx * 0.08, ry * 0.48);
          ctx.stroke();
        } else if (tissue === 'artery' || pulseType === 'artery') {
          // Arterial tunica intima specular highlight
          ctx.fillStyle =
            mode === 'ct'
              ? `rgba(255, 255, 255, ${0.32 + arterialWave * 0.25})`
              : mode === 'mri'
                ? 'rgba(10, 14, 22, 0.45)'
                : `rgba(255, 220, 220, ${0.35 + arterialWave * 0.28})`;
          ctx.beginPath();
          ctx.ellipse(-rx * 0.24, -ry * 0.24, Math.max(1, rx * 0.34), Math.max(1, ry * 0.34), 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (tissue === 'brain') {
          // Subtle cortical sulci folds
          ctx.strokeStyle =
            mode === 'mri'
              ? 'rgba(232, 244, 255, 0.38)'
              : mode === 'ct'
                ? 'rgba(54, 62, 74, 0.38)'
                : 'rgba(122, 78, 72, 0.26)';
          ctx.lineWidth = 1;
          for (let g = -2; g <= 2; g++) {
            ctx.beginPath();
            ctx.arc(g * rx * 0.22, -ry * 0.15 + Math.abs(g) * 4, rx * 0.26, 0.2, Math.PI - 0.2);
            ctx.stroke();
          }
        } else if (tissue === 'bone' && rx > 5 && ry > 5) {
          // Trabecular marrow core inside solid bone ellipse
          ctx.fillStyle =
            mode === 'ct'
              ? 'rgba(138, 148, 162, 0.72)'
              : mode === 'mri'
                ? 'rgba(164, 178, 198, 0.85)'
                : 'rgba(176, 108, 92, 0.58)';
          ctx.beginPath();
          ctx.ellipse(0, 0, rx * 0.55, ry * 0.55, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (tissue === 'nerve' && rx >= 2.5) {
          // Nerve fascicle micro-dots
          ctx.fillStyle = mode === 'anatomical' ? 'rgba(254, 249, 195, 0.55)' : 'rgba(220, 232, 248, 0.35)';
          ctx.beginPath();
          ctx.arc(-rx * 0.25, -ry * 0.15, Math.max(0.8, rx * 0.2), 0, Math.PI * 2);
          ctx.arc(rx * 0.25, ry * 0.18, Math.max(0.8, rx * 0.2), 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();

        // Crisp organ capsule / vessel wall border
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.strokeStyle = rgbStr(edgeRgb, tissue === 'artery' ? 0.82 : 0.48);
        ctx.lineWidth = tissue === 'artery' ? 1.35 : 0.9;
        ctx.stroke();

        // Systolic arterial pulse ring effect
        if (pulseType === 'artery' && arterialWave > 0.22) {
          ctx.beginPath();
          ctx.ellipse(0, 0, rx + 2.2 + arterialWave * 2.8, ry + 2.2 + arterialWave * 2.8, 0, 0, Math.PI * 2);
          ctx.strokeStyle =
            mode === 'anatomical'
              ? `rgba(248, 113, 113, ${arterialWave * 0.42})`
              : `rgba(186, 230, 253, ${arterialWave * 0.35})`;
          ctx.lineWidth = 1.1;
          ctx.stroke();
        }
      }

      // Selection / Hover Glowing Cyan Highlight!
      if (isSelected || isHovered) {
        ctx.save();
        ctx.shadowColor = '#22d3ee';
        ctx.shadowBlur = isSelected ? 14 + pulseGlow * 6 : 10;
        ctx.strokeStyle = isSelected ? '#38bdf8' : '#67e8f9';
        ctx.lineWidth = isSelected ? 2.4 : 1.9;
        if (!isSelected && isHovered) {
          ctx.setLineDash([4, 2.5]);
        }
        ctx.beginPath();
        ctx.ellipse(0, 0, rx + 2.2, ry + 2.2, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        if (isSelected) {
          ctx.shadowBlur = 0;
          ctx.strokeStyle = `rgba(56, 189, 248, ${0.32 + pulseGlow * 0.35})`;
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.ellipse(0, 0, rx + 5.5 + pulseGlow * 2.5, ry + 5.5 + pulseGlow * 2.5, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      ctx.restore();
    }

    function drawCanvasCalloutLabel(item, mode) {
      if (!item) return;
      const shortHu = getCompactHu(item.huLabel);
      const text = mode === 'ct' && shortHu ? `${item.labelHe} • ${shortHu}` : item.labelHe;
      ctx.save();
      ctx.font = '700 10.5px "Segoe UI", "Heebo", Arial, sans-serif';
      const padX = 7;
      const boxH = 20;
      const textW = ctx.measureText(text).width;
      const boxW = Math.min(200, textW + padX * 2);

      // Anchor neatly above or below the shape without leaving canvas bounds
      let bx = item.cx - boxW * 0.5;
      let by = item.cy - item.ry - boxH - 10;
      if (by < 28) {
        by = item.cy + item.ry + 10;
      }
      if (by + boxH > CH - 28) {
        by = Math.max(28, CH - 28 - boxH);
      }
      bx = Math.max(22, Math.min(CW - 22 - boxW, bx));

      // Leader line from shape to label pill
      const anchorY = by < item.cy ? by + boxH : by;
      const anchorX = Math.max(bx + 8, Math.min(bx + boxW - 8, item.cx));
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(item.cx, item.cy);
      ctx.lineTo(anchorX, anchorY);
      ctx.stroke();

      // Anchor dot
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(item.cx, item.cy, 2.6, 0, Math.PI * 2);
      ctx.fill();

      // Rounded label pill
      traceRoundedRect(ctx, bx, by, boxW, boxH, 6);
      ctx.fillStyle = 'rgba(7, 14, 28, 0.92)';
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.15;
      ctx.stroke();

      ctx.fillStyle = '#e0f2fe';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, bx + boxW * 0.5, by + boxH * 0.5 + 0.5, boxW - 10);
      ctx.restore();
    }

    function drawRadiologicalHud(slice, heightPct, mode, genderNow, arterialWave, activeHuText) {
      ctx.save();

      // 1. Subtle CT / MRI Circular Scanner Bore Vignette & Film Grain
      if (mode === 'ct' || mode === 'mri') {
        if (noiseCanvasRef.current) {
          ctx.save();
          ctx.globalAlpha = mode === 'ct' ? 0.055 : 0.038;
          ctx.drawImage(noiseCanvasRef.current, 0, 0, CW, CH);
          ctx.restore();
        }

        const vig = ctx.createRadialGradient(HALF, HALF, 92, HALF, HALF, 168);
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(0.74, mode === 'ct' ? 'rgba(0,0,0,0.22)' : 'rgba(2,6,16,0.28)');
        vig.addColorStop(1, mode === 'ct' ? 'rgba(0,0,0,0.72)' : 'rgba(2,5,14,0.76)');
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, CW, CH);

        // Delicate circular gantry bore calibration circle
        ctx.strokeStyle = mode === 'ct' ? 'rgba(148, 163, 184, 0.16)' : 'rgba(56, 189, 248, 0.14)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(HALF, HALF, 144, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 2. Standard Radiological Orientation Letters: A (קדמי), P (אחורי), R (ימין המטופל), L (שמאל המטופל)
      const markerColor = mode === 'anatomical' ? '#7dd3fc' : '#cbd5e1';
      const subColor = mode === 'anatomical' ? 'rgba(148, 163, 184, 0.85)' : 'rgba(148, 163, 184, 0.72)';

      // Top: A (קדמי)
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = '800 11px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = markerColor;
      ctx.fillText('A', HALF, 5);
      ctx.font = '600 8.5px "Segoe UI", "Heebo", Arial, sans-serif';
      ctx.fillStyle = subColor;
      ctx.fillText('(קדמי)', HALF, 17);

      // Bottom: P (אחורי)
      ctx.textBaseline = 'bottom';
      ctx.font = '800 11px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = markerColor;
      ctx.fillText('P', HALF, CH - 15);
      ctx.font = '600 8.5px "Segoe UI", "Heebo", Arial, sans-serif';
      ctx.fillStyle = subColor;
      ctx.fillText('(אחורי)', HALF, CH - 4);

      // Left: R (ימין המטופל)
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = '800 11px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = markerColor;
      ctx.fillText('R', 7, HALF - 6);
      ctx.font = '600 7.8px "Segoe UI", "Heebo", Arial, sans-serif';
      ctx.fillStyle = subColor;
      ctx.fillText('ימין', 5, HALF + 6);
      ctx.fillText('המטופל', 5, HALF + 15);

      // Right: L (שמאל המטופל)
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.font = '800 11px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = markerColor;
      ctx.fillText('L', CW - 7, HALF - 6);
      ctx.font = '600 7.8px "Segoe UI", "Heebo", Arial, sans-serif';
      ctx.fillStyle = subColor;
      ctx.fillText('שמאל', CW - 5, HALF + 6);
      ctx.fillText('המטופל', CW - 5, HALF + 15);

      // 3. Top-Right Corner: Slice Code & Height (e.g., T6 / 68%)
      const codeText = `${getSliceCode(slice)} / ${heightPct}%`;
      ctx.font = '700 9.5px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
      const codeW = ctx.measureText(codeText).width + 12;
      ctx.fillStyle = 'rgba(7, 13, 26, 0.78)';
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.42)';
      ctx.lineWidth = 1;
      traceRoundedRect(ctx, CW - codeW - 7, 7, codeW, 18, 5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#7dd3fc';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(codeText, CW - codeW * 0.5 - 7, 16.5);

      // 4. Top-Left Corner: Modality / Hounsfield Unit Badge + Live Pulse LED
      const compactActiveHu = getCompactHu(activeHuText);
      const modeBadgeText =
        mode === 'ct'
          ? compactActiveHu
            ? `CT • ${compactActiveHu}`
            : 'CT • HU'
          : mode === 'mri'
            ? 'MRI • T2-W'
            : 'ATLAS • 3D';
      ctx.font = '700 9.5px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
      const badgeW = ctx.measureText(modeBadgeText).width + 20;
      ctx.fillStyle = 'rgba(7, 13, 26, 0.78)';
      ctx.strokeStyle =
        mode === 'ct'
          ? 'rgba(226, 232, 240, 0.34)'
          : mode === 'mri'
            ? 'rgba(129, 140, 248, 0.45)'
            : 'rgba(16, 185, 129, 0.42)';
      traceRoundedRect(ctx, 7, 7, badgeW, 18, 5);
      ctx.fill();
      ctx.stroke();

      // Synced cardiac indicator dot
      ctx.fillStyle =
        mode === 'ct'
          ? `rgba(248, 250, 252, ${0.45 + arterialWave * 0.55})`
          : `rgba(56, 189, 248, ${0.45 + arterialWave * 0.55})`;
      ctx.beginPath();
      ctx.arc(15, 16, 2.6 + arterialWave * 0.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = mode === 'ct' ? '#f1f5f9' : '#bae6fd';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(modeBadgeText, 22, 16.5);

      // 5. Bottom-Left: Subtle Radiological Scale Ruler (5 ס"מ)
      const rulerX = 11;
      const rulerY = CH - 12;
      const rulerW = 54;
      ctx.strokeStyle = 'rgba(203, 213, 225, 0.65)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(rulerX, rulerY);
      ctx.lineTo(rulerX + rulerW, rulerY);
      for (let t = 0; t <= 5; t++) {
        const tx = rulerX + (rulerW / 5) * t;
        const th = t === 0 || t === 5 ? 5 : 2.8;
        ctx.moveTo(tx, rulerY - th);
        ctx.lineTo(tx, rulerY + 1);
      }
      ctx.stroke();
      ctx.font = '600 8.5px "Segoe UI", "Heebo", Arial, sans-serif';
      ctx.fillStyle = 'rgba(203, 213, 225, 0.78)';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText('5 ס"מ', rulerX, rulerY - 6);

      // 6. Bottom-Right: Plane & Gender Tag
      ctx.font = '600 8.5px "Segoe UI", "Heebo", Arial, sans-serif';
      ctx.fillStyle = 'rgba(148, 163, 184, 0.78)';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`AXIAL • ${genderNow === 'female' ? 'נקבה' : 'זכר'}`, CW - 10, CH - 7);

      ctx.restore();
    }

    const renderFrame = (ts) => {
      rafId = requestAnimationFrame(renderFrame);
      if (!lastTs) lastTs = ts;
      const dt = Math.min(0.05, (ts - lastTs) / 1000);
      lastTs = ts;
      clock += dt;

      const {
        activeSlice: slice,
        clampedHeightPct: hPct,
        gender: g,
        hr: curHr,
        rr: curRr,
        imagingMode: mode,
        selectedStructureId: selId,
        hoveredStructureId: hovId,
      } = stateRef.current;

      // Smooth gender morph interpolation
      const targetBlend = g === 'female' ? 1 : 0;
      femaleBlendRef.current += (targetBlend - femaleBlendRef.current) * Math.min(1, dt * 8);
      const femBlend = femaleBlendRef.current;

      // Advance cardiac & respiratory cycles
      cardiacPhase += Math.max(0.45, (Number(curHr) || 76) / 60) * dt;
      respPhase += Math.max(0.12, (Number(curRr) || 15) / 60) * dt;
      const arterialWave = computeArterialWave(cardiacPhase);
      const breathWave = 0.5 - 0.5 * Math.cos(respPhase * Math.PI * 2); // 0..1 smooth inspiration/expiration
      const pulseGlow = 0.5 + 0.5 * Math.sin(clock * 5.2);

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, CW, CH);

      // Background by imaging mode
      if (mode === 'ct') {
        ctx.fillStyle = '#020408';
        ctx.fillRect(0, 0, CW, CH);
      } else if (mode === 'mri') {
        const bg = ctx.createRadialGradient(HALF, HALF, 16, HALF, HALF, 185);
        bg.addColorStop(0, '#09101e');
        bg.addColorStop(1, '#020409');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, CW, CH);
      } else {
        const bg = ctx.createRadialGradient(HALF, HALF, 18, HALF, HALF, 190);
        bg.addColorStop(0, '#101d35');
        bg.addColorStop(0.7, '#091122');
        bg.addColorStop(1, '#050914');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, CW, CH);

        // Subtle anatomical coordinate reticle grid
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.055)';
        ctx.lineWidth = 0.8;
        for (let p = 32; p < CW; p += 32) {
          ctx.beginPath();
          ctx.moveTo(p, 0);
          ctx.lineTo(p, CH);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(0, p);
          ctx.lineTo(CW, p);
          ctx.stroke();
        }
      }

      // Faint radiological central crosshairs
      ctx.strokeStyle =
        mode === 'anatomical' ? 'rgba(56, 189, 248, 0.09)' : 'rgba(148, 163, 184, 0.08)';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(HALF, 26);
      ctx.lineTo(HALF, CH - 26);
      ctx.moveTo(26, HALF);
      ctx.lineTo(CW - 26, HALF);
      ctx.stroke();
      ctx.setLineDash([]);

      if (!slice) {
        ctx.restore();
        return;
      }

      const geom = buildSliceGeometryTransform(slice, femBlend);
      const hasLungs = geom.rawShapes.some((sh) => sh?.pulseType === 'lung');
      const chestBreathScale = hasLungs ? 1 + (breathWave - 0.5) * 0.022 : 1;

      // 1. Render Outer Body Contour(s) — Single Torso/Head/Neck OR Dual Bilateral Limbs
      if (geom.isDual) {
        drawBodyContourEllipse(
          HALF - geom.limbOffset,
          HALF,
          geom.rx,
          geom.ry,
          mode,
          femBlend,
          true
        );
        drawBodyContourEllipse(
          HALF + geom.limbOffset,
          HALF,
          geom.rx,
          geom.ry,
          mode,
          femBlend,
          true
        );
      } else {
        drawBodyContourEllipse(
          HALF,
          HALF,
          geom.rx * chestBreathScale,
          geom.ry * chestBreathScale,
          mode,
          femBlend,
          false
        );
      }

      // 2. Precompute screen-space geometry for every shape in slice.shapes
      const prepared = geom.rawShapes.map((sh, idx) => {
        const sid = sh.structureId || sh.id || `shape_${idx}`;
        const st = ATLAS_STRUCTURES_MAP?.[sid] || null;
        const tissue = classifyTissue(sh, st);
        const type = String(sh.type || sh.kind || (sh.r != null && sh.rx == null ? 'circle' : 'ellipse')).toLowerCase();

        // Smooth gender-specific shift & scale morphing (e.g., femaleShiftX / femaleScaleX)
        const shiftX = (Number(sh.femaleShiftX) || 0) * femBlend;
        const shiftY = (Number(sh.femaleShiftY) || 0) * femBlend;
        const fScaleX = 1 + ((Number(sh.femaleScaleX) || 1) - 1) * femBlend;
        const fScaleY = 1 + ((Number(sh.femaleScaleY) || 1) - 1) * femBlend;

        const cx = geom.toCanvasX((Number(sh.x ?? sh.cx ?? 0)) + shiftX);
        const cy = geom.toCanvasY((Number(sh.y ?? sh.cy ?? 0)) + shiftY);
        const rot = normalizeRotation(sh.rot ?? sh.rotation ?? 0);

        let rx = geom.toCanvasR((sh.rx ?? sh.r ?? 10) * fScaleX);
        let ry = geom.toCanvasR((sh.ry ?? sh.r ?? 10) * fScaleY);
        const pulseType = sh.pulseType || null;

        // Apply physiological motion synced to HR & RR
        if (pulseType === 'heart') {
          const heartScale = 1 - arterialWave * 0.088;
          rx *= heartScale;
          ry *= heartScale;
        } else if (pulseType === 'artery') {
          const arteryScale = 1 + arterialWave * 0.145;
          rx *= arteryScale;
          ry *= arteryScale;
        } else if (pulseType === 'lung') {
          rx *= 1 + (breathWave - 0.5) * 0.075;
          ry *= 1 + (breathWave - 0.5) * 0.095;
        }

        let innerRx = 0;
        let innerRy = 0;
        if (type === 'ring') {
          const explicitThick = sh.thickness ?? sh.ringWidth ?? sh.strokeWidth ?? sh.lineWidth;
          if (sh.innerRx != null || sh.innerRy != null) {
            innerRx = geom.toCanvasR((sh.innerRx ?? sh.innerR ?? 0) * fScaleX);
            innerRy = geom.toCanvasR((sh.innerRy ?? sh.innerR ?? 0) * fScaleY);
          } else if (sh.innerR != null) {
            innerRx = geom.toCanvasR(sh.innerR * fScaleX);
            innerRy = geom.toCanvasR(sh.innerR * fScaleY);
          } else if (explicitThick != null && Number.isFinite(Number(explicitThick))) {
            const rawT = Number(explicitThick);
            const tPx = rawT <= 1.2 && geom.scale > 20 ? rawT * geom.scale : rawT * Math.min(geom.scale, 1.4);
            innerRx = Math.max(1.2, rx - tPx);
            innerRy = Math.max(1.2, ry - tPx);
          } else {
            // Anatomically authentic annular wall thickness for cranium, ribcage, skin envelope, diaphragm
            const minDim = Math.min(rx, ry);
            let wallPx;
            if (sid === 'skin_envelope') {
              wallPx = Math.max(5.5, Math.min(9.5, minDim * 0.1)) + femBlend * 1.4;
            } else if (sid === 'skull') {
              wallPx = Math.max(6.5, Math.min(9.2, minDim * 0.115));
            } else if (sid === 'ribcage') {
              wallPx = Math.max(4.5, Math.min(6.4, minDim * 0.085));
            } else if (sid === 'diaphragm') {
              wallPx = Math.max(3.4, Math.min(5.0, minDim * 0.07));
            } else {
              wallPx = Math.max(4.0, Math.min(8.5, minDim * 0.13));
            }
            innerRx = Math.max(1.5, rx - wallPx);
            innerRy = Math.max(1.5, ry - wallPx);
          }
        }

        const parsedHu = parseHuNumber(sh, st);
        const hu = parsedHu !== null ? parsedHu : inferDefaultHu(tissue);
        const huLabel = getHuLabel(sh, st, tissue);
        const labelHe = sh.labelHe || sh.nameHe || sh.label || st?.nameHe || st?.titleHe || sid;

        return {
          idx,
          structureId: sid,
          labelHe,
          nameEn: st?.nameEn || st?.latin || '',
          hu,
          huLabel,
          tissue,
          type,
          cx,
          cy,
          rx,
          ry,
          innerRx,
          innerRy,
          rot,
          pulseType,
          anatColor: inferAnatomicalColor(sh, st, tissue),
          ctGray: typeof sh.ctGray === 'number' ? sh.ctGray : null,
          mriGray: typeof sh.mriGray === 'number' ? sh.mriGray : null,
          ctColor: sh.ctColor || sh.ctShade || null,
          mriColor: sh.mriColor || sh.mriT2 || null,
          opacity: sh.opacity,
          hasInnerNestedShape: false,
        };
      });

      // Detect whether any ring encloses another anatomical shape (e.g., cranium around brain)
      for (let i = 0; i < prepared.length; i++) {
        const ring = prepared[i];
        if (ring.type !== 'ring' || ring.innerRx < 3) continue;
        for (let j = 0; j < prepared.length; j++) {
          if (i === j) continue;
          const other = prepared[j];
          const dx = other.cx - ring.cx;
          const dy = other.cy - ring.cy;
          const normDist =
            (dx * dx) / Math.max(1, ring.innerRx * ring.innerRx) +
            (dy * dy) / Math.max(1, ring.innerRy * ring.innerRy);
          if (normDist < 0.72) {
            ring.hasInnerNestedShape = true;
            break;
          }
        }
      }

      // Save screen-space shapes for exact reverse-order pointer picking
      renderedShapesRef.current = prepared;

      // 3. Draw every shape in order (re-draw highlighted shape outline crisp on top!)
      let selectedItemForCallout = null;
      let activeHuReadout = null;

      for (let i = 0; i < prepared.length; i++) {
        const item = prepared[i];
        const isSel = Boolean(selId && item.structureId === selId);
        const isHov = Boolean(hovId && item.structureId === hovId);
        drawSingleShape(item, mode, arterialWave, breathWave, isSel, isHov, pulseGlow);
        if (isSel) {
          selectedItemForCallout = item;
          activeHuReadout = item.huLabel;
        }
        if (isHov) {
          activeHuReadout = item.huLabel;
        }
      }

      // 4. Draw crisp on-canvas callout pill for active selected structure (or hovered when none selected)
      const calloutTarget =
        selectedItemForCallout ||
        (hovId ? prepared.find((p) => p.structureId === hovId) : null);
      if (calloutTarget) {
        drawCanvasCalloutLabel(calloutTarget, mode);
      }

      // 5. Render Radiological HUD (CT/MRI grain, vignette, A/P/R/L, ruler, code badge)
      drawRadiologicalHud(slice, hPct, mode, g, arterialWave, activeHuReadout);

      ctx.restore();
    };

    rafId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(rafId);
  }, []);

  /* ==========================================================================
     REVERSE DRAW-ORDER INTERACTIVE POINTER PICKING
     ========================================================================== */

  const pickShapeAtPointer = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    const px = ((event.clientX - rect.left) / rect.width) * CW;
    const py = ((event.clientY - rect.top) / rect.height) * CH;
    const items = renderedShapesRef.current;

    // Reverse draw order: front-most organ/vessel picked first!
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      const dx = px - item.cx;
      const dy = py - item.cy;
      const cosR = Math.cos(-item.rot);
      const sinR = Math.sin(-item.rot);
      const lx = dx * cosR - dy * sinR;
      const ly = dx * sinR + dy * cosR;

      const pad = Math.min(item.rx, item.ry) < 9 ? 4.5 : 2.5;
      const outRx = item.rx + pad;
      const outRy = item.ry + pad;
      const outEq = (lx * lx) / (outRx * outRx) + (ly * ly) / (outRy * outRy);

      if (outEq <= 1) {
        if (item.type === 'ring' && item.hasInnerNestedShape && item.innerRx > 5 && item.innerRy > 5) {
          const inRx = Math.max(1, item.innerRx - 3.5);
          const inRy = Math.max(1, item.innerRy - 3.5);
          const inEq = (lx * lx) / (inRx * inRx) + (ly * ly) / (inRy * inRy);
          if (inEq < 1) continue; // Let inner organs remain clickable even if ring drawn later
        }
        return { item, px, py };
      }
    }
    return null;
  };

  const handlePointerMove = (e) => {
    const hit = pickShapeAtPointer(e);
    if (hit) {
      const { item, px, py } = hit;
      if (hoveredStructureId !== item.structureId) {
        onHoverStructure?.(item.structureId);
      }
      setTooltip({
        xPct: (px / CW) * 100,
        yPct: (py / CH) * 100,
        structureId: item.structureId,
        labelHe: item.labelHe,
        nameEn: item.nameEn,
        huLabel: item.huLabel,
        color: item.anatColor,
      });
    } else {
      if (hoveredStructureId !== null) {
        onHoverStructure?.(null);
      }
      if (tooltip) setTooltip(null);
    }
  };

  const handlePointerLeave = () => {
    setTooltip(null);
    onHoverStructure?.(null);
  };

  const handleCanvasClick = (e) => {
    const hit = pickShapeAtPointer(e);
    if (hit?.item?.structureId) {
      onSelectStructure?.(hit.item.structureId);
    }
  };

  const activeSliceCode = getSliceCode(activeSlice);
  const activeSlicePct = activeSlice ? getSliceHeightPct(activeSlice) : clampedHeightPct;

  return (
    <div
      className="axial-viewer-card"
      dir="rtl"
      style={{
        background: 'linear-gradient(180deg, #10192d 0%, #0b1324 100%)',
        border: '1px solid rgba(148, 163, 184, 0.18)',
        borderRadius: 14,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 14px 36px rgba(0, 0, 0, 0.45)',
        color: '#f1f5f9',
      }}
    >
      {/* HEADER: TITLE + 3 CLINICAL IMAGING MODE SWITCHER */}
      <div
        className="axial-header"
        style={{
          padding: '10px 12px',
          background: 'rgba(11, 19, 36, 0.92)',
          borderBottom: '1px solid rgba(148, 163, 184, 0.14)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div
          className="axial-header-top"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
                flexShrink: 0,
              }}
            >
              <Scan size={15} />
            </div>
            <div>
              <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#f8fafc', lineHeight: 1.2 }}>
                חתך אקסיאלי CT / MRI חי
              </div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                סריקה רוחבית מסונכרנת למודל ה-3D ולדופק
              </div>
            </div>
          </div>

          <div
            className="axial-vitals-mini"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '3px 8px',
              borderRadius: 99,
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid rgba(148, 163, 184, 0.18)',
              fontSize: '0.7rem',
              fontWeight: 700,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#fb7185' }}>
              <Heart size={11} /> {Math.round(hr)}
            </span>
            <span style={{ color: '#475569' }}>|</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#38bdf8' }}>
              <Wind size={11} /> {Math.round(rr)}
            </span>
          </div>
        </div>

        {/* 3 CLINICAL IMAGING MODES */}
        <div
          className="axial-mode-tabs"
          role="tablist"
          aria-label="מצב הדמיה קלינית"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 4,
            padding: 3,
            background: 'rgba(7, 13, 26, 0.88)',
            borderRadius: 9,
            border: '1px solid rgba(148, 163, 184, 0.14)',
          }}
        >
          {IMAGING_MODES.map((m) => {
            const Icon = m.icon;
            const active = imagingMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`axial-mode-btn ${active ? 'active' : ''}`}
                onClick={() => setImagingMode(m.id)}
                style={{
                  border: active ? '1px solid rgba(56, 189, 248, 0.55)' : '1px solid transparent',
                  background: active
                    ? 'linear-gradient(135deg, rgba(2, 132, 199, 0.42), rgba(14, 165, 233, 0.24))'
                    : 'transparent',
                  color: active ? '#e0f2fe' : '#94a3b8',
                  borderRadius: 7,
                  padding: '5px 6px',
                  fontSize: '0.72rem',
                  fontWeight: active ? 800 : 600,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  transition: 'all 0.16s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                <Icon size={12} />
                <span>{m.labelHe}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SLICE HEIGHT SLIDER (15% -> 95%) + QUICK LEVEL CHIPS */}
      <div
        className="axial-level-controls"
        style={{
          padding: '8px 12px',
          background: 'rgba(13, 22, 40, 0.78)',
          borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
          display: 'flex',
          flexDirection: 'column',
          gap: 7,
        }}
      >
        <div
          className="axial-slider-row"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, whiteSpace: 'nowrap' }}>
            גובה חתך:
          </span>
          <input
            type="range"
            className="axial-height-slider"
            min={15}
            max={95}
            step={1}
            dir="ltr"
            value={clampedHeightPct}
            aria-label="גובה החתך האקסיאלי באחוזים"
            onChange={(e) => onChangeSliceHeightPct?.(Number(e.target.value))}
            style={{
              flex: 1,
              accentColor: '#38bdf8',
              cursor: 'pointer',
              height: 5,
            }}
          />
          <span
            className="axial-height-badge"
            style={{
              fontSize: '0.72rem',
              fontWeight: 800,
              color: '#7dd3fc',
              background: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.34)',
              borderRadius: 6,
              padding: '2px 7px',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              whiteSpace: 'nowrap',
            }}
          >
            {activeSliceCode} • {clampedHeightPct}%
          </span>
        </div>

        {/* QUICK CLICKABLE LEVEL CHIPS */}
        <div
          className="axial-level-chips"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
          }}
        >
          {slices.map((s) => {
            const sPct = getSliceHeightPct(s);
            const isActive = activeSlice && s.id === activeSlice.id;
            return (
              <button
                key={s.id || sPct}
                type="button"
                className={`axial-level-chip ${isActive ? 'active' : ''}`}
                onClick={() => onChangeSliceHeightPct?.(sPct)}
                title={`${s.titleHe || ''} (${sPct}%)`}
                style={{
                  border: isActive
                    ? '1px solid #38bdf8'
                    : '1px solid rgba(148, 163, 184, 0.2)',
                  background: isActive
                    ? 'rgba(14, 165, 233, 0.24)'
                    : 'rgba(22, 34, 58, 0.78)',
                  color: isActive ? '#e0f2fe' : '#cbd5e1',
                  borderRadius: 99,
                  padding: '2.5px 8px',
                  fontSize: '0.69rem',
                  fontWeight: isActive ? 800 : 600,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  transition: 'all 0.14s ease',
                  boxShadow: isActive ? '0 0 10px rgba(56, 189, 248, 0.26)' : 'none',
                }}
              >
                {getSliceChipLabel(s)}
              </button>
            );
          })}
        </div>
      </div>

      {/* HIGH-DPI 60FPS INTERACTIVE AXIAL CANVAS STAGE */}
      <div
        className="axial-canvas-stage"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 344,
          aspectRatio: '1 / 1',
          margin: '10px auto 6px',
          borderRadius: 12,
          overflow: 'hidden',
          background: '#03060d',
          border: '1px solid rgba(56, 189, 248, 0.24)',
          boxShadow: 'inset 0 0 28px rgba(0, 0, 0, 0.72), 0 8px 22px rgba(0, 0, 0, 0.45)',
          userSelect: 'none',
        }}
      >
        <canvas
          ref={canvasRef}
          className="axial-canvas"
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          onClick={handleCanvasClick}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            cursor: tooltip ? 'pointer' : 'crosshair',
          }}
        />

        {/* CRISP FLOATING HOVER TOOLTIP */}
        {tooltip && (
          <div
            className="axial-tooltip"
            style={{
              position: 'absolute',
              left: `${Math.max(18, Math.min(82, tooltip.xPct))}%`,
              top: tooltip.yPct < 28 ? `${tooltip.yPct + 8}%` : `${tooltip.yPct - 7}%`,
              transform: tooltip.yPct < 28 ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
              pointerEvents: 'none',
              zIndex: 10,
              background: 'rgba(7, 13, 26, 0.95)',
              border: '1px solid rgba(56, 189, 248, 0.72)',
              borderRadius: 9,
              padding: '5px 9px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.68)',
              backdropFilter: 'blur(6px)',
              minWidth: 132,
              maxWidth: 230,
              textAlign: 'right',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', fontWeight: 800, color: '#f8fafc' }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: tooltip.color,
                  border: '1px solid rgba(255,255,255,0.45)',
                  flexShrink: 0,
                }}
              />
              <span>
                {tooltip.labelHe} • <span style={{ color: '#7dd3fc', fontFamily: 'ui-monospace, monospace' }}>{tooltip.huLabel}</span>
              </span>
            </div>
            {tooltip.nameEn && (
              <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: 1 }}>
                {tooltip.nameEn}
              </div>
            )}
            <div style={{ fontSize: '0.62rem', color: '#38bdf8', marginTop: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
              <Crosshair size={9} /> לחץ למיקוד במודל ה-3D ובמדריך
            </div>
          </div>
        )}
      </div>

      {/* RADIOLOGICAL CALIBRATION SCALE BAR FOR CT / MRI MODES */}
      {imagingMode !== 'anatomical' && (
        <div
          className="axial-modality-legend"
          style={{
            margin: '0 12px 6px',
            padding: '5px 8px',
            borderRadius: 8,
            background: 'rgba(7, 13, 26, 0.76)',
            border: '1px solid rgba(148, 163, 184, 0.14)',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.65rem', color: '#94a3b8', fontWeight: 700 }}>
            <span>{imagingMode === 'ct' ? 'סולם צפיפות האונספילד (Hounsfield Units)' : 'עוצמת אות MRI משוקלל T2'}</span>
            <span style={{ color: '#7dd3fc', fontFamily: 'ui-monospace, monospace' }}>
              {imagingMode === 'ct' ? 'W:400 / L:40' : 'TR:4000 / TE:95'}
            </span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${imagingMode === 'ct' ? CT_HU_LEGEND.length : MRI_T2_LEGEND.length}, 1fr)`,
              gap: 2,
              borderRadius: 5,
              overflow: 'hidden',
            }}
          >
            {(imagingMode === 'ct' ? CT_HU_LEGEND : MRI_T2_LEGEND).map((stop, idx) => (
              <div
                key={idx}
                style={{
                  background: stop.bg,
                  color: stop.text,
                  padding: '2.5px 2px',
                  textAlign: 'center',
                  fontSize: '0.58rem',
                  fontWeight: 700,
                  lineHeight: 1.15,
                  border: '1px solid rgba(148, 163, 184, 0.16)',
                }}
              >
                <div>{stop.label}</div>
                <div style={{ opacity: 0.85, fontSize: '0.54rem', fontFamily: 'ui-monospace, monospace' }}>
                  {stop.hu || stop.signal}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* COMPACT CLINICAL SLICE SUMMARY FOOTER */}
      {activeSlice && (
        <div
          className="axial-footer"
          style={{
            padding: '10px 12px 12px',
            background: 'rgba(11, 19, 36, 0.94)',
            borderTop: '1px solid rgba(148, 163, 184, 0.14)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {/* Slice Title & Subtitle */}
          <div className="axial-slice-heading">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <h4 style={{ margin: 0, fontSize: '0.84rem', fontWeight: 800, color: '#e0f2fe' }}>
                {activeSlice.titleHe}
              </h4>
              <span
                style={{
                  fontSize: '0.67rem',
                  fontWeight: 700,
                  color: '#94a3b8',
                  fontFamily: 'ui-monospace, monospace',
                  whiteSpace: 'nowrap',
                }}
              >
                {activeSliceCode} ({activeSlicePct}%)
              </span>
            </div>
            {activeSlice.subtitleHe && (
              <div style={{ fontSize: '0.71rem', color: '#94a3b8', marginTop: 2 }}>
                {activeSlice.subtitleHe}
              </div>
            )}
          </div>

          {/* Clinical Note Callout */}
          {(activeSlice.clinicalNote || activeSlice.noteHe || activeSlice.descriptionHe) && (
            <div
              className="axial-clinical-note"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 7,
                padding: '7px 9px',
                borderRadius: 9,
                background: 'rgba(14, 165, 233, 0.09)',
                border: '1px solid rgba(56, 189, 248, 0.26)',
                fontSize: '0.72rem',
                lineHeight: 1.42,
                color: '#cbd5e1',
              }}
            >
              <Info size={14} style={{ color: '#38bdf8', flexShrink: 0, marginTop: 2 }} />
              <span>{activeSlice.clinicalNote || activeSlice.noteHe || activeSlice.descriptionHe}</span>
            </div>
          )}

          {/* Clickable Quick-Structure Pills for every visible structure in this slice */}
          <div className="axial-structures-section">
            <div
              style={{
                fontSize: '0.69rem',
                fontWeight: 700,
                color: '#94a3b8',
                marginBottom: 5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>מבנים נצפים בחתך ({sliceStructurePills.length}) — לחץ לזיהוי ומיקוד:</span>
            </div>
            <div
              className="axial-structure-pills"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 5,
              }}
            >
              {sliceStructurePills.map((st) => {
                const isSelected = selectedStructureId === st.structureId;
                const isHovered = hoveredStructureId === st.structureId;
                return (
                  <button
                    key={st.structureId}
                    type="button"
                    className={`axial-structure-pill ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`}
                    onMouseEnter={() => onHoverStructure?.(st.structureId)}
                    onMouseLeave={() => onHoverStructure?.(null)}
                    onClick={() => onSelectStructure?.(st.structureId)}
                    title={`${st.labelHe}${st.nameEn ? ` (${st.nameEn})` : ''} • ${st.huLabel}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '3.5px 8px',
                      borderRadius: 99,
                      fontSize: '0.7rem',
                      fontWeight: isSelected ? 800 : 600,
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      transition: 'all 0.14s ease',
                      background: isSelected
                        ? 'rgba(56, 189, 248, 0.25)'
                        : isHovered
                          ? 'rgba(56, 189, 248, 0.14)'
                          : 'rgba(22, 34, 58, 0.85)',
                      color: isSelected || isHovered ? '#e0f2fe' : '#cbd5e1',
                      border: isSelected
                        ? '1px solid #38bdf8'
                        : isHovered
                          ? '1px solid rgba(103, 232, 249, 0.55)'
                          : '1px solid rgba(148, 163, 184, 0.2)',
                      boxShadow: isSelected ? '0 0 12px rgba(56, 189, 248, 0.3)' : 'none',
                    }}
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: st.color,
                        border: '1px solid rgba(255, 255, 255, 0.4)',
                        flexShrink: 0,
                      }}
                    />
                    <span>{st.labelHe}</span>
                    {imagingMode === 'ct' && (
                      <span
                        style={{
                          fontSize: '0.62rem',
                          color: '#7dd3fc',
                          fontFamily: 'ui-monospace, monospace',
                          opacity: 0.9,
                        }}
                      >
                        {getCompactHu(st.huLabel)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
