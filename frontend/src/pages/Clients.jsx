import React, { useState, useEffect } from 'react';
import { useClients, useClientStats, useCreateClient, useUpdateClient, useDeleteClient } from '../hooks/queries/useClients';
import { useProperties } from '../hooks/queries/useProperties';
import { useCollectors } from '../hooks/queries/useCollectors';
import { useSearchParams } from 'react-router-dom';
import { useDebounce } from '../hooks/useDebounce';
import { useToast } from '../components/ToastContext';
import { useConfirm } from '../components/ConfirmContext';
import StatsCard from '../components/StatsCard';
import Modal from '../components/Modal';
import TenantStatementModal from '../components/TenantStatementModal';
import TableSkeleton from '../components/ui/TableSkeleton';
import { FormField, MoneyInput, PhoneInput, FormSection } from '../components/ui/forms';
import { formatXOF, formatStatus } from '../utils/formatters';
import { exportToExcel, exportToPDF } from '../utils/exportUtils';
import ImportPortfolioModal from '../components/import/ImportPortfolioModal';

const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'paid', label: 'Payé' },
  { value: 'partial', label: 'Partiel' },
  { value: 'late', label: 'En retard' },
  { value: 'pending', label: 'En attente' },
  { value: 'inactive', label: 'Inactif' },
];



const COLUMNS = [
  { key: 'name', label: 'Locataire' },
  { key: 'phone', label: 'Téléphone' },
  { key: 'property', label: 'Bien' },
  { key: 'rent', label: 'Loyer (XOF)' },
  { key: 'paid', label: 'Payé (XOF)' },
  { key: 'status', label: 'Statut' },
  { key: 'actions', label: 'Actions' },
];

