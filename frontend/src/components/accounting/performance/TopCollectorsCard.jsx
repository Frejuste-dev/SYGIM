import React from 'react';
import { formatAmount } from '../../../utils/formatters';

const RANK_BADGES = {
  1: { bg: 'bg-amber-100 border-amber-300 text-amber-900 font-black', icon: 'fa-trophy text-amber-600' },
  2: { bg: 'bg-slate-200 border-slate-300 text-slate-800 font-bold', icon: 'fa-medal text-slate-600' },
  3: { bg: 'bg-orange-100 border-orange-300 text-orange-900 font-bold', icon: 'fa-award text-orange-600' },
  4: { bg: 'bg-slate-100 border-slate-200 text-slate-700 font-semibold', icon: null },
  5: { bg: 'bg-slate-100 border-slate-200 text-slate-700 font-semibold', icon: null },
};

export default function TopCollectorsCard({ topCollectors = [], onViewAllCollectors }) {
  const maxAmount = topCollectors.length > 0 ? Math.max(...topCollectors.map((c) => c.currentAmount || 0)) : 1;

  return (
    <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs p-5 flex flex-col justify-between h-full">
      <div>
        {/* En-tête de carte */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 border-b border-dashed border-slate-300 pb-0.5 inline-block">
              3. TOP 5 des agents de recouvrement
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Classement par volume total d'encaissements validés sur la période.
            </p>
          </div>
          <span className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200/60">
            <i className="fas fa-ranking-star text-sm"></i>
          </span>
        </div>

        {/* Liste classée */}
        <div className="mt-4 space-y-4">
          {topCollectors.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              <i className="fas fa-user-slash text-xl mb-1.5 block"></i>
              Aucun encaissement collecteur enregistré sur cette période.
            </div>
          ) : (
            topCollectors.map((collector, index) => {
              const rank = collector.rank || index + 1;
              const badgeStyle = RANK_BADGES[rank] || RANK_BADGES[5];
              const percentOfMax = maxAmount > 0 ? ((collector.currentAmount || 0) / maxAmount) * 100 : 0;
              const evolution = Number(collector.evolution || 0);
              const isPositive = evolution > 0;
              const isZero = evolution === 0;

              return (
                <div key={collector.id || index} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Badge de Rang */}
                      <span
                        className={`w-6 h-6 rounded-md flex items-center justify-center text-xs border shrink-0 ${badgeStyle.bg}`}
                      >
                        {rank}
                      </span>
                      {/* Identité Agent */}
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {collector.name}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {collector.zone ? `Zone ${collector.zone}` : collector.phone || 'Collecteur terrain'}
                        </div>
                      </div>
                    </div>

                    {/* Montant et Évolution */}
                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold text-slate-900 tabular-nums">
                        {formatAmount(collector.currentAmount || 0)}{' '}
                        <span className="text-[10px] text-slate-500 font-medium">FCFA</span>
                      </div>
                      <div className="flex items-center justify-end gap-1.5 mt-0.5">
                        <span className="text-[10px] text-slate-400">
                          {collector.operationsCount || 0} op. • {collector.sharePercent || 0}%
                        </span>
                        {!isZero && (
                          <span
                            className={`text-[10px] font-semibold flex items-center gap-0.5 ${
                              isPositive ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            <i className={`fas ${isPositive ? 'fa-caret-up' : 'fa-caret-down'}`}></i>
                            {isPositive ? '+' : ''}
                            {evolution.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Barre de progression proportionnelle */}
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-500 ${
                        rank === 1
                          ? 'bg-amber-500'
                          : rank === 2
                          ? 'bg-sky-500'
                          : rank === 3
                          ? 'bg-blue-500'
                          : 'bg-slate-400'
                      }`}
                      style={{ width: `${Math.max(percentOfMax, 3)}%` }}
                    ></div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Bouton pour ouvrir la vue détaillée de tous les agents */}
      {topCollectors.length > 0 && onViewAllCollectors && (
        <div className="mt-5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onViewAllCollectors}
            className="w-full py-2 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 border border-slate-200/60"
          >
            <i className="fas fa-users-viewfinder text-primary"></i>
            <span>Voir le tableau exhaustif des agents</span>
          </button>
        </div>
      )}
    </div>
  );
}
