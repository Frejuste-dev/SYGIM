import React from 'react';
import useModalEscape from '../hooks/useModalEscape';

export default function Modal({ title, subtitle, icon = 'fa-layer-group', onClose, children, maxWidth, variant }) {
  const isCollector = variant === 'collector';

  useModalEscape(true, onClose);

  return (
    <div
      className={`app-modal-overlay fixed inset-0 bg-slate-900/55 backdrop-blur-sm flex justify-center items-center z-[1000] p-3 sm:p-4 ${isCollector ? 'collector-modal-overlay' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <div
        className={`app-modal-panel bg-white text-slate-900 border border-slate-200 shadow-2xl rounded-2xl w-full overflow-hidden flex flex-col ${isCollector ? 'collector-modal-panel' : ''}`}
        style={{
          maxWidth: maxWidth || '680px',
          maxHeight: isCollector ? 'calc(100dvh - 24px)' : '90dvh'
        }}
      >
        {/* En-tête fixe de la modale */}
        <div className={`app-modal-header flex justify-between items-center shrink-0 px-6 py-4 border-b border-slate-100 bg-slate-50/80 ${isCollector ? 'collector-modal-header' : ''}`}>
          <div className="flex items-center gap-3 min-w-0">
            {icon && (
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/15">
                <i className={`fas ${icon} text-base`} aria-hidden="true"></i>
              </div>
            )}
            <div className="min-w-0">
              <h3 className="m-0 text-lg font-bold text-slate-900 truncate">{title}</h3>
              {subtitle && <p className="text-xs text-slate-500 mt-0.5 truncate">{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className={`app-modal-close w-8 h-8 rounded-xl flex items-center justify-center bg-transparent border-none cursor-pointer text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors shrink-0 ${isCollector ? 'collector-modal-close' : ''}`}
            aria-label="Fermer la fenêtre"
          >
            <i className="fas fa-times text-base" aria-hidden="true"></i>
          </button>
        </div>

        {/* Corps défilant unique */}
        <div className={`app-modal-body p-6 overflow-y-auto flex-1 ${isCollector ? 'collector-modal-body' : ''}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
