import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useOverdueAlerts,
  useAcknowledgeAlert,
} from '../hooks/queries/useNotifications';
import { formatDate, formatXOF } from '../utils/formatters';

const TYPE_CONFIG = {
  SUCCESS: { icon: 'fa-circle-check', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  INFO: { icon: 'fa-circle-info', color: 'text-sky-600', bg: 'bg-sky-50 border-sky-200' },
  WARNING: { icon: 'fa-triangle-exclamation', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  ERROR: { icon: 'fa-circle-xmark', color: 'text-rose-600', bg: 'bg-rose-50 border-rose-200' },
};

export default function Notifications() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Navigation par onglet : 'alerts' (Impayés & Recouvrement) ou 'system' (Événements)
  const defaultTab = searchParams.get('tab') || 'alerts';
  const [activeTab, setActiveTab] = useState(defaultTab);

  // État filtres pour Alertes d'impayés
  const [alertSeverityFilter, setAlertSeverityFilter] = useState('all');
  const [alertSearchQuery, setAlertSearchQuery] = useState('');

  // État filtres pour Notifications système
  const [filterRead, setFilterRead] = useState('all'); // 'all' | 'unread' | 'read'
  const [filterCategory, setFilterCategory] = useState('all');

  // Queries
  const { 
    data: notifData = {}, 
    isLoading: isNotifLoading, 
    refetch: refetchNotifs 
  } = useNotifications({
    isRead: filterRead === 'unread' ? false : filterRead === 'read' ? true : undefined,
    category: filterCategory !== 'all' ? filterCategory : undefined,
  });

  const {
    data: alertsData = {},
    isLoading: isAlertsLoading,
    refetch: refetchAlerts,
  } = useOverdueAlerts();

  const notifications = notifData.notifications || [];
  const unreadCount = notifData.unreadCount || 0;

  const overdueAlerts = alertsData.alerts || [];
  const overdueStats = alertsData.stats || {};
  const overdueCount = alertsData.count ?? overdueAlerts.length;

  const markReadMutation = useMarkNotificationRead();
  const markAllMutation = useMarkAllNotificationsRead();
  const acknowledgeMutation = useAcknowledgeAlert();

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.is_read) {
      await markReadMutation.mutateAsync(notif.id);
    }
    if (notif.reference_link) {
      navigate(notif.reference_link);
    }
  };

  // Filtrage des alertes d'impayés
  const filteredAlerts = overdueAlerts.filter((alert) => {
    // Filtre par sévérité
    if (alertSeverityFilter !== 'all' && alert.severity !== alertSeverityFilter) {
      return false;
    }
    // Filtre par texte de recherche
    if (alertSearchQuery.trim()) {
      const q = alertSearchQuery.toLowerCase();
      const clientName = `${alert.first_name || ''} ${alert.last_name || ''}`.toLowerCase();
      const propName = (alert.property_name || '').toLowerCase();
      const phone = (alert.phone || '').toLowerCase();
      return clientName.includes(q) || propName.includes(q) || phone.includes(q);
    }
    return true;
  });

  const totalOverdueAmount = overdueStats.totalAmount ?? overdueAlerts.reduce(
    (sum, a) => sum + (Number(a.amount_owed) || 0), 0
  );
  const critiqueCount = overdueStats.bySeverity?.critique ?? overdueAlerts.filter(a => a.severity === 'critique').length;
  const hauteCount = overdueStats.bySeverity?.haute ?? overdueAlerts.filter(a => a.severity === 'haute').length;

  const handleRefreshAll = () => {
    refetchNotifs();
    refetchAlerts();
  };

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden box-border">
      {/* EN-TÊTE DE PAGE */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <span className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-2xs">
            <i className="fas fa-bell text-xl"></i>
          </span>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Centre de Notifications & Alertes Métier
              </h1>
              {overdueCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500 text-white animate-pulse shadow-xs">
                  {overdueCount} impayé{overdueCount > 1 ? 's' : ''} à relancer
                </span>
              )}
              {unreadCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-500 text-white shadow-xs">
                  {unreadCount} événement{unreadCount > 1 ? 's' : ''} non lu{unreadCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Pilotage consolidé des alertes d'exploitation, relances loyers et confirmations du système.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {activeTab === 'system' && unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markAllMutation.mutate()}
              disabled={markAllMutation.isPending}
              className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <i className="fas fa-check-double text-slate-400"></i>
              <span>Tout marquer comme lu</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleRefreshAll}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <i className="fas fa-rotate text-slate-400"></i>
            <span>Actualiser</span>
          </button>
        </div>
      </div>

      {/* SÉLECTEUR D'ONGLETS MAJEURS (Alertes vs Système) */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => handleTabChange('alerts')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2.5 cursor-pointer ${
            activeTab === 'alerts'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <i className="fas fa-triangle-exclamation"></i>
          <span>Alertes Impayés & Recouvrement</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${
            activeTab === 'alerts' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-700'
          }`}>
            {overdueCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('system')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2.5 cursor-pointer ${
            activeTab === 'system'
              ? 'bg-primary text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <i className="fas fa-bell"></i>
          <span>Événements & Confirmations Système</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${
            activeTab === 'system' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            {notifications.length}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* ONGLET 1 : ALERTES IMPAYÉS & RECOUVREMENT (Les 14 alertes du badge cloche) */}
      {/* ========================================================================= */}
      {activeTab === 'alerts' && (
        <div className="space-y-6">
          {/* 4 CARTES KPI SYNTHÈSE DES IMPAYÉS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-rose-200/70 rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-rose-600 text-xs font-semibold">
                <span>Total Impayés Cumulés</span>
                <i className="fas fa-coins text-sm"></i>
              </div>
              <div className="text-xl sm:text-2xl font-black text-rose-700 mt-2">
                {formatXOF(totalOverdueAmount, { compact: false })}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Créances loyers échues et exigibles</p>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-slate-600 text-xs font-semibold">
                <span>Dossiers Critiques (&gt; 2 mois)</span>
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
                {critiqueCount}
              </div>
              <p className="text-[11px] text-rose-600 font-medium mt-1">Mise en demeure requise</p>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-slate-600 text-xs font-semibold">
                <span>Dossiers Prioritaires</span>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
                {hauteCount}
              </div>
              <p className="text-[11px] text-amber-600 font-medium mt-1">Relances amiables en cours</p>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-slate-600 text-xs font-semibold">
                <span>Dossiers en Alerte Active</span>
                <i className="fas fa-users text-sm text-slate-400"></i>
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
                {overdueCount}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Locataires en situation d'arriéré</p>
            </div>
          </div>

          {/* BARRE DE FILTRES DES ALERTES */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200/80 rounded-xl p-3 shadow-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setAlertSeverityFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  alertSeverityFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Tous les impayés ({overdueAlerts.length})
              </button>
              <button
                type="button"
                onClick={() => setAlertSeverityFilter('critique')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  alertSeverityFilter === 'critique'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                }`}
              >
                Critiques ({critiqueCount})
              </button>
              <button
                type="button"
                onClick={() => setAlertSeverityFilter('haute')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  alertSeverityFilter === 'haute'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                }`}
              >
                Hautes ({hauteCount})
              </button>
              <button
                type="button"
                onClick={() => setAlertSeverityFilter('normale')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  alertSeverityFilter === 'normale'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-sky-50 text-sky-800 hover:bg-sky-100'
                }`}
              >
                Normales ({overdueAlerts.filter(a => a.severity === 'normale').length})
              </button>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                <input
                  type="text"
                  placeholder="Rechercher locataire, bien, tél..."
                  value={alertSearchQuery}
                  onChange={(e) => setAlertSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <button
                type="button"
                onClick={() => navigate('/admin/reports?tab=overdue')}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
                title="Consulter le rapport complet de relance"
              >
                <i className="fas fa-table-list text-slate-400"></i>
                <span className="hidden md:inline">Plan de relance</span>
              </button>
            </div>
          </div>

          {/* LISTE DES ALERTES D'IMPAYÉS */}
          <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden divide-y divide-slate-100">
            {isAlertsLoading ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <i className="fas fa-spinner fa-spin mr-2"></i> Chargement des alertes d'exploitation...
              </div>
            ) : filteredAlerts.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs space-y-2">
                <i className="fas fa-shield-halved text-3xl mb-1 text-emerald-400 block"></i>
                <div className="font-semibold text-slate-700">Aucun dossier d'impayé correspondant</div>
                <p className="text-slate-400">Tous les loyers de cette sélection sont à jour.</p>
              </div>
            ) : (
              filteredAlerts.map((alert) => {
                const clientName = (alert.first_name || alert.last_name)
                  ? `${alert.first_name || ''} ${alert.last_name || ''}`.trim()
                  : alert.client_name || alert.clientName || 'Locataire';
                const isCritique = alert.severity === 'critique';
                const isHaute = alert.severity === 'haute';
                const amountOwed = Number(alert.amount_owed) || Number(alert.rent_due) || 0;

                return (
                  <div
                    key={alert.id || Math.random()}
                    className={`p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors hover:bg-slate-50/80 ${
                      isCritique ? 'bg-rose-50/25' : isHaute ? 'bg-amber-50/15' : 'bg-white'
                    }`}
                  >
                    {/* INFOS LOCATAIRE & BIEN */}
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                        isCritique 
                          ? 'bg-rose-100 text-rose-700 border-rose-200' 
                          : isHaute 
                            ? 'bg-amber-100 text-amber-700 border-amber-200' 
                            : 'bg-sky-100 text-sky-700 border-sky-200'
                      }`}>
                        <i className={`fas ${isCritique ? 'fa-triangle-exclamation' : 'fa-clock'} text-base`}></i>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-slate-900">{clientName}</span>
                          <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${
                            isCritique
                              ? 'bg-rose-100 text-rose-700 border-rose-200'
                              : isHaute
                                ? 'bg-amber-100 text-amber-800 border-amber-200'
                                : 'bg-sky-100 text-sky-800 border-sky-200'
                          }`}>
                            {alert.severity || 'Impayé'}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                            Statut bail : {alert.status || 'Actif'}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 mt-1.5">
                          <span className="flex items-center gap-1.5">
                            <i className="fas fa-building text-slate-400 text-[11px]"></i>
                            <span className="font-medium text-slate-800">{alert.property_name || 'Bien non spécifié'}</span>
                          </span>
                          {alert.phone && (
                            <a
                              href={`tel:${alert.phone}`}
                              className="flex items-center gap-1 text-primary hover:underline font-medium"
                            >
                              <i className="fas fa-phone text-[10px]"></i>
                              <span>{alert.phone}</span>
                            </a>
                          )}
                          {(alert.owner_first_name || alert.owner_last_name) && (
                            <span className="text-slate-400">
                              Bailleur : <span className="text-slate-600 font-medium">{alert.owner_first_name} {alert.owner_last_name}</span>
                            </span>
                          )}
                        </div>

                        {alert.last_payment_date && (
                          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
                            <i className="fas fa-calendar-check text-[10px]"></i>
                            <span>Dernier encaissement : {formatDate(alert.last_payment_date)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* MONTANT RESTANT DÛ & ACTIONS */}
                    <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                      <div className="text-left md:text-right">
                        <div className="text-xs text-slate-400 font-medium">Reste à payer</div>
                        <div className="text-base sm:text-lg font-black text-rose-600">
                          {formatXOF(amountOwed, { compact: false })}
                        </div>
                        {alert.rent_due && (
                          <div className="text-[10px] text-slate-400">
                            Loyer contractuel : {formatXOF(alert.rent_due)}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/transactions?clientId=${alert.id}`)}
                          className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                          title="Encaisser ou régulariser ce loyer"
                        >
                          <i className="fas fa-money-bill-wave text-[10px]"></i>
                          <span>Encaisser</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/clients?id=${alert.id}`)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                          title="Voir le dossier locataire"
                        >
                          <i className="fas fa-user text-xs"></i>
                        </button>
                        <button
                          type="button"
                          onClick={() => acknowledgeMutation.mutate(alert.id)}
                          disabled={acknowledgeMutation.isPending}
                          className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                          title="Reconnaître cette alerte"
                        >
                          <i className="fas fa-check text-xs"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 2 : ÉVÉNEMENTS & CONFIRMATIONS SYSTÈME (user_notifications)         */}
      {/* ========================================================================= */}
      {activeTab === 'system' && (
        <div className="space-y-6">
          {/* FILTRES RAPIDES SYSTÈME */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200/80 rounded-xl p-3 shadow-xs">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFilterRead('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  filterRead === 'all'
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Toutes ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterRead('unread')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  filterRead === 'unread'
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Non lues ({unreadCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterRead('read')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  filterRead === 'read'
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Déjà lues
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Catégorie :</span>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none"
              >
                <option value="all">Toutes les catégories</option>
                <option value="PROPERTY">Biens immobiliers</option>
                <option value="OWNER">Propriétaires bailleurs</option>
                <option value="ASSIGNMENT">Attributions de biens</option>
                <option value="SYSTEM">Système & Alertes</option>
              </select>
            </div>
          </div>

          {/* LISTE DES NOTIFICATIONS SYSTÈME */}
          <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden divide-y divide-slate-100">
            {isNotifLoading ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <i className="fas fa-spinner fa-spin mr-2"></i> Chargement des notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs space-y-2">
                <i className="fas fa-bell-slash text-3xl mb-1 text-slate-300 block"></i>
                <div className="font-semibold text-slate-600">Aucune notification système pour le moment</div>
                <p className="text-slate-400">
                  Toutes vos confirmations d'enregistrement, mandats et attributions apparaîtront ici.
                </p>
              </div>
            ) : (
              notifications.map((notif) => {
                const config = TYPE_CONFIG[notif.type] || TYPE_CONFIG.INFO;
                const isUnread = !notif.is_read;

                return (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-4 flex items-start justify-between gap-4 transition-colors cursor-pointer hover:bg-slate-50 ${
                      isUnread ? 'bg-sky-50/30' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${config.bg} ${config.color}`}
                      >
                        <i className={`fas ${config.icon} text-sm`}></i>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-900">{notif.title}</span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                            {notif.category}
                          </span>
                          {isUnread && (
                            <span className="w-2 h-2 rounded-full bg-primary shrink-0" title="Non lu"></span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">{notif.message}</p>
                        <div className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-2">
                          <i className="fas fa-clock text-[10px]"></i>
                          <span>
                            {formatDate(notif.created_at, {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {notif.reference_link && (
                            <>
                              <span>•</span>
                              <span className="text-primary hover:underline font-medium flex items-center gap-1">
                                <span>Accéder</span>
                                <i className="fas fa-arrow-right text-[9px]"></i>
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {isUnread && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            markReadMutation.mutate(notif.id);
                          }}
                          className="text-xs text-slate-400 hover:text-slate-600 p-1.5 rounded-md hover:bg-slate-100 cursor-pointer"
                          title="Marquer comme lu"
                        >
                          <i className="fas fa-check"></i>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
