import React from 'react';
import { formatDate } from '../../../utils/formatters';

const GRANULARITIES = [
  { id: 'day', label: 'Jour' },
  { id: 'month', label: 'Mois' },
  { id: 'quarter', label: 'Trimestre' },
  { id: 'year', label: 'Année' },
  { id: 'custom', label: 'Personnalisé' },
];

export default function PerformanceHeaderBar({
  granularity,
  setGranularity,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  periodMeta,
  onRefresh,
  onReset,
  isLoading,
}) {
  return (
    <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs p-4 sm:p-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Titre et badges */}
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              TABLEAU DE BORD – PERFORMANCE
            </h2>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Dynamique N vs N-1
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700">
              Devise : XOF (FCFA)
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Analyse comparative du chiffre d'affaires, des encaissements et du recouvrement terrain.
          </p>
        </div>

        {/* Boutons d'actualisation et reset */}
        <div className="flex items-center gap-2 self-start lg:self-auto shrink-0">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-2xs disabled:opacity-60"
            title="Rafraîchir les données"
          >
            <i className={`fas fa-rotate ${isLoading ? 'fa-spin text-primary' : 'text-slate-400'}`}></i>
            <span>Actualiser</span>
          </button>
          <button
            type="button"
            onClick={onReset}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
            title="Réinitialiser au mois courant"
          >
            <i className="fas fa-undo text-slate-400"></i>
            <span>Mois en cours</span>
          </button>
        </div>
      </div>

      {/* Barre de contrôle : Granularité et Périodes */}
      <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Sélecteur de Granularité */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl self-start overflow-x-auto max-w-full">
          {GRANULARITIES.map((g) => {
            const isActive = granularity === g.id;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setGranularity(g.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                {g.label}
              </button>
            );
          })}
        </div>

        {/* Sélecteurs de Date (toujours visibles ou personnalisables) */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1 shadow-2xs">
            <span className="text-xs text-slate-400 font-medium">Du :</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setGranularity('custom');
              }}
              className="text-xs text-slate-700 font-medium focus:outline-none bg-transparent cursor-pointer"
            />
          </div>
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1 shadow-2xs">
            <span className="text-xs text-slate-400 font-medium">Au :</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setGranularity('custom');
              }}
              className="text-xs text-slate-700 font-medium focus:outline-none bg-transparent cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Période de comparaison N-1 calculée */}
      {periodMeta?.prevStartDate && (
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 bg-slate-50/80 px-3 py-1.5 rounded-lg border border-slate-200/60 w-fit">
          <i className="fas fa-clock-rotate-left text-slate-400"></i>
          <span>
            Période comparative N-1 :{' '}
            <strong className="text-slate-700 font-medium">
              {formatDate(periodMeta.prevStartDate, { day: 'numeric', month: 'short', year: 'numeric' })}
            </strong>{' '}
            au{' '}
            <strong className="text-slate-700 font-medium">
              {formatDate(periodMeta.prevEndDate, { day: 'numeric', month: 'short', year: 'numeric' })}
            </strong>{' '}
            ({periodMeta.durationDays} jour{periodMeta.durationDays > 1 ? 's' : ''})
          </span>
        </div>
      )}
    </div>
  );
}