export default function Clients() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSearch = searchParams.get('search') || '';
  const [searchTerm, setSearchTerm] = useState(urlSearch);
  const debouncedSearch = useDebounce(searchTerm, 350);

  const statusFilter = searchParams.get('status') || '';
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

  const { data: queryResult = {}, isLoading: loading, error: listError } = useClients({ page, limit, search: debouncedSearch, status: statusFilter });
  const clients = Array.isArray(queryResult) ? queryResult : (queryResult?.data || []);
  const pagination = queryResult?.pagination || {};
  const isLastPage = pagination.hasNextPage === false;

  const { data: propertiesResult = {} } = useProperties({ limit: 100 });
  const properties = Array.isArray(propertiesResult) ? propertiesResult : (propertiesResult?.data || []);

  const { data: collectorsResult = {} } = useCollectors({ limit: 100 });
  const collectors = Array.isArray(collectorsResult) ? collectorsResult : (collectorsResult?.data || []);

  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [selectedClientForStatement, setSelectedClientForStatement] = useState(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', email: '', propertyId: '', propertyName: '', amountDue: '', collectorId: '' });
  const [formError, setFormError] = useState('');

  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();
  const formSubmitting = createClient.isPending || updateClient.isPending;

  // Data fetched automatically by useClients

  const { data: stats = {} } = useClientStats({ search: debouncedSearch, status: statusFilter });
  
  const totalOwed = (stats.totalDue || 0) - (stats.totalPaid || 0);
  const paidCount = (stats.totalClients || 0) - (stats.overdueCount || 0);
  const overdueCount = stats.overdueCount || 0;
  const hasActiveFilters = Boolean(searchTerm || statusFilter);
  const clientsEmptyMessage = loading
    ? 'Chargement des locataires...'
    : (listError?.message || (typeof listError === 'string' ? listError : '')) || (hasActiveFilters
      ? 'Aucun locataire ne correspond aux filtres actuels.'
      : 'Aucun locataire enregistré. Ajoutez votre premier locataire.');

  const openCreateModal = () => {
    setEditingClient(null);
    setForm({ firstName: '', lastName: '', phone: '', email: '', propertyId: '', propertyName: '', amountDue: '', collectorId: '' });
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (client) => {
    setEditingClient(client);
    setForm({
      firstName: client.first_name || '',
      lastName: client.last_name || '',
      phone: client.phone || '',
      email: client.email || '',
      propertyId: client.property_id ? String(client.property_id) : '',
      propertyName: client.property_name || '',
      amountDue: client.amount_due ? String(client.amount_due) : '',
      collectorId: client.collector_id ? String(client.collector_id) : '',
    });
    setFormError('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.lastName || !form.phone) {
      setFormError('Le nom de famille et le numéro de téléphone sont obligatoires.');
      return;
    }
    const cleanPhone = String(form.phone).replace(/\D/g, '');
    const actualDigits = cleanPhone.startsWith('225') ? cleanPhone.slice(3) : cleanPhone;
    if (actualDigits.length < 10) {
      setFormError('Le numéro de téléphone ivoirien doit comporter exactement 10 chiffres (ex: 07 09 88 14 42).');
      return;
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setFormError('Veuillez saisir une adresse email valide.');
      return;
    }
    setFormError('');
    
    try {
      const payload = {
        ...form,
        propertyId: form.propertyId ? parseInt(form.propertyId, 10) : null,
        property_id: form.propertyId ? parseInt(form.propertyId, 10) : null,
        collectorId: form.collectorId ? parseInt(form.collectorId, 10) : null,
        collector_id: form.collectorId ? parseInt(form.collectorId, 10) : null,
        amountDue: parseFloat(form.amountDue) || 0
      };
      if (editingClient) {
        await updateClient.mutateAsync({ id: editingClient.id, ...payload });
        showToast({ type: 'success', message: 'Locataire mis à jour avec succès.' });
      } else {
        await createClient.mutateAsync(payload);
        showToast({ type: 'success', message: 'Nouveau locataire enregistré avec succès.' });
      }
      setShowModal(false);
    } catch (err) {
      const msg = err.message || 'Erreur serveur.';
      setFormError(msg);
    }
  };

  const handleDelete = async (client) => {
    const isConfirmed = await confirm(`Supprimer le locataire ${client.first_name || ''} ${client.last_name || ''} ?`);
    if (!isConfirmed) return;
    try {
      await deleteClient.mutateAsync(client.id);
      showToast({ type: 'success', message: 'Locataire supprimé avec succès.' });
    } catch (err) {
      showToast({ type: 'error', message: 'Erreur: ' + err.message });
    }
  };

  const inputStyle = {
    width: '100%', padding: '10px', borderRadius: '8px',
    border: '1px solid var(--border)', fontSize: '14px',
    background: 'var(--bg)', color: 'inherit', boxSizing: 'border-box'
  };

  const handleExportClientsExcel = () => {
    const today = new Date().toISOString().slice(0, 10);
    const rows = clients.map(c => ({
      name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || '-',
      phone: c.phone || '-',
      email: c.email || '-',
      property: c.property_name || 'Aucun bien assigné',
      rent: `${Number(c.amount_due || 0).toLocaleString('fr-FR')} FCFA`,
      paid: `${Number(c.amount_paid || 0).toLocaleString('fr-FR')} FCFA`,
      remaining: `${Math.max(0, Number(c.amount_due || 0) - Number(c.amount_paid || 0)).toLocaleString('fr-FR')} FCFA`,
      status: formatStatus(c.status)?.label || c.status || '-'
    }));
    const cols = {
      name: 'Locataire',
      phone: 'Téléphone',
      email: 'Email',
      property: 'Bien Occupé',
      rent: 'Loyer Mensuel',
      paid: 'Montant Payé',
      remaining: 'Reste Dû',
      status: 'Statut'
    };
    exportToExcel(rows, `locataires_${today}.xls`, cols, 'Liste Officielle des Locataires — SYGIM');
  };

  const handleExportClientsPDF = () => {
    const today = new Date().toISOString().slice(0, 10);
    const rows = clients.map(c => ({
      name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || '-',
      phone: c.phone || '-',
      property: c.property_name || 'Non assigné',
      rent: `${Number(c.amount_due || 0).toLocaleString('fr-FR')} FCFA`,
      paid: `${Number(c.amount_paid || 0).toLocaleString('fr-FR')} FCFA`,
      remaining: `${Math.max(0, Number(c.amount_due || 0) - Number(c.amount_paid || 0)).toLocaleString('fr-FR')} FCFA`,
      status: formatStatus(c.status)?.label || c.status || '-'
    }));
    const cols = {
      name: 'Locataire',
      phone: 'Téléphone',
      property: 'Bien Occupé',
      rent: 'Loyer Mensuel',
      paid: 'Payé',
      remaining: 'Reste Dû',
      status: 'Statut'
    };
    exportToPDF(rows, `locataires_${today}.pdf`, cols, {
      title: 'Répertoire des Locataires & Situation Locative',
      subtitle: 'État des loyers, paiements et arriérés locataires',
      summaryItems: [
        { label: 'Total Locataires', value: String(stats.totalClients || clients.length) },
        { label: 'Locataires à jour', value: String(paidCount) },
        { label: 'En retard / Attente', value: String(overdueCount) },
        { label: 'Créance Totale', value: formatXOF(totalOwed, { compact: false }) }
      ]
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. HEADER */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Locataires &amp; Situation Locative</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Suivi des locataires, coordonnées de contact, occupation et statuts des loyers</p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0 flex-nowrap">
          {/* Groupe d'exportation segmenté compact */}
          <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50/80 p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={handleExportClientsExcel}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold text-slate-700 hover:text-emerald-700 hover:bg-white transition-colors cursor-pointer"
              title="Exporter la liste des locataires en Excel"
            >
              <i className="fas fa-file-excel text-emerald-600"></i>
              <span className="hidden sm:inline">Excel</span>
            </button>
            <div className="h-4 w-px bg-slate-200"></div>
            <button
              type="button"
              onClick={handleExportClientsPDF}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold text-slate-700 hover:text-rose-700 hover:bg-white transition-colors cursor-pointer"
              title="Exporter le relevé des locataires en PDF"
            >
              <i className="fas fa-file-pdf text-rose-600"></i>
              <span className="hidden sm:inline">PDF</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="h-9 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            title="Importer des locataires, biens et propriétaires depuis Excel / CSV"
          >
            <i className="fas fa-file-import text-xs"></i>
            <span className="hidden sm:inline">Importer Excel / CSV</span>
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="h-9 px-3.5 bg-primary hover:bg-primary-dark text-white rounded-lg text-xs font-bold transition-all shadow-2xs inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <i className="fas fa-plus text-xs"></i>
            <span>Nouveau locataire</span>
          </button>
        </div>
      </div>

      {/* 2. STATS */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard label="Total locataires" value={stats.totalClients || 0} icon="fa-users" color="var(--primary)" />
        <StatsCard label="À jour (Payé)" value={paidCount} icon="fa-check-circle" color="var(--success)" />
        <StatsCard label="En retard / Attente" value={overdueCount} icon="fa-exclamation-triangle" color="var(--danger)" />
        <StatsCard label="Créance totale" value={formatXOF(totalOwed, { compact: false })} icon="fa-wallet" color="var(--warning)" />
      </div>

      {/* 3. OUTILS ET FILTRES */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between mb-6">
        <div className="relative flex-1">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
          <input 
            type="text" 
            placeholder="Rechercher par nom, téléphone, email, bien..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-slate-700 transition-all" 
          />
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <select 
            value={statusFilter} 
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer shadow-2xs"
          >
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* 4. TABLEAU */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto min-w-0">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                <th className="py-3.5 px-4 font-semibold whitespace-nowrap">Locataire &amp; Bien</th>
                <th className="py-3.5 px-4 font-semibold whitespace-nowrap">Contact</th>
                <th className="py-3.5 px-4 font-semibold text-right whitespace-nowrap">Loyer Mensuel</th>
                <th className="py-3.5 px-4 font-semibold text-center whitespace-nowrap">Statut Paiement</th>
                <th className="py-3.5 px-4 font-semibold text-right whitespace-nowrap min-w-[130px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <TableSkeleton rows={5} columns={5} />
              ) : clients.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-slate-500">
                    <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400 text-xl">
                      <i className="fas fa-users-slash"></i>
                    </div>
                    <p className="text-slate-600 font-medium">{clientsEmptyMessage}</p>
                  </td>
                </tr>
              ) : (
                clients.map(client => {
                  const initials = `${client.first_name?.[0] || ''}${client.last_name?.[0] || ''}`.toUpperCase() || '?';
                  return (
                    <tr key={client.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 truncate max-w-[180px]" title={`${client.first_name || ''} ${client.last_name || ''}`.trim()}>
                              {client.first_name} {client.last_name}
                            </div>
                            <div className="text-xs text-slate-500 truncate max-w-[180px]" title={client.property_name || 'Aucun bien assigné'}>
                              {client.property_name || 'Aucun bien assigné'}
                            </div>
                            {client.collector_name && (
                              <div className="text-[11px] text-blue-600 font-medium flex items-center gap-1 mt-0.5">
                                <i className="fas fa-motorcycle text-[10px]"></i>
                                <span>{client.collector_name}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="text-xs font-medium text-slate-700">{client.phone || '—'}</div>
                        <div className="text-xs text-slate-400 truncate max-w-[160px]" title={client.email}>{client.email || '—'}</div>
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums whitespace-nowrap">
                        <div className="font-bold text-slate-900 text-xs">{formatXOF(client.amount_due, { compact: false })}</div>
                        {client.amount_paid > 0 && (
                          <div className="text-[11px] text-emerald-600 font-medium">
                            {formatXOF(client.amount_paid, { compact: false })} payé
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {(() => {
                          const s = formatStatus(client.status);
                          return (
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${s.twClass}`}>
                              {client.status === 'paid' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>}
                              {client.status === 'partial' && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>}
                              {(client.status === 'late' || client.status === 'overdue') && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>}
                              {s.label || client.status || 'Inconnu'}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedClientForStatement(client)}
                            className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-primary bg-primary/10 hover:bg-primary hover:text-white border border-primary/20 transition-all cursor-pointer shadow-2xs"
                            title="Grand Livre & Relevé Financier"
                          >
                            <i className="fas fa-file-invoice-dollar text-xs"></i>
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(client)}
                            className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-slate-500 hover:text-primary hover:bg-primary/10 border border-slate-200 bg-white transition-colors cursor-pointer"
                            title="Modifier ce locataire"
                          >
                            <i className="fas fa-pen text-xs"></i>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(client)}
                            className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 bg-white transition-colors cursor-pointer"
                            title="Supprimer ce locataire"
                          >
                            <i className="fas fa-trash text-xs"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <div className="text-sm text-slate-500">
            Page <span className="font-medium text-slate-900">{page}</span> sur <span className="font-medium text-slate-900">{pagination.totalPages || 1}</span>
          </div>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => handleFilterChange('page', String(page - 1))} className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              Précédent
            </button>
            <button disabled={isLastPage} onClick={() => handleFilterChange('page', String(page + 1))} className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              Suivant
            </button>
          </div>
        </div>
      </div>

      {showModal && (
        <Modal
          title={editingClient ? 'Modifier le locataire' : 'Nouveau locataire'}
          subtitle="Identité du locataire, coordonnées et rattachement au bien loué"
          icon="fa-user-check"
          onClose={() => setShowModal(false)}
          maxWidth="680px"
        >
          {formError && (
            <div className={`p-4 rounded-xl text-sm font-medium mb-5 flex items-start gap-3 animate-fade-in-up ${
              formError.toLowerCase().includes('doublon') || formError.toLowerCase().includes('existe') || formError.toLowerCase().includes('conflit')
                ? 'bg-amber-50 border border-amber-300 text-amber-900'
                : 'bg-rose-50 border border-rose-200 text-rose-700'
            }`}>
              <i className={`fas ${
                formError.toLowerCase().includes('doublon') || formError.toLowerCase().includes('existe')
                  ? 'fa-exclamation-triangle text-amber-600 mt-0.5'
                  : 'fa-exclamation-circle text-rose-600 mt-0.5'
              } shrink-0`}></i>
              <div className="flex-1">
                <span className="font-bold block">
                  {formError.toLowerCase().includes('doublon') || formError.toLowerCase().includes('existe')
                    ? 'Doublon détecté'
                    : 'Erreur de validation'}
                </span>
                <span className="text-xs">{formError}</span>
              </div>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 1. Identité */}
            <FormSection
              icon="fa-id-card"
              title="1. Identité du Locataire"
              subtitle="Coordonnées personnelles et contact direct"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Prénom" id="firstName">
                  <input
                    id="firstName"
                    type="text"
                    placeholder="Ex : Awa"
                    value={form.firstName}
                    onChange={e => setForm({ ...form, firstName: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </FormField>

                <FormField label="Nom de famille" required id="lastName">
                  <input
                    id="lastName"
                    type="text"
                    required
                    placeholder="Ex : Koné"
                    value={form.lastName}
                    onChange={e => setForm({ ...form, lastName: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  label="Téléphone portable"
                  required
                  id="phone"
                  hint="Numéro à 10 chiffres (Côte d'Ivoire)"
                  error={formError && formError.toLowerCase().includes('téléphone') ? formError : ''}
                >
                  <PhoneInput
                    id="phone"
                    value={form.phone}
                    onChange={(e, clean) => setForm({ ...form, phone: clean ?? e?.target?.value })}
                    hasError={Boolean(formError && formError.toLowerCase().includes('téléphone'))}
                    placeholder="07 09 88 14 42"
                  />
                </FormField>

                <FormField
                  label="Adresse Email"
                  optional
                  id="email"
                  hint="Pour envoi de quittances et notifications"
                  error={formError && formError.toLowerCase().includes('email') ? formError : ''}
                >
                  <input
                    id="email"
                    type="email"
                    placeholder="Ex : locataire@email.com"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none transition-all ${
                      formError && formError.toLowerCase().includes('email')
                        ? 'border-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                        : 'border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20'
                    }`}
                  />
                </FormField>
              </div>
            </FormSection>

            {/* 2. Affectation Immobilière & Loyer */}
            <FormSection
              icon="fa-home"
              title="2. Logement & Conditions de Bail"
              subtitle="Bien occupé, loyer contractuel et assignation du collecteur"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Bien immobilier occupé" optional id="propertyId" hint="Attribue le bien au locataire">
                  <select
                    id="propertyId"
                    value={form.propertyId || ''}
                    onChange={e => {
                      const selectedId = e.target.value;
                      const prop = properties.find(p => String(p.id) === String(selectedId));
                      setForm({
                        ...form,
                        propertyId: selectedId,
                        propertyName: prop ? prop.name : '',
                        amountDue: prop ? (prop.rent ? String(prop.rent) : prop.amount_due ? String(prop.amount_due) : form.amountDue) : form.amountDue
                      });
                    }}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                  >
                    <option value="">-- Sans bien attribué (En attente) --</option>
                    {properties.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.address ? `(${p.address})` : ''} {p.rent ? `— ${Number(p.rent).toLocaleString()} FCFA` : ''}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Loyer mensuel exigible" id="amountDue" hint="Montant appelé chaque mois">
                  <MoneyInput
                    id="amountDue"
                    value={form.amountDue}
                    onChange={(e, num) => setForm({ ...form, amountDue: (num ?? Number(e?.target?.value)) || 0 })}
                    placeholder="Ex : 150 000"
                    currency="FCFA"
                  />
                </FormField>
              </div>

              <FormField label="Agent Collecteur assigné" optional id="collectorId" hint="Agent en charge de la tournée d'encaissement">
                <select
                  id="collectorId"
                  value={form.collectorId || ''}
                  onChange={e => setForm({ ...form, collectorId: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                >
                  <option value="">-- Sélectionner un collecteur --</option>
                  {collectors.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name} {c.zone ? `(Zone : ${c.zone})` : ''}
                    </option>
                  ))}
                </select>
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
                    <i className={`fas ${editingClient ? 'fa-save' : 'fa-check-circle'}`}></i>
                    <span>{editingClient ? 'Enregistrer les modifications' : 'Créer le locataire'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {selectedClientForStatement && (
        <TenantStatementModal
          client={selectedClientForStatement}
          onClose={() => setSelectedClientForStatement(null)}
        />
      )}

      <ImportPortfolioModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
      />
    </div>
  );
}
