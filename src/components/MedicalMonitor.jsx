import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Heart, Wind, Activity, Brain, Droplets, ShieldAlert, Clock } from 'lucide-react';
import {
  computeEcgSample,
  computePlethSample,
  generateVitalExplanations,
  getAvpuDisplay,
} from '../engines/PhysiologyEngine';
import DeepDiveBox from './DeepDiveBox';

function formatClock(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * src/components/MedicalMonitor.jsx
 * מוניטור רפואי חי:
 * - גרף אק"ג (ECG Lead II) + גל דופק פלת' (SpO2 Pleth) בזמן אמת
 * - צלילי ביפ (Web Audio API) המתוזמנים לדופק ומושפעים מ-SpO2
 * - תצוגת דופק, נשימה, לחץ דם (MAP + Shock Index), סטורציה, AVPU, מד קרישת דם
 * - הסברי "למה זה קורה?" דינמיים ליד כל מדד + יומן אירועים קליני
 */
export default function MedicalMonitor({ physiologyRef, physiology, eventLog }) {
  const ecgCanvasRef = useRef(null);
  const plethCanvasRef = useRef(null);
  const audioCtxRef = useRef(null);
  const soundEnabledRef = useRef(false);
  const lastBeatRef = useRef(-1);

  const [soundEnabled, setSoundEnabled] = useState(false);

  const toggleSound = () => {
    const next = !soundEnabled;
    soundEnabledRef.current = next;
    setSoundEnabled(next);
    if (next) {
      playMonitorBeep(physiologyRef.current?.spo2 || 99);
    }
  };

  function playMonitorBeep(spo2) {
    if (!soundEnabledRef.current) return;
    try {
      if (!audioCtxRef.current) {
        const AC = window.AudioContext || window.webkitAudioContext;
        audioCtxRef.current = new AC();
      }
      const ac = audioCtxRef.current;
      if (ac.state === 'suspended') ac.resume();

      // Authentic pulse-oximeter pitch modulation: lower pitch as SpO2 drops!
      const clampedSpo2 = Math.max(75, Math.min(100, spo2));
      const freq = 420 + (clampedSpo2 - 75) * 18.5;

      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ac.currentTime);
      gain.gain.setValueAtTime(0.0001, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.055, ac.currentTime + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.095);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + 0.11);
    } catch {
      // Ignore autoplay errors gracefully
    }
  }

  // Live 60FPS ECG + Pleth oscilloscope rendering & Web Audio beat sync
  useEffect(() => {
    const ecgC = ecgCanvasRef.current;
    const plethC = plethCanvasRef.current;
    if (!ecgC || !plethC) return;

    const ecgCtx = ecgC.getContext('2d');
    const plethCtx = plethC.getContext('2d');

    const ecgBuf = new Array(210).fill(0);
    const plethBuf = new Array(210).fill(0);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r1 = ecgC.getBoundingClientRect();
      ecgC.width = Math.max(180, Math.floor(r1.width * dpr));
      ecgC.height = Math.max(40, Math.floor(r1.height * dpr));
      const r2 = plethC.getBoundingClientRect();
      plethC.width = Math.max(180, Math.floor(r2.width * dpr));
      plethC.height = Math.max(36, Math.floor(r2.height * dpr));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(ecgC);

    let rafId = 0;

    const drawScope = (ctx, canvas, buf, color, baselineRatio, ampRatio) => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.09)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 24) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(0, h * baselineRatio);
      ctx.lineTo(w, h * baselineRatio);
      ctx.stroke();

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.shadowColor = color;
      ctx.shadowBlur = 5;
      ctx.beginPath();
      for (let i = 0; i < buf.length; i++) {
        const x = (i / (buf.length - 1)) * w;
        const y = h * baselineRatio - buf[i] * (h * ampRatio);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    };

    const tick = () => {
      rafId = requestAnimationFrame(tick);
      const phys = physiologyRef.current;
      if (!phys) return;

      const beatIdx = Math.floor(phys.pulsePhase);
      if (beatIdx !== lastBeatRef.current) {
        lastBeatRef.current = beatIdx;
        playMonitorBeep(phys.spo2);
      }

      ecgBuf.push(computeEcgSample(phys.pulsePhase, phys.shockClass));
      if (ecgBuf.length > 210) ecgBuf.shift();

      plethBuf.push(computePlethSample(phys.pulsePhase, phys.vasoconstriction, phys.spo2));
      if (plethBuf.length > 210) plethBuf.shift();

      const ecgColor = phys.shockClass >= 3 ? '#ef4444' : phys.shockClass === 2 ? '#f59e0b' : '#10b981';
      const plethColor = phys.spo2 < 91 ? '#f59e0b' : '#38bdf8';

      drawScope(ecgCtx, ecgC, ecgBuf, ecgColor, 0.68, 0.54);
      drawScope(plethCtx, plethC, plethBuf, plethColor, 0.84, 0.66);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [physiologyRef]);

  const explanations = generateVitalExplanations(physiology);
  const hr = Math.round(physiology.hr);
  const rr = Math.round(physiology.rr);
  const sbp = Math.round(physiology.sbp);
  const dbp = Math.round(physiology.dbp);
  const spo2 = Math.round(physiology.spo2);
  const lossMl = Math.round(physiology.bloodLostMl);
  const lossPct = physiology.bloodLossPct;

  const hrSeverity = hr >= 124 ? 'crit' : hr >= 96 ? 'warn' : 'ok';
  const rrSeverity = rr > 28 ? 'crit' : rr > 20 ? 'warn' : 'ok';
  const bpSeverity = sbp < 95 ? 'crit' : sbp < 112 ? 'warn' : 'ok';
  const spo2Severity = spo2 < 90 ? 'crit' : spo2 < 95 ? 'warn' : 'ok';
  const avpuSeverity = physiology.avpu === 'U' || physiology.avpu === 'P' ? 'crit' : physiology.avpu === 'V' ? 'warn' : 'ok';

  return (
    <aside className="panel monitor-panel">
      <div className="panel-header">
        <div className="panel-title">
          <Activity size={16} className="text-emerald" />
          <span>מוניטור מדדים חיים</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            className={`mini-chip ${soundEnabled ? 'on' : ''}`}
            onClick={toggleSound}
            title="הפעל/השתק צליל ביפ מוניטור (Web Audio API)"
          >
            {soundEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
            <span>{soundEnabled ? 'ביפ פעיל' : 'מושתק'}</span>
          </button>
          <span className="panel-badge">
            <Clock size={11} style={{ verticalAlign: 'middle', marginLeft: 3 }} />
            {formatClock(physiology.elapsedSec)}
          </span>
        </div>
      </div>

      <div className="monitor-body">
        {/* Dual Live Oscilloscopes: ECG + Pleth */}
        <div className="scope-box">
          <div className="scope-header">
            <span style={{ color: '#34d399' }}>ECG II • {hr} BPM</span>
            <span style={{ color: '#94a3b8' }}>
              {physiology.shockClass >= 3 ? 'טכיקרדיה חמורה / היפוקסיה' : physiology.shockClass >= 1 ? 'טכיקרדיה מפצה' : 'קצב סינוס תקין'}
            </span>
          </div>
          <canvas ref={ecgCanvasRef} className="scope-canvas" />
          <div className="scope-header" style={{ marginTop: 4 }}>
            <span style={{ color: '#38bdf8' }}>PLETH SpO₂ • {spo2}%</span>
            <span style={{ color: '#94a3b8' }}>
              זילוח היקפי: {physiology.vasoconstriction > 0.65 ? 'חלש (כיווץ כלי דם)' : physiology.vasoconstriction > 0.35 ? 'בינוני' : 'תקין'}
            </span>
          </div>
          <canvas ref={plethCanvasRef} className="scope-canvas pleth" />
        </div>

        {/* Blood Volume + Compensated vs Decompensated Shock */}
        <div className={`shock-summary-card shock-lvl-${physiology.shockClass}`}>
          <div className="shock-top-row">
            <span>
              איבוד דם: <strong style={{ color: '#fca5a5' }}>{lossMl} מ"ל ({lossPct.toFixed(1)}%)</strong>
            </span>
            <span className="shock-state-tag">{physiology.compensationState}</span>
          </div>
          <div className="loss-bar-bg">
            <div className="loss-bar-fill" style={{ width: `${Math.min(100, lossPct * 2)}%` }} />
          </div>
          <div className="loss-scale-labels">
            <span>נפח נותר: {Math.round(physiology.bloodVolumeMl)} מ"ל</span>
            <span>SI: {physiology.shockIndex}</span>
            <span>MAP: {physiology.map}</span>
          </div>
        </div>

        {/* Coagulation Engine Progress Bar */}
        <div className={`clot-card ${physiology.clotStable ? 'stable' : physiology.clotDisruptions > 0 && physiology.clotProgress < 20 ? 'disrupted' : ''}`}>
          <div className="clot-head">
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700, fontSize: '0.76rem' }}>
              <Droplets size={13} style={{ color: '#fbbf24' }} />
              מנגנון קרישת דם (Coagulation)
            </span>
            <span className="clot-pct">{Math.round(physiology.clotProgress)}%</span>
          </div>
          <div className="clot-bar-bg">
            <div className="clot-bar-fill" style={{ width: `${Math.round(physiology.clotProgress)}%` }} />
          </div>
          <div className="clot-stage-label">{physiology.clotStage}</div>
          <div className="vital-why">
            <span className="why-tag">פיזיולוגיה:</span> {explanations.clotWhy}
          </div>
        </div>

        {/* Core Vital Cards with Live "למה זה קורה?" + Expandable Scientific Deep Dive */}
        <div className={`vital-card sev-${hrSeverity}`}>
          <div className="vital-top">
            <span className="vital-label"><Heart size={13} color="#ef4444" /> דופק (HR)</span>
            <div className="vital-val-group">
              <span className="vital-val" style={{ color: '#34d399' }}>{hr}</span>
              <span className="vital-unit">פעימות/דקה</span>
            </div>
          </div>
          <DeepDiveBox
            title="למה זה קורה"
            simpleText={explanations.hrWhy}
            deepText="קולטני לחץ בצוואר (Baroreceptors) מזהים ירידת מתיחת דופן ומפעילים מיד הפרשת אדרנלין המאיצה את קשר ה-SA בלב — כך הגוף שומר על תפוקת לב למרות ירידת נפח הפעימה."
            formula="CO (תפוקת לב) = HR × SV"
            compact
          />
        </div>

        <div className={`vital-card sev-${bpSeverity}`}>
          <div className="vital-top">
            <span className="vital-label">🩺 לחץ דם (BP)</span>
            <div className="vital-val-group">
              <span className="vital-val" style={{ color: '#f472b6' }}>{sbp}/{dbp}</span>
              <span className="vital-unit">ממ"כ</span>
            </div>
          </div>
          <DeepDiveBox
            title="למה זה קורה"
            simpleText={explanations.bpWhy}
            deepText="בשלבים הראשונים של הלם (עד ~30% איבוד דם) כיווץ העורקיקים ההיקפיים (↑SVR) שומר על לחץ הדם הסיסטולי ומצמצם את הפרש הדופק (Pulse Pressure). רק כשהפיצוי קורס לחץ הדם צונח (Decompensated Shock)."
            formula="BP = CO × SVR | MAP = DBP + ⅓(SBP − DBP)"
            compact
          />
        </div>

        <div className="vitals-compact-pair">
          <div className={`vital-card sev-${rrSeverity}`}>
            <div className="vital-top">
              <span className="vital-label"><Wind size={13} color="#38bdf8" /> נשימה (RR)</span>
              <div className="vital-val-group">
                <span className="vital-val" style={{ color: '#38bdf8', fontSize: '1.22rem' }}>{rr}</span>
                <span className="vital-unit">/דקה</span>
              </div>
            </div>
            <DeepDiveBox
              title="למה"
              simpleText={explanations.rrWhy}
              deepText="כשהתאים עוברים לנשימה אנאירובית מחוסר חמצן נוצרת חומצת חלב; מרכז הנשימה בגזע המוח מאיץ את הנשימה כדי לפנות CO₂ ולהגביר קליטת O₂."
              compact
            />
          </div>

          <div className={`vital-card sev-${spo2Severity}`}>
            <div className="vital-top">
              <span className="vital-label">🫧 סטורציה</span>
              <div className="vital-val-group">
                <span className="vital-val" style={{ color: '#60a5fa', fontSize: '1.22rem' }}>{spo2}%</span>
              </div>
            </div>
            <DeepDiveBox
              title="למה"
              simpleText={explanations.spo2Why}
              deepText="מד הסטורציה מודד את אחוז ההמוגלובין הרווי בחמצן ואת גל הזילוח באצבע. בהלם חמור כיווץ כלי דם היקפיים מחליש את גל הפלת' ופגיעת חזה מורידה ישירות את חמצון הדם."
              compact
            />
          </div>
        </div>

        <div className={`vital-card sev-${avpuSeverity}`}>
          <div className="vital-top">
            <span className="vital-label"><Brain size={13} color="#a78bfa" /> הכרה (AVPU)</span>
            <span className="avpu-summary-text">{getAvpuDisplay(physiology.avpu)}</span>
          </div>
          <div className="avpu-row">
            {['A', 'V', 'P', 'U'].map((l) => (
              <div key={l} className={`avpu-pill ${physiology.avpu === l ? `active-${l}` : ''}`}>
                {l === 'A' ? 'A ערני' : l === 'V' ? 'V קול' : l === 'P' ? 'P כאב' : 'U חוסר הכרה'}
              </div>
            ))}
          </div>
          <DeepDiveBox
            title="למה זה קורה"
            simpleText={explanations.avpuWhy}
            deepText="המוח צורך ~20% מחמצן הגוף ואינו אוגר עתודות. צניחה בלחץ הזילוח המוחי פוגעת תחילה בקליפת המוח (בלבול וישנוניות — V) ובהמשך בגזע המוח (תגובה לכאב P ואובדן הכרה מלא U)."
            compact
          />
        </div>

        {/* Physical Perfusion Signs (Real-world Me'ar signs without monitor) */}
        <div className="skin-signs-box">
          <div><strong>🖐️ עור:</strong> {physiology.skinSigns}</div>
          <div>
            <strong>⏱️ מילוי קפילרי:</strong> {physiology.capillaryRefillSec.toFixed(1)} שנ' •{' '}
            <strong>🌡️ חום:</strong> {physiology.tempC.toFixed(1)}°C
          </div>
        </div>

        {/* Clinical Event Feed */}
        <div>
          <div className="log-title">
            <ShieldAlert size={12} /> יומן אירועים ופעולות קליניות
          </div>
          <div className="event-log">
            {eventLog.slice(0, 18).map((item, idx) => (
              <div key={idx} className={`log-item ${item.severity}`}>
                <span className="log-time">[{item.time}]</span>
                <span>{item.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
