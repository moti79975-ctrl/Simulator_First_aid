/**
 * src/engines/PhysiologyEngine.js
 * מנוע פיזיולוגי-מתמטי בזמן אמת המחשב:
 * - נפח דם, איבוד דם ושלבי הלם היפוולמי (Compensated vs Decompensated Shock)
 * - לחץ דם סיסטולי/דיאסטולי, MAP, Pulse Pressure ו-Shock Index
 * - דופק מפצה (Compensatory Tachycardia), קצב נשימה, סטורציה (SpO2) ו-AVPU
 * - מנגנון קרישת דם (Coagulation) שמתקדם תחת לחץ ישיר רציף ונהרס בשחרור מוקדם מדי
 * - גלי אק"ג (ECG), פלת' (Pleth) וגל לחץ עורקי סיסטולי
 */

export const TOTAL_BLOOD_VOLUME_ML = 5000;
export const CAT_OCCLUSION_MMHG = [0, 68, 118, 195];

export function createInitialPhysiology(scenario, gender = 'male') {
  const totalVol = gender === 'female' ? 4500 : TOTAL_BLOOD_VOLUME_ML;
  const initialBleed =
    (scenario?.baseArterialRate || 0) +
    (scenario?.baseVenousRate || 0) +
    (scenario?.internalBleedRate || 0);
  const respPen = scenario?.respiratoryCompromise || 0;
  return {
    elapsedSec: 0,
    totalBloodVolumeMl: totalVol,
    bloodLostMl: 0,
    bloodVolumeMl: totalVol,
    bloodLossPct: 0,

    // Live bleeding flow rates (mL/sec)
    arterialRate: scenario?.baseArterialRate || 0,
    venousRate: scenario?.baseVenousRate || 0,
    internalRate: scenario?.internalBleedRate || 0,
    totalBleedRate: initialBleed,
    bleedSurgeSec: 0,

    // Core Hemodynamic Vitals
    hr: 76,
    rr: Math.round(15 + respPen * 10),
    sbp: 122,
    dbp: 78,
    map: 93,
    pulsePressure: 44,
    shockIndex: 0.62,
    spo2: Math.round(99 - respPen * 7),
    tempC: 36.8,
    avpu: 'A',
    gcs: 15,

    // Shock classification & Perfusion
    shockClass: 0, // 0=Normal, 1..4=ATLS Classes I-IV
    compensationState: 'תקין (הומאוסטזיס)',
    isDecompensated: false,
    vasoconstriction: 0, // 0..1 sympathetic tone
    capillaryRefillSec: 1.5,
    skinSigns: 'חם, ורוד ויבש',

    // Coagulation Model (Primary platelet plug -> Secondary fibrin mesh)
    clotProgress: 0, // 0..100
    clotStage: 'ללא קריש פעיל',
    clotStable: false,
    clotDisruptions: 0,
    lastClotWarning: null,
    continuousPressureSec: 0,

    // Dressing & Wound visual dynamics
    gauzeSaturation: 0, // 0..1
    woundPoolLevel: 0.25,
    pulsePhase: 0, // continuous beat counter

    // Outcome flags
    bleedingStopped: false,
    bleedingStoppedAtSec: null,
    collapsed: false,

    // Time-series history for Debrief chart (sampled every 2s)
    lastSampleSec: 0,
    history: [{ t: 0, hr: 76, sbp: 122, spo2: 99, bloodLostMl: 0 }],
  };
}

/**
 * מדרגת זרימת לחץ עורקי (0..1): עלייה חדה בסיסטולה, שקע דיקרוטי, דעיכה דיאסטולית
 */
export function computeArterialWave(phase) {
  const p = ((phase % 1) + 1) % 1;
  if (p < 0.15) {
    return Math.sin((p / 0.15) * Math.PI * 0.5);
  }
  if (p < 0.34) {
    const t = (p - 0.15) / 0.19;
    return 1.0 - 0.52 * Math.sin(t * Math.PI * 0.5);
  }
  if (p < 0.47) {
    const t = (p - 0.34) / 0.13;
    return 0.48 + 0.12 * Math.sin(t * Math.PI);
  }
  const t = (p - 0.47) / 0.53;
  return 0.48 * Math.pow(1 - t, 1.55);
}

