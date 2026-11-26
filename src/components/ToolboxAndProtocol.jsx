import React from 'react';
import {
  ShieldCheck,
  Layers,
  Bandage,
  Lock,
  Triangle,
  Hand,
  ArrowUpCircle,
  PhoneCall,
  ClipboardCheck,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { SABCDE_STEPS } from '../data/anatomyDatabase';
import { CAT_OCCLUSION_MMHG } from '../engines/PhysiologyEngine';

function formatClock(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * src/components/ToolboxAndProtocol.jsx
 * ארגז כלים ייעודי לרמת מע"ר בלבד + מעקב אינטראקטיבי אחר פרוטוקול SABCDE
 */
export default function ToolboxAndProtocol({
  mode,
  scenario,
  physiology,
  interventions,
  bystanders,
  mdaState,
  recommendedTool,
  onUseGloves,
  onUseGauze,
  onRemoveGauzeAttempt,
  onUsePersonalBandage,
  onSelectCat,
  onAdjustWindlass,
  onStampCatTime,
  onUseTriangle,
  onToggleDirectPressure,
  onToggleElevation,
  onOpenMdaModal,
  onOpenDebrief,
  onInspectProtocolStep,
}) {
  const isDirectActive = interventions.directPressureToggle || interventions.canvasPressing;
  const catPressure = CAT_OCCLUSION_MMHG[interventions.catWindlassTurns] || 0;

  // Evaluate SABCDE visual completion statuses for the side checklist
  const stepDone = {
    S: interventions.glovesOn && (bystanders.crowdController || mdaState.called),
    A: physiology.avpu === 'A' || physiology.elapsedSec > 8,
    B: physiology.elapsedSec > 8,
    C: physiology.bleedingStopped && (!scenario.needsTourniquet || !!interventions.catTimeStamped),
    D: physiology.bleedingStopped && interventions.personalBandageOn,
    E: interventions.triangleOn && interventions.elevated,
  };

  return (
    <aside className="panel toolkit-panel">
      <div className="panel-header">
        <div className="panel-title">🧰 ארגז כלים — מע"ר</div>
        <span className={`panel-badge ${mdaState.called ? 'mda-active' : ''}`}>
          {mdaState.arrived
            ? '🚑 מד"א הגיע ✓'
            : mdaState.called
            ? `🚑 מד"א ${formatClock(mdaState.etaSec)}`
            : 'מד"א לא הוזעק'}
        </span>
      </div>

      <div className="toolkit-body">
        {/* Equipment Section (Strict Me'ar 5 Items) */}
        <div>
          <div className="tool-section-label">
            <span>ציוד מע"ר בסיסי</span>
            <span>5 פריטים</span>
          </div>

          <div className="tool-list">
            {/* 1. Gloves */}
            <button
              type="button"
              className={`tool-btn ${interventions.glovesOn ? 'active' : ''} ${
                mode === 'learn' && recommendedTool === 'gloves' ? 'recommended' : ''
              }`}
              onClick={onUseGloves}
            >
              <div className="tool-icon text-sky"><ShieldCheck size={19} /></div>
              <div className="tool-info">
                <div className="tool-name">
                  <span>כפפות חד-פעמיות</span>
                  {interventions.glovesOn && <span className="tool-status">הולבש ✓</span>}
                </div>
                <div className="tool-desc">בטיחות המטפל (S) לפני מגע בנוזלי גוף</div>
              </div>
            </button>

            {/* 2. Sterile Gauze (+ optional Educational Trap: Remove Soaked Gauze) */}
            <div className="tool-compound">
              <button
                type="button"
                className={`tool-btn ${interventions.gauzeLayers > 0 ? 'active' : ''} ${
                  mode === 'learn' && recommendedTool === 'gauze' ? 'recommended' : ''
                }`}
                onClick={onUseGauze}
              >
                <div className="tool-icon" style={{ color: '#f8fafc' }}><Layers size={19} /></div>
                <div className="tool-info">
                  <div className="tool-name">
                    <span>גזה סטרילית</span>
                    {interventions.gauzeLayers > 0 && (
                      <span className={`tool-status ${physiology.gauzeSaturation > 0.8 ? 'warn' : ''}`}>
                        {physiology.gauzeSaturation > 0.8
                          ? `ספוגה! (${interventions.gauzeLayers})`
                          : `${interventions.gauzeLayers} שכבות`}
                      </span>
                    )}
                  </div>
                  <div className="tool-desc">הנח על הפצע — ניתן להוסיף שכבות מעל ספוגה</div>
                </div>
              </button>

              {interventions.gauzeLayers > 0 && !interventions.personalBandageOn && (
                <button
                  type="button"
                  className="gauze-remove-subbtn"
                  onClick={onRemoveGauzeAttempt}
                  title="בדיקת החלטה: האם להסיר גזה ספוגה?"
                >
                  <Trash2 size={12} /> הסר גזה קיימת (זהירות: הורס קריש!)
                </button>
              )}
            </div>

            {/* 3. Personal Field Bandage */}
            <button
              type="button"
              className={`tool-btn ${interventions.personalBandageOn ? 'active' : ''} ${
                mode === 'learn' && recommendedTool === 'bandage' ? 'recommended' : ''
              }`}
              onClick={onUsePersonalBandage}
            >
              <div className="tool-icon" style={{ color: '#a3b18a' }}><Bandage size={19} /></div>
              <div className="tool-info">
                <div className="tool-name">
                  <span>תחבושת אישית</span>
                  {interventions.personalBandageOn && <span className="tool-status">נחבש ✓</span>}
                </div>
                <div className="tool-desc">חבישת לחץ קבועה וכיסוי סטרילי</div>
              </div>
            </button>

            {/* 4. CAT Tourniquet with Inline Windlass & Timestamp Controls */}
            <div className="tool-compound">
              <button
                type="button"
                className={`tool-btn ${
                  interventions.catPlaced && interventions.catWindlassTurns === 3 ? 'active' : ''
                } ${interventions.catMode ? 'selected-mode' : ''} ${
                  mode === 'learn' && recommendedTool === 'cat' ? 'recommended' : ''
                }`}
                onClick={onSelectCat}
              >
                <div className="tool-icon" style={{ color: '#f59e0b' }}><Lock size={19} /></div>
                <div className="tool-info">
                  <div className="tool-name">
                    <span>חוסם עורקים CAT</span>
                    {interventions.catPlaced && (
                      <span className={`tool-status ${interventions.catWindlassTurns < 3 || !interventions.catTimeStamped ? 'warn' : ''}`}>
                        {interventions.catWindlassTurns === 3
                          ? interventions.catTimeStamped
                            ? `${interventions.catTimeStamped} ✓`
                            : 'רשום שעה!'
                          : `הידוק ${interventions.catWindlassTurns}/3`}
                      </span>
                    )}
                  </div>
                  <div className="tool-desc">לדימום פורץ בגפה — 5–7 ס"מ מעל הפצע</div>
                </div>
              </button>

              {interventions.catPlaced && (
                <div className="cat-inline-panel">
                  <div className="cat-inline-meta">
                    <span>לחץ חסימה: <strong>~{catPressure} ממ"כ</strong></span>
                    <span>סיבוב מקל: <strong>{interventions.catWindlassTurns}/3</strong></span>
                  </div>
                  <div className="cat-inline-btns">
                    <button
                      type="button"
                      className="cat-btn"
                      disabled={interventions.catWindlassTurns >= 3}
                      onClick={() => onAdjustWindlass(1)}
                    >
                      ↻ הדק מקל
                    </button>
                    <button
                      type="button"
                      className="cat-btn"
                      disabled={interventions.catWindlassTurns <= 0}
                      onClick={() => onAdjustWindlass(-1)}
                    >
                      ↺ שחרר
                    </button>
                    <button
                      type="button"
                      className={`cat-btn time-btn ${interventions.catTimeStamped ? 'stamped' : ''}`}
                      onClick={onStampCatTime}
                    >
                      {interventions.catTimeStamped ? `🕒 ${interventions.catTimeStamped}` : '🕒 רשום שעה'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 5. Triangular Bandage */}
            <button
              type="button"
              className={`tool-btn ${interventions.triangleOn ? 'active' : ''} ${
                mode === 'learn' && recommendedTool === 'triangle' ? 'recommended' : ''
              }`}
              onClick={onUseTriangle}
            >
              <div className="tool-icon" style={{ color: '#e2e8f0' }}><Triangle size={19} /></div>
              <div className="tool-info">
                <div className="tool-name">
                  <span>משולש בד</span>
                  {interventions.triangleOn && <span className="tool-status">מקובע ✓</span>}
                </div>
                <div className="tool-desc">קיבוע האמה במתלה מוגבה ושמירת הקריש</div>
              </div>
            </button>
          </div>
        </div>

        {/* Basic Me'ar Actions (3 Core Actions) */}
        <div>
          <div className="tool-section-label">
            <span>פעולות בסיסיות</span>
            <span>3 פעולות</span>
          </div>

          <div className="tool-list">
            {/* Direct Pressure */}
            <button
              type="button"
              className={`tool-btn ${isDirectActive ? 'active' : ''} ${
                mode === 'learn' && recommendedTool === 'pressure' ? 'recommended' : ''
              }`}
              onClick={onToggleDirectPressure}
            >
              <div className="tool-icon" style={{ color: '#ef4444' }}><Hand size={19} /></div>
              <div className="tool-info">
                <div className="tool-name">
                  <span>הפעלת לחץ ישיר</span>
                  {isDirectActive && <span className="tool-status">לוחץ ✓</span>}
                </div>
                <div className="tool-desc">
                  {isDirectActive && physiology.clotProgress > 14 && physiology.clotProgress < 85
                    ? '⚠️ קריש נבנה — אל תשחרר מוקדם מדי!'
                    : 'הפעל כאן או לחץ ממושכות על הפצע בתקריב'}
                </div>
                {interventions.pressureStrength > 0.05 && (
                  <div className="pressure-bar-wrap visible">
                    <div
                      className="pressure-bar-fill"
                      style={{ width: `${Math.round(interventions.pressureStrength * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            </button>

            {/* Limb Elevation */}
            <button
              type="button"
              className={`tool-btn ${interventions.elevated ? 'active' : ''} ${
                mode === 'learn' && recommendedTool === 'elevate' ? 'recommended' : ''
              }`}
              onClick={onToggleElevation}
            >
              <div className="tool-icon text-emerald"><ArrowUpCircle size={19} /></div>
              <div className="tool-info">
                <div className="tool-name">
                  <span>הרמת גפה</span>
                  {interventions.elevated && <span className="tool-status">מורמת ↑</span>}
                </div>
                <div className="tool-desc">מעל גובה הלב — מחליש דימום ורידי</div>
              </div>
            </button>

            {/* Call MDA 101 */}
            <button
              type="button"
              className={`tool-btn ${mdaState.called ? 'active' : ''} ${
                mode === 'learn' && recommendedTool === 'mda' ? 'recommended' : ''
              }`}
              onClick={onOpenMdaModal}
            >
              <div className="tool-icon" style={{ color: '#f87171' }}><PhoneCall size={19} /></div>
              <div className="tool-info">
                <div className="tool-name">
                  <span>קריאה למד"א 101</span>
                  {mdaState.called && (
                    <span className="tool-status call">
                      {mdaState.arrived ? 'הגיע ✓' : formatClock(mdaState.etaSec)}
                    </span>
                  )}
                </div>
                <div className="tool-desc">הזעק בעצמך או הפעל עובר אורח ב-3D!</div>
              </div>
            </button>
          </div>
        </div>

        {/* SABCDE Compact Tracker */}
        <div className="sabcde-mini-box">
          <div className="tool-section-label" style={{ marginBottom: 6 }}>
            <span>פרוטוקול SABCDE (לחץ להסבר)</span>
            <AlertCircle size={12} />
          </div>
          <div className="sabcde-grid">
            {SABCDE_STEPS.map((st) => (
              <button
                key={st.key}
                type="button"
                className={`sabcde-mini-pill ${stepDone[st.key] ? 'done' : ''}`}
                onClick={() => onInspectProtocolStep(st)}
              >
                <span className="sabcde-letter">{st.key}</span>
                <span>{st.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Finish & Debrief CTA */}
        <button type="button" className="finish-btn" onClick={onOpenDebrief}>
          <ClipboardCheck size={16} />
          <span>סיים טיפול וקבל תחקיר רפואי</span>
        </button>
      </div>
    </aside>
  );
}
