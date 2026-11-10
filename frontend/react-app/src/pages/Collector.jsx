/**
 * SYGIM - Espace Collecteur Terrain (Terminal Mobile Opérationnel)
 * 1. Collecte rapide des loyers avec prise en compte des déductions pour réparation
 * 2. Signalement départ locataire & libération du logement (vacant)
 * 3. Attribution d'un logement vacant (locataire existant ou nouveau)
 * 4. Gestion des dépenses de réparation engagées par les locataires et imputées au loyer
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { useClients } from '../hooks/queries/useClients';
import { useProperties } from '../hooks/queries/useProperties';
import { API } from '../api/services';
import PaymentModal from '../components/PaymentModal';
import SignaturePad from '../components/SignaturePad';
import TenantDepartureModal from '../components/TenantDepartureModal';
import TenantRepairModal from '../components/TenantRepairModal';
import AssignPropertyModal from '../components/AssignPropertyModal';
import { useToast } from '../components/ToastContext';
import { formatXOF, formatStatus } from '../utils/formatters';

export default function Collector() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [searchParams, setSearchParams] = useSearchParams();
  const searchTerm = searchParams.get('search') || '';
  const showOnlyAgent = searchParams.get('all') !== 'true';

  // Onglet actif : 'collect' (Tournée), 'properties' (Logements & Vacances), 'repairs' (Réparations)
  const [activeTab, setActiveTab] = useState('collect');

  // Filtres spécifiques
  const [propertyStatusFilter, setPropertyStatusFilter] = useState('all'); // 'all', 'vacant', 'loue'
  const [clientFilter, setClientFilter] = useState('all'); // 'all', 'pending', 'settled'

  // États des modales
  const [activeModal, setActiveModal] = useState(null); // 'payment', 'signature', 'departure', 'repair', 'assign'
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [pendingPayment, setPendingPayment] = useState(null);

  // État des réparations
  const [repairsList, setRepairsList] = useState([]);
  const [repairsLoading, setRepairsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Récupération des locataires
  const { data: clientsResult = {}, isLoading: clientsLoading } = useClients();
  const clients = useMemo(() => clientsResult.data || [], [clientsResult]);

  // Récupération des biens immobiliers
  const { data: propertiesResult = {}, isLoading: propertiesLoading } = useProperties();
  const properties = useMemo(() => propertiesResult.data || [], [propertiesResult]);

  // Normalisation identifiant collecteur
  const collectorKey = (user?.collectorName || user?.collector_name || user?.displayName || '').trim().toUpperCase();
  const collectorId = user?.collectorId || user?.collector_id || null;

  // Filtrage des locataires selon la tournée du collecteur
  const baseClients = useMemo(() => {
    if (!showOnlyAgent) return clients;
    if (user?.role === 'collector') return clients;

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

  // Recherche locataires
  const filteredClients = useMemo(() => {
    return baseClients.filter(c => {
      const due = c.amount_due ?? c.amountDue ?? 0;
      const paid = c.amount_paid ?? c.amountPaid ?? 0;
      const rem = Math.max(0, due - paid);

      if (clientFilter === 'pending' && rem <= 0) return false;
      if (clientFilter === 'settled' && rem > 0) return false;

      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        (c.first_name ?? c.firstName ?? '').toLowerCase().includes(term) ||
        (c.last_name ?? c.lastName ?? '').toLowerCase().includes(term) ||
        (c.address ?? '').toLowerCase().includes(term) ||
        (c.phone ?? '').includes(term) ||
        (c.property_title ?? c.propertyName ?? '').toLowerCase().includes(term)
      );
    });
  }, [baseClients, searchTerm, clientFilter]);

  // Tri : en priorité les loyers restant à payer
  const displayedClients = useMemo(() => {
    return [...filteredClients].sort((a, b) => {
      const aRem = (a.amount_due ?? a.amountDue ?? 0) - (a.amount_paid ?? a.amountPaid ?? 0);
      const bRem = (b.amount_due ?? b.amountDue ?? 0) - (b.amount_paid ?? b.amountPaid ?? 0);
      return (bRem > 0 ? 1 : 0) - (aRem > 0 ? 1 : 0);
    });
  }, [filteredClients]);

  // Filtrage des biens
  const displayedProperties = useMemo(() => {
    return properties.filter(p => {
      if (propertyStatusFilter === 'vacant' && p.status !== 'vacant') return false;
      if (propertyStatusFilter === 'loue' && p.status !== 'loue') return false;

      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        (p.name || '').toLowerCase().includes(term) ||
        (p.address || '').toLowerCase().includes(term) ||
        (p.tenant_last_name || '').toLowerCase().includes(term)
      );
    });
  }, [properties, propertyStatusFilter, searchTerm]);

  // Compteur biens vacants
  const vacantPropertiesCount = useMemo(() => {
    return properties.filter(p => p.status === 'vacant').length;
  }, [properties]);

  // Charger la liste des réparations
  const fetchRepairs = async () => {
    setRepairsLoading(true);
    try {
      const res = await API.Repairs.getAll();
      if (res?.success || res?.data) {
        setRepairsList(res.data || []);
      }
    } catch {
      // Ignorer erreur
    } finally {
      setRepairsLoading(false);
    }
  };

  useEffect(() => {
    fetchRepairs();
  }, []);

  // Synchronisation globale
  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['clients'] }),
        queryClient.invalidateQueries({ queryKey: ['properties'] }),
        fetchRepairs()
      ]);
      showToast({ type: 'success', message: 'Données synchronisées avec succès.' });
    } catch (e) {
      showToast({ type: 'error', message: e.message || 'Impossible de synchroniser.' });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Actions Locataire
  const handleOpenPayment = (client) => {
    setSelectedClient(client);
    setActiveModal('payment');
  };

  const handleOpenDeparture = (client) => {
    setSelectedClient(client);
    setActiveModal('departure');
  };

  const handleOpenRepair = (client) => {
    setSelectedClient(client);
    setActiveModal('repair');
  };

  // Actions Logement
  const handleOpenAssign = (property) => {
    setSelectedProperty(property);
    setActiveModal('assign');
  };

  // Processus Signature & Paiement
  const handleProceedToSignature = (payment) => {
    setPendingPayment(payment);
    setActiveModal('signature');
  };

  const handleConfirmSignature = async (signatureImg) => {
    if (!pendingPayment || !selectedClient) return { success: false, message: 'Données incomplètes' };
    try {
      let response;
      try {
        response = await API.Financial.registerPayment({
          clientId: selectedClient.id,
          amountReceived: pendingPayment.amount,
          method: pendingPayment.method.toUpperCase(),
          receiptNumber: pendingPayment.reference
        });
      } catch {
        response = await API.Transactions.create({
          clientId: selectedClient.id,
          amount: pendingPayment.amount,
          method: pendingPayment.method,
          reference: pendingPayment.reference,
          status: 'processed',
          type: 'rent',
          signature: signatureImg
        });
      }

      if (response?.success || response?.data?.payment) {
        await queryClient.invalidateQueries({ queryKey: ['clients'] });
        await queryClient.invalidateQueries({ queryKey: ['transactions'] });
        await fetchRepairs();

        const clientName = `${selectedClient.last_name || selectedClient.lastName || ''} ${selectedClient.first_name || selectedClient.firstName || ''}`.trim();
        showToast({
          type: 'success',
          message: `Paiement de ${formatXOF(pendingPayment.amount)} encaissé pour ${clientName}.`
        });

        setActiveModal(null);
        setSelectedClient(null);
        setPendingPayment(null);
        return { success: true };
      } else {
        const msg = response?.error || 'Erreur lors de l\'enregistrement';
        showToast({ type: 'error', message: msg });
        return { success: false, message: msg };
      }
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Erreur réseau' });
      return { success: false, message: err.message };
    }
  };

  // Solder une réparation manuellement
  const handleSettleRepair = async (repair) => {
    if (!window.confirm(`Confirmer le solde de la réparation "${repair.description}" ?`)) return;
    try {
      const res = await API.Repairs.settle(repair.id);
      if (res?.success) {
        showToast({ type: 'success', message: 'Réparation soldée avec succès.' });
        fetchRepairs();
        queryClient.invalidateQueries({ queryKey: ['clients'] });
      }
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Impossible de solder la réparation.' });
    }
  };

  const pendingClientsCount = displayedClients.filter(c => {
    const rem = (c.amount_due ?? c.amountDue ?? 0) - (c.amount_paid ?? c.amountPaid ?? 0);
    return rem > 0;
  }).length;

  return (
    <div className="p-3.5 sm:p-6 md:p-8 space-y-4 sm:space-y-6 min-h-full pb-24 md:pb-8 max-w-7xl mx-auto">
      {/* En-tête simplifié & direct */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Espace Collecteur Terrain</h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Agent : <span className="font-bold text-slate-700">{user?.displayName || user?.collectorName || 'Collecteur'}</span>
            {' '}&bull; {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold rounded-xl transition disabled:opacity-60"
          >
            <i className={`fas fa-sync text-xs ${isRefreshing ? 'fa-spin' : ''}`}></i>
            <span>{isRefreshing ? 'Actualisation...' : 'Synchroniser'}</span>
          </button>
        </div>
      </div>

      {/* Barre d'onglets opérationnels (Sans Dashboard / KPI lourd) */}
      <div className="flex rounded-2xl border border-slate-200 bg-white shadow-sm p-1.5 overflow-x-auto gap-1">
        <button
          onClick={() => setActiveTab('collect')}
          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition flex-1 whitespace-nowrap ${
            activeTab === 'collect'
              ? 'bg-primary text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <i className="fas fa-hand-holding-dollar"></i>
          <span>Tournée & Encaissements</span>
          {pendingClientsCount > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'collect' ? 'bg-white text-primary' : 'bg-rose-100 text-rose-700'
            }`}>
              {pendingClientsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('properties')}
          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition flex-1 whitespace-nowrap ${
            activeTab === 'properties'
              ? 'bg-primary text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <i className="fas fa-city"></i>
          <span>Logements & Biens</span>
          {vacantPropertiesCount > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'properties' ? 'bg-white text-primary' : 'bg-emerald-100 text-emerald-700'
            }`}>
              {vacantPropertiesCount} vacants
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('repairs')}
          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition flex-1 whitespace-nowrap ${
            activeTab === 'repairs'
              ? 'bg-primary text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <i className="fas fa-wrench"></i>
          <span>Réparations & Déductions</span>
          {repairsList.filter(r => r.status === 'IN_PROGRESS').length > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'repairs' ? 'bg-white text-primary' : 'bg-amber-100 text-amber-800'
            }`}>
              {repairsList.filter(r => r.status === 'IN_PROGRESS').length}
            </span>
          )}
        </button>
      </div>

      {/* Barre de recherche contextuelle */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none"></i>
            <input
              type="text"
              placeholder={
                activeTab === 'collect'
                  ? 'Rechercher un locataire, tél, logement...'
                  : activeTab === 'properties'
                    ? 'Rechercher un logement, adresse...'
                    : 'Rechercher une réparation, locataire...'
              }
              value={searchTerm}
              onChange={(e) => {
                const p = new URLSearchParams(searchParams);
                if (e.target.value) p.set('search', e.target.value);
                else p.delete('search');
                setSearchParams(p);
              }}
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20 transition"
            />
          </div>

          {activeTab === 'collect' && (
            <div className="flex rounded-xl border border-slate-200 overflow-hidden shrink-0">
              <button
                onClick={() => setClientFilter('all')}
                className={`px-3 py-2 text-xs font-bold transition ${clientFilter === 'all' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                Tous ({displayedClients.length})
              </button>
              <button
                onClick={() => setClientFilter('pending')}
                className={`px-3 py-2 text-xs font-bold transition border-l border-slate-200 ${clientFilter === 'pending' ? 'bg-rose-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                À encaisser ({displayedClients.filter(c => (c.amount_due ?? 0) - (c.amount_paid ?? 0) > 0).length})
              </button>
              <button
                onClick={() => setClientFilter('settled')}
                className={`px-3 py-2 text-xs font-bold transition border-l border-slate-200 ${clientFilter === 'settled' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                Soldés
              </button>
            </div>
          )}

          {activeTab === 'properties' && (
            <div className="flex rounded-xl border border-slate-200 overflow-hidden shrink-0">
              <button
                onClick={() => setPropertyStatusFilter('all')}
                className={`px-3 py-2 text-xs font-bold transition ${propertyStatusFilter === 'all' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                Tous ({properties.length})
              </button>
              <button
                onClick={() => setPropertyStatusFilter('vacant')}
                className={`px-3 py-2 text-xs font-bold transition border-l border-slate-200 ${propertyStatusFilter === 'vacant' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                Vacants ({vacantPropertiesCount})
              </button>
              <button
                onClick={() => setPropertyStatusFilter('loue')}
                className={`px-3 py-2 text-xs font-bold transition border-l border-slate-200 ${propertyStatusFilter === 'loue' ? 'bg-primary text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                Loués
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CONTENU ONGLET 1 : TOURNÉE & ENCAISSEMENTS                                */}
      {/* ========================================================================= */}
      {activeTab === 'collect' && (
        <div className="space-y-4">
          {clientsLoading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center justify-center gap-3">
              <i className="fas fa-spinner fa-spin text-primary text-2xl"></i>
              <span className="text-sm text-slate-500">Chargement de votre tournée...</span>
            </div>
          ) : displayedClients.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayedClients.map((client) => {
                const due = client.amount_due ?? client.amountDue ?? 0;
                const paid = client.amount_paid ?? client.amountPaid ?? 0;
                const remaining = Math.max(0, due - paid);
                const isSettled = remaining <= 0;
                const clientName = `${client.last_name ?? client.lastName ?? ''} ${client.first_name ?? client.firstName ?? ''}`.trim() || 'Locataire';
                const propertyTitle = client.property_title || client.propertyName || client.address || 'Logement non assigné';
                const phone = client.phone || client.telephone || '';

                // Données de réparation active et déduction
                const activeRepairRemaining = parseFloat(client.active_repair_remaining || 0);
                const activeRepairDeduction = parseFloat(client.active_repair_deduction || 0);
                const isImmediate = client.active_repair_mode === 'immediate';
                const repairDeduction = activeRepairRemaining > 0
                  ? (isImmediate ? Math.min(remaining, activeRepairRemaining) : Math.min(remaining, activeRepairDeduction > 0 ? activeRepairDeduction : activeRepairRemaining))
                  : 0;
                const netCollectible = Math.max(0, remaining - repairDeduction);

                return (
                  <div
                    key={client.id}
                    className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 flex flex-col justify-between gap-3.5 hover:border-primary/40 transition-all"
                  >
                    {/* Entête Carte */}
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0 border border-primary/20">
                            {(client.last_name ?? client.lastName ?? '?').slice(0, 1).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-slate-900 text-sm truncate">{clientName}</h3>
                            <p className="text-xs text-slate-500 truncate flex items-center gap-1 mt-0.5" title={propertyTitle}>
                              <i className="fas fa-home text-slate-400 text-[10px]"></i>
                              <span className="truncate">{propertyTitle}</span>
                            </p>
                          </div>
                        </div>

                        {phone && (
                          <a
                            href={`tel:${phone.replace(/\s+/g, '')}`}
                            className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center active:scale-95 transition shrink-0"
                            title={`Appeler ${phone}`}
                          >
                            <i className="fas fa-phone text-xs"></i>
                          </a>
                        )}
                      </div>

                      {/* Encart Déduction Réparation si active */}
                      {activeRepairRemaining > 0 && !isSettled && (
                        <div className="mt-3 bg-amber-50 rounded-xl border border-amber-200/80 p-2.5 text-xs space-y-1">
                          <div className="flex items-center justify-between font-bold text-amber-900">
                            <span className="flex items-center gap-1 text-[11px]">
                              <i className="fas fa-wrench text-amber-600"></i>
                              Déduction réparation :
                            </span>
                            <span className="text-rose-600 font-extrabold">-{formatXOF(repairDeduction)}</span>
                          </div>
                          <p className="text-[10px] text-amber-800 truncate">
                            {client.active_repair_desc || 'Travaux locataire'} (Reste : {formatXOF(activeRepairRemaining)})
                          </p>
                        </div>
                      )}

                      {/* Synthèse Financière Loyer */}
                      <div className="mt-3 grid grid-cols-2 gap-2 bg-slate-50 rounded-xl p-2.5 border border-slate-100 text-xs">
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Loyer dû</span>
                          <span className="font-semibold text-slate-700">{formatXOF(due)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
                            {repairDeduction > 0 ? 'Net à encaisser' : 'Reste à payer'}
                          </span>
                          {isSettled ? (
                            <span className="font-bold text-emerald-600 flex items-center justify-end gap-1">
                              <i className="fas fa-check-circle text-[10px]"></i> À jour
                            </span>
                          ) : (
                            <span className="font-extrabold text-rose-600 text-sm">
                              {formatXOF(repairDeduction > 0 ? netCollectible : remaining)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Boutons d'Action Opérationnels Terrain */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      {!isSettled ? (
                        <button
                          onClick={() => handleOpenPayment(client)}
                          className="w-full py-2.5 px-4 bg-primary text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm shadow-primary/20 hover:bg-primary-dark active:scale-[0.98] transition flex items-center justify-center gap-2"
                        >
                          <i className="fas fa-hand-holding-dollar"></i>
                          <span>Encaisser {repairDeduction > 0 ? formatXOF(netCollectible) : formatXOF(remaining)}</span>
                        </button>
                      ) : (
                        <div className="w-full py-2 px-3 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 border border-emerald-200">
                          <i className="fas fa-check-double text-emerald-500"></i>
                          Loyer soldé
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleOpenRepair(client)}
                          className="py-1.5 px-2.5 bg-slate-100 hover:bg-amber-50 hover:text-amber-800 text-slate-600 text-[11px] font-semibold rounded-lg transition border border-slate-200 flex items-center justify-center gap-1.5"
                          title="Enregistrer des travaux de réparation engagés par le locataire"
                        >
                          <i className="fas fa-wrench text-amber-600 text-[10px]"></i>
                          Réparation
                        </button>

                        <button
                          onClick={() => handleOpenDeparture(client)}
                          className="py-1.5 px-2.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 text-[11px] font-semibold rounded-lg transition border border-slate-200 flex items-center justify-center gap-1.5"
                          title="Signaler le départ du locataire et libérer le logement"
                        >
                          <i className="fas fa-door-open text-rose-600 text-[10px]"></i>
                          Départ / Libérer
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-2">
              <i className="fas fa-users text-slate-300 text-3xl"></i>
              <p className="font-bold text-slate-700">Aucun locataire ne correspond à vos critères</p>
              <p className="text-xs text-slate-400">Modifiez les filtres de recherche ou actualisez.</p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* CONTENU ONGLET 2 : LOGEMENTS & ATTRIBUTION BIENS VACANTS                   */}
      {/* ========================================================================= */}
      {activeTab === 'properties' && (
        <div className="space-y-4">
          {propertiesLoading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center justify-center gap-3">
              <i className="fas fa-spinner fa-spin text-primary text-2xl"></i>
              <span className="text-sm text-slate-500">Chargement des logements...</span>
            </div>
          ) : displayedProperties.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayedProperties.map((prop) => {
                const isVacant = prop.status === 'vacant';
                const tenantName = prop.tenant_first_name || prop.tenant_last_name
                  ? `${prop.tenant_last_name || ''} ${prop.tenant_first_name || ''}`.trim()
                  : null;

                return (
                  <div
                    key={prop.id}
                    className={`bg-white rounded-2xl border p-4 flex flex-col justify-between gap-3 shadow-sm transition ${
                      isVacant ? 'border-emerald-300/80 bg-emerald-50/20' : 'border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-bold text-slate-900 text-sm">{prop.name}</h3>
                          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            <i className="fas fa-location-dot text-slate-400 text-[10px]"></i>
                            <span>{prop.address || 'Sans adresse'}</span>
                          </p>
                        </div>

                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border shrink-0 ${
                          isVacant
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            : 'bg-primary/10 text-primary border-primary/20'
                        }`}>
                          {isVacant ? 'VACANT (VIDE)' : 'LOUÉ'}
                        </span>
                      </div>

                      <div className="mt-3.5 bg-slate-50 rounded-xl p-2.5 border border-slate-100 text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Loyer mensuel :</span>
                          <span className="font-bold text-slate-800">{formatXOF(prop.rent || 0)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Occupant actuel :</span>
                          <span className="font-semibold text-slate-700">
                            {isVacant ? <span className="text-emerald-700 font-bold">Aucun (Disponible)</span> : (tenantName || 'Locataire')}
                          </span>
                        </div>
                        {prop.owner_last_name && (
                          <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[11px] text-slate-500">
                            <span>Propriétaire :</span>
                            <span className="font-medium text-slate-600">{prop.owner_last_name} {prop.owner_first_name || ''}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action d'attribution si le bien est vacant */}
                    <div className="pt-2 border-t border-slate-100">
                      {isVacant ? (
                        <button
                          onClick={() => handleOpenAssign(prop)}
                          className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition flex items-center justify-center gap-2"
                        >
                          <i className="fas fa-key"></i>
                          <span>Attribuer ce logement</span>
                        </button>
                      ) : (
                        <div className="w-full py-2 px-3 bg-slate-100 text-slate-500 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5">
                          <i className="fas fa-user-check text-slate-400"></i>
                          Logement occupé
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-2">
              <i className="fas fa-city text-slate-300 text-3xl"></i>
              <p className="font-bold text-slate-700">Aucun logement trouvé</p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* CONTENU ONGLET 3 : RÉPARATIONS & DÉDUCTIONS                                */}
      {/* ========================================================================= */}
      {activeTab === 'repairs' && (
        <div className="space-y-4">
          <div className="bg-amber-50 rounded-2xl border border-amber-200/90 p-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <i className="fas fa-info-circle text-base"></i>
            </div>
            <div className="text-xs text-amber-900 leading-relaxed">
              <span className="font-bold block text-sm mb-0.5">Fonctionnement des réparations locataire :</span>
              Lorsqu'un locataire engage des dépenses pour des réparations (plomberie, toiture, électricité...), elles sont enregistrées ici.
              Le loyer du locataire est automatiquement réduit chaque mois à concurrence de la déduction convenue jusqu'à remboursement / épongement total du montant.
            </div>
          </div>

          {repairsLoading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center justify-center gap-3">
              <i className="fas fa-spinner fa-spin text-primary text-2xl"></i>
              <span className="text-sm text-slate-500">Chargement des réparations...</span>
            </div>
          ) : repairsList.length > 0 ? (
            <div className="space-y-3">
              {repairsList.map((rep) => {
                const totalCost = parseFloat(rep.total_cost || 0);
                const reimbursed = parseFloat(rep.reimbursed_amount || 0);
                const remaining = parseFloat(rep.remaining_amount || 0);
                const isSettled = rep.status === 'SETTLED' || remaining <= 0;
                const clientName = `${rep.client_last_name || ''} ${rep.client_first_name || ''}`.trim() || 'Locataire';

                return (
                  <div
                    key={rep.id}
                    className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm">{rep.description}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                          isSettled
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            : 'bg-amber-100 text-amber-800 border-amber-200'
                        }`}>
                          {isSettled ? 'SOLDÉ / REMBOURSÉ' : "EN COURS D'ÉPONGEMENT"}
                        </span>
                        {rep.receipt_ref && (
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-mono">
                            {rep.receipt_ref}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                        <span>Locataire : <strong className="text-slate-700">{clientName}</strong></span>
                        {rep.property_name && (
                          <span>&bull; Logement : <strong className="text-slate-700">{rep.property_name}</strong></span>
                        )}
                        <span>&bull; Date : {new Date(rep.repair_date).toLocaleDateString('fr-FR')}</span>
                      </p>

                      <div className="flex items-center gap-4 text-xs pt-1">
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase">Coût total travaux</span>
                          <span className="font-bold text-slate-800">{formatXOF(totalCost)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase">Déjà déduit sur loyers</span>
                          <span className="font-bold text-emerald-600">{formatXOF(reimbursed)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase">Reste à éponger</span>
                          <span className={`font-black ${remaining > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {formatXOF(remaining)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0">
                      {!isSettled && (
                        <button
                          onClick={() => handleSettleRepair(rep)}
                          className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                          title="Solder manuellement cette réparation"
                        >
                          <i className="fas fa-check-double text-xs"></i>
                          <span>Solder</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-2">
              <i className="fas fa-wrench text-slate-300 text-3xl"></i>
              <p className="font-bold text-slate-700">Aucune réparation enregistrée</p>
              <p className="text-xs text-slate-400">
                Vous pouvez ajouter une réparation pour un locataire directement depuis l'onglet "Tournée & Encaissements".
              </p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALES TACTILES DU COLLECTEUR                                            */}
      {/* ========================================================================= */}
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

      <TenantDepartureModal
        isOpen={activeModal === 'departure'}
        onClose={() => { setActiveModal(null); setSelectedClient(null); }}
        client={selectedClient}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['clients'] });
          queryClient.invalidateQueries({ queryKey: ['properties'] });
        }}
      />

      <TenantRepairModal
        isOpen={activeModal === 'repair'}
        onClose={() => { setActiveModal(null); setSelectedClient(null); }}
        client={selectedClient}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['clients'] });
          fetchRepairs();
        }}
      />

      <AssignPropertyModal
        isOpen={activeModal === 'assign'}
        onClose={() => { setActiveModal(null); setSelectedProperty(null); }}
        property={selectedProperty}
        clients={clients}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['clients'] });
          queryClient.invalidateQueries({ queryKey: ['properties'] });
        }}
      />
    </div>
  );
}
