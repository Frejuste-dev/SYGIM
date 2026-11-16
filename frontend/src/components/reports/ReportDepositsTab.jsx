import React, { useState } from 'react';
import { useDepositsReport } from '../../hooks/queries/useReports';
import TableSkeleton from '../ui/TableSkeleton';
import { formatXOF } from '../../utils/formatters';
import { exportToExcel } from '../../utils/exportUtils';

export default function ReportDepositsTab() {
  const [search, setSearch] = useState('');
  const { data: depositsData = {}, isLoading } = useDepositsReport({ search });

  const summary = depositsData?.summary || {};
  const items = depositsData?.items || [];

  const handleExportCSV = () => {
    if (!items.length) return;
    const exportRows = items.map((item, idx) => ({
      index: idx + 1,
      clientName: item.clientName,
      phone: item.clientPhone,
      clientStatus: item.clientStatus,
      property: `${item.propertyReference} - ${item.propertyName}`,
      zone: item.propertyZone,
      owner: item.ownerName,
      monthlyRent: item.monthlyRent,
      deposit: item.deposit,
      arrears: item.arrears,
      retainedForArrears: item.retainedForArrears,
      netRefundableAfterArrears: item.netRefundableAfterArrears,
    }));

    exportToExcel(
      exportRows,
      `sygim_inventaire_cautions_${new Date().toISOString().slice(0, 10)}.xls`,
      {
        index: 'N°',
        clientName: 'Locataire',
        phone: 'Téléphone',
        clientStatus: 'Statut du Bail',
        property: 'Bien immobilier',
        zone: 'Zone / Quartier',
        owner: 'Propriétaire',
        monthlyRent: 'Loyer mensuel (XOF)',
        deposit: 'Caution Détenue (XOF)',
        arrears: 'Arriérés Locataire (XOF)',
        retainedForArrears: 'Retenu sur dette (XOF)',
        netRefundableAfterArrears: 'Net Restituable (XOF)'
      },
      'Inventaire des Cautions & Dépôts de Garantie — SYGIM'
    );
  };

  return (
    <div className="space-y-6">
      {/* 1. CARTES SYNTHÈSE DES CAUTIONS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-sky-100 shadow-2xs">
          <div className="text-xs font-bold uppercase tracking-wider text-sky-700 mb-1 flex items-center justify-between">
            <span>Total Cautions Détenues</span>
            <span className="px-2 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-[10px]">
              {summary.totalDepositsCount || 0} bailleur(s)
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 tabular-nums">
            {formatXOF(summary.totalDepositsHeld || 0, { compact: false })}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            Fonds séquestre garantissant les baux
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-emerald-100 shadow-2xs">
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-1 flex items-center justify-between">
            <span>Baux Actifs en Cours</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px]">
              {summary.activeDeposits?.count || 0} locataire(s)
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-700 tabular-nums">
            {formatXOF(summary.activeDeposits?.amount || 0, { compact: false })}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            Garanties actives non exigibles
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-amber-100 shadow-2xs">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-1 flex items-center justify-between">
            <span>Baux Clôturés (En Sortie)</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[10px]">
              {summary.departedDeposits?.count || 0} dossier(s)
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-800 tabular-nums">
            {formatXOF(summary.departedDeposits?.amount || 0, { compact: false })}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            En instance de restitution / apurement
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-indigo-100 shadow-2xs">
          <div className="text-xs font-bold uppercase tracking-wider text-indigo-700 mb-1 flex items-center justify-between">
            <span>Solde Net Restituable</span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-[10px]">
              Après déductions
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-indigo-700 tabular-nums">
            {formatXOF(summary.totalNetRefundable || 0, { compact: false })}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            Retenues arriérés : {formatXOF(summary.totalRetainedForArrears || 0)}
          </div>
        </div>
      </div>

      {/* 2. RECHERCHE ET EXPORT */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher locataire, bien, propriétaire..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-primary focus:bg-white"
          />
        </div>

        <button
          type="button"
          onClick={handleExportCSV}
          disabled={!items.length}
          className="px-3.5 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <i className="fas fa-file-excel"></i>
          <span>Exporter Cautions (Excel)</span>
        </button>
      </div>

      {/* 3. TABLEAU INVENTAIRE DES CAUTIONS */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <TableSkeleton rows={6} cols={9} />
          ) : items.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <i className="fas fa-shield-alt text-3xl text-slate-300 mb-2"></i>
              <p className="text-sm font-semibold text-slate-700">Aucun dépôt de garantie répertorié.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-3 w-10 text-center">N°</th>
                  <th className="py-3 px-4">Locataire &amp; Contact</th>
                  <th className="py-3 px-4">Bien &amp; Zone</th>
                  <th className="py-3 px-3">Statut Bail</th>
                  <th className="py-3 px-3 text-right">Loyer Mensuel</th>
                  <th className="py-3 px-3 text-right text-sky-800 bg-sky-50/50">Caution Détenue</th>
                  <th className="py-3 px-3 text-right text-rose-800 bg-rose-50/50">Arriérés Dûs</th>
                  <th className="py-3 px-3 text-right text-amber-800 bg-amber-50/50">Retenu s/ Dette</th>
                  <th className="py-3 px-4 text-right font-black text-slate-900 bg-emerald-50/50">Net Restituable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((it, idx) => (
                  <tr key={it.clientId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 text-center text-slate-400 font-semibold tabular-nums">
                      {String(idx + 1).padStart(2, '0')}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{it.clientName}</div>
                      <div className="text-[11px] text-slate-500">{it.clientPhone}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">{it.propertyName}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{it.propertyReference} &bull; {it.propertyZone}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        it.isDeparted ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      }`}>
                        {it.clientStatus}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-slate-700 tabular-nums">
                      {formatXOF(it.monthlyRent, { compact: false })}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-sky-800 tabular-nums bg-sky-50/20">
                      {formatXOF(it.deposit, { compact: false })}
                    </td>
                    <td className={`py-3 px-3 text-right tabular-nums ${it.arrears > 0 ? 'font-bold text-rose-700 bg-rose-50/20' : 'text-slate-300'}`}>
                      {it.arrears > 0 ? formatXOF(it.arrears, { compact: false }) : '0 XOF'}
                    </td>
                    <td className={`py-3 px-3 text-right tabular-nums ${it.retainedForArrears > 0 ? 'font-bold text-amber-700 bg-amber-50/20' : 'text-slate-300'}`}>
                      {it.retainedForArrears > 0 ? formatXOF(it.retainedForArrears, { compact: false }) : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-emerald-800 tabular-nums bg-emerald-50/20">
                      {formatXOF(it.netRefundableAfterArrears, { compact: false })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                  <td colSpan={5} className="py-3.5 px-4 text-right uppercase tracking-wider text-xs">
                    TOTAL DES CAUTIONS :
                  </td>
                  <td className="py-3.5 px-3 text-right text-sky-800 tabular-nums">
                    {formatXOF(summary.totalDepositsHeld || 0, { compact: false })}
                  </td>
                  <td className="py-3.5 px-3 text-right text-rose-800 tabular-nums">
                    —
                  </td>
                  <td className="py-3.5 px-3 text-right text-amber-800 tabular-nums">
                    {formatXOF(summary.totalRetainedForArrears || 0, { compact: false })}
                  </td>
                  <td className="py-3.5 px-4 text-right text-emerald-800 text-sm tabular-nums">
                    {formatXOF(summary.totalNetRefundable || 0, { compact: false })}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
