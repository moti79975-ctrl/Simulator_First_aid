import React, { useState, useMemo, useCallback } from 'react';
import {
  Eye,
  EyeOff,
  Layers,
  Camera,
  RotateCw,
  Scan,
  Search,
  X,
  HeartPulse,
  Wind,
  BookOpen,
  AlertTriangle,
  Stethoscope,
  Sparkles,
  Crosshair,
  User,
  Sliders,
  Link2,
} from 'lucide-react';
import {
  ATLAS_SYSTEMS,
  ATLAS_STRUCTURES,
  ATLAS_STRUCTURES_MAP,
  CAMERA_PRESETS,
  AXIAL_SLICE_LEVELS,
} from '../../data/atlas3DDatabase';
import Atlas3DViewport from './Atlas3DViewport';
import AxialSliceViewer from './AxialSliceViewer';
import DeepDiveBox from '../DeepDiveBox';

const FALLBACK_SYSTEMS = [
  { id: 'skin', nameHe: 'עור ומעטפת', color: '#e6b89c', explodeOffsetX: -1.25 },
  { id: 'muscular', nameHe: 'מערכת השרירים', color: '#dc6b6b', explodeOffsetX: -0.75 },
  { id: 'skeletal', nameHe: 'מערכת השלד', color: '#e2dcc8', explodeOffsetX: -0.25 },
  { id: 'organs', nameHe: 'איברים פנימיים', color: '#f97316', explodeOffsetX: 0.25 },
  { id: 'vascular', nameHe: 'כלי דם (עורקים/ורידים)', color: '#ef4444', explodeOffsetX: 0.75 },
  { id: 'nervous', nameHe: 'מערכת העצבים', color: '#facc15', explodeOffsetX: 1.25 },
];

const INITIAL_LAYER_STATE = {
  skin: { visible: true, opacity: 0.34 },
  muscular: { visible: true, opacity: 0.24 },
  skeletal: { visible: true, opacity: 1.0 },
  organs: { visible: true, opacity: 1.0 },
  vascular: { visible: true, opacity: 1.0 },
  nervous: { visible: true, opacity: 0.9 },
};

const QUICK_ORGAN_SPECS = [
  { key: 'heart', label: 'לב', icon: '❤️', ids: ['heart'], terms: ['לב', 'heart'] },
  { key: 'lungs', label: 'ריאות', icon: '🫁', ids: ['lungs'], terms: ['ריא', 'lung'] },
  { key: 'aorta', label: 'אבי העורקים', icon: '🩸', ids: ['aorta'], terms: ['אבי העורקים', 'aorta'] },
  { key: 'brain', label: 'מוח', icon: '🧠', ids: ['brain'], terms: ['מוח', 'brain', 'cerebr'] },
  { key: 'spine', label: 'עמוד שדרה', icon: '🦴', ids: ['spine'], terms: ['עמוד השדרה', 'עמוד שדרה', 'spine', 'vertebr'] },
  { key: 'pelvis', label: 'אגן', icon: '🩻', ids: ['pelvis'], terms: ['אגן', 'pelvi'] },
  { key: 'femoral', label: 'עורק פמורלי', icon: '🔴', ids: ['femoral_artery'], terms: ['פמורלי', 'ירך', 'femoral'] },
  { key: 'radial', label: 'עורק רדיאלי', icon: '⚡', ids: ['brachial_radial_artery', 'radial_artery'], terms: ['רדיאלי', 'חישור', 'radial'] },
  { key: 'sciatic', label: 'עצב סכיאטי', icon: '💛', ids: ['sciatic_femoral_nerve', 'sciatic_nerve'], terms: ['סכיאטי', 'סיאטי', 'שת', 'sciatic'] },
];

const DIMORPHISM_HIGHLIGHTS = {
  male: {
    title: 'דו-צורתיות מינית — אנטומיית זכר (3D)',
    bullets: [
      'כתפיים רחבות יותר ביחס לאגן, כלוב צלעות רחב ונפח ריאות ממוצע גבוה יותר (~6 ל\').',
      'אגן צר וגבוה יותר עם זווית תת-חיקית חדה (~60°–70°).',
      'נפח דם כולל ממוצע ~5.0 ליטר ומסת שריר שלד גבוהה יותר.',
    ],
  },
  female: {
    title: 'דו-צורתיות מינית — אנטומיית נקבה (3D)',
    bullets: [
      'אגן רחב ושטוח יותר המותאם ללידה (זווית תת-חיקית רחבה >90°).',
      'כלוב צלעות עדין וכתפיים צרות יותר; זווית Q (ירך-ברך) גדולה מעט יותר.',
      'נפח דם כולל ממוצע ~4.5 ליטר — רגישות מהירה יותר לאיבוד דם זהה במיליליטרים!',
    ],
  },
};

function normalizeArray(source, fallback = []) {
  if (Array.isArray(source)) return source;
  if (source && typeof source === 'object') return Object.values(source);
  return fallback;
}

function resolveGenderNote(struct, gender) {
  if (!struct) return null;
  const gn = struct.genderNote ?? struct.genderNotes;
  if (!gn) {
    return gender === 'female' ? struct.femaleNote || null : struct.maleNote || null;
  }
  if (typeof gn === 'string') return gn;
  if (typeof gn === 'object') {
    return gn[gender] || gn.both || gn.male || gn.female || null;
  }
  return null;
}

function getStructureSlicePct(struct) {
  if (!struct) return null;
  const direct =
    struct.sliceHeightPct ??
    struct.slicePct ??
    struct.axialHeightPct ??
    struct.yPct;
  if (typeof direct === 'number' && !Number.isNaN(direct)) {
    return Math.max(4, Math.min(98, Math.round(direct)));
  }
  const target =
    struct.cameraFocus?.target ||
    struct.camera?.target ||
    struct.cameraTarget ||
    struct.focusPoint ||
    struct.position;
  if (Array.isArray(target) && typeof target[1] === 'number') {
    return Math.max(4, Math.min(98, Math.round((target[1] / 1.76) * 100)));
  }
  return null;
}

