import React from 'react';
import { Clock, Sparkles } from 'lucide-react';

export const PlaceholderPage = ({
  title,
  subtitle,
  icon: Icon,
  badge = 'Phase 2 Architecture',
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
      <div className="w-full max-w-xl p-8 rounded-2xl bg-gradient-to-b from-slate-900/80 to-slate-900/40 border border-slate-800 backdrop-blur-xl shadow-2xl text-center relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-brand-600/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-semibold uppercase tracking-wider mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{badge}</span>
        </div>

        {/* Icon */}
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-brand-400 shadow-inner">
          {Icon ? <Icon className="w-8 h-8" /> : <Clock className="w-8 h-8" />}
        </div>

        {/* Headings */}
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-3">{title}</h1>
        <p className="text-slate-400 text-sm sm:text-base leading-relaxed mb-8 max-w-md mx-auto">
          {subtitle ||
            'This business module is currently under construction as part of the next phase.'}
        </p>

        {/* Status Callout Card */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-left">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
            </span>
            <div>
              <p className="text-xs font-semibold text-slate-200">Status: In Development</p>
              <p className="text-[11px] text-slate-500">Microservice orchestration & UI underway</p>
            </div>
          </div>
          <span className="text-xs font-medium text-slate-400 bg-slate-800/60 px-2.5 py-1 rounded-md border border-slate-700/40">
            Coming Soon
          </span>
        </div>
      </div>
    </div>
  );
};
