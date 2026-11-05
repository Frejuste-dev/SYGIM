import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboardKpis } from '../hooks/queries/useDashboardKpis';
import { useTransactions, useTransactionStats } from '../hooks/queries/useTransactions';
import { formatXOF, formatDate, formatMethod } from '../utils/formatters';
import { exportToCSV } from '../utils/exportUtils';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function AccountingDashboard() {
  const navigate = useNavigate();

  const { data: kpis = {}, isLoading: kpisLoading } = useDashboardKpis();
  const { data: transactionsData = {}, isLoading: txLoading } = useTransactions({ limit: 10 });
  const transactions = Array.isArray(transactionsData) ? transactionsData : (transactionsData?.data || []);

  const { data: stats = {}, isLoading: statsLoading } = useTransactionStats({});

  const totalRevenue = kpis.totalRevenue ?? 0;
  const totalDue = kpis.totalDue ?? 0;
  const pendingPaymentsCount = kpis.pendingPaymentsCount ?? 0;
  const collectionRate = kpis.collectionRate ?? 0;

  const todayRevenue = stats.todayCollected || 0;

  // Préparation des données pour le PieChart des méthodes de paiement
  const methodColors = { 'cash': '#10b981', 'mobile_money': '#f59e0b', 'bank_transfer': '#3b82f6', 'cheque': '#8b5cf6', 'default': '#94a3b8' };
  const paymentMethodData = (stats.methodStats || []).map(m => ({
    name: formatMethod(m.name),
    value: m.value,
    color: methodColors[m.name] || methodColors.default
  })).filter(d => d.value > 0);

  // Sparkline data
  const sparklineDataDay = [{v: 5}, {v: 15}, {v: 10}, {v: 25}, {v: 20}, {v: 35}, {v: todayRevenue > 0 ? 50 : 40}];
  const sparklineDataDue = [{v: 100}, {v: 85}, {v: 90}, {v: 75}, {v: 80}, {v: 60}, {v: Math.max(0, totalDue - totalRevenue) > 0 ? 50 : 40}];

  const handleExportCSV = () => {
    const data = transactions.map(tx => ({
      date: formatDate(tx.date || tx.createdAt),
      client: tx.client || 'N/A',
      montant: tx.amount,
      methode: formatMethod(tx.method),
      reference: tx.reference || tx.id,
      statut: tx.status
    }));
    const columns = {
      date: 'Date',
      client: 'Locataire',
      montant: 'Montant (XOF)',
      methode: 'Méthode',
      reference: 'Référence',
      statut: 'Statut'
    };
    exportToCSV(data, `transactions_${today}.csv`, columns);
  };

  const loading = kpisLoading || txLoading || statsLoading;

  if (loading) {
    return (
      <div className="bg-blue-50 text-blue-700 p-4 rounded-lg flex items-center gap-3">
        <i className="fas fa-spinner fa-spin"></i>
        <span>Chargement des données financières...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 w-full max-w-full overflow-hidden box-border">
      {/* HEADER + FILTRE TEMPOREL */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-4 mb-2">
        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-500 font-semibold"><i className="fas fa-filter mr-1"></i>Période :</label>
          <select className="bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg focus:ring-primary/20 focus:border-primary block p-2 transition-all shadow-sm">
            <option>Ce mois-ci</option>
            <option>Aujourd'hui</option>
            <option>Cette semaine</option>
            <option>Cette année</option>
            <option>Global</option>
          </select>
        </div>
      </div>

      {/* KPIs Comptables */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
        {/* KPI 1: Encaissements du jour */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Encaissements du jour</div>
              <div className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">{formatXOF(todayRevenue)}</div>
            </div>
            <div className="w-20 h-10 opacity-70">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparklineDataDay}>
                  <Line type="monotone" dataKey="v" stroke="#10b981" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="text-xs mt-4 flex items-center gap-1.5 text-emerald-600">
            <i className="fas fa-arrow-trend-up"></i>
            Aujourd'hui
          </div>
        </div>

        {/* KPI 2: Loyers en attente */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Loyers en attente</div>
              <div className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">{formatXOF(Math.max(0, totalDue - totalRevenue))}</div>
            </div>
            <div className="w-20 h-10 opacity-70">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparklineDataDue}>
                  <Line type="monotone" dataKey="v" stroke="#f43f5e" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="text-xs mt-4 flex items-center gap-1.5 text-rose-600">
            <i className="fas fa-clock"></i>
            Reste à recouvrer
          </div>
        </div>

        {/* KPI 3: Taux de recouvrement financier */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col justify-between hover:shadow-md transition-all">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Recouvrement financier</div>
            <div className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">{collectionRate}%</div>
          </div>
          <div className={`text-xs mt-4 flex items-center gap-1.5 ${collectionRate >= 80 ? 'text-emerald-600' : collectionRate > 0 ? 'text-amber-600' : 'text-slate-500'}`}>
            <i className="fas fa-bullseye"></i>
            Objectif global : 80%
          </div>
        </div>

        {/* KPI 4: Transactions à valider */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col justify-between hover:shadow-md transition-all">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Transactions à valider</div>
            <div className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">{pendingPaymentsCount}</div>
          </div>
          <div className="text-xs mt-4 flex items-center gap-1.5 text-amber-600">
            <i className="fas fa-list-check"></i>
            En attente de traitement
          </div>
        </div>
      </div>

      {/* GRAPHIQUES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Répartition par Méthode (XOF)</h3>
          {paymentMethodData.length > 0 ? (
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={paymentMethodData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {paymentMethodData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(value) => formatXOF(value, { compact: false })} contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-slate-400 text-sm">
              Aucune donnée financière disponible
            </div>
          )}
        </div>
        
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-center items-center text-center">
          <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mb-4">
            <i className="fas fa-chart-area text-2xl"></i>
          </div>
          <h3 className="text-slate-900 font-medium mb-1">Volume Collecté (Évolution)</h3>
          <p className="text-slate-500 text-sm max-w-sm">Le graphique d'évolution sera disponible dès que votre historique comportera suffisamment de points d'activité.</p>
        </div>
      </div>

      {/* Activité récente */}
      <div className="grid grid-cols-1 gap-8">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900">Dernières Transactions</h3>
            <div className="flex items-center gap-3">
              <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                <i className="fas fa-file-csv"></i> Exporter (CSV)
              </button>
              <button onClick={() => navigate('/admin/transactions')} className="text-sm font-medium text-primary hover:text-primary-dark transition-colors">
                Gérer les flux <i className="fas fa-arrow-right ml-1"></i>
              </button>
            </div>
          </div>
          
          {transactions.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              Aucune transaction financière récente.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {transactions.slice(0, 10).map(tx => (
                <li key={tx.id || tx.reference} className="py-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                      <i className="fas fa-money-bill-wave"></i>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{tx.client}</p>
                      <p className="text-xs text-slate-500">
                        {formatDate(tx.date || tx.createdAt)} • {formatMethod(tx.method)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-emerald-600">+{formatXOF(tx.amount, { compact: false })}</p>
                    <p className="text-xs text-slate-400">Réf: {tx.reference || tx.id}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
