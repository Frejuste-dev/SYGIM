import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback(({ type = 'info', message, duration = 4000 }) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 w-full max-w-sm px-4 md:px-0">
        {toasts.map((toast) => {
          const borderClass = toast.type === 'error' ? 'border-l-danger' :
                              toast.type === 'success' ? 'border-l-success' :
                              toast.type === 'warning' ? 'border-l-warning' :
                              'border-l-primary';
          
          return (
            <div
              key={toast.id}
              className={`bg-surface shadow-md rounded-lg border border-slate-200 p-4 flex items-start justify-between gap-3 border-l-4 ${borderClass}`}
              role="alert"
              aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
            >
              <span className="text-sm font-medium text-slate-900">{toast.message}</span>
              <button
                onClick={() => removeToast(toast.id)}
                aria-label="Fermer la notification"
                className="text-slate-400 hover:text-slate-600 transition-colors bg-transparent border-none cursor-pointer text-xl leading-none p-0"
              >
                &times;
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
