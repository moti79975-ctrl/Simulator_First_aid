import React, { useEffect, useRef, useState } from 'react';
import { Microscope, GitBranch, Sliders, RefreshCw, Snowflake, Zap, Activity } from 'lucide-react';
import { CAUSAL_NODES, CAUSAL_EDGES, LAB_PRESETS } from '../data/emergencyMedicalDatabase';
import DeepDiveBox from './DeepDiveBox';

/**
 * src/components/PhysiologyLabTab.jsx
 * מעבדת פיזיולוגיה אינטראקטיבית (אופציה 3):
 * 1. מיקרוסקופ תוך-וסקולרי חי (Canvas 60FPS): כדוריות אדומות עם חמצן, טסיות דם,
 *    טוויית רשת פיברין תחת לחץ ישיר, הרס קריש בשחרור מוקדם, כיווץ כלי דם והשפעת היפותרמיה!
 * 2. מפת סיבה ותוצאה פיזיולוגית חיה (Causal Graph SVG) המתעדכנת בזמן אמת + העמקה לכל צומת.
 * 3. סימולטור ניסויים "מה קורה אם...?" עם 4 סליידרים + 5 תרחישי ניסוי מובנים.
 */
export default function PhysiologyLabTab({ livePhysiology, gender }) {
  const [bloodLossPct, setBloodLossPct] = useState(18);
  const [tempC, setTempC] = useState(36.5);
  const [airwayBlockPct, setAirwayBlockPct] = useState(0);
  const [directPressurePct, setDirectPressurePct] = useState(0);
  const [selectedNodeId, setSelectedNodeId] = useState('vasoconstriction');
  const [clotBurstNotice, setClotBurstNotice] = useState(null);

  const canvasRef = useRef(null);
  const simRef = useRef({
    bloodLossPct: 18,
    tempC: 36.5,
    airwayBlockPct: 0,
    directPressurePct: 0,
    clotLevel: 0, // 0..100
    prevPressurePct: 0,
  });

  // Compute live physiological outputs from the 4 sandbox parameters
  const tbv = gender === 'female' ? 4500 : 5000;
  const bloodLostMl = Math.round((bloodLossPct / 100) * tbv);
  const vasoconstriction = Math.min(0.95, bloodLossPct / 38);
  const hypothermiaPenalty = tempC < 36.0 ? Math.max(0.15, 1 - (36.0 - tempC) * 0.32) : 1.0;

  let hr = 74;
  let sbp = 122;
  let dbp = 78;
  let rr = 15;
  let spo2 = 99;
  let avpu = 'A';

  if (bloodLossPct < 15) {
    const t = bloodLossPct / 15;
    hr = 74 + t * 24;
    sbp = 122 - t * 3;
    dbp = 78 + t * 3;
    rr = 15 + t * 4;
    spo2 = 99 - t * 1;
  } else if (bloodLossPct < 30) {
    const t = (bloodLossPct - 15) / 15;
    hr = 98 + t * 28;
    sbp = 119 - t * 18;
    dbp = 81 - t * 9;
    rr = 19 + t * 9;
    spo2 = 98 - t * 4;
    avpu = bloodLossPct < 22 ? 'A' : 'V';
  } else {
    const t = Math.min(1, (bloodLossPct - 30) / 18);
    hr = 126 + (t < 0.7 ? t * 28 : 20 - (t - 0.7) * 80);
    sbp = 101 - t * 46;
    dbp = 72 - t * 36;
    rr = 28 + t * 12;
    spo2 = 94 - t * 14;
    avpu = bloodLossPct < 40 ? 'P' : 'U';
  }

  // Apply airway / ventilation compromise
  if (airwayBlockPct > 0) {
    const ab = airwayBlockPct / 100;
    rr += ab * 16;
    hr += ab * 22;
    spo2 = Math.max(66, spo2 - ab * 28);
    if (spo2 < 82 && avpu === 'A') avpu = 'V';
    if (spo2 < 75) avpu = 'P';
    if (spo2 < 70) avpu = 'U';
  }

  hr = Math.round(hr);
  sbp = Math.round(sbp);
  dbp = Math.round(dbp);
  rr = Math.round(rr);
  spo2 = Math.round(spo2);
  const map = Math.round(dbp + (sbp - dbp) / 3);
  const clotEfficiencyPct = Math.round(hypothermiaPenalty * (directPressurePct >= 55 ? 100 : directPressurePct * 1.4));

  useEffect(() => {
    const prevP = simRef.current.prevPressurePct;
    // Detect premature pressure release experiment!
    if (prevP >= 60 && directPressurePct < 25 && simRef.current.clotLevel > 22 && simRef.current.clotLevel < 92) {
      simRef.current.clotLevel = 8;
      setClotBurstNotice(
        '💥 שחרור לחץ מוקדם! זרם הדם קרע מיד את סיבי הפיברין הצעירים במיקרוסקופ — לכן לעולם לא "מציצים" מתחת לגזה!'
      );
      setTimeout(() => setClotBurstNotice(null), 5000);
    }
    simRef.current.prevPressurePct = directPressurePct;
    simRef.current.bloodLossPct = bloodLossPct;
    simRef.current.tempC = tempC;
    simRef.current.airwayBlockPct = airwayBlockPct;
    simRef.current.directPressurePct = directPressurePct;
  }, [bloodLossPct, tempC, airwayBlockPct, directPressurePct]);

  const applyPreset = (preset) => {
    setBloodLossPct(preset.bloodLossPct);
    setTempC(preset.tempC);
    setAirwayBlockPct(preset.airwayBlockPct);
    setDirectPressurePct(preset.directPressurePct);
    setClotBurstNotice(null);
  };

  const syncFromLiveTrauma = () => {
    if (!livePhysiology) return;
    setBloodLossPct(Math.min(48, Math.round(livePhysiology.bloodLossPct)));
    setTempC(Number(livePhysiology.tempC.toFixed(1)));
    setAirwayBlockPct(livePhysiology.spo2 < 94 ? Math.min(70, Math.round((97 - livePhysiology.spo2) * 4)) : 0);
    setDirectPressurePct(livePhysiology.bleedingStopped ? 90 : 0);
  };

  // =========================================================
  // LIVE INTRAVASCULAR MICROSCOPE CANVAS (60FPS)
  // =========================================================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const W = 680;
    const H = 260;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = Math.max(300, Math.floor(rect.width * dpr));
      canvas.height = Math.max(200, Math.floor(rect.height * dpr));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement);

    // Initialize blood cellular components
    const rbcs = Array.from({ length: 44 }, () => ({
      x: Math.random() * W,
      y: 75 + Math.random() * 110,
      rx: 10 + Math.random() * 3.5,
      ry: 5.5 + Math.random() * 2,
      rot: (Math.random() - 0.5) * 0.5,
      speed: 70 + Math.random() * 65,
      escaping: false,
      vy: 0,
    }));

    const platelets = Array.from({ length: 28 }, () => ({
      x: Math.random() * W,
      y: 70 + Math.random() * 120,
      r: 3 + Math.random() * 1.8,
      speed: 85 + Math.random() * 55,
      stuck: false,
      sx: 310 + Math.random() * 62,
      sy: 52 + Math.random() * 18,
    }));

    let rafId = 0;
    let lastTs = 0;
    let clock = 0;

    const render = (ts) => {
      rafId = requestAnimationFrame(render);
      if (!lastTs) lastTs = ts;
      const dt = Math.min(0.05, (ts - lastTs) / 1000);
      lastTs = ts;
      clock += dt;

      const s = simRef.current;
      const vaso = Math.min(0.95, s.bloodLossPct / 38);
      const hypoFactor = s.tempC < 36.0 ? Math.max(0.12, 1 - (36.0 - s.tempC) * 0.34) : 1.0;
      const oxyRatio = Math.max(0, Math.min(1, (100 - s.airwayBlockPct * 0.7 - s.bloodLossPct * 0.25) / 100));

      // Clot buildup dynamics inside microscope
      if (s.directPressurePct >= 50) {
        s.clotLevel = Math.min(100, s.clotLevel + dt * 20 * hypoFactor * (s.directPressurePct / 80));
      } else {
        s.clotLevel = Math.max(0, s.clotLevel - dt * (26 - s.directPressurePct * 0.35));
      }

      // Vessel lumen geometry narrows visibly with vasoconstriction!
      const constrictPx = vaso * 28;
      const topWallY = 56 + constrictPx;
      const botWallY = 204 - constrictPx;
      const tearX1 = 304;
      const tearX2 = 376;

      // Velocity pulses with heart rate and slows under direct pressure
      const beatHz = Math.max(0.9, (74 + s.bloodLossPct * 1.6) / 60);
      const pulseBoost = 0.72 + Math.pow(Math.max(0, Math.sin(clock * Math.PI * 2 * beatHz)), 2) * 0.65;
      const pressureSlow = 1 - (s.directPressurePct / 100) * 0.65;
      const flowSpeedMult = pulseBoost * pressureSlow * (1 + vaso * 0.45);

      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const scaleX = canvas.width / W;
      const scaleY = canvas.height / H;
      ctx.scale(scaleX, scaleY);

      // Tissue backdrop outside vessel
      ctx.fillStyle = s.tempC < 35.5 ? '#141e33' : '#1b1018';
      ctx.fillRect(0, 0, W, H);

      // Plasma lumen interior
      const lumenGrad = ctx.createLinearGradient(0, topWallY, 0, botWallY);
      lumenGrad.addColorStop(0, '#3a0812');
      lumenGrad.addColorStop(0.5, '#590d1c');
      lumenGrad.addColorStop(1, '#360710');
      ctx.fillStyle = lumenGrad;
      ctx.fillRect(0, topWallY, W, botWallY - topWallY);

      // Smooth muscle & Endothelial Wall (Upper with Tear Gap + Lower intact)
      const drawWallSegment = (x1, x2, y, isTop) => {
        ctx.fillStyle = '#a83644';
        ctx.fillRect(x1, isTop ? y - 22 : y, x2 - x1, 22);
        // Endothelial cells row
        for (let ex = x1; ex < x2 - 8; ex += 24) {
          ctx.fillStyle = '#e88b92';
          ctx.strokeStyle = '#751c27';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(ex + 1, isTop ? y - 8 : y, 22, 8, 3);
          ctx.fill();
          ctx.stroke();
        }
      };

      drawWallSegment(0, tearX1, topWallY, true);
      drawWallSegment(tearX2, W, topWallY, true);
      drawWallSegment(0, W, botWallY, false);

      // Direct Pressure Compression Cushion pressing down onto tear from outside!
      if (s.directPressurePct > 15) {
        const alpha = Math.min(0.95, s.directPressurePct / 100);
        ctx.fillStyle = `rgba(56, 189, 248, ${alpha * 0.35})`;
        ctx.strokeStyle = `rgba(125, 211, 252, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(tearX1 - 18, Math.max(4, topWallY - 38), tearX2 - tearX1 + 36, 26, 8);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#e0f2fe';
        ctx.font = 'bold 11px "Segoe UI", Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`לחץ ישיר (${s.directPressurePct}%)`, (tearX1 + tearX2) * 0.5, Math.max(20, topWallY - 21));
      }

      // Exposed Collagen Fibers at tear edges (attracting platelets!)
      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(tearX1, topWallY - 12);
      ctx.lineTo(tearX1 + 8, topWallY + 2);
      ctx.moveTo(tearX2, topWallY - 12);
      ctx.lineTo(tearX2 - 8, topWallY + 2);
      ctx.stroke();

      // Update & Draw Red Blood Cells (Erythrocytes — color shifts with Oxygenation!)
      const activeRbcCount = Math.max(14, Math.round(rbcs.length * (1 - s.bloodLossPct / 65)));
      const rCol = Math.round(110 + oxyRatio * 140);
      const gCol = Math.round(18 + oxyRatio * 20);
      const bCol = Math.round(92 - oxyRatio * 62);

      for (let i = 0; i < activeRbcCount; i++) {
        const c = rbcs[i];
        c.x += c.speed * flowSpeedMult * dt;

        // If passing near unsealed tear with low pressure -> escape upward (hemorrhage!)
        const nearTear = c.x > tearX1 + 6 && c.x < tearX2 - 6 && c.y < topWallY + 28;
        if (nearTear && s.clotLevel < 72 && s.directPressurePct < 70 && Math.random() < 0.08) {
          c.escaping = true;
          c.vy = -(75 + Math.random() * 90);
        }

        if (c.escaping) {
          c.y += c.vy * dt;
          if (c.y < -15) {
            c.escaping = false;
            c.x = -12;
            c.y = topWallY + 14 + Math.random() * Math.max(20, botWallY - topWallY - 28);
          }
        } else {
          // Keep inside constricting lumen
          const minY = topWallY + 11;
          const maxY = botWallY - 11;
          if (c.y < minY) c.y = minY + 2;
          if (c.y > maxY) c.y = maxY - 2;
          if (c.x > W + 16) {
            c.x = -16;
            c.y = minY + Math.random() * Math.max(12, maxY - minY);
          }
        }

        // Draw realistic biconcave erythrocyte + glowing O2 dots
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rot);
        ctx.fillStyle = `rgb(${rCol}, ${gCol}, ${bCol})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, c.rx, c.ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(60, 4, 14, 0.45)`;
        ctx.beginPath();
        ctx.ellipse(0, 0, c.rx * 0.46, c.ry * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
        // Tiny bright cyan O2 molecules riding hemoglobin when well-oxygenated!
        if (oxyRatio > 0.45) {
          ctx.fillStyle = `rgba(125, 211, 252, ${oxyRatio * 0.9})`;
          ctx.beginPath();
          ctx.arc(-c.rx * 0.4, -1, 1.7, 0, Math.PI * 2);
          ctx.arc(c.rx * 0.4, 1, 1.7, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Draw Activated Platelets & Secondary Fibrin Mesh bridging the tear!
      const stuckQuota = Math.round((s.clotLevel / 100) * 16);
      platelets.forEach((p, idx) => {
        if (idx < stuckQuota) {
          // Clumped platelets sealing the tear!
          const px = tearX1 + 6 + ((idx * 17) % (tearX2 - tearX1 - 12));
          const py = topWallY - 4 + ((idx * 7) % 14);
          ctx.fillStyle = '#fde047';
          ctx.beginPath();
          ctx.arc(px, py, p.r + 1.1, 0, Math.PI * 2);
          ctx.fill();
        } else {
          p.x += p.speed * flowSpeedMult * dt;
          if (p.x > W + 10) {
            p.x = -10;
            p.y = topWallY + 10 + Math.random() * Math.max(16, botWallY - topWallY - 20);
          }
          p.y = Math.max(topWallY + 7, Math.min(botWallY - 7, p.y));
          ctx.fillStyle = 'rgba(254, 240, 138, 0.78)';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Cross-linked Golden-White Fibrin Strands when clotLevel > 22
      if (s.clotLevel > 22) {
        const cf = (s.clotLevel - 22) / 78;
        ctx.save();
        ctx.strokeStyle = `rgba(254, 249, 195, ${0.35 + cf * 0.65})`;
        ctx.lineWidth = 1.4 + cf * 1.2;
        const strands = Math.max(2, Math.round(cf * 12));
        for (let k = 0; k < strands; k++) {
          const sx = tearX1 + (k / strands) * (tearX2 - tearX1);
          ctx.beginPath();
          ctx.moveTo(sx, topWallY - 10);
          ctx.lineTo(tearX2 - (k / strands) * (tearX2 - tearX1), topWallY + 9);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Hypothermia Frost Visual Indicator if Temp < 35.5°C
      if (s.tempC < 35.5) {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.14)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#7dd3fc';
        ctx.font = 'bold 12px "Segoe UI", Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`❄️ היפותרמיה (${s.tempC.toFixed(1)}°C) — אנזימי הקרישה איטיים ב-${Math.round((1 - hypoFactor) * 100)}%!`, 14, 22);
      }

      // Live Scope Legend
      ctx.fillStyle = 'rgba(241, 245, 249, 0.88)';
      ctx.font = 'bold 11.5px "Segoe UI", Arial';
      ctx.textAlign = 'right';
      ctx.fillText(
        `קוטר כלי דם: ${Math.round((1 - vaso * 0.42) * 100)}% (כיווץ ${Math.round(vaso * 100)}%)  •  קריש פיברין: ${Math.round(s.clotLevel)}%`,
        W - 14,
        H - 12
      );

      ctx.restore();
    };

    rafId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, []);

  // Determine live activation status of each node in Causal Graph
  const getNodeStatus = (id) => {
    if (id === 'trigger_loss') return bloodLossPct >= 30 ? 'crit' : bloodLossPct >= 10 ? 'warn' : 'ok';
    if (id === 'preload_drop') return bloodLossPct >= 28 ? 'crit' : bloodLossPct >= 12 ? 'warn' : 'ok';
    if (id === 'baroreceptors') return bloodLossPct >= 12 || airwayBlockPct >= 30 ? 'warn' : 'ok';
    if (id === 'tachycardia') return hr >= 125 ? 'crit' : hr >= 98 ? 'warn' : 'ok';
    if (id === 'vasoconstriction') return vasoconstriction >= 0.7 ? 'crit' : vasoconstriction >= 0.3 ? 'warn' : 'ok';
    if (id === 'respiratory_comp') return spo2 < 90 || rr >= 28 ? 'crit' : rr >= 20 || airwayBlockPct > 15 ? 'warn' : 'ok';
    if (id === 'decompensation') return sbp < 95 ? 'crit' : sbp < 110 ? 'warn' : 'ok';
    if (id === 'cerebral_hypoxia') return avpu === 'P' || avpu === 'U' ? 'crit' : avpu === 'V' ? 'warn' : 'ok';
    if (id === 'lethal_triad') return tempC <= 35.0 || (bloodLossPct >= 30 && tempC <= 35.8) ? 'crit' : tempC < 36.0 ? 'warn' : 'ok';
    return 'ok';
  };

  const selectedNode = CAUSAL_NODES.find((n) => n.id === selectedNodeId) || CAUSAL_NODES[4];
  const nodeMap = Object.fromEntries(CAUSAL_NODES.map((n) => [n.id, n]));

  return (
    <div className="phys-lab-layout">
      {/* RIGHT COLUMN: WHAT-IF SANDBOX CONTROLS + EXPERIMENT PRESETS */}
      <aside className="panel phys-controls-col">
        <div className="panel-header">
          <div className="panel-title">
            <Sliders size={16} className="text-sky" />
            <span>מעבדת ניסויים — "מה קורה אם...?"</span>
          </div>
          <button type="button" className="mini-chip" onClick={syncFromLiveTrauma} title="טען נתונים מהפצוע החי בטאב 1">
            <RefreshCw size={12} /> סנכרן פצוע
          </button>
        </div>

        <div className="phys-controls-body">
          {/* 4 Interactive Sliders */}
          <div className="sandbox-slider-card">
            <div className="slider-head">
              <span>🩸 איבוד דם מהגוף</span>
              <strong style={{ color: bloodLossPct >= 30 ? '#fca5a5' : '#fcd34d' }}>
                {bloodLossPct}% ({bloodLostMl} מ"ל)
              </strong>
            </div>
            <input
              type="range"
              min={0}
              max={48}
              value={bloodLossPct}
              onChange={(e) => setBloodLossPct(Number(e.target.value))}
              className="peel-slider"
            />
            <div className="slider-sub">0% תקין • 15–29% הלם מפוצה • 30%+ צניחת לחץ דם</div>
          </div>

          <div className="sandbox-slider-card">
            <div className="slider-head">
              <span><Snowflake size={13} style={{ verticalAlign: 'middle' }} /> חום גוף (המשולש הקטלני)</span>
              <strong style={{ color: tempC < 35.5 ? '#7dd3fc' : '#6ee7b7' }}>{tempC.toFixed(1)}°C</strong>
            </div>
            <input
              type="range"
              min={33.5}
              max={37.2}
              step={0.1}
              value={tempC}
              onChange={(e) => setTempC(Number(e.target.value))}
              className="peel-slider"
            />
            <div className="slider-sub">מתחת ל-35.5°C: אנזימי קרישת הדם מאטים דרמטית!</div>
          </div>

          <div className="sandbox-slider-card">
            <div className="slider-head">
              <span>🫁 חסימת אוורור / נתיב אוויר</span>
              <strong style={{ color: airwayBlockPct > 40 ? '#fca5a5' : '#38bdf8' }}>{airwayBlockPct}%</strong>
            </div>
            <input
              type="range"
              min={0}
              max={85}
              value={airwayBlockPct}
              onChange={(e) => setAirwayBlockPct(Number(e.target.value))}
              className="peel-slider"
            />
            <div className="slider-sub">ראה במיקרוסקופ כיצד כדוריות הדם מאבדות מולקולות O₂!</div>
          </div>

          <div className="sandbox-slider-card">
            <div className="slider-head">
              <span>✋ עוצמת לחץ ישיר על הקרע</span>
              <strong style={{ color: directPressurePct >= 60 ? '#6ee7b7' : '#fcd34d' }}>{directPressurePct}%</strong>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={directPressurePct}
              onChange={(e) => setDirectPressurePct(Number(e.target.value))}
              className="peel-slider"
            />
            <div className="slider-sub">העלה ל-90% לבניית קריש פיברין — ואז הורד ל-0% וצפה בהרס הקריש!</div>
          </div>

          {/* Preset Experiments */}
          <div>
            <div className="tool-section-label"><span>🧪 ניסויים מודרכים בלחיצה אחת</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {LAB_PRESETS.map((pr) => (
                <button
                  key={pr.id}
                  type="button"
                  className="preset-exp-btn"
                  onClick={() => applyPreset(pr)}
                >
                  <strong>{pr.name}</strong>
                  <span>{pr.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* CENTER & LEFT MAIN LAB AREA */}
      <section className="phys-main-col">
        {/* Live Calculated Vitals Strip */}
        <div className="phys-vitals-ribbon">
          <div className="pv-chip"><span>❤️ דופק</span><strong style={{ color: '#34d399' }}>{hr} BPM</strong></div>
          <div className="pv-chip"><span>🩺 לחץ דם</span><strong style={{ color: '#f472b6' }}>{sbp}/{dbp} (MAP {map})</strong></div>
          <div className="pv-chip"><span>🫁 נשימה</span><strong style={{ color: '#38bdf8' }}>{rr} /דקה</strong></div>
          <div className="pv-chip"><span>🫧 SpO₂</span><strong style={{ color: spo2 < 90 ? '#fca5a5' : '#60a5fa' }}>{spo2}%</strong></div>
          <div className="pv-chip"><span>🧠 AVPU</span><strong style={{ color: avpu === 'A' ? '#6ee7b7' : '#fca5a5' }}>{avpu}</strong></div>
          <div className="pv-chip"><span>🧬 יעילות קרישה</span><strong style={{ color: '#fcd34d' }}>{clotEfficiencyPct}%</strong></div>
        </div>

        {/* 1. LIVE INTRAVASCULAR MICROSCOPE */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <Microscope size={16} className="text-sky" />
              <span>מיקרוסקופ תוך-וסקולרי חי — תאים, חמצן, טסיות, פיברין וכיווץ כלי דם</span>
            </div>
            <span className="panel-badge">הגדלה ×400 (חי)</span>
          </div>

          <div className="microscope-host">
            <canvas ref={canvasRef} className="microscope-canvas" />
            {clotBurstNotice && <div className="microscope-alert">{clotBurstNotice}</div>}
          </div>

          <div style={{ padding: '10px 13px', borderTop: '1px solid var(--border)' }}>
            <DeepDiveBox
              title="מה רואים עכשיו במיקרוסקופ"
              simpleText="הדיסקיות האדומות הן כדוריות דם אדומות הנושאות מולקולות חמצן כחולות (O₂), הנקודות הצהובות הן טסיות דם, ודפנות כלי הדם מתכווצות בזמן הלם (Vasoconstriction)."
              deepText="בשנייה שנפער קרע בדופן האנדותל, נחשף קולגן תת-אנדותליאלי שגורם לטסיות להידבק וליצור פקק ראשוני (Primary Hemostasis). רק כאשר הלחץ הישיר מאט את מהירות הזרימה (Shear Stress) והגוף חם (>35.5°C), אנזימי הקרישה הופכים פיברינוגן לרשת פיברין יציבה (Secondary Hemostasis) הלוכדת את כדוריות הדם ואוטמת את הקרע."
              formula="חמצון תקין: HbO₂ (אדום בהיר) • היפוקסיה: Deoxy-Hb (כחול-כהה) • היפותרמיה ➔ ↓ פעילות תרומבין וטסיות"
              clinicalPearl="נסה להעלות את הלחץ הישיר ל-95% למשך 4 שניות, צפה בטסיות ובפיברין סוגרים את הפתח, ואז הורד פתאום ל-0% כדי לראות מדוע שחרור מוקדם הורס את הקריש!"
            />
          </div>
        </div>

        {/* 2. INTERACTIVE LIVE CAUSAL GRAPH + DEEP DIVE INSPECTOR */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <GitBranch size={16} className="text-emerald" />
              <span>מפת סיבה ותוצאה פיזיולוגית חיה (לחץ על כל צומת להסבר + העמקה מדעית!)</span>
            </div>
            <div style={{ display: 'flex', gap: 8, fontSize: '0.7rem' }}>
              <span style={{ color: '#6ee7b7' }}>● תקין</span>
              <span style={{ color: '#fcd34d' }}>● פיצוי פעיל</span>
              <span style={{ color: '#fca5a5' }}>● כשל קריטי</span>
            </div>
          </div>

          <div className="causal-grid">
            <div className="causal-svg-wrap">
              <svg viewBox="0 0 680 415" width="100%" style={{ display: 'block', background: '#070d1b', borderRadius: 10 }}>
                <defs>
                  <marker id="arrNorm" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                    <polygon points="0 0, 7 3.5, 0 7" fill="#64748b" />
                  </marker>
                  <marker id="arrHot" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                    <polygon points="0 0, 7 3.5, 0 7" fill="#f59e0b" />
                  </marker>
                </defs>

                {/* Connecting Causal Arrows */}
                {CAUSAL_EDGES.map(([fromId, toId], idx) => {
                  const a = nodeMap[fromId];
                  const b = nodeMap[toId];
                  if (!a || !b) return null;
                  const hot = getNodeStatus(fromId) !== 'ok' && getNodeStatus(toId) !== 'ok';
                  return (
                    <line
                      key={idx}
                      x1={a.x}
                      y1={a.y + 18}
                      x2={b.x}
                      y2={b.y - 24}
                      stroke={hot ? '#f59e0b' : 'rgba(148,163,184,0.3)'}
                      strokeWidth={hot ? 2.4 : 1.4}
                      strokeDasharray={hot ? '6 4' : undefined}
                      markerEnd={hot ? 'url(#arrHot)' : 'url(#arrNorm)'}
                    />
                  );
                })}

                {/* Interactive Physiological Nodes */}
                {CAUSAL_NODES.map((node) => {
                  const st = getNodeStatus(node.id);
                  const isSel = selectedNodeId === node.id;
                  const fill =
                    st === 'crit' ? '#450a14' : st === 'warn' ? '#3b2508' : '#0b2920';
                  const stroke =
                    isSel ? '#38bdf8' : st === 'crit' ? '#ef4444' : st === 'warn' ? '#f59e0b' : '#10b981';
                  return (
                    <g
                      key={node.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedNodeId(node.id)}
                    >
                      <rect
                        x={node.x - 98}
                        y={node.y - 24}
                        width={196}
                        height={48}
                        rx={10}
                        fill={fill}
                        stroke={stroke}
                        strokeWidth={isSel ? 2.8 : 1.5}
                      />
                      <text x={node.x} y={node.y - 4} textAnchor="middle" fill="#f8fafc" fontSize="11.5" fontWeight="800">
                        {node.label}
                      </text>
                      <text x={node.x} y={node.y + 13} textAnchor="middle" fill="#94a3b8" fontSize="9.8">
                        {node.sub}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Selected Node Deep Dive Card */}
            <div className="causal-inspector">
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                <Activity size={17} className="text-sky" />
                <strong style={{ fontSize: '0.95rem', color: '#7dd3fc' }}>{selectedNode.label}</strong>
              </div>
              <DeepDiveBox
                title="הסבר בהיר למתחיל"
                simpleText={selectedNode.simple}
                deepText={selectedNode.deep}
                formula={selectedNode.formula}
                clinicalPearl={selectedNode.pearl}
                defaultOpen={true}
              />
              <div className="causal-status-pill">
                <Zap size={13} />
                <span>
                  סטטוס צומת בניסוי הנוכחי:{' '}
                  <strong>
                    {getNodeStatus(selectedNode.id) === 'crit'
                      ? '🔴 כשל קריטי / פעילות קיצונית'
                      : getNodeStatus(selectedNode.id) === 'warn'
                      ? '🟠 מנגנון פיצוי מופעל'
                      : '🟢 מאוזן ותקין'}
                  </strong>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
