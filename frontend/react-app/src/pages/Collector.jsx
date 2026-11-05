/**
 * SYGIM - Page Collecteur
 * Tableau de bord terrain : locataires assignes, KPIs, alertes impayes, enregistrement paiements
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { useClients, useClientStats } from '../hooks/queries/useClients';
import { useProperties } from '../hooks/queries/useProperties';
import { API } from '../api/services';
import PaymentModal from '../components/PaymentModal';
import SignaturePad from '../components/SignaturePad';
import NewTenantModal from '../components/NewTenantModal';
import { useToast } from '../components/ToastContext';
import { formatXOF, formatStatus } from '../utils/formatters';

// Sous-composant : Carte KPI
function KpiCard({ label, value, icon, colorClass = 'text-primary', bgClass = 'bg-primary/10', sub }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex items-start gap-4">
      <div className={`w-12 h-12 rounded-xl ${bgClass} flex items-center justify-center shrink-0`}>
        <i className={`fas ${icon} ${colorClass} text-lg`}></i>
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-slate-900 truncate">{value}</div>
        <div className="text-sm text-slate-500 mt-0.5">{label}</div>
        {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
      </div>
    </div>
  );
}

// Sous-composant : Ligne locataire
function ClientRow({ client, onPayment }) {
  const due = client.amount_due ?? client.amountDue ?? 0;
  const paid = client.amount_paid ?? client.amountPaid ?? 0;
  const remaining = Math.max(0, due - paid);
  const isSettled = remaining <= 0;
  const st = formatStatus(isSettled ? 'paid' : (client.status || 'pending'));
  const name = `${client.last_name ?? client.lastName ?? ''} ${client.first_name ?? client.firstName ?? ''}`.trim();
  const initial = (client.last_name ?? client.lastName ?? '?').slice(0, 1).toUpperCase();

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
      <td className="py-4 px-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
            {initial}
          </div>
          <div>
            <div className="font-semibold text-slate-900 text-sm">{name}</div>
            <div className="text-xs text-slate-400">{client.phone || 'Sans telephone'}</div>
          </div>
        </div>
      </td>
      <td className="py-4 px-5 text-sm text-slate-600 max-w-[180px] truncate hidden md:table-cell" title={client.address}>
        {client.address || 'Sans adresse'}
      </td>
      <td className="py-4 px-5">
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${st.twClass}`}>
          {st.label}
        </span>
      </td>
      <td className="py-4 px-5 text-sm text-slate-700 font-medium text-right hidden sm:table-cell">
        {formatXOF(due, { compact: false })}
      </td>
      <td className="py-4 px-5 text-right">
        {isSettled
          ? <span className="text-sm font-semibold text-emerald-600">Solde</span>
          : <span className="text-sm font-bold text-rose-600">{formatXOF(remaining, { compact: false })}</span>
        }
      </td>
      <td className="py-4 px-5 text-right">
        {!isSettled ? (
          <button
            onClick={() => onPayment(client)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary-dark transition-colors shadow-sm shadow-primary/20"
          >
            <i className="fas fa-plus-circle text-[10px]"></i>
            Payer
          </button>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
            <i className="fas fa-check-circle"></i> OK
          </span>
        )}
      </td>
    </tr>
  );
}

// Sous-composant : Carte locataire optimisée smartphone
function MobileClientCard({ client, onPayment }) {
  const due = client.amount_due ?? client.amountDue ?? 0;
  const paid = client.amount_paid ?? client.amountPaid ?? 0;
  const remaining = Math.max(0, due - paid);
  const isSettled = remaining <= 0;
  const st = formatStatus(isSettled ? 'paid' : (client.status || 'pending'));
  const name = `${client.last_name ?? client.lastName ?? ''} ${client.first_name ?? client.firstName ?? ''}`.trim() || 'Locataire';
  const initial = (client.last_name ?? client.lastName ?? client.first_name ?? '?').slice(0, 1).toUpperCase();
  const phone = client.phone || client.telephone || '';
  const propertyTitle = client.property_title || client.propertyName || client.property?.title || client.address;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-3.5 space-y-3 transition-all">
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0 border border-primary/20">
            {initial}
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-slate-900 text-sm leading-tight truncate">{name}</h3>
            {propertyTitle ? (
              <p className="text-xs text-slate-500 truncate flex items-center gap-1 mt-0.5" title={propertyTitle}>
                <i className="fas fa-home text-slate-400 text-[10px]"></i>
                <span className="truncate">{propertyTitle}</span>
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {phone ? (
            <a
              href={`tel:${phone.replace(/\s+/g, "")}`}
              className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center active:scale-95 transition-transform"
              title={`Appeler ${phone}`}
              aria-label={`Appeler ${phone}`}
            >
              <i className="fas fa-phone-alt text-xs"></i>
            </a>
          ) : null}
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${st.twClass}`}>
            {st.label}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 bg-slate-50/90 rounded-xl p-2.5 border border-slate-100 text-xs">
        <div>
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Loyer dû</span>
          <span className="font-semibold text-slate-700">{formatXOF(due, { compact: false })}</span>
        </div>
        <div className="text-right">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Reste à payer</span>
          {isSettled ? (
            <span className="font-bold text-emerald-600 flex items-center justify-end gap-1">
              <i className="fas fa-check-circle text-[10px]"></i> Soldé
            </span>
          ) : (
            <span className="font-extrabold text-rose-600">{formatXOF(remaining, { compact: false })}</span>
          )}
        </div>
      </div>

      {!isSettled ? (
        <button
          onClick={() => onPayment(client)}
          className="w-full py-2.5 px-4 bg-primary text-white text-sm font-bold rounded-xl shadow-sm shadow-primary/20 hover:bg-primary-dark active:scale-[0.98] transition flex items-center justify-center gap-2"
        >
          <i className="fas fa-hand-holding-dollar"></i>
          Encaisser
        </button>
      ) : (
        <div className="w-full py-2 px-3 bg-emerald-50/80 border border-emerald-200/80 text-emerald-700 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5">
          <i className="fas fa-check-double text-emerald-500"></i>
          Loyer à jour
        </div>
      )}
    </div>
  );
}

// ---- Composant principal ----
export default function Collector() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [searchParams, setSearchParams] = useSearchParams();
  const searchTerm = searchParams.get('search') || '';
  const showOnlyAgent = searchParams.get('all') !== 'true';

  const [activeModal, setActiveModal] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [pendingPayment, setPendingPayment] = useState(null);
  const [overdueAlerts, setOverdueAlerts] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);

  const { data: clientsResult = {}, isLoading: clientsLoading } = useClients();
  const clients = useMemo(() => clientsResult.data || [], [clientsResult]);

  const { data: propertiesResult = {} } = useProperties();
  const properties = useMemo(() => propertiesResult.data || [], [propertiesResult]);

  // PHASE 3 FIX : normalisation du champ collecteur (snake_case vs camelCase)
  const collectorKey = (user?.collectorName || user?.collector_name || user?.displayName || '').trim().toUpperCase();
  const collectorId = user?.collectorId || user?.collector_id || null;
  const username = (user?.username || '').trim().toUpperCase();

  const baseClients = useMemo(() => {
    if (!showOnlyAgent) return clients;

    // Si l'utilisateur connecté est un collecteur, le backend GET /api/clients a déjà filtré
    // de façon stricte en SQL (WHERE c.collector_id = ?). Tous les clients reçus appartiennent à sa tournée.
    if (user?.role === 'collector') {
      return clients;
    }

    return clients.filter(c => {
      if (collectorId && c.collector_id && Number(c.collector_id) === Number(collectorId)) {
        return true;
      }
      const field = (c.collector_name ?? c.collectorName ?? c.agent ?? '').trim().toUpperCase();
      if (collectorKey && (field === collectorKey || field.includes(collectorKey) || collectorKey.includes(field))) {
        return true;
      }
      return false;
    });
  }, [clients, showOnlyAgent, user?.role, collectorKey, collectorId]);

  const filteredClients = useMemo(() => {
    if (!searchTerm.trim()) return baseClients;
    const term = searchTerm.toLowerCase();
    return baseClients.filter(c =>
      (c.first_name ?? c.firstName ?? '').toLowerCase().includes(term) ||
      (c.last_name ?? c.lastName ?? '').toLowerCase().includes(term) ||
      (c.address ?? '').toLowerCase().includes(term) ||
      (c.phone ?? '').includes(term)
    );
  }, [baseClients, searchTerm]);

  const displayedClients = useMemo(() =>
    [...filteredClients].sort((a, b) => {
      const aRem = (a.amount_due ?? a.amountDue ?? 0) - (a.amount_paid ?? a.amountPaid ?? 0);
      const bRem = (b.amount_due ?? b.amountDue ?? 0) - (b.amount_paid ?? b.amountPaid ?? 0);
      return (bRem > 0 ? 1 : 0) - (aRem > 0 ? 1 : 0);
    }), [filteredClients]);

  const agentQuery = showOnlyAgent ? collectorKey : undefined;
  const { data: stats = {} } = useClientStats({ agent: agentQuery, search: searchTerm });

  const totalCollected = stats.totalPaid ?? 0;
  const totalDue = stats.totalDue ?? 0;
  const overdueCount = stats.overdueCount ?? 0;
  const collectionRate = totalDue > 0 ? Math.round((totalCollected / totalDue) * 100) : 0;

  const localOverdue = displayedClients.filter(c => {
    const rem = (c.amount_due ?? c.amountDue ?? 0) - (c.amount_paid ?? c.amountPaid ?? 0);
    return rem > 0;
  }).length;

  useEffect(() => {
    API.Alerts.getOverduePayments()
      .then(res => { if (res?.success) setOverdueAlerts(res.data || []); })
      .catch(() => {});
  }, []);

  const handleFilterChange = (key, value) => {
    const p = new URLSearchParams(searchParams);
    if (value) p.set(key, value); else p.delete(key);
    setSearchParams(p);
  };

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries();
      showToast({ type: 'success', message: 'Donnees synchronisees.' });
    } catch (e) {
      showToast({ type: 'error', message: e.message || 'Impossible de synchroniser.' });
    } finally { setIsRefreshing(false); }
  };

  const handleOpenPayment = (client) => { setSelectedClient(client); setActiveModal('payment'); };
  const handleProceedToSignature = (payment) => { setPendingPayment(payment); setActiveModal('signature'); };

  const handleConfirmSignature = async (signatureImg) => {
    if (!pendingPayment) return { success: false, message: 'Informations incompletes.' };
    try {
      // Enregistrement via le nouveau moteur financier (FIFO + Grand Livre)
      let response;
      try {
        response = await API.Financial.registerPayment({
          clientId: selectedClient.id,
          amountReceived: pendingPayment.amount,
          method: pendingPayment.method.toUpperCase(),
          receiptNumber: pendingPayment.reference
        });
      } catch (err) {
        // Fallback transparent vers l'ancienne route si besoin
        response = await API.Transactions.create({
          clientId: selectedClient.id,
          amount: pendingPayment.amount,
          method: pendingPayment.method,
          reference: pendingPayment.reference,
          status: 'processed', type: 'rent', signature: signatureImg
        });
      }

      if (response?.success || response?.data?.payment) {
        queryClient.invalidateQueries({ queryKey: ['clients'] });
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        const lastName = selectedClient.last_name ?? selectedClient.lastName ?? '';
        const firstName = selectedClient.first_name ?? selectedClient.firstName ?? '';
        const surplus = response?.data?.unallocatedSurplus || 0;
        const msg = surplus > 0
          ? `Paiement validé ! ${formatXOF(surplus, { compact: false })} placé en avance locataire.`
          : `Paiement de ${formatXOF(pendingPayment.amount, { compact: false })} enregistré pour ${lastName} ${firstName}.`;
        showToast({ type: 'success', message: msg });
        setActiveModal(null); setSelectedClient(null); setPendingPayment(null);
        return { success: true };
      } else {
        const msg = response?.error || 'Impossible d\'enregistrer la transaction.';
        showToast({ type: 'error', message: msg });
        return { success: false, message: msg };
      }
    } catch (error) {
      const msg = `Erreur reseau : ${error.message}`;
      showToast({ type: 'error', message: msg });
      return { success: false, message: msg };
    }
  };

  const handleSaveNewTenant = async (form) => {
    const response = await API.Clients.create({
      firstName: form.firstName, lastName: form.lastName, phone: form.phone,
      email: form.email || null, address: form.address || null,
      property_id: parseInt(form.propertyId), amount_due: form.rent, amount_paid: 0,
      status: 'pending', deposit: form.deposit || 0,
      contract_start: form.startDate, contract_end: form.endDate || null
    });
    if (response?.success) {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      showToast({ type: 'success', message: `Locataire ${form.firstName} ${form.lastName} ajoute avec succes.` });
    } else {
      throw new Error(response?.error || 'Impossible d\'ajouter le locataire.');
    }
  };

  const urgentAlerts = overdueAlerts.filter(a => a.severity === 'critique' || a.severity === 'haute');

  return (
    <div className="p-3.5 sm:p-6 md:p-8 space-y-4 sm:space-y-6 min-h-full pb-20 md:pb-8">

      {/* En-tete */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Collecte des loyers</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Bonjour, <span className="font-semibold text-slate-700">{user?.displayName || user?.collectorName || 'Collecteur'}</span>
            {' '}&mdash; tournee du {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveModal('newTenant')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 shadow-sm transition-colors"
          >
            <i className="fas fa-user-plus text-primary"></i>
            <span className="hidden sm:inline">Nouveau locataire</span>
          </button>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary-dark shadow-sm shadow-primary/20 transition-colors disabled:opacity-60"
          >
            <i className={`fas fa-sync text-xs ${isRefreshing ? 'fa-spin' : ''}`}></i>
            <span className="hidden sm:inline">{isRefreshing ? 'Sync...' : 'Synchroniser'}</span>
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        <KpiCard
          label="Locataires assignes"
          value={displayedClients.length}
          icon="fa-users"
          colorClass="text-primary" bgClass="bg-primary/10"
          sub={showOnlyAgent ? 'Ma tournee' : 'Tous'}
        />
        <KpiCard
          label="Total collecte"
          value={formatXOF(totalCollected)}
          icon="fa-money-bill-wave"
          colorClass="text-emerald-600" bgClass="bg-emerald-50"
        />
        <KpiCard
          label="En retard / Impayes"
          value={overdueCount || localOverdue}
          icon="fa-exclamation-triangle"
          colorClass={(overdueCount || localOverdue) > 0 ? 'text-rose-600' : 'text-slate-400'}
          bgClass={(overdueCount || localOverdue) > 0 ? 'bg-rose-50' : 'bg-slate-50'}
        />
        <KpiCard
          label="Taux de recouvrement"
          value={`${collectionRate}%`}
          icon="fa-chart-line"
          colorClass={collectionRate >= 80 ? 'text-emerald-600' : collectionRate >= 50 ? 'text-amber-500' : 'text-rose-600'}
          bgClass={collectionRate >= 80 ? 'bg-emerald-50' : collectionRate >= 50 ? 'bg-amber-50' : 'bg-rose-50'}
          sub={totalDue > 0 ? `sur ${formatXOF(totalDue)} attendus` : undefined}
        />
      </div>

      {/* Panneau alertes impayes */}
      {overdueAlerts.length > 0 && (
        <div className={`rounded-xl border p-4 ${urgentAlerts.length > 0 ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'}`}>
          <button className="flex items-center justify-between w-full text-left" onClick={() => setAlertsOpen(o => !o)}>
            <div className="flex items-center gap-3">
              <i className={`fas fa-bell ${urgentAlerts.length > 0 ? 'text-rose-600' : 'text-amber-600'}`}></i>
              <span className={`font-semibold text-sm ${urgentAlerts.length > 0 ? 'text-rose-700' : 'text-amber-700'}`}>
                {urgentAlerts.length > 0
                  ? `${urgentAlerts.length} alerte${urgentAlerts.length > 1 ? 's' : ''} urgente${urgentAlerts.length > 1 ? 's' : ''}`
                  : `${overdueAlerts.length} alerte${overdueAlerts.length > 1 ? 's' : ''} de paiement`}
              </span>
              {urgentAlerts.length > 0 && (
                <span className="bg-rose-600 text-white rounded-full px-2 py-0.5 text-xs font-bold">{urgentAlerts.length}</span>
              )}
            </div>
            <i className={`fas fa-chevron-${alertsOpen ? 'up' : 'down'} text-slate-400 text-xs`}></i>
          </button>
          {alertsOpen && (
            <div className="mt-3 space-y-2 border-t border-current/10 pt-3">
              {overdueAlerts.slice(0, 10).map((alert, idx) => (
                <div key={alert.id ?? idx} className="flex items-center gap-3 text-sm">
                  <i className={`fas fa-circle text-[6px] ${alert.severity === 'critique' ? 'text-rose-600' : alert.severity === 'haute' ? 'text-amber-500' : 'text-slate-400'}`}></i>
                  <span className="flex-1 font-medium text-slate-800">{alert.first_name} {alert.last_name}</span>
                  <span className="font-bold text-rose-700">{formatXOF(alert.amount_owed, { compact: false })}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Barre de filtres & recherche adaptée smartphone */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-4">
          <div className="relative flex-1">
            <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none"></i>
            <input
              type="text"
              placeholder="Rechercher nom, adresse, tel..."
              value={searchTerm}
              onChange={e => handleFilterChange('search', e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50/60 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
          <div className="flex rounded-xl border border-slate-200 overflow-hidden shrink-0 w-full sm:w-auto">
            <button
              onClick={() => handleFilterChange('all', '')}
              className={`flex-1 sm:flex-initial px-4 py-2 text-sm font-semibold transition-colors text-center ${showOnlyAgent ? 'bg-primary text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              <i className="fas fa-user mr-1.5"></i>Ma tournée
            </button>
            <button
              onClick={() => handleFilterChange('all', 'true')}
              className={`flex-1 sm:flex-initial px-4 py-2 text-sm font-semibold transition-colors border-l border-slate-200 text-center ${!showOnlyAgent ? 'bg-primary text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              <i className="fas fa-users mr-1.5"></i>Tous
            </button>
          </div>
        </div>
      </div>

      {/* Table des locataires */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">
            {showOnlyAgent ? 'Ma tournee' : 'Tous les locataires'}
          </h2>
          <span className="text-xs text-slate-500 bg-slate-100 rounded-full px-2.5 py-1 font-medium">
            {clientsLoading ? '...' : `${displayedClients.length} locataire${displayedClients.length !== 1 ? 's' : ''}`}
          </span>
        </div>

        {clientsLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <i className="fas fa-spinner fa-spin text-primary text-2xl"></i>
            <span className="text-sm text-slate-500">Chargement des locataires...</span>
          </div>
        ) : displayedClients.length > 0 ? (
          <>
            {/* Vue Mobile (Cartes tactiles individuelles) */}
            <div className="block md:hidden p-3 space-y-3 bg-slate-50/60">
              {displayedClients.map(client => (
                <MobileClientCard key={client.id} client={client} onPayment={handleOpenPayment} />
              ))}
            </div>

            {/* Vue Ordinateur (Tableau) */}
            <div className="hidden md:block overflow-x-auto min-w-0">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr>
                    <th className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3 px-5 font-semibold">Locataire</th>
                    <th className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3 px-5 font-semibold hidden md:table-cell">Adresse</th>
                    <th className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3 px-5 font-semibold">Statut</th>
                    <th className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3 px-5 font-semibold text-right hidden sm:table-cell">Loyer mensuel</th>
                    <th className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3 px-5 font-semibold text-right">Reste a payer</th>
                    <th className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3 px-5 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedClients.map(client => (
                    <ClientRow key={client.id} client={client} onPayment={handleOpenPayment} />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
              <i className="fas fa-users text-slate-400 text-xl"></i>
            </div>
            <div className="text-center">
              <p className="font-semibold text-slate-700">
                {searchTerm
                  ? 'Aucun locataire ne correspond a cette recherche'
                  : showOnlyAgent
                    ? 'Aucun locataire assigne a votre tournee'
                    : 'Aucun locataire disponible'}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                {searchTerm
                  ? "Verifiez le nom, le telephone ou l'adresse saisis."
                  : showOnlyAgent
                    ? `Votre identifiant collecteur : "${collectorKey || 'non defini'}". Passez sur "Tous" ou contactez un admin.`
                    : 'Ajoutez un locataire ou synchronisez les donnees.'}
              </p>
            </div>
            {showOnlyAgent && !searchTerm && (
              <button
                onClick={() => handleFilterChange('all', 'true')}
                className="mt-2 px-4 py-2 text-sm font-medium text-primary border border-primary/30 rounded-xl hover:bg-primary/5 transition-colors"
              >
                Voir tous les locataires
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modales */}
      <PaymentModal
        isOpen={activeModal === 'payment'}
        onClose={() => { setActiveModal(null); setSelectedClient(null); }}
        client={selectedClient}
        onProceedToSignature={handleProceedToSignature}
      />
      <SignaturePad
        isOpen={activeModal === 'signature'}
        onClose={() => setActiveModal('payment')}
        onConfirm={handleConfirmSignature}
        client={selectedClient}
        payment={pendingPayment}
      />
      <NewTenantModal
        isOpen={activeModal === 'newTenant'}
        onClose={() => setActiveModal(null)}
        properties={properties}
        onSubmit={handleSaveNewTenant}
      />
    </div>
  );
}
