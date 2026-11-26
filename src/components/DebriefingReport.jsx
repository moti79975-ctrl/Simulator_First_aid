import React from 'react';
import { X, Award, RotateCcw, BookOpen, RefreshCw, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { getAvpuDisplay } from '../engines/PhysiologyEngine';

function formatClock(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * src/components/DebriefingReport.jsx
 * דוח תחקיר רפואי מעמיק בסיום התרחיש:
 * - ציון משוקלל (0–100) + הערכה מקצועית
 * - גרף SVG מגמת דופק ואיבוד דם לאורך ציר הזמן
 * - פירוט ביצועים: בטיחות זירה ועוברי אורח (3D), כפפות, לחץ ישיר וקרישת דם, CAT, חבישה וקיבוע
 * - חוקי זהב למע"ר וציר זמן אירועים מלא
 */
export default function DebriefingReport({
  isOpen,
  isCriticalFailure,
  mode,
  scenario,
  physiology,
  interventions,
  bystanders,
  mdaState,
  metrics,
  eventLog,
  onClose,
  onRetry,
  onSwitchScenario,
  onSwitchToLearn,
}) {
  if (!isOpen) return null;

  const lossMl = Math.round(physiology.bloodLostMl);
  const lossPct = physiology.bloodLossPct.toFixed(1);
  const stopped = physiology.bleedingStopped;

  // Build Clinical Evaluation Checklist (Total = 100 pts)
  const checks = [];
  let score = 0;

  // 1. Gloves / BSI (14 pts)
  if (interventions.glovesOn && !metrics.touchedBloodWithoutGloves) {
    score += 14;
    checks.push({
      status: 'pass',
      title: 'S — בטיחות המטפל (כפפות חד-פעמיות)',
      detail: 'הולבשו כפפות לפני כל מגע בדם — עמידה מלאה בכללי BSI והגנה ממזהמים.',
    });
  } else if (interventions.glovesOn) {
    score += 6;
    checks.push({
      status: 'partial',
      title: 'S — בטיחות המטפל (כפפות מאוחרות)',
      detail: 'הלבשת כפפות רק לאחר שכבר באת במגע עם דם. זכור: כפפות לפני כל מגע בפצוע!',
    });
  } else {
    checks.push({
      status: 'fail',
      title: 'S — חסרות כפפות חד-פעמיות',
      detail: 'בוצע טיפול ללא כפפות! קיימת סכנת הדבקה במחלות המועברות בדם.',
    });
  }

  // 2. Scene Management & 3D Bystanders + MDA 101 (16 pts)
  const bystanderCount = [bystanders.caller101, bystanders.aedRunner, bystanders.crowdController].filter(Boolean).length;
  let scenePts = 0;
  if (mdaState.called) scenePts += mdaState.callTimeSec <= 35 ? 10 : 7;
  if (bystanders.crowdController) scenePts += 3;
  if (bystanders.aedRunner) scenePts += 3;
  score += scenePts;

  if (scenePts >= 14) {
    checks.push({
      status: 'pass',
      title: 'ניהול זירה (3D), עוברי אורח והזעקת מד"א 101',
      detail: `מד"א הוזעק בזמן (${Math.round(mdaState.callTimeSec || 0)} שנ') והופעלו ${bystanderCount}/3 עוברי אורח (אבטחת זירה, 101, AED). ניהול אירוע למופת!`,
    });
  } else if (mdaState.called) {
    checks.push({
      status: 'partial',
      title: 'ניהול זירה והזעקת מד"א 101',
      detail: `מד"א הוזעק, אך הופעלו רק ${bystanderCount}/3 עוברי אורח בזירת התאונה. הפעלת סובבים להרחקת סקרנים והבאת AED משפרת דרמטית את סיכויי ההישרדות.`,
    });
  } else {
    checks.push({
      status: 'fail',
      title: 'לא הוזעק מד"א 101',
      detail: 'חובה להזעיק 101 מוקדם ככל האפשר (בעצמך או באמצעות הפעלת עובר האורח בזירה התלת-ממדית).',
    });
  }

  // 3. Direct Pressure, Sterile Gauze & Coagulation Preservation (22 pts)
  const hadClotPenalty = physiology.clotDisruptions > 0 || metrics.gauzeRemovedErrors > 0;
  if (interventions.gauzeLayers > 0 && metrics.firstPressureTimeSec !== null && !hadClotPenalty) {
    score += 22;
    checks.push({
      status: 'pass',
      title: 'C — גזה סטרילית, לחץ ישיר ושמירה על מנגנון הקרישה',
      detail: `הונחו ${interventions.gauzeLayers} שכבות גזה והופעל לחץ ישיר רציף ללא שחרור מוקדם או הסרת גזה ספוגה (קריש סופי: ${Math.round(physiology.clotProgress)}%).`,
    });
  } else if (interventions.gauzeLayers > 0 || metrics.firstPressureTimeSec !== null) {
    score += hadClotPenalty ? 10 : 14;
    checks.push({
      status: 'partial',
      title: 'C — לחץ ישיר ומנגנון קרישת הדם (Coagulation)',
      detail: hadClotPenalty
        ? `שים לב: קריש הדם נהרס ${physiology.clotDisruptions} פעמים עקב שחרור לחץ מוקדם או הסרת גזה! שחרור לחץ לפני התייצבות רשת הפיברין קורע את הקריש ומחדש דימום.`
        : 'יש לשלב מיד גזה סטרילית עם לחץ ישיר יציב ורציף.',
    });
  } else {
    checks.push({
      status: 'fail',
      title: 'C — לא הופעל לחץ ישיר עם גזה סטרילית',
      detail: 'לחץ ישיר על גזה סטרילית הוא קו ההגנה הראשון והמהיר ביותר בכל דימום חיצוני.',
    });
  }

  // 4. Hemorrhage Control Decision (CAT vs Non-Limb Safety vs Venous Pressure Dressing) (28 pts)
  if (scenario.forbidsTourniquet) {
    if (metrics.catForbiddenAttempts > 0) {
      score += stopped ? 14 : 6;
      checks.push({
        status: 'fail',
        title: 'C — בטיחות חוסם עורקים באזור צוואר/חזה/בטן (אסור CAT!)',
        detail: `נרשמו ${metrics.catForbiddenAttempts} ניסיונות להניח חוסם עורקים CAT באזור גוו/צוואר! לעולם אין להניח CAT מחוץ לגפיים — רק לחץ ישיר ממוקד עם גזה סטרילית ופינוי דחוף 101.`,
      });
    } else if (stopped || (scenario.isInternalBleed && interventions.personalBandageOn && mdaState.called)) {
      score += 28;
      checks.push({
        status: 'pass',
        title: 'C — טיפול נכון ובטוח באזור צוואר/חזה/בטן (ללא CAT)',
        detail: scenario.isInternalBleed
          ? 'זיהית נכון שאין להניח CAT בחבלת בטן, חבשת סטרילית והזעקת מד"א 101 דחוף לדימום הפנימי!'
          : 'עצרת את הדימום באמצעות גזה סטרילית ולחץ ישיר ממוקד ונמנעת לחלוטין מהנחת CAT אסורה!',
      });
    } else {
      score += 12;
      checks.push({
        status: 'partial',
        title: 'C — טיפול באזור צוואר/חזה/בטן',
        detail: 'נמנעת משימוש ב-CAT (נכון!), אך נדרש לחץ ישיר רציף יותר עם גזה ותחבושת אישית לצד פינוי דחוף.',
      });
    }
  } else if (scenario.needsTourniquet) {
    if (interventions.catPlaced && interventions.catWindlassTurns === 3 && interventions.catTimeStamped) {
      score += 28;
      checks.push({
        status: 'pass',
        title: 'C — חוסם עורקים CAT בדימום עורקי פורץ',
        detail: `הונח פרוקסימלית (5–7 ס"מ מעל הפצע), הודק ל-3/3 עד עצירה מלאה ונרשמה שעת הנחה (${interventions.catTimeStamped}).`,
      });
    } else if (interventions.catPlaced && interventions.catWindlassTurns === 3) {
      score += 22;
      checks.push({
        status: 'partial',
        title: 'C — חוסם עורקים CAT (חסרה שעת הנחה)',
        detail: 'החוסם עצר את הדימום העורקי היטב, אך חובה לרשום את שעת ההנחה על התווית הלבנה לצוות חדר הניתוח!',
      });
    } else if (interventions.catPlaced) {
      score += 10;
      checks.push({
        status: 'fail',
        title: 'C — חוסם עורקים CAT לא הודק עד הסוף',
        detail: `מקל ההידוק סובב רק ל-${interventions.catWindlassTurns}/3 ולכן העורק המשיך לדמם.`,
      });
    } else {
      checks.push({
        status: 'fail',
        title: 'C — חסר חוסם עורקים CAT בדימום עורקי פורץ',
        detail: 'בדימום עורקי בלתי נשלט בגפה, לחץ ישיר מאט אך אינו עוצר לחלוטין — נדרש CAT מעל הפצע!',
      });
    }
  } else {
    // Venous scenario
    if (stopped && !interventions.catPlaced && interventions.personalBandageOn) {
      score += 28;
      checks.push({
        status: 'pass',
        title: 'C — טיפול מדויק בדימום ורידי (ללא CAT מיותר)',
        detail: 'הצלחת לעצור את הדימום הוורידי בעזרת לחץ ישיר, קרישת דם, הרמת גפה ותחבושת אישית — ונמנעת משימוש מיותר בחוסם עורקים!',
      });
    } else if (stopped && interventions.catPlaced) {
      score += 18;
      checks.push({
        status: 'partial',
        title: 'C — עצירת דימום ורידי (שימוש יתר ב-CAT)',
        detail: 'הדימום נעצר, אך בדימום ורידי שאינו פורץ — לחץ ישיר רציף + הרמת גפה + תחבושת אישית הם הטיפול הנכון לפני CAT.',
      });
    } else if (stopped) {
      score += 20;
      checks.push({
        status: 'partial',
        title: 'C — עצירת דימום ורידי',
        detail: 'הדימום נעצר, אך מומלץ לחבוש בתחבושת אישית לקיבוע הלחץ לאורך הפינוי.',
      });
    } else {
      checks.push({
        status: 'fail',
        title: 'C — הדימום הוורידי לא נעצר',
        detail: 'שמור על לחץ ישיר רציף עם גזה (ללא שחרור מוקדם כדי לאפשר קרישה), הרם את הגפה וחבוש בתחבושת אישית.',
      });
    }
  }

  // 5. Dressing, Elevation & Immobilization (10 pts)
  let supp = 0;
  if (interventions.elevated) supp += 3;
  if (interventions.personalBandageOn) supp += 4;
  if (interventions.triangleOn) supp += 3;
  score += supp;
  checks.push({
    status: supp >= 8 ? 'pass' : supp >= 4 ? 'partial' : 'fail',
    title: 'E — תחבושת אישית, הרמת גפה וקיבוע במשולש בד',
    detail:
      supp >= 8
        ? 'בוצעו כיסוי סטרילי בתחבושת אישית, הגבהת הגפה וקיבוע מנוחה במשולש בד.'
        : 'חלק מהשלבים המשלימים (תחבושת אישית / הרמת גפה / משולש בד) חסרים להשלמת פרוטוקול E.',
  });

  // 6. Final Hemodynamic Preservation (10 pts)
  if (!isCriticalFailure && stopped && physiology.bloodLostMl < 800) {
    score += 10;
    checks.push({
      status: 'pass',
      title: 'תוצאה המודינמית — מניעת הלם מתקדם',
      detail: `איבוד הדם הוגבל ל-${lossMl} מ"ל (${lossPct}%) — הפצוע נותר בהכרה מלאה (${physiology.avpu}) ויציב!`,
    });
  } else if (!isCriticalFailure && stopped && physiology.bloodLostMl < 1550) {
    score += 6;
    checks.push({
      status: 'partial',
      title: 'תוצאה המודינמית — הלם מפוצה/בינוני',
      detail: `הפצוע איבד ${lossMl} מ"ל (${lossPct}%) אך יוצב לפני הידרדרות בלתי-הפיכה.`,
    });
  } else {
    checks.push({
      status: 'fail',
      title: 'תוצאה המודינמית — איבוד דם מסוכן / הלם לא-מפוצה',
      detail: `איבוד הדם הגיע ל-${lossMl} מ"ל (${lossPct}%), סטורציה ${Math.round(physiology.spo2)}%, מצב הכרה ${getAvpuDisplay(physiology.avpu)}.`,
    });
  }

  if (metrics.catWrongAttempts > 0) {
    score = Math.max(0, score - Math.min(8, metrics.catWrongAttempts * 4));
    checks.push({
      status: 'partial',
      title: 'דיוק אנטומי בהנחת חוסם CAT',
      detail: `בוצעו ${metrics.catWrongAttempts} ניסיונות מיקום שגויים לפני הנחה תקינה (חובה 5–7 ס"מ מעל הפצע, לא על מפרק ולא מתחת לפצע).`,
    });
  }

  // Build SVG Dual Trend Chart from physiology.history
  const hist = physiology.history || [];
  const maxT = Math.max(10, hist[hist.length - 1]?.t || 10);
  const chartW = 620;
  const chartH = 115;

  const toPath = (getter, maxVal) =>
    hist
      .map((pt, i) => {
        const x = 32 + (pt.t / maxT) * (chartW - 52);
        const y = chartH - 18 - (Math.min(maxVal, getter(pt)) / maxVal) * (chartH - 32);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

  const hrPath = toPath((p) => p.hr, 175);
  const sbpPath = toPath((p) => p.sbp, 175);
  const lossPath = toPath((p) => p.bloodLostMl, 2600);

  const ringClass = score >= 82 ? '' : score >= 55 ? 'mid' : 'low';
  const verdict = isCriticalFailure
    ? '❌ הפצוע קרס מהלם היפוולמי — תרגל שוב את מהירות עצירת הדימום'
    : score >= 88
    ? '🏆 ביצוע מע"ר מצטיין!'
    : score >= 68
    ? '✅ ביצוע טוב — שים לב להערות לשיפור'
    : '⚠️ נדרש תרגול נוסף בפרוטוקול SABCDE ועצירת דימומים';

  return (
    <div className="modal-backdrop open" onClick={onClose}>
      <div className="modal-box debrief-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <Award size={20} className="text-sky" />
            <strong style={{ fontSize: '1.05rem' }}>דוח תחקיר רפואי מעמיק — סיכום סימולציית מע"ר</strong>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={15} /> סגור</button>
        </div>

        <div className="modal-content">
          {/* Score Hero */}
          <div className="debrief-hero">
            <div className={`score-ring ${ringClass}`}>
              <div className="score-num">{score}</div>
              <div className="score-sub">מתוך 100</div>
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: '1.08rem', fontWeight: 800, marginBottom: 4 }}>{verdict}</div>
              <div style={{ fontSize: '0.83rem', color: '#cbd5e1' }}>
                <strong>{scenario.title}</strong> • מצב: {mode === 'learn' ? 'לימוד מונחה' : 'תרגול עצמאי'}
              </div>
              <div style={{ fontSize: '0.79rem', color: '#94a3b8', marginTop: 4 }}>
                {stopped
                  ? `הדימום נעצר לאחר ${formatClock(physiology.bleedingStoppedAtSec || physiology.elapsedSec)} • מצב המודינמי: ${physiology.compensationState}`
                  : 'הדימום לא נעצר במלואו לפני סיום התרחיש.'}
              </div>
            </div>
          </div>

          {/* 5 Summary KPI Metrics */}
          <div className="debrief-metrics">
            <div className="d-metric">
              <div className="d-metric-label">איבוד דם סופי</div>
              <div className="d-metric-val" style={{ color: lossMl > 1200 ? '#fca5a5' : '#6ee7b7' }}>
                {lossMl} מ"ל ({lossPct}%)
              </div>
            </div>
            <div className="d-metric">
              <div className="d-metric-label">דופק / לחץ דם</div>
              <div className="d-metric-val">{Math.round(physiology.hr)} / {Math.round(physiology.sbp)}/{Math.round(physiology.dbp)}</div>
            </div>
            <div className="d-metric">
              <div className="d-metric-label">סטורציה SpO₂</div>
              <div className="d-metric-val" style={{ color: '#60a5fa' }}>{Math.round(physiology.spo2)}%</div>
            </div>
            <div className="d-metric">
              <div className="d-metric-label">הכרה (AVPU)</div>
              <div className="d-metric-val">{physiology.avpu} (GCS {physiology.gcs})</div>
            </div>
          </div>

          {/* Physiological Trend SVG Graph */}
          {hist.length > 2 && (
            <div className="debrief-chart-box">
              <div className="debrief-chart-head">
                <strong>📈 מגמת מדדים פיזיולוגיים לאורך האירוע</strong>
                <div className="chart-legend">
                  <span style={{ color: '#34d399' }}>━ דופק (HR)</span>
                  <span style={{ color: '#f472b6' }}>━ לחץ דם סיסטולי (SBP)</span>
                  <span style={{ color: '#ef4444' }}>━ איבוד דם (מ"ל)</span>
                </div>
              </div>
              <svg viewBox={`0 0 ${chartW} ${chartH}`} width="100%" style={{ background: '#070d1b', borderRadius: 8 }}>
                <line x1="32" y1={chartH - 18} x2={chartW - 20} y2={chartH - 18} stroke="rgba(148,163,184,0.25)" />
                <line x1="32" y1="14" x2="32" y2={chartH - 18} stroke="rgba(148,163,184,0.25)" />
                <path d={lossPath} fill="none" stroke="#ef4444" strokeWidth="2.2" opacity="0.85" />
                <path d={sbpPath} fill="none" stroke="#f472b6" strokeWidth="2.2" />
                <path d={hrPath} fill="none" stroke="#34d399" strokeWidth="2.4" />
                <text x="38" y={chartH - 5} fill="#64748b" fontSize="9.5">00:00</text>
                <text x={chartW - 55} y={chartH - 5} fill="#64748b" fontSize="9.5">{formatClock(maxT)}</text>
              </svg>
            </div>
          )}

          {/* SABCDE & Clinical Breakdown */}
          <div>
            <div style={{ fontSize: '0.86rem', fontWeight: 800, marginBottom: 8, color: '#7dd3fc' }}>
              🔍 ניתוח קליני מפורט לפי פרוטוקול SABCDE
            </div>
            <div className="check-list">
              {checks.map((c, i) => (
                <div key={i} className={`check-row ${c.status}`}>
                  <div className="check-icon">
                    {c.status === 'pass' ? (
                      <CheckCircle2 size={18} color="#10b981" />
                    ) : c.status === 'partial' ? (
                      <AlertTriangle size={18} color="#f59e0b" />
                    ) : (
                      <XCircle size={18} color="#ef4444" />
                    )}
                  </div>
                  <div>
                    <strong>{c.title}</strong>
                    <div className="check-detail">{c.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Golden Rules */}
          <div className="golden-rules">
            <strong style={{ color: '#7dd3fc' }}>💡 עקרונות מפתח למע"ר שכדאי לקחת מהתרגול:</strong>
            <ul>
              <li><strong>הלם מפוצה מול לא-מפוצה:</strong> הדופק והנשימה מטפסים הרבה לפני שלחץ הדם צונח. ירידת לחץ דם סיסטולי היא כבר שלב מאוחר ומסוכן!</li>
              <li><strong>שמירה על קריש הדם:</strong> לעולם לא מציצים/משחררים לחץ ישיר מוקדם מדי ולא מסירים גזה ספוגה — זה קורע את רשת הפיברין ומחדש דימום.</li>
              <li><strong>עבודת צוות בזירה (3D):</strong> הפעל עוברי אורח סביבך להתקשר 101, להביא AED ולהרחיק סקרנים כדי שתישאר ממוקד בעצירת הדימום.</li>
              <li><strong>חוסם עורקים CAT:</strong> לדימום עורקי פורץ בגפה — 5–7 ס"מ מעל הפצע (פרוקסימלית), לא על מפרק, הידוק מלא עד עצירה ורישום שעת הנחה!</li>
            </ul>
          </div>

          {/* Action Timeline */}
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', marginBottom: 5 }}>
              ⏱️ ציר זמן פעולות (12 האירועים האחרונים)
            </div>
            <div className="event-log" style={{ maxHeight: 130 }}>
              {eventLog.slice(0, 12).map((item, idx) => (
                <div key={idx} className={`log-item ${item.severity}`}>
                  <span className="log-time">[{item.time}]</span>
                  <span>{item.message}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="modal-actions">
            <button className="icon-btn" onClick={onSwitchToLearn}>
              <BookOpen size={14} /> חזור למצב לימוד
            </button>
            <button
              className="icon-btn"
              onClick={() => onSwitchScenario(scenario.id === 'arterial_forearm' ? 'femoral_thigh' : 'arterial_forearm')}
            >
              <RefreshCw size={14} /> נסה תרחיש {scenario.id === 'arterial_forearm' ? 'ירך פמורלי' : 'אמה עורקי'}
            </button>
            <button className="primary-btn" onClick={onRetry}>
              <RotateCcw size={14} /> תרגל שוב
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
