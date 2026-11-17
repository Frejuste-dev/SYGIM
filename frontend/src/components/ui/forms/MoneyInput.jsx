import React, { useState, useEffect } from 'react';

/**
 * Composant de saisie monétaire sécurisé et ergonomique (FCFA / XOF)
 * - Formatage automatique avec séparateurs de milliers
 * - Interdiction stricte de texte ou montants négatifs
 * - Support des boutons de presets rapides (100%, 50%, Solde)
 * - inputMode="numeric" pour clavier mobile adapté
 */
export default function MoneyInput({
  id,
  name,
  value,
  onChange,
  onBlur,
  min = 0,
  max,
  currency = 'FCFA',
  placeholder = '0',
  disabled = false,
  readOnly = false,
  hasError = false,
  presets = [],
  className = '',
  inputClassName = '',
  size = 'md',
  autoFocus = false,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
  ...rest
}) {
  const formatNumberWithSpaces = (val) => {
    if (val === null || val === undefined || val === '') return '';
    const num = typeof val === 'number' ? Math.round(val) : parseInt(String(val).replace(/\D/g, ''), 10);
    if (isNaN(num)) return '';
    return num.toLocaleString('fr-FR');
  };

  const [displayValue, setDisplayValue] = useState(() => formatNumberWithSpaces(value));

  useEffect(() => {
    setDisplayValue(formatNumberWithSpaces(value));
  }, [value]);

  const handleChange = (e) => {
    const rawInput = e.target.value;
    const cleanDigits = rawInput.replace(/\D/g, '');

    if (cleanDigits === '') {
      setDisplayValue('');
      emitChange(0, e);
      return;
    }

    let numericVal = parseInt(cleanDigits, 10);
    if (isNaN(numericVal)) numericVal = 0;
    if (min !== undefined && numericVal < min) numericVal = min;
    if (max !== undefined && numericVal > max) numericVal = max;

    setDisplayValue(numericVal.toLocaleString('fr-FR'));
    emitChange(numericVal, e);
  };

  const emitChange = (numVal, originalEvent) => {
    if (!onChange) return;
    // Crée un événement synthétique pour compatibilité avec onChange={e => setVal(e.target.value)}
    // tout en passant le nombre en second argument pour onChange={(num) => setVal(num)}
    const syntheticEvent = {
      ...originalEvent,
      target: {
        ...(originalEvent?.target || {}),
        name: name || id,
        id: id,
        value: numVal
      }
    };
    try {
      onChange(syntheticEvent, numVal);
    } catch {
      onChange(numVal);
    }
  };

  const handlePresetClick = (presetVal) => {
    if (disabled || readOnly) return;
    const numVal = Math.max(0, Math.round(presetVal));
    setDisplayValue(numVal.toLocaleString('fr-FR'));
    emitChange(numVal, { target: { name: name || id, id, value: numVal } });
  };

  const sizeClasses = {
    sm: 'py-2 pl-3.5 pr-14 text-xs',
    md: 'py-2.5 pl-3.5 pr-16 text-sm',
    lg: 'py-3 pl-4 pr-16 text-base font-bold'
  };

  return (
    <div className={`money-input-container w-full ${className}`}>
      <div className="relative rounded-xl shadow-2xs">
        <input
          id={id}
          name={name || id}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoFocus={autoFocus}
          disabled={disabled}
          readOnly={readOnly}
          aria-invalid={ariaInvalid || (hasError ? 'true' : undefined)}
          aria-describedby={ariaDescribedBy}
          placeholder={placeholder}
          value={displayValue}
          onChange={handleChange}
          onBlur={onBlur}
          {...rest}
          className={`w-full bg-white border rounded-xl font-bold tabular-nums text-slate-900 placeholder-slate-400 focus:outline-none transition-all ${
            sizeClasses[size] || sizeClasses.md
          } ${
            hasError
              ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 text-rose-900 bg-rose-50/20'
              : 'border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20'
          } ${disabled ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''} ${inputClassName}`}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/80">
            {currency}
          </span>
        </div>
      </div>

      {presets && presets.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {presets.map((preset, idx) => {
            const isSelected = value !== undefined && Math.round(Number(value)) === Math.round(Number(preset.value));
            return (
              <button
                key={idx}
                type="button"
                disabled={disabled || readOnly}
                onClick={() => handlePresetClick(preset.value)}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                  isSelected
                    ? 'bg-primary text-white border-primary shadow-2xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                }`}
              >
                <span>{preset.label}</span>
                {preset.displayAmount !== false && preset.value > 0 && (
                  <span className={`text-[10px] ${isSelected ? 'text-primary-100' : 'text-slate-400'}`}>
                    ({preset.value.toLocaleString('fr-FR')})
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
