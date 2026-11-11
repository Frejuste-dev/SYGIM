/**
 * SYGIM - Page Manager (Supervision des Collecteurs)
 * Dashboard de coordination : portefeuilles, attributions de biens, performances
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useCollectors } from '../hooks/queries/useCollectors';
import { useProperties, usePropertyStats } from '../hooks/queries/useProperties';
import { useClients } from '../hooks/queries/useClients';
import { useTransactions } from '../hooks/queries/useTransactions';
import { API } from '../api/services';
import { useToast } from '../components/ToastContext';
import { useDashboardKpis } from '../hooks/queries/useDashboardKpis';
import { formatXOF } from '../utils/formatters';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const getN = (obj, camel, snake) => Number(obj?.[camel] ?? obj?.[snake] ?? 0);
const getCollectorId = item => Number(item?.collectorId ?? item?.collector_id ?? 0);
const getName = c => `${c?.last_name ?? c?.lastName ?? ''} ${c?.first_name ?? c?.firstName ?? ''}`.trim();
const getInitials = c => {
  const ln = (c?.last_name ?? c?.lastName ?? '').slice(0, 1).toUpperCase();
  const fn = (c?.first_name ?? c?.firstName ?? '').slice(0, 1).toUpperCase();
  return ln + fn || '?';
};

const PAID_STATUSES = new Set(['processed', 'paid', 'completed', 'success']);
const TABS = [
  { key: 'collectors', icon: 'fa-users',      label: 'Portefeuilles' },
  { key: 'assignment', icon: 'fa-handshake',   label: 'Attributions' },
  { key: 'performance', icon: 'fa-chart-line', label: 'Performances' },
  { key: 'reports',    icon: 'fa-file-invoice', label: 'Rapports & Décomptes' },
];

// â”€â”€â”€ Sous-composant : KPI card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ Sous-composant : Barre de progression â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ProgressBar({ rate }) {
  const color = rate >= 80 ? 'bg-emerald-500' : rate >= 50 ? 'bg-amber-400' : 'bg-rose-500';
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${Math.min(100, rate)}%` }}></div>
      </div>
      <span className={`text-xs font-bold tabular-nums ${rate >= 80 ? 'text-emerald-600' : rate >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
        {rate}%
      </span>
    </div>
  );
}

// â”€â”€â”€ Composant principal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function Manager() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  // Données
  const { data: collectorsResult = {}, isLoading: collectorsLoading } = useCollectors();
  const collectors = useMemo(() => collectorsResult.data || [], [collectorsResult]);

  const { data: propertiesResult = {} } = useProperties({ limit: 50 });
  const properties = useMemo(() => propertiesResult.data || [], [propertiesResult]);

  const { data: propStats = {} } = usePropertyStats();

  const { data: clientsResult = {} } = useClients();
  const clients = useMemo(() => clientsResult.data || [], [clientsResult]);

  const { data: transactionsResult = {} } = useTransactions({ limit: 50 });
  const { data: kpis = {} } = useDashboardKpis();
  const transactions = useMemo(() => transactionsResult.data || [], [transactionsResult]);

  // UI state
  const [activeTab, setActiveTab] = useState('collectors');
  const [selectedCollectorId, setSelectedCollectorId] = useState('');
  const [assignSearch, setAssignSearch] = useState('');
  const [overdueAlerts, setOverdueAlerts] = useState([]);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [assigningPropertyIds, setAssigningPropertyIds] = useState([]);
  const [acknowledgingAlertIds, setAcknowledgingAlertIds] = useState([]);
  const assigningRef = useRef(new Set());
  const ackRef = useRef(new Set());

  useEffect(() => {
    API.Alerts.getOverduePayments()
      .then(res => { if (res?.success) setOverdueAlerts(res.data || []); })
      .catch(() => {});
  }, []);

  // ─── KPIs globaux ──────────────────────────────────────────
  const totalDueAll = kpis.totalDue || 0;
  const totalCollectedAll = kpis.totalRevenue || 0;
  const globalRate = kpis.collectionRate || 0;
  const unassignedCount = kpis.unassignedPropertiesCount ?? properties.filter(p => !(p.collectorId || p.collector_id)).length;
  const urgentAlerts = overdueAlerts.filter(a => a.severity === 'critique' || a.severity === 'haute');

  // â”€â”€â”€ Handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleAssignProperty = async (propertyId) => {
    if (assigningRef.current.has(propertyId)) return;
    if (!selectedCollectorId) {
      showToast({ type: 'warning', message: 'Selectionnez un recolteur avant d\'attribuer un bien.' });
      return;
    }
    const collectorId = Number(selectedCollectorId);
    const col = collectors.find(c => Number(c.id) === collectorId);
    const colName = col ? getName(col) : 'ce recolteur';

    assigningRef.current.add(propertyId);
    setAssigningPropertyIds(prev => [...prev, propertyId]);
    try {
      const resp = await API.Collectors.assignProperties(selectedCollectorId, [propertyId]);
      if (resp.success) {
        queryClient.invalidateQueries({ queryKey: ['collectors'] });
        queryClient.invalidateQueries({ queryKey: ['properties'] });
        showToast({ type: 'success', message: `Bien attribue a ${colName}.` });
      } else {
        showToast({ type: 'error', message: `Erreur : ${resp.error || 'operation impossible.'}` });
      }
    } catch (err) {
      showToast({ type: 'error', message: `Erreur reseau : ${err.message}` });
    } finally {
      assigningRef.current.delete(propertyId);
      setAssigningPropertyIds(prev => prev.filter(id => id !== propertyId));
    }
  };

  const handleAcknowledgeAlert = async (alertId) => {
    if (ackRef.current.has(alertId)) return;
    const alert = overdueAlerts.find(a => a.id === alertId);
    const clientName = alert ? `${alert.first_name || ''} ${alert.last_name || ''}`.trim() : 'ce locataire';
    ackRef.current.add(alertId);
    setAcknowledgingAlertIds(prev => [...prev, alertId]);
    try {
      await API.Alerts.acknowledge(alertId);
      setOverdueAlerts(prev => prev.filter(a => a.id !== alertId));
      showToast({ type: 'success', message: `Alerte de ${clientName} marquee comme traitee.` });
    } catch (err) {
      showToast({ type: 'error', message: `Impossible de traiter l'alerte : ${err.message}` });
    } finally {
      ackRef.current.delete(alertId);
      setAcknowledgingAlertIds(prev => prev.filter(id => id !== alertId));
    }
  };

  // --- Données par collecteur -----------------------------------------
  const collectorsWithStats = useMemo(() => {
    return collectors.map(col => {
      const totalDue = Number(col.totalDue || 0);
      const totalCollected = Number(col.totalCollected || 0);
      const rate = totalDue > 0
        ? Math.min(100, Math.max(0, Math.round((totalCollected / totalDue) * 100)))
        : null;
      return { 
        ...col, 
        assignedPropsCount: col.assignedPropsCount || 0, 
        assignedClientsCount: col.assignedClientsCount || 0, 
        totalDue, 
        totalCollected, 
        rate 
      };
    }).sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1));
  }, [collectors]);

  // Biens non attribués (pour onglet Attributions)
  const unassignedProperties = useMemo(() => {
    const term = assignSearch.toLowerCase();
    return properties
      .filter(p => !(p.collectorId || p.collector_id))
      .filter(p => !term
        || (p.name || '').toLowerCase().includes(term)
        || (p.address || '').toLowerCase().includes(term)
        || (p.type || '').toLowerCase().includes(term)
      );
  }, [properties, assignSearch]);

  const selectedCollector = collectors.find(c => Number(c.id) === Number(selectedCollectorId));
  const periodLabel = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date());

  // â”€â”€â”€ RENDER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div className="p-6 md:p-8 space-y-6 min-h-full">

      {/* En-tete */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Supervision des Collecteurs</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Portefeuilles, attributions et performances &mdash; {periodLabel}
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-500 font-semibold"><i className="fas fa-filter mr-1"></i>Période :</label>
            <select className="bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg focus:ring-primary/20 focus:border-primary block p-2 transition-all shadow-sm">
              <option>Ce mois-ci</option>
              <option>Aujourd'hui</option>
              <option>Cette semaine</option>
              <option>Cette année</option>
              <option>Global</option>
            </select>
          </div>
          
          <button
            type="button"
            onClick={() => navigate('/admin/reports')}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 text-sm font-semibold rounded-xl hover:bg-indigo-100 transition-colors shadow-2xs"
            title="Consulter tous les rapports et bordereaux officiels"
          >
            <i className="fas fa-file-invoice text-sm"></i>
            Rapports &amp; Décomptes
          </button>

          {activeTab !== 'assignment' && (
            <button
              onClick={() => setActiveTab('assignment')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary-dark shadow-sm shadow-primary/20 transition-colors"
            >
              <i className="fas fa-handshake text-sm"></i>
              Attribuer un bien
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <KpiCard
          label="Collecteurs actifs"
          value={collectors.length}
          icon="fa-users"
          colorClass="text-primary" bgClass="bg-primary/10"
        />
        <KpiCard
          label="Total encaisse (global)"
          value={formatXOF(totalCollectedAll)}
          icon="fa-money-bill-wave"
          colorClass="text-emerald-600" bgClass="bg-emerald-50"
          sub={`sur ${formatXOF(totalDueAll)} attendus`}
        />
        <KpiCard
          label="Biens non attribues"
          value={unassignedCount}
          icon="fa-home"
          colorClass={unassignedCount > 0 ? 'text-amber-600' : 'text-slate-400'}
          bgClass={unassignedCount > 0 ? 'bg-amber-50' : 'bg-slate-50'}
          sub={unassignedCount > 0 ? 'A attribuer a un collecteur' : 'Tous les biens sont attribues'}
        />
        
        {/* Jauge Taux de Recouvrement */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between hover:shadow-md transition-all">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Taux global recouvrement</div>
          <div className="flex flex-col items-center mt-2">
            {/* On remonte le graphique vers le titre avec -mt-4 ou -mt-6 selon le besoin */}
            <div className="h-24 w-full -mt-4">
              <ResponsiveContainer height="100%" width="100%">
                {/* Forcer margin à 0 sur le PieChart */}
                <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <Pie 
                    data={[{value: Math.min(globalRate, 100)}, {value: Math.max(0, 100 - globalRate)}]} 
                    startAngle={180} 
                    endAngle={0} 
                    cy="100%"
                    innerRadius="75%" 
                    outerRadius="100%" 
                    dataKey="value"
                    stroke="none"
                  >
                    <Cell fill={globalRate >= 80 ? '#10b981' : globalRate >= 50 ? '#f59e0b' : '#f43f5e'} />
                    <Cell fill="#f1f5f9" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            {/* On ajuste l'espace entre l'arc et le texte avec -mt-1 ou mt-0 */}
            <div className="flex flex-col items-center mt-0">
              <span className={`text-3xl font-extrabold ${globalRate >= 80 ? 'text-emerald-600' : globalRate >= 50 ? 'text-amber-500' : 'text-rose-600'}`}>
                {globalRate}%
              </span>
              <span className="text-xs text-slate-500 mt-1">Objectif : 100%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Alertes impayes */}
      {overdueAlerts.length > 0 && (
        <div className={`rounded-xl border p-4 ${urgentAlerts.length > 0 ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'}`}>
          <button className="flex items-center justify-between w-full text-left" onClick={() => setAlertsOpen(o => !o)}>
            <div className="flex items-center gap-3">
              <i className={`fas fa-bell ${urgentAlerts.length > 0 ? 'text-rose-600' : 'text-amber-600'}`}></i>
              <span className={`font-semibold text-sm ${urgentAlerts.length > 0 ? 'text-rose-700' : 'text-amber-700'}`}>
                {urgentAlerts.length > 0
                  ? `${urgentAlerts.length} alerte${urgentAlerts.length > 1 ? 's urgentes' : ' urgente'}`
                  : `${overdueAlerts.length} alerte${overdueAlerts.length > 1 ? 's' : ''} de paiement`}
              </span>
              {urgentAlerts.length > 0 && (
                <span className="bg-rose-600 text-white rounded-full px-2 py-0.5 text-xs font-bold">{urgentAlerts.length}</span>
              )}
            </div>
            <i className={`fas fa-chevron-${alertsOpen ? 'up' : 'down'} text-slate-400 text-xs`}></i>
          </button>
          {alertsOpen && (
            <div className="mt-3 space-y-1.5 border-t border-current/10 pt-3">
              {overdueAlerts.slice(0, 15).map((alert, idx) => {
                const isAcking = acknowledgingAlertIds.includes(alert.id);
                return (
                  <div key={alert.id ?? idx} className="flex items-center gap-3 text-sm">
                    <i className={`fas fa-circle text-[6px] ${alert.severity === 'critique' ? 'text-rose-600' : alert.severity === 'haute' ? 'text-amber-500' : 'text-slate-400'}`}></i>
                    <span className="flex-1 font-medium text-slate-800">{alert.first_name} {alert.last_name}</span>
                    <span className="font-bold text-rose-700">{formatXOF(alert.amount_owed, { compact: false })}</span>
                    <button
                      onClick={() => handleAcknowledgeAlert(alert.id)}
                      disabled={isAcking}
                      className="px-2 py-1 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                      <i className={`fas ${isAcking ? 'fa-spinner fa-spin' : 'fa-check'} mr-1`}></i>
                      {isAcking ? 'Traitement...' : 'Traiter'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Onglets */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Tab nav */}
        <div className="flex border-b border-slate-200">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.key
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <i className={`fas ${tab.icon} text-xs`}></i>
              {tab.label}
            </button>
          ))}
        </div>

        {/* â”€â”€ ONGLET : Portefeuilles â”€â”€ */}
        {activeTab === 'collectors' && (
          <div>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">Portefeuilles des collecteurs</h2>
              <span className="text-xs text-slate-500 bg-slate-100 rounded-full px-2.5 py-1 font-medium">
                {collectorsLoading ? '...' : `${collectors.length} collecteur${collectors.length !== 1 ? 's' : ''}`}
              </span>
            </div>

            {collectorsLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <i className="fas fa-spinner fa-spin text-primary text-2xl"></i>
                <span className="text-sm text-slate-500">Chargement des collecteurs...</span>
              </div>
            ) : collectorsWithStats.length > 0 ? (
              <div className="overflow-x-auto min-w-0">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr>
                      <th className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3 px-5 font-semibold">Collecteur</th>
                      <th className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3 px-5 font-semibold text-center hidden sm:table-cell">Biens</th>
                      <th className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3 px-5 font-semibold text-center hidden md:table-cell">Locataires</th>
                      <th className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3 px-5 font-semibold text-right hidden lg:table-cell">Dus (mensuel)</th>
                      <th className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3 px-5 font-semibold text-right hidden lg:table-cell">Encaisse</th>
                      <th className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3 px-5 font-semibold">Recouvrement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {collectorsWithStats.map(col => (
                      <tr key={col.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${col.assignedPropsCount === 0 ? 'bg-amber-100 text-amber-600' : 'bg-primary/10 text-primary'}`}>
                              {getInitials(col)}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 text-sm">{getName(col)}</div>
                              <div className="text-xs text-slate-400">
                                {col.collectorName ?? col.collector_name ?? col.username ?? ''}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-5 text-center hidden sm:table-cell">
                          {col.assignedPropsCount === 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full">
                              <i className="fas fa-exclamation-circle text-[10px]"></i>Sans bien
                            </span>
                          ) : (
                            <span className="font-semibold text-slate-900">{col.assignedPropsCount}</span>
                          )}
                        </td>
                        <td className="py-4 px-5 text-center text-sm text-slate-700 hidden md:table-cell">
                          {col.assignedClientsCount}
                        </td>
                        <td className="py-4 px-5 text-right text-sm text-slate-600 hidden lg:table-cell">
                          {formatXOF(col.totalDue, { compact: false })}
                        </td>
                        <td className="py-4 px-5 text-right text-sm font-semibold hidden lg:table-cell">
                          <span className={col.totalCollected > 0 ? 'text-emerald-600' : 'text-slate-400'}>
                            {formatXOF(col.totalCollected, { compact: false })}
                          </span>
                        </td>
                        <td className="py-4 px-5">
                          {col.rate !== null
                            ? <ProgressBar rate={col.rate} />
                            : <span className="text-xs text-slate-400 italic">N/A</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
                  <i className="fas fa-user-slash text-slate-400 text-xl"></i>
                </div>
                <div className="text-center">
                  <p className="font-semibold text-slate-700">Aucun collecteur disponible</p>
                  <p className="text-sm text-slate-400 mt-1">Ajoutez ou activez des collecteurs depuis la gestion des utilisateurs.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* â”€â”€ ONGLET : Attributions â”€â”€ */}
        {activeTab === 'assignment' && (
          <div>
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">Attribuer des biens</h2>
              <p className="text-sm text-slate-500 mt-0.5">Selectionnez un collecteur, puis choisissez les biens a lui confier.</p>
            </div>

            {/* Controles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Collecteur</label>
                <select
                  value={selectedCollectorId}
                  onChange={e => setSelectedCollectorId(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                >
                  <option value="">Selectionner un collecteur...</option>
                  {collectors.map(c => (
                    <option key={c.id} value={c.id}>{getName(c)}</option>
                  ))}
                </select>
                {selectedCollector && (
                  <p className="text-xs text-emerald-600 mt-1.5 font-medium">
                    <i className="fas fa-check-circle mr-1"></i>
                    Attribution vers : {getName(selectedCollector)}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Filtrer les biens</label>
                <div className="relative">
                  <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none"></i>
                  <input
                    type="text"
                    placeholder="Nom, adresse ou type..."
                    value={assignSearch}
                    onChange={e => setAssignSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>
            </div>

            {collectors.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
                  <i className="fas fa-user-slash text-slate-400 text-xl"></i>
                </div>
                <p className="font-semibold text-slate-700">Aucun collecteur disponible</p>
                <p className="text-sm text-slate-400">Ajoutez un collecteur avant de commencer les attributions.</p>
              </div>
            ) : (
              <div className="overflow-x-auto min-w-0">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr>
                      <th className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3 px-5 font-semibold">Bien</th>
                      <th className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3 px-5 font-semibold hidden sm:table-cell">Type</th>
                      <th className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3 px-5 font-semibold hidden md:table-cell">Adresse</th>
                      <th className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3 px-5 font-semibold text-right hidden lg:table-cell">Valeur</th>
                      <th className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3 px-5 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {unassignedProperties.length > 0 ? unassignedProperties.map(p => {
                      const isAssigning = assigningPropertyIds.includes(p.id);
                      return (
                        <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-5">
                            <div className="font-semibold text-slate-900 text-sm">{p.name}</div>
                            <div className="text-xs text-slate-400 md:hidden">{p.address}</div>
                          </td>
                          <td className="py-3.5 px-5 text-sm text-slate-600 hidden sm:table-cell">{p.type || 'â€”'}</td>
                          <td className="py-3.5 px-5 text-sm text-slate-600 hidden md:table-cell max-w-[200px] truncate" title={p.address}>{p.address}</td>
                          <td className="py-3.5 px-5 text-sm font-medium text-slate-900 text-right hidden lg:table-cell">
                            {formatXOF(p.value ?? p.val, { compact: false })}
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            <button
                              onClick={() => handleAssignProperty(p.id)}
                              disabled={!selectedCollectorId || isAssigning}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary-dark transition-colors shadow-sm shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isAssigning && <i className="fas fa-spinner fa-spin text-[10px]"></i>}
                              {isAssigning
                                ? 'Attribution...'
                                : selectedCollector
                                  ? `A ${(selectedCollector.last_name ?? selectedCollector.lastName ?? '').slice(0, 8)}`
                                  : 'Choisir recolteur'}
                            </button>
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan="5" className="py-12 px-6 text-center">
                          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                            <i className="fas fa-check-circle text-emerald-500 text-xl"></i>
                          </div>
                          <p className="font-semibold text-slate-700">
                            {assignSearch ? 'Aucun bien ne correspond a cette recherche' : 'Tous les biens sont deja attribues'}
                          </p>
                          <p className="text-sm text-slate-400 mt-1">
                            {assignSearch ? 'Modifiez le filtre.' : 'Les nouveaux biens non attribues apparaitront ici.'}
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* â”€â”€ ONGLET : Performances â”€â”€ */}
        {activeTab === 'performance' && (
          <div>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">Performances de recouvrement</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Transactions validees pour {periodLabel}
                </p>
              </div>
            </div>

            {/* GRAPHIQUE BAR CHART */}
            {collectorsWithStats.length > 0 && collectorsWithStats.some(c => c.totalCollected > 0) && (
              <div className="p-6 border-b border-slate-100 bg-slate-50/30">
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={collectorsWithStats.map(c => ({
                        name: getName(c).substring(0, 15) + (getName(c).length > 15 ? '...' : ''),
                        'Montant': c.totalCollected,
                      }))} 
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{fill: '#64748b', fontSize: 12}} tickLine={false} axisLine={false} />
                      <YAxis tickFormatter={(val) => formatXOF(val, {compact: true})} tick={{fill: '#64748b', fontSize: 12}} tickLine={false} axisLine={false} />
                      <RechartsTooltip 
                        formatter={(value) => [formatXOF(value, {compact: false}), 'Recouvré']} 
                        cursor={{fill: '#f8fafc'}} 
                        contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }} 
                      />
                      <Bar dataKey="Montant" fill="#4f46e5" radius={[6, 6, 0, 0]} maxBarSize={50} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {collectorsWithStats.length > 0 ? (
              <div className="overflow-x-auto min-w-0">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr>
                      <th className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3 px-5 font-semibold">Collecteur</th>
                      <th className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3 px-5 font-semibold text-center hidden sm:table-cell">Locataires</th>
                      <th className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3 px-5 font-semibold text-right hidden md:table-cell">Objectif (du)</th>
                      <th className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3 px-5 font-semibold text-right hidden md:table-cell">Realise</th>
                      <th className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3 px-5 font-semibold">Taux recouvrement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {collectorsWithStats.map(col => (
                      <tr key={col.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                              col.rate === null ? 'bg-slate-100 text-slate-400'
                              : col.rate >= 80 ? 'bg-emerald-100 text-emerald-700'
                              : col.rate >= 50 ? 'bg-amber-100 text-amber-700'
                              : 'bg-rose-100 text-rose-700'
                            }`}>
                              {getInitials(col)}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 text-sm">{getName(col)}</div>
                              <div className="text-xs text-slate-400">{col.assignedPropsCount} bien{col.assignedPropsCount !== 1 ? 's' : ''}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-5 text-center text-sm text-slate-700 hidden sm:table-cell">
                          {col.assignedClientsCount}
                        </td>
                        <td className="py-4 px-5 text-right text-sm text-slate-600 hidden md:table-cell">
                          {formatXOF(col.totalDue, { compact: false })}
                        </td>
                        <td className="py-4 px-5 text-right text-sm font-semibold hidden md:table-cell">
                          <span className={col.totalCollected > 0 ? 'text-emerald-600' : 'text-slate-400'}>
                            {formatXOF(col.totalCollected, { compact: false })}
                          </span>
                        </td>
                        <td className="py-4 px-5">
                          {col.rate !== null
                            ? <ProgressBar rate={col.rate} />
                            : (
                              <span className="text-xs text-slate-400 italic">
                                <i className="fas fa-minus-circle mr-1"></i>Donnees insuffisantes
                              </span>
                            )
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
                  <i className="fas fa-chart-line text-slate-400 text-xl"></i>
                </div>
                <p className="font-semibold text-slate-700">Aucune performance a afficher</p>
                <p className="text-sm text-slate-400">Les statistiques apparaitront lorsque des collecteurs seront actifs.</p>
              </div>
            )}
          </div>
        )}

        {/* ── ONGLET : Rapports & Documents de Gestion ── */}
        {activeTab === 'reports' && (
          <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">Rapports &amp; Documents de Gestion</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Consultez les décomptes des bailleurs, le suivi des collecteurs, le recouvrement et téléchargez les bordereaux officiels.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/admin/reports')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary-dark transition-colors shadow-sm shadow-primary/20"
              >
                <i className="fas fa-external-link-alt text-xs"></i>
                Ouvrir le Module Rapports Complets
              </button>
            </div>

            {/* Cartes de modules de rapports */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div 
                onClick={() => navigate('/admin/reports')}
                className="p-5 bg-white rounded-xl border border-slate-200 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                    <i className="fas fa-file-invoice-dollar text-base"></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 text-sm group-hover:text-primary transition-colors">
                      Décomptes Propriétaires &amp; Bordereaux Locatifs
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Vue hiérarchique avec sous-lignes locataires : loyers payés, arriérés, avances préfinancées et bordereaux A4 téléchargeables.
                    </p>
                    <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-primary">
                      <span>Accéder au rapport</span>
                      <i className="fas fa-arrow-right text-[10px] group-hover:translate-x-1 transition-transform"></i>
                    </div>
                  </div>
                </div>
              </div>

              <div 
                onClick={() => navigate('/admin/reports')}
                className="p-5 bg-white rounded-xl border border-slate-200 hover:border-emerald-500/40 hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                    <i className="fas fa-chart-line text-base"></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition-colors">
                      Rapport Collecteurs &amp; Recouvrement
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Analyse détaillée des performances par agent : montants recouvrés, taux d'atteinte des objectifs et tournées.
                    </p>
                    <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-emerald-600">
                      <span>Consulter les performances</span>
                      <i className="fas fa-arrow-right text-[10px] group-hover:translate-x-1 transition-transform"></i>
                    </div>
                  </div>
                </div>
              </div>

              <div 
                onClick={() => navigate('/admin/reports')}
                className="p-5 bg-white rounded-xl border border-slate-200 hover:border-amber-500/40 hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                    <i className="fas fa-bolt text-base"></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 text-sm group-hover:text-amber-700 transition-colors">
                      Journal des Préfinancements &amp; Trésorerie
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Suivi des avances propriétaires versées sur fonds d'agence et rapprochement avec les encaissements locataires.
                    </p>
                    <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-amber-600">
                      <span>Voir le journal financier</span>
                      <i className="fas fa-arrow-right text-[10px] group-hover:translate-x-1 transition-transform"></i>
                    </div>
                  </div>
                </div>
              </div>

              <div 
                onClick={() => navigate('/admin/reports')}
                className="p-5 bg-white rounded-xl border border-slate-200 hover:border-rose-500/40 hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                    <i className="fas fa-exclamation-triangle text-base"></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 text-sm group-hover:text-rose-700 transition-colors">
                      Alertes Impayés &amp; Retards
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Synthèse des arriérés locataires, alertes de relance et montants à recouvrer pour l'ensemble du portefeuille.
                    </p>
                    <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-rose-600">
                      <span>Examiner les impayés</span>
                      <i className="fas fa-arrow-right text-[10px] group-hover:translate-x-1 transition-transform"></i>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


