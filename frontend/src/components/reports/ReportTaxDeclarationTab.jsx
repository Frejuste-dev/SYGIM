import React, { useState, useEffect } from 'react';
import { useOwners } from '../../hooks/queries/useOwners';
import { useTaxDeclaration } from '../../hooks/queries/useReports';
import TableSkeleton from '../ui/TableSkeleton';
import { formatXOF } from '../../utils/formatters';
import { exportToExcel } from '../../utils/exportUtils';

export default function ReportTaxDeclarationTab() {
  const { data: ownersData = {} } = useOwners({ limit: 100 });
  const owners = Array.isArray(ownersData) ? ownersData : (ownersData?.data || []);

  const currentYear = new Date().getFullYear();
  const [selectedOwnerId, setSelectedOwnerId] = useState('');
  const [selectedYear, setSelectedYear] = useState(currentYear);

  useEffect(() => {
    if (!selectedOwnerId && owners.length > 0) {
      setSelectedOwnerId(String(owners[0].id));
    }
  }, [owners, selectedOwnerId]);

  const { data: taxData = {}, isLoading } = useTaxDeclaration(
    selectedOwnerId,
    { year: selectedYear },
    { enabled: Boolean(selectedOwnerId) }
  );

  const owner = taxData?.owner || {};
  const annualTotals = taxData?.annualTotals || {};
  const monthsBreakdown = taxData?.monthsBreakdown || [];
  const propertiesBreakdown = taxData?.propertiesBreakdown || [];

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (!monthsBreakdown.length) return;
    const exportRows = monthsBreakdown.map(m => ({
      monthName: m.monthName,
      grossRent: m.grossRent,
      deductibleCommission: m.deductibleCommission,
      deductibleRepairs: m.deductibleRepairs,
      netIncome: m.netIncome
    }));

    exportToExcel(
      exportRows,
      `sygim_declaration_fiscale_${owner.name?.replace(/\s+/g, '_') || 'bailleur'}_${selectedYear}.xls`,
      {
        monthName: 'Mois d\'imposition',
        grossRent: 'Loyers bruts encaissés (XOF) [Ligne 211]',
        deductibleCommission: 'Frais d\'administration déductibles (XOF) [Ligne 221]',
        deductibleRepairs: 'Dépenses réparation déductibles (XOF) [Ligne 224]',
        netIncome: 'Revenu Net Foncier (XOF)'
      },
      `Déclaration des Revenus Fonciers ${selectedYear} — ${owner.name || 'Propriétaire'}`
    );
  };

  return (
    <div className="space-y-6">
      {/* 1. CONTRÔLES SUPÉRIEURS (MASQUÉS À L'IMPRESSION) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs print:hidden space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                Aide Fiscale Annuelle
              </span>
              <span className="text-xs text-slate-400">Revenus Fonciers</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-1">
              Synthèse Déclarative des Revenus Fonciers &bull; Année {selectedYear}
            </h3>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <button
              type="button"
              onClick={handlePrint}
              disabled={isLoading || !selectedOwnerId}
              className="px-3.5 py-2 bg-primary text-white rounded-xl text-xs font-bold shadow-xs hover:bg-primary-dark transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <i className="fas fa-print"></i>
              <span>Imprimer Formulaire Fiscal A4</span>
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={isLoading || !selectedOwnerId}
              className="px-3.5 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <i className="fas fa-file-excel"></i>
              <span>Excel</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Propriétaire déclarant <span className="text-rose-600">*</span>
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
              Année fiscale d'imposition
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-primary focus:bg-white"
            >
              {[currentYear, currentYear - 1, currentYear - 2, currentYear - 3].map(yr => (
                <option key={yr} value={yr}>Année fiscale {yr}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 2. RECAPITULATIF FISCAL LIGNES 211, 221, 224, 250 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-sky-100 shadow-2xs">
          <div className="text-xs font-bold uppercase tracking-wider text-sky-700 mb-1">
            Recettes Brutes [Ligne 211]
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 tabular-nums">
            {formatXOF(annualTotals.totalGrossRents || 0, { compact: false })}
          </div>
          <div className="text-xs text-slate-500 mt-1">Total des loyers encaissés dans l'année</div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-amber-100 shadow-2xs">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-1">
            Frais de Gestion [Ligne 221]
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-800 tabular-nums">
            {formatXOF(annualTotals.totalCommissionsDeductible || 0, { compact: false })}
          </div>
          <div className="text-xs text-slate-500 mt-1">Commissions d'agence déductibles</div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-orange-100 shadow-2xs">
          <div className="text-xs font-bold uppercase tracking-wider text-orange-700 mb-1">
            Travaux &amp; Entretien [Ligne 224]
          </div>
          <div className="text-xl sm:text-2xl font-black text-orange-800 tabular-nums">
            {formatXOF(annualTotals.totalRepairsDeductible || 0, { compact: false })}
          </div>
          <div className="text-xs text-slate-500 mt-1">Dépenses de réparation déductibles</div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-emerald-100 bg-emerald-50/20 shadow-2xs">
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-800 mb-1">
            Revenu Net Foncier [Ligne 250]
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-800 tabular-nums">
            {formatXOF(annualTotals.totalNetTaxableIncome || 0, { compact: false })}
          </div>
          <div className="text-xs text-emerald-600 mt-1">Assiette nette imposable déclarée</div>
        </div>
      </div>

      {/* 3. TABLEAU MENSUEL DES 12 MOIS DE L'ANNÉE */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="font-bold text-slate-900 text-sm">
            Ventilation Mensuelle des Recettes &amp; Charges Déductibles &bull; {selectedYear}
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Bailleur : <span className="font-bold text-slate-800">{owner.name || 'Propriétaire'}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Mois d'imposition</th>
                <th className="py-3.5 px-4 text-right text-sky-800 bg-sky-50/40">Loyers Encaissés (Brut)</th>
                <th className="py-3.5 px-4 text-right text-amber-800 bg-amber-50/40">Commissions Déductibles</th>
                <th className="py-3.5 px-4 text-right text-orange-800 bg-orange-50/40">Travaux Déductibles</th>
                <th className="py-3.5 px-4 text-right font-black text-emerald-800 bg-emerald-50/40">Revenu Net Mensuel</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <TableSkeleton rows={12} columns={5} />
              ) : monthsBreakdown.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    Aucune donnée fiscale disponible pour cette année.
                  </td>
                </tr>
              ) : (
                monthsBreakdown.map((m) => (
                  <tr key={m.monthNumber} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {m.monthName} {selectedYear}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-slate-800 tabular-nums">
                      {formatXOF(m.grossRent, { compact: false })}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-amber-700 tabular-nums">
                      {m.deductibleCommission > 0 ? `- ${formatXOF(m.deductibleCommission, { compact: false })}` : '0 XOF'}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-orange-700 tabular-nums">
                      {m.deductibleRepairs > 0 ? `- ${formatXOF(m.deductibleRepairs, { compact: false })}` : '0 XOF'}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-800 tabular-nums bg-emerald-50/10">
                      {formatXOF(m.netIncome, { compact: false })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {!isLoading && monthsBreakdown.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                  <td className="py-3.5 px-4 uppercase tracking-wider text-xs">
                    TOTAL ANNUEL FISCAL :
                  </td>
                  <td className="py-3.5 px-4 text-right text-sky-900 text-sm tabular-nums">
                    {formatXOF(annualTotals.totalGrossRents || 0, { compact: false })}
                  </td>
                  <td className="py-3.5 px-4 text-right text-amber-900 text-sm tabular-nums">
                    - {formatXOF(annualTotals.totalCommissionsDeductible || 0, { compact: false })}
                  </td>
                  <td className="py-3.5 px-4 text-right text-orange-900 text-sm tabular-nums">
                    - {formatXOF(annualTotals.totalRepairsDeductible || 0, { compact: false })}
                  </td>
                  <td className="py-3.5 px-4 text-right text-emerald-800 text-sm tabular-nums bg-emerald-100/50">
                    {formatXOF(annualTotals.totalNetTaxableIncome || 0, { compact: false })}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* 4. VENTILATION PAR BIEN IMMOBILIER */}
      {propertiesBreakdown.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 font-bold text-slate-900 text-sm">
            Répartition Patrimoniale par Bien Immobilier &bull; {selectedYear}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Bien &amp; Réf.</th>
                  <th className="py-3 px-4">Type &amp; Zone</th>
                  <th className="py-3 px-3 text-right">Loyer Mensuel</th>
                  <th className="py-3 px-4 text-right">Recettes Brutes Annuelles</th>
                  <th className="py-3 px-4 text-right">Commissions Annuelles (Est.)</th>
                  <th className="py-3 px-4 text-right font-bold text-emerald-800">Revenu Net Généré</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {propertiesBreakdown.map((p) => (
                  <tr key={p.propertyId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{p.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{p.referenceCode}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {p.type} &bull; {p.zone}
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-slate-700 tabular-nums">
                      {formatXOF(p.monthlyRent, { compact: false })}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900 tabular-nums">
                      {formatXOF(p.grossRentYear, { compact: false })}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-amber-700 tabular-nums">
                      {formatXOF(p.estimatedCommissionYear, { compact: false })}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-emerald-800 tabular-nums">
                      {formatXOF(p.estimatedNetIncome, { compact: false })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