/**
 * מחולל אות אק"ג (ECG Lead II) ריאליסטי לפי פאזת פעימה ודרגת הלם
 */
export function computeEcgSample(phase, shockClass = 0) {
  const p = ((phase % 1) + 1) % 1;
  let v = 0;
  // P wave
  if (p > 0.06 && p < 0.15) {
    v = 0.15 * Math.sin(((p - 0.06) / 0.09) * Math.PI);
  }
  // Q dip
  else if (p >= 0.19 && p < 0.22) {
    v = -0.17 * ((p - 0.19) / 0.03);
  }
  // R spike
  else if (p >= 0.22 && p < 0.255) {
    const t = (p - 0.22) / 0.035;
    v = -0.17 + 1.22 * Math.sin(t * Math.PI);
  }
  // S dip
  else if (p >= 0.255 && p < 0.29) {
    const t = (p - 0.255) / 0.035;
    v = -0.27 * Math.sin(t * Math.PI);
  }
  // Subtle ST depression in severe myocardial hypoxia (Shock Class III-IV)
  else if (p >= 0.29 && p < 0.42 && shockClass >= 3) {
    v = -0.09;
  }
  // T wave
  else if (p >= 0.42 && p < 0.61) {
    v = 0.26 * Math.sin(((p - 0.42) / 0.19) * Math.PI);
  }
  return v + (Math.random() - 0.5) * 0.02;
}

/**
 * מחולל גל דופק פלת'יזמוגרף (SpO2 Pleth) — משרעתו נחלשת בכיווץ כלי דם ובהלם!
 */
export function computePlethSample(phase, vasoconstriction = 0, spo2 = 99) {
  // Slight physiological delay (~0.18 cycle) behind ECG R-wave
  const p = (((phase - 0.18) % 1) + 1) % 1;
  const wave = computeArterialWave(p);
  const perfusionAmp = Math.max(0.18, 1.0 - vasoconstriction * 0.65 - Math.max(0, 95 - spo2) * 0.02);
  return wave * perfusionAmp;
}

/**
 * הרס קריש יזום כאשר המשתמש מסיר גזה ספוגה או משחרר לחץ מוקדם מדי
 */
export function disruptClotOnEvent(phys, reason) {
  const next = { ...phys };
  if (next.clotProgress > 10) {
    next.clotProgress = Math.max(0, next.clotProgress * 0.18);
    next.clotStable = false;
    next.clotStage = getClotStageLabel(next.clotProgress);
    next.clotDisruptions = (next.clotDisruptions || 0) + 1;
    next.bleedSurgeSec = 3.2;
    next.continuousPressureSec = 0;
    next.lastClotWarning = reason;
  }
  return next;
}

function getClotStageLabel(progress) {
  if (progress < 12) return 'ללא קריש פעיל';
  if (progress < 42) return 'היצמדות טסיות (פקק ראשוני פגיע)';
  if (progress < 85) return 'רשת פיברין צעירה (שביר — אל תשחרר לחץ!)';
  return 'קריש פיברין יציב ✓';
}

/**
 * צעד סימולציה מתמטי מלא בזמן אמת (dt בשניות סימולציה, dtReal בשניות אמת לגרפיקה/החלקה)
 */
