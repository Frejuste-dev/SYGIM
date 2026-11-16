import React, { useState, useEffect } from 'react';
import { useProperties, usePropertyStats, useCreateProperty, useUpdateProperty, useDeleteProperty } from '../hooks/queries/useProperties';
import { useOwners } from '../hooks/queries/useOwners';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useDebounce } from '../hooks/useDebounce';
import { useToast } from '../components/ToastContext';
import { useConfirm } from '../components/ConfirmContext';
import StatsCard from '../components/StatsCard';
import Modal from '../components/Modal';
import TableSkeleton from '../components/ui/TableSkeleton';
import { FormField, MoneyInput, FormSection } from '../components/ui/forms';
import { formatXOF, formatStatus } from '../utils/formatters';
import { exportToExcel, exportToPDF } from '../utils/exportUtils';

const TYPE_ICONS = { appartement: 'fa-building', maison: 'fa-home', terrain: 'fa-map', commercial: 'fa-store' };

const EMPTY_FORM = () => ({
  name: '', reference_code: '', zone: '', address: '', type: 'appartement', status: 'vacant',
  floor_level: '', unit_type: '',
  value: '', rent: '', area: '', rooms: '', description: '', owner_id: '',
  commission_type: 'percentage', commission_rate: 10, commission_fixed_amount: ''
});

