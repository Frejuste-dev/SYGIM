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
import { formatXOF, formatStatus } from '../utils/formatters';
import { exportToExcel, exportToPDF } from '../utils/exportUtils';

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
      setFormError('Le nom et le téléphone sont obligatoires.');
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
      } else {
        await createClient.mutateAsync(payload);
      }
      setShowModal(false);
    } catch (err) {
      setFormError(err.message || 'Erreur serveur.');
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
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Locataires</h1>
          <p className="text-slate-500 text-sm mt-1">Suivez les locataires, leurs informations de contact et leurs statuts de paiement.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={handleExportClientsExcel} className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors">
            <i className="fas fa-file-excel"></i> Excel
          </button>
          <button onClick={handleExportClientsPDF} className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors">
            <i className="fas fa-file-pdf"></i> PDF
          </button>
          <button onClick={openCreateModal} className="bg-primary text-white rounded-lg px-4 py-2 hover:bg-primary-dark transition-colors font-medium text-sm flex items-center shadow-sm">
            <i className="fas fa-plus mr-2"></i> Ajouter un locataire
          </button>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard label="Total locataires" value={stats.totalClients || 0} icon="fa-users" color="var(--primary)" />
        <StatsCard label="À jour" value={paidCount} icon="fa-check-circle" color="var(--success)" />
        <StatsCard label="En retard / Attente" value={overdueCount} icon="fa-exclamation-triangle" color="var(--danger)" />
        <StatsCard label="Créance totale" value={formatXOF(totalOwed, { compact: false })} icon="fa-wallet" color="var(--warning)" />
      </div>

      {/* OUTILS ET FILTRES */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="relative w-full md:w-96">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
          <input type="text" placeholder="Rechercher (nom, téléphone, email)..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
        </div>
        <div className="w-full sm:w-auto flex items-center gap-2">
          <select value={statusFilter} onChange={(e) => handleFilterChange('status', e.target.value)}
            className="w-full sm:w-auto px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-slate-700">
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* TABLEAU */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto min-w-0">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                <th className="py-3 px-6 font-semibold">Identité</th>
                <th className="py-3 px-6 font-semibold">Contact</th>
                <th className="py-3 px-6 font-semibold">Loyer</th>
                <th className="py-3 px-6 font-semibold">Statut</th>
                <th className="py-3 px-6 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-slate-500">
                    <i className="fas fa-spinner fa-spin text-primary text-xl mb-3 block"></i>
                    Chargement des locataires...
                  </td>
                </tr>
              ) : clients.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-slate-500">
                    <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                      <i className="fas fa-users-slash text-slate-400 text-xl"></i>
                    </div>
                    {clientsEmptyMessage}
                  </td>
                </tr>
              ) : (
                clients.map(client => {
                  const initials = `${client.first_name?.[0] || ''}${client.last_name?.[0] || ''}`.toUpperCase() || '?';
                  return (
                    <tr key={client.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                            {initials}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">{client.first_name} {client.last_name}</div>
                            <div className="text-xs text-slate-500">{client.property_name || 'Aucun bien assigné'}</div>
                            {client.collector_name && (
                              <div className="text-[11px] text-blue-600 font-medium flex items-center gap-1 mt-0.5">
                                <i className="fas fa-motorcycle text-[10px]"></i>
                                <span>{client.collector_name}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="text-sm text-slate-700">{client.phone || '-'}</div>
                        <div className="text-xs text-slate-500 truncate max-w-[150px]" title={client.email}>{client.email || '-'}</div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="font-medium text-slate-900">{formatXOF(client.amount_due, { compact: false })}</div>
                        {client.amount_paid > 0 && <div className="text-xs text-emerald-600">{formatXOF(client.amount_paid, { compact: false })} payé</div>}
                      </td>
                      <td className="py-4 px-6">
                      {(() => { const s = formatStatus(client.status); return (
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${s.twClass}`}>
                          {client.status === 'paid' && <i className="fas fa-check-circle mr-1.5 text-[10px]"></i>}
                          {client.status === 'partial' && <i className="fas fa-adjust mr-1.5 text-[10px]"></i>}
                          {(client.status === 'late' || client.status === 'overdue') && <i className="fas fa-exclamation-circle mr-1.5 text-[10px]"></i>}
                          {s.label || client.status || 'Inconnu'}
                        </span>
                      ); })()}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setSelectedClientForStatement(client)} className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 hover:border-primary/30 transition-all flex items-center justify-center cursor-pointer" title="Grand Livre & Relevé Financier">
                            <i className="fas fa-file-invoice-dollar text-sm"></i>
                          </button>
                          <button onClick={() => openEditModal(client)} className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-primary hover:border-primary hover:bg-primary/5 transition-all flex items-center justify-center" title="Modifier">
                            <i className="fas fa-pen text-sm"></i>
                          </button>
                          <button onClick={() => handleDelete(client)} className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-all flex items-center justify-center" title="Supprimer">
                            <i className="fas fa-trash text-sm"></i>
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
          maxWidth="640px"
        >
          {formError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3.5 rounded-xl text-sm mb-5 flex items-center gap-2 font-medium">
              <i className="fas fa-exclamation-circle shrink-0"></i>
              <span>{formError}</span>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Prénom</label>
                <input
                  id="firstName"
                  type="text"
                  placeholder="Ex : Awa"
                  value={form.firstName}
                  onChange={e => setForm({ ...form, firstName: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Nom de famille <span className="text-rose-600">*</span>
                </label>
                <input
                  id="lastName"
                  type="text"
                  required
                  placeholder="Ex : Koné"
                  value={form.lastName}
                  onChange={e => setForm({ ...form, lastName: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="phone" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Téléphone <span className="text-rose-600">*</span>
                </label>
                <input
                  id="phone"
                  type="tel"
                  required
                  placeholder="Ex : +225 07 00 00 00 00"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Email</label>
                <input
                  id="email"
                  type="email"
                  placeholder="Ex : locataire@email.com"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>

            <div className="bg-slate-50/90 p-4 rounded-2xl border border-slate-200/90 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <i className="fas fa-home text-xs"></i>
                </div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Affectation Immobilière & Loyer
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="propertyId" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Bien immobilier occupé
                  </label>
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
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                  >
                    <option value="">-- Sélectionner un bien immobilier --</option>
                    {properties.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.address ? `(${p.address})` : ''} {p.rent ? `— ${Number(p.rent).toLocaleString()} XOF` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="amountDue" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Loyer mensuel (XOF)
                  </label>
                  <input
                    id="amountDue"
                    type="number"
                    placeholder="Ex : 150000"
                    value={form.amountDue}
                    onChange={e => setForm({ ...form, amountDue: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="collectorId" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Agent Collecteur assigné (Tournée de collecte)
                </label>
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
              </div>
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
                    <i className={`fas ${editingClient ? 'fa-save' : 'fa-check-circle'}`}></i>
                    <span>{editingClient ? 'Enregistrer' : 'Créer le locataire'}</span>
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
    </div>
  );
}
