import React from 'react';

export default function Modal({ title, onClose, children, maxWidth, variant }) {
  const isCollector = variant === 'collector';

  return (
    <div className={`app-modal-overlay fixed inset-0 bg-black/50 flex justify-center items-center z-[1000] ${isCollector ? 'collector-modal-overlay p-4' : 'p-0'}`}>
      <div className={`app-modal-panel bg-white text-slate-900 border border-slate-200 shadow-lg ${isCollector ? 'collector-modal-panel p-0 rounded-lg w-full overflow-hidden flex flex-col' : 'p-[30px] rounded-xl w-[90%] overflow-auto block'}`} style={{
        maxWidth: maxWidth || '500px',
        maxHeight: isCollector ? 'calc(100dvh - 32px)' : '90vh'
      }}>
        <div className={`app-modal-header flex justify-between items-center shrink-0 ${isCollector ? 'collector-modal-header mb-0 py-3.5 px-4 border-b border-slate-200' : 'mb-5 p-0 border-none'}`}>
          <h3 className="m-0">{title}</h3>
          <button onClick={onClose} type="button"
            className={`app-modal-close bg-transparent border-none cursor-pointer text-xl text-slate-500 ${isCollector ? 'collector-modal-close' : ''}`}
            aria-label="Fermer la fenêtre">
            <i className="fas fa-times" aria-hidden="true"></i>
          </button>
        </div>
        {isCollector ? <div className="app-modal-body collector-modal-body">{children}</div> : children}
      </div>
    </div>
  );
}
