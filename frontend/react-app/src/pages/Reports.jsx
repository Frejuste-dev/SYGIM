import React, { useState, useEffect, useCallback } from 'react';
import { API } from '../api/services';
import { CONFIG } from '../api/config';
import AppHeader from '../components/AppHeader';
import StatsCard from '../components/StatsCard';
import { formatXOF, formatDate, formatStatus } from '../utils/formatters';


const REPORT_TABS = [
  { key: 'overview', label: 'Vue d\'ensemble', icon: 'fa-chart-pie' },
  { key: 'collectors', label: 'Récolteurs', icon: 'fa-users' },
  { key: 'properties', label: 'Biens', icon: 'fa-building' },
  { key: 'overdue', label: 'Impayés', icon: 'fa-exclamation-triangle' },
];

const COL_COLLECTORS = [
  { key: 'collectorName', label: 'Récolteur' },
  { key: 'transactionCount', label: 'Transactions' },
  { key: 'totalCollected', label: 'Total collecté' },
];

const COL_PROPERTIES = [
  { key: 'status', label: 'Statut' },
  { key: 'count', label: 'Nombre' },
  { key: 'totalRent', label: 'Loyers totaux' },
];

const COL_OVERDUE = [
  { key: 'client', label: 'Client' },
  { key: 'property', label: 'Bien' },
  { key: 'amount', label: 'Montant dû' },
  { key: 'dueDate', label: 'Échéance' },
  { key: 'daysLate', label: 'Jours de retard' },
];

const createSectionErrors = () => ({
  dashboard: null,
  collectors: null,
  properties: null,
  overdue: null,
});

const SECTION_LABELS = {
  dashboard: 'Synthèse',
  collectors: 'Récolteurs',
  properties: 'Biens',
  overdue: 'Impayés',
};

const unwrapReportData = (response) => response?.data ?? response;

const normalizeReportList = (response) => {
  const data = unwrapReportData(response);

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.rows)) return data.rows;
  return [];
};

