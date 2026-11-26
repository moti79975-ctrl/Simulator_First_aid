import React, { useState, useEffect, useRef } from 'react';
import { X, Layers, Scan, Eye, EyeOff, AlertTriangle, Activity, BookOpen } from 'lucide-react';
import { ANATOMY_LAYERS, ANATOMY_MAP } from '../data/anatomyDatabase';
import { computeArterialWave } from '../engines/PhysiologyEngine';

const CW = 420;
const CH = 560;

/**
 * src/components/AnatomyXRayModal.jsx
 * סורק אנטומי גוף מלא (זכר ונקבה) לקילוף אינטראקטיבי של 10 השכבות:
 * מאפשר לעבור בין זכר לנקבה, לקלף שכבה אחר שכבה (1 עד 10) או לכבות/להדליק מערכות פרטניות
 * ולחקור כל רקמה, איבר, שריר, עצב וכלי דם באנציקלופדיה המלאה שבצד.
 */
export default function AnatomyXRayModal({
  isOpen,
  initialLayerId,
  gender,
  onChangeGender,
  onClose,
  currentHr,
  currentRr,
}) {
  const [peelDepth, setPeelDepth] = useState(1);
  const [scanMode, setScanMode] = useState('natural'); // 'natural' | 'xray' | 'vascular'
  const [activeLayerId, setActiveLayerId] = useState(initialLayerId || 'artery');
  const [hiddenOverrides, setHiddenOverrides] = useState({});
  const canvasRef = useRef(null);

  useEffect(() => {
    if (isOpen && initialLayerId) {
      setActiveLayerId(initialLayerId);
      const layer = ANATOMY_MAP[initialLayerId];
      if (layer) setPeelDepth(Math.max(1, layer.depthOrder));
      setHiddenOverrides({});
    }
  }, [isOpen, initialLayerId]);

  const isLayerVisible = (layerId) => {
    if (hiddenOverrides[layerId] !== undefined) return !hiddenOverrides[layerId];
    const layer = ANATOMY_MAP[layerId];
    return layer ? layer.depthOrder >= peelDepth : true;
  };

  const toggleLayerOverride = (layerId) => {
    const currentlyVis = isLayerVisible(layerId);
    setHiddenOverrides((prev) => ({ ...prev, [layerId]: currentlyVis }));
  };

  // High-res Full-Body Male/Female Layered Canvas Renderer inside Modal
  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = CW * dpr;
    canvas.height = CH * dpr;

    let rafId = 0;
    let phase = 0;
    let lastTs = 0;
    let clock = 0;

    const isF = gender === 'female';
    const cx = CW * 0.5;

    function traceFullSilhouette(breath) {
      const neckW = isF ? 13.5 : 17.5;
      const shX = isF ? 54 : 67;
      const shY = isF ? 116 : 112;
      const axX = isF ? 38 : 48;
      const axY = isF ? 162 : 164;
      const chW = (isF ? 41 : 49) + breath * 1.8;
      const waW = isF ? 30 : 41;
      const hipW = isF ? 52 : 44;
      const elbOut = isF ? 82 : 94;
      const elbIn = isF ? 64 : 73;
      const wriOut = isF ? 102 : 114;
      const wriIn = isF ? 88 : 98;

      ctx.beginPath();
      ctx.moveTo(cx - neckW, 90);
      ctx.bezierCurveTo(cx - neckW - 12, 102, cx - shX + 10, shY - 6, cx - shX, shY + 10);
      ctx.bezierCurveTo(cx - shX - 8, shY + 34, cx - elbOut + 4, 190, cx - elbOut, 222);
      ctx.bezierCurveTo(cx - elbOut - 6, 245, cx - wriOut + 3, 272, cx - wriOut, 294);
      ctx.bezierCurveTo(cx - wriOut - 9, 314, cx - wriOut - 5, 344, cx - wriOut + 6, 342);
      ctx.bezierCurveTo(cx - wriIn + 4, 336, cx - wriIn + 5, 314, cx - wriIn, 294);
      ctx.bezierCurveTo(cx - wriIn + 10, 266, cx - elbIn - 3, 240, cx - elbIn, 218);
      ctx.bezierCurveTo(cx - elbIn + 11, 194, cx - axX - 9, axY + 14, cx - axX, axY);
      ctx.bezierCurveTo(cx - chW, axY + 20, cx - waW - 4, 224, cx - waW, 240);
      ctx.bezierCurveTo(cx - waW - 6, 258, cx - hipW, 270, cx - hipW, 288);
      ctx.bezierCurveTo(cx - hipW - 1, 328, cx - hipW + 5, 370, cx - 35, 412);
      ctx.bezierCurveTo(cx - 38, 434, cx - 36, 456, cx - 25, 518);
      ctx.bezierCurveTo(cx - 33, 536, cx - 33, 545, cx - 18, 544);
      ctx.bezierCurveTo(cx - 10, 544, cx - 9, 534, cx - 11, 518);
      ctx.bezierCurveTo(cx - 8, 464, cx - 7, 436, cx - 9, 412);
      ctx.bezierCurveTo(cx - 7, 370, cx - 8, 338, cx - 3, 316);
      ctx.quadraticCurveTo(cx, 321, cx + 3, 316);

      // Mirror left half of patient
      ctx.bezierCurveTo(cx + 8, 338, cx + 7, 370, cx + 9, 412);
      ctx.bezierCurveTo(cx + 7, 436, cx + 8, 464, cx + 11, 518);
      ctx.bezierCurveTo(cx + 9, 534, cx + 10, 544, cx + 18, 544);
      ctx.bezierCurveTo(cx + 33, 545, cx + 33, 536, cx + 25, 518);
      ctx.bezierCurveTo(cx + 36, 456, cx + 38, 434, cx + 35, 412);
      ctx.bezierCurveTo(cx + hipW - 5, 370, cx + hipW + 1, 328, cx + hipW, 288);
      ctx.bezierCurveTo(cx + hipW, 270, cx + waW + 6, 258, cx + waW, 240);
      ctx.bezierCurveTo(cx + waW + 4, 224, cx + chW, axY + 20, cx + axX, axY);
      ctx.bezierCurveTo(cx + axX + 9, axY + 14, cx + elbIn - 11, 194, cx + elbIn, 218);
      ctx.bezierCurveTo(cx + elbIn + 3, 240, cx + wriIn - 10, 266, cx + wriIn, 294);
      ctx.bezierCurveTo(cx + wriIn - 5, 314, cx + wriIn - 4, 336, cx + wriOut - 6, 342);
      ctx.bezierCurveTo(cx + wriOut + 5, 344, cx + wriOut + 9, 314, cx + wriOut, 294);
      ctx.bezierCurveTo(cx + wriOut - 3, 272, cx + elbOut + 6, 245, cx + elbOut, 222);
      ctx.bezierCurveTo(cx + elbOut - 4, 190, cx + shX + 8, shY + 34, cx + shX, shY + 10);
      ctx.bezierCurveTo(cx + shX - 10, shY - 6, cx + neckW + 12, 102, cx + neckW, 90);
      ctx.closePath();
    }

    const render = (ts) => {
      rafId = requestAnimationFrame(render);
      if (!lastTs) lastTs = ts;
      const dt = Math.min(0.05, (ts - lastTs) / 1000);
      lastTs = ts;
      clock += dt;
      phase += Math.max(0.5, (currentHr || 76) / 60) * dt;
      const wave = computeArterialWave(phase);
      const breath = Math.sin(clock * Math.PI * 2 * Math.max(0.16, (currentRr || 15) / 60));

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, CW, CH);

      // Background
      const bg = ctx.createRadialGradient(cx, CH * 0.45, 20, cx, CH * 0.5, 340);
      bg.addColorStop(0, scanMode === 'xray' ? '#0b254a' : '#12203a');
      bg.addColorStop(1, '#040914');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, CW, CH);

      // Blueprint grid
      ctx.strokeStyle = scanMode === 'xray' ? 'rgba(56, 189, 248, 0.09)' : 'rgba(148, 163, 184, 0.05)';
      ctx.lineWidth = 1;
      for (let x = 20; x < CW; x += 35) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CH); ctx.stroke();
      }
      for (let y = 20; y < CH; y += 35) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CW, y); ctx.stroke();
      }

      const showEpi = isLayerVisible('epidermis');
      const showDerm = isLayerVisible('dermis');
      const showCap = isLayerVisible('capillaries');
      const showFat = isLayerVisible('subcutaneous');
      const showFascia = isLayerVisible('fascia');
      const showMusc = isLayerVisible('muscle');
      const showTendon = isLayerVisible('tendon');
      const showNerve = isLayerVisible('nerve');
      const showVein = isLayerVisible('vein');
      const showArtery = isLayerVisible('artery');

      // Clipped Body Systems Stack
      ctx.save();
      traceFullSilhouette(breath);
      ctx.save();
      ctx.clip();

      // Base anatomical cavity / skeleton backdrop
      ctx.fillStyle = scanMode === 'xray' ? 'rgba(10, 28, 56, 0.92)' : '#1a1118';
      ctx.fillRect(0, 80, CW, CH - 80);

      // Deep Skeleton & Beating Heart / Breathing Lungs (always cleanly visible when superficial layers peeled or in X-Ray!)
      ctx.save();
      ctx.globalAlpha = scanMode === 'vascular' ? 0.3 : 0.9;
      // Lungs
      ctx.save();
      ctx.translate(cx, 164);
      ctx.scale(1 + breath * 0.05, 1 + breath * 0.05);
      ctx.fillStyle = scanMode === 'xray' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(205, 102, 118, 0.85)';
      ctx.beginPath();
      ctx.ellipse(-18, 0, isF ? 16 : 19, 31, 0.14, 0, Math.PI * 2);
      ctx.ellipse(18, 0, isF ? 14 : 17, 29, -0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Beating Heart
      ctx.save();
      ctx.translate(cx + 6, 166);
      ctx.scale(1 + wave * 0.12, 1 + wave * 0.12);
      ctx.fillStyle = '#dc1b30';
      ctx.beginPath();
      ctx.moveTo(0, -13);
      ctx.bezierCurveTo(15, -14, 18, 5, 3, 17);
      ctx.bezierCurveTo(-13, 9, -15, -10, 0, -13);
      ctx.fill();
      ctx.restore();

      // Spine, Ribs, Pelvis, Limb Bones
      ctx.strokeStyle = scanMode === 'xray' ? '#bae6fd' : '#e2e8f0';
      ctx.lineCap = 'round';
      ctx.lineWidth = 5.5;
      ctx.beginPath();
      ctx.moveTo(cx, 92);
      ctx.lineTo(cx, 282);
      ctx.stroke();

      ctx.lineWidth = 2.6;
      const ribW = isF ? 31 : 38;
      for (let r = 0; r < 7; r++) {
        const ry = 126 + r * 10.5;
        const rw = ribW + Math.sin((r / 6) * Math.PI) * 7 + breath;
        ctx.beginPath();
        ctx.moveTo(cx - 3, ry);
        ctx.bezierCurveTo(cx - rw, ry - 3, cx - rw, ry + 9, cx - 4, ry + 6);
        ctx.moveTo(cx + 3, ry);
        ctx.bezierCurveTo(cx + rw, ry - 3, cx + rw, ry + 9, cx + 4, ry + 6);
        ctx.stroke();
      }

      const pelW = isF ? 42 : 34;
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(cx, 272);
      ctx.bezierCurveTo(cx - pelW, 255, cx - pelW - 3, 296, cx - 15, 307);
      ctx.quadraticCurveTo(cx, 314, cx + 15, 307);
      ctx.bezierCurveTo(cx + pelW + 3, 296, cx + pelW, 255, cx, 272);
      ctx.stroke();

      // Long bones
      ctx.lineWidth = 5.5;
      const shB = isF ? 48 : 58;
      const elB = isF ? 73 : 84;
      const wrB = isF ? 95 : 106;
      const hiB = isF ? 29 : 24;
      ctx.beginPath();
      ctx.moveTo(cx - shB, 126); ctx.lineTo(cx - elB, 222); ctx.lineTo(cx - wrB, 294);
      ctx.moveTo(cx + shB, 126); ctx.lineTo(cx + elB, 222); ctx.lineTo(cx + wrB, 294);
      ctx.moveTo(cx - hiB, 298); ctx.lineTo(cx - 22, 412); ctx.lineTo(cx - 18, 518);
      ctx.moveTo(cx + hiB, 298); ctx.lineTo(cx + 22, 412); ctx.lineTo(cx + 18, 518);
      ctx.stroke();
      ctx.restore();

      // Layer 6: Skeletal Muscles
      if (showMusc) {
        ctx.save();
        ctx.globalAlpha = scanMode === 'vascular' ? 0.16 : scanMode === 'xray' ? 0.36 : activeLayerId === 'muscle' ? 0.92 : 0.72;
        ctx.fillStyle = '#99222c';
        ctx.fillRect(0, 90, CW, CH - 90);
        // Striated muscle highlight bands
        ctx.strokeStyle = 'rgba(255, 180, 185, 0.25)';
        ctx.lineWidth = 1.1;
        for (let my = 115; my < 520; my += 11) {
          ctx.beginPath();
          ctx.moveTo(cx - 110, my);
          ctx.lineTo(cx + 110, my);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Layer 7: White Tendons
      if (showTendon) {
        ctx.save();
        ctx.globalAlpha = scanMode === 'vascular' ? 0.2 : 0.9;
        ctx.strokeStyle = activeLayerId === 'tendon' ? '#38bdf8' : '#f8f5ef';
        ctx.lineWidth = activeLayerId === 'tendon' ? 4.2 : 2.8;
        ctx.beginPath();
        // Linea alba + wrist & patellar tendons
        ctx.moveTo(cx, 165); ctx.lineTo(cx, 280);
        ctx.moveTo(cx - elB, 226); ctx.lineTo(cx - wrB, 294);
        ctx.moveTo(cx + elB, 226); ctx.lineTo(cx + wrB, 294);
        ctx.moveTo(cx - 22, 392); ctx.lineTo(cx - 22, 428);
        ctx.moveTo(cx + 22, 392); ctx.lineTo(cx + 22, 428);
        ctx.stroke();
        ctx.restore();
      }

      // Layer 5: Deep Fascia Sheath
      if (showFascia) {
        ctx.save();
        ctx.globalAlpha = scanMode === 'vascular' ? 0.08 : activeLayerId === 'fascia' ? 0.52 : 0.24;
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(0, 90, CW, CH - 90);
        ctx.restore();
      }

      // Layer 4: Subcutaneous Fat
      if (showFat) {
        ctx.save();
        ctx.globalAlpha = scanMode === 'vascular' ? 0.06 : scanMode === 'xray' ? 0.2 : activeLayerId === 'subcutaneous' ? 0.72 : 0.42;
        ctx.fillStyle = '#eab308';
        ctx.fillRect(0, 90, CW, CH - 90);
        ctx.restore();
      }

      // Layer 2: Dermis
      if (showDerm) {
        ctx.save();
        ctx.globalAlpha = scanMode === 'vascular' ? 0.05 : scanMode === 'xray' ? 0.14 : activeLayerId === 'dermis' ? 0.68 : 0.35;
        ctx.fillStyle = '#e0867d';
        ctx.fillRect(0, 90, CW, CH - 90);
        ctx.restore();
      }

      // Layer 1: Outer Epidermis Skin (translucent in X-ray/Vascular so user sees through!)
      if (showEpi) {
        ctx.save();
        ctx.globalAlpha =
          scanMode === 'vascular' ? 0.12 : scanMode === 'xray' ? 0.22 : activeLayerId === 'epidermis' ? 0.92 : 0.78;
        const sk = ctx.createLinearGradient(cx - 100, 90, cx + 100, 520);
        sk.addColorStop(0, '#a66e50');
        sk.addColorStop(0.3, '#e4ae8b');
        sk.addColorStop(0.55, '#f0c5a7');
        sk.addColorStop(1, '#925c40');
        ctx.fillStyle = sk;
        ctx.fillRect(0, 90, CW, CH - 90);
        ctx.restore();
      }

      // Layer 3: Capillaries Micro-Mesh
      if (showCap) {
        ctx.save();
        ctx.globalAlpha = activeLayerId === 'capillaries' ? 1 : 0.72;
        ctx.strokeStyle = '#fb7185';
        ctx.lineWidth = 1.25;
        [
          [cx - 86, 252],
          [cx + 86, 252],
          [cx - 32, 345],
          [cx + 32, 345],
        ].forEach(([mx, my]) => {
          ctx.beginPath();
          ctx.moveTo(mx - 10, my); ctx.quadraticCurveTo(mx, my - 8, mx + 10, my + 2);
          ctx.moveTo(mx, my - 3); ctx.lineTo(mx + 6, my + 10);
          ctx.stroke();
        });
        ctx.restore();
      }

      // Layer 8: Peripheral Nerves
      if (showNerve) {
        ctx.save();
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = activeLayerId === 'nerve' ? 3.4 : 2.0;
        ctx.shadowColor = activeLayerId === 'nerve' ? '#fde047' : 'transparent';
        ctx.shadowBlur = activeLayerId === 'nerve' ? 8 : 0;
        ctx.beginPath();
        ctx.moveTo(cx, 74); ctx.lineTo(cx, 280);
        ctx.moveTo(cx, 114); ctx.lineTo(cx - shB, 128); ctx.lineTo(cx - elB + 4, 222); ctx.lineTo(cx - wrB + 3, 294);
        ctx.moveTo(cx, 114); ctx.lineTo(cx + shB, 128); ctx.lineTo(cx + elB - 4, 222); ctx.lineTo(cx + wrB - 3, 294);
        ctx.moveTo(cx, 272); ctx.lineTo(cx - hiB - 3, 304); ctx.lineTo(cx - 26, 412); ctx.lineTo(cx - 22, 514);
        ctx.moveTo(cx, 272); ctx.lineTo(cx + hiB + 3, 304); ctx.lineTo(cx + 26, 412); ctx.lineTo(cx + 22, 514);
        ctx.stroke();
        ctx.restore();
      }

      // Layer 9: Systemic Veins
      if (showVein) {
        ctx.save();
        ctx.strokeStyle = activeLayerId === 'vein' ? '#60a5fa' : '#3b82f6';
        ctx.lineWidth = activeLayerId === 'vein' ? 4.8 : 3.2;
        ctx.shadowColor = activeLayerId === 'vein' ? '#60a5fa' : 'transparent';
        ctx.shadowBlur = activeLayerId === 'vein' ? 8 : 0;
        ctx.beginPath();
        ctx.moveTo(cx - 5, 160); ctx.lineTo(cx - 5, 272);
        ctx.moveTo(cx - 7, 152); ctx.lineTo(cx - 8, 82);
        ctx.moveTo(cx + 7, 152); ctx.lineTo(cx + 8, 82);
        ctx.moveTo(cx - 5, 126); ctx.lineTo(cx - shB - 2, 134); ctx.lineTo(cx - elB - 3, 224); ctx.lineTo(cx - wrB - 3, 296);
        ctx.moveTo(cx + 5, 126); ctx.lineTo(cx + shB + 2, 134); ctx.lineTo(cx + elB + 3, 224); ctx.lineTo(cx + wrB + 3, 296);
        ctx.moveTo(cx - 5, 272); ctx.lineTo(cx - hiB + 3, 308); ctx.lineTo(cx - 19, 414); ctx.lineTo(cx - 15, 518);
        ctx.moveTo(cx - 5, 272); ctx.lineTo(cx + hiB - 3, 308); ctx.lineTo(cx + 19, 414); ctx.lineTo(cx + 15, 518);
        ctx.stroke();
        ctx.restore();
      }

      // Layer 10: Pulsing Systemic Arteries
      if (showArtery) {
        ctx.save();
        ctx.strokeStyle = '#ff2438';
        ctx.lineWidth = (activeLayerId === 'artery' ? 4.6 : 3.4) * (1 + wave * 0.35);
        ctx.shadowColor = 'rgba(255, 36, 56, 0.8)';
        ctx.shadowBlur = 5 + wave * 9;
        ctx.beginPath();
        ctx.moveTo(cx + 4, 162); ctx.lineTo(cx + 2, 272);
        ctx.moveTo(cx - 4, 134); ctx.lineTo(cx - 5, 80);
        ctx.moveTo(cx + 5, 134); ctx.lineTo(cx + 5, 80);
        ctx.moveTo(cx, 130); ctx.lineTo(cx - shB + 2, 130); ctx.lineTo(cx - elB + 1, 222); ctx.lineTo(cx - wrB + 1, 294);
        ctx.moveTo(cx, 130); ctx.lineTo(cx + shB - 2, 130); ctx.lineTo(cx + elB - 1, 222); ctx.lineTo(cx + wrB - 1, 294);
        ctx.moveTo(cx + 2, 272); ctx.lineTo(cx - hiB, 308); ctx.lineTo(cx - 23, 412); ctx.lineTo(cx - 19, 518);
        ctx.moveTo(cx + 2, 272); ctx.lineTo(cx + hiB, 308); ctx.lineTo(cx + 23, 412); ctx.lineTo(cx + 19, 518);
        ctx.stroke();
        ctx.restore();
      }

      ctx.restore(); // End clip

      // Crisp silhouette rim
      ctx.strokeStyle = scanMode === 'xray' ? 'rgba(56, 189, 248, 0.65)' : 'rgba(148, 163, 184, 0.42)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      // Head silhouette (Cranium / Realistic Face silhouette)
      ctx.save();
      const headRx = isF ? 23 : 26;
      const headRy = isF ? 31 : 33;
      const hy = 52;
      if (isF && showEpi && scanMode === 'natural') {
        ctx.fillStyle = '#4c2c1b';
        ctx.beginPath();
        ctx.ellipse(cx, hy + 16, 33, 38, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle =
        scanMode === 'xray' || !showEpi ? 'rgba(203, 213, 225, 0.25)' : '#e4b391';
      ctx.strokeStyle = scanMode === 'xray' ? '#7dd3fc' : 'rgba(148,163,184,0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(cx, hy, headRx, headRy, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (showNerve && (!showEpi || scanMode !== 'natural')) {
        // Brain hemisphere glow in X-Ray / deep nerve mode
        ctx.fillStyle = 'rgba(250, 204, 21, 0.35)';
        ctx.beginPath();
        ctx.ellipse(cx, hy - 6, headRx * 0.72, headRy * 0.56, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      ctx.restore();
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [isOpen, gender, scanMode, peelDepth, activeLayerId, hiddenOverrides, currentHr, currentRr]);

  if (!isOpen) return null;

  const activeLayer = ANATOMY_MAP[activeLayerId] || ANATOMY_LAYERS[9];

  return (
    <div className="modal-backdrop open" onClick={onClose}>
      <div className="modal-box xray-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Scan size={20} className="text-sky" />
            <div>
              <strong style={{ fontSize: '1.03rem', color: '#f8fafc' }}>
                סורק אנטומי גוף מלא (זכר ונקבה) — קילוף שכבות אינטראקטיבי
              </strong>
              <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                קלף שכבה אחר שכבה בגוף האדם המלא, השווה בין אנטומיית זכר ונקבה וחקור כל רקמה, איבר וכלי דם
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div className="segmented">
              <button className={gender === 'male' ? 'active' : ''} onClick={() => onChangeGender('male')}>
                👨 זכר
              </button>
              <button className={gender === 'female' ? 'active' : ''} onClick={() => onChangeGender('female')}>
                👩 נקבה
              </button>
            </div>
            <button className="icon-btn" onClick={onClose}>
              <X size={15} /> סגור
            </button>
          </div>
        </div>

        <div className="xray-body">
          {/* LEFT: FULL BODY CANVAS + LAYER PEELER */}
          <div className="xray-visual-col">
            <div className="xray-controls-card">
              <div className="xray-mode-row">
                <div className="segmented">
                  <button className={scanMode === 'natural' ? 'active' : ''} onClick={() => setScanMode('natural')}>
                    אנטומיה ריאליסטית
                  </button>
                  <button className={scanMode === 'xray' ? 'active' : ''} onClick={() => setScanMode('xray')}>
                    סורק X-Ray
                  </button>
                  <button className={scanMode === 'vascular' ? 'active' : ''} onClick={() => setScanMode('vascular')}>
                    כלי דם ועצבים
                  </button>
                </div>

                <button
                  className="mini-chip"
                  onClick={() => {
                    setPeelDepth(1);
                    setHiddenOverrides({});
                  }}
                >
                  אפס שכבות
                </button>
              </div>

              <div className="peel-slider-row">
                <label htmlFor="peelSlider" style={{ fontSize: '0.78rem', fontWeight: 700, color: '#bae6fd' }}>
                  <Layers size={14} style={{ verticalAlign: 'middle', marginLeft: 5 }} />
                  קילוף שכבות גוף מלא ({peelDepth}/10 — חושף מ:{' '}
                  {ANATOMY_LAYERS.find((l) => l.depthOrder === peelDepth)?.nameHe.split(' (')[0]}):
                </label>
                <input
                  id="peelSlider"
                  type="range"
                  min={1}
                  max={10}
                  value={peelDepth}
                  onChange={(e) => {
                    setPeelDepth(Number(e.target.value));
                    setHiddenOverrides({});
                  }}
                  className="peel-slider"
                />
              </div>
            </div>

            <div className="xray-fullbody-split">
              <div className={`xray-svg-stage mode-${scanMode}`} style={{ display: 'flex', justifyContent: 'center' }}>
                <canvas ref={canvasRef} style={{ width: '100%', maxWidth: 320, height: 'auto', aspectRatio: '420/560' }} />
              </div>

              {/* 10 Layer Visibility Toggles beside full body */}
              <div className="xray-layer-chips single-col">
                {ANATOMY_LAYERS.map((layer) => {
                  const vis = isLayerVisible(layer.id);
                  const isSel = activeLayerId === layer.id;
                  return (
                    <div
                      key={layer.id}
                      className={`xray-chip-row ${isSel ? 'selected' : ''} ${!vis ? 'peeled' : ''}`}
                      onClick={() => setActiveLayerId(layer.id)}
                    >
                      <span className="layer-swatch" style={{ background: layer.color }} />
                      <span className="xray-chip-name">
                        {layer.depthOrder}. {layer.nameHe.split(' (')[0]}
                      </span>
                      <button
                        type="button"
                        className="eye-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLayerOverride(layer.id);
                        }}
                        title={vis ? 'קלף/הסתר שכבה' : 'הצג שכבה'}
                      >
                        {vis ? <Eye size={13} /> : <EyeOff size={13} />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT: MEDICAL ENCYCLOPEDIA INSPECTOR */}
          <div className="xray-info-col">
            <div className="xray-info-head">
              <span className="layer-swatch" style={{ background: activeLayer.color, width: 16, height: 16 }} />
              <div>
                <h3 style={{ fontSize: '1.02rem', color: '#7dd3fc' }}>{activeLayer.nameHe}</h3>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  {activeLayer.latin} • עומק: {activeLayer.depthMm} • מודל: {gender === 'male' ? 'זכר' : 'נקבה'}
                </div>
              </div>
            </div>

            <div className="xray-section">
              <h4><BookOpen size={14} /> מבנה אנטומי מפורט</h4>
              <p>{activeLayer.anatomyDetails}</p>
            </div>

            <div className="xray-section">
              <h4><Activity size={14} /> תפקיד פיזיולוגי</h4>
              <p>{activeLayer.physiology}</p>
            </div>

            <div className="xray-section">
              <h4>🩸 מאפייני פגיעה ודימום</h4>
              <p>{activeLayer.injuryCharacteristics}</p>
              <div className="bleed-profile-badge">{activeLayer.bleedingProfile}</div>
            </div>

            <div className="xray-section">
              <h4>🚑 הנחיות טיפול למע"ר</h4>
              <p>{activeLayer.firstAidGuidance}</p>
            </div>

            <div className="xray-section red-flags-box">
              <h4><AlertTriangle size={14} /> דגלים אדומים לזיהוי בשטח</h4>
              <ul>
                {activeLayer.redFlags.map((flag, idx) => (
                  <li key={idx}>{flag}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