function buildCameraReqForStructure(struct, seq) {
  if (!struct) return null;

  const focus = struct.cameraFocus || struct.camera;
  if (focus?.pos && focus?.target) {
    return { pos: focus.pos, target: focus.target, seq };
  }
  if (Array.isArray(struct.cameraPos) && Array.isArray(struct.cameraTarget)) {
    return { pos: struct.cameraPos, target: struct.cameraTarget, seq };
  }

  const pt = struct.focusPoint || struct.cameraTarget || struct.position || null;
  const isPosterior = /spine|vertebr|kidney|sciatic|glute|scapula|cerebellum|spinal/i.test(
    `${struct.id || ''} ${struct.nameEn || ''} ${struct.latin || ''}`
  );

  if (Array.isArray(pt) && pt.length >= 3) {
    const [tx, ty, tz] = pt;
    const zOffset = isPosterior ? -1.05 : 1.05;
    return {
      target: [tx, ty, tz],
      pos: [tx + (tx >= 0 ? 0.16 : -0.16), Math.min(1.85, ty + 0.08), tz + zOffset],
      seq,
    };
  }

  const pct = getStructureSlicePct(struct);
  const y = pct !== null ? (pct / 100) * 1.76 : 1.15;
  return {
    target: [0, y, 0],
    pos: [0.18, Math.min(1.85, y + 0.1), isPosterior ? -1.25 : 1.25],
    seq,
  };
}

/**
 * src/components/atlas3d/Anatomy3DAtlasTab.jsx
 * סטודיו האנטומיה התלת-ממדי המלא (3 עמודות):
 * - עמודה ימנית: בורר זכר/נקבה, 6 שכבות מערכות גוף + שקיפות חיה + תבניות + Exploded 3D,
 *   מצלמות מוכנות, בקרת פיזיולוגיה חיה (HR/RR או סנכרון לפצוע החי), וחיפוש חי ב-40 מבנים.
 * - עמודה מרכזית: במת Three.js 3D אינטראקטיבית 360° + HUD עליון + סרגל איברים מרכזיים תחתון.
 * - עמודה שמאלית: סורק חתך צירי CT מסונכרן דו-כיוונית + אנציקלופדיית העמקה מדעית + מעבר למקרה מע"ר.
 */
