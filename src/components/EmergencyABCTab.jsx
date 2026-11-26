import React, { useEffect, useRef, useState } from 'react';
import {
  HeartPulse,
  Zap,
  Wind,
  Syringe,
  MessageSquare,
  PhoneCall,
  Volume2,
  VolumeX,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { EMERGENCY_ABC_SCENARIOS, SAMPLE_QUESTIONS } from '../data/emergencyMedicalDatabase';
import DeepDiveBox from './DeepDiveBox';

/**
 * src/components/EmergencyABCTab.jsx
 * טאב מצבי חירום רפואיים מקיף (אופציה 2):
 * 1. דום לב VF (בר-שוק): עיסויי חזה חיים (קצב 100-120/דקה, עומק, מטרונום Web Audio) + דפיברילטור AED מלא!
 * 2. דום לב אסיסטולה (אסור שוק!): מלכודת קלינית + הסבר עומק מדוע לא נותנים שוק בקו שטוח!
 * 3. חנק מלא: חתך קנה נשימה וריאות חי + 5 טפיחות גב ו-5 לחיצות היימליך!
 * 4. חזה אוויר בלחץ (Tension Pneumothorax): ריאה קורסת ודחיקת לב חיה + חבישה אוטמת + נט"ן 101!
 * 5. הלם אנפילקטי (Anaphylaxis): בצקת וכיווץ סימפונות + הזרקת אפיפן לשריר הירך הצידי!
 * + תשאול מטופל אינטראקטיבי SAMPLE + הסברי העמקה מדעית (<DeepDiveBox>) לכל שלב!
 */
export default function EmergencyABCTab({ gender, onChangeGender }) {
  const [caseId, setCaseId] = useState('cpr_vf');
  const sc = EMERGENCY_ABC_SCENARIOS[caseId];

  // Live Case Clinical State
  const [mdaCalled, setMdaCalled] = useState(false);
  const [askedSample, setAskedSample] = useState({});
  const [feedback, setFeedback] = useState(null);
  const [resolved, setResolved] = useState(false);

  // CPR & AED State
  const [compressionCount, setCompressionCount] = useState(0);
  const [compressionBpm, setCompressionBpm] = useState(0);
  const [perfusionPct, setPerfusionPct] = useState(0);
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [aedOn, setAedOn] = useState(false);
  const [padsPlaced, setPadsPlaced] = useState({ rightUpper: false, leftLower: false });
  const [aedAnalyzed, setAedAnalyzed] = useState(false);
  const [shockDelivered, setShockDelivered] = useState(false);
  const [roscAchieved, setRoscAchieved] = useState(false);

  // Choking State
  const [backBlows, setBackBlows] = useState(0);
  const [heimlichThrusts, setHeimlichThrusts] = useState(0);
  const [bolusProgress, setBolusProgress] = useState(0); // 0=lodged, 100=expelled!

  // Tension Pneumothorax State
  const [pneumoSeverity, setPneumoSeverity] = useState(55); // 0..100
  const [chestSealed, setChestSealed] = useState(false);
  const [semiSeated, setSemiSeated] = useState(false);

  // Anaphylaxis State
  const [epiSelected, setEpiSelected] = useState(false);
  const [epiInjected, setEpiInjected] = useState(false);
  const [airwayOpenPct, setAirwayOpenPct] = useState(26); // 26% constricted -> 95% dilated post-Epi!

  // Live Vitals
  const [spo2, setSpo2] = useState(sc.initialSpo2);
  const [hr, setHr] = useState(sc.initialHr);
  const [rr, setRr] = useState(sc.initialRr);
  const [bp, setBp] = useState(sc.initialBp);

  const visualCanvasRef = useRef(null);
  const ecgCanvasRef = useRef(null);
  const audioCtxRef = useRef(null);
  const pressTimestampsRef = useRef([]);
  const chestPressAnimRef = useRef(0);
  const thrustAnimRef = useRef(0);

  // Reset state whenever case switches
  const resetCase = (nextId = caseId) => {
    const nextSc = EMERGENCY_ABC_SCENARIOS[nextId];
    setCaseId(nextId);
    setMdaCalled(false);
    setAskedSample({});
    setFeedback(null);
    setResolved(false);
    setCompressionCount(0);
    setCompressionBpm(0);
    setPerfusionPct(0);
    setAedOn(false);
    setPadsPlaced({ rightUpper: false, leftLower: false });
    setAedAnalyzed(false);
    setShockDelivered(false);
    setRoscAchieved(false);
    setBackBlows(0);
    setHeimlichThrusts(0);
    setBolusProgress(0);
    setPneumoSeverity(55);
    setChestSealed(false);
    setSemiSeated(false);
    setEpiSelected(false);
    setEpiInjected(false);
    setAirwayOpenPct(26);
    setSpo2(nextSc.initialSpo2);
    setHr(nextSc.initialHr);
    setRr(nextSc.initialRr);
    setBp(nextSc.initialBp);
    pressTimestampsRef.current = [];
  };

  function playClickTone(freq = 720, dur = 0.06) {
    try {
      if (!audioCtxRef.current) {
        const AC = window.AudioContext || window.webkitAudioContext;
        audioCtxRef.current = new AC();
      }
      const ac = audioCtxRef.current;
      if (ac.state === 'suspended') ac.resume();
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.frequency.setValueAtTime(freq, ac.currentTime);
      g.gain.setValueAtTime(0.05, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
      osc.connect(g);
      g.connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + dur + 0.01);
    } catch {
      // Ignore audio block
    }
  }

  // 110 BPM CPR Metronome
  useEffect(() => {
    if (!metronomeOn || (caseId !== 'cpr_vf' && caseId !== 'cpr_asystole')) return;
    const id = setInterval(() => playClickTone(880, 0.045), Math.round(60000 / 110));
    return () => clearInterval(id);
  }, [metronomeOn, caseId]);

  // Perform 1 Chest Compression
  const performCompression = () => {
    if (roscAchieved) return;
    const now = performance.now();
    const list = [...pressTimestampsRef.current.filter((t) => now - t < 4500), now];
    pressTimestampsRef.current = list;
    let bpm = 110;
    if (list.length >= 2) {
      const avgGap = (list[list.length - 1] - list[0]) / (list.length - 1);
      bpm = Math.round(60000 / Math.max(250, avgGap));
    }
    setCompressionBpm(bpm);
    setCompressionCount((c) => c + 1);
    chestPressAnimRef.current = 1.0;

    const qualityGood = bpm >= 95 && bpm <= 128;
    setPerfusionPct((p) => Math.min(100, p + (qualityGood ? 14 : 7)));
    setSpo2((s) => Math.min(94, s + (qualityGood ? 0.6 : 0.2)));
    playClickTone(qualityGood ? 520 : 320, 0.05);

    if (caseId === 'cpr_asystole' && compressionCount + 1 >= 15 && aedAnalyzed && mdaCalled) {
      setResolved(true);
      setFeedback({
        kind: 'ok',
        text: '✅ מעולה! ביצעת החייאה איכותית ורציפה באסיסטולה ללא מתן שוק מיותר והזעקת נט"ן 101 — זהו בדיוק הפרוטוקול המציל חיים!',
      });
    }
  };

  // Spacebar shortcut for rhythmic CPR compressions!
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space' && (caseId === 'cpr_vf' || caseId === 'cpr_asystole') && !roscAchieved) {
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'BUTTON') {
          e.preventDefault();
          performCompression();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Natural decay / progression timer (1s ticks)
  useEffect(() => {
    const id = setInterval(() => {
      if (caseId === 'cpr_vf' || caseId === 'cpr_asystole') {
        if (!roscAchieved) {
          setPerfusionPct((p) => Math.max(0, p - 7));
        }
      } else if (caseId === 'choking_airway' && !resolved) {
        setSpo2((s) => Math.max(66, s - 0.8));
      } else if (caseId === 'tension_pneumo' && !resolved) {
        setPneumoSeverity((p) => {
          const delta = chestSealed ? (semiSeated ? -1.5 : -0.5) : 1.6;
          return Math.max(18, Math.min(96, p + delta));
        });
        setSpo2((s) => (chestSealed ? Math.min(93, s + 0.6) : Math.max(68, s - 0.7)));
      } else if (caseId === 'anaphylaxis_epipen') {
        if (epiInjected) {
          setAirwayOpenPct((a) => Math.min(96, a + 6));
          setSpo2((s) => Math.min(98, s + 1.2));
          setHr((h) => Math.max(94, h - 2));
          setRr((r) => Math.max(17, r - 1));
          setBp('116/74');
        } else {
          setAirwayOpenPct((a) => Math.max(12, a - 0.8));
          setSpo2((s) => Math.max(72, s - 0.6));
        }
      }
    }, 900);
    return () => clearInterval(id);
  }, [caseId, roscAchieved, resolved, chestSealed, semiSeated, epiInjected]);

  // AED Actions
  const handleDeliverShock = () => {
    if (!aedAnalyzed) {
      setFeedback({ kind: 'warn', text: 'לחץ קודם על "נתח קצב (Analyze)" כדי שה-AED יבדוק את האק"ג!' });
      return;
    }
    if (!sc.shockable) {
      setFeedback({
        kind: 'err',
        text: '⛔ ה-AED חסם שוק! זהו קצב אסיסטולה (קו שטוח) — לא נותנים שוק באסיסטולה! חזור מיד לעיסויי חזה איכותיים!',
      });
      return;
    }
    setShockDelivered(true);
    playClickTone(1040, 0.2);
    if (compressionCount >= 5) {
      setRoscAchieved(true);
      setResolved(true);
      setHr(86);
      setRr(16);
      setSpo2(96);
      setBp('112/72');
      setPerfusionPct(95);
      setFeedback({
        kind: 'ok',
        text: '⚡ שוק חשמלי ניתן בהצלחה! חזרת דופק ספונטני (ROSC) — הקצב חזר לסינוס תקין (86 BPM)! המשך להשגיח עד הגעת מד"א.',
      });
    } else {
      setFeedback({
        kind: 'warn',
        text: '⚡ השוק ניתן — כעת בצע עוד כמה עיסויי חזה איכותיים (לפחות 5 לחיצות) להזרים דם לשריר הלב ולהשגת ROSC!',
      });
    }
  };

  // Choking Actions
  const handleBackBlow = () => {
    if (resolved) return;
    thrustAnimRef.current = 1.0;
    const nextB = backBlows + 1;
    setBackBlows(nextB);
    setBolusProgress((p) => Math.min(55, p + 11));
    playClickTone(440, 0.05);
    if (nextB === 5) {
      setFeedback({ kind: 'info', text: 'בוצעו 5 טפיחות בין השכמות! הגוף הזר זז חלקית — עבור כעת ל-5 לחיצות בטן (היימליך)!' });
    }
  };

  const handleHeimlich = () => {
    if (resolved) return;
    thrustAnimRef.current = 1.0;
    const nextH = heimlichThrusts + 1;
    setHeimlichThrusts(nextH);
    playClickTone(580, 0.06);
    setBolusProgress((p) => {
      const np = Math.min(100, p + 18);
      if (np >= 100) {
        setResolved(true);
        setSpo2(98);
        setHr(92);
        setRr(18);
        setFeedback({
          kind: 'ok',
          text: '🎉 הגוף הזר נפלט מנתיב האוויר! הסועד משתעל ונושם לרווחה והסטורציה עולה ל-98%!',
        });
      }
      return np;
    });
  };

  // =========================================================
  // LIVE ANATOMICAL CASE CANVAS (CPR / Choking / Pneumo / Anaphylaxis)
  // =========================================================
  useEffect(() => {
    const canvas = visualCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = 640;
    const H = 330;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = Math.max(300, Math.floor(rect.width * dpr));
      canvas.height = Math.max(220, Math.floor(rect.height * dpr));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement);

    let rafId = 0;
    let clock = 0;

    const render = () => {
      rafId = requestAnimationFrame(render);
      clock += 0.016;
      chestPressAnimRef.current = Math.max(0, chestPressAnimRef.current - 0.07);
      thrustAnimRef.current = Math.max(0, thrustAnimRef.current - 0.07);

      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(canvas.width / W, canvas.height / H);

      // Dark clinical background
      const bg = ctx.createRadialGradient(W * 0.5, H * 0.5, 25, W * 0.5, H * 0.5, 360);
      bg.addColorStop(0, '#12213d');
      bg.addColorStop(1, '#060c18');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      if (caseId === 'cpr_vf' || caseId === 'cpr_asystole') {
        // ---- CPR + AED REALISTIC THORAX VIEW ----
        const isF = gender === 'female';
        const depress = chestPressAnimRef.current * 14;
        const cx = W * 0.5;
        const cy = H * 0.52;

        // Sculpted Male/Female Upper Torso & Shoulders
        ctx.save();
        ctx.translate(0, depress * 0.45);
        const torGrad = ctx.createLinearGradient(cx - 140, cy - 120, cx + 140, cy + 120);
        torGrad.addColorStop(0, '#a87052');
        torGrad.addColorStop(0.5, '#eac0a2');
        torGrad.addColorStop(1, '#945d42');
        ctx.fillStyle = torGrad;
        ctx.beginPath();
        ctx.roundRect(cx - (isF ? 118 : 138), cy - 108, isF ? 236 : 276, 224, 52);
        ctx.fill();
        ctx.strokeStyle = 'rgba(148,163,184,0.35)';
        ctx.lineWidth = 1.6;
        ctx.stroke();

        // Clavicles & Sternum anatomical landmark
        ctx.strokeStyle = 'rgba(110, 62, 40, 0.42)';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(cx - 18, cy - 92);
        ctx.quadraticCurveTo(cx - 75, cy - 102, cx - 110, cy - 82);
        ctx.moveTo(cx + 18, cy - 92);
        ctx.quadraticCurveTo(cx + 75, cy - 102, cx + 110, cy - 82);
        ctx.stroke();

        // Translucent Heart inside center-left thorax (visibly compressed & pumping!)
        const heartBeat = roscAchieved ? 1 + Math.sin(clock * 9) * 0.1 : 1 - chestPressAnimRef.current * 0.22;
        ctx.save();
        ctx.translate(cx + 12, cy - 8);
        ctx.scale(heartBeat, heartBeat);
        ctx.fillStyle = roscAchieved ? 'rgba(225, 29, 72, 0.85)' : 'rgba(185, 28, 28, 0.55)';
        ctx.beginPath();
        ctx.moveTo(0, -24);
        ctx.bezierCurveTo(28, -28, 34, 8, 6, 32);
        ctx.bezierCurveTo(-26, 18, -28, -18, 0, -24);
        ctx.fill();
        ctx.restore();

        // Central Sternum CPR Hand Placement Target
        ctx.strokeStyle = '#38bdf8';
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy + 4, 34 - depress * 0.6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#e0f2fe';
        ctx.font = 'bold 11px "Segoe UI", Arial';
        ctx.textAlign = 'center';
        ctx.fillText('מרכז עצם החזה', cx, cy + 4);
        ctx.font = '10px "Segoe UI", Arial';
        ctx.fillText('(לחץ SPACE או כפתור)', cx, cy + 18);

        // AED Pad Target 1: Upper-Right Subclavicular (viewer left!)
        const p1x = cx - 72;
        const p1y = cy - 48;
        ctx.fillStyle = padsPlaced.rightUpper ? '#facc15' : 'rgba(250, 204, 21, 0.16)';
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(p1x - 28, p1y - 22, 56, 44, 8);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = padsPlaced.rightUpper ? '#0f172a' : '#fef08a';
        ctx.font = 'bold 10.5px "Segoe UI", Arial';
        ctx.fillText(padsPlaced.rightUpper ? 'מדבקה 1 ✓' : 'הדבק AED 1', p1x, p1y + 3);

        // AED Pad Target 2: Lower-Left Lateral Apex (viewer right!)
        const p2x = cx + 82;
        const p2y = cy + 48;
        ctx.fillStyle = padsPlaced.leftLower ? '#facc15' : 'rgba(250, 204, 21, 0.16)';
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(p2x - 28, p2y - 22, 56, 44, 8);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = padsPlaced.leftLower ? '#0f172a' : '#fef08a';
        ctx.fillText(padsPlaced.leftLower ? 'מדבקה 2 ✓' : 'הדבק AED 2', p2x, p2y + 3);

        // Electric defibrillation arc flash when shock delivered!
        if (shockDelivered && roscAchieved) {
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.85)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(p1x + 28, p1y + 10);
          ctx.lineTo(cx, cy);
          ctx.lineTo(p2x - 28, p2y - 10);
          ctx.stroke();
        }
        ctx.restore();

        // Cerebral Perfusion Gauge on Left Side
        ctx.fillStyle = 'rgba(10, 17, 32, 0.88)';
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.beginPath();
        ctx.roundRect(14, 16, 146, 86, 10);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#bae6fd';
        ctx.font = 'bold 11px "Segoe UI", Arial';
        ctx.textAlign = 'right';
        ctx.fillText('🧠 זילוח דם למוח:', 150, 36);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(24, 46, 126, 12);
        ctx.fillStyle = perfusionPct >= 60 ? '#10b981' : '#f59e0b';
        ctx.fillRect(24, 46, (126 * Math.min(100, perfusionPct)) / 100, 12);
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(`קצב: ${compressionBpm} /דקה (יעד 100-120)`, 150, 78);
        ctx.fillText(`עיסויים שבוצעו: ${compressionCount}`, 150, 94);
      } else if (caseId === 'choking_airway') {
        // ---- CHOKING SAGITTAL AIRWAY CROSS-SECTION ----
        const cx = W * 0.5;
        const pushUp = thrustAnimRef.current * 24;

        // Trachea tube & Bronchi -> Lungs
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 32;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx, 56);
        ctx.lineTo(cx, 204);
        ctx.stroke();

        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 24;
        ctx.beginPath();
        ctx.moveTo(cx, 56);
        ctx.lineTo(cx, 204);
        ctx.stroke();

        // Lungs (cyanotic while blocked, healthy pink once expelled!)
        const lungCol = resolved ? '#f48fb1' : '#5b4b7a';
        const breathExpand = resolved ? 1 + Math.sin(clock * 3.5) * 0.08 : 0.92;
        ctx.save();
        ctx.translate(cx, 232);
        ctx.scale(breathExpand, breathExpand);
        ctx.fillStyle = lungCol;
        ctx.beginPath();
        ctx.ellipse(-62, 0, 44, 62, 0.16, 0, Math.PI * 2);
        ctx.ellipse(62, 0, 44, 62, -0.16, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Diaphragm dome pushing upward on Heimlich!
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(cx - 118, 306 - pushUp);
        ctx.quadraticCurveTo(cx, 270 - pushUp * 1.6, cx + 118, 306 - pushUp);
        ctx.stroke();
        ctx.fillStyle = '#fde68a';
        ctx.font = 'bold 11px "Segoe UI", Arial';
        ctx.textAlign = 'center';
        ctx.fillText('סרעפת (נדחפת מעלה בתמרון היימליך)', cx, 322);

        // Lodged Foreign Body moving upward toward exit as bolusProgress increases!
        if (!resolved) {
          const by = 148 - (bolusProgress / 100) * 105;
          ctx.fillStyle = '#b45309';
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.ellipse(cx, by, 13, 17, 0.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#fecaca';
          ctx.font = 'bold 11.5px "Segoe UI", Arial';
          ctx.textAlign = 'left';
          ctx.fillText('◄ גוף זר חוסם את קנה הנשימה!', cx + 28, by + 4);
        } else {
          // Blue airflow arrows freely entering lungs!
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(cx, 54);
          ctx.lineTo(cx, 198);
          ctx.moveTo(cx, 196);
          ctx.lineTo(cx - 48, 224);
          ctx.moveTo(cx, 196);
          ctx.lineTo(cx + 48, 224);
          ctx.stroke();
          ctx.fillStyle = '#6ee7b7';
          ctx.font = 'bold 13px "Segoe UI", Arial';
          ctx.textAlign = 'center';
          ctx.fillText('✓ נתיב האוויר פתוח — כניסת חמצן תקינה!', cx, 36);
        }
      } else if (caseId === 'tension_pneumo') {
        // ---- TENSION PNEUMOTHORAX: COLLAPSING LUNG & MEDIASTINAL SHIFT ----
        const cx = W * 0.5;
        const sev = pneumoSeverity / 100; // 0..1
        const shiftPx = sev * 32; // Heart pushed sideways!

        // Ribcage outline
        ctx.strokeStyle = 'rgba(226, 232, 240, 0.45)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(cx, 168, 152, 128, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Trapped Air in Right Pleural Space (viewer left)
        ctx.fillStyle = `rgba(56, 189, 248, ${0.15 + sev * 0.28})`;
        ctx.beginPath();
        ctx.ellipse(cx - 78, 168, 66, 108, 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7dd3fc';
        ctx.font = 'bold 11px "Segoe UI", Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`אוויר כלוא בלחץ (${Math.round(pneumoSeverity)}%)`, cx - 86, 86);

        // Collapsing Right Lung (shrinks dramatically as sev rises!)
        const rightLungScale = Math.max(0.32, 1 - sev * 0.65);
        ctx.fillStyle = '#9d4d63';
        ctx.beginPath();
        ctx.ellipse(cx - 48 + shiftPx * 0.4, 170, 44 * rightLungScale, 82 * rightLungScale, 0.12, 0, Math.PI * 2);
        ctx.fill();

        // Left Lung (crowded by shifted heart)
        const breath = 1 + Math.sin(clock * 5) * 0.05;
        ctx.fillStyle = '#d46a82';
        ctx.beginPath();
        ctx.ellipse(cx + 80, 170, 46 * breath, 88 * breath, -0.1, 0, Math.PI * 2);
        ctx.fill();

        // Heart & Vena Cava physically shifted sideways (Obstructive Shock!)
        ctx.save();
        ctx.translate(cx + 12 + shiftPx, 178);
        ctx.fillStyle = '#dc1b30';
        ctx.beginPath();
        ctx.moveTo(0, -24);
        ctx.bezierCurveTo(26, -26, 30, 8, 5, 32);
        ctx.bezierCurveTo(-24, 16, -24, -18, 0, -24);
        ctx.fill();
        ctx.restore();

        // Sucking chest wound + Occlusive 3-sided Seal
        ctx.fillStyle = chestSealed ? '#10b981' : '#ef4444';
        ctx.beginPath();
        ctx.roundRect(cx - 166, 152, 26, 34, 6);
        ctx.fill();
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 11px "Segoe UI", Arial';
        ctx.textAlign = 'right';
        ctx.fillText(chestSealed ? 'חבישה אוטמת ✓' : 'פצע חזה יונק ➔', cx - 172, 173);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fca5a5';
        ctx.fillText(
          sev > 0.5 ? '⚠️ דחיקת לב (Mediastinal Shift) ➔ הלם חסימתי!' : 'האוויר נבלם — המתן דחוף לנט"ן 101 לניקוז!',
          cx,
          314
        );
      } else if (caseId === 'anaphylaxis_epipen') {
        // ---- ANAPHYLAXIS: BRONCHIAL LUMEN + OUTER THIGH EPIPEN TARGET ----
        // Left half: Bronchiole cross-section (swollen/constricted -> dilating after EpiPen!)
        const bx = 175;
        const by = 165;
        const lumenR = 12 + (airwayOpenPct / 100) * 44;

        ctx.fillStyle = '#881337';
        ctx.beginPath();
        ctx.arc(bx, by, 78, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = epiInjected ? '#d9778b' : '#be123c';
        ctx.beginPath();
        ctx.arc(bx, by, 66, 0, Math.PI * 2);
        ctx.fill();
        // Air lumen opening
        ctx.fillStyle = '#070f1e';
        ctx.strokeStyle = epiInjected ? '#38bdf8' : '#fda4af';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(bx, by, lumenR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 12px "Segoe UI", Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`פתח דרכי האוויר: ${Math.round(airwayOpenPct)}%`, bx, 52);
        ctx.fillStyle = epiInjected ? '#6ee7b7' : '#fca5a5';
        ctx.fillText(epiInjected ? 'אדרנלין β₂ מרחיב סימפונות ✓' : 'בצקת וכיווץ סימפונות קשה!', bx, 272);

        // Right half: Outer Mid-Thigh (Vastus Lateralis) EpiPen Injection Site
        const tx = 465;
        const ty = 165;
        const thGrad = ctx.createLinearGradient(tx - 65, ty, tx + 65, ty);
        thGrad.addColorStop(0, '#a66e50');
        thGrad.addColorStop(0.5, '#ecc2a3');
        thGrad.addColorStop(1, '#945c40');
        ctx.fillStyle = thGrad;
        ctx.beginPath();
        ctx.roundRect(tx - 58, 56, 116, 224, 42);
        ctx.fill();

        // Target zone on OUTER mid-thigh
        ctx.strokeStyle = epiInjected ? '#10b981' : '#facc15';
        ctx.fillStyle = epiInjected ? 'rgba(16,185,129,0.25)' : 'rgba(250,204,21,0.22)';
        ctx.lineWidth = 2.2;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.ellipse(tx - 32, ty, 24, 42, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 11px "Segoe UI", Arial';
        ctx.fillText(epiInjected ? 'אפיפן הוזרק ✓' : 'לחץ כאן להזרקת אפיפן', tx, 42);
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '10.5px "Segoe UI", Arial';
        ctx.fillText('שליש אמצעי — צד חיצוני של הירך (Vastus Lateralis)', tx, 304);
      }

      ctx.restore();
    };

    rafId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [
    caseId,
    gender,
    padsPlaced,
    roscAchieved,
    shockDelivered,
    perfusionPct,
    compressionBpm,
    compressionCount,
    bolusProgress,
    resolved,
    pneumoSeverity,
    chestSealed,
    airwayOpenPct,
    epiInjected,
  ]);

  // =========================================================
  // LIVE ECG RHYTHM MONITOR (VF / Asystole / Sinus Tachy / ROSC)
  // =========================================================
  useEffect(() => {
    const canvas = ecgCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const buf = new Array(190).fill(0);
    let phase = 0;
    let rafId = 0;

    const tick = () => {
      rafId = requestAnimationFrame(tick);
      let sample = 0;
      const rhythm = roscAchieved ? 'sinus' : sc.rhythmType;

      if (rhythm === 'vf') {
        phase += 0.17;
        sample =
          Math.sin(phase * 2.1) * 0.42 +
          Math.sin(phase * 3.7) * 0.32 +
          (Math.random() - 0.5) * 0.38;
      } else if (rhythm === 'asystole') {
        sample = (Math.random() - 0.5) * 0.03;
      } else {
        const beatHz = Math.max(1.1, (hr || 86) / 60);
        phase = (phase + beatHz * 0.016) % 1;
        if (phase > 0.2 && phase < 0.24) sample = 1.0;
        else if (phase >= 0.24 && phase < 0.27) sample = -0.25;
        else if (phase > 0.42 && phase < 0.56) sample = 0.24 * Math.sin(((phase - 0.42) / 0.14) * Math.PI);
        else sample = (Math.random() - 0.5) * 0.02;
      }

      buf.push(sample);
      if (buf.length > 190) buf.shift();

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = rhythm === 'vf' || rhythm === 'asystole' ? '#ef4444' : '#10b981';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < buf.length; i++) {
        const x = (i / (buf.length - 1)) * w;
        const y = h * 0.62 - buf[i] * (h * 0.44);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [sc.rhythmType, roscAchieved, hr]);

  // Canvas click handler for AED Pads & EpiPen Thigh Site
  const handleVisualCanvasClick = (e) => {
    const canvas = visualCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 640;
    const y = ((e.clientY - rect.top) / rect.height) * 330;

    if (caseId === 'cpr_vf' || caseId === 'cpr_asystole') {
      if (!aedOn) {
        setFeedback({ kind: 'warn', text: 'הפעל קודם את מכשיר ה-AED ("הפעל דפיברילטור") לפני הדבקת המדבקות!' });
        return;
      }
      const cx = 320;
      const cy = 330 * 0.52;
      if (Math.hypot(x - (cx - 72), y - (cy - 48)) < 55) {
        setPadsPlaced((p) => ({ ...p, rightUpper: true }));
        setFeedback({ kind: 'ok', text: '✓ מדבקה 1 הודבקה מתחת לעצם הבריח הימנית!' });
      } else if (Math.hypot(x - (cx + 82), y - (cy + 48)) < 55) {
        setPadsPlaced((p) => ({ ...p, leftLower: true }));
        setFeedback({ kind: 'ok', text: '✓ מדבקה 2 הודבקה בצד שמאל תחתון של בית החזה (מתחת לבית השחי)!' });
      }
    } else if (caseId === 'anaphylaxis_epipen') {
      if (!epiSelected) {
        setFeedback({ kind: 'warn', text: 'בחר תחילה במזרק האפיפן בסרגל הפעולות ואז לחץ על השליש האמצעי של צד הירך החיצונית!' });
        return;
      }
      // Outer mid-thigh target at (433, 165)
      if (Math.hypot(x - 433, y - 165) < 55) {
        setEpiInjected(true);
        setResolved(true);
        playClickTone(820, 0.14);
        setFeedback({
          kind: 'ok',
          text: '💉 הזרקת אפיפן מושלמת לשריר הירך הצידי (Vastus Lateralis)! צפה בדרכי האוויר נפתחות ובלחץ הדם חוזר לעלות!',
        });
      } else {
        setFeedback({
          kind: 'err',
          text: '❌ מיקום שגוי! אפיפן מזריקים אך ורק לשליש האמצעי בצד החיצוני של שריר הירך (המסומן בצהוב) — לא לוריד, לא לבטן ולא לצד הפנימי!',
        });
      }
    }
  };

  const bothPadsPlaced = padsPlaced.rightUpper && padsPlaced.leftLower;

  return (
    <div className="abc-layout">
      {/* RIGHT COLUMN: CASE SELECTOR + CASE-SPECIFIC EMERGENCY INTERVENTIONS */}
      <aside className="panel">
        <div className="panel-header">
          <div className="panel-title">
            <HeartPulse size={16} style={{ color: '#ef4444' }} />
            <span>מצבי חירום A-B-C והחייאה</span>
          </div>
          <button type="button" className="mini-chip" onClick={() => resetCase(caseId)}>
            <RotateCcw size={12} /> איפוס
          </button>
        </div>

        <div className="toolkit-body">
          <div className="tool-section-label"><span>בחר תרחיש חירום (5 תרחישים)</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {Object.values(EMERGENCY_ABC_SCENARIOS).map((item) => (
              <button
                key={item.id}
                type="button"
                className={`anatomy-lab-item ${caseId === item.id ? 'active' : ''}`}
                onClick={() => resetCase(item.id)}
              >
                <div style={{ textAlign: 'right', flex: 1 }}>
                  <div style={{ fontSize: '0.79rem', fontWeight: 700 }}>{item.title}</div>
                  <div style={{ fontSize: '0.67rem', color: '#94a3b8' }}>{item.category}</div>
                </div>
              </button>
            ))}
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />

          {/* Action Panel per Emergency Type */}
          <div className="tool-section-label"><span>פעולות מע"ר למקרה זה</span></div>
          <button
            type="button"
            className={`tool-btn ${mdaCalled ? 'active' : ''}`}
            onClick={() => {
              setMdaCalled(true);
              setFeedback({ kind: 'ok', text: '🚑 ניידת טיפול נמרץ מד"א 101 הוזנקה בדחיפות עליונה!' });
            }}
          >
            <div className="tool-icon" style={{ color: '#f87171' }}><PhoneCall size={18} /></div>
            <div className="tool-info">
              <div className="tool-name"><span>הזעק מד"א / נט"ן 101</span>{mdaCalled && <span className="tool-status">בדרך ✓</span>}</div>
              <div className="tool-desc">עדיפות ראשונה בכל מקרה חירום מסכן חיים</div>
            </div>
          </button>

          {(caseId === 'cpr_vf' || caseId === 'cpr_asystole') && (
            <>
              <button type="button" className="finish-btn" onClick={performCompression}>
                <HeartPulse size={17} /> <span>בצע עיסוי חזה! (או לחץ SPACE)</span>
              </button>

              <button
                type="button"
                className={`tool-btn ${metronomeOn ? 'active' : ''}`}
                onClick={() => setMetronomeOn((v) => !v)}
              >
                <div className="tool-icon text-sky">{metronomeOn ? <Volume2 size={18} /> : <VolumeX size={18} />}</div>
                <div className="tool-info">
                  <div className="tool-name"><span>מטרונום החייאה (110 BPM)</span></div>
                  <div className="tool-desc">שומר על קצב לחיצות מושלם (100–120/דקה)</div>
                </div>
              </button>

              <div className="aed-unit-box">
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#facc15', marginBottom: 6 }}>
                  ⚡ דפיברילטור חצי-אוטומטי (AED)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <button
                    type="button"
                    className={`cat-btn ${aedOn ? 'time-btn stamped' : ''}`}
                    onClick={() => {
                      setAedOn(true);
                      playClickTone(660, 0.1);
                      setFeedback({ kind: 'info', text: '⚡ ה-AED פועל! כעת לחץ על שני האזורים הצהובים על בית החזה להדבקת המדבקות.' });
                    }}
                  >
                    1. {aedOn ? 'המכשיר דולק ✓' : 'הפעל AED'}
                  </button>
                  <button
                    type="button"
                    className="cat-btn time-btn"
                    disabled={!aedOn}
                    onClick={() => {
                      setPadsPlaced({ rightUpper: true, leftLower: true });
                      setFeedback({ kind: 'ok', text: '✓ שתי מדבקות ה-AED הודבקו במיקום האנטומי הנכון!' });
                    }}
                  >
                    2. {bothPadsPlaced ? 'שתי מדבקות מחוברות ✓' : 'הדבק מדבקות (או לחץ על החזה)'}
                  </button>
                  <button
                    type="button"
                    className="cat-btn"
                    disabled={!bothPadsPlaced}
                    onClick={() => {
                      setAedAnalyzed(true);
                      setFeedback(
                        sc.shockable
                          ? { kind: 'warn', text: '⚡ אבחון AED: זוהה פרפור חדרים (VF)! מומלץ שוק — ודא שאיש אינו נוגע ולחץ "תן שוק"!' }
                          : { kind: 'err', text: '🛑 אבחון AED: קצב אסיסטולה (לא בר-שוק)! לא מומלץ שוק — המשך מיד בעיסויי חזה!' }
                      );
                    }}
                  >
                    3. נתח קצב ECG (Analyze)
                  </button>
                  <button
                    type="button"
                    className="finish-btn"
                    style={{ background: sc.shockable && aedAnalyzed ? 'linear-gradient(135deg,#dc2626,#b91c1c)' : undefined }}
                    disabled={!aedAnalyzed}
                    onClick={handleDeliverShock}
                  >
                    <Zap size={16} /> 4. תן שוק חשמלי! (SHOCK)
                  </button>
                </div>
              </div>
            </>
          )}

          {caseId === 'choking_airway' && (
            <>
              <button type="button" className="tool-btn" onClick={handleBackBlow}>
                <div className="tool-icon" style={{ color: '#f59e0b' }}><Wind size={18} /></div>
                <div className="tool-info">
                  <div className="tool-name"><span>טפיחה חזקה בין השכמות</span><span className="tool-status warn">{backBlows}/5</span></div>
                  <div className="tool-desc">שלב ראשון בסט: 5 טפיחות גב</div>
                </div>
              </button>
              <button type="button" className="finish-btn" onClick={handleHeimlich}>
                <span>לחיצת בטן — תמרון היימליך ({heimlichThrusts}/5)</span>
              </button>
            </>
          )}

          {caseId === 'tension_pneumo' && (
            <>
              <button
                type="button"
                className={`tool-btn ${chestSealed ? 'active' : ''}`}
                onClick={() => {
                  setChestSealed(true);
                  setFeedback({ kind: 'ok', text: '🩹 הונחה חבישה אוטמת/שסתומית על פצע החזה היונק — כניסת האוויר נעצרה! המתן דחוף לפרמדיק 101.' });
                  if (mdaCalled && semiSeated) setResolved(true);
                }}
              >
                <div className="tool-icon text-emerald"><CheckCircle2 size={18} /></div>
                <div className="tool-info">
                  <div className="tool-name"><span>חבישה אוטמת (3 צדדים)</span>{chestSealed && <span className="tool-status">אטום ✓</span>}</div>
                  <div className="tool-desc">מונעת כניסת אוויר נוספת דרך הפצע לחזה</div>
                </div>
              </button>
              <button
                type="button"
                className={`tool-btn ${semiSeated ? 'active' : ''}`}
                onClick={() => {
                  setSemiSeated(true);
                  setFeedback({ kind: 'ok', text: '🪑 הפצוע הושב במנח חצי-ישיבה (Semi-Fowler) המקל על עבודת הנשימה.' });
                  if (mdaCalled && chestSealed) setResolved(true);
                }}
              >
                <div className="tool-icon text-sky"><Wind size={18} /></div>
                <div className="tool-info">
                  <div className="tool-name"><span>הושבה בחצי-ישיבה</span>{semiSeated && <span className="tool-status">בוצע ✓</span>}</div>
                  <div className="tool-desc">מקל על תנועת הסרעפת והריאה התקינה</div>
                </div>
              </button>
            </>
          )}

          {caseId === 'anaphylaxis_epipen' && (
            <button
              type="button"
              className={`tool-btn ${epiInjected ? 'active' : epiSelected ? 'selected-mode' : 'recommended'}`}
              onClick={() => {
                setEpiSelected(true);
                setFeedback({ kind: 'info', text: '💉 מזרק אפיפן מוכן! לחץ כעת על האזור הצהוב בצד החיצוני של הירך בציור!' });
              }}
            >
              <div className="tool-icon" style={{ color: '#facc15' }}><Syringe size={18} /></div>
              <div className="tool-info">
                <div className="tool-name">
                  <span>מזרק אפיפן (אדרנלין 0.3 מ"ג)</span>
                  {epiInjected && <span className="tool-status">הוזרק ✓</span>}
                </div>
                <div className="tool-desc">הזרקה לשליש האמצעי של שריר הירך החיצוני</div>
              </div>
            </button>
          )}
        </div>
      </aside>

      {/* CENTER COLUMN: LIVE INTERACTIVE VISUALIZER + ECG + DEEP DIVE MECHANISM */}
      <section className="stage-column">
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <span>{sc.title}</span>
            </div>
            <div className="segmented">
              <button className={gender === 'male' ? 'active' : ''} onClick={() => onChangeGender('male')}>👨 זכר</button>
              <button className={gender === 'female' ? 'active' : ''} onClick={() => onChangeGender('female')}>👩 נקבה</button>
            </div>
          </div>

          <div style={{ padding: '10px 13px', background: 'rgba(15,23,42,0.75)', borderBottom: '1px solid var(--border)', fontSize: '0.82rem' }}>
            <div style={{ color: '#e2e8f0', marginBottom: 4 }}><strong>תיאור המקרה:</strong> {sc.story}</div>
            <div style={{ color: '#7dd3fc', fontSize: '0.77rem' }}><strong>יעד הטיפול:</strong> {sc.goalSummary}</div>
          </div>

          {/* Live Vitals + ECG Strip */}
          <div className="abc-monitor-strip">
            <div className="abc-ecg-wrap">
              <div style={{ fontSize: '0.68rem', color: '#34d399', fontWeight: 700 }}>
                ECG LIVE — {roscAchieved ? 'ROSC (סינוס תקין!)' : sc.rhythmType.toUpperCase()}
              </div>
              <canvas ref={ecgCanvasRef} width={320} height={50} style={{ width: '100%', height: 46, display: 'block' }} />
            </div>
            <div className="abc-vitals-pills">
              <div className="pv-chip"><span>❤️ דופק</span><strong>{hr} BPM</strong></div>
              <div className="pv-chip"><span>🫁 נשימה</span><strong>{rr} /דקה</strong></div>
              <div className="pv-chip"><span>🫧 SpO₂</span><strong style={{ color: spo2 < 90 ? '#fca5a5' : '#60a5fa' }}>{Math.round(spo2)}%</strong></div>
              <div className="pv-chip"><span>🩺 BP</span><strong>{bp}</strong></div>
            </div>
          </div>

          {/* Interactive Case Canvas */}
          <div className="abc-canvas-host">
            <canvas ref={visualCanvasRef} className="abc-canvas" onClick={handleVisualCanvasClick} />
            {feedback && (
              <div className={`canvas-toast show toast-${feedback.kind}`} style={{ top: 12 }}>
                {feedback.text}
              </div>
            )}
          </div>

          {/* Comprehensive Deep Dive Box for Every Emergency Mechanism */}
          <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
            <DeepDiveBox
              title={sc.deepDiveMechanism.title}
              simpleText={sc.deepDiveMechanism.simpleText}
              deepText={sc.deepDiveMechanism.deepText}
              formula={sc.deepDiveMechanism.formula}
              clinicalPearl={sc.deepDiveMechanism.clinicalPearl}
              defaultOpen={true}
            />
          </div>
        </div>
      </section>

      {/* LEFT COLUMN: INTERACTIVE SAMPLE PATIENT INTERVIEW */}
      <aside className="panel">
        <div className="panel-header">
          <div className="panel-title">
            <MessageSquare size={16} className="text-sky" />
            <span>תשאול מטופל אינטראקטיבי — SAMPLE</span>
          </div>
        </div>

        <div className="sample-body">
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            לחץ על כל אות בסכמת <strong>SAMPLE</strong> כדי לשאול את הפצוע (או עוברי אורח) שאלות אנמנזה, לגלות רמזים קליניים ולהבין <em>למה</em> כל שאלה חשובה!
          </div>

          {SAMPLE_QUESTIONS.map((q) => {
            const asked = !!askedSample[q.key];
            return (
              <div key={q.key} className={`sample-card ${asked ? 'asked' : ''}`}>
                <button
                  type="button"
                  className="sample-ask-btn"
                  onClick={() => setAskedSample((prev) => ({ ...prev, [q.key]: true }))}
                >
                  <span className="sample-badge">{q.key}</span>
                  <div style={{ flex: 1, textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.79rem' }}>{q.label}</div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{q.prompt}</div>
                  </div>
                </button>

                {asked && (
                  <div className="sample-answer-wrap">
                    <div className="sample-reply">{sc.sampleAnswers[q.key]}</div>
                    <DeepDiveBox
                      title="למה שואלים את זה"
                      simpleText={q.whySimple}
                      deepText={q.whyDeep}
                      compact
                    />
                  </div>
                )}
              </div>
            );
          })}

          {resolved && (
            <div className="abc-resolved-banner">
              <AlertTriangle size={15} />
              <span>האירוע טופל בהצלחה! נסה כעת את התרחיש הבא ברשימה מימין כדי לתרגל את כל מערכות A-B-C.</span>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
