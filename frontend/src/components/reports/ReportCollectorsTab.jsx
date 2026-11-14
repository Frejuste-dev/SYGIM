import React from 'react';
import TableSkeleton from '../ui/TableSkeleton';
import { formatXOF, formatDate, formatMethod } from '../../utils/formatters';

export default function ReportCollectorsTab({
  collectors = [],
  recentTransactions = [],
  loading = false,
  handleExportTourneeExcel,
  handleExportCollectorsExcel,
  handleExportCollectorsPDF
}) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Performance des Récolteurs & Suivi Terrain</h3>
            <p className="text-slate-500 text-xs mt-0.5">
              Comparez les portefeuilles assignés, le volume de transactions et le taux de recouvrement par agent.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportTourneeExcel}
              className="px-3.5 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              title="Exporter la feuille de tournée pour le suivi des collecteurs terrain"
            >
              <i className="fas fa-map-marked-alt"></i> Feuille de Tournée
            </button>
            <button
              type="button"
              onClick={handleExportCollectorsExcel}
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <i className="fas fa-file-excel"></i> Excel
            </button>
            <button
              type="button"
              onClick={handleExportCollectorsPDF}
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
                <th className="py-3.5 px-4 font-semibold">Récolteur</th>
                <th className="py-3.5 px-4 font-semibold">Zone</th>
                <th className="py-3.5 px-4 font-semibold text-center">Portefeuille</th>
                <th className="py-3.5 px-4 font-semibold text-center">Transactions</th>
                <th className="py-3.5 px-4 font-semibold text-right">Objectif Attendu</th>
                <th className="py-3.5 px-4 font-semibold text-right">Total Collecté</th>
                <th className="py-3.5 px-4 font-semibold">Taux de Recouvrement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <TableSkeleton rows={5} columns={7} />
              ) : collectors.length > 0 ? (
                collectors.map((r, idx) => {
                  const rate = Number(r.recoveryRate || 0);
                  const barColor = rate >= 80 ? 'bg-emerald-500' : rate >= 50 ? 'bg-amber-500' : 'bg-rose-500';
                  return (
                    <tr key={r.collectorId || idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="text-sm font-bold text-slate-900">{r.collectorName}</div>
                        <div className="text-xs text-slate-400">{r.phone || ''}</div>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-medium text-slate-600">{r.zone || 'Toutes zones'}</td>
                      <td className="py-3.5 px-4 text-xs text-center text-slate-600">
                        <span className="font-semibold text-slate-800">{r.assignedPropertiesCount || 0}</span> bien(s) &bull;{' '}
                        <span className="font-semibold text-slate-800">{r.assignedClientsCount || 0}</span> loc.
                      </td>
                      <td className="py-3.5 px-4 text-sm font-semibold text-center text-slate-700">
                        {r.transactionCount}
                      </td>
                      <td className="py-3.5 px-4 text-sm text-right text-slate-700 tabular-nums">
                        {formatXOF(r.targetAmount || 0, { compact: false })}
                      </td>
                      <td className="py-3.5 px-4 text-sm font-bold text-emerald-600 text-right tabular-nums">
                        {formatXOF(r.totalCollected, { compact: false })}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, rate)}%` }}></div>
                          </div>
                          <span className="text-xs font-bold text-slate-700 w-9 text-right tabular-nums">{rate}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <i className="fas fa-users text-slate-400 text-3xl mb-3"></i>
                      <h4 className="text-sm font-bold text-slate-700">Aucun récolteur à afficher</h4>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tableau 2 : Journal Opérationnel des Encaissements Terrain */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <i className="fas fa-receipt text-emerald-600"></i>
              Journal Opérationnel des Encaissements Terrain
            </h4>
            <p className="text-slate-500 text-xs mt-0.5">
              Flux des paiements collectés par vos équipes sur le terrain (date, collecteur, locataire, bien, montant).
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg">
            {recentTransactions.length} transaction(s) récente(s)
          </span>
        </div>

        <div className="overflow-x-auto min-w-0">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                <th className="py-3 px-4">Date & Réf.</th>
                <th className="py-3 px-4">Collecteur</th>
                <th className="py-3 px-4">Locataire</th>
                <th className="py-3 px-4">Bien Immobilier</th>
                <th className="py-3 px-4">Moyen</th>
                <th className="py-3 px-4 text-right">Montant Encaissé</th>
                <th className="py-3 px-4 text-center">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <TableSkeleton rows={4} columns={7} />
              ) : recentTransactions.length > 0 ? (
                recentTransactions.map((tx, idx) => (
                  <tr key={tx.id || idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-mono text-xs font-bold text-slate-800">{tx.reference || `TX-${tx.id}`}</div>
                      <div className="text-[11px] text-slate-400">{formatDate(tx.date || tx.created_at)}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-xs font-bold text-slate-800">{tx.collectorName || tx.collector_name || 'Terrain'}</div>
                      {tx.zone && <div className="text-[10px] text-slate-500 font-medium">{tx.zone}</div>}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900 text-xs">
                      {tx.client || tx.tenant_name || '—'}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700">
                      {tx.propertyName || tx.property_name || '—'}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {formatMethod(tx.method || tx.payment_method)}
                    </td>
                    <td className="py-3 px-4 text-right font-extrabold text-emerald-600 tabular-nums">
                      {formatXOF(tx.amount || 0, { compact: false })}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Validé
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="py-10 text-center text-slate-400 text-sm">
                    Aucune transaction récente enregistrée sur le terrain.
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
