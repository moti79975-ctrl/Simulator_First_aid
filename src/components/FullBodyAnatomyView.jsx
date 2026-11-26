import React, { useEffect, useRef, useState } from 'react';
import { Layers, Scan, Crosshair, ZoomIn, User } from 'lucide-react';
import { BODY_REGIONS, FULL_BODY_ORGANS } from '../data/anatomyDatabase';
import { computeArterialWave } from '../engines/PhysiologyEngine';

const W = 540;
const H = 680;

/**
 * מצייר קווי מתאר אנטומיים מדויקים וריאליסטיים של גוף אדם מלא (זכר או נקבה)
 * בפרופורציות קלאסיות של אטלס אנטומי (8 ראשים), תוך הבחנה ריאליסטית בכתפיים,
 * בית החזה, המותניים, האגן, השרירים, הראש והשיער.
 */
function traceBodySilhouette(ctx, gender, breathOffset = 0) {
  const cx = W * 0.5;
  const isF = gender === 'female';

  // Proportions tailored anatomically for realistic Male vs Female
  const neckW = isF ? 16.5 : 21.5;
  const shX = isF ? 66 : 82; // Shoulder deltoid outer X
  const shY = isF ? 140 : 136;
  const axillaX = isF ? 46 : 58; // Armpit crease
  const axillaY = isF ? 194 : 198;
  const chestW = (isF ? 49 : 58) + breathOffset * 2.2;
  const waistW = isF ? 36 : 49;
  const hipW = isF ? 62 : 53; // Female pelvic/iliac anatomical flare
  const hipY = isF ? 344 : 338;
  const crotchY = isF ? 378 : 374;

  // Arms hanging in natural anatomical slight abduction
  const elbowOutX = isF ? 100 : 114;
  const elbowInX = isF ? 78 : 88;
  const elbowY = 266;
  const wristOutX = isF ? 124 : 138;
  const wristInX = isF ? 108 : 119;
  const wristY = 352;
  const handTipY = 412;

  // Legs
  const thighOutX = isF ? 61 : 55;
  const kneeOutX = isF ? 42 : 44;
  const kneeInX = isF ? 11 : 12;
  const kneeY = 496;
  const calfOutX = isF ? 44 : 46;
  const calfInX = isF ? 10 : 11;
  const calfY = 548;
  const ankleOutX = isF ? 29 : 31;
  const ankleInX = isF ? 13 : 14;
  const ankleY = 626;
  const footY = 656;

  ctx.beginPath();
  // Start right side of neck base -> shoulder -> outer right arm -> hand -> inner arm -> torso -> leg -> foot -> mirror left side
  ctx.moveTo(cx - neckW, 108);
  // Trapezius slope to right deltoid (viewer's left = patient's anatomical right!)
  ctx.bezierCurveTo(cx - neckW - 14, 122, cx - shX + 12, shY - 8, cx - shX, shY + 12);
  // Outer deltoid -> biceps -> elbow -> outer forearm -> wrist
  ctx.bezierCurveTo(cx - shX - 10, shY + 42, cx - elbowOutX + 4, elbowY - 38, cx - elbowOutX, elbowY);
  ctx.bezierCurveTo(cx - elbowOutX - 8, elbowY + 26, cx - wristOutX + 4, wristY - 26, cx - wristOutX, wristY);
  // Anatomically sculpted hand (thumb + fingers contour)
  ctx.bezierCurveTo(cx - wristOutX - 12, wristY + 18, cx - wristOutX - 14, wristY + 34, cx - wristOutX - 4, wristY + 36);
  ctx.bezierCurveTo(cx - wristOutX - 12, wristY + 46, cx - wristOutX - 8, handTipY + 4, cx - wristOutX + 4, handTipY);
  ctx.bezierCurveTo(cx - wristInX + 2, handTipY - 4, cx - wristInX + 6, wristY + 28, cx - wristInX, wristY);
  // Inner forearm -> inner elbow -> inner arm -> axilla
  ctx.bezierCurveTo(cx - wristInX + 12, wristY - 32, cx - elbowInX - 4, elbowY + 24, cx - elbowInX, elbowY - 4);
  ctx.bezierCurveTo(cx - elbowInX + 14, elbowY - 32, cx - axillaX - 12, axillaY + 18, cx - axillaX, axillaY);
  // Lateral thorax -> waist -> hip/pelvis
  ctx.bezierCurveTo(cx - chestW, axillaY + 24, cx - waistW - 4, 266, cx - waistW, 286);
  ctx.bezierCurveTo(cx - waistW - 8, 308, cx - hipW, 322, cx - hipW, hipY);
  // Outer thigh -> knee -> calf -> ankle -> foot
  ctx.bezierCurveTo(cx - thighOutX - 2, 392, cx - thighOutX + 6, 444, cx - kneeOutX, kneeY);
  ctx.bezierCurveTo(cx - calfOutX - 4, 520, cx - calfOutX, calfY, cx - ankleOutX, ankleY);
  // Right foot
  ctx.bezierCurveTo(cx - ankleOutX - 10, footY - 8, cx - ankleOutX - 12, footY + 4, cx - ankleOutX + 4, footY + 4);
  ctx.bezierCurveTo(cx - ankleInX - 2, footY + 6, cx - ankleInX + 4, footY - 4, cx - ankleInX, ankleY);
  // Inner calf -> inner knee -> inner thigh -> perineum
  ctx.bezierCurveTo(cx - calfInX + 2, calfY + 8, cx - calfInX - 4, 524, cx - kneeInX, kneeY);
  ctx.bezierCurveTo(cx - kneeInX + 4, 446, cx - 10, 405, cx - 4, crotchY);
  ctx.quadraticCurveTo(cx, crotchY + 6, cx + 4, crotchY);

  // ---- MIRROR LEFT SIDE OF PATIENT (Viewer's Right) ----
  ctx.bezierCurveTo(cx + 10, 405, cx + kneeInX - 4, 446, cx + kneeInX, kneeY);
  ctx.bezierCurveTo(cx + calfInX + 4, 524, cx + calfInX - 2, calfY + 8, cx + ankleInX, ankleY);
  // Left foot
  ctx.bezierCurveTo(cx + ankleInX - 4, footY - 4, cx + ankleInX + 2, footY + 6, cx + ankleOutX - 4, footY + 4);
  ctx.bezierCurveTo(cx + ankleOutX + 12, footY + 4, cx + ankleOutX + 10, footY - 8, cx + ankleOutX, ankleY);
  // Outer left leg -> thigh -> hip -> waist -> thorax
  ctx.bezierCurveTo(cx + calfOutX, calfY, cx + calfOutX + 4, 520, cx + kneeOutX, kneeY);
  ctx.bezierCurveTo(cx + thighOutX - 6, 444, cx + thighOutX + 2, 392, cx + hipW, hipY);
  ctx.bezierCurveTo(cx + hipW, 322, cx + waistW + 8, 308, cx + waistW, 286);
  ctx.bezierCurveTo(cx + waistW + 4, 266, cx + chestW, axillaY + 24, cx + axillaX, axillaY);
  // Inner left arm -> hand -> outer left arm -> shoulder -> neck
  ctx.bezierCurveTo(cx + axillaX + 12, axillaY + 18, cx + elbowInX - 14, elbowY - 32, cx + elbowInX, elbowY - 4);
  ctx.bezierCurveTo(cx + elbowInX + 4, elbowY + 24, cx + wristInX - 12, wristY - 32, cx + wristInX, wristY);
  ctx.bezierCurveTo(cx + wristInX - 6, wristY + 28, cx + wristInX - 2, handTipY - 4, cx + wristOutX - 4, handTipY);
  ctx.bezierCurveTo(cx + wristOutX + 8, handTipY + 4, cx + wristOutX + 12, wristY + 46, cx + wristOutX + 4, wristY + 36);
  ctx.bezierCurveTo(cx + wristOutX + 14, wristY + 34, cx + wristOutX + 12, wristY + 18, cx + wristOutX, wristY);
  ctx.bezierCurveTo(cx + wristOutX - 4, wristY - 26, cx + elbowOutX + 8, elbowY + 26, cx + elbowOutX, elbowY);
  ctx.bezierCurveTo(cx + elbowOutX - 4, elbowY - 38, cx + shX + 10, shY + 42, cx + shX, shY + 12);
  ctx.bezierCurveTo(cx + shX - 12, shY - 8, cx + neckW + 14, 122, cx + neckW, 108);
  ctx.closePath();
}