export function stepPhysiology(prev, interventions, scenario, dtSim, dtReal) {
  const events = [];
  const next = { ...prev };

  next.elapsedSec += dtSim;
  if (next.bleedSurgeSec > 0) {
    next.bleedSurgeSec = Math.max(0, next.bleedSurgeSec - dtSim);
  }

  const hasDirectPressure = interventions.pressureStrength > 0.35;
  const hasFirmCompression = hasDirectPressure || interventions.personalBandageOn;
  const catOcclusion = interventions.catPlaced ? CAT_OCCLUSION_MMHG[interventions.catWindlassTurns] : 0;

  // -----------------------------------------------------------
  // 1. PREMATURE PRESSURE RELEASE -> CLOT DESTRUCTION CHECK
  // -----------------------------------------------------------
  const prevWasPressing = prev.continuousPressureSec > 1.2;
  const catFullyBlocked = catOcclusion >= prev.sbp + 18;
  if (
    prevWasPressing &&
    !hasFirmCompression &&
    !catFullyBlocked &&
    prev.clotProgress >= 14 &&
    prev.clotProgress < 85
  ) {
    next.clotProgress = Math.max(0, prev.clotProgress * 0.2);
    next.clotStable = false;
    next.clotDisruptions = prev.clotDisruptions + 1;
    next.bleedSurgeSec = 3.5;
    next.continuousPressureSec = 0;
    const msg =
      '⚠️ קריש הדם נהרס! שחררת את הלחץ הישיר מוקדם מדי לפני שרשת הפיברין התייצבה — זרם הדם קרע את הקריש והדימום התגבר מחדש!';
    next.lastClotWarning = msg;
    events.push({ type: 'clot_destroyed', severity: 'bad', message: msg });
  }

  // Track continuous unbroken pressure duration
  if (hasFirmCompression) {
    next.continuousPressureSec = prev.continuousPressureSec + dtSim;
  } else {
    next.continuousPressureSec = 0;
  }

  // -----------------------------------------------------------
  // 2. HEMODYNAMIC BLEEDING RATES (Arterial & Venous)
  // -----------------------------------------------------------
  const bpFactor = Math.max(0.32, prev.sbp / 122);
  const surgeMultiplier = next.bleedSurgeSec > 0 ? 1.38 : 1.0;

  // --- Arterial flow ---
  let artRate = 0;
  if (scenario.hasArterial) {
    artRate = scenario.baseArterialRate * bpFactor * surgeMultiplier;

    if (catOcclusion > 0) {
      if (catOcclusion >= prev.sbp + 16) {
        artRate = 0;
      } else {
        const remain = Math.max(0, 1 - catOcclusion / (prev.sbp + 16));
        artRate *= Math.pow(remain, 1.35);
      }
    }

    if (artRate > 0) {
      let damp = 1.0;
      const gauzeBonus = interventions.gauzeLayers > 0 ? 0.08 + Math.min(3, interventions.gauzeLayers) * 0.04 : 0;
      if (interventions.pressureStrength > 0.05) {
        damp *= 1 - interventions.pressureStrength * (0.64 + gauzeBonus);
      }
      if (interventions.personalBandageOn) {
        damp *= interventions.pressureStrength > 0.4 ? 0.78 : 0.44;
      }
      if (interventions.elevated) damp *= 0.9;
      artRate *= damp;
      // Partial arterial clot resistance (cannot fully overcome high systolic pressure alone)
      artRate *= 1 - Math.min(0.28, (next.clotProgress / 100) * 0.35);
    }
  }

  // --- Venous flow ---
  let venRate = 0;
  if (scenario.hasVenous) {
    venRate = scenario.baseVenousRate * bpFactor * surgeMultiplier;

    if (catOcclusion >= 115) {
      venRate = 0;
    } else {
      if (interventions.elevated) {
        // Hydrostatic pressure drop above heart level strongly slows venous bleeding
        venRate *= 0.6;
      }
      if (interventions.pressureStrength > 0.05) {
        const gauzeBoost = interventions.gauzeLayers > 0 ? 0.86 : 0.68;
        venRate *= 1 - interventions.pressureStrength * gauzeBoost;
      }
      if (interventions.personalBandageOn) {
        venRate *= 0.16;
      }
      // Coagulation progressively seals venous tear!
      venRate *= Math.max(0, 1 - Math.pow(next.clotProgress / 100, 1.15));
      if (next.clotStable && (hasFirmCompression || interventions.elevated)) {
        venRate = 0;
      }
    }
  }

  // -----------------------------------------------------------
  // 3. COAGULATION CASCADE PROGRESSION
  // -----------------------------------------------------------
  const localShearFlow = artRate + venRate;
  const hypothermiaPenalty = next.tempC < 36.0 ? 0.65 : 1.0; // Lethal triad: hypothermia impairs clotting!
  const gauzeSurfaceFactor = interventions.gauzeLayers > 0 ? 1.25 : 0.75; // Gauze fibers act as fibrin scaffold!

  if (catFullyBlocked) {
    // No active shear -> clot consolidates smoothly
    next.clotProgress = Math.min(100, next.clotProgress + dtSim * 9.5 * hypothermiaPenalty);
  } else if (hasFirmCompression && localShearFlow < 2.8) {
    // Ideal low-shear clotting window under continuous direct pressure
    const buildSpeed = (interventions.elevated ? 8.2 : 6.4) * gauzeSurfaceFactor * hypothermiaPenalty;
    next.clotProgress = Math.min(100, next.clotProgress + dtSim * buildSpeed);
  } else if (hasFirmCompression && scenario.hasArterial && localShearFlow >= 2.8) {
    // High systolic arterial shear limits clot formation to fragile partial plug (~38%)
    next.clotProgress = Math.min(38, next.clotProgress + dtSim * 3.0 * gauzeSurfaceFactor);
  } else if (!hasFirmCompression && localShearFlow > 2.0 && !next.clotStable) {
    // Uncontrolled flow washes away clotting factors
    next.clotProgress = Math.max(0, next.clotProgress - dtSim * 5.5);
  }

  next.clotStable = next.clotProgress >= 85;
  next.clotStage = getClotStageLabel(next.clotProgress);

  if (next.clotStable && !prev.clotStable) {
    events.push({
      type: 'clot_stable',
      severity: 'good',
      message: '🧬 נוצר קריש פיברין יציב! המשך לחבוש ולקבע את הגפה לשמירה על הקריש.',
    });
  }

  // Re-apply stable clot effect immediately
  if (next.clotStable && !scenario.hasArterial) {
    venRate = 0;
  }

  // Internal bleeding (e.g. blunt abdominal trauma) cannot be stopped externally by gauze/CAT — slowed slightly by supine rest & elevation!
  let internalRate = 0;
  if (scenario.isInternalBleed && scenario.internalBleedRate) {
    internalRate = scenario.internalBleedRate * bpFactor * (interventions.elevated ? 0.78 : 1.0);
  }

  next.arterialRate = Math.max(0, artRate);
  next.venousRate = Math.max(0, venRate);
  next.internalRate = Math.max(0, internalRate);
  next.totalBleedRate = next.arterialRate + next.venousRate + next.internalRate;

  // -----------------------------------------------------------
  // 4. BLOOD LOSS & GAUZE SATURATION
  // -----------------------------------------------------------
  const tbv = prev.totalBloodVolumeMl || TOTAL_BLOOD_VOLUME_ML;
  next.bloodLostMl = Math.min(tbv * 0.54, prev.bloodLostMl + next.totalBleedRate * dtSim);
  next.bloodVolumeMl = Math.max(0, tbv - next.bloodLostMl);
  next.bloodLossPct = (next.bloodLostMl / tbv) * 100;

  const externalStoppedNow = next.arterialRate + next.venousRate < 0.32;
  const isStoppedNow = scenario.isInternalBleed ? externalStoppedNow && interventions.personalBandageOn : next.totalBleedRate < 0.32;
  if (isStoppedNow && !prev.bleedingStopped && next.elapsedSec > 1.2) {
    next.bleedingStopped = true;
    if (next.bleedingStoppedAtSec === null) next.bleedingStoppedAtSec = next.elapsedSec;
    events.push({
      type: 'bleeding_stopped',
      severity: 'good',
      message: '✅ הדימום הפעיל נעצר בהצלחה! המשך בחבישה, קיבוע ומעקב מדדים.',
    });
  } else if (!isStoppedNow) {
    next.bleedingStopped = false;
  }

  // Gauze saturation soak progression
  if (interventions.gauzeLayers > 0 && next.totalBleedRate > 0.35) {
    const soakDelta = (next.totalBleedRate / (16 * interventions.gauzeLayers)) * dtSim;
    next.gauzeSaturation = Math.min(1, prev.gauzeSaturation + soakDelta);
    if (prev.gauzeSaturation < 0.82 && next.gauzeSaturation >= 0.82) {
      events.push({
        type: 'gauze_soaked',
        severity: 'warn',
        message: '🩸 הגזה נספגה בדם! כלל מע"ר: לעולם אל תסיר גזה ספוגה — הוסף שכבה נוספת מעליה או שקול CAT בדימום עורקי.',
      });
    }
  } else if (interventions.gauzeLayers === 0) {
    next.gauzeSaturation = 0;
  }

  // Wound cavity liquid level
  const targetPool = isStoppedNow ? 0.22 : Math.min(1, 0.32 + next.totalBleedRate / 18);
  next.woundPoolLevel += (targetPool - prev.woundPoolLevel) * Math.min(1, dtReal * 1.6);

  // -----------------------------------------------------------
  // 5. COMPENSATED vs DECOMPENSATED SHOCK HEMODYNAMICS (ATLS I-IV)
  // -----------------------------------------------------------
  const lossPct = next.bloodLossPct;
  const calmBonus = isStoppedNow ? 1 : 0;

  let targetHR, targetRR, targetSBP, targetDBP, targetSpO2, targetVasoconstriction, targetCapRefill;
  let shockClass, compState, isDecomp, newAvpu, newGcs, skinSigns;

  if (lossPct < 15) {
    // Class I (0-15%): Fully Compensated
    const t = lossPct / 15;
    shockClass = lossPct < 5 ? 0 : 1;
    compState = lossPct < 5 ? 'תקין (הומאוסטזיס)' : 'הלם שלב I — מפוצה (Compensated)';
    isDecomp = false;
    targetHR = 76 + t * 23 - calmBonus * 4;
    targetRR = 15 + t * 4 - calmBonus * 1;
    targetSBP = 122 - t * 3; // Preserved by sympathetic vasoconstriction!
    targetDBP = 78 + t * 3; // Diastolic slightly rises -> Narrowing Pulse Pressure!
    targetSpO2 = 99 - t * 1;
    targetVasoconstriction = 0.1 + t * 0.25;
    targetCapRefill = 1.5 + t * 0.5;
    newAvpu = 'A';
    newGcs = 15;
    skinSigns = lossPct < 8 ? 'חם, ורוד ויבש' : 'קריר קלות, חיוור מעט';
  } else if (lossPct < 30) {
    // Class II (15-30%): Late Compensated -> Borderline Decompensation
    const t = (lossPct - 15) / 15;
    shockClass = 2;
    compState = t < 0.65 ? 'הלם שלב II — מפוצה (פיצוי מרבי)' : 'הלם שלב II — גבול פיצוי!';
    isDecomp = t >= 0.75;
    targetHR = 99 + t * 25 - calmBonus * 5;
    targetRR = 19 + t * 8 - calmBonus * 1.5;
    targetSBP = 119 - t * 17; // Starts slipping below 110 near 25-30%
    targetDBP = 81 - t * 9;
    targetSpO2 = 98 - t * 4;
    targetVasoconstriction = 0.35 + t * 0.35;
    targetCapRefill = 2.0 + t * 1.2;
    newAvpu = lossPct < 22 ? 'A' : 'V';
    newGcs = lossPct < 22 ? 14 : 12;
    skinSigns = 'חיוור, קר ולח (זיעה קרה)';
  } else if (lossPct < 40) {
    // Class III (30-40%): Decompensated Hypovolemic Shock!
    const t = (lossPct - 30) / 10;
    shockClass = 3;
    compState = 'הלם שלב III — לא מפוצה (Decompensated!)';
    isDecomp = true;
    targetHR = 124 + t * 22 - calmBonus * 4;
    targetRR = 27 + t * 9 - calmBonus * 1.5;
    targetSBP = 102 - t * 26; // Classic hypotension drop (<90 mmHg)
    targetDBP = 72 - t * 22;
    targetSpO2 = 94 - t * 6;
    targetVasoconstriction = 0.7 + t * 0.2;
    targetCapRefill = 3.2 + t * 1.1;
    newAvpu = 'P';
    newGcs = 8;
    skinSigns = 'חיוור מאוד, קר ומזיע (כחלון היקפי)';
  } else {
    // Class IV (>40%): Severe Critical Shock / Pre-terminal Collapse
    const t = Math.min(1, (lossPct - 40) / 12);
    shockClass = 4;
    compState = 'הלם שלב IV — קריסה המודינמית (סכנת חיים!)';
    isDecomp = true;
    // Extreme tachycardia then pre-terminal bradycardia above 47%
    targetHR = t < 0.6 ? 146 + t * 22 : 159 - (t - 0.6) * 140;
    targetRR = 36 + t * 6;
    targetSBP = 76 - t * 30;
    targetDBP = 50 - t * 22;
    targetSpO2 = 88 - t * 10;
    targetVasoconstriction = 0.9 + t * 0.08;
    targetCapRefill = 4.3 + t * 1.5;
    newAvpu = 'U';
    newGcs = 3;
    skinSigns = 'אפרפר-כחלחל, קר מאוד ודביק';
  }

  // Apply chest/neck respiratory compromise modifier (improved partially when chest wound is sealed with gauze/bandage!)
  const respPen = scenario.respiratoryCompromise || 0;
  if (respPen > 0) {
    const sealedFactor = interventions.gauzeLayers > 0 || interventions.personalBandageOn ? 0.45 : 1.0;
    targetRR += respPen * 11 * sealedFactor;
    targetSpO2 = Math.max(76, targetSpO2 - respPen * 11 * sealedFactor);
  }

  // Smooth vitals update
  const smooth = Math.min(1, dtReal * 1.45);
  next.hr = prev.hr + (targetHR - prev.hr) * smooth;
  next.rr = prev.rr + (targetRR - prev.rr) * smooth;
  next.sbp = prev.sbp + (targetSBP - prev.sbp) * smooth;
  next.dbp = prev.dbp + (targetDBP - prev.dbp) * smooth;
  next.spo2 = prev.spo2 + (targetSpO2 - prev.spo2) * smooth;
  next.vasoconstriction = prev.vasoconstriction + (targetVasoconstriction - prev.vasoconstriction) * smooth;
  next.capillaryRefillSec = prev.capillaryRefillSec + (targetCapRefill - prev.capillaryRefillSec) * smooth;
  // Gentle hypothermia drift during shock (Exposure / E in SABCDE)
  const targetTemp = 36.8 - (lossPct / 50) * 1.6;
  next.tempC = prev.tempC + (targetTemp - prev.tempC) * Math.min(1, dtSim * 0.04);

  next.map = Math.round(next.dbp + (next.sbp - next.dbp) / 3);
  next.pulsePressure = Math.max(10, Math.round(next.sbp - next.dbp));
  next.shockIndex = Number((next.hr / Math.max(40, next.sbp)).toFixed(2));
  next.shockClass = shockClass;
  next.compensationState = compState;
  next.isDecompensated = isDecomp;
  next.skinSigns = skinSigns;
  next.gcs = newGcs;

  if (newAvpu !== prev.avpu) {
    const rank = { A: 0, V: 1, P: 2, U: 3 };
    const worsened = rank[newAvpu] > rank[prev.avpu];
    next.avpu = newAvpu;
    events.push({
      type: 'avpu_change',
      severity: worsened ? 'bad' : 'good',
      message: `🧠 שינוי ברמת ההכרה (AVPU): ${getAvpuDisplay(newAvpu)}`,
    });
  } else {
    next.avpu = newAvpu;
  }

  if (isDecomp && !prev.isDecompensated) {
    events.push({
      type: 'decompensated_shock',
      severity: 'bad',
      message: '🚨 מעבר להלם לא-מפוצה (Decompensated Shock)! לחץ הדם צונח — סכנת חיים מיידית!',
    });
  }

  // Advance pulse beat counter
  next.pulsePhase = prev.pulsePhase + Math.max(0.45, next.hr / 60) * dtReal;

  // Record history point every 2 simulated seconds
  if (next.elapsedSec - prev.lastSampleSec >= 2.0) {
    next.lastSampleSec = next.elapsedSec;
    next.history = [
      ...prev.history.slice(-120),
      {
        t: Math.round(next.elapsedSec),
        hr: Math.round(next.hr),
        sbp: Math.round(next.sbp),
        spo2: Math.round(next.spo2),
        bloodLostMl: Math.round(next.bloodLostMl),
      },
    ];
  }

  // Critical exsanguination check (>= 50% blood loss)
  if (next.bloodLossPct >= 50 && !prev.collapsed) {
    next.collapsed = true;
    events.push({
      type: 'collapsed',
      severity: 'bad',
      message: '❌ הפצוע קרס עקב איבוד מעל 50% מנפח הדם (הלם היפוולמי בלתי-הפיך).',
    });
  }

  return { physiology: next, events };
}

