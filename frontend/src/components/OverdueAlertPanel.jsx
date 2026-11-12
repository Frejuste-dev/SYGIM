import React, { useEffect, useState } from 'react';

const SEVERITY_CONFIG = {
  critique: { colorClass: 'text-rose-600', label: 'Critique', icon: 'fa-skull-crossbones' },
  haute: { colorClass: 'text-amber-500', label: 'Haute', icon: 'fa-exclamation-triangle' },
  normale: { colorClass: 'text-blue-500', label: 'Normale', icon: 'fa-exclamation-circle' },
  basse: { colorClass: 'text-slate-400', label: 'Basse', icon: 'fa-chevron-circle-down' },
};

const STATUS_LABELS = { late: 'En retard', pending: 'En attente', partial: 'Partiel' };

export default function OverdueAlertPanel({
  alerts = [],
  onAcknowledge,
  compact = false,
  autoExpandUrgent = true,
  showAcknowledgeLabel = false,
  acknowledgingAlertIds = []
}) {
  const hasUrgent = alerts.some(a => a.severity === 'critique' || a.severity === 'haute');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(autoExpandUrgent && hasUrgent);
  }, [autoExpandUrgent, hasUrgent, alerts.length]);

  if (!alerts.length) return null;

  const urgentCount = alerts.filter(a => a.severity === 'critique' || a.severity === 'haute').length;
  const compactSummary = urgentCount > 0
    ? `${urgentCount} alerte${urgentCount > 1 ? 's' : ''} urgente${urgentCount > 1 ? 's' : ''} de paiement`
    : `${alerts.length} alerte${alerts.length > 1 ? 's' : ''} de paiement`;

  return (
    <div className={`overdue-alert-panel rounded-lg overflow-hidden bg-white ${hasUrgent ? 'border border-rose-600' : 'border border-slate-200'} ${compact ? 'mb-4' : 'mb-5'}`}>
      <button className={`overdue-alert-toggle w-full border-none cursor-pointer flex items-center gap-3 font-inherit text-sm text-inherit ${compact ? 'py-2 px-3.5' : 'py-3.5 px-5'} ${hasUrgent ? 'bg-rose-500/10' : 'bg-transparent'}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}>
        <i className={`fas fa-bell text-base ${hasUrgent ? 'text-rose-600' : 'text-amber-500'}`}></i>
        <span className="flex-1 font-semibold text-left">
          {compact && !isOpen ? compactSummary : 'Alertes impayés liées au recouvrement'}
        </span>
        {urgentCount > 0 && (
          <span className="bg-rose-600 text-white rounded-full px-2.5 py-0.5 text-xs font-bold">
            {urgentCount}
          </span>
        )}
        <i className={`fas fa-chevron-${isOpen ? 'up' : 'down'} text-slate-400 text-xs`}></i>
      </button>

      {isOpen && (
        <div className="border-t border-slate-200 py-3 px-5">
          {alerts.map(alert => {
            const sev = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.normale;
            const isAcknowledging = acknowledgingAlertIds.includes(alert.id);

            return (
              <div key={alert.id} className="overdue-alert-row flex items-center gap-3 py-2.5 border-b border-slate-200 text-[13px]">
                <i className={`fas ${sev.icon} ${sev.colorClass} w-4`}></i>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {alert.first_name} {alert.last_name}
                  </div>
                  <div className="text-slate-400 text-xs">
                    {alert.property_name || alert.property_address || ''}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-bold ${sev.colorClass}`}>
                    {(alert.amount_owed || 0).toLocaleString()} XOF
                  </div>
                  <div className="text-slate-400 text-[11px]">
                    {STATUS_LABELS[alert.status] || alert.status}
                  </div>
                </div>
                {onAcknowledge && (
                  <button className="btn btn-small btn-outline overdue-ack-action shrink-0 px-2.5 py-1 text-xs"
                    onClick={() => onAcknowledge(alert.id)}
                    disabled={isAcknowledging}
                    type="button"
                    title={`Marquer l'alerte de ${alert.first_name || ''} ${alert.last_name || ''} comme traitée`}
                    aria-label={`Marquer l'alerte de ${alert.first_name || ''} ${alert.last_name || ''} comme traitée`}>
                    <i className={`fas ${isAcknowledging ? 'fa-spinner fa-spin' : 'fa-check'}`}></i>
                    {showAcknowledgeLabel && (
                      <span className="overdue-ack-label">
                        {isAcknowledging ? 'Traitement...' : 'Marquer traitée'}
                      </span>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
