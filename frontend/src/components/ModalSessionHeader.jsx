import React from 'react';
import { X, Sparkles, ShieldCheck, Clock } from 'lucide-react';
import logo from '../neclogo.png';

const ModalSessionHeader = ({ 
  title, 
  subtitle, 
  user, 
  onClose, 
  icon: Icon = Sparkles 
}) => {
  return (
    <div className="shrink-0 px-4 sm:px-6 py-3.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border-b border-white/10 flex items-center justify-between gap-4 select-none">
      
      {/* Left: College Crest & Title */}
      <div className="flex items-center gap-3 min-w-0">
        <img 
          src={logo} 
          alt="NEC Crest" 
          className="w-9 h-9 sm:w-10 sm:h-10 object-contain shrink-0 filter drop-shadow" 
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm sm:text-base font-black text-white tracking-tight truncate">
              {title}
            </h3>
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Live Session</span>
            </span>
          </div>
          {subtitle && (
            <p className="text-[11px] text-slate-300 truncate font-medium">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Center/Right: Session Metadata Badge (Desktop) */}
      <div className="hidden lg:flex items-center gap-3 text-xs text-slate-300 bg-white/5 border border-white/10 px-3.5 py-1.5 rounded-2xl shrink-0">
        <div className="flex items-center gap-1.5 font-bold">
          <ShieldCheck size={14} className="text-primary" />
          <span className="text-white">Session: 2026–2027</span>
        </div>
        <span className="text-slate-500">•</span>
        <div className="text-[11px]">
          Operator: <strong className="text-white">{user?.name || 'Administrator'}</strong> <span className="text-slate-400">({user?.role || 'SYSTEM'})</span>
        </div>
      </div>

      {/* Right: Close button */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="hidden md:inline-block text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-1 rounded-lg border border-white/10">
          ESC to Close
        </span>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Close window"
        >
          <X size={20} />
        </button>
      </div>

    </div>
  );
};

export default ModalSessionHeader;
