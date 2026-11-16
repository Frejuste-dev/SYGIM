import React, { useState, useEffect } from 'react';
import { useOwners } from '../../hooks/queries/useOwners';
import { useOwnerLedger } from '../../hooks/queries/useReports';
import TableSkeleton from '../ui/TableSkeleton';
import { formatXOF, formatDate } from '../../utils/formatters';
import { exportToExcel } from '../../utils/exportUtils';

export default function ReportOwnerLedgerTab() {
  const { data: ownersData = {} } = useOwners({ limit: 100 });
  const owners = Array.isArray(ownersData) ? ownersData : (ownersData?.data || []);

  const [selectedOwnerId, setSelectedOwnerId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (!selectedOwnerId && owners.length > 0) {
      setSelectedOwnerId(String(owners[0].id));
    }
  }, [owners, selectedOwnerId]);

  const { data: ledgerData = {}, isLoading } = useOwnerLedger(
    selectedOwnerId,
    { startDate: startDate || undefined, endDate: endDate || undefined },
    { enabled: Boolean(selectedOwnerId) }
  );

  const owner = ledgerData?.owner || {};
  const summary = ledgerData?.summary || {};
  const entries = ledgerData?.entries || [];

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (!entries.length) return;
    const exportRows = entries.map((e, idx) => ({
      index: idx + 1,
      date: formatDate(e.date),
      reference: e.reference,
      category: e.category,
      label: e.label,
      property: `${e.propertyReference} - ${e.propertyName}`,
      credit: e.credit,
      debit: e.debit,
      runningBalance: e.runningBalance
    }));

    exportToExcel(
      exportRows,
      `sygim_compte_courant_${owner.name?.replace(/\s+/g, '_') || 'bailleur'}_${new Date().toISOString().slice(0, 10)}.xls`,
      {
        index: 'N°',
        date: 'Date écriture',
        reference: 'Réf. pièce',
        category: 'Catégorie',
        label: 'Libellé de l\'écriture',
        property: 'Bien immobilier',
        credit: 'Crédit (+) (XOF)',
        debit: 'Débit (-) (XOF)',
        runningBalance: 'Solde progressif (XOF)'
      },
      `Extrait de Compte Courant — ${owner.name || 'Propriétaire'}`
    );
  };

  return (
    <div className="space-y-6">
      {/* 1. SÉLECTEUR DE PROPRIÉTAIRE ET FILTRES (MASQUÉ À L'IMPRESSION) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs print:hidden space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Extrait de Compte Courant Bailleur</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Historique chronologique des encaissements (crédit), reversements et déductions (débit) avec solde progressif.
            </p>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <button
              type="button"
              onClick={handlePrint}
              disabled={!entries.length}
              className="px-3.5 py-2 bg-primary text-white rounded-xl text-xs font-bold shadow-xs hover:bg-primary-dark transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <i className="fas fa-print"></i>
              <span>Imprimer Extrait A4</span>
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={!entries.length}
              className="px-3.5 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <i className="fas fa-file-excel"></i>
              <span>Excel</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Propriétaire <span className="text-rose-600">*</span>
            </label>
            <select
              value={selectedOwnerId}
              onChange={(e) => setSelectedOwnerId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-primary focus:bg-white"
            >
              {owners.map(o => (
                <option key={o.id} value={o.id}>
                  {o.name || `${o.first_name || ''} ${o.last_name || ''}`.trim()} ({o.phone || 'Sans contact'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Date de début
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-primary focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Date de fin
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-primary focus:bg-white"
            />
          </div>
        </div>
      </div>

      {/* 2. CARTES KPI CRÉDIT / DÉBIT / SOLDE */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-emerald-100 shadow-2xs">
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-1">
            Total Crédits (Loyers Encaissés)
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-700 tabular-nums">
            {formatXOF(summary.totalCredit || 0, { compact: false })}
          </div>
          <div className="text-xs text-slate-500 mt-1">Fonds encaissés pour le compte du bailleur</div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-rose-100 shadow-2xs">
          <div className="text-xs font-bold uppercase tracking-wider text-rose-700 mb-1">
            Total Débits (Reversements &amp; Frais)
          </div>
          <div className="text-xl sm:text-2xl font-black text-rose-700 tabular-nums">
            {formatXOF(summary.totalDebit || 0, { compact: false })}
          </div>
          <div className="text-xs text-slate-500 mt-1">Virements émis, commissions et réparations</div>
        </div>

        <div className={`bg-white p-4 sm:p-5 rounded-2xl border shadow-2xs ${
          (summary.netBalance || 0) >= 0 ? 'border-primary/20 bg-primary/5' : 'border-amber-200 bg-amber-50/30'
        }`}>
          <div className="text-xs font-bold uppercase tracking-wider text-primary mb-1">
            Solde Courant Net
          </div>
          <div className={`text-xl sm:text-2xl font-black tabular-nums ${
            (summary.netBalance || 0) >= 0 ? 'text-primary' : 'text-amber-800'
          }`}>
            {formatXOF(summary.netBalance || 0, { compact: false })}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {(summary.netBalance || 0) >= 0 ? 'Fonds disponibles à reverser au bailleur' : 'Avances excédentaires / Solde débiteur'}
          </div>
        </div>
      </div>

      {/* 3. TABLEAU CHRONOLOGIQUE DES ÉCRITURES */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden print:border-none print:shadow-none">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="font-bold text-slate-900 text-sm">
            Relevé des Mouvements &bull; {owner.name || 'Propriétaire'}
          </div>
          <div className="text-xs text-slate-500">
            {entries.length} opération(s) enregistrée(s)
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <TableSkeleton rows={6} cols={8} />
          ) : entries.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <i className="fas fa-file-invoice text-3xl text-slate-300 mb-2"></i>
              <p className="text-sm font-semibold text-slate-700">Aucune écriture comptable sur cette période.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-3 w-28">Date</th>
                  <th className="py-3 px-3 w-28">Réf.</th>
                  <th className="py-3 px-3 w-24">Catégorie</th>
                  <th className="py-3 px-4">Libellé de l'Opération</th>
                  <th className="py-3 px-4">Bien Rattaché</th>
                  <th className="py-3 px-3 text-right text-emerald-800 bg-emerald-50/50">Crédit (+)</th>
                  <th className="py-3 px-3 text-right text-rose-800 bg-rose-50/50">Débit (-)</th>
                  <th className="py-3 px-4 text-right font-black text-slate-900 bg-slate-100/60">Solde Progressif</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map((e) => (
                  <tr key={e.id + e.reference} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 text-slate-600 whitespace-nowrap font-medium">
                      {formatDate(e.date)}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-700">
                      {e.reference}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                        e.category === 'LOYER'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : e.category === 'COMMISSION'
                            ? 'bg-sky-50 text-sky-800 border-sky-200'
                            : e.category === 'TRAVAUX'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        {e.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-900 font-medium">
                      {e.label}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {e.propertyName}
                    </td>
                    <td className={`py-3 px-3 text-right tabular-nums ${e.credit > 0 ? 'font-bold text-emerald-700 bg-emerald-50/20' : 'text-slate-300'}`}>
                      {e.credit > 0 ? `+ ${formatXOF(e.credit, { compact: false })}` : '—'}
                    </td>
                    <td className={`py-3 px-3 text-right tabular-nums ${e.debit > 0 ? 'font-bold text-rose-700 bg-rose-50/20' : 'text-slate-300'}`}>
                      {e.debit > 0 ? `- ${formatXOF(e.debit, { compact: false })}` : '—'}
                    </td>
                    <td className={`py-3 px-4 text-right font-black tabular-nums bg-slate-50/30 ${
                      e.runningBalance >= 0 ? 'text-slate-900' : 'text-rose-700'
                    }`}>
                      {formatXOF(e.runningBalance, { compact: false })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
