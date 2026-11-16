import React from 'react';

/**
 * Composant de champ de formulaire standardisé SYGIM
 * Gère label, indicateur requis/optionnel, message d'erreur animé et aide contextuelle.
 */
export default function FormField({
  id,
  label,
  required = false,
  optional = false,
  hint,
  error,
  icon,
  labelRight,
  children,
  className = ''
}) {
  return (
    <div className={`form-field-group flex flex-col ${className}`}>
      {label && (
        <div className="flex items-center justify-between mb-1.5">
          <label
            htmlFor={id}
            className="block text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1"
          >
            {icon && <i className={`fas ${icon} text-slate-400 text-xs mr-0.5`} aria-hidden="true"></i>}
            <span>{label}</span>
            {required && <span className="text-rose-600 font-bold text-sm leading-none" title="Champ obligatoire">*</span>}
          </label>
          {optional && (
            <span className="text-[11px] text-slate-400 font-normal bg-slate-100 px-2 py-0.5 rounded-md">
              Optionnel
            </span>
          )}
          {labelRight}
        </div>
      )}

      <div className="relative">
        {children}
      </div>

      {error ? (
        <p className="text-xs text-rose-600 mt-1.5 flex items-center gap-1.5 font-medium animate-fade-in-up" role="alert">
          <i className="fas fa-exclamation-circle shrink-0 text-rose-500" aria-hidden="true"></i>
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1.5">
          <i className="fas fa-info-circle text-slate-400 shrink-0 text-[10px]" aria-hidden="true"></i>
          <span>{hint}</span>
        </p>
      ) : null}
    </div>
  );
}
