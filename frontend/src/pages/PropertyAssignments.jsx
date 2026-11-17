import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useProperties } from '../hooks/queries/useProperties';
import { useCollectors } from '../hooks/queries/useCollectors';
import { API } from '../api/services';
import { useToast } from '../components/ToastContext';
import { useConfirm } from '../components/ConfirmContext';
import Modal from '../components/Modal';
import { formatXOF } from '../utils/formatters';

const TYPE_ICONS = {
  appartement: 'fa-building',
  maison: 'fa-home',
  villa: 'fa-home',
  studio: 'fa-door-open',
  terrain: 'fa-map',
  commerce: 'fa-store',
  commercial: 'fa-store',
  bureau: 'fa-briefcase',
};

export default function PropertyAssignments() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const [activeTab, setActiveTab] = useState('unassigned'); // 'unassigned' | 'assigned'
  const [searchTerm, setSearchTerm] = useState('');
  const [collectorFilter, setCollectorFilter] = useState('');
  const [selectedPropertyIds, setSelectedPropertyIds] = useState([]);

  // Modale d'attribution à un collecteur
  const [modalProperties, setModalProperties] = useState([]); // array of property objects
  const [selectedCollectorId, setSelectedCollectorId] = useState('');
  const [collectorSearch, setCollectorSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: propertiesRes = {}, isLoading: propsLoading } = useProperties({ limit: 500 });
  const propertiesList = Array.isArray(propertiesRes) ? propertiesRes : (propertiesRes?.data || []);

  const { data: collectorsRes = {}, isLoading: collectorsLoading } = useCollectors();
  const collectorsList = Array.isArray(collectorsRes) ? collectorsRes : (collectorsRes?.data || []);

  const collectorsMap = useMemo(() => {
    const map = new Map();
    collectorsList.forEach((c) => {
      map.set(Number(c.id), c);
    });
    return map;
  }, [collectorsList]);

  const unassignedProperties = useMemo(
    () => propertiesList.filter((p) => !p.collector_id),
    [propertiesList]
  );

  const assignedProperties = useMemo(
    () => propertiesList.filter((p) => Boolean(p.collector_id)),
    [propertiesList]
  );

  const filteredList = useMemo(() => {
    const base = activeTab === 'unassigned' ? unassignedProperties : assignedProperties;
    return base.filter((p) => {
      if (activeTab === 'assigned' && collectorFilter && String(p.collector_id) !== String(collectorFilter)) {
        return false;
      }
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      const collector = collectorsMap.get(Number(p.collector_id));
      const collectorName = collector
        ? `${collector.first_name || ''} ${collector.last_name || ''} ${collector.name || ''}`.toLowerCase()
        : (p.collector_name || '').toLowerCase();
      return (
        (p.name || '').toLowerCase().includes(q) ||
        (p.reference_code || '').toLowerCase().includes(q) ||
        (p.zone || '').toLowerCase().includes(q) ||
        (p.address || '').toLowerCase().includes(q) ||
        (p.owner_name || '').toLowerCase().includes(q) ||
        collectorName.includes(q)
      );
    });
  }, [activeTab, unassignedProperties, assignedProperties, collectorFilter, searchTerm, collectorsMap]);

  const toggleSelectProperty = (id) => {
    setSelectedPropertyIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = filteredList.map((p) => p.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedPropertyIds.includes(id));
    if (allSelected) {
      setSelectedPropertyIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedPropertyIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const openAssignModal = (propsToAssign) => {
    setModalProperties(propsToAssign);
    setSelectedCollectorId(
      propsToAssign.length === 1 && propsToAssign[0].collector_id
        ? String(propsToAssign[0].collector_id)
        : ''
    );
    setCollectorSearch('');
  };

  const handleConfirmAssign = async (e) => {
    e.preventDefault();
    if (!selectedCollectorId) {
      showToast({ type: 'error', message: 'Veuillez sélectionner un collecteur.' });
      return;
    }
    const propertyIds = modalProperties.map((p) => p.id);
    setSubmitting(true);
    try {
      await API.Collectors.assignProperties(Number(selectedCollectorId), propertyIds);
      const col = collectorsMap.get(Number(selectedCollectorId));
      const colLabel = col ? `${col.first_name || ''} ${col.last_name || ''}`.trim() || col.name : 'collecteur';
      showToast({
        type: 'success',
        message: `${propertyIds.length} bien${propertyIds.length > 1 ? 's' : ''} attribué${propertyIds.length > 1 ? 's' : ''} à ${colLabel}.`
      });
      setModalProperties([]);
      setSelectedPropertyIds([]);
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['collectors'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    } catch (err) {
      showToast({
        type: 'error',
        message: err.response?.data?.message || err.message || 'Erreur lors de l\'attribution au collecteur.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnassign = async (property) => {
    const isConfirmed = await confirm(
      `Retirer le collecteur assigné au bien "${property.name}" (${property.reference_code || ''}) ?`
    );
    if (!isConfirmed) return;

    try {
      await API.Collectors.unassignProperties([property.id]);
      showToast({
        type: 'success',
        message: `Le collecteur a été retiré du bien "${property.name}".`
      });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['collectors'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    } catch (err) {
      showToast({
        type: 'error',
        message: err.response?.data?.message || err.message || 'Impossible de retirer le collecteur.'
      });
    }
  };

  const getCollectorLabel = (p) => {
    const col = collectorsMap.get(Number(p.collector_id));
    if (col) {
      return col.name || `${col.first_name || ''} ${col.last_name || ''}`.trim() || `Collecteur #${col.id}`;
    }
    return p.collector_name || (p.collector_id ? `Collecteur #${p.collector_id}` : 'Non attribué');
  };

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      {/* 1. EN-TÊTE */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <i className="fas fa-user-shield text-primary"></i>
            Attribution des Biens aux Collecteurs
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Affectez les biens immobiliers aux agents de recouvrement pour organiser les tournées de collecte.
          </p>
        </div>

        {activeTab === 'unassigned' && selectedPropertyIds.length > 0 && (
          <button
            type="button"
            onClick={() => {
              const chosen = unassignedProperties.filter((p) => selectedPropertyIds.includes(p.id));
              if (chosen.length > 0) openAssignModal(chosen);
            }}
            className="px-4 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <i className="fas fa-user-check"></i>
            <span>Attribuer la sélection ({selectedPropertyIds.length})</span>
          </button>
        )}
      </div>

      {/* 2. CARTES KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase">Sans collecteur</div>
            <div className="text-2xl font-extrabold text-amber-600 mt-1 tabular-nums">{unassignedProperties.length}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <i className="fas fa-hourglass-half"></i>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase">Biens attribués</div>
            <div className="text-2xl font-extrabold text-emerald-600 mt-1 tabular-nums">{assignedProperties.length}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <i className="fas fa-check-circle"></i>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase">Collecteurs</div>
            <div className="text-2xl font-extrabold text-indigo-600 mt-1 tabular-nums">{collectorsList.length}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <i className="fas fa-motorcycle"></i>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase">Total Parc</div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">{propertiesList.length}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
            <i className="fas fa-building"></i>
          </div>
        </div>
      </div>

      {/* 3. ONGLETS & FILTRES */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl self-start">
            <button
              type="button"
              onClick={() => { setActiveTab('unassigned'); setSelectedPropertyIds([]); }}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'unassigned'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Biens sans collecteur</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] bg-amber-100 text-amber-800">
                {unassignedProperties.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('assigned'); setSelectedPropertyIds([]); }}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'assigned'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Biens attribués</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] bg-emerald-100 text-emerald-800">
                {assignedProperties.length}
              </span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[230px] flex-1 sm:flex-initial">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
              <input
                type="text"
                placeholder="Rechercher un bien, référence, zone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:bg-white focus:border-primary"
              />
            </div>

            {activeTab === 'assigned' && (
              <select
                value={collectorFilter}
                onChange={(e) => setCollectorFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value="">Tous les collecteurs</option>
                {collectorsList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || `${c.first_name || ''} ${c.last_name || ''}`.trim()}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* 4. TABLEAU */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-[11px]">
                {activeTab === 'unassigned' && (
                  <th className="py-3.5 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={filteredList.length > 0 && filteredList.every((p) => selectedPropertyIds.includes(p.id))}
                      onChange={toggleSelectAllVisible}
                      className="rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                      aria-label="Tout sélectionner"
                    />
                  </th>
                )}
                <th className="py-3.5 px-4">Bien Immobilier</th>
                <th className="py-3.5 px-4">Zone &amp; Propriétaire</th>
                <th className="py-3.5 px-4 text-right">Loyer Mensuel</th>
                <th className="py-3.5 px-4">Collecteur Assigné</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {propsLoading || collectorsLoading ? (
                <tr>
                  <td colSpan={activeTab === 'unassigned' ? 6 : 5} className="py-12 text-center text-slate-400">
                    <i className="fas fa-spinner fa-spin mr-2"></i> Chargement des biens et collecteurs...
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={activeTab === 'unassigned' ? 6 : 5} className="py-12 text-center text-slate-400">
                    <i className="fas fa-inbox text-2xl mb-2 block text-slate-300"></i>
                    {activeTab === 'unassigned'
                      ? 'Tous les biens sont déjà attribués à un collecteur.'
                      : 'Aucun bien attribué ne correspond à votre recherche.'}
                  </td>
                </tr>
              ) : (
                filteredList.map((p) => {
                  const iconClass = TYPE_ICONS[(p.type || '').toLowerCase()] || 'fa-building';
                  const isSelected = selectedPropertyIds.includes(p.id);
                  return (
                    <tr key={p.id} className={`hover:bg-slate-50/80 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}>
                      {activeTab === 'unassigned' && (
                        <td className="py-3.5 px-4">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectProperty(p.id)}
                            className="rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                            aria-label={`Sélectionner ${p.name}`}
                          />
                        </td>
                      )}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                            <i className={`fas ${iconClass}`}></i>
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-sm">{p.name}</div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {p.reference_code || `BIEN-${p.id}`} &bull; {p.type || 'appartement'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-800">{p.zone || p.address || 'Non renseignée'}</div>
                        <div className="text-[11px] text-slate-500">
                          Bailleur : <span className="font-semibold text-slate-700">{p.owner_name || 'Non rattaché'}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900 tabular-nums">
                        {formatXOF(p.rent || 0)}
                      </td>
                      <td className="py-3.5 px-4">
                        {p.collector_id ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <i className="fas fa-motorcycle text-[10px]"></i>
                            {getCollectorLabel(p)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            Non attribué
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openAssignModal([p])}
                            className="px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary text-primary hover:text-white text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <i className="fas fa-user-check text-[11px]"></i>
                            <span>{p.collector_id ? 'Changer' : 'Attribuer'}</span>
                          </button>
                          {p.collector_id && (
                            <button
                              type="button"
                              onClick={() => handleUnassign(p)}
                              className="px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-colors cursor-pointer"
                              title="Retirer ce bien du collecteur"
                            >
                              <i className="fas fa-times"></i>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. MODALE D'ATTRIBUTION AU COLLECTEUR */}
      {modalProperties.length > 0 && (
        <Modal
          isOpen={true}
          onClose={() => !submitting && setModalProperties([])}
          title={
            modalProperties.length > 1
              ? `Attribuer ${modalProperties.length} biens à un collecteur`
              : `Attribuer un bien à un collecteur`
          }
          subtitle="Affectation de la tournée de recouvrement sur le terrain"
          icon="fa-motorcycle"
          maxWidth="max-w-xl"
        >
          <form onSubmit={handleConfirmAssign} className="space-y-5">
            {/* Résumé visuel du/des bien(s) */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <i className="fas fa-building text-primary"></i>
                  {modalProperties.length > 1 ? 'Biens sélectionnés' : 'Bien concerné'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary">
                  {modalProperties.length} bien{modalProperties.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className="max-h-28 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
                {modalProperties.map((mp) => (
                  <div key={mp.id} className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-200/70 text-xs">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 truncate">{mp.name}</div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {mp.zone || mp.address || 'Zone non renseignée'} &bull; {formatXOF(mp.rent || 0)}
                      </div>
                    </div>
                    <span className="font-mono text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md shrink-0 ml-2">
                      {mp.reference_code || `BIEN-${mp.id}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Sélection visuelle du collecteur */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Choisir l'agent collecteur <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] text-slate-400">
                  {collectorsList.length} collecteur{collectorsList.length > 1 ? 's' : ''} disponible{collectorsList.length > 1 ? 's' : ''}
                </span>
              </div>

              {/* Barre de recherche */}
              <div className="relative">
                <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                <input
                  type="text"
                  placeholder="Rechercher par nom ou téléphone..."
                  value={collectorSearch}
                  onChange={(e) => setCollectorSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
                {collectorSearch && (
                  <button
                    type="button"
                    onClick={() => setCollectorSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <i className="fas fa-times text-xs"></i>
                  </button>
                )}
              </div>

              {/* Liste de cartes collecteurs */}
              <div className="max-h-56 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                {collectorsList
                  .filter((c) => {
                    if (!collectorSearch.trim()) return true;
                    const q = collectorSearch.toLowerCase();
                    const full = `${c.name || ''} ${c.first_name || ''} ${c.last_name || ''} ${c.phone || ''}`.toLowerCase();
                    return full.includes(q);
                  })
                  .map((c) => {
                    const label = c.name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || `Collecteur #${c.id}`;
                    const initials = label.split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || 'C';
                    const isChecked = String(selectedCollectorId) === String(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedCollectorId(String(c.id))}
                        className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                          isChecked
                            ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-2xs'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            isChecked ? 'bg-primary text-white' : 'bg-indigo-50 text-indigo-600'
                          }`}>
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-slate-900 truncate">{label}</div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-2">
                              <span><i className="fas fa-phone text-[9px] mr-1"></i>{c.phone || 'Sans téléphone'}</span>
                              <span>&bull;</span>
                              <span className="font-semibold text-slate-600">{c.assignedPropsCount || 0} bien(s) suivi(s)</span>
                            </div>
                          </div>
                        </div>
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                          isChecked
                            ? 'bg-primary border-primary text-white'
                            : 'border-slate-300 bg-white'
                        }`}>
                          {isChecked && <i className="fas fa-check text-[10px]"></i>}
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalProperties([])}
                disabled={submitting}
                className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={submitting || !selectedCollectorId}
                className="px-5 py-2.5 text-xs font-bold text-white bg-primary hover:bg-primary-dark rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {submitting
                  ? <><i className="fas fa-spinner fa-spin"></i> Attribution en cours...</>
                  : <><i className="fas fa-check-circle"></i> Confirmer l'attribution ({modalProperties.length})</>
                }
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
