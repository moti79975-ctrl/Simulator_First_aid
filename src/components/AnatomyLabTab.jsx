import React, { useState } from 'react';
import { Layers, BookOpen, Activity, AlertTriangle, Stethoscope, User, Scan } from 'lucide-react';
import {
  ANATOMY_LAYERS,
  ANATOMY_MAP,
  BODY_REGIONS,
  MALE_FEMALE_ANATOMY_NOTES,
  SCENARIOS,
} from '../data/anatomyDatabase';
import FullBodyAnatomyView from './FullBodyAnatomyView';

/**
 * src/components/AnatomyLabTab.jsx
 * טאב ייעודי ונפרד ללימוד וחקירת אנטומיית הגוף המלא (זכר ונקבה):
 * - מודל גוף מלא ריאליסטי (זכר/נקבה) עם קילוף שכבות רציף ועדשת X-Ray בעכבר
 * - אנציקלופדיה מפורטת של כל 10 השכבות (עברית + לטינית + פיזיולוגיה + דגלים אדומים)
 * - השוואה אנטומית בין זכר לנקבה
 * - מעבר בלחיצה אחת מכל אזור גוף (אמה, זרוע, ירך, שוק, צוואר, חזה, בטן) לתרגול מקרה עזרה ראשונה תואם!
 */
