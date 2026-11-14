import React, { useState, useMemo } from 'react';
import {
  usePropertyAssignments,
  usePropertyAssignmentHistory,
  useAssignOwner,
  useReassignOwner,
} from '../hooks/queries/usePropertyAssignments';
import { useOwners } from '../hooks/queries/useOwners';
import { useToast } from '../components/ToastContext';
import Modal from '../components/Modal';
import { formatDate, formatAmount } from '../utils/formatters';

export default function PropertyAssignments() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('unassigned'); // 'unassigned' | 'assigned' | 'history'
  const [searchTerm, setSearchTerm] = useState('');

  // Modales
  const [assigningProperty, setAssigningProperty] = useState(null);
  const [selectedOwnerId, setSelectedOwnerId] = useState('');
  const [assignmentNotes, setAssignmentNotes] = useState('');

  const [reassigningProperty, setReassigningProperty] = useState(null);
  const [newOwnerId, setNewOwnerId] = useState('');
  const [reassignNotes, setReassignNotes] = useState('');

  // Requêtes
  const { data: assignmentsData = {}, isLoading: assignmentsLoading } = usePropertyAssignments({
    search: searchTerm,
    assignmentStatus: activeTab === 'unassigned' ? 'unassigned' : activeTab === 'assigned' ? 'assigned' : 'all',
  });
  const propertiesList = assignmentsData.assignments || [];

  const { data: historyList = [], isLoading: historyLoading } = usePropertyAssignmentHistory({
    search: searchTerm,
  });

  const { data: ownersData = {} } = useOwners({ limit: 100 });
  const owners = ownersData.data || [];

  // Mutations
  const assignMutation = useAssignOwner();
  const reassignMutation = useReassignOwner();

  const handleConfirmAssignment = async (e) => {
    e.preventDefault();
    if (!assigningProperty || !selectedOwnerId) {
      showToast({ type: 'error', message: 'Veuillez sélectionner un propriétaire bailleur.' });
      return;
    }

    try {
      await assignMutation.mutateAsync({
        propertyId: assigningProperty.id,
        ownerId: selectedOwnerId,
        notes: assignmentNotes || 'Attribution directe par le Manager',
      });
      showToast({ type: 'success', message: 'Le bien a été attribué avec succès au propriétaire.' });
      setAssigningProperty(null);
      setSelectedOwnerId('');
      setAssignmentNotes('');
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Erreur lors de l\'attribution.' });
    }
  };

  const handleConfirmReassignment = async (e) => {
    e.preventDefault();
    if (!reassigningProperty || !newOwnerId) {
      showToast({ type: 'error', message: 'Veuillez sélectionner le nouveau propriétaire.' });
      return;
    }
    if (Number(newOwnerId) === Number(reassigningProperty.owner_id)) {
      showToast({ type: 'error', message: 'Le nouveau propriétaire doit être différent de l\'actuel.' });
      return;
    }

    try {
      await reassignMutation.mutateAsync({
        propertyId: reassigningProperty.id,
        newOwnerId: newOwnerId,
        notes: reassignNotes || 'Réattribution par le Manager',
      });
      showToast({ type: 'success', message: 'Le bien a été réattribué avec succès.' });
      setReassigningProperty(null);
      setNewOwnerId('');
      setReassignNotes('');
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Erreur lors de la réattribution.' });
    }
  };

  const unassignedCount = useMemo(() => {
    return propertiesList.filter((p) => !p.owner_id).length;
  }, [propertiesList]);

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden box-border">
      {/* EN-TÊTE DE PAGE */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <i className="fas fa-handshake text-lg"></i>
            </span>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Attribution des Biens Immobiliers
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Associez les biens vacants ou non attribués aux propriétaires bailleurs et gérez les transferts de mandats.
              </p>
            </div>
          </div>
        </div>

        {/* Barre de recherche */}
        <div className="relative w-full sm:w-72">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
          <input
            type="text"
            placeholder="Rechercher bien, référence, zone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-2xs"
          />
        </div>
      </div>

      {/* ONGLETS DE VUE */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('unassigned')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'unassigned'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <i className="fas fa-building-circle-exclamation"></i>
          <span>Biens à attribuer (Non attribués)</span>
          {activeTab === 'unassigned' && propertiesList.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-white text-amber-800">
              {propertiesList.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('assigned')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'assigned'
              ? 'bg-primary text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <i className="fas fa-building-circle-check"></i>
          <span>Biens attribués & Réattribution</span>
          {activeTab === 'assigned' && propertiesList.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white">
              {propertiesList.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'history'
              ? 'bg-slate-800 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <i className="fas fa-clock-rotate-left"></i>
          <span>Historique des attributions</span>
          {historyList.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-800">
              {historyList.length}
            </span>
          )}
        </button>
      </div>

      {/* CONTENU ONGLET 1 : BIENS NON ATTRIBUÉS */}
      {activeTab === 'unassigned' && (
        <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-700">
              Biens enregistrés en attente d'un propriétaire bailleur
            </div>
            <span className="text-xs text-amber-600 font-bold bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
              {propertiesList.length} bien{propertiesList.length > 1 ? 's' : ''} disponible{propertiesList.length > 1 ? 's' : ''}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Réf.</th>
                  <th className="px-4 py-3">Bien & Emplacement</th>
                  <th className="px-4 py-3">Zone</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Loyer Mensuel</th>
                  <th className="px-4 py-3 text-center">Statut Attribution</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assignmentsLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      <i className="fas fa-spinner fa-spin mr-2"></i> Chargement des biens...
                    </td>
                  </tr>
                ) : propertiesList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      <i className="fas fa-check-circle text-emerald-500 text-xl mb-1.5 block"></i>
                      Tous les biens immobiliers sont actuellement attribués à un propriétaire.
                    </td>
                  </tr>
                ) : (
                  propertiesList.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-sky-700">
                        {p.reference_code || `BIEN-${String(p.id).padStart(3, '0')}`}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{p.name}</div>
                        <div className="text-[11px] text-slate-400 truncate max-w-xs">{p.address}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-medium">
                        {p.zone || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 uppercase font-medium">
                        {p.type || 'Appartement'}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900 tabular-nums">
                        {formatAmount(p.rent || 0)} FCFA
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Non attribué
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setAssigningProperty(p);
                            setSelectedOwnerId('');
                            setAssignmentNotes('');
                          }}
                          className="px-3 py-1.5 bg-primary hover:bg-primary-dark text-white font-semibold rounded-lg text-xs transition-colors shadow-2xs flex items-center gap-1.5 mx-auto"
                        >
                          <i className="fas fa-user-plus text-[10px]"></i>
                          <span>Attribuer</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONTENU ONGLET 2 : BIENS ATTRIBUÉS & RÉATTRIBUTION */}
      {activeTab === 'assigned' && (
        <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-700">
              Biens immobiliers actifs rattachés à un propriétaire bailleur
            </div>
            <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              {propertiesList.length} bien{propertiesList.length > 1 ? 's' : ''} attribué{propertiesList.length > 1 ? 's' : ''}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Réf.</th>
                  <th className="px-4 py-3">Bien & Zone</th>
                  <th className="px-4 py-3">Propriétaire Bailleur</th>
                  <th className="px-4 py-3">Date d'Attribution</th>
                  <th className="px-4 py-3 text-right">Loyer</th>
                  <th className="px-4 py-3 text-center">Statut</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assignmentsLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      <i className="fas fa-spinner fa-spin mr-2"></i> Chargement...
                    </td>
                  </tr>
                ) : propertiesList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      Aucun bien attribué correspondant.
                    </td>
                  </tr>
                ) : (
                  propertiesList.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-sky-700">
                        {p.reference_code || `BIEN-${String(p.id).padStart(3, '0')}`}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{p.name}</div>
                        <div className="text-[11px] text-slate-400">{p.zone || p.address}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-800">{p.owner_name}</div>
                        <div className="text-[11px] text-slate-400">{p.owner_phone || p.owner_email || '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {p.assigned_at ? formatDate(p.assigned_at, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900 tabular-nums">
                        {formatAmount(p.rent || 0)} FCFA
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Attribué
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setReassigningProperty(p);
                            setNewOwnerId('');
                            setReassignNotes('');
                          }}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition-colors border border-slate-200 flex items-center gap-1.5 mx-auto"
                        >
                          <i className="fas fa-repeat text-slate-500 text-[10px]"></i>
                          <span>Réattribuer</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONTENU ONGLET 3 : HISTORIQUE DES ATTRIBUTIONS */}
      {activeTab === 'history' && (
        <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-700">
              Journal immuable des attributions et transferts de mandats
            </div>
            <span className="text-xs text-slate-500 font-medium">
              {historyList.length} événement{historyList.length > 1 ? 's' : ''}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Date & Heure</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Bien Immobilier</th>
                  <th className="px-4 py-3">Ancien Propriétaire</th>
                  <th className="px-4 py-3">Nouveau Propriétaire</th>
                  <th className="px-4 py-3">Opérateur</th>
                  <th className="px-4 py-3">Motif / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historyLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      <i className="fas fa-spinner fa-spin mr-2"></i> Chargement de l'historique...
                    </td>
                  </tr>
                ) : historyList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      Aucun historique d'attribution enregistré.
                    </td>
                  </tr>
                ) : (
                  historyList.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 text-slate-500 font-mono">
                        {formatDate(h.created_at, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            h.action_type === 'INITIAL_ASSIGNMENT'
                              ? 'bg-sky-50 text-sky-700 border border-sky-200'
                              : 'bg-purple-50 text-purple-700 border border-purple-200'
                          }`}
                        >
                          {h.action_type === 'INITIAL_ASSIGNMENT' ? 'Attribution' : 'Réattribution'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {h.property_ref} – {h.property_name}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {h.previous_owner_name || '— (Aucun)'}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-800">
                        {h.new_owner_name}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {h.performed_by_name || 'Manager'}
                      </td>
                      <td className="px-4 py-3 text-slate-500 italic max-w-xs truncate">
                        {h.notes || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODALE D'ATTRIBUTION INITIALE */}
      {assigningProperty && (
        <Modal
          isOpen={Boolean(assigningProperty)}
          onClose={() => setAssigningProperty(null)}
          title="Attribuer un Bien Immobilier"
        >
          <form onSubmit={handleConfirmAssignment} className="space-y-4">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <div className="text-xs font-bold text-slate-900">
                {assigningProperty.name} ({assigningProperty.reference_code})
              </div>
              <div className="text-xs text-slate-500">
                {assigningProperty.address} • Loyer : {formatAmount(assigningProperty.rent)} FCFA
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Sélectionner le Propriétaire Bailleur *
              </label>
              <select
                value={selectedOwnerId}
                onChange={(e) => setSelectedOwnerId(e.target.value)}
                required
                className="w-full p-2.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
              >
                <option value="">-- Choisir un propriétaire --</option>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.display_name || `${o.first_name} ${o.last_name}`} ({o.phone || o.email || `ID #${o.id}`})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Notes / Référence du Mandat (Optionnel)
              </label>
              <textarea
                value={assignmentNotes}
                onChange={(e) => setAssignmentNotes(e.target.value)}
                rows={2}
                placeholder="Ex: Mandat de gérance n°2026-X, signé le..."
                className="w-full p-2.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              ></textarea>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAssigningProperty(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={assignMutation.isPending}
                className="px-4 py-2 bg-primary hover:bg-primary-dark text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 disabled:opacity-60"
              >
                {assignMutation.isPending && <i className="fas fa-spinner fa-spin"></i>}
                <span>Confirmer l'attribution</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODALE DE RÉATTRIBUTION */}
      {reassigningProperty && (
        <Modal
          isOpen={Boolean(reassigningProperty)}
          onClose={() => setReassigningProperty(null)}
          title="Réattribuer le Bien Immobilier"
        >
          <form onSubmit={handleConfirmReassignment} className="space-y-4">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <div className="text-xs font-bold text-slate-900">
                {reassigningProperty.name} ({reassigningProperty.reference_code})
              </div>
              <div className="text-xs text-slate-500">
                Propriétaire actuel : <strong className="text-slate-800">{reassigningProperty.owner_name}</strong>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nouveau Propriétaire Bailleur *
              </label>
              <select
                value={newOwnerId}
                onChange={(e) => setNewOwnerId(e.target.value)}
                required
                className="w-full p-2.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
              >
                <option value="">-- Choisir le nouveau propriétaire --</option>
                {owners
                  .filter((o) => Number(o.id) !== Number(reassigningProperty.owner_id))
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.display_name || `${o.first_name} ${o.last_name}`} ({o.phone || o.email || `ID #${o.id}`})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Motif de la Réattribution / Transfert *
              </label>
              <textarea
                value={reassignNotes}
                onChange={(e) => setReassignNotes(e.target.value)}
                required
                rows={2}
                placeholder="Ex: Cession de bien, succession notariée, changement de mandat..."
                className="w-full p-2.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              ></textarea>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setReassigningProperty(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={reassignMutation.isPending}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 disabled:opacity-60"
              >
                {reassignMutation.isPending && <i className="fas fa-spinner fa-spin"></i>}
                <span>Confirmer la réattribution</span>
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
