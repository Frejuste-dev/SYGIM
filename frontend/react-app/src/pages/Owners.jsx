import React, { useState, useEffect } from 'react';
import { useOwners, useOwnerStats, useCreateOwner, useUpdateOwner, useDeleteOwner } from '../hooks/queries/useOwners';
import { useProperties } from '../hooks/queries/useProperties';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '../components/ToastContext';
import { useConfirm } from '../components/ConfirmContext';
import { API } from '../api/services';
import StatsCard from '../components/StatsCard';
import FilterBar from '../components/FilterBar';
import Modal from '../components/Modal';
import OwnerPayoutModal from '../components/OwnerPayoutModal';
import { formatXOF } from '../utils/formatters';
import { exportToExcel, exportToPDF } from '../utils/exportUtils';

const PAYMENT_METHOD_LABELS = {
  bank_transfer: 'Virement bancaire',
  mobile_money: 'Mobile Money (Wave/OM)',
  cheque: 'Chèque',
  cash: 'Espèces'
};

const SCHEDULE_LABELS = {
  monthly_full: 'Mensuel intégral',
  installment: 'Paiement échelonné',
  quarterly: 'Trimestriel',
  on_demand: 'À la demande'
};

const PROPERTY_STATUS_CONFIG = {
  loue: {
    label: 'Loué',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dotClass: 'bg-emerald-500',
    iconClass: 'fa-key text-emerald-600'
  },
  vacant: {
    label: 'Vacant',
    badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
    dotClass: 'bg-blue-500',
    iconClass: 'fa-door-open text-blue-600'
  },
  disponible: {
    label: 'Vacant',
    badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
    dotClass: 'bg-blue-500',
    iconClass: 'fa-door-open text-blue-600'
  },
  en_renovation: {
    label: 'En réparation',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-300',
    dotClass: 'bg-amber-500',
    iconClass: 'fa-tools text-amber-600'
  },
  en_maintenance: {
    label: 'En réparation',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-300',
    dotClass: 'bg-amber-500',
    iconClass: 'fa-tools text-amber-600'
  },
  vendu: {
    label: 'Vendu',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    dotClass: 'bg-slate-400',
    iconClass: 'fa-tag text-slate-500'
  }
};

const EMPTY_FORM = () => ({
  first_name: '',
  last_name: '',
  phone: '',
  email: '',
  address: '',
  id_number: '',
  bank_name: '',
  bank_account: '',
  preferred_payment_method: 'bank_transfer',
  payout_schedule: 'monthly_full',
  preferred_payout_day: '5',
  commission_rate: 10,
  property_ids: [],
  notes: ''
});

