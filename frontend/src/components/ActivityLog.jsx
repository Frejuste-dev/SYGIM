import React from 'react';

export default function ActivityLog({ logs }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="text-slate-400 p-6 text-center">
        Aucune activité enregistrée.
      </div>
    );
  }

  return (
    <div className="mt-5 bg-white rounded-lg border border-slate-200 p-4 max-h-[400px] overflow-y-auto">
      {logs.map((log, idx) => (
        <div key={idx} className="flex gap-5 border-b border-slate-200 py-2.5 text-sm">
          <span className="text-slate-400 min-w-[150px]">
            {log.date} - {log.time}
          </span>
          <span className={`status-badge min-w-[80px] text-center ${log.type === 'auth' ? 'paid' : 'info'}`}>
            {log.type}
          </span>
          <span className="flex-1">{log.message}</span>
        </div>
      ))}
    </div>
  );
}