export function getAvpuDisplay(avpu) {
  switch (avpu) {
    case 'A':
      return 'A — ערני ומדבר (Alert)';
    case 'V':
      return 'V — מגיב לקול בלבד (Voice)';
    case 'P':
      return 'P — מגיב לכאב בלבד (Pain)';
    case 'U':
      return 'U — מחוסר הכרה (Unresponsive)';
    default:
      return avpu;
  }
}

/**
 * מחולל הסברי "למה זה קורה?" בזמן אמת לכל מדד פיזיולוגי
 */
export function generateVitalExplanations(phys) {
  const hr = Math.round(phys.hr);
  const rr = Math.round(phys.rr);
  const sbp = Math.round(phys.sbp);
  const spo2 = Math.round(phys.spo2);

  // HR
  let hrWhy;
  if (hr < 96) {
    hrWhy = phys.bleedingStopped
      ? 'הדימום נעצר והלב שומר על קצב סינוס תקין (60–100).'
      : 'הדופק עדיין בטווח התקין, אך עולה בהדרגה בעקבות שחרור אדרנלין וירידת נפח הדם.';
  } else if (hr < 124) {
    hrWhy =
      'טכיקרדיה מפצה (Compensated Shock): קולטני הלחץ מזהים ירידת נפח דם והלב פועם מהר יותר כדי לשמר תפוקת לב למוח.';
  } else if (phys.bloodLossPct < 47) {
    hrWhy =
      'טכיקרדיה קיצונית (דופק מהיר וחוטי)! הלב מתאמץ למקסימום למרות שחדרי הלב מתמלאים פחות בכל פעימה.';
  } else {
    hrWhy =
      'ברדיקרדיה טרמינלית! שריר הלב סובל מהיפוקסיה קשה ועומד לפני דום לב — נדרש פינוי והחייאה מיידיים!';
  }

  // RR
  let rrWhy;
  if (rr <= 20) {
    rrWhy = 'קצב נשימה תקין במבוגר (12–20 נשימות/דקה) — מאזן חמצן ו-CO₂ שמור.';
  } else if (rr <= 28) {
    rrWhy =
      'טכיפנאה (נשימה מהירה): איבוד תאי דם אדומים מפחית את הובלת החמצן, ולכן מרכז הנשימה במוח מאיץ את קצב הריאות.';
  } else {
    rrWhy =
      'נשימה מהירה ושטחית מאוד — ניסיון נואש לפצות על חמצת מטבולית ומחסור חמור בחמצן ברקמות (הלם מתקדם).';
  }

  // BP
  let bpWhy;
  if (sbp >= 112 && phys.bloodLossPct > 8) {
    bpWhy = `הלם מפוצה! כיווץ כלי דם היקפיים שומר על לחץ דם סיסטולי כביכול "תקין", אך הפרש הדופק הצטמצם ל-${phys.pulsePressure} ממ"כ — אל תוטעה!`;
  } else if (sbp >= 112) {
    bpWhy = 'לחץ דם תקין — נפח הדם בתוך כלי הדם מבטיח זילוח מיטבי למוח, ללב ולכליות.';
  } else if (sbp >= 95) {
    bpWhy = `מנגנוני הפיצוי קרובים למיצוי! לחץ הדם יורד ומדד ההלם (Shock Index) עלה ל-${phys.shockIndex} (תקין < 0.7).`;
  } else {
    bpWhy =
      'הלם לא מפוצה (Decompensated Shock)! נפח הדם ירד מתחת לסף הקריטי וכיווץ כלי הדם כבר אינו מצליח לשמור על לחץ דם תקין.';
  }

  // SpO2
  let spo2Why;
  if (spo2 >= 96) {
    spo2Why = 'ריווי החמצן בדם תקין (96%–100%). גל הפלת\' מראה זילוח היקפי טוב באצבע.';
  } else if (spo2 >= 91) {
    spo2Why =
      'ירידה הדרגתית ב-SpO₂ ובגובה גל הפלת\': כיווץ כלי דם היקפיים מקטין את זרימת הדם לאצבעות ומפחית אספקת חמצן.';
  } else {
    spo2Why =
      'היפוקסמיה חמורה (<90%) ותת-זילוח היקפי קשה! הרקמות והמוח אינם מקבלים מספיק חמצן.';
  }

  // AVPU
  let avpuWhy;
  if (phys.avpu === 'A') {
    avpuWhy = 'זילוח המוח תקין כרגע — הפצוע ערני ומדבר (מה שמאשר במקביל שנתיב האוויר A והנשימה B פתוחים).';
  } else if (phys.avpu === 'V') {
    avpuWhy = 'היפוקסיה מוחית קלה-בינונית: פחות דם מגיע למוח ולכן מופיעים סחרחורת, בלבול ותגובה לקול בלבד.';
  } else if (phys.avpu === 'P') {
    avpuWhy = 'תת-זילוח מוחי חמור! הפצוע שקוע ומגיב רק לגירוי כאב — סכנה מיידית לאובדן הכרה ונתיב אוויר.';
  } else {
    avpuWhy = 'חוסר הכרה מלא עקב הלם עמוק! סכנת חסימת נתיב אוויר ודום לב — בדוק נשימה והכן דפיברילטור AED!';
  }

  // Coagulation
  let clotWhy;
  if (phys.clotStable) {
    clotWhy = 'רשת הפיברין התייצבה ואטמה את הקרע בכלי הדם. שמור על תחבושת אישית וקיבוע למניעת פתיחה מחדש.';
  } else if (phys.clotProgress >= 14) {
    clotWhy =
      'טסיות דם וסיבי פיברין בונים קריש תחת הלחץ הישיר — שמור על לחץ רציף! שחרור מוקדם יקרע את הקריש.';
  } else if (phys.clotDisruptions > 0) {
    clotWhy = `קריש הדם נהרס (${phys.clotDisruptions} פעמים) עקב שחרור לחץ/הסרת גזה מוקדמת. חדש לחץ רציף ללא הפרעה!`;
  } else {
    clotWhy = 'זרם הדם המהיר שוטף את גורמי הקרישה — נדרש לחץ ישיר רציף עם גזה (או CAT בדימום עורקי) ליצירת קריש.';
  }

  return { hrWhy, rrWhy, bpWhy, spo2Why, avpuWhy, clotWhy };
}
