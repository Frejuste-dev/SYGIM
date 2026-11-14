import React, { useState, useMemo } from 'react';
import { useManagerActivityLogs } from '../hooks/queries/useManagerActivity';
import { useDebounce } from '../hooks/useDebounce';
import Modal from '../components/Modal';
import { formatDate } from '../utils/formatters';

const OPERATION_TYPES = [
  { value: 'ALL', label: 'Toutes les opérations' },
  { value: 'CREATE_PROPERTY', label: 'Enregistrement bien' },
  { value: 'UPDATE_PROPERTY', label: 'Modification bien' },
  { value: 'CREATE_OWNER', label: 'Création propriétaire' },
  { value: 'UPDATE_OWNER', label: 'Modification propriétaire' },
  { value: 'ASSIGN_PROPERTY', label: 'Attribution de bien' },
  { value: 'REASSIGN_PROPERTY', label: 'Réattribution de bien' },
];

export default function Activity() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 350);

  const [operationType, setOperationType] = useState('ALL');
  const [propertyRefFilter, setPropertyRefFilter] = useState('');
  const [ownerNameFilter, setOwnerNameFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);

  // Modale de détail d'un log
  const [selectedLog, setSelectedLog] = useState(null);

  const queryFilters = useMemo(() => {
    return {
      search: debouncedSearch,
      operationType: operationType !== 'ALL' ? operationType : undefined,
      propertyRef: propertyRefFilter || undefined,
      ownerName: ownerNameFilter || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      page,
      limit: 20,
    };
  }, [debouncedSearch, operationType, propertyRefFilter, ownerNameFilter, startDate, endDate, page]);

  const { data: activityResult = {}, isLoading, isFetching, refetch } = useManagerActivityLogs(queryFilters);
  const logs = activityResult.logs || [];
  const pagination = activityResult.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 };

  const handleResetFilters = () => {
    setSearchTerm('');
    setOperationType('ALL');
    setPropertyRefFilter('');
    setOwnerNameFilter('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const renderJsonDiff = (oldVals, newVals) => {
    if (!oldVals && !newVals) {
      return (
        <div className="text-slate-400 text-xs italic">
          Aucun détail structurel supplémentaire enregistré pour cette opération.
        </div>
      );
    }

    const allKeys = Array.from(
      new Set([...Object.keys(oldVals || {}), ...Object.keys(newVals || {})])
    ).filter(k => k !== 'id' && k !== 'created_at' && k !== 'updated_at');

    return (
      <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
        <div className="grid grid-cols-3 bg-slate-100/80 p-2.5 font-bold text-slate-700 border-b border-slate-200">
          <div>Champ / Attribut</div>
          <div>Ancienne valeur</div>
          <div>Nouvelle valeur</div>
        </div>
        <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto bg-white">
          {allKeys.map((key) => {
            const oldV = oldVals?.[key];
            const newV = newVals?.[key];
            const isChanged = JSON.stringify(oldV) !== JSON.stringify(newV);

            return (
              <div
                key={key}
                className={`grid grid-cols-3 p-2.5 transition-colors ${
                  isChanged ? 'bg-amber-50/50' : ''
                }`}
              >
                <div className="font-mono text-slate-600 font-semibold">{key}</div>
                <div className="text-slate-500 font-mono break-all pr-2">
                  {oldV !== undefined && oldV !== null ? (typeof oldV === 'object' ? JSON.stringify(oldV) : String(oldV)) : <span className="text-slate-300 italic">null</span>}
                </div>
                <div className={`font-mono break-all font-medium ${isChanged ? 'text-primary font-bold' : 'text-slate-800'}`}>
                  {newV !== undefined && newV !== null ? (typeof newV === 'object' ? JSON.stringify(newV) : String(newV)) : <span className="text-slate-300 italic">null</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden box-border">
      {/* EN-TÊTE DE PAGE */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center shrink-0">
            <i className="fas fa-history text-lg"></i>
          </span>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Historique des Activités Manager
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Journal d'audit immuable et traçabilité exhaustive de l'ensemble des opérations du module Manager.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5 disabled:opacity-60"
          >
            <i className={`fas fa-rotate ${isFetching ? 'fa-spin text-primary' : 'text-slate-400'}`}></i>
            <span>Actualiser</span>
          </button>
          <button
            type="button"
            onClick={handleResetFilters}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <i className="fas fa-filter-circle-xmark text-slate-400"></i>
            <span>Réinitialiser filtres</span>
          </button>
        </div>
      </div>

      {/* ZONE DE FILTRES MULTICRITÈRES (Section 7.4) */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs p-4 sm:p-5 space-y-3">
        <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <i className="fas fa-filter text-primary"></i>
          <span>Filtres de recherche d'audit</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Recherche libre */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Recherche globale</label>
            <div className="relative">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
              <input
                type="text"
                placeholder="Mot-clé, description..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          {/* Type d'opération */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Type d'opération</label>
            <select
              value={operationType}
              onChange={(e) => {
                setOperationType(e.target.value);
                setPage(1);
              }}
              className="w-full p-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
            >
              {OPERATION_TYPES.map((op) => (
                <option key={op.value} value={op.value}>{op.label}</option>
              ))}
            </select>
          </div>

          {/* Réf. Bien */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Réf. du Bien</label>
            <input
              type="text"
              placeholder="Ex: BIEN-001"
              value={propertyRefFilter}
              onChange={(e) => {
                setPropertyRefFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Nom Propriétaire */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Nom Propriétaire</label>
            <input
              type="text"
              placeholder="Ex: Koffi YAO"
              value={ownerNameFilter}
              onChange={(e) => {
                setOwnerNameFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Plage temporelle */}
          <div className="flex items-center gap-1.5">
            <div className="flex-1">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Du</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="w-full p-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none bg-white"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Au</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="w-full p-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none bg-white"
              />
            </div>
          </div>
        </div>
      </div>

      {/* TABLEAU CHRONOLOGIQUE STRICT (Section 7.3) */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="text-xs font-semibold text-slate-700">
            Événements d'audit journalisés ({pagination.total} enregistrement{pagination.total > 1 ? 's' : ''})
          </div>
          <span className="text-xs text-slate-400">
            Cliquez sur une ligne pour inspecter les modifications
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Date et Heure</th>
                <th className="px-4 py-3">Opération</th>
                <th className="px-4 py-3">Élément concerné</th>
                <th className="px-4 py-3">Opérateur</th>
                <th className="px-4 py-3 text-center">Résultat</th>
                <th className="px-4 py-3 text-center">Détails</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    <i className="fas fa-spinner fa-spin mr-2"></i> Chargement des événements...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Aucune activité correspondant aux filtres.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isSuccess = log.status === 'SUCCESS';

                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-slate-50/90 cursor-pointer transition-colors"
                      title="Cliquez pour afficher les modifications détaillées"
                    >
                      <td className="px-4 py-3 text-slate-600 font-mono whitespace-nowrap">
                        {formatDate(log.created_at, {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            log.operation_type?.startsWith('CREATE')
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : log.operation_type?.startsWith('ASSIGN')
                              ? 'bg-sky-50 text-sky-700 border border-sky-200'
                              : log.operation_type?.startsWith('REASSIGN')
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {log.operation_label || log.operation_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {log.target_summary || `${log.property_ref || ''} / ${log.owner_name || ''}`}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {log.author_name}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isSuccess
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {isSuccess ? 'Réussie' : 'Échouée'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-400">
                        <i className="fas fa-chevron-right text-xs"></i>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        {pagination.totalPages > 1 && (
          <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <div>
              Page <strong>{pagination.page}</strong> sur <strong>{pagination.totalPages}</strong> ({pagination.total} événements)
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={!pagination.hasPrevious}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50"
              >
                Précédent
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={!pagination.hasNext}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODALE DE CONSULTATION DÉTAILLÉE CÔTE À CÔTE (Section 7.5) */}
      {selectedLog && (
        <Modal
          isOpen={Boolean(selectedLog)}
          onClose={() => setSelectedLog(null)}
          title={`Audit : ${selectedLog.operation_label || selectedLog.operation_type}`}
        >
          <div className="space-y-4 max-h-[75vh] flex flex-col">
            {/* Métadonnées générales */}
            <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <div>
                <span className="text-slate-400 font-medium">Date et heure :</span>{' '}
                <strong className="text-slate-800 font-semibold font-mono">
                  {formatDate(selectedLog.created_at, {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </strong>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Manager Auteur :</span>{' '}
                <strong className="text-slate-800 font-semibold">{selectedLog.author_name}</strong>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Cible :</span>{' '}
                <strong className="text-slate-800 font-semibold">{selectedLog.target_summary}</strong>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Résultat :</span>{' '}
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    selectedLog.status === 'SUCCESS'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  {selectedLog.status === 'SUCCESS' ? 'Réussie' : 'Échouée'}
                </span>
              </div>
              {selectedLog.description && (
                <div className="col-span-2 pt-2 border-t border-slate-200/60 text-slate-600">
                  <span className="text-slate-400 font-medium">Description :</span> {selectedLog.description}
                </div>
              )}
            </div>

            {/* Comparatif côte à côte old_values vs new_values */}
            <div>
              <div className="text-xs font-bold text-slate-800 mb-2 flex items-center justify-between">
                <span>Comparatif des informations modifiées</span>
                <span className="text-[11px] text-slate-400 font-normal">Tracé d'immuabilité</span>
              </div>
              {renderJsonDiff(selectedLog.old_values, selectedLog.new_values)}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
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
