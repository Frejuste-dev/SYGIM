import React, { useState, useEffect } from 'react';

/**
 * Formatage automatique d'un numéro ivoirien (10 chiffres)
 * Ex: "0709881442" -> "07 09 88 14 42"
 * Ex: "+2250709881442" -> "+225 07 09 88 14 42"
 */
function formatIvorianPhone(raw) {
  if (!raw) return '';
  let str = String(raw).trim();
  const hasPlus225 = str.startsWith('+225') || str.startsWith('00225');
  let digits = str.replace(/\D/g, '');

  if (hasPlus225) {
    if (digits.startsWith('225')) digits = digits.slice(3);
    else if (digits.startsWith('00225')) digits = digits.slice(5);
  }

  // Limite à 10 chiffres (standard CI)
  const trimmed = digits.slice(0, 10);
  const parts = [];
  for (let i = 0; i < trimmed.length; i += 2) {
    parts.push(trimmed.slice(i, i + 2));
  }

  const formattedDigits = parts.join(' ');
  return hasPlus225 ? `+225 ${formattedDigits}`.trim() : formattedDigits;
}

function extractCleanNumber(formatted) {
  if (!formatted) return '';
  const str = String(formatted).trim();
  const hasPlus = str.startsWith('+225') || str.startsWith('00225');
  let digits = str.replace(/\D/g, '');
  if (hasPlus) {
    if (digits.startsWith('225')) digits = digits.slice(3);
    else if (digits.startsWith('00225')) digits = digits.slice(5);
    return `+225${digits.slice(0, 10)}`;
  }
  return digits.slice(0, 10);
}

export default function PhoneInput({
  id,
  name,
  value,
  onChange,
  onBlur,
  placeholder = '07 09 88 14 42',
  disabled = false,
  readOnly = false,
  hasError = false,
  className = '',
  inputClassName = '',
  autoFocus = false
}) {
  const [displayValue, setDisplayValue] = useState(() => formatIvorianPhone(value));

  useEffect(() => {
    setDisplayValue(formatIvorianPhone(value));
  }, [value]);

  const cleanDigits = String(displayValue).replace(/\D/g, '');
  const actualDigits = cleanDigits.startsWith('225') ? cleanDigits.slice(3) : cleanDigits;
  const isComplete = actualDigits.length === 10;

  const handleChange = (e) => {
    const rawVal = e.target.value;
    const formatted = formatIvorianPhone(rawVal);
    const clean = extractCleanNumber(formatted);
    setDisplayValue(formatted);

    if (onChange) {
      const syntheticEvent = {
        ...e,
        target: {
          ...(e?.target || {}),
          name: name || id,
          id: id,
          value: clean
        }
      };
      try {
        onChange(syntheticEvent, clean);
      } catch {
        onChange(clean);
      }
    }
  };

  return (
    <div className={`phone-input-container w-full ${className}`}>
      <div className="relative rounded-xl shadow-2xs">
        {/* Préfixe Indicatif / Drapeau CI */}
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 gap-1.5 border-r border-slate-200/80 my-1.5 pr-2.5">
          <span className="text-base" role="img" aria-label="Côte d'Ivoire">🇨🇮</span>
          <span className="text-xs font-bold text-slate-600">+225</span>
        </div>

        <input
          id={id}
          name={name || id}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          autoFocus={autoFocus}
          disabled={disabled}
          readOnly={readOnly}
          placeholder={placeholder}
          value={displayValue}
          onChange={handleChange}
          onBlur={onBlur}
          className={`w-full bg-white border rounded-xl py-2.5 pl-24 pr-10 text-sm font-semibold tabular-nums text-slate-900 placeholder-slate-400 focus:outline-none transition-all ${
            hasError
              ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 text-rose-900 bg-rose-50/20'
              : isComplete
                ? 'border-emerald-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                : 'border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20'
          } ${disabled ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''} ${inputClassName}`}
        />

        {/* Indicateur de validation en bout de champ */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          {isComplete ? (
            <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px]" title="Numéro valide (10 chiffres)">
              <i className="fas fa-check"></i>
            </span>
          ) : actualDigits.length > 0 ? (
            <span className="text-[10px] font-bold text-slate-400 tabular-nums">
              {actualDigits.length}/10
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