export default function AnatomyLabTab({
  gender,
  onChangeGender,
  bodyRegionId,
  onSelectBodyRegion,
  physiologyRef,
  interventionsRef,
  scenario,
  onOpenXRayModal,
  onStartCaseForRegion,
}) {
  const [activeLayerId, setActiveLayerId] = useState('artery');
  const activeLayer = ANATOMY_MAP[activeLayerId] || ANATOMY_LAYERS[9];
  const genderNotes = MALE_FEMALE_ANATOMY_NOTES[gender] || MALE_FEMALE_ANATOMY_NOTES.male;
  const activeRegion = BODY_REGIONS[bodyRegionId] || BODY_REGIONS.forearm;

  return (
    <div className="anatomy-lab-layout">
      {/* RIGHT COLUMN (RTL First): 10 LAYERS SELECTOR & MALE/FEMALE ANATOMY COMPARISON */}
      <aside className="panel anatomy-lab-sidebar">
        <div className="panel-header">
          <div className="panel-title">
            <Layers size={16} className="text-sky" />
            <span>10 שכבות האנטומיה (מהחוץ פנימה)</span>
          </div>
        </div>

        <div className="anatomy-lab-list">
          {ANATOMY_LAYERS.map((layer) => (
            <button
              key={layer.id}
              type="button"
              className={`anatomy-lab-item ${activeLayerId === layer.id ? 'active' : ''}`}
              onClick={() => setActiveLayerId(layer.id)}
            >
              <span className="layer-swatch" style={{ background: layer.color, width: 12, height: 12 }} />
              <div style={{ flex: 1, textAlign: 'right' }}>
                <div style={{ fontSize: '0.81rem', fontWeight: 700 }}>
                  {layer.depthOrder}. {layer.nameHe.split(' (')[0]}
                </div>
                <div style={{ fontSize: '0.69rem', color: '#94a3b8' }}>
                  {layer.nameEn} • עומק {layer.depthMm}
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="gender-diff-card">
          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#7dd3fc', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <User size={14} /> {genderNotes.title}
          </div>
          <ul>
            {genderNotes.points.map((pt, idx) => (
              <li key={idx}>{pt}</li>
            ))}
          </ul>
        </div>
      </aside>

      {/* CENTER COLUMN: FULL-HEIGHT REALISTIC MALE / FEMALE FULL-BODY INTERACTIVE CANVAS */}
      <section className="anatomy-lab-center">
        <FullBodyAnatomyView
          gender={gender}
          onChangeGender={onChangeGender}
          bodyRegionId={bodyRegionId}
          onSelectBodyRegion={onSelectBodyRegion}
          physiologyRef={physiologyRef}
          interventionsRef={interventionsRef}
          scenario={scenario}
          onSwitchToMacro={() => onStartCaseForRegion(bodyRegionId)}
          onOpenXRay={() => onOpenXRayModal(activeLayerId)}
        />
      </section>

      {/* LEFT COLUMN: FULL MEDICAL ENCYCLOPEDIA + DIRECT LAUNCH TO BODY REGION CASES */}
      <aside className="panel anatomy-lab-inspector">
        <div className="panel-header">
          <div className="panel-title">
            <BookOpen size={16} className="text-emerald" />
            <span>אנציקלופדיה אנטומית ורפואית</span>
          </div>
          <button
            type="button"
            className="mini-chip xray-accent"
            onClick={() => onOpenXRayModal(activeLayerId)}
          >
            <Scan size={12} /> סורק קילוף X-Ray
          </button>
        </div>

        <div className="anatomy-lab-inspector-body">
          <div className="xray-info-head">
            <span className="layer-swatch" style={{ background: activeLayer.color, width: 18, height: 18 }} />
            <div>
              <h3 style={{ fontSize: '1.03rem', color: '#7dd3fc' }}>{activeLayer.nameHe}</h3>
              <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                {activeLayer.latin} • {activeLayer.categoryHe} • {activeLayer.depthMm}
              </div>
            </div>
          </div>

          <div className="xray-section">
            <h4>📌 מבנה אנטומי מפורט</h4>
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
            <h4>🚑 הנחיות למע"ר בשטח</h4>
            <p>{activeLayer.firstAidGuidance}</p>
          </div>

          <div className="xray-section red-flags-box">
            <h4><AlertTriangle size={14} /> דגלים אדומים</h4>
            <ul>
              {activeLayer.redFlags.map((flag, i) => (
                <li key={i}>{flag}</li>
              ))}
            </ul>
          </div>

          {/* Direct Region-to-First-Aid Launcher */}
          <div className="region-practice-card">
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#a7f3d0', marginBottom: 4 }}>
              📍 אזור גוף נבחר: {activeRegion.nameHe}
            </div>
            <div style={{ fontSize: '0.74rem', color: '#cbd5e1', marginBottom: 8 }}>
              <div><strong>עורק מרכזי:</strong> {activeRegion.arteryNameHe} ({activeRegion.arteryLatin})</div>
              <div><strong>וריד:</strong> {activeRegion.veinNameHe}</div>
              <div><strong>עצב:</strong> {activeRegion.nerveNameHe}</div>
              <div><strong>שריר:</strong> {activeRegion.muscleNameHe}</div>
              <div style={{ marginTop: 4, color: activeRegion.canUseCat ? '#86efac' : '#fca5a5', fontWeight: 700 }}>
                {activeRegion.canUseCat
                  ? '✓ אזור גפה — ניתן להניח חוסם עורקים CAT בדימום עורקי פורץ.'
                  : '⛔ אזור צומת/גוו — אסור בהחלט להניח חוסם עורקים CAT! לחץ ישיר ממוקד בלבד.'}
              </div>
            </div>

            <button
              type="button"
              className="finish-btn"
              onClick={() => onStartCaseForRegion(activeRegion.id)}
            >
              <Stethoscope size={16} />
              <span>עבור לטאב עזרה ראשונה ותרגל מקרה ב{activeRegion.shortHe}</span>
            </button>
          </div>

          {/* Quick List of All 8 Full-Body Cases */}
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', marginBottom: 6 }}>
              🚑 כל 8 מקרי העזרה הראשונה בכל הגוף:
            </div>
            <div className="lab-cases-grid">
              {Object.values(SCENARIOS).map((sc) => (
                <button
                  key={sc.id}
                  type="button"
                  className="mini-chip"
                  style={{ justifyContent: 'flex-start', textAlign: 'right' }}
                  onClick={() => onStartCaseForRegion(sc.bodyRegionId, sc.id)}
                >
                  {sc.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