export default function Properties() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSearch = searchParams.get('search') || '';
  const [searchTerm, setSearchTerm] = useState(urlSearch);
  const debouncedSearch = useDebounce(searchTerm, 350);

  const typeFilter = searchParams.get('type') || '';
  const statusFilter = searchParams.get('status') || '';
  const assignmentFilter = searchParams.get('assignmentStatus') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = 25;

  const { showToast } = useToast();
  const { confirm } = useConfirm();

  useEffect(() => {
    const currentParam = searchParams.get('search') || '';
    if (debouncedSearch !== currentParam) {
      const newParams = new URLSearchParams(searchParams);
      if (debouncedSearch) {
        newParams.set('search', debouncedSearch);
      } else {
        newParams.delete('search');
      }
      newParams.delete('page');
      setSearchParams(newParams, { replace: true });
    }
  }, [debouncedSearch]);

  useEffect(() => {
    if (urlSearch !== searchTerm) {
      setSearchTerm(urlSearch);
    }
  }, [urlSearch]);

  const handleFilterChange = (key, value) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    if (key !== 'page') newParams.delete('page');
    setSearchParams(newParams, { replace: true });
  };

  const { data: queryResult = {}, isLoading: loading } = useProperties({
    page,
    limit,
    search: debouncedSearch,
    type: typeFilter,
    status: statusFilter,
    assignmentStatus: assignmentFilter
  });
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

  const { data: statsData = {} } = usePropertyStats({
    search: debouncedSearch,
    type: typeFilter,
    status: statusFilter,
    assignmentStatus: assignmentFilter
  });

  const stats = [
    { label: 'Total biens', value: statsData.total || 0, icon: 'fa-building', color: 'var(--primary)' },
    { label: 'En location (Loués)', value: statsData.loue || 0, icon: 'fa-key', color: 'var(--success)' },
    { label: 'Biens vacants', value: statsData.vacant || 0, icon: 'fa-door-open', color: 'var(--danger)' },
    { label: 'En rénovation', value: statsData.en_renovation || 0, icon: 'fa-tools', color: 'var(--warning)' }
  ];

  const hasActiveFilters = Boolean(searchTerm || typeFilter || statusFilter || assignmentFilter);
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
      reference_code: property.reference_code || '',
      zone: property.zone || '',
      address: property.address || '',
      type: property.type || 'appartement',
      floor_level: property.floor_level || '',
      unit_type: property.unit_type || '',
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
    if (!form.owner_id) {
      setFormError('Le propriétaire bailleur est obligatoire pour enregistrer un bien.');
      return;
    }
    setFormError('');

    try {
      const payload = {
        ...form,
        reference_code: form.reference_code?.trim() || undefined,
        zone: form.zone?.trim() || null,
        floor_level: form.floor_level?.trim() || null,
        unit_type: form.unit_type?.trim() || null,
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
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Gestion des Biens</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Administrer le parc immobilier, les propriétaires et l'état d'occupation</p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0 flex-nowrap">
          {/* Groupe d'exportation segmenté compact */}
          <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50/80 p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={handleExportPropertiesExcel}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold text-slate-700 hover:text-emerald-700 hover:bg-white transition-colors cursor-pointer"
              title="Exporter la liste des biens en Excel"
            >
              <i className="fas fa-file-excel text-emerald-600"></i>
              <span className="hidden sm:inline">Excel</span>
            </button>
            <div className="h-4 w-px bg-slate-200"></div>
            <button
              type="button"
              onClick={handleExportPropertiesPDF}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold text-slate-700 hover:text-rose-700 hover:bg-white transition-colors cursor-pointer"
              title="Exporter la liste des biens en PDF"
            >
              <i className="fas fa-file-pdf text-rose-600"></i>
              <span className="hidden sm:inline">PDF</span>
            </button>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="h-9 px-3.5 bg-primary hover:bg-primary-dark text-white rounded-lg text-xs font-bold transition-all shadow-2xs inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <i className="fas fa-plus text-xs"></i>
            <span>Nouveau bien</span>
          </button>
        </div>
      </div>

      {/* 2. CARDS DE STATISTIQUES (KPIs) */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((s) => (
          <StatsCard key={s.label} label={s.label} title={s.label} value={s.value} icon={s.icon} color={s.color} />
        ))}
      </div>

      {/* 3. FILTRES */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between mb-6">
        <div className="relative flex-1">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
          <input 
            type="text" 
            placeholder="Rechercher par nom, réf, adresse..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-slate-700 transition-all" 
          />
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <select 
            value={typeFilter} 
            onChange={(e) => handleFilterChange('type', e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer shadow-2xs"
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
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer shadow-2xs"
          >
            <option value="">Tous les statuts</option>
            <option value="vacant">Vacant</option>
            <option value="loue">Loué</option>
            <option value="en_renovation">En rénovation</option>
            <option value="vendu">Vendu</option>
          </select>
          <select 
            value={assignmentFilter} 
            onChange={(e) => handleFilterChange('assignmentStatus', e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer shadow-2xs"
          >
            <option value="">Toutes attributions</option>
            <option value="assigned">Attribués (avec propriétaire)</option>
            <option value="unassigned">Non attribués</option>
          </select>
        </div>
      </div>

      {/* 4. TABLEAU DES PROPRIÉTÉS */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                <th className="py-3.5 px-4 font-semibold whitespace-nowrap">Bien</th>
                <th className="py-3.5 px-4 font-semibold whitespace-nowrap">Type</th>
                <th className="py-3.5 px-4 font-semibold whitespace-nowrap">Propriétaire</th>
                <th className="py-3.5 px-4 font-semibold whitespace-nowrap">Zone &amp; Adresse</th>
                <th className="py-3.5 px-4 font-semibold whitespace-nowrap">Attribution Locataire</th>
                <th className="py-3.5 px-4 font-semibold text-right whitespace-nowrap">Valeur</th>
                <th className="py-3.5 px-4 font-semibold text-right whitespace-nowrap">Loyer</th>
                <th className="py-3.5 px-4 font-semibold text-center whitespace-nowrap">Commission</th>
                <th className="py-3.5 px-4 font-semibold text-right whitespace-nowrap min-w-[120px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <TableSkeleton rows={5} columns={9} />
              ) : filteredProperties.length > 0 ? filteredProperties.map(p => {
                const ownerObj = owners.find(o => Number(o.id) === Number(p.owner_id));
                const ownerName = ownerObj
                  ? (`${ownerObj.first_name || ''} ${ownerObj.last_name || ''}`.trim() || ownerObj.display_name)
                  : (p.owner_name || null);
                const isVacant = p.status === 'vacant' || (!p.tenant_name && !p.tenant_first_name && p.status !== 'loue');

                return (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-slate-900">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                          <i className={`fas ${TYPE_ICONS[p.type] || 'fa-building'} text-xs`}></i>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-900 truncate max-w-[180px]" title={p.name}>{p.name}</span>
                            {p.reference_code && (
                              <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                                {p.reference_code}
                              </span>
                            )}
                          </div>
                          {p.rooms ? <span className="text-[11px] text-slate-400 block">{p.rooms} pièces {p.area ? `• ${p.area} m²` : ''}</span> : null}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 capitalize whitespace-nowrap">
                      {p.type}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {p.owner_id ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 font-medium text-xs border border-emerald-200/80 max-w-[140px] truncate" title={ownerName}>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                          <span className="truncate">{ownerName || `Propriétaire #${p.owner_id}`}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 font-medium text-xs border border-amber-200/80">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                          Non attribué
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 max-w-[190px]">
                      {p.zone && (
                        <div className="text-[11px] font-semibold text-primary mb-0.5 flex items-center gap-1">
                          <i className="fas fa-location-dot text-[9px]"></i>
                          <span className="truncate">{p.zone}</span>
                        </div>
                      )}
                      <div className="truncate text-slate-500 text-xs" title={p.address}>{p.address || '—'}</div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {!isVacant ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold text-xs border border-emerald-200/80 max-w-[160px] truncate" title={`Locataire : ${p.tenant_name || `${p.tenant_last_name || ''} ${p.tenant_first_name || ''}`.trim()}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                          <span className="truncate">
                            Loué ({p.tenant_name || `${p.tenant_last_name || ''} ${p.tenant_first_name || ''}`.trim() || 'Actif'})
                          </span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-semibold text-xs border border-amber-200/80">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                          Vacant
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-semibold text-slate-700 text-right tabular-nums whitespace-nowrap">
                      {formatXOF(p.value, { compact: false })}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-bold text-slate-900 text-right tabular-nums whitespace-nowrap">
                      {formatXOF(p.rent, { compact: false })}
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-200/80">
                        <i className={p.commission_type === 'fixed' ? "fas fa-tag text-[9px]" : "fas fa-percent text-[9px]"}></i>
                        {p.commission_type === 'fixed'
                          ? `${formatXOF(p.commission_fixed_amount || 0)} fixe`
                          : `${p.commission_rate ?? 10}%`}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {isVacant && (
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/property-assignments?propertyId=${p.id}`)}
                            className="h-8 px-2 bg-primary/10 hover:bg-primary hover:text-white text-primary rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 shadow-2xs cursor-pointer"
                            title="Attribuer ce bien à un locataire"
                          >
                            <i className="fas fa-key text-[10px]"></i>
                            <span>Attribuer</span>
                          </button>
                        )}
                        <button
                          type="button"
                          className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-slate-500 hover:text-primary hover:bg-primary/10 border border-slate-200 bg-white transition-colors cursor-pointer"
                          onClick={() => openEditModal(p)}
                          title="Modifier ce bien"
                        >
                          <i className="fas fa-pencil-alt text-xs"></i>
                        </button>
                        <button
                          type="button"
                          className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 bg-white transition-colors cursor-pointer"
                          onClick={() => handleDelete(p)}
                          title="Supprimer ce bien"
                        >
                          <i className="fas fa-trash text-xs"></i>
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
          maxWidth="720px"
        >
          {formError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3.5 rounded-xl text-sm mb-5 flex items-center gap-2 font-medium">
              <i className="fas fa-exclamation-circle shrink-0"></i>
              <span>{formError}</span>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Section 1 : Identité & Typologie */}
            <FormSection
              icon="fa-tag"
              title="1. Identité & Typologie"
              subtitle="Désignation, code unique et statut d'occupation du bien"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Nom / Désignation du bien" required id="name">
                  <input
                    id="name"
                    type="text"
                    required
                    placeholder="Ex : Villa Cocody Ambassades"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </FormField>

                <FormField label="Type de bien" id="type">
                  <select
                    id="type"
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                  >
                    <option value="appartement">Appartement</option>
                    <option value="maison">Maison / Villa</option>
                    <option value="terrain">Terrain</option>
                    <option value="commercial">Local Commercial / Bureau</option>
                  </select>
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Code Référence (Unique)" optional id="reference_code" hint="Auto-généré si vide (ex: BIEN-001)">
                  <input
                    id="reference_code"
                    type="text"
                    placeholder="Ex : BIEN-042"
                    value={form.reference_code}
                    onChange={(e) => setForm({ ...form, reference_code: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </FormField>

                <FormField label="Statut d'occupation" id="status">
                  <select
                    id="status"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                  >
                    <option value="vacant">Vacant (Disponible à la location)</option>
                    <option value="loue">Loué (Occupé par un locataire)</option>
                    <option value="en_renovation">En rénovation / Travaux</option>
                    <option value="vendu">Vendu</option>
                  </select>
                </FormField>
              </div>
            </FormSection>

            {/* Section 2 : Localisation & Niveaux */}
            <FormSection
              icon="fa-location-dot"
              title="2. Localisation & Niveaux"
              subtitle="Adresse, zone, situation officielle par étage et caractéristiques physiques"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Zone géographique" optional id="zone" hint="Commune ou quartier d'Abidjan">
                  <input
                    id="zone"
                    type="text"
                    placeholder="Ex : Cocody Riviera, Marcory Zone 4"
                    value={form.zone}
                    onChange={(e) => setForm({ ...form, zone: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </FormField>

                <FormField label="Adresse géographique" required id="address">
                  <input
                    id="address"
                    type="text"
                    required
                    placeholder="Ex : Rue des Jardins, Lot 42"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Étage / Niveau (Situation officielle)" optional id="floor_level" hint="Pour les tableaux de synthèse propriétaires">
                  <input
                    id="floor_level"
                    type="text"
                    placeholder="Ex : 3ème ETAGE, 2ème ETAGE, RDC"
                    value={form.floor_level}
                    onChange={(e) => setForm({ ...form, floor_level: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all uppercase"
                  />
                </FormField>

                <FormField label="Type d'unité / logement" optional id="unit_type" hint="Ex : STUDIO 1 BALCON, APPARTEMENT 3P">
                  <input
                    id="unit_type"
                    type="text"
                    placeholder="Ex : STUDIO 1 BALCON, MAGASIN, 4 PIECES"
                    value={form.unit_type}
                    onChange={(e) => setForm({ ...form, unit_type: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all uppercase"
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Surface (m²)" optional id="area">
                  <input
                    id="area"
                    type="number"
                    min="0"
                    placeholder="Ex : 120"
                    value={form.area}
                    onChange={(e) => setForm({ ...form, area: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </FormField>

                <FormField label="Nombre de pièces" optional id="rooms">
                  <input
                    id="rooms"
                    type="number"
                    min="1"
                    placeholder="Ex : 4"
                    value={form.rooms}
                    onChange={(e) => setForm({ ...form, rooms: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </FormField>
              </div>
            </FormSection>

            {/* Section 3 : Conditions Financières & Propriétaire */}
            <FormSection
              icon="fa-coins"
              title="3. Conditions Financières & Propriétaire"
              subtitle="Rattachement bailleur, loyer mensuel, valeur et paramètres de commission"
            >
              <FormField label="Propriétaire bailleur" required id="owner_id">
                <select
                  id="owner_id"
                  required
                  value={form.owner_id}
                  onChange={(e) => setForm({ ...form, owner_id: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                >
                  <option value="">-- Sélectionner un propriétaire obligatoire --</option>
                  {owners.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.display_name || `${o.first_name || ''} ${o.last_name || ''}`.trim() || `Propriétaire #${o.id}`} {o.phone ? `(${o.phone})` : ''}
                    </option>
                  ))}
                </select>
              </FormField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Loyer mensuel" id="rent" hint="Loyer facial hors charges">
                  <MoneyInput
                    id="rent"
                    value={form.rent}
                    onChange={(e, num) => setForm({ ...form, rent: (num ?? Number(e?.target?.value)) || 0 })}
                    placeholder="Ex : 250 000"
                    currency="FCFA"
                  />
                </FormField>

                <FormField label="Valeur vénale estimée" optional id="value" hint="Valorisation du patrimoine">
                  <MoneyInput
                    id="value"
                    value={form.value}
                    onChange={(e, num) => setForm({ ...form, value: (num ?? Number(e?.target?.value)) || 0 })}
                    placeholder="Ex : 45 000 000"
                    currency="FCFA"
                  />
                </FormField>
              </div>

              {/* Commission agence avec bascule pourcentage / montant fixe */}
              <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Commission Agence sur ce bien
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Pourcentage (%) ou honoraire fixe prélevé par mandat
                    </span>
                  </div>
                  <div className="inline-flex p-1 bg-slate-100 rounded-xl shrink-0">
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
                      <span>Montant Fixe</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  {form.commission_type === 'percentage' ? (
                    <FormField label="Taux de commission (%)" id="commission_rate">
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
                    </FormField>
                  ) : (
                    <FormField label="Montant fixe de commission" id="commission_fixed_amount">
                      <MoneyInput
                        id="commission_fixed_amount"
                        value={form.commission_fixed_amount}
                        onChange={(e, num) => setForm({ ...form, commission_fixed_amount: (num ?? Number(e?.target?.value)) || 0 })}
                        placeholder="Ex : 25 000"
                        currency="FCFA"
                      />
                    </FormField>
                  )}

                  {/* Simulation en direct */}
                  <div className="p-2.5 bg-slate-50 border border-slate-200/90 rounded-xl text-xs space-y-1">
                    <div className="font-bold text-slate-700 flex items-center gap-1.5">
                      <i className="fas fa-calculator text-primary"></i> Simulation mensuelle :
                    </div>
                    {parseFloat(form.rent) > 0 ? (
                      (() => {
                        const r = parseFloat(form.rent);
                        const comm = form.commission_type === 'fixed'
                          ? Math.min(r, parseFloat(form.commission_fixed_amount || 0))
                          : Math.round((r * parseFloat(form.commission_rate || 0)) / 100);
                        const net = Math.max(0, r - comm);
                        return (
                          <div>
                            <div className="text-slate-700">Honoraires agence : <strong className="text-emerald-700 font-extrabold">{formatXOF(comm)}</strong></div>
                            <div className="text-slate-500 text-[11px]">Net propriétaire : <strong className="text-primary font-bold">{formatXOF(net)}</strong></div>
                          </div>
                        );
                      })()
                    ) : (
                      <span className="text-slate-400 italic text-[11px]">Indiquez un loyer pour calculer la commission.</span>
                    )}
                  </div>
                </div>
              </div>

              <FormField label="Description & Équipements" optional id="description">
                <textarea
                  id="description"
                  rows="2"
                  placeholder="Détails complémentaires, commodités, compteur CIE/SODECI..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                ></textarea>
              </FormField>
            </FormSection>

            {/* Footer boutons actions */}
            <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
              <button
                type="button"
                className="px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => setShowModal(false)}
                disabled={formSubmitting}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 text-sm font-bold text-white bg-primary rounded-xl hover:bg-primary-dark transition-colors shadow-sm shadow-primary/20 flex items-center justify-center gap-2 min-w-[140px] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
                    <span>{editingProperty ? 'Enregistrer les modifications' : 'Créer le bien'}</span>
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
