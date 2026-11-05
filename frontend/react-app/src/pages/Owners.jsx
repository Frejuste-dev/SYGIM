import React, { useState } from 'react';
import { useOwners, useOwnerStats, useCreateOwner, useUpdateOwner, useDeleteOwner } from '../hooks/queries/useOwners';
import { useProperties } from '../hooks/queries/useProperties';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '../components/ToastContext';
import { useConfirm } from '../components/ConfirmContext';
import AppHeader from '../components/AppHeader';
import StatsCard from '../components/StatsCard';
import FilterBar from '../components/FilterBar';
import Modal from '../components/Modal';

const EMPTY_FORM = () => ({
  first_name: '', last_name: '', phone: '', email: '', address: '',
  id_number: '', bank_name: '', bank_account: '', notes: ''
});

export default function Owners() {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchTerm = searchParams.get('search') || '';
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

  const { data: queryResult = {}, isLoading: loading } = useOwners({ page, limit, search: searchTerm });
  const owners = Array.isArray(queryResult) ? queryResult : (queryResult?.data || []);
  const pagination = queryResult?.pagination || {};
  const isLastPage = pagination.hasNextPage === false;

  const [showModal, setShowModal] = useState(false);
  const [editingOwner, setEditingOwner] = useState(null);
  const [formError, setFormError] = useState('');
  
  const createOwner = useCreateOwner();
  const updateOwner = useUpdateOwner();
  const deleteOwner = useDeleteOwner();
  const formSubmitting = createOwner.isPending || updateOwner.isPending;
  const [form, setForm] = useState(EMPTY_FORM());

  const filteredOwners = owners; // Filter is done on backend ideally, or we can keep frontend filtering here if backend doesn't support 'search' yet.

  const { data: statsData = {} } = useOwnerStats({ search: searchTerm });

  const stats = [
    { label: 'Total', value: statsData.totalOwners || 0, icon: 'fa-user-tie', color: 'var(--warning)' },
    { label: 'Biens associés', value: statsData.totalProperties || 0, icon: 'fa-building', color: 'var(--primary)' },
    { label: 'Actifs', value: statsData.activeOwners || 0, icon: 'fa-check-circle', color: 'var(--success)' }
  ];

  const hasActiveFilters = Boolean(searchTerm);
  const ownerEmptyMessage = hasActiveFilters
    ? 'Aucun propriétaire ne correspond à cette recherche.'
    : 'Aucun propriétaire enregistré. Ajoutez le premier propriétaire.';

  const openCreateModal = () => {
    setEditingOwner(null);
    setForm(EMPTY_FORM());
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (owner) => {
    setEditingOwner(owner);
    setForm({
      first_name: owner.first_name || '',
      last_name: owner.last_name || '',
      phone: owner.phone || '',
      email: owner.email || '',
      address: owner.address || '',
      id_number: owner.id_number || '',
      bank_name: owner.bank_name || '',
      bank_account: owner.bank_account || '',
      notes: owner.notes || ''
    });
    setFormError('');
    setShowModal(true);
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
      } else {
        await createOwner.mutateAsync(form);
      }
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

  return (
    <div className="space-y-6">
      {/* 1. L'EN-TÊTE (Header) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Propriétaires</h2>
          <p className="text-sm text-slate-500">Gérez les propriétaires et leurs biens associés</p>
        </div>
        <button className="bg-primary text-white rounded-lg px-4 py-2 hover:bg-primary-dark transition-colors font-medium text-sm shadow-sm flex items-center gap-2" onClick={openCreateModal}>
          <i className="fas fa-plus"></i> Ajouter un propriétaire
        </button>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
        {stats.map((s, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col hover:shadow-md transition-all">
             <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{s.label}</div>
             <div className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">{s.value}</div>
          </div>
        ))}
      </div>

      {/* 2. BARRE D'OUTILS ET FILTRES */}
      <div className="flex items-center mb-6">
        <div className="relative w-full max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <i className="fas fa-search text-slate-400"></i>
          </div>
          <input 
            type="text" 
            placeholder="Rechercher par nom, téléphone, email..." 
            value={searchTerm}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-sm transition-all" 
          />
        </div>
      </div>

      {/* 3. LE TABLEAU DES PROPRIÉTAIRES */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                <th className="py-3 px-6 font-semibold">Identité</th>
                <th className="py-3 px-6 font-semibold">Contact</th>
                <th className="py-3 px-6 font-semibold">Commission</th>
                <th className="py-3 px-6 font-semibold">Biens associés</th>
                <th className="py-3 px-6 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOwners.length > 0 ? filteredOwners.map(o => {
                return (
                  <tr key={o.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">
                          {((o.first_name || '')[0] + (o.last_name || '')[0]).toUpperCase() || '?'}
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">{o.first_name} {o.last_name}</div>
                          <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                             <span className={`w-1.5 h-1.5 rounded-full ${o.active !== false ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                             {o.active !== false ? 'Actif' : 'Inactif'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-sm text-slate-900">{o.phone || '-'}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{o.email || '-'}</div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded text-xs font-medium">
                        {o.commissionRate || 10}%
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-sm text-slate-900 font-medium">{o.propertiesCount || 0}</div>
                      <div className="text-xs text-slate-500 mt-0.5">biens</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-end gap-3 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-primary hover:border-primary hover:bg-primary/5 border border-transparent hover:border-primary/20 transition-all bg-white" onClick={() => openEditModal(o)} title="Modifier">
                          <i className="fas fa-pencil-alt text-sm"></i>
                        </button>
                        <button className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all bg-white" onClick={() => handleDelete(o)} title="Supprimer">
                          <i className="fas fa-trash text-sm"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <i className="fas fa-user-tie text-4xl text-slate-300 mb-3"></i>
                      <p>{ownerEmptyMessage}</p>
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
        <Modal title={editingOwner ? 'Modifier le propriétaire' : 'Nouveau propriétaire'} onClose={() => setShowModal(false)} maxWidth="600px">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">{editingOwner ? 'Modifier le propriétaire' : 'Nouveau propriétaire'}</h2>
          </div>
          {formError && <div className="bg-rose-50 text-rose-700 p-3 rounded-lg text-sm mb-6 flex items-center gap-2"><i className="fas fa-exclamation-circle"></i>{formError}</div>}
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="first_name" className="block text-sm font-medium text-slate-700 mb-1.5">Prénom</label>
                  <input id="first_name" type="text" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 shadow-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
                </div>
                <div>
                  <label htmlFor="last_name" className="block text-sm font-medium text-slate-700 mb-1.5">Nom <span className="text-rose-600">*</span></label>
                  <input id="last_name" type="text" required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 shadow-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1.5">Téléphone</label>
                  <input id="phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 shadow-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                  <input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 shadow-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
                </div>
              </div>

              <div>
                <label htmlFor="address" className="block text-sm font-medium text-slate-700 mb-1.5">Adresse</label>
                <textarea id="address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 shadow-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all min-h-[80px]"></textarea>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="bank_name" className="block text-sm font-medium text-slate-700 mb-1.5">Banque</label>
                  <input id="bank_name" type="text" value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 shadow-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
                </div>
                <div>
                  <label htmlFor="bank_account" className="block text-sm font-medium text-slate-700 mb-1.5">Compte bancaire</label>
                  <input id="bank_account" type="text" value={form.bank_account} onChange={(e) => setForm({ ...form, bank_account: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 shadow-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
                </div>
              </div>

              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
                <textarea id="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 shadow-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all min-h-[80px]"></textarea>
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3 border-t border-slate-100 pt-6">
              <button type="button" className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors" onClick={() => setShowModal(false)}>
                Annuler
              </button>
              <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark transition-colors flex items-center justify-center min-w-[120px]" disabled={formSubmitting}>
                {formSubmitting ? <><i className="fas fa-spinner fa-spin mr-2"></i> Chargement...</> : (editingOwner ? 'Enregistrer' : 'Créer')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