export default function Anatomy3DAtlasTab({
  gender = 'male',
  onChangeGender,
  livePhysiology,
  onJumpToCase,
}) {
  const systemsList = useMemo(() => {
    const arr = normalizeArray(ATLAS_SYSTEMS, FALLBACK_SYSTEMS);
    return arr.length ? arr : FALLBACK_SYSTEMS;
  }, []);

  const systemsById = useMemo(() => {
    const map = {};
    systemsList.forEach((sys) => {
      if (sys?.id) map[sys.id] = sys;
    });
    return map;
  }, [systemsList]);

  const structuresList = useMemo(() => {
    const arr = normalizeArray(ATLAS_STRUCTURES, []);
    if (arr.length) return arr;
    return normalizeArray(ATLAS_STRUCTURES_MAP, []);
  }, []);

  const structuresById = useMemo(() => {
    const map = { ...(ATLAS_STRUCTURES_MAP || {}) };
    structuresList.forEach((s) => {
      if (s?.id && !map[s.id]) map[s.id] = s;
    });
    return map;
  }, [structuresList]);

  const cameraPresetsList = useMemo(() => normalizeArray(CAMERA_PRESETS, []), []);
  const axialLevelsList = useMemo(() => normalizeArray(AXIAL_SLICE_LEVELS, []), []);

  // Resolve initial default structure (prefer heart if present)
  const defaultStructureId = useMemo(() => {
    const heartMatch =
      structuresById.heart ||
      structuresList.find((s) => /heart|לב/i.test(`${s.id} ${s.nameHe} ${s.nameEn}`));
    return heartMatch?.id || structuresList[0]?.id || null;
  }, [structuresById, structuresList]);

  // Core studio states
  const [layerState, setLayerState] = useState(INITIAL_LAYER_STATE);
  const [activeLayerPreset, setActiveLayerPreset] = useState('translucent_organs');
  const [exploded, setExploded] = useState(false);
  const [sliceHeightPct, setSliceHeightPct] = useState(68);
  const [showSlicePlane, setShowSlicePlane] = useState(true);
  const [autoRotate, setAutoRotate] = useState(false);
  const [cameraTargetReq, setCameraTargetReq] = useState(null);
  const [activeCameraPresetId, setActiveCameraPresetId] = useState(
    cameraPresetsList[0]?.id || null
  );

  const [selectedStructureId, setSelectedStructureId] = useState(defaultStructureId);
  const [hoveredStructureId, setHoveredStructureId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Live 3D Physiology Controls: sync with trauma patient OR manual sliders
  const [syncWithLivePatient, setSyncWithLivePatient] = useState(true);
  const [manualHr, setManualHr] = useState(76);
  const [manualRr, setManualRr] = useState(15);

  const effectiveHr = syncWithLivePatient
    ? Math.max(45, Math.min(180, Math.round(livePhysiology?.hr ?? 76)))
    : manualHr;
  const effectiveRr = syncWithLivePatient
    ? Math.max(8, Math.min(44, Math.round(livePhysiology?.rr ?? 15)))
    : manualRr;

  const selectedStructure = selectedStructureId ? structuresById[selectedStructureId] : null;
  const selectedSysId = selectedStructure?.systemId || selectedStructure?.system || null;
  const selectedSystem = selectedSysId ? systemsById[selectedSysId] : null;

  // Resolve nearest Axial CT Level label for HUD badge
  const nearestAxialLevel = useMemo(() => {
    if (!axialLevelsList.length) return null;
    let best = axialLevelsList[0];
    let bestDiff = Infinity;
    axialLevelsList.forEach((lvl) => {
      const pct = lvl.heightPct ?? lvl.pct ?? lvl.yPct ?? 50;
      const diff = Math.abs(pct - sliceHeightPct);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = lvl;
      }
    });
    return best;
  }, [axialLevelsList, sliceHeightPct]);

  // Helper: ensure a structure's system is visible (and skin translucent if internal)
  const ensureStructureVisible = useCallback((struct) => {
    if (!struct) return;
    const sysId = struct.systemId || struct.system;
    if (!sysId) return;

    setLayerState((prev) => {
      const next = { ...prev };
      const curr = prev[sysId] || { visible: true, opacity: 1 };
      next[sysId] = {
        visible: true,
        opacity: Math.max(0.92, curr.opacity),
      };
      // If inspecting an internal organ/vessel/bone/nerve, peel skin translucently so it isn't blocked
      if (sysId !== 'skin' && prev.skin?.visible && prev.skin.opacity > 0.45) {
        next.skin = { visible: true, opacity: 0.24 };
      }
      if (
        (sysId === 'organs' || sysId === 'vascular' || sysId === 'skeletal' || sysId === 'nervous') &&
        prev.muscular?.visible &&
        prev.muscular.opacity > 0.55
      ) {
        next.muscular = { visible: true, opacity: 0.22 };
      }
      return next;
    });
  }, []);

  // Trigger smooth camera fly-to
  const flyCameraTo = useCallback((pos, target, presetId = null) => {
    setActiveCameraPresetId(presetId);
    setCameraTargetReq((prev) => ({
      pos,
      target,
      seq: (prev?.seq || 0) + 1,
    }));
  }, []);

  // Select structure from 3D viewport click (keeps current camera angle, syncs slice plane)
  const handleSelectFromViewport = useCallback(
    (structureId) => {
      if (!structureId) return;
      setSelectedStructureId(structureId);
      const struct = structuresById[structureId];
      const pct = getStructureSlicePct(struct);
      if (pct !== null) {
        setSliceHeightPct(pct);
      }
    },
    [structuresById]
  );

  // Select structure from Axial CT Slice Viewer (selects + guarantees its 3D system is visible)
  const handleSelectFromSlice = useCallback(
    (structureId) => {
      if (!structureId) return;
      setSelectedStructureId(structureId);
      const struct = structuresById[structureId];
      if (struct) {
        ensureStructureVisible(struct);
      }
    },
    [structuresById, ensureStructureVisible]
  );

  // Focus & fly camera directly to structure (used by Search, Quick-Select Bar, and Focus button)
  const handleFocusStructure = useCallback(
    (structureId) => {
      const struct = structuresById[structureId];
      if (!struct) return;
      setSelectedStructureId(struct.id);
      ensureStructureVisible(struct);

      const pct = getStructureSlicePct(struct);
      if (pct !== null) {
        setSliceHeightPct(pct);
      }

      setCameraTargetReq((prev) => buildCameraReqForStructure(struct, (prev?.seq || 0) + 1));
      setActiveCameraPresetId(null);
    },
    [structuresById, ensureStructureVisible]
  );

  // Layer toggle & opacity handlers
  const handleToggleSystem = useCallback((sysId) => {
    setActiveLayerPreset(null);
    setLayerState((prev) => {
      const curr = prev[sysId] || { visible: true, opacity: 1 };
      const nextVisible = !curr.visible;
      return {
        ...prev,
        [sysId]: {
          visible: nextVisible,
          opacity: nextVisible && curr.opacity < 0.12 ? 0.85 : curr.opacity,
        },
      };
    });
  }, []);

  const handleOpacityChange = useCallback((sysId, pctVal) => {
    const opacity = Math.max(0, Math.min(1, pctVal / 100));
    setActiveLayerPreset(null);
    setLayerState((prev) => ({
      ...prev,
      [sysId]: {
        visible: opacity > 0.01,
        opacity,
      },
    }));
  }, []);

  // Quick Layer Presets
  const applyLayerPreset = useCallback(
    (presetKey) => {
      if (presetKey === 'exploded') {
        setExploded((wasExploded) => {
          const nextExploded = !wasExploded;
          if (nextExploded) {
            setLayerState({
              skin: { visible: true, opacity: 0.88 },
              muscular: { visible: true, opacity: 0.94 },
              skeletal: { visible: true, opacity: 1.0 },
              organs: { visible: true, opacity: 1.0 },
              vascular: { visible: true, opacity: 1.0 },
              nervous: { visible: true, opacity: 1.0 },
            });
            flyCameraTo([0, 1.0, 4.35], [0, 0.92, 0], null);
          }
          return nextExploded;
        });
        return;
      }

      setExploded(false);
      setActiveLayerPreset(presetKey);
      if (presetKey === 'translucent_organs') {
        setLayerState({
          skin: { visible: true, opacity: 0.3 },
          muscular: { visible: false, opacity: 0.0 },
          skeletal: { visible: true, opacity: 0.72 },
          organs: { visible: true, opacity: 1.0 },
          vascular: { visible: true, opacity: 1.0 },
          nervous: { visible: true, opacity: 0.55 },
        });
      } else if (presetKey === 'skeleton_vascular') {
        setLayerState({
          skin: { visible: true, opacity: 0.14 },
          muscular: { visible: false, opacity: 0.0 },
          skeletal: { visible: true, opacity: 1.0 },
          organs: { visible: true, opacity: 0.22 },
          vascular: { visible: true, opacity: 1.0 },
          nervous: { visible: true, opacity: 0.82 },
        });
      } else if (presetKey === 'full_muscular') {
        setLayerState({
          skin: { visible: true, opacity: 0.18 },
          muscular: { visible: true, opacity: 1.0 },
          skeletal: { visible: true, opacity: 0.9 },
          organs: { visible: true, opacity: 0.75 },
          vascular: { visible: true, opacity: 0.85 },
          nervous: { visible: true, opacity: 0.6 },
        });
      }
    },
    [flyCameraTo]
  );

  // Camera Preset click handler
  const handleSelectCameraPreset = useCallback(
    (preset) => {
      if (!preset) return;
      const pos = preset.pos || preset.position || [0, 1.0, 2.55];
      const target = preset.target || [0, 0.92, 0];
      flyCameraTo(pos, target, preset.id);
      if (typeof preset.sliceHeightPct === 'number') {
        setSliceHeightPct(preset.sliceHeightPct);
      }
    },
    [flyCameraTo]
  );

  // Live filtered structures for the search box
  const filteredStructures = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return structuresList;
    return structuresList.filter((s) => {
      const sysName = systemsById[s.systemId || s.system]?.nameHe || '';
      const haystack = `${s.nameHe || ''} ${s.latin || ''} ${s.nameEn || ''} ${s.regionHe || ''} ${sysName}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [searchQuery, structuresList, systemsById]);

  // Resolve bottom quick-select bar organs cleanly against ATLAS_STRUCTURES
  const quickOrgans = useMemo(() => {
    return QUICK_ORGAN_SPECS.map((spec) => {
      let match = null;
      for (let i = 0; i < spec.ids.length; i += 1) {
        if (structuresById[spec.ids[i]]) {
          match = structuresById[spec.ids[i]];
          break;
        }
      }
      if (!match) {
        match = structuresList.find((s) => {
          const text = `${s.id || ''} ${s.nameHe || ''} ${s.nameEn || ''} ${s.latin || ''}`.toLowerCase();
          return spec.terms.some((term) => text.includes(term.toLowerCase()));
        });
      }
      return {
        ...spec,
        structureId: match?.id || null,
      };
    }).filter((item) => Boolean(item.structureId));
  }, [structuresById, structuresList]);

  // Selected structure encyclopedia fields
  const genderNoteText = resolveGenderNote(selectedStructure, gender);
  const simpleSummaryText =
    selectedStructure?.simpleSummary ||
    selectedStructure?.simpleText ||
    selectedStructure?.summary ||
    '';
  const deepScienceText = [selectedStructure?.deepAnatomy, selectedStructure?.physiology]
    .filter(Boolean)
    .join('\n\n');
  const traumaText =
    selectedStructure?.traumaRelevance ||
    selectedStructure?.mearRelevance ||
    selectedStructure?.firstAidRelevance ||
    selectedStructure?.firstAidGuidance ||
    selectedStructure?.traumaNote ||
    '';
  const relatedCaseId = selectedStructure?.relatedCaseId || selectedStructure?.scenarioId || null;
  const dimorphism = DIMORPHISM_HIGHLIGHTS[gender] || DIMORPHISM_HIGHLIGHTS.male;

  const hrBadgeColor = effectiveHr >= 120 ? '#f87171' : effectiveHr >= 100 ? '#fbbf24' : '#4ade80';
  const rrBadgeColor = effectiveRr >= 26 ? '#f87171' : effectiveRr >= 21 ? '#fbbf24' : '#38bdf8';

  return (
    <div className="atlas3d-layout">
      {/* ====================================================================
          RIGHT COLUMN (RTL 1st): STUDIO CONTROLS, 6 LAYERS, CAMERAS, VITALS & SEARCH
          ==================================================================== */}
      <aside className="panel atlas3d-controls-col">
        <div className="panel-header">
          <div className="panel-title">
            <Layers size={16} className="text-sky" />
            <span>בקרת אנטומיה 3D ושכבות</span>
          </div>
          <span
            style={{
              fontSize: '0.68rem',
              color: '#7dd3fc',
              background: 'rgba(14, 165, 233, 0.14)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: 99,
              padding: '2px 8px',
              fontWeight: 700,
            }}
          >
            {structuresList.length} מבנים
          </span>
        </div>

        <div className="atlas3d-controls-scroll" style={{ padding: '10px 11px', display: 'flex', flexDirection: 'column', gap: 11 }}>
          {/* 1. GENDER TOGGLE & ANATOMICAL DIMORPHISM HIGHLIGHT */}
          <div className="atlas3d-card" style={{ background: 'rgba(15, 23, 42, 0.72)', border: '1px solid rgba(148, 163, 184, 0.16)', borderRadius: 10, padding: '9px 10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 7 }}>
              <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#e2e8f0', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <User size={13} className="text-sky" /> מודל גוף תלת-ממדי
              </span>
              <div className="segmented">
                <button
                  type="button"
                  className={gender === 'male' ? 'active' : ''}
                  onClick={() => onChangeGender?.('male')}
                >
                  👨 זכר
                </button>
                <button
                  type="button"
                  className={gender === 'female' ? 'active' : ''}
                  onClick={() => onChangeGender?.('female')}
                >
                  👩 נקבה
                </button>
              </div>
            </div>

            <div
              style={{
                background: 'rgba(14, 165, 233, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.24)',
                borderRadius: 8,
                padding: '7px 9px',
                fontSize: '0.71rem',
                color: '#cbd5e1',
              }}
            >
              <div style={{ fontWeight: 800, color: '#7dd3fc', marginBottom: 4 }}>{dimorphism.title}</div>
              <ul style={{ paddingRight: 15, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {dimorphism.bullets.map((pt, idx) => (
                  <li key={idx}>{pt}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* 2. 6 SYSTEM LAYER CONTROLS + QUICK PRESETS + EXPLODED 3D */}
          <div className="atlas3d-card" style={{ background: 'rgba(15, 23, 42, 0.72)', border: '1px solid rgba(148, 163, 184, 0.16)', borderRadius: 10, padding: '9px 10px' }}>
            <div style={{ fontSize: '0.77rem', fontWeight: 800, color: '#e2e8f0', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sliders size={13} className="text-sky" />
              <span>6 מערכות גוף (שקיפות חיה בזמן אמת)</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {systemsList.map((sys) => {
                const cfg = layerState[sys.id] || { visible: true, opacity: 1 };
                const pct = Math.round((cfg.visible ? cfg.opacity : 0) * 100);
                return (
                  <div
                    key={sys.id}
                    className="atlas3d-layer-row"
                    style={{
                      background: cfg.visible ? 'rgba(22, 34, 58, 0.85)' : 'rgba(15, 23, 42, 0.45)',
                      border: `1px solid ${cfg.visible ? 'rgba(148, 163, 184, 0.22)' : 'rgba(148, 163, 184, 0.1)'}`,
                      borderRadius: 8,
                      padding: '6px 8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                      <button
                        type="button"
                        onClick={() => handleToggleSystem(sys.id)}
                        title={cfg.visible ? 'הסתר שכבה' : 'הצג שכבה'}
                        style={{
                          background: cfg.visible ? 'rgba(56, 189, 248, 0.16)' : 'rgba(51, 65, 85, 0.5)',
                          border: `1px solid ${cfg.visible ? 'rgba(56, 189, 248, 0.45)' : 'rgba(148, 163, 184, 0.2)'}`,
                          color: cfg.visible ? '#7dd3fc' : '#64748b',
                          borderRadius: 6,
                          width: 24,
                          height: 24,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        {cfg.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                      </button>

                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: sys.color || '#38bdf8',
                          boxShadow: cfg.visible ? `0 0 8px ${sys.color || '#38bdf8'}` : 'none',
                          flexShrink: 0,
                        }}
                      />

                      <span
                        style={{
                          flex: 1,
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          color: cfg.visible ? '#f1f5f9' : '#64748b',
                        }}
                      >
                        {sys.nameHe || sys.id}
                      </span>

                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', minWidth: 32, textAlign: 'left' }}>
                        {pct}%
                      </span>
                    </div>

                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={pct}
                      onChange={(e) => handleOpacityChange(sys.id, Number(e.target.value))}
                      aria-label={`שקיפות ${sys.nameHe || sys.id}`}
                      style={{
                        width: '100%',
                        accentColor: sys.color || '#38bdf8',
                        cursor: 'pointer',
                        height: 5,
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* 4 Quick Layer Preset Buttons */}
            <div style={{ marginTop: 9 }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', marginBottom: 5 }}>
                תצוגות מהירות:
              </div>
              <div className="atlas3d-preset-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                <button
                  type="button"
                  className={`mini-chip ${activeLayerPreset === 'translucent_organs' && !exploded ? 'active' : ''}`}
                  onClick={() => applyLayerPreset('translucent_organs')}
                  style={{
                    justifyContent: 'center',
                    padding: '6px 7px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    background:
                      activeLayerPreset === 'translucent_organs' && !exploded
                        ? 'rgba(14, 165, 233, 0.24)'
                        : undefined,
                    borderColor:
                      activeLayerPreset === 'translucent_organs' && !exploded ? '#38bdf8' : undefined,
                    color: activeLayerPreset === 'translucent_organs' && !exploded ? '#e0f2fe' : undefined,
                  }}
                >
                  עור שקוף + איברים
                </button>
                <button
                  type="button"
                  className={`mini-chip ${activeLayerPreset === 'skeleton_vascular' && !exploded ? 'active' : ''}`}
                  onClick={() => applyLayerPreset('skeleton_vascular')}
                  style={{
                    justifyContent: 'center',
                    padding: '6px 7px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    background:
                      activeLayerPreset === 'skeleton_vascular' && !exploded
                        ? 'rgba(14, 165, 233, 0.24)'
                        : undefined,
                    borderColor:
                      activeLayerPreset === 'skeleton_vascular' && !exploded ? '#38bdf8' : undefined,
                    color: activeLayerPreset === 'skeleton_vascular' && !exploded ? '#e0f2fe' : undefined,
                  }}
                >
                  שלד וכלי דם
                </button>
                <button
                  type="button"
                  className={`mini-chip ${activeLayerPreset === 'full_muscular' && !exploded ? 'active' : ''}`}
                  onClick={() => applyLayerPreset('full_muscular')}
                  style={{
                    justifyContent: 'center',
                    padding: '6px 7px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    background:
                      activeLayerPreset === 'full_muscular' && !exploded
                        ? 'rgba(14, 165, 233, 0.24)'
                        : undefined,
                    borderColor:
                      activeLayerPreset === 'full_muscular' && !exploded ? '#38bdf8' : undefined,
                    color: activeLayerPreset === 'full_muscular' && !exploded ? '#e0f2fe' : undefined,
                  }}
                >
                  שרירים מלאים
                </button>
                <button
                  type="button"
                  className={`mini-chip ${exploded ? 'active' : ''}`}
                  onClick={() => applyLayerPreset('exploded')}
                  style={{
                    justifyContent: 'center',
                    padding: '6px 7px',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    background: exploded ? 'rgba(168, 85, 247, 0.26)' : 'rgba(168, 85, 247, 0.1)',
                    borderColor: exploded ? '#c084fc' : 'rgba(192, 132, 252, 0.35)',
                    color: exploded ? '#f3e8ff' : '#d8b4fe',
                    gap: 4,
                  }}
                >
                  <Sparkles size={12} /> פירוק 3D (Exploded)
                </button>
              </div>
            </div>
          </div>

          {/* 3. CAMERA PRESETS + AUTO-ROTATE 360° + LASER CT PLANE TOGGLE */}
          <div className="atlas3d-card" style={{ background: 'rgba(15, 23, 42, 0.72)', border: '1px solid rgba(148, 163, 184, 0.16)', borderRadius: 10, padding: '9px 10px' }}>
            <div style={{ fontSize: '0.77rem', fontWeight: 800, color: '#e2e8f0', marginBottom: 7, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Camera size={13} className="text-sky" />
              <span>זוויות מצלמה ותצוגת לייזר</span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
              {cameraPresetsList.map((preset) => {
                const isActive = activeCameraPresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    className="mini-chip"
                    onClick={() => handleSelectCameraPreset(preset)}
                    style={{
                      fontSize: '0.71rem',
                      padding: '5px 8px',
                      fontWeight: 700,
                      background: isActive ? 'rgba(14, 165, 233, 0.24)' : undefined,
                      borderColor: isActive ? '#38bdf8' : undefined,
                      color: isActive ? '#e0f2fe' : undefined,
                    }}
                  >
                    {preset.labelHe || preset.nameHe || preset.label || preset.id}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <button
                type="button"
                className={`icon-btn ${autoRotate ? 'active-toggle' : ''}`}
                onClick={() => setAutoRotate((v) => !v)}
                style={{ justifyContent: 'center', fontSize: '0.72rem', padding: '6px 7px' }}
              >
                <RotateCw size={13} />
                <span>סיבוב 360°</span>
              </button>

              <button
                type="button"
                className={`icon-btn ${showSlicePlane ? 'active-toggle' : ''}`}
                onClick={() => setShowSlicePlane((v) => !v)}
                style={{ justifyContent: 'center', fontSize: '0.72rem', padding: '6px 7px' }}
              >
                <Scan size={13} />
                <span>לייזר CT {showSlicePlane ? 'פעיל' : 'כבוי'}</span>
              </button>
            </div>
          </div>

          {/* 4. LIVE 3D PHYSIOLOGY CONTROLS (SYNC WITH LIVE PATIENT vs MANUAL HR/RR) */}
          <div className="atlas3d-card" style={{ background: 'rgba(15, 23, 42, 0.72)', border: '1px solid rgba(148, 163, 184, 0.16)', borderRadius: 10, padding: '9px 10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#e2e8f0', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <HeartPulse size={13} style={{ color: '#f87171' }} /> פיזיולוגיה חיה ב-3D
              </span>
              <button
                type="button"
                className={`mini-chip ${syncWithLivePatient ? 'active' : ''}`}
                onClick={() => setSyncWithLivePatient((v) => !v)}
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  padding: '3px 7px',
                  gap: 4,
                  background: syncWithLivePatient ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.16)',
                  borderColor: syncWithLivePatient ? '#10b981' : '#f59e0b',
                  color: syncWithLivePatient ? '#a7f3d0' : '#fde68a',
                }}
              >
                <Link2 size={11} />
                <span>{syncWithLivePatient ? 'סנכרון לפצוע החי' : 'שליטה ידנית'}</span>
              </button>
            </div>

            {/* Heart Rate Slider */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: 3 }}>
                <span style={{ color: '#cbd5e1', fontWeight: 700 }}>❤️ דופק הלב (HR)</span>
                <strong style={{ color: hrBadgeColor }}>{effectiveHr} BPM</strong>
              </div>
              <input
                type="range"
                min={50}
                max={160}
                value={effectiveHr}
                onChange={(e) => {
                  setSyncWithLivePatient(false);
                  setManualHr(Number(e.target.value));
                }}
                style={{ width: '100%', accentColor: hrBadgeColor, cursor: 'pointer', height: 5 }}
              />
            </div>

            {/* Respiratory Rate Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: 3 }}>
                <span style={{ color: '#cbd5e1', fontWeight: 700 }}>🫁 קצב נשימה (RR)</span>
                <strong style={{ color: rrBadgeColor }}>{effectiveRr} נשימות/דק׳</strong>
              </div>
              <input
                type="range"
                min={10}
                max={38}
                value={effectiveRr}
                onChange={(e) => {
                  setSyncWithLivePatient(false);
                  setManualRr(Number(e.target.value));
                }}
                style={{ width: '100%', accentColor: rrBadgeColor, cursor: 'pointer', height: 5 }}
              />
            </div>

            <div style={{ fontSize: '0.66rem', color: '#94a3b8', marginTop: 6 }}>
              הלב הפועם (4 מדורים), הריאות, הסרעפת, גל העורקים וחתך ה-CT מגיבים מיד בזמן אמת!
            </div>
          </div>

          {/* 5. LIVE STRUCTURE SEARCH ACROSS ALL 40 ANATOMICAL STRUCTURES */}
          <div className="atlas3d-card atlas3d-search-box" style={{ background: 'rgba(15, 23, 42, 0.72)', border: '1px solid rgba(148, 163, 184, 0.16)', borderRadius: 10, padding: '9px 10px' }}>
            <div style={{ fontSize: '0.77rem', fontWeight: 800, color: '#e2e8f0', marginBottom: 7, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Search size={13} className="text-sky" />
                <span>חיפוש מבנים אנטומיים</span>
              </span>
              <span style={{ fontSize: '0.67rem', color: '#94a3b8' }}>
                {filteredStructures.length}/{structuresList.length}
              </span>
            </div>

            <div style={{ position: 'relative', marginBottom: 7 }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="חפש איבר, עצם, שריר, עורק או עצב..."
                style={{
                  width: '100%',
                  background: 'rgba(9, 15, 29, 0.92)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  borderRadius: 8,
                  padding: '6px 10px 6px 28px',
                  color: '#f1f5f9',
                  fontSize: '0.75rem',
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  title="נקה חיפוש"
                  style={{
                    position: 'absolute',
                    left: 6,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    display: 'flex',
                  }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div
              className="atlas3d-search-results"
              style={{
                maxHeight: 215,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              {filteredStructures.length === 0 ? (
                <div style={{ fontSize: '0.73rem', color: '#64748b', textAlign: 'center', padding: '12px 4px' }}>
                  לא נמצאו מבנים תואמים ל-"{searchQuery}"
                </div>
              ) : (
                filteredStructures.map((item) => {
                  const sId = item.systemId || item.system;
                  const sys = systemsById[sId];
                  const isSel = selectedStructureId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleFocusStructure(item.id)}
                      onMouseEnter={() => setHoveredStructureId(item.id)}
                      onMouseLeave={() => setHoveredStructureId(null)}
                      style={{
                        width: '100%',
                        background: isSel ? 'rgba(56, 189, 248, 0.2)' : 'rgba(22, 34, 58, 0.72)',
                        border: `1px solid ${isSel ? '#38bdf8' : 'rgba(148, 163, 184, 0.14)'}`,
                        borderRadius: 7,
                        padding: '5px 8px',
                        color: '#f1f5f9',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 7,
                        textAlign: 'right',
                        fontFamily: 'inherit',
                        transition: 'all 0.14s',
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: sys?.color || '#38bdf8',
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.nameHe}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.latin || item.nameEn}
                        </div>
                      </div>
                      {item.regionHe && (
                        <span
                          style={{
                            fontSize: '0.63rem',
                            color: '#7dd3fc',
                            background: 'rgba(14, 165, 233, 0.12)',
                            borderRadius: 5,
                            padding: '1px 5px',
                            flexShrink: 0,
                          }}
                        >
                          {item.regionHe}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* ====================================================================
          CENTER COLUMN: IMMERSIVE 3D VIEWPORT + TOP HUD + KEY ORGANS BAR
          ==================================================================== */}
      <section className="panel atlas3d-viewport-col" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* TOP HUD BADGE BAR */}
        <div
          className="atlas3d-hud-top"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
            padding: '8px 12px',
            background: 'rgba(9, 16, 32, 0.92)',
            borderBottom: '1px solid rgba(148, 163, 184, 0.16)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '0.73rem',
                fontWeight: 800,
                padding: '3px 9px',
                borderRadius: 99,
                background: 'rgba(56, 189, 248, 0.16)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                color: '#bae6fd',
              }}
            >
              {gender === 'female' ? '👩 מודל נקבה 3D' : '👨 מודל זכר 3D'}
            </span>

            <span
              style={{
                fontSize: '0.73rem',
                fontWeight: 800,
                padding: '3px 9px',
                borderRadius: 99,
                background: 'rgba(239, 68, 68, 0.14)',
                border: `1px solid ${hrBadgeColor}66`,
                color: hrBadgeColor,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <HeartPulse size={12} /> {effectiveHr} BPM
            </span>

            <span
              style={{
                fontSize: '0.73rem',
                fontWeight: 700,
                padding: '3px 9px',
                borderRadius: 99,
                background: 'rgba(14, 165, 233, 0.14)',
                border: `1px solid ${rrBadgeColor}55`,
                color: rrBadgeColor,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Wind size={12} /> {effectiveRr}/דק׳
            </span>

            {exploded && (
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '3px 9px',
                  borderRadius: 99,
                  background: 'rgba(168, 85, 247, 0.24)',
                  border: '1px solid #c084fc',
                  color: '#f3e8ff',
                }}
              >
                ✨ מצב פירוק 3D פעיל
              </span>
            )}

            {showSlicePlane && (
              <span
                style={{
                  fontSize: '0.71rem',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: 99,
                  background: 'rgba(6, 182, 212, 0.14)',
                  border: '1px solid rgba(34, 211, 238, 0.36)',
                  color: '#67e8f9',
                }}
              >
                CT {Math.round(sliceHeightPct)}%
                {nearestAxialLevel?.titleHe || nearestAxialLevel?.labelHe || nearestAxialLevel?.nameHe
                  ? ` • ${nearestAxialLevel.titleHe || nearestAxialLevel.labelHe || nearestAxialLevel.nameHe}`
                  : ''}
              </span>
            )}
          </div>

          <div style={{ fontSize: '0.71rem', color: '#94a3b8' }}>
            🖱️ גרור לסיבוב 360° • גלגלת לזום • Shift+גרירה להזזה • לחץ על כל איבר/עצם/עורק לחקירה
          </div>
        </div>

        {/* MAIN 3D VIEWPORT */}
        <div style={{ flex: 1, minHeight: 590, position: 'relative' }}>
          <Atlas3DViewport
            gender={gender}
            layerState={layerState}
            exploded={exploded}
            sliceHeightPct={sliceHeightPct}
            showSlicePlane={showSlicePlane}
            cameraTargetReq={cameraTargetReq}
            selectedStructureId={selectedStructureId}
            hoveredStructureId={hoveredStructureId}
            hr={effectiveHr}
            rr={effectiveRr}
            autoRotate={autoRotate}
            onSelectStructure={handleSelectFromViewport}
            onHoverStructure={setHoveredStructureId}
          />
        </div>

        {/* BOTTOM QUICK-SELECT BAR FOR KEY ORGANS */}
        <div
          className="atlas3d-quickbar"
          style={{
            padding: '8px 11px',
            background: 'rgba(9, 16, 32, 0.94)',
            borderTop: '1px solid rgba(148, 163, 184, 0.16)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: '0.71rem', fontWeight: 800, color: '#94a3b8', marginLeft: 3 }}>
            מיקוד מהיר:
          </span>
          {quickOrgans.map((org) => {
            const isActive = selectedStructureId === org.structureId;
            return (
              <button
                key={org.key}
                type="button"
                className="mini-chip"
                onClick={() => handleFocusStructure(org.structureId)}
                onMouseEnter={() => setHoveredStructureId(org.structureId)}
                onMouseLeave={() => setHoveredStructureId(null)}
                style={{
                  fontSize: '0.73rem',
                  fontWeight: 700,
                  padding: '4px 9px',
                  gap: 5,
                  background: isActive ? 'rgba(14, 165, 233, 0.25)' : 'rgba(22, 34, 58, 0.85)',
                  borderColor: isActive ? '#38bdf8' : 'rgba(148, 163, 184, 0.2)',
                  color: isActive ? '#e0f2fe' : '#cbd5e1',
                }}
              >
                <span>{org.icon}</span>
                <span>{org.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ====================================================================
          LEFT COLUMN (RTL 3rd): AXIAL CT SLICE VIEWER + MEDICAL ENCYCLOPEDIA
          ==================================================================== */}
      <aside className="atlas3d-inspector-col" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* TOP PANEL: SYNCHRONIZED BIDIRECTIONAL AXIAL CT SLICE VIEWER */}
        <div className="panel atlas3d-axial-panel" style={{ overflow: 'hidden' }}>
          <AxialSliceViewer
            sliceHeightPct={sliceHeightPct}
            onChangeSliceHeightPct={setSliceHeightPct}
            selectedStructureId={selectedStructureId}
            hoveredStructureId={hoveredStructureId}
            onSelectStructure={handleSelectFromSlice}
            onHoverStructure={setHoveredStructureId}
            gender={gender}
            hr={effectiveHr}
            rr={effectiveRr}
          />
        </div>

        {/* BOTTOM PANEL: SELECTED 3D STRUCTURE MEDICAL ENCYCLOPEDIA & DEEP DIVE */}
        <div className="panel atlas3d-encyclopedia">
          <div className="panel-header">
            <div className="panel-title">
              <BookOpen size={16} className="text-emerald" />
              <span>אנציקלופדיה רפואית והעמקה</span>
            </div>
            {selectedStructure && (
              <button
                type="button"
                className="mini-chip"
                onClick={() => handleFocusStructure(selectedStructure.id)}
                title="מקד מצלמת 3D על המבנה הנבחר"
                style={{ fontSize: '0.69rem', gap: 4, color: '#7dd3fc', borderColor: 'rgba(56, 189, 248, 0.35)' }}
              >
                <Crosshair size={12} /> מרכז מצלמה
              </button>
            )}
          </div>

          <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {selectedStructure ? (
              <>
                {/* Structure Identity Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    background: 'rgba(15, 23, 42, 0.78)',
                    border: '1px solid rgba(56, 189, 248, 0.28)',
                    borderRadius: 10,
                    padding: '10px 11px',
                  }}
                >
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      background: selectedSystem?.color || '#38bdf8',
                      boxShadow: `0 0 12px ${selectedSystem?.color || '#38bdf8'}`,
                      marginTop: 3,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '1.02rem', fontWeight: 800, color: '#f8fafc', lineHeight: 1.25 }}>
                      {selectedStructure.nameHe}
                    </h3>
                    {selectedStructure.latin && (
                      <div style={{ fontSize: '0.78rem', color: '#7dd3fc', fontStyle: 'italic', marginTop: 2 }}>
                        {selectedStructure.latin}
                      </div>
                    )}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 5, fontSize: '0.7rem', color: '#94a3b8' }}>
                      {selectedStructure.nameEn && <span>{selectedStructure.nameEn}</span>}
                      {selectedStructure.regionHe && (
                        <span
                          style={{
                            color: '#cbd5e1',
                            background: 'rgba(30, 41, 59, 0.9)',
                            border: '1px solid rgba(148, 163, 184, 0.22)',
                            borderRadius: 99,
                            padding: '1px 7px',
                            fontWeight: 700,
                          }}
                        >
                          📍 {selectedStructure.regionHe}
                        </span>
                      )}
                      {selectedSystem?.nameHe && (
                        <span
                          style={{
                            color: '#bae6fd',
                            background: 'rgba(14, 165, 233, 0.14)',
                            borderRadius: 99,
                            padding: '1px 7px',
                            fontWeight: 700,
                          }}
                        >
                          {selectedSystem.nameHe}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Male / Female Gender-Specific Anatomical Note */}
                {genderNoteText && (
                  <div
                    style={{
                      background: 'rgba(99, 102, 241, 0.11)',
                      border: '1px solid rgba(129, 140, 248, 0.34)',
                      borderRadius: 9,
                      padding: '8px 10px',
                      fontSize: '0.75rem',
                      color: '#e0e7ff',
                    }}
                  >
                    <strong style={{ color: '#a5b4fc' }}>
                      {gender === 'female' ? '👩 הערה אנטומית (נקבה): ' : '👨 הערה אנטומית (זכר): '}
                    </strong>
                    <span>{genderNoteText}</span>
                  </div>
                )}

                {/* Dual-Layer Scientific DeepDiveBox */}
                <DeepDiveBox
                  key={selectedStructure.id}
                  title="הסבר אנטומי ותפקודי"
                  simpleText={simpleSummaryText || 'בחר מבנה בגוף ה-3D או בחתך ה-CT לצפייה בהסבר מלא.'}
                  deepText={deepScienceText}
                  formula={selectedStructure.formulaOrMetric}
                  clinicalPearl={selectedStructure.clinicalPearl}
                  defaultOpen={true}
                />

                {/* Dedicated Trauma & Me'ar First-Aid Relevance Callout */}
                {traumaText && (
                  <div
                    style={{
                      background: 'rgba(239, 68, 68, 0.09)',
                      border: '1px solid rgba(248, 113, 113, 0.35)',
                      borderRadius: 10,
                      padding: '9px 11px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        color: '#fca5a5',
                        marginBottom: 4,
                      }}
                    >
                      <AlertTriangle size={14} />
                      <span>רלוונטיות לטראומה ועזרה ראשונה (מע&quot;ר)</span>
                    </div>
                    <p style={{ fontSize: '0.76rem', color: '#fee2e2', lineHeight: 1.48 }}>
                      {traumaText}
                    </p>
                  </div>
                )}

                {/* Direct CTA to Practice Related First-Aid Case */}
                {relatedCaseId && (
                  <button
                    type="button"
                    className="finish-btn"
                    onClick={() => onJumpToCase?.(relatedCaseId)}
                    style={{
                      width: '100%',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <Stethoscope size={16} />
                    <span>🚑 תרגל מקרה עזרה ראשונה באזור זה</span>
                  </button>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '26px 12px', color: '#94a3b8', fontSize: '0.82rem' }}>
                לחץ על כל איבר, עצם, שריר, עורק או עצב במודל ה-3D או בחתך ה-CT לצפייה במידע רפואי מלא.
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
