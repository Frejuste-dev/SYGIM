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

const TYPE_ICONS = { appartement: 'fa-building', maison: 'fa-home', terrain: 'fa-map', commercial: 'fa-store' };

const EMPTY_FORM = () => ({
  name: '', address: '', type: 'appartement', status: 'vacant',
  value: '', rent: '', area: '', rooms: '', description: '', owner_id: ''
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
      owner_id: property.owner_id ?? ''
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
        owner_id: form.owner_id ? parseInt(form.owner_id) : null
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

  return (
    <div className="space-y-6 min-w-0 overflow-x-hidden">
      {/* 1. L'EN-TÊTE (Header) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Gestion des Biens</h2>
          <p className="text-sm text-slate-500">Administrer les biens et leur statut</p>
        </div>
        <button className="bg-primary text-white rounded-lg px-4 py-2 hover:bg-primary-dark transition-colors font-medium text-sm shadow-sm flex items-center gap-2" onClick={openCreateModal}>
          <i className="fas fa-plus"></i> Nouveau bien
        </button>
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
                <th className="py-3 px-6 font-semibold">Adresse</th>
                <th className="py-3 px-6 font-semibold">Statut</th>
                <th className="py-3 px-6 font-semibold">Valeur</th>
                <th className="py-3 px-6 font-semibold">Loyer</th>
                <th className="py-3 px-6 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProperties.length > 0 ? filteredProperties.map(p => {
                const pStatus = formatStatus(p.status);

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
                  <td colSpan="7" className="py-12 text-center text-slate-500">
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
        <Modal title={editingProperty ? 'Modifier le bien' : 'Nouveau bien immobilier'} onClose={() => setShowModal(false)} maxWidth="600px">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">{editingProperty ? 'Modifier le bien' : 'Nouveau bien immobilier'}</h2>
          </div>
          {formError && <div className="bg-rose-50 text-rose-700 p-3 rounded-lg text-sm mb-6 flex items-center gap-2"><i className="fas fa-exclamation-circle"></i>{formError}</div>}
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1.5">Nom <span className="text-rose-600">*</span></label>
                  <input id="name" type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 shadow-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
                </div>
                <div>
                  <label htmlFor="type" className="block text-sm font-medium text-slate-700 mb-1.5">Type</label>
                  <select id="type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 shadow-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all">
                    <option value="appartement">Appartement</option>
                    <option value="maison">Maison</option>
                    <option value="terrain">Terrain</option>
                    <option value="commercial">Commercial</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="address" className="block text-sm font-medium text-slate-700 mb-1.5">Adresse <span className="text-rose-600">*</span></label>
                <textarea id="address" required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 shadow-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all min-h-[80px]"></textarea>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="value" className="block text-sm font-medium text-slate-700 mb-1.5">Valeur (F CFA)</label>
                  <input id="value" type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 shadow-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
                </div>
                <div>
                  <label htmlFor="rent" className="block text-sm font-medium text-slate-700 mb-1.5">Loyer mensuel (F CFA)</label>
                  <input id="rent" type="number" value={form.rent} onChange={(e) => setForm({ ...form, rent: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 shadow-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="area" className="block text-sm font-medium text-slate-700 mb-1.5">Surface (m²)</label>
                  <input id="area" type="number" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 shadow-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
                </div>
                <div>
                  <label htmlFor="rooms" className="block text-sm font-medium text-slate-700 mb-1.5">Pièces</label>
                  <input id="rooms" type="number" value={form.rooms} onChange={(e) => setForm({ ...form, rooms: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 shadow-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="status" className="block text-sm font-medium text-slate-700 mb-1.5">Statut</label>
                  <select id="status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 shadow-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all">
                    <option value="vacant">Vacant</option>
                    <option value="loue">Loué</option>
                    <option value="en_renovation">En rénovation</option>
                    <option value="vendu">Vendu</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="owner_id" className="block text-sm font-medium text-slate-700 mb-1.5">Propriétaire</label>
                  <select id="owner_id" value={form.owner_id} onChange={(e) => setForm({ ...form, owner_id: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 shadow-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer">
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
                <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
                <textarea id="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 shadow-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all min-h-[80px]"></textarea>
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3 border-t border-slate-100 pt-6">
              <button type="button" className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors" onClick={() => setShowModal(false)}>
                Annuler
              </button>
              <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark transition-colors flex items-center justify-center min-w-[120px]" disabled={formSubmitting}>
                {formSubmitting ? <><i className="fas fa-spinner fa-spin mr-2"></i> Chargement...</> : (editingProperty ? 'Enregistrer' : 'Créer')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
