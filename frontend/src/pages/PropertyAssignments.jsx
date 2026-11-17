import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  usePropertyAssignments,
  usePropertyAssignmentHistory,
  useAssignTenant,
  useReplaceTenant,
  useDepartTenant,
} from '../hooks/queries/usePropertyAssignments';
import { useClients } from '../hooks/queries/useClients';
import { useToast } from '../components/ToastContext';
import { useConfirm } from '../components/ConfirmContext';
import Modal from '../components/Modal';
import { formatXOF, formatDate } from '../utils/formatters';
import { FormField, MoneyInput, PhoneInput, FormSection } from '../components/ui/forms';

const TYPE_ICONS = {
  appartement: 'fa-building',
  maison: 'fa-home',
  terrain: 'fa-map',
  commercial: 'fa-store',
};

export default function PropertyAssignments() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [activeTab, setActiveTab] = useState('unassigned'); // 'unassigned' | 'assigned' | 'history'
  const [searchTerm, setSearchTerm] = useState('');

  // Modale d'attribution (bien vacant -> locataire)
  const [assigningProperty, setAssigningProperty] = useState(null);
  const [assignMode, setAssignMode] = useState('existing'); // 'existing' | 'new'
  const [selectedClientId, setSelectedClientId] = useState('');
  const [tenantSearch, setTenantSearch] = useState('');
  const [newTenantForm, setNewTenantForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    rent: '',
    deposit: '',
    startDate: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  // Modale de réattribution / changement de locataire
  const [reassigningProperty, setReassigningProperty] = useState(null);
  const [reassignMode, setReassignMode] = useState('existing'); // 'existing' | 'new'
  const [reassignClientId, setReassignClientId] = useState('');
  const [reassignForm, setReassignForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    newRent: '',
    endDate: new Date().toISOString().slice(0, 10),
    newStartDate: new Date().toISOString().slice(0, 10),
    departureReason: 'Remplacement de locataire',
    departureNotes: '',
  });

  // Modale de libération de bien (départ)
  const [departingProperty, setDepartingProperty] = useState(null);
  const [departForm, setDepartForm] = useState({
    departureDate: new Date().toISOString().slice(0, 10),
    departureReason: 'Fin de bail / Départ conventionnel',
    departureNotes: '',
  });

  // Requêtes
  const { data: assignmentsData = {}, isLoading: assignmentsLoading } = usePropertyAssignments({
    search: searchTerm,
    assignmentStatus: activeTab === 'unassigned' ? 'unassigned' : activeTab === 'assigned' ? 'assigned' : 'all',
  });
  const propertiesList = assignmentsData.assignments || [];
  const kpis = assignmentsData.kpis || { unassignedCount: 0, assignedCount: 0, historyCount: 0 };

  const { data: historyList = [], isLoading: historyLoading } = usePropertyAssignmentHistory({
    search: searchTerm,
  });

  // Liste des locataires pour sélection
  const { data: clientsData = {} } = useClients({ limit: 150 });
  const allClients = clientsData.data || [];
  // Locataires disponibles (sans bien actif ou pending)
  const availableClients = useMemo(() => {
    return allClients.filter(c => c.status !== 'inactive');
  }, [allClients]);

  // Mutations
  const assignMutation = useAssignTenant();
  const replaceMutation = useReplaceTenant();
  const departMutation = useDepartTenant();

  // Détection du query param ?propertyId=...
  useEffect(() => {
    const propId = searchParams.get('propertyId');
    if (propId && propertiesList.length > 0) {
      const target = propertiesList.find(p => Number(p.id) === Number(propId));
      if (target) {
        if (target.status === 'loue' || target.tenant_id) {
          setActiveTab('assigned');
        } else {
          setActiveTab('unassigned');
          handleOpenAssign(target);
        }
      }
    }
  }, [searchParams, propertiesList]);

  // Handlers Modale Attribution
  const handleOpenAssign = (property) => {
    setAssigningProperty(property);
    setAssignMode('existing');
    setSelectedClientId('');
    setTenantSearch('');
    const propRent = property.rent ? parseFloat(property.rent) : 0;
    setNewTenantForm({
      firstName: '',
      lastName: '',
      phone: '',
      email: '',
      rent: propRent || '',
      deposit: propRent ? propRent * 2 : '',
      startDate: new Date().toISOString().slice(0, 10),
      notes: '',
    });
  };

  const handleConfirmAssignment = async (e) => {
    e.preventDefault();
    if (!assigningProperty) return;

    try {
      if (assignMode === 'existing') {
        if (!selectedClientId) {
          showToast({ type: 'error', message: 'Veuillez sélectionner un locataire existant.' });
          return;
        }
        await assignMutation.mutateAsync({
          propertyId: assigningProperty.id,
          clientId: selectedClientId,
          rent: newTenantForm.rent ? parseFloat(newTenantForm.rent) : undefined,
          deposit: newTenantForm.deposit ? parseFloat(newTenantForm.deposit) : undefined,
          startDate: newTenantForm.startDate,
          notes: newTenantForm.notes || 'Attribution directe par le Manager',
        });
      } else {
        if (!newTenantForm.lastName || !newTenantForm.phone) {
          showToast({ type: 'error', message: 'Nom et téléphone du nouveau locataire sont obligatoires.' });
          return;
        }
        await assignMutation.mutateAsync({
          propertyId: assigningProperty.id,
          newTenant: {
            firstName: newTenantForm.firstName,
            lastName: newTenantForm.lastName,
            phone: newTenantForm.phone,
            email: newTenantForm.email,
          },
          rent: newTenantForm.rent ? parseFloat(newTenantForm.rent) : parseFloat(assigningProperty.rent || 0),
          deposit: newTenantForm.deposit ? parseFloat(newTenantForm.deposit) : 0,
          startDate: newTenantForm.startDate,
          notes: newTenantForm.notes || 'Création & attribution directe par le Manager',
        });
      }

      showToast({ type: 'success', message: 'Bien attribué avec succès au locataire !' });
      setAssigningProperty(null);
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Erreur lors de l\'attribution.' });
    }
  };

  // Handlers Modale Réattribution
  const handleOpenReassign = (property) => {
    setReassigningProperty(property);
    setReassignMode('existing');
    setReassignClientId('');
    setReassignForm({
      firstName: '',
      lastName: '',
      phone: '',
      email: '',
      newRent: property.rent ? parseFloat(property.rent) : '',
      endDate: new Date().toISOString().slice(0, 10),
      newStartDate: new Date().toISOString().slice(0, 10),
      departureReason: 'Remplacement de locataire',
      departureNotes: '',
    });
  };

  const handleConfirmReassignment = async (e) => {
    e.preventDefault();
    if (!reassigningProperty || !reassigningProperty.tenant_id) {
      showToast({ type: 'error', message: 'Ce bien n\'a pas de locataire actif à remplacer.' });
      return;
    }

    try {
      const payload = {
        clientId: reassigningProperty.tenant_id,
        endDate: reassignForm.endDate,
        newStartDate: reassignForm.newStartDate,
        newRent: parseFloat(reassignForm.newRent || reassigningProperty.rent || 0),
        departureReason: reassignForm.departureReason,
        departureNotes: reassignForm.departureNotes,
      };

      if (reassignMode === 'existing') {
        if (!reassignClientId) {
          showToast({ type: 'error', message: 'Veuillez sélectionner le nouveau locataire.' });
          return;
        }
        if (Number(reassignClientId) === Number(reassigningProperty.tenant_id)) {
          showToast({ type: 'error', message: 'Le nouveau locataire doit être différent de l\'actuel.' });
          return;
        }
        payload.existingTenantId = reassignClientId;
      } else {
        if (!reassignForm.lastName || !reassignForm.phone) {
          showToast({ type: 'error', message: 'Nom et téléphone du nouveau locataire sont obligatoires.' });
          return;
        }
        payload.newTenant = {
          firstName: reassignForm.firstName,
          lastName: reassignForm.lastName,
          phone: reassignForm.phone,
          email: reassignForm.email,
        };
      }

      await replaceMutation.mutateAsync(payload);
      showToast({ type: 'success', message: 'Changement de locataire effectué et historisé !' });
      setReassigningProperty(null);
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Erreur lors du remplacement.' });
    }
  };

  // Handlers Modale Départ
  const handleOpenDepart = (property) => {
    setDepartingProperty(property);
    setDepartForm({
      departureDate: new Date().toISOString().slice(0, 10),
      departureReason: 'Fin de bail / Départ conventionnel',
      departureNotes: '',
    });
  };

  const handleConfirmDepart = async (e) => {
    e.preventDefault();
    if (!departingProperty || !departingProperty.tenant_id) {
      showToast({ type: 'error', message: 'Aucun locataire associé à libérer.' });
      return;
    }

    const isConfirmed = await confirm(
      `Confirmez-vous le départ du locataire "${departingProperty.tenant_name || 'actuel'}" et la libération du bien "${departingProperty.reference_code || departingProperty.name}" ?`
    );
    if (!isConfirmed) return;

    try {
      await departMutation.mutateAsync({
        clientId: departingProperty.tenant_id,
        departureDate: departForm.departureDate,
        departureReason: departForm.departureReason,
        departureNotes: departForm.departureNotes,
      });

      showToast({ type: 'success', message: 'Le bien a été libéré avec succès et remis en statut vacant.' });
      setDepartingProperty(null);
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Erreur lors de la libération du bien.' });
    }
  };

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
                Attribution des Biens aux Locataires
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Associez les biens vacants aux locataires, gérez les changements de baux, libérations et historique des attributions.
              </p>
            </div>
          </div>
        </div>

        {/* Barre de recherche et action rapide */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input
              type="text"
              placeholder="Rechercher bien, référence, locataire..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-2xs"
            />
          </div>
          {kpis.unassignedCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setActiveTab('unassigned');
                const firstVacant = properties.find(p => p.status === 'vacant' || p.status === 'disponible');
                if (firstVacant) handleOpenAssign(firstVacant);
              }}
              className="h-9 px-3.5 bg-primary hover:bg-primary-dark text-white rounded-lg text-xs font-bold transition-all shadow-2xs inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              title="Attribuer un bien disponible à un locataire"
            >
              <i className="fas fa-plus text-xs"></i>
              <span>Attribuer un bien</span>
            </button>
          )}
        </div>
      </div>

      {/* 3 CARTES KPIS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* KPI 1 : Biens non attribués */}
        <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
            <i className="fas fa-door-open text-lg"></i>
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Biens disponibles (Vacants)
            </span>
            <div className="text-2xl font-black text-slate-900 tabular-nums">
              {kpis.unassignedCount}
            </div>
            <span className="text-[11px] text-amber-700 font-medium">Prêts pour attribution locataire</span>
          </div>
        </div>

        {/* KPI 2 : Biens attribués */}
        <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
            <i className="fas fa-key text-lg"></i>
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Biens attribués (Loués)
            </span>
            <div className="text-2xl font-black text-slate-900 tabular-nums">
              {kpis.assignedCount}
            </div>
            <span className="text-[11px] text-emerald-700 font-medium">Baux locatifs en cours</span>
          </div>
        </div>

        {/* KPI 3 : Total historique */}
        <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
            <i className="fas fa-history text-lg"></i>
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Opérations historisées
            </span>
            <div className="text-2xl font-black text-slate-900 tabular-nums">
              {kpis.historyCount}
            </div>
            <span className="text-[11px] text-blue-700 font-medium">Attributions, départs et transferts</span>
          </div>
        </div>
      </div>

      {/* ONGLETS DE NAVIGATION */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('unassigned')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'unassigned'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <i className="fas fa-door-open"></i>
          <span>Biens à attribuer (Vacants)</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${activeTab === 'unassigned' ? 'bg-white text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
            {kpis.unassignedCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('assigned')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'assigned'
              ? 'bg-primary text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <i className="fas fa-key"></i>
          <span>Biens attribués (Loués)</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${activeTab === 'assigned' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'}`}>
            {kpis.assignedCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'history'
              ? 'bg-slate-800 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <i className="fas fa-clock-rotate-left"></i>
          <span>Historique des attributions</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${activeTab === 'history' ? 'bg-slate-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
            {kpis.historyCount}
          </span>
        </button>
      </div>

      {/* CONTENU ONGLET 1 : BIENS VACANTS */}
      {activeTab === 'unassigned' && (
        <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Biens immobiliers disponibles à l'attribution
              </h2>
              <p className="text-xs text-slate-500">
                Sélectionnez un bien vacant pour lui associer un locataire existant ou créer un nouveau bail.
              </p>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              {propertiesList.length} bien(s) vacant(s)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="py-3 px-6 font-semibold">Référence & Bien</th>
                  <th className="py-3 px-6 font-semibold">Zone & Adresse</th>
                  <th className="py-3 px-6 font-semibold">Propriétaire bailleur</th>
                  <th className="py-3 px-6 font-semibold text-right">Loyer mensuel</th>
                  <th className="py-3 px-6 font-semibold text-center">Statut</th>
                  <th className="py-3.5 px-6 font-semibold text-right whitespace-nowrap min-w-[140px]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {assignmentsLoading ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-slate-400">
                      <i className="fas fa-spinner fa-spin text-2xl mb-2 text-primary"></i>
                      <p className="text-xs">Chargement des biens vacants...</p>
                    </td>
                  </tr>
                ) : propertiesList.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-slate-400">
                      <i className="fas fa-check-circle text-3xl mb-2 text-emerald-500"></i>
                      <p className="text-sm font-medium text-slate-700">Aucun bien vacant à attribuer</p>
                      <p className="text-xs text-slate-400">Tous les biens sont actuellement loués ou sous mandat actif.</p>
                    </td>
                  </tr>
                ) : (
                  propertiesList.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-6 font-medium text-slate-900">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200">
                            <i className={`fas ${TYPE_ICONS[p.type] || 'fa-building'} text-xs`}></i>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900">{p.name}</span>
                              <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                {p.reference_code || `BIEN-${String(p.id).padStart(3, '0')}`}
                              </span>
                            </div>
                            <span className="text-xs text-slate-400 capitalize">{p.type}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-sm text-slate-600 max-w-[200px]">
                        {p.zone && (
                          <div className="text-[11px] font-semibold text-primary mb-0.5 flex items-center gap-1">
                            <i className="fas fa-location-dot text-[9px]"></i>
                            <span>{p.zone}</span>
                          </div>
                        )}
                        <div className="truncate text-slate-500 text-xs" title={p.address}>{p.address || '—'}</div>
                      </td>
                      <td className="py-4 px-6 text-sm">
                        {p.owner_name ? (
                          <div className="flex items-center gap-1.5">
                            <i className="fas fa-user-tie text-xs text-slate-400"></i>
                            <span className="font-medium text-slate-800">{p.owner_name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Non renseigné</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-sm font-bold text-emerald-700 text-right tabular-nums">
                        {formatXOF(p.rent, { compact: false })}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <i className="fas fa-door-open text-[10px]"></i>
                          Vacant
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenAssign(p)}
                          className="h-8 px-3 rounded-lg text-xs font-bold bg-primary hover:bg-primary-dark text-white transition-all shadow-2xs inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                          title={`Attribuer ${p.name} à un locataire`}
                        >
                          <i className="fas fa-key text-[10px]"></i>
                          <span>Attribuer ce bien</span>
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

      {/* CONTENU ONGLET 2 : BIENS LOUÉS */}
      {activeTab === 'assigned' && (
        <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Biens actuellement loués & Baux actifs
              </h2>
              <p className="text-xs text-slate-500">
                Consultez les locataires en place, effectuez un remplacement ou enregistrez un départ.
              </p>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              {propertiesList.length} bien(s) loué(s)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="py-3 px-6 font-semibold">Référence & Bien</th>
                  <th className="py-3 px-6 font-semibold">Propriétaire bailleur</th>
                  <th className="py-3 px-6 font-semibold">Locataire actuel</th>
                  <th className="py-3 px-6 font-semibold text-right">Loyer mensuel</th>
                  <th className="py-3 px-6 font-semibold text-center">Statut bail</th>
                  <th className="py-3.5 px-6 font-semibold text-right whitespace-nowrap min-w-[180px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {assignmentsLoading ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-slate-400">
                      <i className="fas fa-spinner fa-spin text-2xl mb-2 text-primary"></i>
                      <p className="text-xs">Chargement des biens loués...</p>
                    </td>
                  </tr>
                ) : propertiesList.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-slate-400">
                      <i className="fas fa-inbox text-3xl mb-2 text-slate-300"></i>
                      <p className="text-sm font-medium text-slate-700">Aucun bien loué trouvé</p>
                    </td>
                  </tr>
                ) : (
                  propertiesList.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-6 font-medium text-slate-900">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200">
                            <i className={`fas ${TYPE_ICONS[p.type] || 'fa-building'} text-xs`}></i>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900">{p.name}</span>
                              <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                {p.reference_code || `BIEN-${String(p.id).padStart(3, '0')}`}
                              </span>
                            </div>
                            <span className="text-xs text-slate-400 capitalize">{p.zone || p.address}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-sm">
                        <div className="font-medium text-slate-800">{p.owner_name || 'Bailleur'}</div>
                        {p.owner_phone && <div className="text-xs text-slate-400">{p.owner_phone}</div>}
                      </td>
                      <td className="py-4 px-6 text-sm">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <i className="fas fa-user text-xs text-primary"></i>
                          <span>{p.tenant_name || `${p.tenant_last_name || ''} ${p.tenant_first_name || ''}`.trim() || 'Locataire'}</span>
                        </div>
                        {p.tenant_phone && (
                          <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            <i className="fas fa-phone text-[10px] text-slate-400"></i>
                            <span>{p.tenant_phone}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-6 text-sm font-bold text-slate-900 text-right tabular-nums">
                        {formatXOF(p.tenant_rent || p.rent, { compact: false })}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <i className="fas fa-check-circle text-[10px]"></i>
                          Loué (Actif)
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenReassign(p)}
                            className="h-8 px-2.5 rounded-lg text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs whitespace-nowrap"
                            title="Remplacer le locataire"
                          >
                            <i className="fas fa-user-pen text-[10px]"></i>
                            <span>Changer locataire</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDepart(p)}
                            className="h-8 px-2.5 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs whitespace-nowrap"
                            title="Enregistrer le départ et libérer le bien"
                          >
                            <i className="fas fa-arrow-right-from-bracket text-[10px]"></i>
                            <span>Libérer</span>
                          </button>
                        </div>
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
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Journal chronologique des attributions locatives
              </h2>
              <p className="text-xs text-slate-500">
                Traçabilité immuable de chaque bail, changement de locataire et libération de bien.
              </p>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              {historyList.length} enregistrement(s)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="py-3 px-6 font-semibold">Date & Heure</th>
                  <th className="py-3 px-6 font-semibold">Bien immobilier</th>
                  <th className="py-3 px-6 font-semibold">Propriétaire</th>
                  <th className="py-3 px-6 font-semibold">Opération</th>
                  <th className="py-3 px-6 font-semibold">Ancien locataire</th>
                  <th className="py-3 px-6 font-semibold">Nouveau locataire</th>
                  <th className="py-3 px-6 font-semibold text-right">Loyer</th>
                  <th className="py-3 px-6 font-semibold">Auteur / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {historyLoading ? (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-slate-400">
                      <i className="fas fa-spinner fa-spin text-2xl mb-2 text-primary"></i>
                      <p className="text-xs">Chargement de l'historique...</p>
                    </td>
                  </tr>
                ) : historyList.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-slate-400">
                      <i className="fas fa-clock text-3xl mb-2 text-slate-300"></i>
                      <p className="text-sm font-medium text-slate-700">Aucun historique disponible</p>
                    </td>
                  </tr>
                ) : (
                  historyList.map((h) => {
                    let badgeClass = 'bg-blue-50 text-blue-700 border-blue-200';
                    let actionLabel = 'Attribution';
                    if (h.action_type === 'REASSIGNMENT') {
                      badgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
                      actionLabel = 'Changement locataire';
                    } else if (h.action_type === 'DEPARTURE') {
                      badgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
                      actionLabel = 'Libération / Départ';
                    }

                    return (
                      <tr key={h.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-4 px-6 text-xs text-slate-500 whitespace-nowrap">
                          {formatDate(h.created_at, { includeTime: true })}
                        </td>
                        <td className="py-4 px-6 font-medium text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                              {h.property_ref || `BIEN-${h.property_id}`}
                            </span>
                            <span className="truncate max-w-[140px]" title={h.property_name}>{h.property_name}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-xs text-slate-600">
                          {h.owner_name || '—'}
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${badgeClass}`}>
                            {actionLabel}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-xs text-slate-500">
                          {h.previous_tenant_name ? (
                            <span className="font-medium text-slate-700">{h.previous_tenant_name}</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-xs text-slate-700">
                          {h.new_tenant_name ? (
                            <span className="font-bold text-slate-900">{h.new_tenant_name}</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-sm font-semibold text-slate-900 text-right tabular-nums">
                          {h.rent_amount ? formatXOF(h.rent_amount, { compact: false }) : '—'}
                        </td>
                        <td className="py-4 px-6 text-xs text-slate-500">
                          <div className="font-medium text-slate-700">{h.performed_by_name || 'Système'}</div>
                          {h.notes && <div className="text-[11px] text-slate-400 italic truncate max-w-[160px]" title={h.notes}>{h.notes}</div>}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODALE D'ATTRIBUTION DU BIEN (VACANT -> LOCATAIRE) */}
      {assigningProperty && (
        <Modal
          title={`Attribuer le bien : ${assigningProperty.reference_code || assigningProperty.name}`}
          subtitle={`Propriétaire bailleur : ${assigningProperty.owner_name || 'Non spécifié'}`}
          icon="fa-key"
          onClose={() => setAssigningProperty(null)}
          maxWidth="640px"
        >
          <form onSubmit={handleConfirmAssignment} className="space-y-4">
            {/* Choix Option A vs Option B */}
            <div className="flex p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setAssignMode('existing')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  assignMode === 'existing'
                    ? 'bg-white text-primary shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <i className="fas fa-users"></i>
                <span>Option A : Locataire existant</span>
              </button>
              <button
                type="button"
                onClick={() => setAssignMode('new')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  assignMode === 'new'
                    ? 'bg-white text-primary shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <i className="fas fa-user-plus"></i>
                <span>Option B : Créer nouveau locataire</span>
              </button>
            </div>

            {assignMode === 'existing' ? (
              <div className="space-y-3">
                <div>
                  <label htmlFor="tenantSearch" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Rechercher un locataire (Nom ou Téléphone)
                  </label>
                  <div className="relative mb-2.5">
                    <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                    <input
                      id="tenantSearch"
                      type="text"
                      placeholder="Tapez un nom ou un numéro (ex: Kouadio, 07 09...)"
                      value={tenantSearch}
                      onChange={(e) => setTenantSearch(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                  <label htmlFor="clientId" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Sélectionner le locataire <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="clientId"
                    required
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                  >
                    <option value="">-- Choisir un locataire --</option>
                    {availableClients
                      .filter((c) => {
                        if (!tenantSearch.trim()) return true;
                        const q = tenantSearch.toLowerCase();
                        const fullName = `${c.last_name || ''} ${c.first_name || ''}`.toLowerCase();
                        const phone = (c.phone || '').toLowerCase();
                        return fullName.includes(q) || phone.includes(q);
                      })
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.last_name} {c.first_name} {c.phone ? `(${c.phone})` : ''} {c.property_name ? `— Actuellement : ${c.property_name}` : ''}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField label="Nom de famille" id="lastName" required>
                    <input
                      id="lastName"
                      type="text"
                      required
                      placeholder="Ex : KOUADIO"
                      value={newTenantForm.lastName}
                      onChange={(e) => setNewTenantForm({ ...newTenantForm, lastName: e.target.value })}
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </FormField>
                  <FormField label="Prénom(s)" id="firstName" optional>
                    <input
                      id="firstName"
                      type="text"
                      placeholder="Ex : Michel"
                      value={newTenantForm.firstName}
                      onChange={(e) => setNewTenantForm({ ...newTenantForm, firstName: e.target.value })}
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </FormField>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField label="Téléphone" id="phone" required hint="Format CI (10 chiffres)">
                    <PhoneInput
                      id="phone"
                      required
                      value={newTenantForm.phone}
                      onChange={(cleanVal) => setNewTenantForm({ ...newTenantForm, phone: cleanVal })}
                    />
                  </FormField>
                  <FormField label="Email" id="email" optional>
                    <input
                      id="email"
                      type="email"
                      placeholder="Ex : locataire@email.ci"
                      value={newTenantForm.email}
                      onChange={(e) => setNewTenantForm({ ...newTenantForm, email: e.target.value })}
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </FormField>
                </div>
              </div>
            )}

            {/* Conditions Financières du Bail */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <i className="fas fa-file-contract text-primary"></i>
                Conditions financières du bail
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <FormField label="Loyer mensuel" id="assignRent" required>
                  <MoneyInput
                    id="assignRent"
                    required
                    value={newTenantForm.rent}
                    onChange={(val) => {
                      const numRent = Number(val) || 0;
                      setNewTenantForm({
                        ...newTenantForm,
                        rent: val,
                        deposit: newTenantForm.deposit ? newTenantForm.deposit : (numRent ? numRent * 2 : '')
                      });
                    }}
                  />
                </FormField>
                <FormField label="Caution de garantie" id="deposit" required>
                  <MoneyInput
                    id="deposit"
                    required
                    value={newTenantForm.deposit}
                    onChange={(val) => setNewTenantForm({ ...newTenantForm, deposit: val })}
                    presets={[
                      { label: '2 mois', value: (Number(newTenantForm.rent) || 0) * 2 },
                      { label: '1 mois', value: Number(newTenantForm.rent) || 0 }
                    ]}
                  />
                </FormField>
                <FormField label="Date d'effet" id="startDate" required>
                  <input
                    id="startDate"
                    type="date"
                    required
                    value={newTenantForm.startDate}
                    onChange={(e) => setNewTenantForm({ ...newTenantForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </FormField>
              </div>

              <FormField label="Notes ou observations" id="notes" optional>
                <input
                  id="notes"
                  type="text"
                  placeholder="Ex : Remise des clés effectuée, bail signé pour 12 mois..."
                  value={newTenantForm.notes}
                  onChange={(e) => setNewTenantForm({ ...newTenantForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </FormField>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setAssigningProperty(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={assignMutation.isPending}
                className="px-5 py-2 rounded-xl text-sm font-bold bg-primary text-white hover:bg-primary-dark transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {assignMutation.isPending ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    <span>Attribution en cours...</span>
                  </>
                ) : (
                  <>
                    <i className="fas fa-check"></i>
                    <span>Confirmer l'attribution</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODALE DE RÉATTRIBUTION / CHANGEMENT DE LOCATAIRE */}
      {reassigningProperty && (
        <Modal
          title={`Remplacer le locataire : ${reassigningProperty.reference_code || reassigningProperty.name}`}
          subtitle={`Locataire actuel sortant : ${reassigningProperty.tenant_name || 'En place'}`}
          icon="fa-user-pen"
          onClose={() => setReassigningProperty(null)}
          maxWidth="640px"
        >
          <form onSubmit={handleConfirmReassignment} className="space-y-4">
            {/* Clôture de l'ancien bail */}
            <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                <i className="fas fa-triangle-exclamation text-amber-600"></i>
                Clôture du bail de l'ancien locataire ({reassigningProperty.tenant_name})
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="endDate" className="block text-xs font-semibold text-amber-900 mb-1">
                    Date de fin de bail
                  </label>
                  <input
                    id="endDate"
                    type="date"
                    required
                    value={reassignForm.endDate}
                    onChange={(e) => setReassignForm({ ...reassignForm, endDate: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
                <div>
                  <label htmlFor="departureReason" className="block text-xs font-semibold text-amber-900 mb-1">
                    Motif du changement
                  </label>
                  <input
                    id="departureReason"
                    type="text"
                    required
                    value={reassignForm.departureReason}
                    onChange={(e) => setReassignForm({ ...reassignForm, departureReason: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
              </div>
            </div>

            {/* Nouveau Locataire */}
            <div className="space-y-3">
              <div className="flex p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setReassignMode('existing')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    reassignMode === 'existing' ? 'bg-white text-primary shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Locataire existant
                </button>
                <button
                  type="button"
                  onClick={() => setReassignMode('new')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    reassignMode === 'new' ? 'bg-white text-primary shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Créer nouveau locataire
                </button>
              </div>

              {reassignMode === 'existing' ? (
                <div>
                  <label htmlFor="reassignClientId" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Nouveau locataire entrant <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="reassignClientId"
                    required
                    value={reassignClientId}
                    onChange={(e) => setReassignClientId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer"
                  >
                    <option value="">-- Choisir le nouveau locataire --</option>
                    {availableClients
                      .filter(c => Number(c.id) !== Number(reassigningProperty.tenant_id))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.last_name} {c.first_name} {c.phone ? `(${c.phone})` : ''}
                        </option>
                      ))}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="reassignLastName" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Nom entrant <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="reassignLastName"
                      type="text"
                      required
                      placeholder="Ex : KOFFI"
                      value={reassignForm.lastName}
                      onChange={(e) => setReassignForm({ ...reassignForm, lastName: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label htmlFor="reassignFirstName" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Prénom entrant
                    </label>
                    <input
                      id="reassignFirstName"
                      type="text"
                      placeholder="Ex : Serge"
                      value={reassignForm.firstName}
                      onChange={(e) => setReassignForm({ ...reassignForm, firstName: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="reassignPhone" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Téléphone entrant <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="reassignPhone"
                      type="tel"
                      required
                      placeholder="Ex : +225 07 11 22 33 44"
                      value={reassignForm.phone}
                      onChange={(e) => setReassignForm({ ...reassignForm, phone: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label htmlFor="newRent" className="block text-xs font-semibold text-slate-700 mb-1">
                    Nouveau loyer mensuel (FCFA)
                  </label>
                  <input
                    id="newRent"
                    type="number"
                    value={reassignForm.newRent}
                    onChange={(e) => setReassignForm({ ...reassignForm, newRent: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold text-emerald-700 focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label htmlFor="newStartDate" className="block text-xs font-semibold text-slate-700 mb-1">
                    Date de prise d'effet entrant
                  </label>
                  <input
                    id="newStartDate"
                    type="date"
                    value={reassignForm.newStartDate}
                    onChange={(e) => setReassignForm({ ...reassignForm, newStartDate: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setReassigningProperty(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={replaceMutation.isPending}
                className="px-5 py-2 rounded-xl text-sm font-bold bg-amber-600 text-white hover:bg-amber-700 transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {replaceMutation.isPending ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    <span>Remplacement en cours...</span>
                  </>
                ) : (
                  <>
                    <i className="fas fa-check"></i>
                    <span>Valider le changement de locataire</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODALE DE LIBÉRATION DE BIEN (DÉPART LOCATAIRE) */}
      {departingProperty && (
        <Modal
          title={`Libérer le bien : ${departingProperty.reference_code || departingProperty.name}`}
          subtitle={`Départ du locataire : ${departingProperty.tenant_name || 'En place'}`}
          icon="fa-arrow-right-from-bracket"
          onClose={() => setDepartingProperty(null)}
          maxWidth="540px"
        >
          <form onSubmit={handleConfirmDepart} className="space-y-4">
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <i className="fas fa-exclamation-circle text-rose-600"></i>
                Attention : Cette action clôture définitivement le bail en cours.
              </p>
              <p className="text-slate-600">
                Le bien sera automatiquement réinitialisé en statut <strong>vacant (disponible)</strong> et retiré du compte du locataire.
              </p>
            </div>

            <div>
              <label htmlFor="departDate" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Date effective du départ <span className="text-rose-500">*</span>
              </label>
              <input
                id="departDate"
                type="date"
                required
                value={departForm.departureDate}
                onChange={(e) => setDepartForm({ ...departForm, departureDate: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label htmlFor="departReason" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Motif du départ <span className="text-rose-500">*</span>
              </label>
              <select
                id="departReason"
                required
                value={departForm.departureReason}
                onChange={(e) => setDepartForm({ ...departForm, departureReason: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value="Fin de bail / Départ conventionnel">Fin de bail / Départ conventionnel</option>
                <option value="Résiliation anticipée locataire">Résiliation anticipée par le locataire</option>
                <option value="Résiliation propriétaire / Congé">Congé donné par le propriétaire</option>
                <option value="Déménagement / Mutation">Déménagement / Mutation professionnelle</option>
                <option value="Impayés / Expulsion">Impayés répétés / Expulsion</option>
                <option value="Autre motif">Autre motif</option>
              </select>
            </div>

            <div>
              <label htmlFor="departNotes" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Remarques & État des lieux de sortie (optionnel)
              </label>
              <textarea
                id="departNotes"
                rows="2"
                placeholder="Ex : Clés restituées, caution déduite de 35 000 FCFA pour remise en peinture..."
                value={departForm.departureNotes}
                onChange={(e) => setDepartForm({ ...departForm, departureNotes: e.target.value })}
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDepartingProperty(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={departMutation.isPending}
                className="px-5 py-2 rounded-xl text-sm font-bold bg-rose-600 text-white hover:bg-rose-700 transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {departMutation.isPending ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    <span>Libération en cours...</span>
                  </>
                ) : (
                  <>
                    <i className="fas fa-door-open"></i>
                    <span>Confirmer la libération du bien</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
