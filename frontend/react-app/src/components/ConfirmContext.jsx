import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

const ConfirmContext = createContext(null);

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
};

export const ConfirmProvider = ({ children }) => {
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    message: '',
    onConfirm: null,
    onCancel: null,
    triggerElement: null
  });

  const confirm = useCallback((message) => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        message,
        triggerElement: document.activeElement,
        onConfirm: () => {
          setConfirmState(prev => {
            if (prev.triggerElement) prev.triggerElement.focus();
            return { isOpen: false, message: '', onConfirm: null, onCancel: null, triggerElement: null };
          });
          resolve(true);
        },
        onCancel: () => {
          setConfirmState(prev => {
            if (prev.triggerElement) prev.triggerElement.focus();
            return { isOpen: false, message: '', onConfirm: null, onCancel: null, triggerElement: null };
          });
          resolve(false);
        }
      });
    });
  }, []);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {confirmState.isOpen && (
        <ConfirmModal state={confirmState} />
      )}
    </ConfirmContext.Provider>
  );
};

const ConfirmModal = ({ state }) => {
  const modalRef = useRef(null);
  const cancelBtnRef = useRef(null);
  const confirmBtnRef = useRef(null);

  useEffect(() => {
    if (cancelBtnRef.current) {
      cancelBtnRef.current.focus();
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        state.onCancel();
      } else if (e.key === 'Tab') {
        const focusableElements = [cancelBtnRef.current, confirmBtnRef.current].filter(Boolean);
        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [state]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
      <div 
        ref={modalRef}
        className="bg-surface w-full max-w-md p-6 rounded-xl shadow-lg border border-slate-200 mx-4" 
        role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title"
      >
        <h3 id="confirm-modal-title" className="text-lg font-bold text-slate-900 mb-2 mt-0">Confirmation</h3>
        <p className="text-slate-900 mb-2">{state.message}</p>
        <p className="text-sm text-slate-500 mt-2 mb-6">Cette action est irréversible.</p>
        <div className="flex justify-end gap-3">
          <button 
            ref={cancelBtnRef}
            className="px-4 py-2 rounded-lg font-medium transition-colors bg-transparent text-slate-700 border border-slate-300 hover:bg-slate-50" 
            onClick={state.onCancel}
          >
            Annuler
          </button>
          <button 
            ref={confirmBtnRef}
            className="px-4 py-2 rounded-lg font-medium transition-colors bg-danger text-white hover:bg-red-700 border-none cursor-pointer" 
            onClick={state.onConfirm}
          >
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
};
