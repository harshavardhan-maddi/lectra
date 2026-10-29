import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'success', duration = 3500) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
    return id;
  }, [removeToast]);

  const success = useCallback((message, duration) => addToast(message, 'success', duration), [addToast]);
  const error = useCallback((message, duration) => addToast(message, 'error', duration), [addToast]);
  const info = useCallback((message, duration) => addToast(message, 'info', duration), [addToast]);

  return (
    <ToastContext.Provider value={{ showToast: addToast, success, error, info, removeToast }}>
      {children}
      {/* Toast Notification Container (Mobile & Desktop) */}
      <div 
        aria-live="polite"
        className="fixed top-4 left-1/2 -translate-x-1/2 sm:translate-x-0 sm:left-auto sm:right-6 z-[99999] flex flex-col gap-2.5 max-w-md w-[calc(100%-2rem)] sm:w-auto pointer-events-none select-none"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl shadow-2xl border backdrop-blur-xl animate-fade-in transition-all duration-300 ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 text-emerald-100 border-emerald-500/50 shadow-emerald-900/30'
                : toast.type === 'error'
                  ? 'bg-rose-950/90 text-rose-100 border-rose-500/50 shadow-rose-900/30'
                  : 'bg-indigo-950/90 text-indigo-100 border-indigo-500/50 shadow-indigo-900/30'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {toast.type === 'success' && <CheckCircle2 size={18} className="text-emerald-400" />}
              {toast.type === 'error' && <AlertCircle size={18} className="text-rose-400" />}
              {toast.type === 'info' && <Info size={18} className="text-indigo-400" />}
            </div>
            <div className="flex-1 text-xs sm:text-sm font-bold leading-snug">
              {toast.message}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 p-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    // Fallback if rendered outside provider so it never crashes
    return {
      showToast: (msg) => console.log('[Toast fallback]:', msg),
      success: (msg) => console.log('[Toast success fallback]:', msg),
      error: (msg) => console.error('[Toast error fallback]:', msg),
      info: (msg) => console.info('[Toast info fallback]:', msg),
      removeToast: () => {},
    };
  }
  return context;
};

export default ToastContext;
