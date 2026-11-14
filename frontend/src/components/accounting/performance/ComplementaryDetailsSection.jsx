import React, { useState } from 'react';
import { formatAmount } from '../../../utils/formatters';
import Modal from '../../Modal';

const CHANNEL_COLORS = {
  'Espèces': { bg: 'bg-emerald-500', light: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  'Mobile Money': { bg: 'bg-amber-500', light: 'bg-amber-50 text-amber-700 border-amber-200' },
  'Virement bancaire': { bg: 'bg-sky-500', light: 'bg-sky-50 text-sky-700 border-sky-200' },
  'Chèque': { bg: 'bg-purple-500', light: 'bg-purple-50 text-purple-700 border-purple-200' },
  'Autre': { bg: 'bg-slate-400', light: 'bg-slate-50 text-slate-700 border-slate-200' },
};

export default function ComplementaryDetailsSection({
  details = {},
  isCollectorsModalOpen,
  setIsCollectorsModalOpen,
}) {
  const {
    totalOperations = {},
    avgPerOperation = {},
    avgPerCollector = {},
    uniqueClientsCount = 0,
    unpaidAmount = 0,
    recoveryRate = 0,
    channels = [],
    allCollectorsTable = [],
  } = details;

  const [collectorSearch, setCollectorSearch] = useState('');
  const [showChannelModal, setShowChannelModal] = useState(false);

  const filteredCollectors = allCollectorsTable.filter((c) =>
    (c.name || '').toLowerCase().includes(collectorSearch.toLowerCase()) ||
    (c.zone || '').toLowerCase().includes(collectorSearch.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Titre de section */}
      <div>
        <h3 className="text-sm font-semibold text-slate-800 border-b border-dashed border-slate-300 pb-0.5 inline-block">
          5. Détails complémentaires & Métriques d'exploitation
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Indicateurs opérationnels, répartition par canaux d'encaissement et pilotage des équipes.
        </p>
      </div>

      {/* Grille de 6 cartes métriques */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Opérations */}
        <div
          onClick={() => setShowChannelModal(true)}
          className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-xs hover:border-sky-300 hover:shadow-sm cursor-pointer transition-all group"
        >
          <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
            <span>Opérations</span>
            <i className="fas fa-arrow-up-right-from-square text-[10px] text-slate-300 group-hover:text-sky-500 transition-colors"></i>
          </div>
          <div className="mt-1 text-lg font-bold text-slate-900 tabular-nums">
            {totalOperations.current || 0}
          </div>
          <div className="mt-1 text-[10px] text-slate-500">
            N-1 : {totalOperations.previous || 0} op.
          </div>
        </div>

        {/* Panier moyen / Opération */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500">
            Moy. / opération
          </div>
          <div className="mt-1 text-lg font-bold text-slate-900 tabular-nums">
            {formatAmount(avgPerOperation.current || 0)}
          </div>
          <div className="mt-1 text-[10px] text-slate-400">
            FCFA par encaissement
          </div>
        </div>

        {/* Moyenne / Agent */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500">
            Moy. / agent
          </div>
          <div className="mt-1 text-lg font-bold text-slate-900 tabular-nums">
            {formatAmount(avgPerCollector.current || 0)}
          </div>
          <div className="mt-1 text-[10px] text-slate-400">
            FCFA par collecteur actif
          </div>
        </div>

        {/* Clients recouvrés */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500">
            Locataires réglés
          </div>
          <div className="mt-1 text-lg font-bold text-slate-900 tabular-nums">
            {uniqueClientsCount}
          </div>
          <div className="mt-1 text-[10px] text-slate-400">
            locataires à jour
          </div>
        </div>

        {/* Taux de recouvrement */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500">
            Taux recouvrement
          </div>
          <div className="mt-1 text-lg font-bold text-emerald-600 tabular-nums">
            {Number(recoveryRate || 0).toFixed(1)}%
          </div>
          <div className="mt-1 text-[10px] text-slate-400">
            sur le prévisionnel
          </div>
        </div>

        {/* Reste à recouvrer */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500">
            Impayés période
          </div>
          <div className="mt-1 text-lg font-bold text-rose-600 tabular-nums">
            {formatAmount(unpaidAmount || 0)}
          </div>
          <div className="mt-1 text-[10px] text-slate-400">
            FCFA restant dû
          </div>
        </div>
      </div>

      {/* Carte Répartition par Canal de Paiement */}
      {channels.length > 0 && (
        <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs p-4 sm:p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Répartition des encaissements par canal de paiement
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Proportion des montants perçus par Espèces, Mobile Money, Virement et Chèque.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowChannelModal(true)}
              className="text-xs text-primary font-semibold hover:underline"
            >
              Détails canaux
            </button>
          </div>

          {/* Barre segmentée horizontale */}
          <div className="w-full bg-slate-100 rounded-full h-3 mt-4 flex overflow-hidden">
            {channels.map((chan, idx) => {
              const color = CHANNEL_COLORS[chan.channel]?.bg || 'bg-slate-400';
              const share = Number(chan.share || 0);
              if (share <= 0) return null;
              return (
                <div
                  key={idx}
                  className={`${color} h-3 transition-all first:rounded-l-full last:rounded-r-full`}
                  style={{ width: `${share}%` }}
                  title={`${chan.channel}: ${share}% (${formatAmount(chan.amount)} FCFA)`}
                ></div>
              );
            })}
          </div>

          {/* Légende détaillée */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {channels.map((chan, idx) => {
              const colorInfo = CHANNEL_COLORS[chan.channel] || CHANNEL_COLORS['Autre'];
              return (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50/70 border border-slate-200/60">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${colorInfo.bg}`}></span>
                    <span className="font-medium text-slate-700">{chan.channel}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-900 tabular-nums">
                      {chan.share}%
                    </div>
                    <div className="text-[10px] text-slate-400 tabular-nums">
                      {formatAmount(chan.amount)} FCFA
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL CANAUX DE PAIEMENT */}
      {showChannelModal && (
        <Modal
          isOpen={showChannelModal}
          onClose={() => setShowChannelModal(false)}
          title="Détail des Encaissements par Canal de Règlement"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Analyse détaillée de la composition des {totalOperations.current || 0} encaissements validés.
            </p>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {channels.map((chan, idx) => (
                <div key={idx} className="p-3.5 flex items-center justify-between hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${CHANNEL_COLORS[chan.channel]?.light || 'bg-slate-100 text-slate-700'}`}>
                      <i className={`fas ${
                        chan.channel === 'Espèces' ? 'fa-money-bill-wave' :
                        chan.channel === 'Mobile Money' ? 'fa-mobile-screen' :
                        chan.channel === 'Virement bancaire' ? 'fa-building-columns' : 'fa-money-check'
                      }`}></i>
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 text-xs">{chan.channel}</div>
                      <div className="text-[11px] text-slate-400">{chan.count} transaction{chan.count > 1 ? 's' : ''}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-bold text-slate-900 text-sm tabular-nums">
                      {formatAmount(chan.amount)} FCFA
                    </div>
                    <div className="text-xs font-semibold text-primary">
                      {chan.share}% du volume
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowChannelModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
              >
                Fermer
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL TABLEAU COMPLET DE TOUS LES AGENTS */}
      {isCollectorsModalOpen && (
        <Modal
          isOpen={isCollectorsModalOpen}
          onClose={() => setIsCollectorsModalOpen(false)}
          title="Performances Détaillées de Tous les Agents de Recouvrement"
        >
          <div className="space-y-4 max-h-[75vh] flex flex-col">
            {/* Barre de recherche dans le tableau */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                <input
                  type="text"
                  placeholder="Rechercher un agent ou une zone..."
                  value={collectorSearch}
                  onChange={(e) => setCollectorSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
                {filteredCollectors.length} agent{filteredCollectors.length > 1 ? 's' : ''}
              </span>
            </div>

            {/* Table défilable */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl flex-1">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="px-3 py-2.5">Agent</th>
                    <th className="px-3 py-2.5">Zone</th>
                    <th className="px-3 py-2.5 text-right">Recouvrements N</th>
                    <th className="px-3 py-2.5 text-center">Évol. N-1</th>
                    <th className="px-3 py-2.5 text-center">Opérations</th>
                    <th className="px-3 py-2.5 text-center">Locataires</th>
                    <th className="px-3 py-2.5 text-right">Objectif</th>
                    <th className="px-3 py-2.5 text-center">Réalisation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCollectors.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-6 text-center text-slate-400">
                        Aucun agent correspondant.
                      </td>
                    </tr>
                  ) : (
                    filteredCollectors.map((c, i) => {
                      const evol = Number(c.evolution || 0);
                      const isPos = evol > 0;
                      const isZero = evol === 0;
                      const rate = Number(c.achievementRate || 0);

                      return (
                        <tr key={c.id || i} className="hover:bg-slate-50/80">
                          <td className="px-3 py-2.5 font-bold text-slate-900">
                            {c.name}
                          </td>
                          <td className="px-3 py-2.5 text-slate-500">
                            {c.zone || '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold text-slate-900 tabular-nums">
                            {formatAmount(c.currentAmount || 0)} FCFA
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {isZero ? (
                              <span className="text-slate-400">—</span>
                            ) : (
                              <span className={`font-semibold tabular-nums ${isPos ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {isPos ? '+' : ''}{evol.toFixed(1)}%
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center text-slate-700 font-medium">
                            {c.operationsCount || 0}
                          </td>
                          <td className="px-3 py-2.5 text-center text-slate-700 font-medium">
                            {c.clientsCount || 0}
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-600 tabular-nums">
                            {formatAmount(c.targetAmount || 0)} FCFA
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                                rate >= 100
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : rate >= 75
                                  ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {rate.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsCollectorsModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
              >
                Fermer
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