function drawRealisticHead(ctx, gender, pallor, avpu) {
  const cx = W * 0.5;
  const isF = gender === 'female';
  const headRx = isF ? 29.5 : 32.5;
  const headRy = isF ? 39 : 41.5;
  const hy = 64;

  ctx.save();
  // Hair behind head for female
  if (isF) {
    const backHairGrad = ctx.createLinearGradient(cx - 46, 20, cx + 46, 138);
    backHairGrad.addColorStop(0, '#3b2417');
    backHairGrad.addColorStop(0.5, '#593622');
    backHairGrad.addColorStop(1, '#26150d');
    ctx.fillStyle = backHairGrad;
    ctx.beginPath();
    ctx.moveTo(cx - 36, 48);
    ctx.bezierCurveTo(cx - 50, 76, cx - 52, 114, cx - 36, 134);
    ctx.quadraticCurveTo(cx, 122, cx + 36, 134);
    ctx.bezierCurveTo(cx + 52, 114, cx + 50, 76, cx + 36, 48);
    ctx.closePath();
    ctx.fill();
  }

  // Neck cylinder with sternocleidomastoid shadows
  const neckW = isF ? 16.5 : 21.5;
  const neckGrad = ctx.createLinearGradient(cx - neckW, 0, cx + neckW, 0);
  neckGrad.addColorStop(0, '#a66e50');
  neckGrad.addColorStop(0.35, '#dfb090');
  neckGrad.addColorStop(0.65, '#ecc3a6');
  neckGrad.addColorStop(1, '#986144');
  ctx.fillStyle = neckGrad;
  ctx.beginPath();
  ctx.roundRect(cx - neckW, 92, neckW * 2, 34, 8);
  ctx.fill();

  // Chin cast shadow on neck
  ctx.fillStyle = 'rgba(72, 36, 20, 0.35)';
  ctx.beginPath();
  ctx.ellipse(cx, 104, neckW * 0.92, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ears
  ctx.fillStyle = '#cf9777';
  ctx.beginPath();
  ctx.ellipse(cx - headRx - 1, hy + 4, 4.5, 9.5, -0.1, 0, Math.PI * 2);
  ctx.ellipse(cx + headRx + 1, hy + 4, 4.5, 9.5, 0.1, 0, Math.PI * 2);
  ctx.fill();

  // Sculpted Face Oval / Jawline
  ctx.beginPath();
  ctx.moveTo(cx, hy - headRy);
  ctx.bezierCurveTo(cx + headRx + 2, hy - headRy + 4, cx + headRx + 2, hy + 8, cx + headRx * (isF ? 0.72 : 0.84), hy + 24);
  ctx.bezierCurveTo(cx + headRx * 0.42, hy + headRy - 2, cx + (isF ? 8 : 12), hy + headRy + 2, cx, hy + headRy + 2);
  ctx.bezierCurveTo(cx - (isF ? 8 : 12), hy + headRy + 2, cx - headRx * 0.42, hy + headRy - 2, cx - headRx * (isF ? 0.72 : 0.84), hy + 24);
  ctx.bezierCurveTo(cx - headRx - 2, hy + 8, cx - headRx - 2, hy - headRy + 4, cx, hy - headRy);
  ctx.closePath();

  const faceGrad = ctx.createRadialGradient(cx + 8, hy - 8, 6, cx, hy, headRy * 1.15);
  faceGrad.addColorStop(0, '#f4cfb3');
  faceGrad.addColorStop(0.58, '#dfb08e');
  faceGrad.addColorStop(0.9, '#ba8160');
  faceGrad.addColorStop(1, '#945d40');
  ctx.fillStyle = faceGrad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(84, 46, 28, 0.42)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Subtle shock pallor overlay on face
  if (pallor > 0.01) {
    ctx.fillStyle = `rgba(212, 224, 238, ${pallor * 0.85})`;
    ctx.fill();
  }

  // Realistic Facial Features (Brows, Eyes reflecting AVPU, Nose shadow, Lips)
  const eyeY = hy + 1;
  ctx.strokeStyle = '#3b2416';
  ctx.lineWidth = isF ? 1.5 : 2.1;
  ctx.lineCap = 'round';
  // Eyebrows (slightly furrowed in distress)
  ctx.beginPath();
  ctx.moveTo(cx - 17, eyeY - 7);
  ctx.quadraticCurveTo(cx - 10, eyeY - 10, cx - 4, eyeY - 6);
  ctx.moveTo(cx + 4, eyeY - 6);
  ctx.quadraticCurveTo(cx + 10, eyeY - 10, cx + 17, eyeY - 7);
  ctx.stroke();

  // Eyes (open in A, half-closed in V/P, closed in U)
  if (avpu === 'U' || avpu === 'P') {
    ctx.strokeStyle = '#4a2e1e';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx - 15, eyeY);
    ctx.quadraticCurveTo(cx - 10, eyeY + 3, cx - 5, eyeY);
    ctx.moveTo(cx + 5, eyeY);
    ctx.quadraticCurveTo(cx + 10, eyeY + 3, cx + 15, eyeY);
    ctx.stroke();
  } else {
    [-10.5, 10.5].forEach((ex) => {
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.ellipse(cx + ex, eyeY, 5, avpu === 'V' ? 1.8 : 2.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2d3a4b';
      ctx.beginPath();
      ctx.arc(cx + ex, eyeY, avpu === 'V' ? 1.4 : 2.1, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Nose bridge & tip shadow
  ctx.strokeStyle = 'rgba(128, 76, 52, 0.45)';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(cx - 1, eyeY + 1);
  ctx.lineTo(cx - 2.5, eyeY + 14);
  ctx.quadraticCurveTo(cx, eyeY + 16.5, cx + 3.5, eyeY + 14);
  ctx.stroke();

  // Lips (slightly cyanotic/pale in severe shock!)
  const lipColor = pallor > 0.25 ? '#9e7c8c' : isF ? '#c97875' : '#bc796c';
  ctx.fillStyle = lipColor;
  ctx.beginPath();
  ctx.ellipse(cx, hy + 25, isF ? 7.5 : 8.5, 2.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(92, 42, 38, 0.45)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(cx - 7.5, hy + 25);
  ctx.lineTo(cx + 7.5, hy + 25);
  ctx.stroke();

  // Hair cap
  const hairGrad = ctx.createLinearGradient(cx - 32, 20, cx + 32, 62);
  hairGrad.addColorStop(0, isF ? '#4c2c1b' : '#241b16');
  hairGrad.addColorStop(0.5, isF ? '#6b3f28' : '#3a2c24');
  hairGrad.addColorStop(1, '#1a120e');
  ctx.fillStyle = hairGrad;
  ctx.beginPath();
  if (isF) {
    ctx.moveTo(cx - headRx - 2, hy + 4);
    ctx.bezierCurveTo(cx - headRx - 6, hy - 34, cx - 16, hy - headRy - 6, cx, hy - headRy - 5);
    ctx.bezierCurveTo(cx + 16, hy - headRy - 6, cx + headRx + 6, hy - 34, cx + headRx + 2, hy + 4);
    ctx.bezierCurveTo(cx + headRx - 4, hy - 20, cx + 10, hy - 22, cx - 2, hy - 25);
    ctx.bezierCurveTo(cx - 18, hy - 20, cx - headRx + 2, hy - 14, cx - headRx - 2, hy + 4);
  } else {
    ctx.moveTo(cx - headRx, hy - 4);
    ctx.bezierCurveTo(cx - headRx - 2, hy - 34, cx - 14, hy - headRy - 5, cx, hy - headRy - 4);
    ctx.bezierCurveTo(cx + 14, hy - headRy - 5, cx + headRx + 2, hy - 34, cx + headRx, hy - 4);
    ctx.bezierCurveTo(cx + headRx - 4, hy - 22, cx + 12, hy - 26, cx, hy - 24);
    ctx.bezierCurveTo(cx - 12, hy - 26, cx - headRx + 4, hy - 22, cx - headRx, hy - 4);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * מצייר את השכבות הפנימיות האנטומיות של הגוף המלא (שרירים, שלד, איברים חיים, עצבים, ורידים, עורקים פועמים)
 */
function drawInternalAnatomy(ctx, gender, phys, peelRatio, breathOffset) {
  const cx = W * 0.5;
  const isF = gender === 'female';
  const wave = computeArterialWave(phys?.pulsePhase || 0);
  const pulseW = 1 + wave * 0.35;

  // 1. FULL STRIATED MUSCULATURE (visible from peel >= 0.15)
  if (peelRatio >= 0.1) {
    const musAlpha = peelRatio < 0.72 ? Math.min(1, peelRatio * 2.2) : Math.max(0.28, 1 - (peelRatio - 0.72) * 2.4);
    ctx.save();
    ctx.globalAlpha = musAlpha;

    // Deep muscular red base fill clipped to body
    const musBase = ctx.createLinearGradient(cx - 110, 120, cx + 110, 620);
    musBase.addColorStop(0, '#721922');
    musBase.addColorStop(0.5, '#9d2530');
    musBase.addColorStop(1, '#68151d');
    ctx.fillStyle = musBase;
    ctx.fillRect(cx - 160, 108, 320, 560);

    // Sculpted Muscle Groups with realistic striations & pearly tendinous inscriptions!
    const drawMuscleGroup = (x, y, rx, ry, rot, highlight = '#bf3743') => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      const g = ctx.createRadialGradient(-rx * 0.25, -ry * 0.25, 2, 0, 0, Math.max(rx, ry));
      g.addColorStop(0, highlight);
      g.addColorStop(0.72, '#8b1e28');
      g.addColorStop(1, '#4c0d14');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      // Striation lines
      ctx.strokeStyle = 'rgba(255, 195, 198, 0.22)';
      ctx.lineWidth = 0.9;
      for (let i = -ry * 0.65; i <= ry * 0.65; i += 4.5) {
        ctx.beginPath();
        ctx.moveTo(-rx * 0.75, i);
        ctx.lineTo(rx * 0.75, i);
        ctx.stroke();
      }
      ctx.restore();
    };

    const shX = isF ? 58 : 70;
    // Deltoids
    drawMuscleGroup(cx - shX, 160, isF ? 16 : 21, 24, 0.22);
    drawMuscleGroup(cx + shX, 160, isF ? 16 : 21, 24, -0.22);
    // Pectoralis Major
    drawMuscleGroup(cx - (isF ? 22 : 27), 178, isF ? 22 : 28, isF ? 18 : 22, -0.12);
    drawMuscleGroup(cx + (isF ? 22 : 27), 178, isF ? 22 : 28, isF ? 18 : 22, 0.12);
    // Biceps & Forearm Flexors
    drawMuscleGroup(cx - (isF ? 78 : 90), 226, 12, 34, 0.25);
    drawMuscleGroup(cx + (isF ? 78 : 90), 226, 12, 34, -0.25);
    drawMuscleGroup(cx - (isF ? 102 : 114), 305, 10.5, 38, 0.22);
    drawMuscleGroup(cx + (isF ? 102 : 114), 305, 10.5, 38, -0.22);
    // Rectus Abdominis (6-pack segments with Linea Alba white fascia!)
    [224, 254, 284, 314].forEach((ay) => {
      drawMuscleGroup(cx - 12, ay, 10.5, 13, 0);
      drawMuscleGroup(cx + 12, ay, 10.5, 13, 0);
    });
    // White Tendinous Aponeurosis (Linea Alba + Knee & Wrist Tendons)
    ctx.strokeStyle = 'rgba(241, 237, 228, 0.78)';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(cx, 198);
    ctx.lineTo(cx, 338);
    ctx.stroke();

    // Quadriceps & Calves
    drawMuscleGroup(cx - 32, 424, isF ? 19 : 21, 56, 0.06);
    drawMuscleGroup(cx + 32, 424, isF ? 19 : 21, 56, -0.06);
    drawMuscleGroup(cx - 27, 554, 13.5, 44, 0.04);
    drawMuscleGroup(cx + 27, 554, 13.5, 44, -0.04);

    // Pearly Patella & Achilles/Wrist White Tendons
    ctx.fillStyle = 'rgba(244, 240, 232, 0.85)';
    [-27, 27].forEach((kx) => {
      ctx.beginPath();
      ctx.ellipse(cx + kx, 496, 11, 14, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  // 2. FULL SKELETON & LIVING INTERNAL ORGANS (visible from peel >= 0.42)
  if (peelRatio >= 0.38) {
    const skelAlpha = Math.min(1, (peelRatio - 0.35) * 2.1);
    ctx.save();
    ctx.globalAlpha = skelAlpha;

    // Breathing Lungs (expand dynamically with RR!)
    const lungScale = 1 + breathOffset * 0.06;
    ctx.save();
    ctx.translate(cx, 196);
    ctx.scale(lungScale, lungScale);
    const lungGrad = ctx.createRadialGradient(0, -10, 6, 0, 0, 52);
    lungGrad.addColorStop(0, '#f4a8b0');
    lungGrad.addColorStop(0.7, '#c76473');
    lungGrad.addColorStop(1, '#853644');
    ctx.fillStyle = lungGrad;
    // Right Lung (viewer left)
    ctx.beginPath();
    ctx.ellipse(-22, 0, isF ? 19 : 23, 38, 0.14, 0, Math.PI * 2);
    ctx.fill();
    // Left Lung (viewer right, cardiac notch)
    ctx.beginPath();
    ctx.ellipse(22, 0, isF ? 17 : 21, 36, -0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Living Beating Heart (contracts in sync with live HR!)
    const heartScale = 1 + wave * 0.11;
    ctx.save();
    ctx.translate(cx + 7, 198);
    ctx.scale(heartScale, heartScale);
    const hGrad = ctx.createRadialGradient(-4, -5, 2, 0, 0, 22);
    hGrad.addColorStop(0, '#ff4d5a');
    hGrad.addColorStop(0.65, '#c81427');
    hGrad.addColorStop(1, '#7a0916');
    ctx.fillStyle = hGrad;
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.bezierCurveTo(18, -18, 22, 6, 4, 21);
    ctx.bezierCurveTo(-16, 12, -18, -12, 0, -16);
    ctx.fill();
    ctx.restore();

    // Liver & Abdominal Viscera (subtle realistic clinical tint)
    ctx.fillStyle = 'rgba(136, 42, 46, 0.85)';
    ctx.beginPath();
    ctx.moveTo(cx - 34, 236);
    ctx.quadraticCurveTo(cx - 8, 230, cx + 10, 244);
    ctx.quadraticCurveTo(cx - 12, 266, cx - 34, 258);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(202, 132, 122, 0.72)';
    ctx.beginPath();
    ctx.ellipse(cx, 290, isF ? 27 : 32, 28, 0, 0, Math.PI * 2);
    ctx.fill();

    // Crisp Anatomical Skeleton Overlay (Spine, Ribcage, Clavicles, Pelvis, Long Bones)
    const boneStroke = '#e2e8f0';
    ctx.strokeStyle = boneStroke;
    ctx.fillStyle = 'rgba(241, 245, 249, 0.86)';
    ctx.lineCap = 'round';

    // Vertebral column
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(cx, 108);
    ctx.lineTo(cx, 336);
    ctx.stroke();

    // Clavicles
    ctx.lineWidth = 5;
    const clX = isF ? 52 : 64;
    ctx.beginPath();
    ctx.moveTo(cx - 6, 138);
    ctx.quadraticCurveTo(cx - clX * 0.5, 130, cx - clX, 142);
    ctx.moveTo(cx + 6, 138);
    ctx.quadraticCurveTo(cx + clX * 0.5, 130, cx + clX, 142);
    ctx.stroke();

    // Ribcage (7 pairs of curved anatomical ribs + Sternum)
    ctx.lineWidth = 3.2;
    const ribBaseW = isF ? 38 : 46;
    for (let r = 0; r < 7; r++) {
      const ry = 152 + r * 12.5;
      const rw = (ribBaseW + Math.sin((r / 6) * Math.PI) * 9) + breathOffset * 1.4;
      ctx.beginPath();
      ctx.moveTo(cx - 4, ry);
      ctx.bezierCurveTo(cx - rw, ry - 4, cx - rw, ry + 11, cx - 5, ry + 7);
      ctx.moveTo(cx + 4, ry);
      ctx.bezierCurveTo(cx + rw, ry - 4, cx + rw, ry + 11, cx + 5, ry + 7);
      ctx.stroke();
    }
    // Sternum
    ctx.fillRect(cx - 4.5, 142, 9, 64);

    // Pelvis (Anatomically broader iliac wings for Female!)
    const pelW = isF ? 50 : 42;
    ctx.lineWidth = 5.5;
    ctx.beginPath();
    ctx.moveTo(cx, 326);
    ctx.bezierCurveTo(cx - pelW, 304, cx - pelW - 4, 354, cx - 18, 368);
    ctx.quadraticCurveTo(cx, 376, cx + 18, 368);
    ctx.bezierCurveTo(cx + pelW + 4, 354, cx + pelW, 304, cx, 326);
    ctx.stroke();

    // Limb Bones (Humerus, Radius/Ulna, Femur, Tibia/Fibula)
    const drawBone = (x1, y1, x2, y2, w) => {
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(x1, y1, w * 0.72, 0, Math.PI * 2);
      ctx.arc(x2, y2, w * 0.68, 0, Math.PI * 2);
      ctx.fill();
    };
    const shBoneX = isF ? 58 : 70;
    const elbX = isF ? 88 : 100;
    const wriX = isF ? 114 : 126;
    // Arms
    drawBone(cx - shBoneX, 152, cx - elbX, 266, 6.5);
    drawBone(cx + shBoneX, 152, cx + elbX, 266, 6.5);
    drawBone(cx - elbX - 3, 268, cx - wriX - 3, 352, 3.6);
    drawBone(cx - elbX + 3, 268, cx - wriX + 3, 352, 3.2);
    drawBone(cx + elbX + 3, 268, cx + wriX + 3, 352, 3.6);
    drawBone(cx + elbX - 3, 268, cx + wriX - 3, 352, 3.2);
    // Legs
    const hipJ = isF ? 36 : 30;
    drawBone(cx - hipJ, 356, cx - 28, 496, 8.5);
    drawBone(cx + hipJ, 356, cx + 28, 496, 8.5);
    drawBone(cx - 28, 500, cx - 22, 626, 6.5);
    drawBone(cx + 28, 500, cx + 22, 626, 6.5);

    ctx.restore();
  }

  // 3. SYSTEMIC NERVOUS, VENOUS & PULSING ARTERIAL TREES (visible from peel >= 0.25)
  if (peelRatio >= 0.22) {
    const vascAlpha = Math.min(1, (peelRatio - 0.18) * 2.0);
    ctx.save();
    ctx.globalAlpha = vascAlpha;
    ctx.lineCap = 'round';

    const shX = isF ? 54 : 65;
    const elbX = isF ? 88 : 100;
    const wriX = isF ? 114 : 126;
    const hipJ = isF ? 34 : 29;

    // Yellow Peripheral Nervous System (Spinal Cord, Brachial Plexus, Median/Radial, Sciatic/Femoral)
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(cx, 88);
    ctx.lineTo(cx, 334);
    // Arms (Brachial plexus -> radial/median)
    ctx.moveTo(cx, 134);
    ctx.lineTo(cx - shX, 152);
    ctx.lineTo(cx - elbX + 4, 266);
    ctx.lineTo(cx - wriX + 4, 352);
    ctx.moveTo(cx, 134);
    ctx.lineTo(cx + shX, 152);
    ctx.lineTo(cx + elbX - 4, 266);
    ctx.lineTo(cx + wriX - 4, 352);
    // Legs (Femoral / Sciatic)
    ctx.moveTo(cx, 326);
    ctx.lineTo(cx - hipJ - 4, 366);
    ctx.lineTo(cx - 32, 496);
    ctx.lineTo(cx - 26, 622);
    ctx.moveTo(cx, 326);
    ctx.lineTo(cx + hipJ + 4, 366);
    ctx.lineTo(cx + 32, 496);
    ctx.lineTo(cx + 26, 622);
    ctx.stroke();

    // Blue Systemic Venous Return (Vena Cava, Jugular, Cephalic/Basilic, Femoral/Saphenous)
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3.6;
    ctx.beginPath();
    // Vena Cava & Jugulars
    ctx.moveTo(cx - 6, 190);
    ctx.lineTo(cx - 6, 322);
    ctx.moveTo(cx - 8, 182);
    ctx.lineTo(cx - 10, 96);
    ctx.moveTo(cx + 8, 182);
    ctx.lineTo(cx + 10, 96);
    // Arms
    ctx.moveTo(cx - 6, 150);
    ctx.lineTo(cx - shX - 2, 160);
    ctx.lineTo(cx - elbX - 3, 268);
    ctx.lineTo(cx - wriX - 3, 355);
    ctx.moveTo(cx + 6, 150);
    ctx.lineTo(cx + shX + 2, 160);
    ctx.lineTo(cx + elbX + 3, 268);
    ctx.lineTo(cx + wriX + 3, 355);
    // Legs
    ctx.moveTo(cx - 6, 322);
    ctx.lineTo(cx - hipJ + 3, 368);
    ctx.lineTo(cx - 23, 498);
    ctx.lineTo(cx - 19, 625);
    ctx.moveTo(cx - 6, 322);
    ctx.lineTo(cx + hipJ - 3, 368);
    ctx.lineTo(cx + 23, 498);
    ctx.lineTo(cx + 19, 625);
    ctx.stroke();

    // Bright Red Pulsing Systemic Arterial Tree (Aorta, Carotid, Subclavian, Brachial, Radial, Femoral, Tibial!)
    ctx.strokeStyle = '#ff2438';
    ctx.shadowColor = 'rgba(255, 36, 56, 0.7)';
    ctx.shadowBlur = 4 + wave * 7;
    ctx.lineWidth = 3.8 * pulseW;
    ctx.beginPath();
    // Aortic arch + Descending Aorta
    ctx.moveTo(cx + 5, 192);
    ctx.bezierCurveTo(cx + 4, 156, cx - 2, 156, cx + 1, 182);
    ctx.lineTo(cx + 2, 324);
    // Carotids
    ctx.moveTo(cx - 4, 162);
    ctx.lineTo(cx - 6, 94);
    ctx.moveTo(cx + 6, 162);
    ctx.lineTo(cx + 6, 94);
    // Arms (Subclavian -> Brachial -> Radial)
    ctx.moveTo(cx, 156);
    ctx.lineTo(cx - shX + 3, 156);
    ctx.lineTo(cx - elbX + 1, 266);
    ctx.lineTo(cx - wriX + 1, 354);
    ctx.moveTo(cx, 156);
    ctx.lineTo(cx + shX - 3, 156);
    ctx.lineTo(cx + elbX - 1, 266);
    ctx.lineTo(cx + wriX - 1, 354);
    // Legs (Iliac -> Femoral -> Popliteal -> Tibial)
    ctx.moveTo(cx + 2, 324);
    ctx.lineTo(cx - hipJ, 368);
    ctx.lineTo(cx - 28, 496);
    ctx.lineTo(cx - 23, 624);
    ctx.moveTo(cx + 2, 324);
    ctx.lineTo(cx + hipJ, 368);
    ctx.lineTo(cx + 28, 496);
    ctx.lineTo(cx + 23, 624);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.restore();
  }
}

/**
 * מצייר עור אנושי ריאליסטי עם הצללות נפחיות, עצמות בריח, קווי שרירים עדינים וביגוד בדיקה קליני מכבד
 */
function drawRealisticSkinLayer(ctx, gender, pallor, breathOffset, skinOpacity) {
  if (skinOpacity <= 0.02) return;
  const cx = W * 0.5;
  const isF = gender === 'female';

  ctx.save();
  ctx.globalAlpha = skinOpacity;

  // Volumetric studio-lit realistic human skin shading
  const bodyGrad = ctx.createLinearGradient(cx - 130, 120, cx + 130, 620);
  bodyGrad.addColorStop(0.0, '#aa7152');
  bodyGrad.addColorStop(0.24, '#dfa886');
  bodyGrad.addColorStop(0.5, '#f0c5a7');
  bodyGrad.addColorStop(0.78, '#d59c79');
  bodyGrad.addColorStop(1.0, '#965f42');
  ctx.fillStyle = bodyGrad;
  ctx.fillRect(cx - 170, 104, 340, 570);

  // Subtle anatomical torso relief lighting (clavicles, sternum, ribs, knees, elbows)
  ctx.strokeStyle = 'rgba(130, 74, 48, 0.34)';
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  // Clavicles
  const clX = isF ? 50 : 62;
  ctx.beginPath();
  ctx.moveTo(cx - 7, 141);
  ctx.quadraticCurveTo(cx - clX * 0.5, 134, cx - clX, 145);
  ctx.moveTo(cx + 7, 141);
  ctx.quadraticCurveTo(cx + clX * 0.5, 134, cx + clX, 145);
  ctx.stroke();

  // Subtle thoracic/abdominal contour shading
  if (!isF) {
    // Male pectoral & subtle abdominal shadow lines
    ctx.strokeStyle = 'rgba(125, 70, 44, 0.28)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx - 52, 184);
    ctx.quadraticCurveTo(cx - 26, 200, cx - 4, 194);
    ctx.moveTo(cx + 52, 184);
    ctx.quadraticCurveTo(cx + 26, 200, cx + 4, 194);
    ctx.moveTo(cx, 195);
    ctx.lineTo(cx, 304);
    ctx.stroke();
  }

  // Navel
  ctx.fillStyle = 'rgba(122, 68, 44, 0.45)';
  ctx.beginPath();
  ctx.ellipse(cx, 294, 2.5, 4.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Knee & elbow anatomical dimples
  ctx.strokeStyle = 'rgba(128, 72, 46, 0.25)';
  ctx.lineWidth = 1.5;
  [-28, 28].forEach((kx) => {
    ctx.beginPath();
    ctx.arc(cx + kx, 496, 11, 0.4, Math.PI - 0.4);
    ctx.stroke();
  });

  // Clinical Medical Exam Garments (respectful anatomical examination wear that fades cleanly as skin peels!)
  const clothMat = ctx.createLinearGradient(cx - 60, 0, cx + 60, 0);
  clothMat.addColorStop(0, '#1e293b');
  clothMat.addColorStop(0.5, '#334155');
  clothMat.addColorStop(1, '#172033');
  ctx.fillStyle = clothMat;

  // Clinical athletic shorts (covering pelvis while leaving thighs/femoral injury zone exposed!)
  const hipW = isF ? 63 : 54;
  ctx.beginPath();
  ctx.moveTo(cx - (isF ? 46 : 49), 312);
  ctx.lineTo(cx + (isF ? 46 : 49), 312);
  ctx.lineTo(cx + hipW, 354);
  ctx.lineTo(cx + hipW - 4, 384);
  ctx.lineTo(cx + 5, 382);
  ctx.lineTo(cx, 372);
  ctx.lineTo(cx - 5, 382);
  ctx.lineTo(cx - hipW + 4, 384);
  ctx.lineTo(cx - hipW, 354);
  ctx.closePath();
  ctx.fill();

  // Female clinical examination sports-top (leaves shoulders, arms, upper chest & abdomen cleanly inspectable)
  if (isF) {
    ctx.beginPath();
    ctx.moveTo(cx - 32, 140);
    ctx.lineTo(cx - 22, 140);
    ctx.quadraticCurveTo(cx, 174 + breathOffset, cx + 22, 140);
    ctx.lineTo(cx + 32, 140);
    ctx.lineTo(cx + 49, 198);
    ctx.lineTo(cx + 44, 218);
    ctx.quadraticCurveTo(cx, 222, cx - 44, 218);
    ctx.lineTo(cx - 49, 198);
    ctx.closePath();
    ctx.fill();
  }

  // Shock pallor & cold diaphoretic sheen on skin
  if (pallor > 0.01) {
    ctx.fillStyle = `rgba(212, 224, 238, ${pallor})`;
    ctx.fillRect(cx - 170, 104, 340, 570);
  }
  ctx.restore();
}

/**
 * src/components/FullBodyAnatomyView.jsx
 * תצוגת גוף אדם מלא ריאליסטית — זכר ונקבה — על HTML5 Canvas:
 * - עור ריאליסטי עם תאורה נפחית + חיוורון חי בהתאם להלם
 * - קילוף שכבות אנטומי רציף (0% עור מלא → 100% שרירים, שלד, לב פועם, ריאות נושמות, עצבים, ורידים ועורקים)
 * - מצב "עדשת רנטגן קסומה" (Magic X-Ray Lens) שמרחפת עם העכבר וחושפת אנטומיה חיה מתחת לעור!
 * - בחירת מוקד פציעה בגוף (אמה, זרוע עליונה, ירך פמורלית, שוק) + התזת דם חיה והמחשת ציוד מע"ר על הגוף!
 */
export default function FullBodyAnatomyView({
  gender,
  onChangeGender,
  bodyRegionId,
  onSelectBodyRegion,
  physiologyRef,
  interventionsRef,
  scenario,
  onSwitchToMacro,
  onOpenXRay,
}) {
  const canvasRef = useRef(null);
  const [peelPct, setPeelPct] = useState(0); // 0 = realistic full skin, 35 = muscles, 75 = organs+vessels+bones
  const [lensEnabled, setLensEnabled] = useState(true);
  const [clickedOrgan, setClickedOrgan] = useState(null);

  const uiStateRef = useRef({
    peelPct: 0,
    lensEnabled: true,
    mouseX: -999,
    mouseY: -999,
    particles: [],
  });

  useEffect(() => {
    uiStateRef.current.peelPct = peelPct;
  }, [peelPct]);

  useEffect(() => {
    uiStateRef.current.lensEnabled = lensEnabled;
  }, [lensEnabled]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = Math.max(280, Math.floor(rect.width * dpr));
      canvas.height = Math.max(380, Math.floor(rect.height * dpr));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement);

    let rafId = 0;
    let lastTs = 0;
    let clock = 0;

    function render(ts) {
      rafId = requestAnimationFrame(render);
      if (!lastTs) lastTs = ts;
      const dt = Math.min(0.05, (ts - lastTs) / 1000);
      lastTs = ts;
      clock += dt;

      const phys = physiologyRef.current;
      const interv = interventionsRef.current;
      const st = uiStateRef.current;
      if (!phys || !interv) return;

      const breathHz = Math.max(0.15, phys.rr / 60);
      const breathOffset = Math.sin(clock * Math.PI * 2 * breathHz);
      const pallor = phys.bloodLossPct > 10 ? Math.min(0.45, ((phys.bloodLossPct - 10) / 38) * 0.45) : 0;
      const peelRatio = st.peelPct / 100;

      // Active wound point on full body
      const region = BODY_REGIONS[bodyRegionId] || BODY_REGIONS.forearm;
      const normPos = region.bodyPos[gender] || region.bodyPos.male;
      const wx = normPos.x * W;
      const wy = normPos.y * H;

      // Spawn realistic blood droplets from active body wound site
      const wave = computeArterialWave(phys.pulsePhase);
      if (phys.arterialRate > 0.3) {
        const count = Math.floor((0.2 + wave * 1.4) * Math.min(1.4, phys.arterialRate / 14) * 55 * dt + Math.random() * 0.6);
        for (let i = 0; i < count; i++) {
          const ang = -Math.PI * 0.72 + (Math.random() - 0.5) * 0.45;
          const spd = (80 + wave * 155) * Math.min(1.2, phys.arterialRate / 14);
          st.particles.push({
            art: true,
            x: wx,
            y: wy,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            r: 1.8 + wave * 1.6,
            life: 0,
            maxLife: 0.65 + Math.random() * 0.4,
          });
        }
      }
      if (phys.venousRate > 0.3) {
        const count = Math.floor(Math.min(1.2, phys.venousRate / 10) * 28 * dt + Math.random() * 0.5);
        for (let i = 0; i < count; i++) {
          st.particles.push({
            art: false,
            x: wx + (Math.random() - 0.5) * 6,
            y: wy,
            vx: (Math.random() - 0.5) * 18,
            vy: 20 + Math.random() * 28,
            r: 2.2 + Math.random() * 1.4,
            life: 0,
            maxLife: 0.75 + Math.random() * 0.4,
          });
        }
      }
      for (let i = st.particles.length - 1; i >= 0; i--) {
        const p = st.particles[i];
        p.life += dt;
        if (p.life >= p.maxLife || p.y > H - 14) {
          st.particles.splice(i, 1);
          continue;
        }
        p.vy += (p.art ? 420 : 140) * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }

      // Draw Background
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const bg = ctx.createRadialGradient(canvas.width * 0.5, canvas.height * 0.42, 30, canvas.width * 0.5, canvas.height * 0.5, canvas.height * 0.75);
      bg.addColorStop(0, '#13223e');
      bg.addColorStop(1, '#060c18');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const scaleFit = Math.min(canvas.width / W, canvas.height / H);
      const offX = (canvas.width - W * scaleFit) * 0.5;
      const offY = (canvas.height - H * scaleFit) * 0.5;
      ctx.translate(offX, offY);
      ctx.scale(scaleFit, scaleFit);

      // Subtle anatomical measurement grid
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.05)';
      ctx.lineWidth = 1;
      for (let x = 20; x < W; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 20; y < H; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      // Ground elliptical shadow + dynamic blood puddle on floor beneath injury
      ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
      ctx.beginPath();
      ctx.ellipse(W * 0.5, 658, 92, 14, 0, 0, Math.PI * 2);
      ctx.fill();

      if (phys.bloodLostMl > 20) {
        const puddleR = Math.min(72, 16 + (phys.bloodLostMl / 1600) * 58);
        const pudGrad = ctx.createRadialGradient(wx, 658, 3, wx, 658, puddleR);
        pudGrad.addColorStop(0, scenario.hasArterial ? 'rgba(185, 14, 28, 0.92)' : 'rgba(92, 6, 22, 0.92)');
        pudGrad.addColorStop(1, 'rgba(92, 6, 22, 0)');
        ctx.fillStyle = pudGrad;
        ctx.beginPath();
        ctx.ellipse(wx, 658, puddleR, puddleR * 0.24, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // 1. RENDER FULL BODY CLIPPED TO REALISTIC SILHOUETTE
      ctx.save();
      traceBodySilhouette(ctx, gender, breathOffset);
      ctx.save();
      ctx.clip();

      // Base internal anatomy (shown proportionally to peelRatio)
      drawInternalAnatomy(ctx, gender, phys, peelRatio, breathOffset);
      // Realistic outer skin (fades smoothly as peelRatio rises)
      const skinAlpha = Math.max(0, 1 - peelRatio * 1.45);
      drawRealisticSkinLayer(ctx, gender, pallor, breathOffset, skinAlpha);

      ctx.restore();

      // Crisp subtle contour outline around full body
      ctx.strokeStyle = peelRatio > 0.35 ? 'rgba(125, 211, 252, 0.42)' : 'rgba(92, 52, 34, 0.5)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.restore();

      // 2. REALISTIC HEAD (always clearly recognizable Male / Female!)
      drawRealisticHead(ctx, gender, pallor, phys.avpu);

      // 3. MAGIC X-RAY CURSOR LENS (Hover anywhere on body to see real living muscles, organs, heart & vessels underneath skin!)
      if (st.lensEnabled && st.mouseX > 0 && st.mouseY > 0 && peelRatio < 0.7) {
        const lx = (st.mouseX - offX) / scaleFit;
        const ly = (st.mouseY - offY) / scaleFit;
        if (lx > 40 && lx < W - 40 && ly > 25 && ly < H - 20) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(lx, ly, 68, 0, Math.PI * 2);
          ctx.clip();

          // Dark blueprint backdrop inside lens
          ctx.fillStyle = 'rgba(5, 14, 30, 0.94)';
          ctx.fillRect(lx - 72, ly - 72, 144, 144);

          ctx.save();
          traceBodySilhouette(ctx, gender, breathOffset);
          ctx.clip();
          drawInternalAnatomy(ctx, gender, phys, 0.88, breathOffset);
          ctx.restore();

          // Lens ring border & scan crosshair
          ctx.restore();
          ctx.save();
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2.2;
          ctx.shadowColor = '#38bdf8';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(lx, ly, 68, 0, Math.PI * 2);
          ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#bae6fd';
          ctx.font = 'bold 10px "Segoe UI", Arial';
          ctx.textAlign = 'center';
          ctx.fillText('עדשת X-Ray חיה', lx, ly - 74);
          ctx.restore();
        }
      }

      // 4. ACTIVE WOUND MARKER, EQUIPMENT ON FULL BODY & LIVE BLOOD PARTICLES
      ctx.save();
      // Wound laceration gash on body
      ctx.fillStyle = '#6b0714';
      ctx.strokeStyle = '#ff4d5a';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(wx, wy, 10, 5.5, -0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Gauze / Personal Bandage on body
      if (interv.gauzeLayers > 0 || interv.personalBandageOn) {
        ctx.fillStyle = interv.personalBandageOn ? '#7c8b6a' : '#f8fafc';
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.roundRect(wx - 13, wy - 9, 26, 18, 4);
        ctx.fill();
        ctx.stroke();
      }

      // CAT Tourniquet proximal to active wound on full body!
      if (interv.catPlaced) {
        const catOffY = -24;
        const catOffX = bodyRegionId === 'forearm' || bodyRegionId === 'upperArm' ? 8 : 0;
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = interv.catWindlassTurns === 3 ? '#10b981' : '#f59e0b';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.roundRect(wx + catOffX - 15, wy + catOffY - 5, 30, 10, 3);
        ctx.fill();
        ctx.stroke();
      }

      // Triangular Sling across chest/shoulder for arm injuries
      if (interv.triangleOn && (bodyRegionId === 'forearm' || bodyRegionId === 'upperArm')) {
        ctx.strokeStyle = 'rgba(226, 232, 240, 0.85)';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(W * 0.5 + 16, 128);
        ctx.lineTo(wx, wy + 8);
        ctx.stroke();
      }

      // Pulsing target ring around active injury
      const ringPulse = 14 + Math.sin(clock * 5) * 3;
      ctx.strokeStyle = phys.bleedingStopped ? 'rgba(16, 185, 129, 0.85)' : 'rgba(239, 68, 68, 0.85)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(wx, wy, ringPulse, 0, Math.PI * 2);
      ctx.stroke();

      // Blood droplets flying from body wound
      for (const p of st.particles) {
        const a = Math.max(0, 1 - p.life / p.maxLife);
        ctx.fillStyle = p.art ? `rgba(255, 28, 42, ${a})` : `rgba(96, 6, 24, ${a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // 5. CLICKABLE LIMB INJURY HOTSPOTS ON FULL BODY
      Object.values(BODY_REGIONS).forEach((reg) => {
        const pos = reg.bodyPos[gender] || reg.bodyPos.male;
        const rx = pos.x * W;
        const ry = pos.y * H;
        const isActive = reg.id === bodyRegionId;
        ctx.save();
        ctx.fillStyle = isActive ? '#ef4444' : 'rgba(56, 189, 248, 0.85)';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(rx, ry, isActive ? 5.5 : 4.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Compact Hebrew label next to hotspot
        ctx.font = 'bold 10.5px "Segoe UI", Arial';
        const tw = ctx.measureText(reg.shortHe).width;
        const lx = rx - 14 - tw * 0.5 - 6;
        ctx.fillStyle = isActive ? 'rgba(185, 28, 28, 0.92)' : 'rgba(10, 17, 32, 0.84)';
        ctx.strokeStyle = isActive ? '#fca5a5' : 'rgba(148, 163, 184, 0.45)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(lx - tw / 2 - 6, ry - 10, tw + 12, 20, 9);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#f8fafc';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(reg.shortHe, lx, ry);
        ctx.restore();
      });

      ctx.restore();
    }

    rafId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [gender, bodyRegionId, physiologyRef, interventionsRef, scenario]);

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = canvas.width / rect.width;
    uiStateRef.current.mouseX = (e.clientX - rect.left) * dpr;
    uiStateRef.current.mouseY = (e.clientY - rect.top) * dpr;
  };

  const handleMouseLeave = () => {
    uiStateRef.current.mouseX = -999;
    uiStateRef.current.mouseY = -999;
  };

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dprX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const dprY = (e.clientY - rect.top) * (canvas.height / rect.height);
    const scaleFit = Math.min(canvas.width / W, canvas.height / H);
    const offX = (canvas.width - W * scaleFit) * 0.5;
    const offY = (canvas.height - H * scaleFit) * 0.5;
    const x = (dprX - offX) / scaleFit;
    const y = (dprY - offY) / scaleFit;

    // 1. Check clickable limb injury sites first
    for (const reg of Object.values(BODY_REGIONS)) {
      const pos = reg.bodyPos[gender] || reg.bodyPos.male;
      const rx = pos.x * W;
      const ry = pos.y * H;
      if (Math.hypot(x - rx, y - ry) < 34 || (Math.abs(x - (rx - 44)) < 42 && Math.abs(y - ry) < 16)) {
        setClickedOrgan(null);
        onSelectBodyRegion(reg.id);
        return;
      }
    }

    // 2. Check central organs (Neck/Carotid, Heart, Lungs, Abdomen, Pelvis)
    const cx = W * 0.5;
    if (Math.abs(x - cx) < 25 && y > 92 && y < 134) {
      setClickedOrgan(FULL_BODY_ORGANS.carotid);
    } else if (Math.abs(x - (cx + 8)) < 26 && y > 176 && y < 222) {
      setClickedOrgan(FULL_BODY_ORGANS.heart);
    } else if (Math.abs(x - cx) < 56 && y > 152 && y < 236) {
      setClickedOrgan(FULL_BODY_ORGANS.lungs);
    } else if (Math.abs(x - cx) < 48 && y >= 236 && y < 322) {
      setClickedOrgan(FULL_BODY_ORGANS.abdomen);
    } else if (Math.abs(x - cx) < 62 && y >= 322 && y < 385) {
      setClickedOrgan(FULL_BODY_ORGANS.skeleton);
    }
  };

  const activeRegion = BODY_REGIONS[bodyRegionId] || BODY_REGIONS.forearm;

  return (
    <div className="panel fullbody-panel">
      <div className="panel-header">
        <div className="panel-title">
          <User size={16} className="text-sky" />
          <span>אנטומיית גוף מלא ריאליסטית — {gender === 'male' ? 'זכר' : 'נקבה'}</span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <div className="segmented">
            <button
              type="button"
              className={gender === 'male' ? 'active' : ''}
              onClick={() => onChangeGender('male')}
            >
              👨 זכר
            </button>
            <button
              type="button"
              className={gender === 'female' ? 'active' : ''}
              onClick={() => onChangeGender('female')}
            >
              👩 נקבה
            </button>
          </div>
          <button
            type="button"
            className={`mini-chip ${lensEnabled ? 'on' : ''}`}
            onClick={() => setLensEnabled((v) => !v)}
            title="הזז את העכבר על הגוף כדי לסרוק שרירים, שלד, לב וכלי דם מתחת לעור"
          >
            <Scan size={12} /> עדשת X-Ray בעכבר
          </button>
          <button type="button" className="mini-chip xray-accent" onClick={onSwitchToMacro}>
            <ZoomIn size={12} /> תקריב 10 שכבות לפצע
          </button>
        </div>
      </div>

      {/* Live Layer Peel Controls */}
      <div className="fullbody-controls-bar">
        <div className="fullbody-peel-wrap">
          <label htmlFor="fullBodyPeel" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#bae6fd', whiteSpace: 'nowrap' }}>
            <Layers size={13} style={{ verticalAlign: 'middle', marginLeft: 4 }} />
            קילוף שכבות חי ({peelPct}%):
          </label>
          <input
            id="fullBodyPeel"
            type="range"
            min={0}
            max={100}
            value={peelPct}
            onChange={(e) => setPeelPct(Number(e.target.value))}
            className="peel-slider"
          />
          <div style={{ display: 'flex', gap: 4 }}>
            <button type="button" className={`mini-chip ${peelPct === 0 ? 'on' : ''}`} onClick={() => setPeelPct(0)}>עור</button>
            <button type="button" className={`mini-chip ${peelPct === 36 ? 'on' : ''}`} onClick={() => setPeelPct(36)}>שרירים</button>
            <button type="button" className={`mini-chip ${peelPct === 85 ? 'on' : ''}`} onClick={() => setPeelPct(85)}>איברים ועורקים</button>
          </div>
        </div>
      </div>

      {/* Main Realistic Full Body Canvas */}
      <div className="fullbody-canvas-host">
        <canvas
          ref={canvasRef}
          className="fullbody-canvas"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleCanvasClick}
        />

        {/* Floating Injury Zone Info Overlay */}
        <div className="fullbody-region-card">
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#fca5a5', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Crosshair size={13} /> מוקד פציעה פעיל: {activeRegion.nameHe}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#cbd5e1', marginTop: 3 }}>
            <strong>כלי דם:</strong> {activeRegion.arteryNameHe} ({activeRegion.arteryLatin})
          </div>
          <div style={{ fontSize: '0.69rem', color: '#94a3b8', marginTop: 2 }}>
            לחץ על כל נקודה כחולה בגוף להחלפת אזור פציעה, או לחץ על הלב/ריאות/צוואר ללמידה!
          </div>
          <button
            type="button"
            className="mini-chip xray-accent"
            style={{ marginTop: 6, width: '100%', justifyContent: 'center' }}
            onClick={() => onOpenXRay('artery')}
          >
            <Scan size={12} /> פתח סורק אנטומי גוף מלא (X-Ray)
          </button>
        </div>

        {/* Clicked Organ Quick Fact Card */}
        {clickedOrgan && (
          <div className="fullbody-organ-popup">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <strong style={{ color: '#7dd3fc', fontSize: '0.8rem' }}>{clickedOrgan.nameHe}</strong>
              <button type="button" className="mini-chip" onClick={() => setClickedOrgan(null)}>✕</button>
            </div>
            <p style={{ fontSize: '0.73rem', color: '#e2e8f0', marginBottom: 4 }}>{clickedOrgan.summary}</p>
            <p style={{ fontSize: '0.71rem', color: '#fde68a' }}>🚑 {clickedOrgan.clinicalNote}</p>
          </div>
        )}
      </div>

      {/* Quick Injury Site Switcher Footer */}
      <div className="fullbody-region-strip">
        <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700 }}>בחר אזור פציעה על הגוף:</span>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {Object.values(BODY_REGIONS).map((reg) => (
            <button
              key={reg.id}
              type="button"
              className={`mini-chip ${reg.id === bodyRegionId ? 'on' : ''}`}
              onClick={() => onSelectBodyRegion(reg.id)}
            >
              {reg.nameHe}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
