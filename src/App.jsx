import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Plus,
  GraduationCap,
  Stethoscope,
  Play,
  Pause,
  Zap,
  RotateCcw,
  Scan,
  PhoneCall,
  X,
  Dna,
  User,
  ZoomIn,
  HeartPulse,
  Microscope,
  MessageSquare,
  Box,
} from 'lucide-react';
import { SCENARIOS, BODY_REGIONS, BYSTANDERS_DATA } from './data/anatomyDatabase';
import { SAMPLE_QUESTIONS, TRAUMA_SAMPLE_ANSWERS } from './data/emergencyMedicalDatabase';
import {
  createInitialPhysiology,
  stepPhysiology,
  disruptClotOnEvent,
  getAvpuDisplay,
} from './engines/PhysiologyEngine';
import Scene3DViewport from './components/Scene3DViewport';
import AnatomyMacroView from './components/AnatomyMacroView';
import FullBodyAnatomyView from './components/FullBodyAnatomyView';
import AnatomyLabTab from './components/AnatomyLabTab';
import Anatomy3DAtlasTab from './components/atlas3d/Anatomy3DAtlasTab';
import EmergencyABCTab from './components/EmergencyABCTab';
import PhysiologyLabTab from './components/PhysiologyLabTab';
import DeepDiveBox from './components/DeepDiveBox';
import AnatomyXRayModal from './components/AnatomyXRayModal';
import MedicalMonitor from './components/MedicalMonitor';
import ToolboxAndProtocol from './components/ToolboxAndProtocol';
import DebriefingReport from './components/DebriefingReport';

