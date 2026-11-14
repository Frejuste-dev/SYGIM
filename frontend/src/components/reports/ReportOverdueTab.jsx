import React from 'react';
import TableSkeleton from '../ui/TableSkeleton';
import { formatXOF, formatDate } from '../../utils/formatters';

const SEVERITY_BADGES = {
  critique: 'bg-rose-100 text-rose-800 border-rose-200',
  haute: 'bg-orange-100 text-orange-800 border-orange-200',
  normale: 'bg-amber-100 text-amber-800 border-amber-200',
  basse: 'bg-slate-100 text-slate-700 border-slate-200',
};

export default function ReportOverdueTab({
  overdue = [],
  filteredOverdue = [],
  loading = false,
  severityFilter = 'all',
  setSeverityFilter,
  collectorFilter = 'all',
  setCollectorFilter,
  collectorOptions = [],
  handleExportRelancesSheet,
  handleExportOverdueExcel,
  handleExportOverduePDF,
  handleOpenReminderModal,
  remindersHistory = [],
  setRemindersHistory
}) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Suivi des Impayés & Plan d'Action Relances</h3>
            <p className="text-slate-500 text-xs mt-0.5">
              Identifiez les locataires en retard, filtrez par récolteur assigné et planifiez les actions de relance terrain.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
            >
              <option value="all">Toutes priorités ({overdue.length})</option>
              <option value="critique">Priorité Critique</option>
              <option value="haute">Priorité Haute</option>
              <option value="normale">Priorité Normale</option>
            </select>

            <select
              value={collectorFilter}
              onChange={(e) => setCollectorFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
            >
              <option value="all">Tous les récolteurs ({collectorOptions.length})</option>
              {collectorOptions.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleExportRelancesSheet}
              className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              title="Exporter la feuille d'action terrain des relances"
            >
              <i className="fas fa-clipboard-list"></i> Feuille de Relances
            </button>
            <button
              type="button"
              onClick={handleExportOverdueExcel}
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <i className="fas fa-file-excel"></i> Excel
            </button>
            <button
              type="button"
              onClick={handleExportOverduePDF}
              className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <i className="fas fa-file-pdf"></i> PDF
            </button>
          </div>
        </div>

        <div className="overflow-x-auto min-w-0">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                <th className="py-3.5 px-4 font-semibold">Locataire</th>
                <th className="py-3.5 px-4 font-semibold">Bien Immobilier</th>
                <th className="py-3.5 px-4 font-semibold">Récolteur</th>
                <th className="py-3.5 px-4 font-semibold text-right">Loyer Mensuel</th>
                <th className="py-3.5 px-4 font-semibold text-right">Déjà Payé</th>
                <th className="py-3.5 px-4 font-semibold text-right">Reste Dû (Impayé)</th>
                <th className="py-3.5 px-4 font-semibold text-center">Ancienneté</th>
                <th className="py-3.5 px-4 font-semibold">Priorité</th>
                <th className="py-3.5 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <TableSkeleton rows={5} columns={9} />
              ) : filteredOverdue.length > 0 ? (
                filteredOverdue.map((o, idx) => {
                  const clientName = o.client || `${o.first_name || ''} ${o.last_name || ''}`.trim() || '—';
                  const propName = o.property || o.property_name || '—';
                  const rentDue = Number(o.rent_due ?? o.amount ?? 0);
                  const paid = Number(o.amount_paid || 0);
                  const owed = Number(o.amount_owed ?? o.amount ?? 0);
                  const daysLate = o.days_since_contract ?? o.daysLate ?? 0;
                  const sev = o.severity || 'normale';

                  return (
                    <tr key={o.id || idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{clientName}</div>
                        <div className="text-xs text-slate-400">{o.phone || ''}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-800">{propName}</div>
                        {o.property_address && (
                          <div className="text-xs text-slate-400 truncate max-w-[180px]">{o.property_address}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600 font-medium">
                        {(o.collector_name || '').trim() || 'Non assigné'}
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-700 tabular-nums">
                        {formatXOF(rentDue, { compact: false })}
                      </td>
                      <td className="py-3.5 px-4 text-right text-emerald-600 font-medium tabular-nums">
                        {formatXOF(paid, { compact: false })}
                      </td>
                      <td className="py-3.5 px-4 text-right font-extrabold text-rose-600 tabular-nums">
                        {formatXOF(owed, { compact: false })}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2.5 py-1 bg-rose-50 text-rose-700 text-xs font-semibold rounded-full border border-rose-100">
                          {daysLate > 0 ? `${daysLate} j` : 'Mois en cours'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full border uppercase ${SEVERITY_BADGES[sev] || SEVERITY_BADGES.normale}`}>
                          {sev}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenReminderModal(o)}
                          className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                          title="Planifier une relance terrain, appel ou promesse"
                        >
                          <i className="fas fa-bullhorn text-[11px]"></i> Relancer
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="9" className="flex-col items-center justify-center py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <i className="fas fa-check-circle text-emerald-500 text-3xl mb-3"></i>
                      <h4 className="text-sm font-bold text-slate-700">Aucun impayé à signaler</h4>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section Historique des Relances Enregistrées */}
      {remindersHistory.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <i className="fas fa-history text-indigo-600"></i>
              Journal des Relances Enregistrées ({remindersHistory.length})
            </h4>
            <button
              type="button"
              onClick={() => setRemindersHistory([])}
              className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              Effacer l'historique
            </button>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {remindersHistory.map(rem => (
              <div key={rem.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{rem.clientName}</span>
                    <span className="text-slate-400">&bull;</span>
                    <span className="text-slate-600">{rem.propertyName}</span>
                    <span className="px-2 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase text-[10px]">
                      {rem.type}
                    </span>
                  </div>
                  {rem.notes && <p className="text-slate-600 mt-1 italic">{rem.notes}</p>}
                </div>
                <div className="text-right sm:min-w-[140px]">
                  {rem.promiseDate && (
                    <div className="font-semibold text-amber-700">
                      Promesse : {formatDate(rem.promiseDate)}
                    </div>
                  )}
                  <div className="text-[11px] text-slate-400">
                    {formatDate(rem.date)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
