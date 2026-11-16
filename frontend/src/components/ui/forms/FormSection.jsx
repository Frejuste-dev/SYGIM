import React from 'react';

/**
 * Séparateur visuel de section de formulaire
 * Structure les formulaires complexes en blocs thématiques digestes
 */
export default function FormSection({
  icon,
  title,
  subtitle,
  badge,
  actions,
  children,
  variant = 'card',
  className = ''
}) {
  const isCard = variant === 'card';

  return (
    <div
      className={`form-section-container rounded-2xl transition-all ${
        isCard
          ? 'bg-slate-50/80 p-4 sm:p-5 border border-slate-200/90 shadow-2xs space-y-4'
          : 'pt-2 pb-1 space-y-3'
      } ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
        <div className="flex items-center gap-2.5">
          {icon && (
            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              {typeof icon === 'string' ? <i className={`fas ${icon} text-xs`} aria-hidden="true"></i> : icon}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                {title}
              </h4>
              {badge && (
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">
                  {badge}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-[11px] text-slate-500 mt-0.5 font-normal">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {actions && (
          <div className="shrink-0 flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>

      <div className="space-y-4 pt-1">
        {children}
      </div>
    </div>
  );
}
