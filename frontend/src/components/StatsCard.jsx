import React from 'react';

export default function StatsCard({ label, value, icon, color, children }) {
  const accentColor = color || 'var(--primary)';
  return (
    <div className="p-4 bg-white border border-slate-200 rounded-lg">
      <div className="text-[13px] text-slate-400">{label}</div>
      <div className="text-[26px] font-bold my-1.5" style={{ color: accentColor }}>{value}</div>
      {children ? (
        <div className="text-xs" style={{ color: accentColor }}>{children}</div>
      ) : icon ? (
        <div className="text-xs" style={{ color: accentColor }}><i className={`fas ${icon}`}></i></div>
      ) : null}
    </div>
  );
}
