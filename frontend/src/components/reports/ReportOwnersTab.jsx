import React from 'react';
import TableSkeleton from '../ui/TableSkeleton';
import { formatXOF, formatMethod } from '../../utils/formatters';
import { printOwnerSettlementReceipt } from '../../utils/exportUtils';

export default function ReportOwnersTab({
  ownerStatementsData,
  loadingStatements = false,
  selectedMonth,
  handleMonthChange,
  handleMonthSelect,
  tenantSearch,
  setTenantSearch,
  expandedOwnerIds,
  toggleOwnerExpand,
  expandAllOwners,
  collapseAllOwners,
  handleExportOwnerStatementsExcel,
  exportingExcel = false,
  isManager = false
}) {
  return (
    <div className="space-y-6">
      {/* BARRE D'ACTION & FILTRES DU DÉCOMPTE */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-primary/10 text-primary rounded-xl text-base">
              <i className="fas fa-file-invoice-dollar"></i>
            </span>
            <h3 className="text-lg font-bold text-slate-900">État Récapitulatif Bailleurs & Décompte Locatif</h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Vue hiérarchique consolidée par propriétaire avec détail des locataires, loyers encaissés, arriérés, préfinancements et bordereaux officiels.
          </p>
        </div>

        {/* CONTRÔLES : PÉRIODE PAR MOIS + RECHERCHE PAR LOCATAIRE + EXCEL */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Sélecteur de mois avec boutons précédent / suivant */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1">
            <button
              type="button"
              onClick={() => handleMonthChange(-1)}
              className="px-2 py-1 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-colors cursor-pointer"
              title="Mois précédent"
            >
              <i className="fas fa-chevron-left text-xs"></i>
            </button>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => handleMonthSelect(e.target.value)}
              className="px-2.5 py-1 bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
            />
            <button
              type="button"
              onClick={() => handleMonthChange(1)}
              className="px-2 py-1 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-colors cursor-pointer"
              title="Mois suivant"
            >
              <i className="fas fa-chevron-right text-xs"></i>
            </button>
          </div>

          {/* Recherche par nom de locataire / bien / propriétaire */}
          <div className="relative min-w-[220px]">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input
              type="text"
              placeholder="Filtrer locataire, bien, bailleur..."
              value={tenantSearch}
              onChange={(e) => setTenantSearch(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {tenantSearch && (
              <button
                type="button"
                onClick={() => setTenantSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
              >
                <i className="fas fa-times-circle"></i>
              </button>
            )}
          </div>

          {/* Boutons d'accordéon global */}
          <div className="flex items-center gap-1.5 border-l border-slate-200 pl-2">
            <button
              type="button"
              onClick={expandAllOwners}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              title="Déplier tous les propriétaires"
            >
              <i className="fas fa-angles-down text-[10px]"></i>
              <span className="hidden sm:inline">Déplier</span>
            </button>
            <button
              type="button"
              onClick={collapseAllOwners}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              title="Replier tous les propriétaires"
            >
              <i className="fas fa-angles-up text-[10px]"></i>
              <span className="hidden sm:inline">Replier</span>
            </button>
          </div>

          {/* Bouton Exporter en Excel */}
          <button
            type="button"
            onClick={handleExportOwnerStatementsExcel}
            disabled={exportingExcel || loadingStatements}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {exportingExcel ? (
              <i className="fas fa-spinner fa-spin"></i>
            ) : (
              <i className="fas fa-file-excel"></i>
            )}
            <span>Exporter en Excel</span>
          </button>
        </div>
      </div>

      {/* KPIS DE LA PÉRIODE SÉLECTIONNÉE */}
      {ownerStatementsData?.totals && (
        <div className={`grid gap-3 ${isManager ? 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'}`}>
          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Loyer Attendu</div>
            <div className="text-base font-bold text-slate-900 mt-1 tabular-nums">
              {formatXOF(ownerStatementsData.totals.global_expected || 0)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">{ownerStatementsData.totals.total_owners || 0} bailleur(s)</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/30">
            <div className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">Loyer Encaissé</div>
            <div className="text-base font-bold text-emerald-700 mt-1 tabular-nums">
              {formatXOF(ownerStatementsData.totals.global_collected || 0)}
            </div>
            <div className="text-[10px] text-emerald-600 font-bold mt-0.5">
              Taux : {ownerStatementsData.totals.recovery_rate || 0}%
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-rose-200 bg-rose-50/30">
            <div className="text-[11px] font-semibold text-rose-800 uppercase tracking-wider">Reste à Recouvrer</div>
            <div className="text-base font-bold text-rose-700 mt-1 tabular-nums">
              {formatXOF(ownerStatementsData.totals.global_arrears || 0)}
            </div>
            <div className="text-[10px] text-rose-600 mt-0.5">Arriérés cumulés</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/30">
            <div className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider">
              {isManager ? 'Avances Accordées' : 'Préfinancé (Agence)'}
            </div>
            <div className="text-base font-bold text-amber-700 mt-1 tabular-nums">
              {formatXOF(ownerStatementsData.totals.global_prefinanced || 0)}
            </div>
            <div className="text-[10px] text-amber-600 mt-0.5">Avances versées aux bailleurs</div>
          </div>

          {!isManager && (
            <>
              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Commission Agence</div>
                <div className="text-base font-bold text-slate-800 mt-1 tabular-nums">
                  {formatXOF(ownerStatementsData.totals.global_commission || 0)}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Retenues de gestion</div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-primary/20 bg-primary/5">
                <div className="text-[11px] font-semibold text-primary uppercase tracking-wider">Net Propriétaire</div>
                <div className="text-base font-extrabold text-primary mt-1 tabular-nums">
                  {formatXOF(ownerStatementsData.totals.global_net_payout || 0)}
                </div>
                <div className="text-[10px] text-primary/80 mt-0.5">Reversement final</div>
              </div>
            </>
          )}
        </div>
      )}

      {/* TABLEAU HIÉRARCHIQUE DES BAILLEURS & DÉCOMPTE LOCATIF */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loadingStatements ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-4 min-w-[260px]">Propriétaire / Locataire</th>
                  <th className="py-3.5 px-3 text-right min-w-[125px]">Loyer Global</th>
                  <th className="py-3.5 px-3 text-right min-w-[125px]">Loyer Encaissé</th>
                  <th className="py-3.5 px-3 text-right min-w-[130px]">Reste à Recouvrer</th>
                  <th className="py-3.5 px-3 text-right min-w-[130px]">{isManager ? 'Avance Accordée' : 'Montant Préfinancé'}</th>
                  {!isManager && <th className="py-3.5 px-3 text-right min-w-[130px]">Commission Agence</th>}
                  {!isManager && <th className="py-3.5 px-3 text-right min-w-[135px]">Net Propriétaire</th>}
                  <th className="py-3.5 px-4 text-center min-w-[110px]">Bordereau</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <TableSkeleton rows={6} columns={isManager ? 6 : 8} />
              </tbody>
            </table>
          </div>
        ) : ownerStatementsData?.statements?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-4 min-w-[260px]">Propriétaire / Locataire</th>
                  <th className="py-3.5 px-3 text-right min-w-[125px]">Loyer Global</th>
                  <th className="py-3.5 px-3 text-right min-w-[125px]">Loyer Encaissé</th>
                  <th className="py-3.5 px-3 text-right min-w-[130px]">Reste à Recouvrer</th>
                  <th className="py-3.5 px-3 text-right min-w-[130px]">{isManager ? 'Avance Accordée' : 'Montant Préfinancé'}</th>
                  {!isManager && <th className="py-3.5 px-3 text-right min-w-[130px]">Commission Agence</th>}
                  {!isManager && <th className="py-3.5 px-3 text-right min-w-[135px]">Net Propriétaire</th>}
                  <th className="py-3.5 px-4 text-center min-w-[110px]">Bordereau</th>
                </tr>
              </thead>
              <tbody>
                {ownerStatementsData.statements.map((s) => {
                  const isExpanded = expandedOwnerIds.has(s.owner_id);

                  return (
                    <React.Fragment key={s.owner_id}>
                      {/* LIGNE MAÎTRESSE PROPRIÉTAIRE */}
                      <tr
                        onClick={() => toggleOwnerExpand(s.owner_id)}
                        className="bg-amber-50/70 hover:bg-amber-100/60 transition-colors border-y border-amber-200/80 cursor-pointer select-none"
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <span className="w-5 h-5 rounded-md bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold transition-transform">
                              <i className={`fas fa-chevron-${isExpanded ? 'down' : 'right'}`}></i>
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold italic text-slate-900 tracking-wide text-sm">
                                  {s.owner_name.toUpperCase()}
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                                  {s.properties_count} bien(s)
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                {formatMethod(s.preferred_payment_method)} &bull; {s.bank_account || s.bank_name || 'Sans compte enregistré'} &bull; Tél: {s.phone}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-right font-extrabold text-slate-900 text-sm tabular-nums">
                          {formatXOF(s.total_expected_rent)}
                        </td>
                        <td className="py-3.5 px-3 text-right font-extrabold text-emerald-700 text-sm tabular-nums">
                          {formatXOF(s.total_collected_rent)}
                        </td>
                        <td className="py-3.5 px-3 text-right font-extrabold text-sm tabular-nums">
                          {s.total_arrears > 0 ? (
                            <span className="text-rose-700">{formatXOF(s.total_arrears)}</span>
                          ) : (
                            <span className="text-slate-400 font-normal">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-right font-extrabold text-sm tabular-nums">
                          {s.total_prefinanced > 0 ? (
                            <span className="text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded-lg border border-amber-200">
                              {formatXOF(s.total_prefinanced)}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">—</span>
                          )}
                        </td>
                        {!isManager && (
                          <>
                            <td className="py-3.5 px-3 text-right text-xs text-slate-700 font-bold tabular-nums">
                              <div>{formatXOF(s.agency_commission)}</div>
                              <span className="text-[10px] text-slate-500 font-medium">({s.commission_rate}%)</span>
                            </td>
                            <td className="py-3.5 px-3 text-right font-extrabold text-primary text-sm tabular-nums">
                              {formatXOF(s.net_owner_payout)}
                            </td>
                          </>
                        )}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              printOwnerSettlementReceipt(s, { month: selectedMonth, isStatement: true });
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg text-xs font-bold transition-all shadow-2xs hover:border-primary/30 cursor-pointer"
                            title="Imprimer le bordereau officiel avec le détail complet des locataires"
                          >
                            <i className="fas fa-print text-primary"></i>
                            <span>Bordereau PDF</span>
                          </button>
                        </td>
                      </tr>

                      {/* SOUS-LIGNES DÉROULANTES DES LOCATAIRES */}
                      {isExpanded && s.units?.map((u, uIdx) => (
                        <tr
                          key={`${s.owner_id}-unit-${u.property_id}-${uIdx}`}
                          className={`border-b border-slate-100 text-xs transition-colors ${
                            u.matches_search ? 'bg-amber-50/60' : (uIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40')
                          } hover:bg-slate-50`}
                        >
                          <td className="py-2.5 px-4 pl-10">
                            <div className="flex items-center gap-2.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-300"></span>
                              {u.is_vacant ? (
                                <span className="italic font-medium text-slate-400">
                                  {u.tenant_name}
                                </span>
                              ) : (
                                <div>
                                  <span className="font-semibold text-slate-800 text-xs">
                                    {u.tenant_name}
                                  </span>
                                  <span className="text-[10px] text-slate-400 ml-2">
                                    ({u.tenant_phone})
                                  </span>
                                </div>
                              )}
                              <span className="text-[10px] text-slate-400 italic">
                                &bull; {u.property_name}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-600 font-medium tabular-nums">
                            {u.is_vacant ? '—' : formatXOF(u.expected_rent)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold text-emerald-700 tabular-nums">
                            {u.is_vacant ? '—' : (u.collected_rent > 0 ? formatXOF(u.collected_rent) : '0 XOF')}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold tabular-nums">
                            {u.is_vacant ? (
                              '—'
                            ) : u.arrears > 0 ? (
                              <span className="text-rose-600 font-bold">{formatXOF(u.arrears)}</span>
                            ) : u.arrears < 0 ? (
                              <span className="text-indigo-600 font-medium">
                                -{formatXOF(Math.abs(u.arrears))} <span className="text-[10px] font-normal">(Avance)</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold tabular-nums">
                            {u.prefinanced_amount > 0 ? (
                              <span className="text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                {formatXOF(u.prefinanced_amount)}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal">—</span>
                            )}
                          </td>
                          {!isManager && (
                            <>
                              <td className="py-2.5 px-3 text-right text-slate-400 font-normal">—</td>
                              <td className="py-2.5 px-3 text-right text-slate-400 font-normal">—</td>
                            </>
                          )}
                          <td className="py-2.5 px-4 text-center text-slate-400 text-[10px]">
                            —
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
              {/* LIGNE DE TOTALISATION FINALE CONSOLIDÉE */}
              <tfoot>
                <tr className="bg-slate-100/90 text-slate-900 font-extrabold text-xs border-t-2 border-slate-300">
                  <td className="py-3.5 px-4">
                    TOTAL CONSOLIDÉ ({ownerStatementsData.totals.total_owners} BAILLEURS)
                  </td>
                  <td className="py-3.5 px-3 text-right font-extrabold text-slate-900 tabular-nums">
                    {formatXOF(ownerStatementsData.totals.global_expected || 0)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-extrabold text-emerald-700 tabular-nums">
                    {formatXOF(ownerStatementsData.totals.global_collected || 0)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-extrabold text-rose-700 tabular-nums">
                    {formatXOF(ownerStatementsData.totals.global_arrears || 0)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-extrabold text-amber-700 tabular-nums">
                    {formatXOF(ownerStatementsData.totals.global_prefinanced || 0)}
                  </td>
                  {!isManager && (
                    <>
                      <td className="py-3.5 px-3 text-right font-bold text-slate-700 tabular-nums">
                        {formatXOF(ownerStatementsData.totals.global_commission || 0)}
                      </td>
                      <td className="py-3.5 px-3 text-right font-extrabold text-primary text-sm tabular-nums">
                        {formatXOF(ownerStatementsData.totals.global_net_payout || 0)}
                      </td>
                    </>
                  )}
                  <td className="py-3.5 px-4 text-center text-slate-400">
                    —
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <i className="fas fa-search text-slate-400 text-3xl mb-3"></i>
            <h4 className="text-sm font-bold text-slate-800">Aucun bailleur ou locataire correspondant</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              Essayez de modifier votre recherche ou sélectionnez un autre mois pour visualiser les décomptes.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
