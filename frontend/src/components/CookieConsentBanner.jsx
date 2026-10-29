import React, { useState, useEffect } from 'react';
import { ShieldCheck, Cookie, Check, X, Info } from 'lucide-react';
import { logActivity } from '../services/activityLogger';

const CookieConsentBanner = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem('lectra_cookie_consent');
      if (!consent) {
        setShow(true);
      }
    } catch (e) {
      setShow(false);
    }
  }, []);

  const handleAccept = () => {
    try {
      localStorage.setItem('lectra_cookie_consent', 'accepted');
      localStorage.setItem('lectra_cookie_consent_time', new Date().toISOString());
      logActivity({
        action: 'COOKIE_CONSENT',
        details: 'User accepted campus cookie & activity logging policy',
        category: 'SYSTEM',
        completed: true
      });
    } catch (e) {}
    setShow(false);
  };

  const handleDecline = () => {
    try {
      localStorage.setItem('lectra_cookie_consent', 'essential_only');
    } catch (e) {}
    setShow(false);
  };

  if (!show) return null;

  return (
    <div 
      role="region" 
      aria-label="Cookie and Activity Tracking Notice"
      className="fixed bottom-0 inset-x-0 z-[99990] p-3 sm:p-5 pointer-events-none animate-slide-up"
    >
      <div className="max-w-4xl mx-auto glass-card bg-slate-900/95 dark:bg-slate-950/95 text-white p-4 sm:p-5 rounded-3xl border border-white/20 shadow-2xl backdrop-blur-2xl pointer-events-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        
        <div className="flex items-start gap-3.5 flex-1">
          <div className="p-2.5 rounded-2xl bg-primary/20 text-primary border border-primary/30 shrink-0 mt-0.5">
            <Cookie size={22} className="animate-pulse" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h4 className="font-black text-sm text-white tracking-wide">
                Campus Portal Cookie & Activity Audit Notice
              </h4>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-wider border border-emerald-500/30">
                Official Policy
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              Narasaraopeta Engineering College portal uses cookies and activity audit logging to securely record logins, attendance modifications, faculty operations, student permission requests, and administrative audit trails for Super Admin governance.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0 justify-end pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
          <button
            onClick={handleDecline}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer"
          >
            Essential Only
          </button>
          <button
            onClick={handleAccept}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-indigo-600 hover:from-primary-dark hover:to-indigo-700 text-white text-xs font-black shadow-lg shadow-primary/25 hover:shadow-primary/40 active:scale-95 transition-all cursor-pointer"
          >
            <Check size={16} />
            <span>Accept & Enable Audit</span>
          </button>
        </div>

      </div>
    </div>
  );
};

export default CookieConsentBanner;
