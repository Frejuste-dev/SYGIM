import React, { useState, useMemo } from 'react';
import { useAgedReceivables } from '../../hooks/queries/useReports';
import TableSkeleton from '../ui/TableSkeleton';
import { formatXOF } from '../../utils/formatters';
import { exportToExcel } from '../../utils/exportUtils';

export default function ReportAgedReceivablesTab() {
  const [search, setSearch] = useState('');
  const { data: agedData = {}, isLoading } = useAgedReceivables({ search });

  const summary = agedData?.summary || {};
  const clients = agedData?.clients || [];

  const handleExportCSV = () => {
    if (!clients.length) return;
    const exportRows = clients.map((c, i) => ({
      index: i + 1,
      clientName: c.clientName,
      phone: c.phone,
      property: `${c.propertyReference} - ${c.propertyName}`,
      zone: c.propertyZone,
      owner: c.ownerName,
      monthlyRent: c.monthlyRent,
      bucket_0_30: c.bucket_0_30,
      bucket_31_60: c.bucket_31_60,
      bucket_61_90: c.bucket_61_90,
      bucket_over_90: c.bucket_over_90,
      totalDue: c.totalDue,
      maxDaysOverdue: c.maxDaysOverdue
    }));

    exportToExcel(
      exportRows,
      `sygim_balance_agee_${new Date().toISOString().slice(0, 10)}.xls`,
      {
        index: 'N°',
        clientName: 'Locataire',
        phone: 'Téléphone',
        property: 'Bien immobilier',
        zone: 'Zone / Quartier',
        owner: 'Propriétaire',
        monthlyRent: 'Loyer mensuel (XOF)',
        bucket_0_30: '0 à 30 jours (XOF)',
        bucket_31_60: '31 à 60 jours (XOF)',
        bucket_61_90: '61 à 90 jours (XOF)',
        bucket_over_90: '> 90 jours (Contentieux) (XOF)',
        totalDue: 'Total Arriéré (XOF)',
        maxDaysOverdue: 'Retard max (jours)'
      },
      'Balance Âgée Locataires — SYGIM'
    );
  };

  return (
    <div className="space-y-6">
      {/* 1. EN-TÊTE & CARTES KPI PAR TRANCHE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 0 - 30 Jours */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-sm transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              0 à 30 Jours (Courant)
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs">
              <i className="fas fa-calendar-check"></i>
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tabular-nums tracking-tight">
            {formatXOF(summary.bucket_0_30?.amount || 0, { compact: false })}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
            <span>Part du risque : <strong className="text-emerald-700">{summary.bucket_0_30?.pct || 0}%</strong></span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px]">
              {summary.bucket_0_30?.count || 0} dossier(s)
            </span>
          </div>
        </div>

        {/* 31 - 60 Jours */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-sm transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              31 à 60 Jours (Relance)
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center text-xs">
              <i className="fas fa-bell"></i>
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tabular-nums tracking-tight">
            {formatXOF(summary.bucket_31_60?.amount || 0, { compact: false })}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
            <span>Part du risque : <strong className="text-amber-700">{summary.bucket_31_60?.pct || 0}%</strong></span>
            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-bold text-[10px]">
              {summary.bucket_31_60?.count || 0} dossier(s)
            </span>
          </div>
        </div>

        {/* 61 - 90 Jours */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-sm transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              61 à 90 Jours (Mise en demeure)
            </span>
            <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center text-xs">
              <i className="fas fa-triangle-exclamation"></i>
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tabular-nums tracking-tight">
            {formatXOF(summary.bucket_61_90?.amount || 0, { compact: false })}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
            <span>Part du risque : <strong className="text-orange-700">{summary.bucket_61_90?.pct || 0}%</strong></span>
            <span className="px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200 font-bold text-[10px]">
              {summary.bucket_61_90?.count || 0} dossier(s)
            </span>
          </div>
        </div>

        {/* > 90 Jours (Risque Contentieux) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-sm transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              &gt; 90 Jours (Contentieux)
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center text-xs">
              <i className="fas fa-gavel"></i>
            </div>
          </div>
          <div className="text-2xl font-black text-rose-700 tabular-nums tracking-tight">
            {formatXOF(summary.bucket_over_90?.amount || 0, { compact: false })}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
            <span>Contentieux avocat : <strong className="text-rose-700">{summary.bucket_over_90?.pct || 0}%</strong></span>
            <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[10px]">
              {summary.bucket_over_90?.count || 0} dossier(s)
            </span>
          </div>
        </div>
      </div>

      {/* 2. BARRE DE FILTRES ET ACTION EXPORT */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher locataire, bien, propriétaire..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-primary focus:bg-white transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={!clients.length}
            className="px-3.5 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
          >
            <i className="fas fa-file-excel"></i>
            <span>Exporter Balance Âgée (Excel)</span>
          </button>
        </div>
      </div>

      {/* 3. TABLEAU MATRICIEL BALANCE ÂGÉE */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <i className="fas fa-history text-primary"></i>
            <span>Matrice Âgée des Créances Locatives</span>
          </div>
          <div className="text-xs text-slate-500 font-medium">
            <span className="font-bold text-slate-800">{clients.length}</span> locataire(s) avec arriéré
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-3 w-12 text-center">N°</th>
                <th className="py-3.5 px-4">Locataire &amp; Contact</th>
                <th className="py-3.5 px-4">Bien &amp; Zone</th>
                <th className="py-3.5 px-4">Propriétaire</th>
                <th className="py-3.5 px-3 text-right">Loyer Mensuel</th>
                <th className="py-3.5 px-3 text-right">0 - 30 Jours</th>
                <th className="py-3.5 px-3 text-right">31 - 60 Jours</th>
                <th className="py-3.5 px-3 text-right">61 - 90 Jours</th>
                <th className="py-3.5 px-3 text-right">&gt; 90 Jours</th>
                <th className="py-3.5 px-4 text-right font-black text-slate-900">Total Arriéré</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <TableSkeleton rows={6} columns={10} />
              ) : clients.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-slate-500">
                    <i className="fas fa-check-circle text-3xl text-emerald-500 mb-2"></i>
                    <p className="text-sm font-semibold text-slate-700">Aucun arriéré locatif constaté.</p>
                    <p className="text-xs text-slate-400 mt-1">Tous les locataires sont à jour de leurs loyers.</p>
                  </td>
                </tr>
              ) : (
                clients.map((c, idx) => (
                  <tr key={c.clientId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-3 text-center text-slate-400 font-semibold tabular-nums">
                      {String(idx + 1).padStart(2, '0')}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{c.clientName}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span><i className="fas fa-phone-alt text-[10px] text-slate-400 mr-1"></i>{c.phone}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800">{c.propertyName}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{c.propertyReference} &bull; {c.propertyZone}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-medium">
                      {c.ownerName}
                    </td>
                    <td className="py-3.5 px-3 text-right font-semibold text-slate-700 tabular-nums">
                      {formatXOF(c.monthlyRent, { compact: false })}
                    </td>
                    <td className={`py-3.5 px-3 text-right tabular-nums ${c.bucket_0_30 > 0 ? 'font-bold text-emerald-700 bg-emerald-50/30' : 'text-slate-300'}`}>
                      {c.bucket_0_30 > 0 ? formatXOF(c.bucket_0_30, { compact: false }) : '—'}
                    </td>
                    <td className={`py-3.5 px-3 text-right tabular-nums ${c.bucket_31_60 > 0 ? 'font-bold text-amber-700 bg-amber-50/30' : 'text-slate-300'}`}>
                      {c.bucket_31_60 > 0 ? formatXOF(c.bucket_31_60, { compact: false }) : '—'}
                    </td>
                    <td className={`py-3.5 px-3 text-right tabular-nums ${c.bucket_61_90 > 0 ? 'font-bold text-orange-700 bg-orange-50/30' : 'text-slate-300'}`}>
                      {c.bucket_61_90 > 0 ? formatXOF(c.bucket_61_90, { compact: false }) : '—'}
                    </td>
                    <td className={`py-3.5 px-3 text-right tabular-nums ${c.bucket_over_90 > 0 ? 'font-black text-rose-700 bg-rose-50/40' : 'text-slate-300'}`}>
                      {c.bucket_over_90 > 0 ? formatXOF(c.bucket_over_90, { compact: false }) : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-slate-900 tabular-nums">
                      {formatXOF(c.totalDue, { compact: false })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {!isLoading && clients.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                  <td colSpan={5} className="py-3.5 px-4 text-right uppercase tracking-wider text-xs">
                    TOTAL GÉNÉRAL BALANCE ÂGÉE :
                  </td>
                  <td className="py-3.5 px-3 text-right text-emerald-800 tabular-nums">
                    {formatXOF(summary.bucket_0_30?.amount || 0, { compact: false })}
                  </td>
                  <td className="py-3.5 px-3 text-right text-amber-800 tabular-nums">
                    {formatXOF(summary.bucket_31_60?.amount || 0, { compact: false })}
                  </td>
                  <td className="py-3.5 px-3 text-right text-orange-800 tabular-nums">
                    {formatXOF(summary.bucket_61_90?.amount || 0, { compact: false })}
                  </td>
                  <td className="py-3.5 px-3 text-right text-rose-800 tabular-nums">
                    {formatXOF(summary.bucket_over_90?.amount || 0, { compact: false })}
                  </td>
                  <td className="py-3.5 px-4 text-right text-slate-900 text-sm tabular-nums">
                    {formatXOF(summary.totalAgedOverdue || 0, { compact: false })}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
