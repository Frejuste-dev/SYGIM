import React from 'react';
import StatsCard from '../StatsCard';
import TableSkeleton from '../ui/TableSkeleton';
import { formatXOF, formatDate, formatMethod } from '../../utils/formatters';

export default function ReportOverviewTab({ dashboard, prefSummary = {}, loading = false, onNavigateTab }) {
  return (
    <div className="space-y-6">
      {/* Ligne 1 : KPIs Opérationnels & Encaissements */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          label="Revenus Encaissés"
          value={formatXOF(dashboard?.totalRevenue || 0)}
          icon="fa-money-bill-wave"
          color="var(--success)"
        />
        <StatsCard
          label="Taux de Recouvrement"
          value={`${dashboard?.collectionRate || 0}%`}
          icon="fa-chart-pie"
          color="var(--primary)"
        />
        <StatsCard
          label="Taux d'Occupation"
          value={`${dashboard?.occupancyRate || 0}% (${dashboard?.occupiedCount || 0}/${dashboard?.totalProperties || 0})`}
          icon="fa-home"
          color="#0284c7"
        />
        <StatsCard
          label="Créances Locataires"
          value={formatXOF(dashboard?.totalOverdue || 0)}
          icon="fa-exclamation-triangle"
          color="var(--danger)"
        />
      </div>

      {/* Ligne 2 : KPIs Reversements Propriétaires & Préfinancements */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          label="Reversé aux Propriétaires"
          value={formatXOF(dashboard?.totalDisbursed || 0)}
          icon="fa-hand-holding-dollar"
          color="#059669"
        />
        <StatsCard
          label="Total Préfinancé (Agence)"
          value={formatXOF(dashboard?.totalPrefinanced || 0)}
          icon="fa-bolt"
          color="var(--warning)"
        />
        <StatsCard
          label="Préfinancements Remboursés"
          value={formatXOF(dashboard?.reimbursedPrefinanced || 0)}
          icon="fa-check-double"
          color="#2563eb"
        />
        <StatsCard
          label="Commissions Agence"
          value={formatXOF(dashboard?.totalCommission || 0)}
          icon="fa-percent"
          color="#7c3aed"
        />
      </div>

      {/* Analyse visuelle : Répartition par mode de paiement & Synthèse Préfinancement */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Répartition des encaissements par moyen de paiement */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
          <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
            <i className="fas fa-wallet text-primary"></i>
            Répartition des Encaissements par Mode de Paiement
          </h3>
          <p className="text-xs text-slate-500 mb-5">Ventilation des loyers encaissés par canal de règlement</p>

          {(dashboard?.byMethod || []).length > 0 ? (
            <div className="space-y-4">
              {dashboard.byMethod.map((m, idx) => {
                const maxTotal = Math.max(1, dashboard.totalRevenue || 1);
                const pct = Math.min(100, Math.round((m.totalAmount / maxTotal) * 100));
                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-800">{formatMethod(m.method)}</span>
                      <span className="font-bold text-slate-900 tabular-nums">
                        {formatXOF(m.totalAmount, { compact: false })}{' '}
                        <span className="text-xs font-normal text-slate-500">({m.count} op. — {pct}%)</span>
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${Math.max(4, pct)}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-slate-400 text-sm">
              Aucune transaction ventilée sur cette période.
            </div>
          )}
        </div>

        {/* Encart de synthèse du Préfinancement Propriétaire */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <i className="fas fa-bolt text-amber-500"></i>
                Synthèse des Préfinancements Propriétaires
              </h3>
              <button
                type="button"
                onClick={() => onNavigateTab && onNavigateTab('prefinancing')}
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                Ouvrir le rapport complet <i className="fas fa-arrow-right text-[10px]"></i>
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Avances versées par l'agence aux propriétaires en attente du règlement des locataires
            </p>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200">
                <div className="text-xs font-semibold text-amber-800">Avances Actives (À recouvrer)</div>
                <div className="text-lg font-extrabold text-amber-900 mt-1 tabular-nums">
                  {formatXOF(prefSummary.activePrefinancedAmount || 0, { compact: false })}
                </div>
                <div className="text-[11px] text-amber-700 mt-0.5">
                  {prefSummary.activeCount || 0} dossier(s) en attente du locataire
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="text-xs font-semibold text-emerald-800">Avances Remboursées</div>
                <div className="text-lg font-extrabold text-emerald-900 mt-1 tabular-nums">
                  {formatXOF(prefSummary.reimbursedAmount || 0, { compact: false })}
                </div>
                <div className="text-[11px] text-emerald-700 mt-0.5">
                  {prefSummary.reimbursedCount || 0} dossier(s) régularisé(s) ({prefSummary.reimbursementRate || 0}%)
                </div>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
            <div className="text-xs text-slate-600">
              <span className="font-bold text-slate-900">{prefSummary.eligibleCount || 0} locataire(s)</span> en retard sur des biens de propriétaires ({formatXOF(prefSummary.totalEligibleArrears || 0)} d'arriérés).
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab && onNavigateTab('prefinancing')}
              className="shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              Voir les éligibles
            </button>
          </div>
        </div>
      </div>

      {/* Dernières transactions */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <div>
            <h4 className="text-base font-bold text-slate-900">Dernières Transactions Enregistrées</h4>
            <p className="text-xs text-slate-500">Flux récents d'encaissements locataires</p>
          </div>
        </div>

        {loading ? (
          <div className="overflow-x-auto min-w-0">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="py-3 px-4 font-semibold">Référence</th>
                  <th className="py-3 px-4 font-semibold">Locataire</th>
                  <th className="py-3 px-4 font-semibold">Bien immobilier</th>
                  <th className="py-3 px-4 font-semibold">Mode</th>
                  <th className="py-3 px-4 font-semibold">Date</th>
                  <th className="py-3 px-4 font-semibold text-right">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <TableSkeleton rows={4} columns={6} />
              </tbody>
            </table>
          </div>
        ) : dashboard?.recentTransactions && dashboard.recentTransactions.length > 0 ? (
          <div className="overflow-x-auto min-w-0">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="py-3 px-4 font-semibold">Référence</th>
                  <th className="py-3 px-4 font-semibold">Locataire</th>
                  <th className="py-3 px-4 font-semibold">Bien immobilier</th>
                  <th className="py-3 px-4 font-semibold">Mode</th>
                  <th className="py-3 px-4 font-semibold">Date</th>
                  <th className="py-3 px-4 font-semibold text-right">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dashboard.recentTransactions.map((tx, idx) => (
                  <tr key={tx.id || idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 text-xs font-mono font-semibold text-slate-600">{tx.reference}</td>
                    <td className="py-3 px-4 text-sm font-medium text-slate-900">{tx.client}</td>
                    <td className="py-3 px-4 text-xs text-slate-600">{tx.propertyName || '—'}</td>
                    <td className="py-3 px-4 text-sm">
                      <span className="px-2.5 py-1 bg-sky-50 text-sky-700 text-xs font-semibold rounded-full border border-sky-100">
                        {formatMethod(tx.method)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500">{formatDate(tx.date)}</td>
                    <td className="py-3 px-4 text-sm font-bold text-emerald-600 text-right tabular-nums">
                      {formatXOF(tx.amount, { compact: false })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 bg-slate-50 rounded-xl border border-slate-100">
            <i className="fas fa-inbox text-slate-400 text-3xl mb-3"></i>
            <h4 className="text-sm font-bold text-slate-700">Aucune transaction récente</h4>
          </div>
        )}
      </div>
    </div>
  );
}