function formatClock(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function createInitialInterventions() {
  return {
    glovesOn: false,
    gauzeLayers: 0,
    personalBandageOn: false,
    catMode: false,
    catPlaced: false,
    catX: 605,
    catWindlassTurns: 0,
    catTimeStamped: null,
    triangleOn: false,
    directPressureToggle: false,
    canvasPressing: false,
    pressureStrength: 0,
    elevated: false,
  };
}

function createInitialMetrics() {
  return {
    touchedBloodWithoutGloves: false,
    firstPressureTimeSec: null,
    firstGauzeTimeSec: null,
    catWrongAttempts: 0,
    catForbiddenAttempts: 0,
    gauzeRemovedErrors: 0,
  };
}

/**
 * src/App.jsx
 * לוח בקרה מרכזי דו-טאבי:
 * - טאב 1: מקרי עזרה ראשונה (8 תרחישים בכל הגוף — גפיים, צוואר, חזה, בטן — בזכר ובנקבה)
 * - טאב 2: מעבדת אנטומיה נפרדת בגוף מלא (זכר ונקבה, קילוף שכבות, עדשת X-Ray ואנציקלופדיה)
 */
export default function App() {
  const [activeTab, setActiveTab] = useState('cases'); // 'cases' | 'anatomy'
  const [gender, setGender] = useState('male'); // 'male' | 'female'
  const [caseVisualMode, setCaseVisualMode] = useState('fullbody'); // 'fullbody' | 'macro'
  const [mode, setMode] = useState('learn'); // 'learn' | 'practice'
  const [scenarioId, setScenarioId] = useState('arterial_forearm');
  const [anatomyRegionId, setAnatomyRegionId] = useState('forearm');
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(0.7);
  const [finished, setFinished] = useState(false);
  const [scene3DExpanded, setScene3DExpanded] = useState(false);

  const scenario = SCENARIOS[scenarioId] || SCENARIOS.arterial_forearm;
  const activeRegionId = scenario.bodyRegionId || 'forearm';
  const activeRegion = BODY_REGIONS[activeRegionId] || BODY_REGIONS.forearm;

  // Refs for 60FPS renderers
  const physiologyRef = useRef(createInitialPhysiology(scenario, 'male'));
  const interventionsRef = useRef(createInitialInterventions());
  const metricsRef = useRef(createInitialMetrics());
  const pausedRef = useRef(false);
  const activeTabRef = useRef('cases');
  const speedRef = useRef(0.7);
  const finishedRef = useRef(false);
  const scenarioRef = useRef(scenario);

  // React UI state snapshots
  const [physiology, setPhysiology] = useState(() => physiologyRef.current);
  const [interventions, setInterventions] = useState(() => interventionsRef.current);
  const [bystanders, setBystanders] = useState({
    caller101: false,
    aedRunner: false,
    crowdController: false,
  });
  const bystandersRef = useRef(bystanders);
  const [mdaState, setMdaState] = useState({
    called: false,
    callTimeSec: null,
    etaSec: 110,
    arrived: false,
  });
  const mdaStateRef = useRef(mdaState);

  const [selectedLayerId, setSelectedLayerId] = useState(null);
  const [xrayOpen, setXrayOpen] = useState(false);
  const [xrayLayerId, setXrayLayerId] = useState('artery');
  const [sampleModalOpen, setSampleModalOpen] = useState(false);
  const [traumaSampleAsked, setTraumaSampleAsked] = useState({});
  const [mdaModalOpen, setMdaModalOpen] = useState(false);
  const [debriefOpen, setDebriefOpen] = useState(false);
  const [criticalFail, setCriticalFail] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  const [eventLog, setEventLog] = useState([
    {
      time: '00:00',
      severity: 'info',
      message: 'ברוך הבא לסימולטור מע"ר! בחר זכר/נקבה ומוקד פציעה מכל 8 המקרים בגוף, או עבור לטאב האנטומיה.',
    },
  ]);

  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { finishedRef.current = finished; }, [finished]);
  useEffect(() => { scenarioRef.current = scenario; }, [scenario]);
  useEffect(() => { bystandersRef.current = bystanders; }, [bystanders]);
  useEffect(() => { mdaStateRef.current = mdaState; }, [mdaState]);

  const showToast = useCallback((text, kind = 'info', duration = 3800) => {
    setToast({ text, kind });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), duration);
  }, []);

  const addLog = useCallback((message, severity = 'info') => {
    const t = formatClock(physiologyRef.current.elapsedSec || 0);
    setEventLog((prev) => [{ time: t, severity, message }, ...prev.slice(0, 60)]);
  }, []);

  const syncInterventions = useCallback((updater) => {
    const next = typeof updater === 'function' ? updater(interventionsRef.current) : updater;
    interventionsRef.current = next;
    setInterventions({ ...next });
  }, []);

  const resetAll = useCallback((nextMode, nextScId, nextGender = gender) => {
    const sc = SCENARIOS[nextScId] || SCENARIOS.arterial_forearm;
    const initPhys = createInitialPhysiology(sc, nextGender);
    const initInt = createInitialInterventions();
    const initMda = { called: false, callTimeSec: null, etaSec: 110, arrived: false };
    const resetByst = { caller101: false, aedRunner: false, crowdController: false };

    physiologyRef.current = initPhys;
    interventionsRef.current = initInt;
    metricsRef.current = createInitialMetrics();
    bystandersRef.current = resetByst;
    mdaStateRef.current = initMda;
    finishedRef.current = false;

    setMode(nextMode);
    setScenarioId(sc.id);
    setAnatomyRegionId(sc.bodyRegionId || 'forearm');
    setSpeed(nextMode === 'learn' ? 0.7 : 1.0);
    speedRef.current = nextMode === 'learn' ? 0.7 : 1.0;
    setPaused(false);
    setFinished(false);
    setCriticalFail(false);
    setDebriefOpen(false);
    setMdaModalOpen(false);
    setSampleModalOpen(false);
    setTraumaSampleAsked({});
    setSelectedLayerId(null);
    setPhysiology(initPhys);
    setInterventions(initInt);
    setBystanders(resetByst);
    setMdaState(initMda);
    setEventLog([
      {
        time: '00:00',
        severity: 'info',
        message: `${sc.title} (${nextGender === 'male' ? 'זכר' : 'נקבה'}) — ${nextMode === 'learn' ? 'מצב לימוד' : 'מצב תרגול'}`,
      },
    ]);
  }, [gender]);

  const handleChangeGender = (nextGender) => {
    if (nextGender === gender) return;
    setGender(nextGender);
    // Adjust baseline blood volume physiologically without wiping user's progress if mid-study
    const nextTbv = nextGender === 'female' ? 4500 : 5000;
    const curr = physiologyRef.current;
    physiologyRef.current = {
      ...curr,
      totalBloodVolumeMl: nextTbv,
      bloodVolumeMl: Math.max(0, nextTbv - curr.bloodLostMl),
      bloodLossPct: (curr.bloodLostMl / nextTbv) * 100,
    };
    setPhysiology({ ...physiologyRef.current });
    addLog(`מודל גוף הפצוע הוחלף ל${nextGender === 'male' ? 'זכר (נפח דם ~5.0 ל\')' : 'נקבה (נפח דם ~4.5 ל\')'}`, 'info');
  };

  // =========================================================
  // MAIN SIMULATION LOOP (Auto-pauses blood loss in Anatomy Tab!)
  // =========================================================
  useEffect(() => {
    let rafId = 0;
    let lastTs = 0;
    let uiAccum = 0;

    const loop = (ts) => {
      rafId = requestAnimationFrame(loop);
      if (!lastTs) lastTs = ts;
      const dtReal = Math.min(0.05, (ts - lastTs) / 1000);
      lastTs = ts;

      // Pause trauma blood loss when exploring Anatomy, Emergency A-B-C, or Physiology Lab tabs!
      if (activeTabRef.current !== 'cases') {
        const p = physiologyRef.current;
        p.pulsePhase += Math.max(0.5, p.hr / 60) * dtReal;
        return;
      }

      if (pausedRef.current || finishedRef.current) return;

      const dtSim = dtReal * speedRef.current;
      const interv = interventionsRef.current;
      const targetP = interv.directPressureToggle || interv.canvasPressing ? 1.0 : 0.0;
      const nextP = interv.pressureStrength + (targetP - interv.pressureStrength) * Math.min(1, dtReal * 8);
      if (Math.abs(nextP - interv.pressureStrength) > 0.001) {
        interv.pressureStrength = nextP;
      }

      const { physiology: nextPhys, events } = stepPhysiology(
        physiologyRef.current,
        interv,
        scenarioRef.current,
        dtSim,
        dtReal
      );
      physiologyRef.current = nextPhys;

      if (events.length > 0) {
        events.forEach((ev) => {
          addLog(ev.message, ev.severity);
          if (ev.type === 'clot_destroyed') showToast(ev.message, 'err', 5200);
          else if (ev.type === 'clot_stable') showToast(ev.message, 'ok', 4200);
          else if (ev.type === 'bleeding_stopped') showToast(ev.message, 'ok', 4200);
          else if (ev.type === 'gauze_soaked') showToast(ev.message, 'warn', 4600);
          else if (ev.type === 'decompensated_shock') showToast(ev.message, 'err', 4800);
          else if (ev.type === 'collapsed') {
            finishedRef.current = true;
            setFinished(true);
            setCriticalFail(true);
            setDebriefOpen(true);
          }
        });
      }

      const mda = mdaStateRef.current;
      if (mda.called && !mda.arrived) {
        const etaDecay = nextPhys.bleedingStopped ? dtSim * 2.5 : dtSim;
        const nextEta = Math.max(0, mda.etaSec - etaDecay);
        if (nextEta <= 0) {
          const arrivedMda = { ...mda, etaSec: 0, arrived: true };
          mdaStateRef.current = arrivedMda;
          setMdaState(arrivedMda);
          addLog('🚑 צוות אמבולנס מד"א הגיע לזירה ולוקח פיקוד על הפינוי!', 'good');
          showToast('🚑 צוות מד"א הגיע לזירה! פותח דוח תחקיר רפואי...', 'ok', 3500);
          finishedRef.current = true;
          setFinished(true);
          setTimeout(() => setDebriefOpen(true), 1200);
        } else {
          mdaStateRef.current = { ...mda, etaSec: nextEta };
        }
      }

      uiAccum += dtReal;
      if (uiAccum >= 0.12) {
        uiAccum = 0;
        setPhysiology({ ...nextPhys });
        setInterventions({ ...interv });
        if (mdaStateRef.current.called && !mdaStateRef.current.arrived) {
          setMdaState({ ...mdaStateRef.current });
        }
      }
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [addLog, showToast]);

  // =========================================================
  // FIRST-AID TOOLKIT & 3D BYSTANDER HANDLERS
  // =========================================================
  const checkGloves = useCallback(
    (actionLabel) => {
      if (!interventionsRef.current.glovesOn) {
        metricsRef.current.touchedBloodWithoutGloves = true;
        addLog(`אזהרת בטיחות: בוצעה פעולה (${actionLabel}) ללא כפפות!`, 'bad');
        showToast('⚠️ נגעת בפצוע ללא כפפות! חובה להניח כפפות חד-פעמיות לבטיחות המטפל (שלב S).', 'err', 4200);
      }
    },
    [addLog, showToast]
  );

  const handleActivateBystander = useCallback(
    (id) => {
      if (finishedRef.current) return;
      const profile = BYSTANDERS_DATA.find((b) => b.id === id);
      if (!profile) return;

      if (bystandersRef.current[id]) {
        showToast(`${profile.name} כבר פועל בזירה ✓`, 'info', 2200);
        return;
      }

      const nextByst = { ...bystandersRef.current, [id]: true };
      bystandersRef.current = nextByst;
      setBystanders(nextByst);

      addLog(`עובר אורח הופעל (${profile.name}): ${profile.role}`, 'good');
      showToast(`🗣️ ${profile.activatedQuote}`, 'ok', 4400);

      if (id === 'caller101' && !mdaStateRef.current.called) {
        const nextMda = {
          called: true,
          callTimeSec: physiologyRef.current.elapsedSec,
          etaSec: 105,
          arrived: false,
        };
        mdaStateRef.current = nextMda;
        setMdaState(nextMda);
        addLog('🚑 עובר האורח דניאל הזעיק מד"א 101 — האמבולנס בדרך!', 'good');
      }
    },
    [addLog, showToast]
  );

  const handleUseGloves = () => {
    if (finished) return;
    if (interventionsRef.current.glovesOn) {
      showToast('הכפפות החד-פעמיות כבר מולבשות ✓', 'ok', 2200);
      return;
    }
    syncInterventions((prev) => ({ ...prev, glovesOn: true }));
    addLog('הולבשו כפפות חד-פעמיות (שלב S — בטיחות המטפל)', 'good');
    showToast('🧤 כפפות מולבשות! כעת ניתן לגשת לפצע בבטיחות.', 'ok');
  };

  const handleUseGauze = () => {
    if (finished) return;
    checkGloves('הנחת גזה סטרילית');
    const curr = interventionsRef.current.gauzeLayers;
    if (curr === 0) {
      if (metricsRef.current.firstGauzeTimeSec === null) {
        metricsRef.current.firstGauzeTimeSec = physiologyRef.current.elapsedSec;
      }
      syncInterventions((prev) => ({ ...prev, gauzeLayers: 1 }));
      physiologyRef.current = { ...physiologyRef.current, gauzeSaturation: 0.08 };
      addLog(`הונחה גזה סטרילית על הפצע ב${activeRegion.shortHe}`, 'good');
      showToast('🩹 גזה סטרילית הונחה! הפעל מיד לחץ ישיר רציף כדי לבנות קריש דם.', 'ok');
    } else if (curr < 3) {
      syncInterventions((prev) => ({ ...prev, gauzeLayers: curr + 1 }));
      physiologyRef.current = {
        ...physiologyRef.current,
        gauzeSaturation: Math.max(0.15, physiologyRef.current.gauzeSaturation - 0.45),
      };
      addLog(`הונחה שכבת גזה נוספת (#${curr + 1}) מעל הקיימת מבלי להסיר אותה`, 'good');
      showToast(`🩹 מצוין! הוספת שכבה #${curr + 1} מעל הספוגה מבלי להרוס את קריש הדם.`, 'ok', 4200);
    } else {
      showToast('כבר הונחו 3 שכבות גזה. המשך בלחץ ישיר חזק (או CAT בגפה במקרה עורקי)!', 'warn');
    }
  };

  const handleRemoveGauzeAttempt = () => {
    if (finished) return;
    metricsRef.current.gauzeRemovedErrors += 1;
    syncInterventions((prev) => ({ ...prev, gauzeLayers: 0 }));
    physiologyRef.current = disruptClotOnEvent(
      { ...physiologyRef.current, gauzeSaturation: 0 },
      'הסרת גזה ספוגה קרעה את רשת הפיברין!'
    );
    addLog('❌ טעות קלינית: הוסרה גזה ספוגה — קריש הדם נקרע והדימום התחדש!', 'bad');
    showToast('❌ לעולם לא מסירים גזה ספוגה! הסרת הגזה קרעה את הקריש שהתחיל להיווצר!', 'err', 5200);
  };

  const handleUsePersonalBandage = () => {
    if (finished) return;
    checkGloves('הנחת תחבושת אישית');
    if (interventionsRef.current.personalBandageOn) {
      showToast('תחבושת אישית כבר מונחת בחוזקה ✓', 'ok', 2200);
      return;
    }
    syncInterventions((prev) => ({
      ...prev,
      gauzeLayers: Math.max(1, prev.gauzeLayers),
      personalBandageOn: true,
    }));
    addLog('נחבשה תחבושת אישית על הפצע', 'good');
    if (scenario.hasArterial && !scenario.forbidsTourniquet && (!interventionsRef.current.catPlaced || interventionsRef.current.catWindlassTurns < 3)) {
      showToast('🩹 תחבושת אישית הונחה — אך הדימום העורקי עדיין פורץ! נדרש חוסם עורקים CAT.', 'warn', 4500);
    } else if (scenario.isInternalBleed) {
      showToast('🩹 הפצע השטחי נחבש — אך שים לב שהמדדים ממשיכים להשתנות בגלל דימום פנימי! פינוי 101 דחוף!', 'warn', 4800);
    } else {
      showToast('🩹 תחבושת אישית הונחה ושומרת על לחץ יציב לקרישת הדם!', 'ok');
    }
  };

  const handleSelectCat = () => {
    if (finished) return;
    // CRITICAL ME'AR SAFETY GUARDRAIL: NEVER TOURNIQUET ON NECK / CHEST / ABDOMEN!
    if (scenario.forbidsTourniquet || !activeRegion.canUseCat) {
      metricsRef.current.catForbiddenAttempts += 1;
      addLog(`❌ אזהרה קריטית: ניסיון להניח CAT על ${activeRegion.shortHe} (אסור בהחלט!)`, 'bad');
      showToast(
        `⛔ אסור בהחלט להניח חוסם עורקים CAT על ${activeRegion.shortHe}! חוסם עורקים מיועד אך ורק לגפיים — כאן עוצרים אך ורק בלחץ ישיר ממוקד עם גזה סטרילית!`,
        'err',
        5600
      );
      return;
    }

    if (interventionsRef.current.catPlaced) {
      showToast('חוסם העורקים CAT מונח — השתמש בכפתורי הידוק המקל ורישום השעה.', 'info');
      return;
    }
    // Switch cleanly to Macro view so the user can place CAT anatomically on the limb!
    setCaseVisualMode('macro');
    const nextMode = !interventionsRef.current.catMode;
    syncInterventions((prev) => ({ ...prev, catMode: nextMode }));
    if (nextMode) {
      showToast(`🎯 לחץ על הגפה בתקריב 5–7 ס"מ מעל הפצע (מימין לפצע, לכיוון הלב) להנחת CAT!`, 'info', 4500);
    }
  };

  const handleAttemptCatPlacement = (fx, fy) => {
    if (fy < 160 || fy > 360 || fx < 110 || fx > 820) {
      showToast('לחץ ישירות על הגפה בציור כדי למקם את חוסם העורקים.', 'warn');
      return;
    }
    if (fx < 325) {
      metricsRef.current.catWrongAttempts += 1;
      addLog('ניסיון CAT שגוי: מתחת לפצע (דיסטלית)', 'bad');
      showToast('❌ שגיאה אנטומית! מיקמת מתחת לפצע — הדם העורקי מגיע מהלב (ימין), חובה להניח מעל הפצע!', 'err', 5000);
      return;
    }
    if (fx >= 325 && fx < 548) {
      metricsRef.current.catWrongAttempts += 1;
      addLog('ניסיון CAT שגוי: ישירות על הפצע', 'bad');
      showToast('❌ לא מניחים חוסם עורקים ישירות על הפצע! מקם 5–7 ס"מ מימין לפצע (פרוקסימלית).', 'err', 4600);
      return;
    }
    if (fx > 708) {
      metricsRef.current.catWrongAttempts += 1;
      addLog('ניסיון CAT שגוי: על מפרק', 'bad');
      showToast('❌ אסור להניח CAT על מפרק! עצמות המפרק מונעות דחיסת העורק. מקם על הגפה מעל הפצע.', 'err', 4800);
      return;
    }

    checkGloves('הנחת חוסם עורקים CAT');
    syncInterventions((prev) => ({
      ...prev,
      catMode: false,
      catPlaced: true,
      catX: Math.max(575, Math.min(665, fx)),
      catWindlassTurns: 0,
    }));
    if (!scenario.needsTourniquet) {
      addLog('הונח חוסם CAT במיקום תקין (הערה: בדימום ורידי לרוב די בלחץ ישיר והרמה)', 'warn');
      showToast('⚠️ מיקום אנטומי נכון — אך בדימום ורידי שאינו פורץ עדיף לעצור בלחץ ישיר ותחבושת אישית!', 'warn', 4800);
    } else {
      addLog(`הונח חוסם עורקים CAT במיקום פרוקסימלי תקין ב${activeRegion.shortHe}`, 'good');
      showToast('✅ מיקום מדויק! כעת הדק את מקל ההידוק עד עצירה מלאה (3/3) ורשום שעת הנחה.', 'ok', 4500);
    }
  };

  const handleAdjustWindlass = (delta) => {
    if (finished || !interventionsRef.current.catPlaced) return;
    const prevTurns = interventionsRef.current.catWindlassTurns;
    const nextTurns = Math.max(0, Math.min(3, prevTurns + delta));
    if (nextTurns === prevTurns) return;

    syncInterventions((prev) => ({ ...prev, catWindlassTurns: nextTurns }));

    if (delta > 0) {
      if (nextTurns === 1) {
        addLog('הידוק CAT — סיבוב 1/3 (~68 ממ"כ — דימום מוחלש חלקית)', 'info');
        showToast('סיבוב 1/3: הלחץ עדיין נמוך מלחץ הדם הסיסטולי — הדק עוד!', 'warn');
      } else if (nextTurns === 2) {
        addLog('הידוק CAT — סיבוב 2/3 (~118 ממ"כ — דליפה קלה בסיסטולה)', 'info');
        showToast('סיבוב 2/3: כמעט חסום! סובב סיבוב נוסף לעצירה מוחלטת.', 'warn');
      } else if (nextTurns === 3) {
        addLog('הידוק CAT — סיבוב 3/3 (~195 ממ"כ — חסימה עורקית מלאה!)', 'good');
        showToast('🛑 חסימה עורקית מלאה! העורק הפסיק לפעום והדימום נעצר. כעת רשום שעת הנחה!', 'ok', 4600);
      }
    } else {
      addLog(`שחרור חלקי של מקל ההידוק ל-${nextTurns}/3`, 'warn');
      if (nextTurns < 3 && scenario.hasArterial) {
        physiologyRef.current = disruptClotOnEvent(physiologyRef.current, 'שחרור CAT חידש דימום עורקי!');
        showToast('⚠️ זהירות! שחרור CAT חידש את הדימום העורקי הפורץ!', 'err', 4500);
      }
    }
  };

  const handleStampCatTime = () => {
    if (finished || !interventionsRef.current.catPlaced) return;
    const now = new Date();
    const stamp = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    syncInterventions((prev) => ({ ...prev, catTimeStamped: stamp }));
    addLog(`נרשמה שעת הנחת CAT על התווית: ${stamp}`, 'good');
    showToast(`🕒 שעת הנחה (${stamp}) נרשמה על תווית ה-CAT!`, 'ok');
  };

  const handleUseTriangle = () => {
    if (finished) return;
    if (!physiologyRef.current.bleedingStopped && physiologyRef.current.arterialRate + physiologyRef.current.venousRate > 2.4) {
      showToast('⚠️ עצור קודם את הדימום החיצוני הפעיל לפני קיבוע במשולש בד!', 'warn');
      return;
    }
    syncInterventions((prev) => ({ ...prev, triangleOn: true, elevated: true }));
    addLog(
      activeRegion.canUseTriangle
        ? 'הגפה העליונה קובעה במתלה משולש בד מוגבה (שלב E)'
        : 'משולש בד הונח לתמיכה וקיבוע חבישה (שלב E)',
      'good'
    );
    showToast('🔺 קיבוע במשולש בד בוצע בהצלחה!', 'ok');
  };

  const handleToggleDirectPressure = () => {
    if (finished) return;
    const nextVal = !interventionsRef.current.directPressureToggle;
    if (nextVal) {
      checkGloves('הפעלת לחץ ישיר');
      if (metricsRef.current.firstPressureTimeSec === null) {
        metricsRef.current.firstPressureTimeSec = physiologyRef.current.elapsedSec;
      }
      addLog('הופעל לחץ ישיר רציף על הפצע', 'good');
      showToast('✋ לחץ ישיר רציף פעיל! שמור עליו ללא הפסקה לבניית קריש פיברין יציב.', 'ok');
    } else {
      addLog('שוחרר לחץ ישיר ידני', interventionsRef.current.personalBandageOn || physiologyRef.current.bleedingStopped ? 'info' : 'warn');
    }
    syncInterventions((prev) => ({ ...prev, directPressureToggle: nextVal }));
  };

  const handleCanvasPressChange = (pressing) => {
    if (finished) return;
    if (pressing) {
      checkGloves('הפעלת לחץ ישיר על הפצע');
      if (metricsRef.current.firstPressureTimeSec === null) {
        metricsRef.current.firstPressureTimeSec = physiologyRef.current.elapsedSec;
      }
    }
    syncInterventions((prev) => ({ ...prev, canvasPressing: pressing }));
  };

  const handleToggleElevation = () => {
    if (finished) return;
    const nextElev = !interventionsRef.current.elevated;
    syncInterventions((prev) => ({ ...prev, elevated: nextElev }));
    addLog(
      nextElev
        ? activeRegion.isLimb
          ? 'הגפה הפצועה הורמה מעל גובה הלב'
          : 'הפצוע הושכב במנח הלם (הרמת רגליים קלה לשיפור החזר ורידי ללב)'
        : 'המנח הוחזר למצב אופקי',
      nextElev ? 'good' : 'info'
    );
    if (nextElev) {
      showToast(
        activeRegion.isLimb
          ? '⬆️ הגפה הורמה מעל גובה הלב — הלחץ ההידרוסטטי בוורידים ירד!'
          : '⬆️ הרמת רגליים קלה במנח הלם מסייעת לשמירת זרימת דם לאיברים חיוניים!',
        'ok'
      );
    }
  };

  const handleConfirmMdaCall = () => {
    setMdaModalOpen(false);
    if (mdaStateRef.current.called) return;
    const nextMda = {
      called: true,
      callTimeSec: physiologyRef.current.elapsedSec,
      etaSec: 110,
      arrived: false,
    };
    mdaStateRef.current = nextMda;
    setMdaState(nextMda);
    addLog('🚑 הוזעק מד"א 101 ונמסר דיווח מלא על מצב הפצוע', 'good');
    showToast('🚑 אמבולנס מד"א בדרך לזירה!', 'ok');
  };

  // Launch a specific body region's First Aid Case from the Anatomy Lab Tab or Full Body view
  const handleStartCaseForRegion = (regionId, explicitScenarioId = null) => {
    const targetSc = explicitScenarioId || BODY_REGIONS[regionId]?.defaultScenarioId || 'arterial_forearm';
    setActiveTab('cases');
    resetAll(mode, targetSc, gender);
  };

  // Smart Guided Learning Text
  let recommendedTool = null;
  let guidanceHtml = '';
  if (mode === 'learn') {
    if (!interventions.glovesOn) {
      recommendedTool = 'gloves';
      guidanceHtml = `<strong>שלב S (בטיחות — ${activeRegion.shortHe}):</strong> אבטח את הזירה בזירת ה-3D ולבש מיד <strong>כפפות חד-פעמיות</strong> לפני מגע בדם.`;
    } else if (!mdaState.called) {
      recommendedTool = 'mda';
      guidanceHtml = '<strong>שלב S (הזעקת עזרה):</strong> הפעל את דניאל (בכחול ב-3D) או לחץ על <strong>קריאה למד"א 101</strong> (ושלח את נועה להביא AED!).';
    } else if (interventions.gauzeLayers === 0) {
      recommendedTool = 'gauze';
      guidanceHtml = scenario.forbidsTourniquet
        ? `<strong>שלב C (${activeRegion.shortHe} — אסור CAT!):</strong> הנח מיד <strong>גזה סטרילית</strong> על הפצע — זכור שבאזור זה אסור חוסם עורקים!`
        : `<strong>שלב C (${activeRegion.shortHe}):</strong> הנח מיד <strong>גזה סטרילית</strong> ישירות על הפצע.`;
    } else if (!interventions.directPressureToggle && !interventions.canvasPressing && !interventions.personalBandageOn && !physiology.bleedingStopped) {
      recommendedTool = 'pressure';
      guidanceHtml = '<strong>שלב C (לחץ ישיר רציף):</strong> הפעל <strong>לחץ ישיר</strong> ושמור עליו ברציפות — צפה במד הקרישה (Coagulation) במוניטור!';
    } else if (scenario.needsTourniquet && !interventions.catPlaced) {
      recommendedTool = 'cat';
      guidanceHtml = `<strong>שלב C (חוסם עורקים CAT):</strong> הדימום העורקי ב${activeRegion.shortHe} חזק מדי ללחץ ישיר בלבד! בחר ב<strong>חוסם עורקים CAT</strong> והנח 5–7 ס"מ מעל הפצע.`;
    } else if (scenario.needsTourniquet && interventions.catWindlassTurns < 3) {
      guidanceHtml = '<strong>שלב C (הידוק מקל CAT):</strong> לחץ על <strong>"↻ הדק מקל"</strong> עד 3/3 לעצירה מוחלטת של התזת הדם!';
    } else if (scenario.needsTourniquet && !interventions.catTimeStamped) {
      guidanceHtml = '<strong>שלב C (רישום שעת הנחה):</strong> הדימום נעצר! לחץ על <strong>"🕒 רשום שעת הנחה"</strong> לתיעוד לצוות מד"א.';
    } else if (!scenario.needsTourniquet && !interventions.elevated) {
      recommendedTool = 'elevate';
      guidanceHtml = '<strong>שלב C (הרמה / מנח הלם):</strong> הפעל <strong>הרמת גפה</strong> להפחתת הלחץ הוורידי וחיזוק יציבות הקריש.';
    } else if (!interventions.personalBandageOn) {
      recommendedTool = 'bandage';
      guidanceHtml = '<strong>שלב C (תחבושת אישית):</strong> חבוש ב<strong>תחבושת אישית</strong> לקיבוע הלחץ ומניעת זיהום.';
    } else if (!interventions.triangleOn) {
      recommendedTool = 'triangle';
      guidanceHtml = '<strong>שלב D ו-E (הכרה וקיבוע):</strong> בדוק AVPU במוניטור, קבע ב<strong>משולש בד</strong> והמתן לפינוי מד"א.';
    } else {
      guidanceHtml = scenario.isInternalBleed
        ? '<strong>טיפול שטח הושלם — חשד לדימום פנימי!</strong> עקוב צמוד אחרי המדדים עד הגעת מד"א או עבור לתחקיר.'
        : '<strong>כל הכבוד! הטיפול הראשוני הושלם ✓</strong> עקוב אחר המדדים עד הגעת מד"א או לחץ על "סיים טיפול וקבל תחקיר רפואי".';
    }
  } else {
    guidanceHtml = `<strong>מצב תרגול עצמאי (${scenario.shortTitle}):</strong> פעל לפי פרוטוקול SABCDE, הפעל עוברי אורח ב-3D, ושמור על מנגנון הקרישה!`;
  }

  const patientQuote =
    physiology.avpu === 'A'
      ? physiology.bleedingStopped && !scenario.isInternalBleed
        ? '"תודה... אני מרגיש הרבה יותר רגוע עכשיו שהדימום נעצר."'
        : scenario.initialQuote
      : physiology.avpu === 'V'
      ? '"הראש מסתובב לי... נהיה לי קר וחשוך בעיניים..."'
      : physiology.avpu === 'P'
      ? '"...אחחח... (נאנח חלש למגע בלבד)"'
      : '(מחוסר הכרה — ללא תגובה! בדוק נשימה והכן AED!)';

  return (
    <div className="app-shell">
      {/* TOP BAR WITH SEPARATE MAIN TABS (FIRST AID CASES vs FULL-BODY ANATOMY) + MALE/FEMALE SELECTOR */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-logo"><Plus size={22} strokeWidth={3} /></div>
          <div>
            <div className="brand-title">סימולטור עזרה ראשונה ואנטומיה — מע"ר</div>
            <div className="brand-sub">גוף מלא (זכר ונקבה) • 8 מקרי חירום בכל הגוף • Three.js 3D</div>
          </div>
        </div>

        {/* PRIMARY 4-TAB NAVIGATION */}
        <nav className="primary-tabs" aria-label="ניווט ראשי">
          <button
            type="button"
            className={`primary-tab ${activeTab === 'cases' ? 'active' : ''}`}
            onClick={() => setActiveTab('cases')}
          >
            <Stethoscope size={15} />
            <span>טראומה ודימומים (8)</span>
          </button>
          <button
            type="button"
            className={`primary-tab abc-tab-btn ${activeTab === 'emergency' ? 'active' : ''}`}
            onClick={() => setActiveTab('emergency')}
          >
            <HeartPulse size={15} />
            <span>החייאה A-B-C ו-AED (5)</span>
          </button>
          <button
            type="button"
            className={`primary-tab phys-tab-btn ${activeTab === 'physiology' ? 'active' : ''}`}
            onClick={() => setActiveTab('physiology')}
          >
            <Microscope size={15} />
            <span>מיקרוסקופ ופיזיולוגיה</span>
          </button>
          <button
            type="button"
            className={`primary-tab atlas3d-tab-btn ${activeTab === 'atlas3d' ? 'active' : ''}`}
            onClick={() => setActiveTab('atlas3d')}
          >
            <Box size={15} />
            <span>אטלס 3D (360°) + CT/MRI</span>
          </button>
          <button
            type="button"
            className={`primary-tab anatomy-tab-btn ${activeTab === 'anatomy' ? 'active' : ''}`}
            onClick={() => setActiveTab('anatomy')}
          >
            <Dna size={15} />
            <span>אנטומיה 2D</span>
          </button>
        </nav>

        {/* GLOBAL GENDER + SIMULATION CONTROLS */}
        <div className="topbar-controls">
          <div className="segmented" title="בחר מין אנטומי של המודל">
            <button
              type="button"
              className={gender === 'male' ? 'active' : ''}
              onClick={() => handleChangeGender('male')}
            >
              👨 זכר
            </button>
            <button
              type="button"
              className={gender === 'female' ? 'active' : ''}
              onClick={() => handleChangeGender('female')}
            >
              👩 נקבה
            </button>
          </div>

          {activeTab === 'cases' && (
            <>
              <div className="segmented">
                <button
                  className={mode === 'learn' ? 'active' : ''}
                  onClick={() => resetAll('learn', scenarioId, gender)}
                >
                  <GraduationCap size={14} /> לימוד
                </button>
                <button
                  className={mode === 'practice' ? 'active-practice' : ''}
                  onClick={() => resetAll('practice', scenarioId, gender)}
                >
                  <Stethoscope size={14} /> תרגול
                </button>
              </div>

              <button className={`icon-btn ${paused ? 'active-toggle' : ''}`} onClick={() => setPaused((p) => !p)}>
                {paused ? <Play size={14} /> : <Pause size={14} />}
                {paused ? 'המשך' : 'השהה'}
              </button>

              <button
                className="icon-btn"
                onClick={() => {
                  const speeds = [0.5, 1.0, 2.0];
                  const idx = speeds.findIndex((s) => Math.abs(s - speed) < 0.25);
                  setSpeed(speeds[(idx + 1) % speeds.length]);
                }}
              >
                <Zap size={14} /> ×{speed}
              </button>

              <button className="icon-btn danger-btn" onClick={() => resetAll(mode, scenarioId, gender)}>
                <RotateCcw size={14} /> איפוס
              </button>
            </>
          )}
        </div>
      </header>

      {/* =========================================================
          ROUTING ACROSS THE 5 DEDICATED SIMULATOR TABS
          ========================================================= */}
      {activeTab === 'atlas3d' ? (
        <Anatomy3DAtlasTab
          gender={gender}
          onChangeGender={handleChangeGender}
          livePhysiology={physiology}
          onJumpToCase={(targetScId) => {
            const targetSc = SCENARIOS[targetScId] || SCENARIOS.arterial_forearm;
            handleStartCaseForRegion(targetSc.bodyRegionId || 'forearm', targetSc.id);
          }}
        />
      ) : activeTab === 'anatomy' ? (
        <AnatomyLabTab
          gender={gender}
          onChangeGender={handleChangeGender}
          bodyRegionId={anatomyRegionId}
          onSelectBodyRegion={setAnatomyRegionId}
          physiologyRef={physiologyRef}
          interventionsRef={interventionsRef}
          scenario={scenario}
          onOpenXRayModal={(layerId) => {
            setXrayLayerId(layerId || 'artery');
            setXrayOpen(true);
          }}
          onStartCaseForRegion={handleStartCaseForRegion}
        />
      ) : activeTab === 'emergency' ? (
        <EmergencyABCTab gender={gender} onChangeGender={handleChangeGender} />
      ) : activeTab === 'physiology' ? (
        <PhysiologyLabTab livePhysiology={physiology} gender={gender} />
      ) : (
        /* =========================================================
           TAB 1: FIRST AID CASES SIMULATOR (8 FULL-BODY SCENARIOS)
           ========================================================= */
        <>
          {/* CASE SELECTOR + GUIDANCE + PATIENT SPEECH BAR */}
          <section className="protocol-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <select
                className="scenario-select"
                value={scenarioId}
                onChange={(e) => resetAll(mode, e.target.value, gender)}
              >
                <optgroup label="גפיים עליונות (אמה / זרוע)">
                  <option value="arterial_forearm">{SCENARIOS.arterial_forearm.title}</option>
                  <option value="venous_forearm">{SCENARIOS.venous_forearm.title}</option>
                  <option value="brachial_upper_arm">{SCENARIOS.brachial_upper_arm.title}</option>
                </optgroup>
                <optgroup label="גפיים תחתונות (ירך / שוק)">
                  <option value="femoral_thigh">{SCENARIOS.femoral_thigh.title}</option>
                  <option value="tibial_lower_leg">{SCENARIOS.tibial_lower_leg.title}</option>
                </optgroup>
                <optgroup label="אזורים מרכזיים — צוואר, חזה ובטן (אסור CAT!)">
                  <option value="neck_carotid">{SCENARIOS.neck_carotid.title}</option>
                  <option value="chest_penetrating">{SCENARIOS.chest_penetrating.title}</option>
                  <option value="abdomen_internal">{SCENARIOS.abdomen_internal.title}</option>
                </optgroup>
              </select>
            </div>

            <div
              className={`guidance-box ${mode === 'practice' ? 'practice-mode' : ''}`}
              dangerouslySetInnerHTML={{ __html: `<div class="guidance-text">${guidanceHtml}</div>` }}
            />

            <div className="patient-bubble">
              <div className="patient-avatar">
                {physiology.avpu === 'A'
                  ? physiology.bleedingStopped && !scenario.isInternalBleed
                    ? '😌'
                    : '😰'
                  : physiology.avpu === 'V'
                  ? '😵‍💫'
                  : physiology.avpu === 'P'
                  ? '😖'
                  : '🚨'}
              </div>
              <div className="patient-quote">{patientQuote}</div>
            </div>
          </section>

          {/* 3-COLUMN FIRST AID DASHBOARD */}
          <main className="workspace">
            {/* RIGHT COLUMN: ME'AR TOOLKIT & SABCDE */}
            <ToolboxAndProtocol
              mode={mode}
              scenario={scenario}
              physiology={physiology}
              interventions={interventions}
              bystanders={bystanders}
              mdaState={mdaState}
              recommendedTool={recommendedTool}
              onUseGloves={handleUseGloves}
              onUseGauze={handleUseGauze}
              onRemoveGauzeAttempt={handleRemoveGauzeAttempt}
              onUsePersonalBandage={handleUsePersonalBandage}
              onSelectCat={handleSelectCat}
              onAdjustWindlass={handleAdjustWindlass}
              onStampCatTime={handleStampCatTime}
              onUseTriangle={handleUseTriangle}
              onToggleDirectPressure={handleToggleDirectPressure}
              onToggleElevation={handleToggleElevation}
              onOpenMdaModal={() => {
                if (mdaState.called) {
                  showToast(`🚑 מד"א כבר בדרך! הגעה משוערת: ${formatClock(mdaState.etaSec)}`, 'info');
                } else {
                  setMdaModalOpen(true);
                }
              }}
              onOpenDebrief={() => {
                finishedRef.current = true;
                setFinished(true);
                setDebriefOpen(true);
              }}
              onInspectProtocolStep={(step) =>
                showToast(`${step.key} (${step.en}) — ${step.title}: ${step.desc}`, 'info', 4800)
              }
            />

            {/* CENTER COLUMN: 3D SCENE + FULL-BODY / MACRO WOUND VIEW SWITCHER */}
            <section className="stage-column">
              <Scene3DViewport
                gender={gender}
                bodyRegionId={activeRegionId}
                physiologyRef={physiologyRef}
                interventionsRef={interventionsRef}
                bystanders={bystanders}
                onActivateBystander={handleActivateBystander}
                expanded={scene3DExpanded}
                onToggleExpand={() => setScene3DExpanded((e) => !e)}
              />

              {/* Visual Switch Bar: Realistic Full Body (Male/Female) vs 10-Layer Macro Wound Cutaway */}
              <div className="case-visual-tabs">
                <button
                  type="button"
                  className={`case-vtab ${caseVisualMode === 'fullbody' ? 'active' : ''}`}
                  onClick={() => setCaseVisualMode('fullbody')}
                >
                  <User size={15} /> תצוגת גוף מלא ריאליסטית ({gender === 'male' ? 'זכר' : 'נקבה'}) — מיקום הפציעה
                </button>
                <button
                  type="button"
                  className={`case-vtab ${caseVisualMode === 'macro' ? 'active' : ''}`}
                  onClick={() => setCaseVisualMode('macro')}
                >
                  <ZoomIn size={15} /> תקריב פצע 10 שכבות והנחת ציוד ({activeRegion.shortHe})
                </button>
                <button
                  type="button"
                  className="case-vtab xray-pill-btn"
                  onClick={() => setSampleModalOpen(true)}
                >
                  <MessageSquare size={15} /> תשאול SAMPLE
                </button>
                <button
                  type="button"
                  className="case-vtab xray-pill-btn"
                  onClick={() => {
                    setXrayLayerId(selectedLayerId || 'artery');
                    setXrayOpen(true);
                  }}
                >
                  <Scan size={15} /> סורק X-Ray
                </button>
              </div>

              {caseVisualMode === 'fullbody' ? (
                <FullBodyAnatomyView
                  gender={gender}
                  onChangeGender={handleChangeGender}
                  bodyRegionId={activeRegionId}
                  onSelectBodyRegion={(regId) => handleStartCaseForRegion(regId)}
                  physiologyRef={physiologyRef}
                  interventionsRef={interventionsRef}
                  scenario={scenario}
                  onSwitchToMacro={() => setCaseVisualMode('macro')}
                  onOpenXRay={(lId) => {
                    setXrayLayerId(lId || 'artery');
                    setXrayOpen(true);
                  }}
                />
              ) : (
                <AnatomyMacroView
                  gender={gender}
                  bodyRegionId={activeRegionId}
                  physiologyRef={physiologyRef}
                  interventionsRef={interventionsRef}
                  interventions={interventions}
                  scenario={scenario}
                  mode={mode}
                  selectedLayerId={selectedLayerId}
                  onSelectLayer={setSelectedLayerId}
                  onOpenXRay={(lId) => {
                    setXrayLayerId(lId || 'artery');
                    setXrayOpen(true);
                  }}
                  onSwitchToFullBody={() => setCaseVisualMode('fullbody')}
                  onCanvasPressChange={handleCanvasPressChange}
                  onAttemptCatPlacement={handleAttemptCatPlacement}
                  onAdjustWindlass={handleAdjustWindlass}
                  onStampCatTime={handleStampCatTime}
                  toast={null}
                />
              )}
            </section>

            {/* LEFT COLUMN: LIVE MEDICAL MONITOR */}
            <MedicalMonitor
              physiologyRef={physiologyRef}
              physiology={physiology}
              eventLog={eventLog}
            />
          </main>
        </>
      )}

      {/* GLOBAL CLINICAL FEEDBACK & SAFETY WARNING TOAST (Always visible across all views!) */}
      {toast && (
        <div className={`global-toast toast-${toast.kind || 'info'}`} role="alert">
          {toast.text}
        </div>
      )}

      {/* TRAUMA INTERACTIVE SAMPLE PATIENT INTERVIEW MODAL */}
      {sampleModalOpen && (
        <div className="modal-backdrop open" onClick={() => setSampleModalOpen(false)}>
          <div className="modal-box" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <strong style={{ color: '#7dd3fc', display: 'flex', alignItems: 'center', gap: 7 }}>
                <MessageSquare size={17} /> תשאול פצוע אינטראקטיבי — SAMPLE ({scenario.shortTitle})
              </strong>
              <button className="icon-btn" onClick={() => setSampleModalOpen(false)}><X size={15} /> סגור</button>
            </div>
            <div className="modal-content">
              <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                לחץ על כל אות בסכמת <strong>SAMPLE</strong> כדי לתשאל את הפצוע, לגלות מדללי דם/אלרגיות/מנגנון ולקרוא העמקה מדעית:
              </p>
              {SAMPLE_QUESTIONS.map((q) => {
                const asked = !!traumaSampleAsked[q.key];
                const answers = TRAUMA_SAMPLE_ANSWERS[scenarioId] || TRAUMA_SAMPLE_ANSWERS.default;
                const reply =
                  physiology.avpu === 'U'
                    ? '(הפצוע מחוסר הכרה — אינו מסוגל לענות! שאל עוברי אורח או חפש צמיד רפואי.)'
                    : answers[q.key];
                return (
                  <div key={q.key} className={`sample-card ${asked ? 'asked' : ''}`}>
                    <button
                      type="button"
                      className="sample-ask-btn"
                      onClick={() => setTraumaSampleAsked((prev) => ({ ...prev, [q.key]: true }))}
                    >
                      <span className="sample-badge">{q.key}</span>
                      <div style={{ flex: 1, textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>{q.label}</div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{q.prompt}</div>
                      </div>
                    </button>
                    {asked && (
                      <div className="sample-answer-wrap">
                        <div className="sample-reply">{reply}</div>
                        <DeepDiveBox title="למה שואלים את זה" simpleText={q.whySimple} deepText={q.whyDeep} compact />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MDA 101 DISPATCH MODAL */}
      {mdaModalOpen && (
        <div className="modal-backdrop open" onClick={() => setMdaModalOpen(false)}>
          <div className="modal-box" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <strong style={{ color: '#fca5a5', display: 'flex', alignItems: 'center', gap: 7 }}>
                <PhoneCall size={17} /> מוקד חירום מד"א — 101
              </strong>
              <button className="icon-btn" onClick={() => setMdaModalOpen(false)}><X size={15} /></button>
            </div>
            <div className="modal-content">
              <p style={{ fontSize: '0.86rem', color: '#cbd5e1' }}>
                "שלום, מוקד מד"א 101. מסור פרטי אירוע להזנקת ניידת טיפול נמרץ:"
              </p>
              <div className="mda-summary-box">
                <div>📍 <strong>פצוע/ה:</strong> {gender === 'male' ? 'גבר' : 'אישה'} — {activeRegion.nameHe}</div>
                <div>🚗 <strong>מנגנון:</strong> {scenario.mechanism}</div>
                <div>🩸 <strong>מאפיינים:</strong> {scenario.bleedSummary}</div>
                <div>🧠 <strong>הכרה (AVPU):</strong> {getAvpuDisplay(physiology.avpu)}</div>
              </div>
              <div className="modal-actions">
                <button className="icon-btn" onClick={() => setMdaModalOpen(false)}>ביטול</button>
                <button
                  className="primary-btn"
                  style={{ background: 'linear-gradient(135deg,#dc2626,#991b1b)' }}
                  onClick={handleConfirmMdaCall}
                >
                  📞 אשר הזנקת אמבולנס 101
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FULL-BODY MALE & FEMALE ANATOMY X-RAY MODAL */}
      <AnatomyXRayModal
        isOpen={xrayOpen}
        initialLayerId={xrayLayerId}
        gender={gender}
        onChangeGender={handleChangeGender}
        onClose={() => setXrayOpen(false)}
        currentHr={physiology.hr}
        currentRr={physiology.rr}
      />

      {/* COMPREHENSIVE MEDICAL DEBRIEFING REPORT */}
      <DebriefingReport
        isOpen={debriefOpen}
        isCriticalFailure={criticalFail}
        mode={mode}
        scenario={scenario}
        physiology={physiology}
        interventions={interventions}
        bystanders={bystanders}
        mdaState={mdaState}
        metrics={metricsRef.current}
        eventLog={eventLog}
        onClose={() => setDebriefOpen(false)}
        onRetry={() => resetAll(mode, scenarioId, gender)}
        onSwitchScenario={(nextSc) => resetAll(mode, nextSc, gender)}
        onSwitchToLearn={() => resetAll('learn', scenarioId, gender)}
      />
    </div>
  );
}