export default function Owners() {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchTerm = searchParams.get('search') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = 25;

  const [propertyStatusFilter, setPropertyStatusFilter] = useState('all');

  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const handleFilterChange = (key, value) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    if (key !== 'page') newParams.delete('page');
    setSearchParams(newParams);
  };

  const { data: queryResult = {}, isLoading: loading } = useOwners({ page, limit, search: searchTerm });
  const owners = Array.isArray(queryResult) ? queryResult : (queryResult?.data || []);
  const pagination = queryResult?.pagination || {};
  const isLastPage = pagination.hasNext === false || pagination.hasNextPage === false;

  const { data: propertiesResult = {} } = useProperties({ limit: 300 });
  const allProperties = Array.isArray(propertiesResult) ? propertiesResult : (propertiesResult?.data || []);

  const [ownersSummary, setOwnersSummary] = useState([]);
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [selectedOwnerForPayout, setSelectedOwnerForPayout] = useState(null);

  const loadOwnersSummary = async () => {
    try {
      const res = await API.Financial.getOwnersSummary();
      const list = Array.isArray(res) ? res : (res?.data || []);
      setOwnersSummary(list);
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    loadOwnersSummary();
  }, []);

  const [showModal, setShowModal] = useState(false);
  const [editingOwner, setEditingOwner] = useState(null);
  const [formError, setFormError] = useState('');

  const createOwner = useCreateOwner();
  const updateOwner = useUpdateOwner();
  const deleteOwner = useDeleteOwner();
  const formSubmitting = createOwner.isPending || updateOwner.isPending;
  const [form, setForm] = useState(EMPTY_FORM());

  const { data: statsData = {} } = useOwnerStats({ search: searchTerm });

  const stats = [
    { label: 'Total Propriétaires', value: statsData.totalOwners || owners.length || 0, icon: 'fa-user-tie', color: 'var(--primary)' },
    { label: 'Biens sous gestion', value: statsData.totalProperties || 0, icon: 'fa-building', color: 'var(--primary)' },
    { label: 'En location (Loués)', value: statsData.rentedProperties || 0, icon: 'fa-key', color: 'var(--success, #16a34a)' },
    { label: 'Biens vacants', value: statsData.vacantProperties || 0, icon: 'fa-door-open', color: 'var(--info, #2563eb)' },
    { label: 'En réparation', value: statsData.repairProperties || 0, icon: 'fa-tools', color: 'var(--warning, #d97706)' }
  ];

  // Filtrage local selon le statut du parc du propriétaire
  const filteredOwners = owners.filter(o => {
    if (propertyStatusFilter === 'all') return true;
    const props = Array.isArray(o.properties) && o.properties.length > 0
      ? o.properties
      : allProperties.filter(p => Number(p.owner_id) === Number(o.id));

    if (propertyStatusFilter === 'has_rented') {
      return (o.rentedCount !== undefined ? o.rentedCount > 0 : props.some(p => p.status === 'loue'));
    }
    if (propertyStatusFilter === 'has_vacant') {
      return (o.vacantCount !== undefined ? o.vacantCount > 0 : props.some(p => p.status === 'vacant' || p.status === 'disponible'));
    }
    if (propertyStatusFilter === 'has_repair') {
      return (o.repairCount !== undefined ? o.repairCount > 0 : props.some(p => p.status === 'en_renovation' || p.status === 'en_maintenance'));
    }
    return true;
  });

  const openCreateModal = () => {
    setEditingOwner(null);
    setForm(EMPTY_FORM());
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (owner) => {
    setEditingOwner(owner);
    const assignedIds = Array.isArray(owner.property_ids)
      ? owner.property_ids
      : allProperties.filter(p => Number(p.owner_id) === Number(owner.id)).map(p => p.id);

    setForm({
      first_name: owner.first_name || '',
      last_name: owner.last_name || '',
      phone: owner.phone || '',
      email: owner.email || '',
      address: owner.address || '',
      id_number: owner.id_number || '',
      bank_name: owner.bank_name || '',
      bank_account: owner.bank_account || '',
      preferred_payment_method: owner.preferred_payment_method || 'bank_transfer',
      payout_schedule: owner.payout_schedule || 'monthly_full',
      preferred_payout_day: owner.preferred_payout_day || '5',
      commission_rate: owner.commission_rate ?? 10,
      property_ids: assignedIds,
      notes: owner.notes || ''
    });
    setFormError('');
    setShowModal(true);
  };

  const togglePropertySelection = (propId) => {
    const numId = Number(propId);
    setForm(prev => {
      const exists = prev.property_ids.includes(numId);
      const nextIds = exists
        ? prev.property_ids.filter(id => id !== numId)
        : [...prev.property_ids, numId];
      return { ...prev, property_ids: nextIds };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.last_name) {
      setFormError('Le nom est obligatoire.');
      return;
    }
    setFormError('');

    try {
      if (editingOwner) {
        await updateOwner.mutateAsync({ id: editingOwner.id, ...form });
        showToast({ type: 'success', message: 'Propriétaire et biens mis à jour avec succès.' });
      } else {
        await createOwner.mutateAsync(form);
        showToast({ type: 'success', message: 'Propriétaire créé et biens attribués avec succès.' });
      }
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['owners'] });
      loadOwnersSummary();
      setShowModal(false);
    } catch (err) {
      setFormError(err.message || 'Erreur serveur.');
    }
  };

  const handleDelete = async (owner) => {
    const isConfirmed = await confirm(`Voulez-vous vraiment supprimer ${owner.first_name} ${owner.last_name} ?`);
    if (!isConfirmed) return;
    try {
      await deleteOwner.mutateAsync(owner.id);
      showToast({ type: 'success', message: 'Propriétaire supprimé avec succès.' });
    } catch (err) {
      showToast({ type: 'error', message: 'Erreur lors de la suppression: ' + err.message });
    }
  };

  const handleOpenPayout = (owner = null) => {
    if (owner) {
      const enriched = ownersSummary.find(o => Number(o.id) === Number(owner.id)) || owner;
      setSelectedOwnerForPayout(enriched);
    } else {
      setSelectedOwnerForPayout(null);
    }
    setPayoutModalOpen(true);
  };

  // Préparation des données pour Export Excel / PDF avec décomposition de l'état du parc
  const getExportData = () => filteredOwners.map(o => {
    const props = Array.isArray(o.properties) && o.properties.length > 0
      ? o.properties
      : allProperties.filter(p => Number(p.owner_id) === Number(o.id));
    const rentedCount = o.rentedCount !== undefined ? o.rentedCount : props.filter(p => p.status === 'loue').length;
    const vacantCount = o.vacantCount !== undefined ? o.vacantCount : props.filter(p => p.status === 'vacant' || p.status === 'disponible').length;
    const repairCount = o.repairCount !== undefined ? o.repairCount : props.filter(p => p.status === 'en_renovation' || p.status === 'en_maintenance').length;
    const propertiesDetail = props.map(p => {
      const st = p.status === 'loue' 
        ? 'Loué' 
        : (p.status === 'vacant' || p.status === 'disponible') 
          ? 'Vacant' 
          : (p.status === 'en_renovation' || p.status === 'en_maintenance') 
            ? 'En réparation' 
            : (p.status || 'Inconnu');
      return `${p.name} (${st})`;
    }).join(', ');

    return {
      full_name: `${o.first_name || ''} ${o.last_name || ''}`.trim(),
      phone: o.phone || '—',
      email: o.email || '—',
      properties_count: props.length,
      rented_count: rentedCount,
      vacant_count: vacantCount,
      repair_count: repairCount,
      properties_detail: propertiesDetail || 'Aucun bien',
      total_rent: props.reduce((sum, p) => sum + Number(p.rent || 0), 0),
      payment_method: PAYMENT_METHOD_LABELS[o.preferred_payment_method] || 'Virement bancaire',
      payout_schedule: SCHEDULE_LABELS[o.payout_schedule] || 'Mensuel intégral',
      payout_day: `Le ${o.preferred_payout_day || '5'} du mois`,
      bank_info: [o.bank_name, o.bank_account].filter(Boolean).join(' - ') || '—'
    };
  });

  const EXPORT_COLUMNS = {
    full_name: 'Propriétaire',
    phone: 'Téléphone',
    email: 'Email',
    properties_count: 'Total Biens',
    rented_count: 'Loués (En location)',
    vacant_count: 'Vacants',
    repair_count: 'En Réparation',
    properties_detail: 'Détail des Biens & Statuts',
    total_rent: 'Loyers mensuels (XOF)',
    payment_method: 'Moyen de paiement',
    payout_schedule: 'Méthode de versement',
    payout_day: 'Date souhaitée',
    bank_info: 'Coordonnées bancaires'
  };

  const handleExportExcel = () => {
    const data = getExportData();
    if (!data.length) return showToast({ type: 'warning', message: 'Aucun propriétaire à exporter.' });
    exportToExcel(data, 'sygim-proprietaires-parc', EXPORT_COLUMNS, 'Propriétaires & État du Parc');
  };

  const handleExportPDF = () => {
    const data = getExportData();
    if (!data.length) return showToast({ type: 'warning', message: 'Aucun propriétaire à exporter.' });
    exportToPDF(data, 'sygim-proprietaires-parc', EXPORT_COLUMNS, {
      title: 'Liste Officielle des Propriétaires & État du Parc Immobilier',
      subtitle: 'Inventaire des Biens : En Location, Vacants et En Réparation',
      summary: [
        { label: 'Total Propriétaires', value: data.length },
        { label: 'Biens sous gestion', value: data.reduce((s, d) => s + d.properties_count, 0) },
        { label: 'En Location', value: data.reduce((s, d) => s + d.rented_count, 0) },
        { label: 'Biens Vacants', value: data.reduce((s, d) => s + d.vacant_count, 0) },
        { label: 'En Réparation', value: data.reduce((s, d) => s + d.repair_count, 0) },
        { label: 'Total Loyers Mensuels', value: formatXOF(data.reduce((s, d) => s + d.total_rent, 0)) }
      ]
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. EN-TÊTE */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Propriétaires &amp; État du Parc</h2>
          <p className="text-sm text-slate-500">
            Suivi du patrimoine par propriétaire, état d'occupation des biens (en location, vacants, en réparation) et reversements
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-sm font-semibold hover:bg-emerald-100 transition-colors shadow-2xs"
            title="Exporter la liste avec le détail du statut de chaque bien"
          >
            <i className="fas fa-file-excel"></i> Excel
          </button>
          <button
            type="button"
            onClick={handleExportPDF}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-sm font-semibold hover:bg-rose-100 transition-colors shadow-2xs"
            title="Exporter l'inventaire officiel du parc propriétaire en PDF"
          >
            <i className="fas fa-file-pdf"></i> PDF
          </button>
          <button
            type="button"
            onClick={() => handleOpenPayout(null)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors shadow-sm"
          >
            <i className="fas fa-hand-holding-dollar"></i> Payer / Préfinancer
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="bg-primary text-white rounded-lg px-4 py-2 hover:bg-primary-dark transition-all flex items-center gap-2 text-sm font-medium shadow-sm"
          >
            <i className="fas fa-plus"></i> Nouveau propriétaire
          </button>
        </div>
      </div>

      {/* 2. CARTES KPI (5 INDICATEURS CLÉS D'OCCUPATION DU PARC) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((s) => (
          <StatsCard key={s.label} label={s.label} title={s.label} value={s.value} icon={s.icon} color={s.color} />
        ))}
      </div>

      {/* 3. TABLEAU DES PROPRIÉTAIRES */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Barre de Recherche et Filtre d'occupation */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="flex-1">
            <FilterBar
              searchPlaceholder="Rechercher par nom, téléphone ou email..."
              searchValue={searchTerm}
              onSearchChange={(val) => handleFilterChange('search', val)}
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <label htmlFor="owner-property-filter" className="text-xs font-semibold text-slate-500 whitespace-nowrap">
              <i className="fas fa-filter text-primary mr-1"></i>Filtrer le parc :
            </label>
            <select
              id="owner-property-filter"
              value={propertyStatusFilter}
              onChange={(e) => setPropertyStatusFilter(e.target.value)}
              aria-label="Filtrer le parc de biens"
              className="text-xs font-medium border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer shadow-2xs"
            >
              <option value="all">Tous les propriétaires ({owners.length})</option>
              <option value="has_rented">🟢 Avec biens en location</option>
              <option value="has_vacant">⚪ Avec biens vacants</option>
              <option value="has_repair">🟠 Avec biens en réparation</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-slate-500">
              <i className="fas fa-spinner fa-spin mr-2"></i>Chargement des propriétaires et de leurs biens...
            </div>
          ) : filteredOwners.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400 text-2xl">
                <i className="fas fa-user-tie"></i>
              </div>
              <p className="text-slate-600 font-medium mb-2">
                {propertyStatusFilter !== 'all' 
                  ? 'Aucun propriétaire ne correspond à ce filtre de parc.' 
                  : 'Aucun propriétaire enregistré.'}
              </p>
              {propertyStatusFilter !== 'all' ? (
                <button 
                  className="mt-2 text-xs text-primary font-semibold hover:underline"
                  onClick={() => setPropertyStatusFilter('all')}
                >
                  Réinitialiser le filtre
                </button>
              ) : (
                <button className="mt-4 bg-primary text-white rounded-lg px-4 py-2 hover:bg-primary-dark transition-all text-sm font-medium" onClick={openCreateModal}>
                  <i className="fas fa-plus mr-2"></i>Ajouter un propriétaire
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3.5 px-4 font-semibold">Propriétaire</th>
                  <th className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3.5 px-4 font-semibold">Contact</th>
                  <th className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3.5 px-4 font-semibold min-w-[320px]">
                    Biens &amp; État du Parc (Loué / Vacant / Réparation)
                  </th>
                  <th className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3.5 px-4 font-semibold">Modalités de reversement</th>
                  <th className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3.5 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOwners.map((o) => {
                  const ownerProps = Array.isArray(o.properties) && o.properties.length > 0
                    ? o.properties
                    : allProperties.filter(p => Number(p.owner_id) === Number(o.id));
                  const totalPortfolioRent = ownerProps.reduce((sum, p) => sum + Number(p.rent || 0), 0);

                  const rentedCount = o.rentedCount !== undefined 
                    ? o.rentedCount 
                    : ownerProps.filter(p => p.status === 'loue').length;
                  const vacantCount = o.vacantCount !== undefined 
                    ? o.vacantCount 
                    : ownerProps.filter(p => p.status === 'vacant' || p.status === 'disponible').length;
                  const repairCount = o.repairCount !== undefined 
                    ? o.repairCount 
                    : ownerProps.filter(p => p.status === 'en_renovation' || p.status === 'en_maintenance').length;

                  return (
                    <tr key={o.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-4 text-sm text-slate-900 font-bold">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0 border border-indigo-100 shadow-2xs">
                            {(o.last_name || o.first_name || 'P').slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-slate-900 font-bold">{o.first_name} {o.last_name}</div>
                            {o.bank_name && (
                              <div className="text-xs font-normal text-slate-400">
                                <i className="fas fa-university mr-1"></i>{o.bank_name} {o.bank_account ? `(${o.bank_account})` : ''}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4 text-sm text-slate-600">
                        <div>{o.phone || '—'}</div>
                        <div className="text-xs text-slate-400">{o.email || ''}</div>
                      </td>

                      <td className="py-4 px-4 text-sm">
                        {/* Résumé global du patrimoine */}
                        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                            {ownerProps.length} bien{ownerProps.length > 1 ? 's' : ''} au total
                          </span>
                          {totalPortfolioRent > 0 && (
                            <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                              {formatXOF(totalPortfolioRent)}/mois
                            </span>
                          )}
                        </div>

                        {/* Badges de décomposition d'état du parc (Loué / Vacant / En réparation) */}
                        <div className="flex flex-wrap items-center gap-1.5 mb-2">
                          <span 
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
                            title="Nombre de biens actuellement loués et occupés"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            {rentedCount} en location
                          </span>
                          <span 
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200"
                            title="Nombre de biens vacants disponibles à la location"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                            {vacantCount} vacant{vacantCount > 1 ? 's' : ''}
                          </span>
                          <span 
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200"
                            title="Nombre de biens actuellement en travaux ou en réparation"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            {repairCount} en réparation
                          </span>
                        </div>

                        {/* Liste des biens individuels avec badge de statut */}
                        {ownerProps.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 max-w-md">
                            {ownerProps.map(p => {
                              const cfg = PROPERTY_STATUS_CONFIG[p.status] || {
                                label: p.status || 'Inconnu',
                                badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
                                dotClass: 'bg-slate-400',
                                iconClass: 'fa-home text-slate-400'
                              };
                              return (
                                <span 
                                  key={p.id} 
                                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border ${cfg.badgeClass}`}
                                  title={`${p.name} - Statut : ${cfg.label}`}
                                >
                                  <i className={`fas ${cfg.iconClass} text-[9px]`}></i>
                                  <span className="font-semibold">{p.name}</span>
                                  <span className="inline-flex items-center gap-1 text-[10px] opacity-90 font-normal">
                                    <span className={`w-1 h-1 rounded-full ${cfg.dotClass}`}></span>
                                    ({cfg.label})
                                  </span>
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Aucun bien rattaché</span>
                        )}
                      </td>

                      <td className="py-4 px-4 text-xs">
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                          <i className="fas fa-wallet text-primary"></i>
                          {PAYMENT_METHOD_LABELS[o.preferred_payment_method] || 'Virement bancaire'}
                        </div>
                        <div className="text-slate-500 mt-0.5">
                          {SCHEDULE_LABELS[o.payout_schedule] || 'Mensuel intégral'} &bull; Le {o.preferred_payout_day || '5'} du mois
                        </div>
                      </td>

                      <td className="py-4 px-4 text-sm text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenPayout(o)}
                            className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-2xs"
                            title="Enregistrer un versement ou préfinancement pour ce propriétaire"
                          >
                            <i className="fas fa-hand-holding-dollar"></i> Payer
                          </button>
                          <button
                            type="button"
                            className="p-1.5 text-slate-400 hover:text-primary transition-colors rounded-lg hover:bg-slate-100"
                            onClick={() => openEditModal(o)}
                            title="Modifier les coordonnées & attribuer des biens"
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                          <button
                            type="button"
                            className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors rounded-lg hover:bg-rose-50"
                            onClick={() => handleDelete(o)}
                            title="Supprimer ce propriétaire"
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* 4. PAGINATION */}
        <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex items-center justify-between sm:px-6">
          <div className="text-sm text-slate-500">
            Affichage de <span className="font-medium text-slate-700">{filteredOwners.length}</span> sur <span className="font-medium text-slate-700">{owners.length}</span> propriétaire(s) &bull; Page <span className="font-medium text-slate-700">{page}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50"
              disabled={page <= 1 || loading}
              onClick={() => handleFilterChange('page', String(page - 1))}
            >
              <i className="fas fa-chevron-left mr-1"></i> Précédent
            </button>
            <button
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50"
              disabled={isLastPage || loading}
              onClick={() => handleFilterChange('page', String(page + 1))}
            >
              Suivant <i className="fas fa-chevron-right ml-1"></i>
            </button>
          </div>
        </div>
      </div>

      {/* 5. MODALE CRÉATION / ÉDITION PROPRIÉTAIRE + ATTRIBUTION MULTI-BIENS */}
      {showModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowModal(false)}
          title={editingOwner ? 'Modifier le propriétaire & son parc de biens' : 'Nouveau propriétaire'}
          subtitle="Identité, préférences de reversement et attribution multi-biens"
          icon="fa-user-tie"
          maxWidth="700px"
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            {formError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm font-medium flex items-center gap-2">
                <i className="fas fa-exclamation-circle shrink-0"></i>
                <span>{formError}</span>
              </div>
            )}

            {/* 1. Identité & Coordonnées */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Prénom</label>
                  <input
                    type="text"
                    placeholder="Ex : Jean-Marc"
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Nom de famille <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex : Kouassi"
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Téléphone</label>
                  <input
                    type="tel"
                    placeholder="Ex : +225 07 00 00 00 00"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Email</label>
                  <input
                    type="email"
                    placeholder="Ex : proprietaire@email.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* 2. Modalités & Préférences de Reversement */}
            <div className="bg-slate-50/90 p-4 sm:p-5 rounded-2xl border border-slate-200/90 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2.5">
                <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <i className="fas fa-money-check-dollar text-xs"></i>
                </div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Modalités &amp; Préférences de Paiement du Propriétaire
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Moyen de paiement souhaité</label>
                  <select
                    value={form.preferred_payment_method}
                    onChange={(e) => setForm({ ...form, preferred_payment_method: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer"
                  >
                    <option value="bank_transfer">Virement bancaire</option>
                    <option value="mobile_money">Mobile Money (Wave / OM / MTN)</option>
                    <option value="cheque">Chèque bancaire</option>
                    <option value="cash">Espèces (Caisse agence)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Méthode de règlement</label>
                  <select
                    value={form.payout_schedule}
                    onChange={(e) => setForm({ ...form, payout_schedule: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer"
                  >
                    <option value="monthly_full">Mensuel intégral (100%)</option>
                    <option value="installment">Paiement échelonné (Par tranches)</option>
                    <option value="quarterly">Trimestriel</option>
                    <option value="on_demand">À la demande</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Période / Date souhaitée</label>
                  <select
                    value={form.preferred_payout_day}
                    onChange={(e) => setForm({ ...form, preferred_payout_day: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer"
                  >
                    <option value="5">Le 5 du mois</option>
                    <option value="10">Le 10 du mois</option>
                    <option value="15">Le 15 du mois</option>
                    <option value="25">Le 25 du mois</option>
                    <option value="fin_de_mois">Fin de mois (le 30)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Commission Agence (%)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={form.commission_rate}
                      onChange={(e) => setForm({ ...form, commission_rate: e.target.value })}
                      className="w-full pl-3.5 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Banque / Opérateur Mobile</label>
                  <input
                    type="text"
                    placeholder="Ex : SGBCI, NSIA, Wave, Orange..."
                    value={form.bank_name}
                    onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">N° Compte / RIB / Mobile</label>
                  <input
                    type="text"
                    placeholder="Ex : CI008 01111... ou 07 00 00 00"
                    value={form.bank_account}
                    onChange={(e) => setForm({ ...form, bank_account: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            </div>

            {/* 3. Attribution Multi-Biens Immobiliers & État d'occupation */}
            <div className="bg-indigo-50/40 p-4 sm:p-5 rounded-2xl border border-indigo-200/80 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                    <i className="fas fa-building text-xs"></i>
                  </div>
                  <label className="text-xs font-bold uppercase tracking-wider text-indigo-950">
                    Attribuer un ou plusieurs biens à ce propriétaire
                  </label>
                </div>
                <span className="shrink-0 whitespace-nowrap px-3 py-1 bg-indigo-600 text-white rounded-full text-xs font-bold shadow-xs">
                  {form.property_ids.length} sélectionné{form.property_ids.length > 1 ? 's' : ''}
                </span>
              </div>

              <p className="text-xs text-slate-500">
                Cochez tous les biens immobiliers appartenant à ce propriétaire (avec statut d'occupation actuel) :
              </p>

              <div className="custom-scrollbar max-h-52 overflow-y-auto border border-slate-200 rounded-xl bg-white divide-y divide-slate-100 shadow-2xs">
                {allProperties.length === 0 ? (
                  <div className="p-4 text-xs text-slate-400 text-center">Aucun bien disponible dans la base.</div>
                ) : (
                  allProperties.map(prop => {
                    const isChecked = form.property_ids.includes(Number(prop.id));
                    const otherOwner = prop.owner_id && (!editingOwner || Number(prop.owner_id) !== Number(editingOwner.id));
                    const propStatusCfg = PROPERTY_STATUS_CONFIG[prop.status] || {
                      label: prop.status || 'Inconnu',
                      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
                      dotClass: 'bg-slate-400'
                    };

                    return (
                      <label
                        key={prop.id}
                        className={`flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs cursor-pointer transition-colors ${
                          isChecked ? 'bg-indigo-50/90 text-indigo-950' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => togglePropertySelection(prop.id)}
                            className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4 shrink-0 cursor-pointer"
                          />
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 truncate">{prop.name}</div>
                            {prop.address && (
                              <div className="text-[11px] text-slate-500 truncate">{prop.address}</div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {/* Badge Statut d'occupation */}
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${propStatusCfg.badgeClass}`}>
                            <span className={`w-1 h-1 rounded-full ${propStatusCfg.dotClass}`}></span>
                            {propStatusCfg.label}
                          </span>
                          <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-2 py-0.5 rounded-md whitespace-nowrap">
                            {formatXOF(prop.rent || 0)}
                          </span>
                          {otherOwner && !isChecked ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md whitespace-nowrap">
                              Déjà attribué
                            </span>
                          ) : isChecked ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-md whitespace-nowrap">
                              Sélectionné
                            </span>
                          ) : null}
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {/* 4. Adresse postale & Notes */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Adresse postale &amp; Observations
              </label>
              <input
                type="text"
                placeholder="Adresse de résidence ou note particulière sur ce propriétaire..."
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>

            {/* 5. Boutons d'action */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
                onClick={() => setShowModal(false)}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 text-sm font-bold text-white bg-primary rounded-xl hover:bg-primary-dark transition-colors shadow-sm shadow-primary/20 flex items-center justify-center gap-2 min-w-[160px]"
                disabled={formSubmitting}
              >
                {formSubmitting ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    <span>Enregistrement...</span>
                  </>
                ) : (
                  <>
                    <i className={`fas ${editingOwner ? 'fa-save' : 'fa-check-circle'}`}></i>
                    <span>{editingOwner ? 'Enregistrer les modifications' : 'Créer le propriétaire'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 6. MODALE DE PAIEMENT / PRÉFINANCEMENT PROPRIÉTAIRE */}
      {payoutModalOpen && (
        <OwnerPayoutModal
          isOpen={payoutModalOpen}
          onClose={() => setPayoutModalOpen(false)}
          preselectedOwner={selectedOwnerForPayout}
          ownersSummary={ownersSummary.length > 0 ? ownersSummary : owners}
          onSuccess={() => {
            showToast({ type: 'success', message: 'Paiement propriétaire enregistré avec succès.' });
            loadOwnersSummary();
            queryClient.invalidateQueries({ queryKey: ['owners'] });
          }}
        />
      )}
    </div>
  );
}
