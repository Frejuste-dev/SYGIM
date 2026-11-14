import React from 'react';
import StatsCard from '../StatsCard';
import TableSkeleton from '../ui/TableSkeleton';
import { formatXOF, formatDate, formatMethod } from '../../utils/formatters';
import { printOwnerSettlementReceipt } from '../../utils/exportUtils';

export default function ReportPrefinancingTab({
  prefinancingData,
  loading = false,
  handleExportPrefinancingExcel,
  handleExportPrefinancingPDF,
  handleOpenPrefinanceForCase
}) {
  const prefSummary = prefinancingData?.summary || {};
  const prefinancingsList = prefinancingData?.prefinancings || [];
  const eligiblePrefList = prefinancingData?.eligibleCases || [];

  return (
    <div className="space-y-6">
      {/* KPIs du Rapport de Préfinancement */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          label="Total Préfinancé (Agence)"
          value={formatXOF(prefSummary.totalPrefinancedAmount || 0, { compact: false })}
          icon="fa-bolt"
          color="var(--warning)"
        />
        <StatsCard
          label="Avances Actives (À recouvrer)"
          value={formatXOF(prefSummary.activePrefinancedAmount || 0, { compact: false })}
          icon="fa-clock"
          color="var(--danger)"
        />
        <StatsCard
          label="Préfinancements Remboursés"
          value={`${formatXOF(prefSummary.reimbursedAmount || 0)} (${prefSummary.reimbursementRate || 0}%)`}
          icon="fa-check-circle"
          color="var(--success)"
        />
        <StatsCard
          label="Impayés Éligibles au Préfinancement"
          value={formatXOF(prefSummary.totalEligibleArrears || 0, { compact: false })}
          icon="fa-hand-holding-dollar"
          color="var(--primary)"
        />
      </div>

      {/* Tableau 1 : Journal Officiel des Préfinancements Accordés */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <i className="fas fa-bolt text-amber-500"></i>
              Journal des Préfinancements Propriétaires Accordés
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Avances versées aux propriétaires avant le paiement du locataire et suivi du remboursement automatique.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportPrefinancingExcel}
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <i className="fas fa-file-excel"></i> Excel
            </button>
            <button
              type="button"
              onClick={handleExportPrefinancingPDF}
              className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <i className="fas fa-file-pdf"></i> PDF
            </button>
            <button
              type="button"
              onClick={() => handleOpenPrefinanceForCase(null)}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <i className="fas fa-plus"></i> Enregistrer un Préfinancement
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase">
                <th className="py-3 px-4">Réf. & Date</th>
                <th className="py-3 px-4">Propriétaire</th>
                <th className="py-3 px-4">Bien(s) & Période</th>
                <th className="py-3 px-4 text-right">Loyer Attendu</th>
                <th className="py-3 px-4 text-right">Avance Versée</th>
                <th className="py-3 px-4 text-right">Recouvré Locataire</th>
                <th className="py-3 px-4 text-right">Reste à Recouvrer</th>
                <th className="py-3 px-4">Statut</th>
                <th className="py-3 px-4 text-right">Bordereau</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <TableSkeleton rows={5} columns={9} />
              ) : prefinancingsList.length > 0 ? (
                prefinancingsList.map(item => {
                  const isReimbursed = item.status === 'reimbursed';
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-mono text-xs font-bold text-slate-800">{item.reference}</div>
                        <div className="text-xs text-slate-400">{formatDate(item.payout_date)}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{item.owner_name}</div>
                        <div className="text-xs text-slate-500">{formatMethod(item.payment_method)}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-xs font-semibold text-slate-800">{item.property_name}</div>
                        <div className="text-[11px] text-slate-400">
                          Du {formatDate(item.period_start)} au {formatDate(item.period_end)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-slate-700 tabular-nums">
                        {formatXOF(item.expected_rent, { compact: false })}
                      </td>
                      <td className="py-3.5 px-4 text-right font-extrabold text-amber-700 tabular-nums">
                        {formatXOF(item.amount_paid, { compact: false })}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-emerald-700 tabular-nums">
                        {formatXOF(item.total_collected, { compact: false })}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-rose-600 tabular-nums">
                        {formatXOF(item.unrecovered_amount, { compact: false })}
                      </td>
                      <td className="py-3.5 px-4">
                        {isReimbursed ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <i className="fas fa-check-double text-[10px]"></i> Remboursé (Locataire)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
                            <i className="fas fa-bolt text-[10px] text-amber-600"></i> Préfinancé (Actif)
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => printOwnerSettlementReceipt(item)}
                          className="px-2.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                          title="Imprimer le Bordereau Officiel de Préfinancement"
                        >
                          <i className="fas fa-print"></i> Reçu PDF
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="9" className="p-10 text-center bg-slate-50/50">
                    <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-3 text-xl">
                      <i className="fas fa-bolt"></i>
                    </div>
                    <h4 className="text-sm font-bold text-slate-800">Aucun préfinancement enregistré sur la période</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                      Vous pouvez déclencher un préfinancement ci-dessous pour tout propriétaire dont le locataire est en retard de paiement.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tableau 2 : Dossiers Locataires en Impayé Éligibles au Préfinancement */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <i className="fas fa-user-clock text-rose-500"></i>
              Dossiers Locataires en Retard Éligibles au Préfinancement ({eligiblePrefList.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Biens occupés dont le locataire n'a pas encore soldé son loyer : le comptable peut préfinancer le propriétaire en 1 clic.
            </p>
          </div>
          <div className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl tabular-nums">
            Net suggéré à préfinancer : {formatXOF(prefSummary.totalSuggestedNetPrefinance || 0, { compact: false })}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase">
                <th className="py-3 px-4">Propriétaire</th>
                <th className="py-3 px-4">Bien Immobilier</th>
                <th className="py-3 px-4">Locataire en Retard</th>
                <th className="py-3 px-4 text-right">Loyer Dû</th>
                <th className="py-3 px-4 text-right">Impayé Locataire</th>
                <th className="py-3 px-4 text-right">Commission ({`%`})</th>
                <th className="py-3 px-4 text-right">Net à Préfinancer</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <TableSkeleton rows={4} columns={8} />
              ) : eligiblePrefList.length > 0 ? (
                eligiblePrefList.map(c => (
                  <tr key={c.client_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{c.owner_name}</div>
                      <div className="text-xs text-slate-400">
                        {formatMethod(c.preferred_payment_method)} &bull; Le {c.preferred_payout_day} du mois
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800">{c.property_name}</div>
                      <div className="text-xs text-slate-400 truncate max-w-[180px]">{c.property_address}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-900">{c.tenant_name}</div>
                      <div className="text-xs text-slate-400">{c.tenant_phone}</div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-slate-700 tabular-nums">
                      {formatXOF(c.rent_due, { compact: false })}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-rose-600 tabular-nums">
                      {formatXOF(c.tenant_arrears, { compact: false })}
                    </td>
                    <td className="py-3.5 px-4 text-right text-xs text-slate-500 tabular-nums">
                      {c.commission_rate}% ({formatXOF(c.agency_commission)})
                    </td>
                    <td className="py-3.5 px-4 text-right font-extrabold text-amber-700 tabular-nums">
                      {formatXOF(c.net_prefinance_suggested, { compact: false })}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenPrefinanceForCase(c)}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                      >
                        <i className="fas fa-bolt"></i> Préfinancer
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-slate-500 text-sm">
                    Aucun arriéré locataire en attente de préfinancement.
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
