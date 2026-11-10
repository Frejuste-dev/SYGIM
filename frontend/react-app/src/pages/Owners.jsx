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

  const { data: propertiesResult = {} } = useProperties({ limit: 200 });
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
    { label: 'Total Propriétaires', value: statsData.totalOwners || owners.length || 0, icon: 'fa-user-tie', color: 'var(--warning)' },
    { label: 'Biens Associés', value: statsData.totalProperties || 0, icon: 'fa-building', color: 'var(--primary)' },
    { label: 'Propriétaires Actifs', value: statsData.activeOwners || owners.length || 0, icon: 'fa-check-circle', color: 'var(--success)' }
  ];

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

  // Préparation des données pour Export Excel / PDF
  const getExportData = () => owners.map(o => {
    const props = Array.isArray(o.properties) && o.properties.length > 0
      ? o.properties
      : allProperties.filter(p => Number(p.owner_id) === Number(o.id));
    return {
      full_name: `${o.first_name || ''} ${o.last_name || ''}`.trim(),
      phone: o.phone || '—',
      email: o.email || '—',
      properties_count: props.length,
      properties_list: props.map(p => p.name).join(', ') || 'Aucun bien',
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
    properties_count: 'Nb Biens',
    properties_list: 'Biens attribués',
    total_rent: 'Loyers mensuels (XOF)',
    payment_method: 'Moyen de paiement',
    payout_schedule: 'Méthode de versement',
    payout_day: 'Date souhaitée',
    bank_info: 'Coordonnées bancaires'
  };

  const handleExportExcel = () => {
    const data = getExportData();
    if (!data.length) return showToast({ type: 'warning', message: 'Aucun propriétaire à exporter.' });
    exportToExcel(data, 'sygim-proprietaires', EXPORT_COLUMNS, 'Liste des Propriétaires & Patrimoine');
  };

  const handleExportPDF = () => {
    const data = getExportData();
    if (!data.length) return showToast({ type: 'warning', message: 'Aucun propriétaire à exporter.' });
    exportToPDF(data, 'sygim-proprietaires', EXPORT_COLUMNS, {
      title: 'Liste Officielle des Propriétaires & Biens Attribués',
      subtitle: 'Gestion du Patrimoine & Modalités de Reversement',
      summary: [
        { label: 'Total Propriétaires', value: data.length },
        { label: 'Biens sous gestion', value: data.reduce((s, d) => s + d.properties_count, 0) },
        { label: 'Total Loyers Mensuels', value: formatXOF(data.reduce((s, d) => s + d.total_rent, 0)) }
      ]
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. EN-TÊTE */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Propriétaires & Reversements</h2>
          <p className="text-sm text-slate-500">Gérez les propriétaires, attribuez plusieurs biens et configurez leurs modalités de paiement</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-sm font-semibold hover:bg-emerald-100 transition-colors"
          >
            <i className="fas fa-file-excel"></i> Excel
          </button>
          <button
            type="button"
            onClick={handleExportPDF}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-sm font-semibold hover:bg-rose-100 transition-colors"
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

      {/* 2. CARTES KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((s) => (
          <StatsCard key={s.label} label={s.label} title={s.label} value={s.value} icon={s.icon} color={s.color} />
        ))}
      </div>

      {/* 3. TABLEAU DES PROPRIÉTAIRES */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <FilterBar
            searchPlaceholder="Rechercher par nom, téléphone ou email..."
            searchValue={searchTerm}
            onSearchChange={(val) => handleFilterChange('search', val)}
          />
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-slate-500">
              <i className="fas fa-spinner fa-spin mr-2"></i>Chargement des propriétaires...
            </div>
          ) : owners.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400 text-2xl">
                <i className="fas fa-user-tie"></i>
              </div>
              <p className="text-slate-600 font-medium mb-2">Aucun propriétaire enregistré.</p>
              <button className="mt-4 bg-primary text-white rounded-lg px-4 py-2 hover:bg-primary-dark transition-all text-sm font-medium" onClick={openCreateModal}>
                <i className="fas fa-plus mr-2"></i>Ajouter un propriétaire
              </button>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3.5 px-4 font-semibold">Propriétaire</th>
                  <th className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3.5 px-4 font-semibold">Contact</th>
                  <th className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3.5 px-4 font-semibold">Biens attribués (Multi-biens)</th>
                  <th className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3.5 px-4 font-semibold">Modalités de paiement souhaitées</th>
                  <th className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3.5 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {owners.map((o) => {
                  const ownerProps = Array.isArray(o.properties) && o.properties.length > 0
                    ? o.properties
                    : allProperties.filter(p => Number(p.owner_id) === Number(o.id));
                  const totalPortfolioRent = ownerProps.reduce((sum, p) => sum + Number(p.rent || 0), 0);

                  return (
                    <tr key={o.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-4 text-sm text-slate-900 font-bold">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0 border border-indigo-100">
                            {(o.last_name || o.first_name || 'P').slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <div>{o.first_name} {o.last_name}</div>
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
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary">
                            {ownerProps.length} bien{ownerProps.length > 1 ? 's' : ''}
                          </span>
                          {totalPortfolioRent > 0 && (
                            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                              {formatXOF(totalPortfolioRent)}/mois
                            </span>
                          )}
                        </div>
                        {ownerProps.length > 0 ? (
                          <div className="flex flex-wrap gap-1 mt-1 max-w-xs">
                            {ownerProps.map(p => (
                              <span key={p.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-medium">
                                <i className="fas fa-home text-[9px] text-slate-400"></i>
                                {p.name}
                              </span>
                            ))}
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
                            className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                            title="Enregistrer un paiement ou préfinancement pour ce propriétaire"
                          >
                            <i className="fas fa-hand-holding-dollar"></i> Payer
                          </button>
                          <button
                            type="button"
                            className="p-1.5 text-slate-400 hover:text-primary transition-colors rounded-lg hover:bg-slate-100"
                            onClick={() => openEditModal(o)}
                            title="Modifier & Attribuer des biens"
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                          <button
                            type="button"
                            className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors rounded-lg hover:bg-rose-50"
                            onClick={() => handleDelete(o)}
                            title="Supprimer"
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
            Affichage de <span className="font-medium text-slate-700">{owners.length}</span> propriétaire(s) — Page <span className="font-medium text-slate-700">{page}</span>
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

      {/* 5. MODALE CRÉATION / ÉDITION PROPRIÉTAIRE + ATTRIBUTION MULTI-BIENS + PRÉFÉRENCES PAIEMENT */}
      {showModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowModal(false)}
          title={editingOwner ? 'Modifier le propriétaire & ses biens' : 'Nouveau propriétaire'}
        >
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 max-h-[72vh] overflow-y-auto pr-1">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-lg text-sm font-medium">
                  <i className="fas fa-exclamation-circle mr-2"></i>{formError}
                </div>
              )}

              {/* Identité */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Prénom</label>
                  <input
                    type="text"
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nom <span className="text-rose-600">*</span></label>
                  <input
                    type="text"
                    required
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Téléphone</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Modalités & Préférences de Paiement du Propriétaire */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                  <i className="fas fa-money-check-dollar"></i>
                  Modalités & Préférences de Paiement du Propriétaire
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Moyen de paiement souhaité</label>
                    <select
                      value={form.preferred_payment_method}
                      onChange={(e) => setForm({ ...form, preferred_payment_method: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900"
                    >
                      <option value="bank_transfer">Virement bancaire</option>
                      <option value="mobile_money">Mobile Money (Wave/OM)</option>
                      <option value="cheque">Chèque bancaire</option>
                      <option value="cash">Espèces</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Méthode de règlement</label>
                    <select
                      value={form.payout_schedule}
                      onChange={(e) => setForm({ ...form, payout_schedule: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900"
                    >
                      <option value="monthly_full">Mensuel intégral</option>
                      <option value="installment">Paiement échelonné (Tranches)</option>
                      <option value="quarterly">Trimestriel</option>
                      <option value="on_demand">À la demande</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Période / Date souhaitée</label>
                    <select
                      value={form.preferred_payout_day}
                      onChange={(e) => setForm({ ...form, preferred_payout_day: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900"
                    >
                      <option value="5">Le 5 du mois</option>
                      <option value="10">Le 10 du mois</option>
                      <option value="15">Le 15 du mois</option>
                      <option value="25">Le 25 du mois</option>
                      <option value="fin_de_mois">Fin de mois (le 30)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Banque / Opérateur</label>
                    <input
                      type="text"
                      placeholder="Ex: SGBCI, NSIA, Wave..."
                      value={form.bank_name}
                      onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">N° Compte / RIB / Mobile</label>
                    <input
                      type="text"
                      placeholder="Ex: CI008 01111..."
                      value={form.bank_account}
                      onChange={(e) => setForm({ ...form, bank_account: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Commission Agence (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={form.commission_rate}
                      onChange={(e) => setForm({ ...form, commission_rate: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Attribution Multi-Biens Immobiliers */}
              <div className="bg-indigo-50/40 p-4 rounded-xl border border-indigo-200/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-indigo-900 flex items-center gap-2">
                    <i className="fas fa-building text-indigo-600"></i>
                    Attribuer un ou plusieurs biens à ce propriétaire
                  </label>
                  <span className="px-2 py-0.5 bg-indigo-600 text-white rounded-full text-xs font-bold">
                    {form.property_ids.length} sélectionné(s)
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Cochez tous les biens immobiliers appartenant à ce propriétaire :
                </p>

                <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-lg bg-white divide-y divide-slate-100">
                  {allProperties.length === 0 ? (
                    <div className="p-3 text-xs text-slate-400 text-center">Aucun bien disponible dans la base.</div>
                  ) : (
                    allProperties.map(prop => {
                      const isChecked = form.property_ids.includes(Number(prop.id));
                      const otherOwner = prop.owner_id && (!editingOwner || Number(prop.owner_id) !== Number(editingOwner.id));
                      return (
                        <label
                          key={prop.id}
                          className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer transition-colors ${
                            isChecked ? 'bg-indigo-50/80 font-semibold text-indigo-950' : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => togglePropertySelection(prop.id)}
                              className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4"
                            />
                            <div className="truncate">
                              <span className="font-semibold">{prop.name}</span>
                              <span className="text-slate-400 ml-1.5">({prop.address})</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <span className="font-bold text-emerald-700">{formatXOF(prop.rent || 0)}</span>
                            {otherOwner && !isChecked && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded">Déjà attribué</span>
                            )}
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Adresse postale & Notes</label>
                <input
                  type="text"
                  placeholder="Adresse ou observations particulières..."
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                onClick={() => setShowModal(false)}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary-dark transition-colors flex items-center justify-center min-w-[130px]"
                disabled={formSubmitting}
              >
                {formSubmitting ? <><i className="fas fa-spinner fa-spin mr-2"></i> Enregistrement...</> : (editingOwner ? 'Enregistrer' : 'Créer le propriétaire')}
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
