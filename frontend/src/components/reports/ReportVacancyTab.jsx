import React, { useState } from 'react';
import { useVacancyLoss } from '../../hooks/queries/useReports';
import TableSkeleton from '../ui/TableSkeleton';
import { formatXOF, formatDate } from '../../utils/formatters';
import { exportToExcel } from '../../utils/exportUtils';

export default function ReportVacancyTab() {
  const [selectedZone, setSelectedZone] = useState('all');
  const { data: vacancyData = {}, isLoading } = useVacancyLoss({ zone: selectedZone });

  const summary = vacancyData?.summary || {};
  const lossByZone = vacancyData?.lossByZone || [];
  const vacantProperties = vacancyData?.vacantProperties || [];

  const handleExportCSV = () => {
    if (!vacantProperties.length) return;
    const exportRows = vacantProperties.map((p, idx) => ({
      index: idx + 1,
      referenceCode: p.referenceCode,
      name: p.propertyName,
      type: `${p.propertyType} (${p.floorLevel})`,
      zone: p.propertyZone,
      ownerName: p.ownerName,
      ownerPhone: p.ownerPhone,
      monthlyRent: p.monthlyRent,
      vacantSince: formatDate(p.vacantSince),
      vacantDays: p.vacantDays,
      estimatedLoss: p.estimatedLoss
    }));

    exportToExcel(
      exportRows,
      `sygim_vacance_locative_${new Date().toISOString().slice(0, 10)}.xls`,
      {
        index: 'N°',
        referenceCode: 'Réf. Bien',
        name: 'Nom du Bien',
        type: 'Type & Niveau',
        zone: 'Zone / Quartier',
        ownerName: 'Propriétaire',
        ownerPhone: 'Contact',
        monthlyRent: 'Loyer mensuel (XOF)',
        vacantSince: 'Date vacance',
        vacantDays: 'Durée vacance (jours)',
        estimatedLoss: 'Manque à Gagner Estimé (XOF)'
      },
      'Rapport de Vacance Locative & Manque à Gagner — SYGIM'
    );
  };

  return (
    <div className="space-y-6">
      {/* 1. CARTES KPI VACANCE & MANQUE À GAGNER */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-rose-200/80 shadow-xs hover:shadow-sm transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Manque à Gagner Cumulé
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center text-xs">
              <i className="fas fa-hand-holding-dollar"></i>
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600 tabular-nums tracking-tight">
            {formatXOF(summary.totalCumulativeLoss || 0, { compact: false })}
          </div>
          <div className="text-xs text-slate-400 mt-1.5 flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            Loyers non perçus depuis début de vacance
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-amber-200/80 shadow-xs hover:shadow-sm transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Biens Actuellement Vacants
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center text-xs">
              <i className="fas fa-door-open"></i>
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tabular-nums tracking-tight">
            {summary.totalVacantProperties || 0}
            <span className="text-xs font-bold text-slate-400 ml-1.5">logements</span>
          </div>
          <div className="text-xs text-slate-400 mt-1.5 flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Disponibles immédiatement ou en travaux
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-sky-200/80 shadow-xs hover:shadow-sm transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Potentiel Mensuel Perdu
            </span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center text-xs">
              <i className="fas fa-calendar-xmark"></i>
            </div>
          </div>
          <div className="text-2xl font-black text-sky-900 tabular-nums tracking-tight">
            {formatXOF(summary.totalPotentialMonthlyRent || 0, { compact: false })}
          </div>
          <div className="text-xs text-slate-400 mt-1.5 flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-500"></span>
            Loyers faciaux mensuels inexploités
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-indigo-200/80 shadow-xs hover:shadow-sm transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Durée Moyenne Vacance
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs">
              <i className="fas fa-clock-rotate-left"></i>
            </div>
          </div>
          <div className="text-2xl font-black text-indigo-700 tabular-nums tracking-tight">
            {summary.averageVacancyDays || 0}
            <span className="text-xs font-bold text-indigo-400 ml-1.5">jours</span>
          </div>
          <div className="text-xs text-slate-400 mt-1.5 flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
            Temps moyen de remise en location
          </div>
        </div>
      </div>

      {/* 2. RÉPARTITION PAR ZONE GÉOGRAPHIQUE & ACTIONS */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mr-1 flex items-center gap-1.5">
              <i className="fas fa-map-location-dot text-primary"></i> Filtrer par Secteur :
            </span>
            <button
              type="button"
              onClick={() => setSelectedZone('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedZone === 'all'
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              Toutes les zones ({vacantProperties.length})
            </button>
            {lossByZone.map(z => (
              <button
                key={z.zone}
                type="button"
                onClick={() => setSelectedZone(z.zone)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  selectedZone === z.zone
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {z.zone} ({z.count}) &bull; {formatXOF(z.cumulativeLoss)}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={!vacantProperties.length}
            className="px-3.5 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 self-end sm:self-auto shadow-2xs"
          >
            <i className="fas fa-file-excel"></i>
            <span>Exporter Vacance (Excel)</span>
          </button>
        </div>
      </div>

      {/* 3. TABLEAU DES LOGEMENTS VACANTS */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <i className="fas fa-building-circle-exclamation text-amber-500"></i>
            <span>Liste des Biens Immobiliers Vacants &amp; Perte Financière Associée</span>
          </div>
          <div className="text-xs text-slate-500 font-medium">
            <span className="font-bold text-slate-800">{vacantProperties.length}</span> logement(s) à commercialiser
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-3 w-12 text-center">N°</th>
                <th className="py-3.5 px-4">Bien &amp; Référence</th>
                <th className="py-3.5 px-4">Type &amp; Niveau</th>
                <th className="py-3.5 px-4">Zone / Quartier</th>
                <th className="py-3.5 px-4">Propriétaire</th>
                <th className="py-3.5 px-4 text-right">Loyer Facial</th>
                <th className="py-3.5 px-4 text-center">Jours Vacants</th>
                <th className="py-3.5 px-4 text-right">Perte Estimée</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <TableSkeleton rows={6} columns={8} />
              ) : vacantProperties.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-500">
                    <i className="fas fa-home text-3xl text-emerald-500 mb-2"></i>
                    <p className="text-sm font-semibold text-slate-700">Aucun bien vacant sur cette zone.</p>
                    <p className="text-xs text-slate-400 mt-1">Le parc est intégralement occupé.</p>
                  </td>
                </tr>
              ) : (
                vacantProperties.map((p, idx) => (
                  <tr key={p.propertyId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-3 text-center text-slate-400 font-semibold tabular-nums">
                      {String(idx + 1).padStart(2, '0')}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{p.propertyName}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{p.referenceCode}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      <div className="font-semibold text-slate-800 capitalize">{p.propertyType || 'Logement'}</div>
                      <div className="text-[11px] text-slate-400">{p.floorLevel || 'RDC'}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-medium">
                      {p.propertyZone || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      <div className="font-medium text-slate-900">{p.ownerName}</div>
                      <div className="text-[11px] text-slate-400">{p.ownerPhone || '—'}</div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-slate-800 tabular-nums">
                      {formatXOF(p.monthlyRent, { compact: false })}
                    </td>
                    <td className="py-3.5 px-4 text-center tabular-nums">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                        {p.vacantDays} jours
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-rose-700 tabular-nums bg-rose-50/20">
                      {formatXOF(p.estimatedLoss, { compact: false })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {!isLoading && vacantProperties.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                  <td colSpan={5} className="py-3.5 px-4 text-right uppercase tracking-wider text-xs">
                    TOTAL PERTE FINANCIÈRE VACANCE :
                  </td>
                  <td className="py-3.5 px-4 text-right text-slate-900 tabular-nums">
                    {formatXOF(summary.totalPotentialMonthlyRent || 0, { compact: false })}
                  </td>
                  <td className="py-3.5 px-4 text-center text-indigo-800 tabular-nums">
                    Moy. {summary.averageVacancyDays || 0}j
                  </td>
                  <td className="py-3.5 px-4 text-right text-rose-800 text-sm tabular-nums bg-rose-100/50">
                    {formatXOF(summary.totalCumulativeLoss || 0, { compact: false })}
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