export default function Reports() {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sectionErrors, setSectionErrors] = useState(createSectionErrors);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState(null);

  const [dashboard, setDashboard] = useState(null);
  const [collectors, setCollectors] = useState([]);
  const [properties, setProperties] = useState([]);
  const [overdue, setOverdue] = useState([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const nextSectionErrors = createSectionErrors();

    const safeCall = async (key, apiFn, normalize, fallback) => {
      try {
        const response = await apiFn();

        if (response?.success === false) {
          throw new Error(response.message || 'Erreur applicative serveur');
        }

        return normalize(response);
      } catch (err) {
        console.error(`[Reports] Erreur section "${key}":`, err);
        nextSectionErrors[key] = err.message || 'Erreur de chargement';
        return fallback;
      }
    };

    try {
      const dashboardData = await safeCall('dashboard', API.Reports.getDashboard, unwrapReportData, null);
      const collectorsData = await safeCall('collectors', () => API.Reports.getAgent({}), normalizeReportList, []);
      const propertiesData = await safeCall('properties', API.Reports.getPropertyStats, normalizeReportList, []);
      const overdueData = await safeCall('overdue', () => API.Reports.getOverdue({}), normalizeReportList, []);

      setDashboard(dashboardData);
      setCollectors(collectorsData);
      setProperties(propertiesData);
      setOverdue(overdueData);
      setSectionErrors(nextSectionErrors);

      const errorMessages = Object.entries(nextSectionErrors)
        .filter(([, message]) => message)
        .map(([key, message]) => `${SECTION_LABELS[key]} : ${message}`);

      if (errorMessages.length > 0) {
        setError(`Certaines sections n'ont pas pu être chargées :\n${errorMessages.join('\n')}`);
      }
    } catch (globalError) {
      console.error('[Reports] Erreur globale:', globalError);
      setSectionErrors(nextSectionErrors);
      setError(globalError.message || 'Impossible de charger les rapports.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExportPdf = async () => {
    if (exportLoading) return;

    setExportLoading(true);
    setExportError(null);

    try {
      const response = await fetch(`${CONFIG.API.BASE}/reports/export/pdf/overdue`, {
        credentials: 'include',
      });

      if (!response.ok) {
        let message = `Export échoué : erreur ${response.status}`;

        try {
          const body = await response.json();
          message = body.message || message;
        } catch {
          // La réponse d'erreur n'est pas nécessairement au format JSON.
        }

        throw new Error(message);
      }

      const blob = await response.blob();
      if (blob.size === 0) {
        throw new Error('Le rapport généré est vide.');
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);

      link.href = url;
      link.download = `sygim_rapport_impayes_${date}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[Reports] Export PDF échoué:', err);
      setExportError(err.message || "L'export PDF a échoué.");
    } finally {
      setExportLoading(false);
    }
  };

  // Native table components are rendered directly in the JSX

  const renderSectionHeader = (title, description, action = null) => (
    <div className="reports-section-header">
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );

  if (loading && !dashboard) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Rapports & Analyses</h1>
            <p className="text-slate-500 text-sm mt-1">Suivez les revenus, les collectes, l'occupation des biens et les impayés à traiter.</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-20">
          <i className="fas fa-spinner fa-spin text-primary text-4xl mb-4"></i>
          <h3 className="text-lg font-bold text-slate-700">Chargement des rapports...</h3>
          <p className="text-slate-500 mt-2">Nous préparons les indicateurs financiers et opérationnels.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 min-w-0 overflow-x-hidden">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Rapports & Analyses</h1>
          <p className="text-slate-500 text-sm mt-1">Suivez les revenus, les collectes, l'occupation des biens et les impayés à traiter.</p>
        </div>
        <button onClick={handleExportPdf} disabled={exportLoading} className="bg-primary text-white rounded-lg px-4 py-2 hover:bg-primary-dark transition-colors font-medium text-sm flex items-center shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
          <i className={`fas ${exportLoading ? 'fa-spinner fa-spin' : 'fa-file-pdf'} mr-2`}></i>
          {exportLoading ? 'Export en cours...' : 'Exporter le rapport (PDF)'}
        </button>
      </div>

      {exportError && (
        <div className="bg-rose-50 text-rose-700 p-3 rounded-lg text-sm flex items-center gap-2">
          <i className="fas fa-exclamation-circle"></i>{exportError}
        </div>
      )}
      
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl flex items-start justify-between shadow-sm">
          <div className="flex items-start gap-3">
            <i className="fas fa-exclamation-circle mt-0.5"></i>
            <div>
              <h3 className="font-medium">Erreur de chargement</h3>
              <p className="text-sm mt-1 whitespace-pre-line">{error}</p>
            </div>
          </div>
          <button onClick={fetchData} disabled={loading} className="px-3 py-1.5 bg-white border border-rose-200 rounded-lg text-sm font-medium hover:bg-rose-50 transition-colors disabled:opacity-50">
            <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-sync-alt'} mr-1.5`}></i>
            {loading ? 'Nouvelle tentative...' : 'Réessayer'}
          </button>
        </div>
      )}

      {loading && dashboard && (
        <div className="bg-blue-50 text-blue-700 p-3 rounded-lg text-sm flex items-center gap-2">
          <i className="fas fa-sync fa-spin"></i> Actualisation des rapports en cours...
        </div>
      )}

      {/* TABS */}
      <div className="flex space-x-1 bg-slate-100/50 p-1 rounded-xl border border-slate-200/60 overflow-x-auto min-w-0">
        {REPORT_TABS.map(tab => (
          <button
            key={tab.key}
            type="button"
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${activeTab === tab.key ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <i className={`fas ${tab.icon}`}></i> {tab.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Synthèse globale</h3>
            <p className="text-slate-500 text-sm mb-6">Vue rapide des revenus, transactions, occupation et créances.</p>

            {dashboard ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  <StatsCard label="Revenus totaux" value={formatXOF(dashboard.totalRevenue)} icon="fa-money-bill-wave" color="var(--success)" />
                  <StatsCard label="Transactions" value={dashboard.totalTransactions || 0} icon="fa-exchange-alt" color="var(--primary)" />
                  <StatsCard label="Taux occupation" value={`${dashboard.occupancyRate || 0}%`} icon="fa-home" color="var(--info)" />
                  <StatsCard label="Créances" value={formatXOF(dashboard.totalOverdue)} icon="fa-exclamation-triangle" color="var(--danger)" />
                </div>

                {dashboard.recentTransactions && dashboard.recentTransactions.length > 0 ? (
                  <div>
                    <h4 className="text-md font-bold text-slate-900 mb-4">Dernières transactions</h4>
                    <div className="overflow-x-auto min-w-0">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr>
                            <th className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3 px-4 font-semibold">Client</th>
                            <th className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3 px-4 font-semibold">Montant</th>
                            <th className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3 px-4 font-semibold">Mode</th>
                            <th className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3 px-4 font-semibold">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dashboard.recentTransactions.slice(0, 10).map((tx, idx) => (
                            <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                              <td className="py-3 px-4 text-sm font-medium text-slate-900">{tx.client}</td>
                              <td className="py-3 px-4 text-sm font-bold text-emerald-600">{formatXOF(tx.amount, { compact: false })}</td>
                              <td className="py-3 px-4 text-sm"><span className="px-2.5 py-1 bg-sky-50 text-sky-700 text-xs font-semibold rounded-full border border-sky-100">{tx.method || 'Espèces'}</span></td>
                              <td className="py-3 px-4 text-sm text-slate-500">{tx.date ? formatDate(tx.date, { day: '2-digit', month: '2-digit', year: 'numeric' }) : formatDate(tx.createdAt, { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 bg-slate-50 rounded-xl border border-slate-100">
                    <i className="fas fa-inbox text-slate-400 text-3xl mb-3"></i>
                    <h4 className="text-md font-bold text-slate-700">Aucune transaction récente</h4>
                    <p className="text-slate-500 text-sm mt-1">Les dernières transactions apparaîtront ici.</p>
                  </div>
                )}
              </>
            ) : !loading && !sectionErrors.dashboard ? (
              <div className="flex flex-col items-center justify-center py-10 bg-slate-50 rounded-xl border border-slate-100">
                <i className="fas fa-chart-pie text-slate-400 text-3xl mb-3"></i>
                <h4 className="text-md font-bold text-slate-700">Aucune donnée de synthèse</h4>
                <p className="text-slate-500 text-sm mt-1">Les indicateurs apparaîtront ici dès que des données seront disponibles.</p>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* COLLECTORS TAB */}
      {activeTab === 'collectors' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-1">Performance des récolteurs</h3>
          <p className="text-slate-500 text-sm mb-6">Comparez le volume de transactions et les montants collectés.</p>
          
          {!sectionErrors.collectors && (
            collectors.length > 0 ? (
              <div className="overflow-x-auto min-w-0">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr>
                      {COL_COLLECTORS.map(col => (
                        <th key={col.key} className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3 px-4 font-semibold">{col.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {collectors.map((r, idx) => (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 text-sm font-medium text-slate-900">{r.collectorName}</td>
                        <td className="py-3 px-4 text-sm text-slate-600">{r.transactionCount}</td>
                        <td className="py-3 px-4 text-sm font-bold text-emerald-600">{formatXOF(r.totalCollected, { compact: false })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 bg-slate-50 rounded-xl border border-slate-100">
                <i className="fas fa-users text-slate-400 text-3xl mb-3"></i>
                <h4 className="text-md font-bold text-slate-700">Aucun récolteur à afficher</h4>
                <p className="text-slate-500 text-sm mt-1">Les performances apparaîtront ici dès qu'elles seront disponibles.</p>
              </div>
            )
          )}
        </div>
      )}

      {/* PROPERTIES TAB */}
      {activeTab === 'properties' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-1">Répartition des biens par statut</h3>
          <p className="text-slate-500 text-sm mb-6">Visualisez l'état du portefeuille immobilier et les loyers associés.</p>
          
          {!sectionErrors.properties && (
            properties.length > 0 ? (
              <div className="overflow-x-auto min-w-0">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr>
                      {COL_PROPERTIES.map(col => (
                        <th key={col.key} className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3 px-4 font-semibold">{col.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {properties.map((p, idx) => (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 text-sm">
                          {(() => { const ps = formatStatus(p.status); return (
                            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${ps.twClass}`}>
                              {ps.label || p.status || 'Inconnu'}
                            </span>
                          ); })()}
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-600">{p.count}</td>
                        <td className="py-3 px-4 text-sm font-medium text-slate-900">{formatXOF(p.totalRent, { compact: false })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 bg-slate-50 rounded-xl border border-slate-100">
                <i className="fas fa-building text-slate-400 text-3xl mb-3"></i>
                <h4 className="text-md font-bold text-slate-700">Aucune statistique immobilière</h4>
                <p className="text-slate-500 text-sm mt-1">La répartition des biens apparaîtra ici dès qu'elle sera disponible.</p>
              </div>
            )
          )}
        </div>
      )}

      {/* OVERDUE TAB */}
      {activeTab === 'overdue' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">Paiements en retard</h3>
              <p className="text-slate-500 text-sm">Identifiez les clients à relancer et les montants dus.</p>
            </div>
          </div>
          
          {!sectionErrors.overdue && (
            overdue.length > 0 ? (
              <div className="overflow-x-auto min-w-0">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr>
                      {COL_OVERDUE.map(col => (
                        <th key={col.key} className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3 px-4 font-semibold">{col.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {overdue.map((o, idx) => (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 text-sm font-medium text-slate-900">{o.client || '-'}</td>
                        <td className="py-3 px-4 text-sm text-slate-600">{o.property || '-'}</td>
                        <td className="py-3 px-4 text-sm font-bold text-rose-600">{formatXOF(o.amount, { compact: false })}</td>
                        <td className="py-3 px-4 text-sm text-slate-500">{o.dueDate || '-'}</td>
                        <td className="py-3 px-4 text-sm">
                          <span className="px-2.5 py-1 bg-rose-50 text-rose-700 text-xs font-semibold rounded-full border border-rose-100">{o.daysLate || 0} j</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 bg-slate-50 rounded-xl border border-slate-100">
                <i className="fas fa-check-circle text-slate-400 text-3xl mb-3"></i>
                <h4 className="text-md font-bold text-slate-700">Aucun impayé à signaler</h4>
                <p className="text-slate-500 text-sm mt-1">Les paiements en retard apparaîtront ici lorsqu'une action sera nécessaire.</p>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
