import React from 'react';
import TableSkeleton from '../ui/TableSkeleton';
import { formatXOF, formatStatus } from '../../utils/formatters';

export default function ReportPropertiesTab({
  properties = [],
  dashboard = {},
  loading = false,
  propertyFilter = 'all',
  setPropertyFilter,
  handleExportPropertiesExcel,
  handleExportPropertiesPDF
}) {
  const filteredProperties = properties.filter(p => {
    if (propertyFilter === 'all') return true;
    const s = (p.status || '').toLowerCase();
    if (propertyFilter === 'vacant') return ['vacant', 'disponible'].includes(s);
    if (propertyFilter === 'occupied') return ['occupied', 'loué', 'loue'].includes(s);
    if (propertyFilter === 'maintenance') return ['maintenance', 'en_reparation', 'en_travaux'].includes(s);
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Cartes d'État Opérationnel du Parc */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Parc Immobilier Total</div>
          <div className="text-2xl font-black text-slate-900 mt-1 tabular-nums">
            {properties.reduce((s, p) => s + Number(p.count || 0), 0)} biens
          </div>
          <div className="text-xs text-slate-400 mt-0.5">Sous gestion opérationnelle</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/20">
          <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Biens Occupés (Loués)</div>
          <div className="text-2xl font-black text-emerald-700 mt-1 tabular-nums">
            {properties.find(p => ['occupied', 'loué', 'loue'].includes((p.status || '').toLowerCase()))?.count || 0}
          </div>
          <div className="text-xs text-emerald-600 mt-0.5 font-medium">
            Taux d'occupation : {dashboard?.occupancyRate || 0}%
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/20">
          <div className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Logements Vacants</div>
          <div className="text-2xl font-black text-amber-700 mt-1 tabular-nums">
            {properties.find(p => ['vacant', 'disponible'].includes((p.status || '').toLowerCase()))?.count || 0}
          </div>
          <div className="text-xs text-amber-600 mt-0.5 font-medium">À commercialiser / Relouer</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-blue-200 bg-blue-50/20">
          <div className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider">Biens en Travaux / Réparation</div>
          <div className="text-2xl font-black text-blue-700 mt-1 tabular-nums">
            {properties.find(p => ['maintenance', 'en_reparation', 'en_travaux'].includes((p.status || '').toLowerCase()))?.count || 0}
          </div>
          <div className="text-xs text-blue-600 mt-0.5 font-medium">Chantiers & Remise en état</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">État du Parc : Occupation, Vacances & Travaux</h3>
            <p className="text-slate-500 text-xs mt-0.5">
              Visualisez l'état du portefeuille immobilier, les potentiels locatifs et le suivi de commercialisation.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={propertyFilter}
              onChange={(e) => setPropertyFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
            >
              <option value="all">Tous les statuts ({properties.length})</option>
              <option value="vacant">Biens Vacants (Disponibles)</option>
              <option value="maintenance">Biens en Réparation (Travaux)</option>
              <option value="occupied">Biens Loués (Occupés)</option>
            </select>

            <button
              type="button"
              onClick={handleExportPropertiesExcel}
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <i className="fas fa-file-excel"></i> Excel
            </button>
            <button
              type="button"
              onClick={handleExportPropertiesPDF}
              className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <i className="fas fa-file-pdf"></i> PDF
            </button>
          </div>
        </div>

        <div className="overflow-x-auto min-w-0">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                <th className="py-3.5 px-6 font-semibold">Statut d'Occupation</th>
                <th className="py-3.5 px-6 font-semibold">Nombre de biens</th>
                <th className="py-3.5 px-6 font-semibold">Part du parc</th>
                <th className="py-3.5 px-6 font-semibold text-right">Potentiel Locatif Mensuel</th>
                <th className="py-3.5 px-6 font-semibold text-right">Valeur Estimée</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <TableSkeleton rows={4} columns={5} />
              ) : filteredProperties.length > 0 ? (
                filteredProperties.map((p, idx) => {
                  const ps = formatStatus(p.status);
                  return (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-6 text-sm">
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${ps.twClass}`}>
                          {ps.label || p.status || 'Inconnu'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-sm font-bold text-slate-900 tabular-nums">{p.count} bien(s)</td>
                      <td className="py-4 px-6 text-sm text-slate-600 tabular-nums">{p.percentage || 0}%</td>
                      <td className="py-4 px-6 text-sm font-bold text-emerald-700 text-right tabular-nums">
                        {formatXOF(p.totalRent, { compact: false })}
                      </td>
                      <td className="py-4 px-6 text-sm font-medium text-slate-800 text-right tabular-nums">
                        {formatXOF(p.totalValue || 0, { compact: false })}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <i className="fas fa-building text-slate-400 text-3xl mb-3"></i>
                      <h4 className="text-sm font-bold text-slate-700">Aucune statistique immobilière</h4>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
