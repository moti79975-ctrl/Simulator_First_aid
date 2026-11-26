import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Microscope, BookOpen } from 'lucide-react';

/**
 * src/components/DeepDiveBox.jsx
 * רכיב הסבר דו-שכבתי המלווה כל מושג, מדד ופעולה בסימולטור:
 * - שכבה 1: הסבר פשוט וברור לרמת מע"ר מתחיל
 * - שכבה 2 (נפתחת בלחיצה): העמקה מדעית-רפואית (מנגנון תאי/חשמלי/המודינמי + פנינה קלינית)
 */
export default function DeepDiveBox({
  title,
  simpleText,
  deepText,
  formula,
  clinicalPearl,
  defaultOpen = false,
  compact = false,
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`deepdive-box ${compact ? 'compact' : ''} ${open ? 'open' : ''}`}>
      <div className="deepdive-summary">
        {title && <strong className="deepdive-title">{title}: </strong>}
        <span>{simpleText}</span>
      </div>

      {deepText && (
        <button
          type="button"
          className="deepdive-toggle-btn"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <Microscope size={12} />
          <span>{open ? 'הסתר העמקה מדעית' : 'להעמקה מדעית-רפואית (איך זה עובד?)'}</span>
          {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      )}

      {open && deepText && (
        <div className="deepdive-content">
          <p className="deepdive-text">
            <BookOpen size={12} style={{ verticalAlign: 'middle', marginLeft: 5, color: '#38bdf8' }} />
            {deepText}
          </p>
          {formula && (
            <div className="deepdive-formula">
              <strong>נוסחה פיזיולוגית:</strong> <code>{formula}</code>
            </div>
          )}
          {clinicalPearl && (
            <div className="deepdive-pearl">
              <strong>💡 כלל זהב קליני:</strong> {clinicalPearl}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
