import React, { useState } from 'react';
import { useProperties, usePropertyStats, useCreateProperty, useUpdateProperty, useDeleteProperty } from '../hooks/queries/useProperties';
import { useOwners } from '../hooks/queries/useOwners';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '../components/ToastContext';
import { useConfirm } from '../components/ConfirmContext';
import AppHeader from '../components/AppHeader';
import StatsCard from '../components/StatsCard';
import FilterBar from '../components/FilterBar';
import Modal from '../components/Modal';
import { formatXOF, formatStatus } from '../utils/formatters';
import { exportToExcel, exportToPDF } from '../utils/exportUtils';

const TYPE_ICONS = { appartement: 'fa-building', maison: 'fa-home', terrain: 'fa-map', commercial: 'fa-store' };

const EMPTY_FORM = () => ({
  name: '', address: '', type: 'appartement', status: 'vacant',
  value: '', rent: '', area: '', rooms: '', description: '', owner_id: '',
  commission_type: 'percentage', commission_rate: 10, commission_fixed_amount: ''
});

export default function Properties() {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchTerm = searchParams.get('search') || '';
  const typeFilter = searchParams.get('type') || '';
  const statusFilter = searchParams.get('status') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = 25;

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

  const { data: queryResult = {}, isLoading: loading } = useProperties({ page, limit, search: searchTerm, type: typeFilter, status: statusFilter });
  const properties = Array.isArray(queryResult) ? queryResult : (queryResult?.data || []);
  const pagination = queryResult?.pagination || {};
  const isLastPage = pagination.hasNextPage === false;
  
  const { data: ownersData = {} } = useOwners({ limit: 100 });
  const owners = Array.isArray(ownersData) ? ownersData : (ownersData?.data || []);

  const [showModal, setShowModal] = useState(false);
  const [editingProperty, setEditingProperty] = useState(null);
  const [formError, setFormError] = useState('');
  
  const createProperty = useCreateProperty();
  const updateProperty = useUpdateProperty();
  const deleteProperty = useDeleteProperty();
  const formSubmitting = createProperty.isPending || updateProperty.isPending;
  const [form, setForm] = useState(EMPTY_FORM());

  const filteredProperties = properties; // Backend is filtering


  const { data: statsData = {} } = usePropertyStats({ search: searchTerm, type: typeFilter, status: statusFilter });

  const stats = [
    { label: 'Total', value: statsData.total || 0, icon: 'fa-hotel', color: 'var(--primary)' },
    { label: 'Loués', value: statsData.loue || 0, icon: 'fa-check-circle', color: 'var(--success)' },
    { label: 'Vacants', value: statsData.vacant || 0, icon: 'fa-exclamation-circle', color: 'var(--danger)' },
    { label: 'En rénovation', value: statsData.en_renovation || 0, icon: 'fa-tools', color: 'var(--warning)' }
  ];

  const hasActiveFilters = Boolean(searchTerm || typeFilter || statusFilter);
  const propertyEmptyMessage = hasActiveFilters
    ? 'Aucun bien ne correspond aux filtres.'
    : 'Aucun bien enregistré. Ajoutez le premier bien du portefeuille.';

  const openCreateModal = () => {
    setEditingProperty(null);
    setForm(EMPTY_FORM());
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (property) => {
    setEditingProperty(property);
    setForm({
      name: property.name || '',
      address: property.address || '',
      type: property.type || 'appartement',
      status: property.status || 'vacant',
      value: property.value ?? '',
      rent: property.rent ?? '',
      area: property.area ?? '',
      rooms: property.rooms ?? '',
      description: property.description || '',
      owner_id: property.owner_id ?? '',
      commission_type: property.commission_type || 'percentage',
      commission_rate: property.commission_rate ?? 10,
      commission_fixed_amount: property.commission_fixed_amount ?? ''
    });
    setFormError('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.address) {
      setFormError('Le nom et l\'adresse sont obligatoires.');
      return;
    }
    setFormError('');

    try {
      const payload = {
        ...form,
        value: form.value ? parseFloat(form.value) : 0,
        rent: form.rent ? parseFloat(form.rent) : 0,
        area: form.area ? parseFloat(form.area) : null,
        rooms: form.rooms ? parseInt(form.rooms) : null,
        owner_id: form.owner_id ? parseInt(form.owner_id) : null,
        commission_type: form.commission_type || 'percentage',
        commission_rate: form.commission_type === 'percentage' ? (form.commission_rate !== '' ? parseFloat(form.commission_rate) : 10) : 0,
        commission_fixed_amount: form.commission_type === 'fixed' ? (form.commission_fixed_amount !== '' ? parseFloat(form.commission_fixed_amount) : 0) : 0
      };

      if (editingProperty) {
        await updateProperty.mutateAsync({ id: editingProperty.id, ...payload });
      } else {
        await createProperty.mutateAsync(payload);
      }
      setShowModal(false);
    } catch (err) {
      setFormError(err.message || 'Erreur serveur.');
    }
  };

  const handleDelete = async (property) => {
    const isConfirmed = await confirm(`Voulez-vous vraiment supprimer le bien "${property.name}" ?`);
    if (!isConfirmed) return;
    try {
      await deleteProperty.mutateAsync(property.id);
      showToast({ type: 'success', message: 'Bien supprimé avec succès.' });
    } catch (err) {
      showToast({ type: 'error', message: 'Erreur lors de la suppression: ' + err.message });
    }
  };

  const handleExportPropertiesExcel = () => {
    const today = new Date().toISOString().slice(0, 10);
    const rows = filteredProperties.map(p => {
      const ownerObj = owners.find(o => Number(o.id) === Number(p.owner_id));
      const ownerName = ownerObj ? (ownerObj.display_name || `${ownerObj.first_name || ''} ${ownerObj.last_name || ''}`.trim()) : (p.owner_name || 'Non attribué');
      return {
        name: p.name || '-',
        type: p.type || '-',
        address: p.address || '-',
        owner: ownerName,
        status: formatStatus(p.status)?.label || p.status || '-',
        rent: `${Number(p.rent || 0).toLocaleString('fr-FR')} FCFA`,
        commission: p.commission_type === 'fixed'
          ? `${Number(p.commission_fixed_amount || 0).toLocaleString('fr-FR')} FCFA (Fixe)`
          : `${p.commission_rate ?? 10}%`,
        value: `${Number(p.value || 0).toLocaleString('fr-FR')} FCFA`
      };
    });
    const cols = {
      name: 'Bien Immobilier',
      type: 'Type',
      address: 'Adresse',
      owner: 'Propriétaire',
      status: 'Statut',
      rent: 'Loyer Mensuel',
      commission: 'Commission Agence',
      value: 'Valeur Estimée'
    };
    exportToExcel(rows, `proprietes_biens_${today}.xls`, cols, ' Inventaire du Parc Immobilier — SYGIM');
  };

  const handleExportPropertiesPDF = () => {
    const today = new Date().toISOString().slice(0, 10);
    const rows = filteredProperties.map(p => {
      const ownerObj = owners.find(o => Number(o.id) === Number(p.owner_id));
      const ownerName = ownerObj ? (ownerObj.display_name || `${ownerObj.first_name || ''} ${ownerObj.last_name || ''}`.trim()) : (p.owner_name || 'Non attribué');
      return {
        name: p.name || '-',
        type: p.type || '-',
        address: p.address || '-',
        owner: ownerName,
        status: formatStatus(p.status)?.label || p.status || '-',
        rent: `${Number(p.rent || 0).toLocaleString('fr-FR')} FCFA`,
        commission: p.commission_type === 'fixed'
          ? `${Number(p.commission_fixed_amount || 0).toLocaleString('fr-FR')} FCFA (Fixe)`
          : `${p.commission_rate ?? 10}%`,
        value: `${Number(p.value || 0).toLocaleString('fr-FR')} FCFA`
      };
    });
    const cols = {
      name: 'Bien Immobilier',
      type: 'Type',
      address: 'Adresse',
      owner: 'Propriétaire',
      status: 'Statut',
      rent: 'Loyer Mensuel',
      commission: 'Commission Agence',
      value: 'Valeur Estimée'
    };
    exportToPDF(rows, `proprietes_biens_${today}.pdf`, cols, {
      title: 'Inventaire Officiel des Propriétés & Biens Immobiliers',
      subtitle: 'Portefeuille immobilier géré par SYGIM',
      summaryItems: [
        { label: 'Total Biens', value: String(statsData.total || filteredProperties.length) },
        { label: 'Biens Loués', value: String(statsData.loue || 0) },
        { label: 'Biens Vacants', value: String(statsData.vacant || 0) }
      ]
    });
  };

  return (
    <div className="space-y-6 min-w-0 overflow-x-hidden">
      {/* 1. L'EN-TÊTE (Header) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Gestion des Biens</h2>
          <p className="text-sm text-slate-500">Administrer les biens, leurs propriétaires et leur statut</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={handleExportPropertiesExcel} className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors">
            <i className="fas fa-file-excel"></i> Excel
          </button>
          <button onClick={handleExportPropertiesPDF} className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors">
            <i className="fas fa-file-pdf"></i> PDF
          </button>
          <button className="bg-primary text-white rounded-lg px-4 py-2 hover:bg-primary-dark transition-colors font-medium text-sm shadow-sm flex items-center gap-2" onClick={openCreateModal}>
            <i className="fas fa-plus"></i> Nouveau bien
          </button>
        </div>
      </div>

      {/* 3. CARDS DE STATISTIQUES (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {stats.map((s, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col justify-between hover:shadow-md transition-all">
             <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{s.label}</div>
             <div className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">{s.value}</div>
          </div>
        ))}
      </div>

      {/* FILTRES */}
      <div className="flex flex-col md:flex-row items-center gap-4 mb-6">
        <div className="relative w-full md:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <i className="fas fa-search text-slate-400"></i>
          </div>
          <input 
            type="text" 
            placeholder="Rechercher par nom, adresse..." 
            value={searchTerm}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-sm transition-all" 
          />
        </div>
        <select 
          value={typeFilter} 
          onChange={(e) => handleFilterChange('type', e.target.value)}
          className="w-full md:w-48 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none text-sm focus:ring-2 focus:ring-primary/20 transition-all text-slate-700"
        >
          <option value="">Tous les types</option>
          <option value="appartement">Appartement</option>
          <option value="maison">Maison</option>
          <option value="terrain">Terrain</option>
          <option value="commercial">Commercial</option>
        </select>
        <select 
          value={statusFilter} 
          onChange={(e) => handleFilterChange('status', e.target.value)}
          className="w-full md:w-48 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none text-sm focus:ring-2 focus:ring-primary/20 transition-all text-slate-700"
        >
          <option value="">Tous les statuts</option>
          <option value="vacant">Vacant</option>
          <option value="loue">Loué</option>
          <option value="en_renovation">En rénovation</option>
          <option value="vendu">Vendu</option>
        </select>
      </div>

      {/* 4. TABLEAU DES PROPRIÉTÉS */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                <th className="py-3 px-6 font-semibold">Bien</th>
                <th className="py-3 px-6 font-semibold">Type</th>
                <th className="py-3 px-6 font-semibold">Propriétaire</th>
                <th className="py-3 px-6 font-semibold">Adresse</th>
                <th className="py-3 px-6 font-semibold">Statut</th>
                <th className="py-3 px-6 font-semibold">Valeur</th>
                <th className="py-3 px-6 font-semibold">Loyer</th>
                <th className="py-3 px-6 font-semibold">Commission</th>
                <th className="py-3 px-6 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProperties.length > 0 ? filteredProperties.map(p => {
                const pStatus = formatStatus(p.status);
                const ownerObj = owners.find(o => Number(o.id) === Number(p.owner_id));
                const ownerName = ownerObj
                  ? (`${ownerObj.first_name || ''} ${ownerObj.last_name || ''}`.trim() || ownerObj.display_name)
                  : (p.owner_name || null);

                return (
                  <tr key={p.id} className="group hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-6 font-medium text-slate-900">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <i className={`fas ${TYPE_ICONS[p.type] || 'fa-building'}`}></i>
                        </div>
                        {p.name}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm text-slate-600 capitalize">{p.type}</td>
                    <td className="py-4 px-6 text-sm">
                      {ownerName ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-medium text-xs border border-indigo-100">
                          <i className="fas fa-user-tie text-[10px]"></i>
                          {ownerName}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Non attribué</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-sm text-slate-600 max-w-[200px] truncate" title={p.address}>{p.address}</td>
                    <td className="py-4 px-6">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${pStatus.twClass}`}>
                        {pStatus.label}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-sm font-medium text-slate-900">
                      {formatXOF(p.value, { compact: false })}
                    </td>
                    <td className="py-4 px-6 text-sm font-medium text-slate-900">
                      {formatXOF(p.rent, { compact: false })}
                    </td>
                    <td className="py-4 px-6 text-sm">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-semibold text-xs border border-emerald-200">
                        <i className={p.commission_type === 'fixed' ? "fas fa-tag text-[10px]" : "fas fa-percent text-[10px]"}></i>
                        {p.commission_type === 'fixed'
                          ? `${formatXOF(p.commission_fixed_amount || 0)} fixe`
                          : `${p.commission_rate ?? 10}%`}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-end gap-3 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-primary hover:border-primary hover:bg-primary/5 border border-transparent hover:border-primary/20 transition-all bg-white" onClick={() => openEditModal(p)} title="Modifier">
                          <i className="fas fa-pencil-alt text-sm"></i>
                        </button>
                        <button className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all bg-white" onClick={() => handleDelete(p)} title="Supprimer">
                          <i className="fas fa-trash text-sm"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <i className="fas fa-building text-4xl text-slate-300 mb-3"></i>
                      <p>{propertyEmptyMessage}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* PAGINATION */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button 
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" 
            disabled={page <= 1} 
            onClick={() => handleFilterChange('page', String(page - 1))}
          >
            Précédent
          </button>
          <span className="text-sm text-slate-500">
            Page <span className="font-medium text-slate-900">{page}</span> {pagination.totalPages ? `/ ${pagination.totalPages}` : ''}
          </span>
          <button 
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" 
            disabled={isLastPage} 
            onClick={() => handleFilterChange('page', String(page + 1))}
          >
            Suivant
          </button>
        </div>
      </div>

      {showModal && (
        <Modal
          title={editingProperty ? 'Modifier le bien immobilier' : 'Nouveau bien immobilier'}
          subtitle="Caractéristiques, valorisation locative et rattachement au propriétaire"
          icon="fa-building"
          onClose={() => setShowModal(false)}
          maxWidth="680px"
        >
          {formError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3.5 rounded-xl text-sm mb-5 flex items-center gap-2 font-medium">
              <i className="fas fa-exclamation-circle shrink-0"></i>
              <span>{formError}</span>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 1. Identification & Localisation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Nom / Désignation du bien <span className="text-rose-600">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  placeholder="Ex : Villa Cocody Ambassades"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
              <div>
                <label htmlFor="type" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Type de bien
                </label>
                <select
                  id="type"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                >
                  <option value="appartement">Appartement</option>
                  <option value="maison">Maison / Villa</option>
                  <option value="terrain">Terrain</option>
                  <option value="commercial">Local Commercial / Bureau</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="address" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Adresse géographique <span className="text-rose-600">*</span>
              </label>
              <input
                id="address"
                type="text"
                required
                placeholder="Ex : Cocody Riviera 3, Rue des Jardins, Lot 42"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>

            {/* 2. Données Financières & Techniques */}
            <div className="bg-slate-50/90 p-4 rounded-2xl border border-slate-200/90 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <i className="fas fa-coins text-xs"></i>
                </div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Valorisation & Caractéristiques Physiques
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="rent" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Loyer mensuel (F CFA)
                  </label>
                  <input
                    id="rent"
                    type="number"
                    placeholder="Ex : 250000"
                    value={form.rent}
                    onChange={(e) => setForm({ ...form, rent: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-emerald-700 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="value" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Valeur estimée du bien (F CFA)
                  </label>
                  <input
                    id="value"
                    type="number"
                    placeholder="Ex : 45000000"
                    value={form.value}
                    onChange={(e) => setForm({ ...form, value: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="area" className="block text-xs font-semibold text-slate-700 mb-1.5">Surface (m²)</label>
                  <input
                    id="area"
                    type="number"
                    placeholder="Ex : 120"
                    value={form.area}
                    onChange={(e) => setForm({ ...form, area: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="rooms" className="block text-xs font-semibold text-slate-700 mb-1.5">Nombre de pièces</label>
                  <input
                    id="rooms"
                    type="number"
                    placeholder="Ex : 4"
                    value={form.rooms}
                    onChange={(e) => setForm({ ...form, rooms: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* 3. Paramètres de Commission Agence sur ce Bien */}
            <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <i className="fas fa-hand-holding-dollar text-primary"></i>
                    Commission Agence sur ce bien
                  </label>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Indiquez le pourcentage (%) ou le montant fixe (FCFA) gagné par l'agence sur ce bien.
                  </p>
                </div>
                <div className="inline-flex p-1 bg-white border border-slate-200 rounded-xl shrink-0">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, commission_type: 'percentage' })}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                      form.commission_type === 'percentage'
                        ? 'bg-primary text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <i className="fas fa-percent text-[10px]"></i>
                    <span>Pourcentage (%)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, commission_type: 'fixed' })}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                      form.commission_type === 'fixed'
                        ? 'bg-primary text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <i className="fas fa-money-bill-wave text-[10px]"></i>
                    <span>Prix Fixe (FCFA)</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center pt-1">
                {form.commission_type === 'percentage' ? (
                  <div>
                    <label htmlFor="commission_rate" className="block text-xs font-semibold text-slate-700 mb-1">
                      Taux de commission (%)
                    </label>
                    <div className="relative">
                      <input
                        id="commission_rate"
                        type="number"
                        step="0.5"
                        min="0"
                        max="100"
                        placeholder="Ex : 10"
                        value={form.commission_rate}
                        onChange={(e) => setForm({ ...form, commission_rate: e.target.value })}
                        className="w-full pl-3.5 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label htmlFor="commission_fixed_amount" className="block text-xs font-semibold text-slate-700 mb-1">
                      Montant fixe de commission (FCFA)
                    </label>
                    <div className="relative">
                      <input
                        id="commission_fixed_amount"
                        type="number"
                        step="500"
                        min="0"
                        placeholder="Ex : 25 000"
                        value={form.commission_fixed_amount}
                        onChange={(e) => setForm({ ...form, commission_fixed_amount: e.target.value })}
                        className="w-full pl-3.5 pr-14 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">FCFA</span>
                    </div>
                  </div>
                )}

                {/* Estimation en direct selon le loyer saisi */}
                <div className="p-3 bg-white border border-slate-200 rounded-xl text-xs">
                  <div className="font-semibold text-slate-700 flex items-center gap-1.5 mb-1">
                    <i className="fas fa-calculator text-primary"></i> Simulation sur loyer :
                  </div>
                  {parseFloat(form.rent) > 0 ? (
                    (() => {
                      const r = parseFloat(form.rent);
                      const comm = form.commission_type === 'fixed'
                        ? Math.min(r, parseFloat(form.commission_fixed_amount || 0))
                        : Math.round((r * parseFloat(form.commission_rate || 0)) / 100);
                      const net = Math.max(0, r - comm);
                      return (
                        <div className="space-y-0.5">
                          <div className="text-slate-800">
                            Commission agence : <strong className="text-emerald-700 font-extrabold">{formatXOF(comm)}</strong>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Net propriétaire : <strong className="text-primary font-bold">{formatXOF(net)}</strong>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <span className="text-slate-400 italic">Saisissez un loyer mensuel ci-dessus pour visualiser le gain agence.</span>
                  )}
                </div>
              </div>
            </div>

            {/* 4. Statut & Propriétaire */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="status" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Statut d'occupation
                </label>
                <select
                  id="status"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                >
                  <option value="vacant">Vacant (Disponible)</option>
                  <option value="loue">Loué (Occupé)</option>
                  <option value="en_renovation">En rénovation</option>
                  <option value="vendu">Vendu</option>
                </select>
              </div>
              <div>
                <label htmlFor="owner_id" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Propriétaire rattaché
                </label>
                <select
                  id="owner_id"
                  value={form.owner_id}
                  onChange={(e) => setForm({ ...form, owner_id: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                >
                  <option value="">-- Aucun propriétaire --</option>
                  {owners.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.display_name || `${o.first_name || ''} ${o.last_name || ''}`.trim() || `Propriétaire #${o.id}`} {o.phone ? `(${o.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="description" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Description & Équipements
              </label>
              <textarea
                id="description"
                rows="2"
                placeholder="Détails complémentaires sur le bien..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              ></textarea>
            </div>

            <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
              <button
                type="button"
                className="px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
                onClick={() => setShowModal(false)}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 text-sm font-bold text-white bg-primary rounded-xl hover:bg-primary-dark transition-colors shadow-sm shadow-primary/20 flex items-center justify-center gap-2 min-w-[140px]"
                disabled={formSubmitting}
              >
                {formSubmitting ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    <span>Enregistrement...</span>
                  </>
                ) : (
                  <>
                    <i className={`fas ${editingProperty ? 'fa-save' : 'fa-check-circle'}`}></i>
                    <span>{editingProperty ? 'Enregistrer' : 'Créer le bien'}</span>
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
