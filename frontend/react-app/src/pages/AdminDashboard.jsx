import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { useClients, useClientStats, useCreateClient } from '../hooks/queries/useClients';
import { useProperties, usePropertyStats, useCreateProperty } from '../hooks/queries/useProperties';
import { useTransactions, useTransactionStats } from '../hooks/queries/useTransactions';
import { useOwners, useOwnerStats } from '../hooks/queries/useOwners';
import { useDashboardKpis } from '../hooks/queries/useDashboardKpis';
import { useToast } from '../components/ToastContext';
import DashboardSidebar from '../components/DashboardSidebar';
import DashboardHeader from '../components/DashboardHeader';
import Modal from '../components/Modal';
import { formatXOF, formatDate, formatMethod, formatStatus, transactionSearchDate } from '../utils/formatters';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';


const CLIENT_INIT = { lastName: '', firstName: '', phone: '', email: '', address: '', amountDue: 50000, status: 'pending' };
const PROPERTY_INIT = { name: '', type: 'Appartement', address: '', value: 15000000, status: 'vacant' };

const SECTION_TITLES = {
  dashboard: 'Tableau de bord', portfolio: 'Portefeuille Immobilier',
  clients: 'Locataires', payments: 'Historique des Transactions',
  reports: 'Rapports & Documents', analytics: 'Statistiques & Analyse',
  owners: 'Propriétaires partenaires', settings: 'Paramètres Généraux',
};

const SEARCHABLE_SECTIONS = new Set(['portfolio', 'clients', 'payments', 'owners']);

const SEARCH_PLACEHOLDERS = {
  portfolio: 'Rechercher un bien...',
  clients: 'Rechercher un locataire...',
  payments: 'Rechercher une transaction...',
  owners: 'Rechercher un propriétaire...',
};

const normalizeSearchValue = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();



export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');

  const { data: clientsData = {}, isLoading: clientsLoading } = useClients({ search: searchQuery, limit: 20 });
  const clients = Array.isArray(clientsData) ? clientsData : (clientsData?.data || []);
  const { data: propertiesData = {}, isLoading: propsLoading } = useProperties({ search: searchQuery, limit: 20 });
  const properties = Array.isArray(propertiesData) ? propertiesData : (propertiesData?.data || []);
  const { data: transactionsData = {}, isLoading: txLoading } = useTransactions({ search: searchQuery, limit: 20 });
  const transactions = Array.isArray(transactionsData) ? transactionsData : (transactionsData?.data || []);
  const { data: ownersData = {} } = useOwners({ search: searchQuery, limit: 20 });
  const owners = Array.isArray(ownersData) ? ownersData : (ownersData?.data || []);

  const { data: clientStats = {} } = useClientStats();
  const { data: propStats = {} } = usePropertyStats();
  const { data: ownerStats = {} } = useOwnerStats();

  const createClient = useCreateClient();
  const createProperty = useCreateProperty();

  const [activeSection, setActiveSection] = useState('dashboard');
  const [isDark, setIsDark] = useState(document.body.classList.contains('dark-mode'));
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [propertyModalOpen, setPropertyModalOpen] = useState(false);
  const [newClient, setNewClient] = useState({ ...CLIENT_INIT });
  const [newProperty, setNewProperty] = useState({ ...PROPERTY_INIT });

  // --- KPIs serveur (calculés SQL, pas de reduce() frontend) ---
  const { data: kpis = {}, isLoading: kpisLoading } = useDashboardKpis();
  const totalRevenue         = kpis.totalRevenue         ?? 0;
  const totalDue             = kpis.totalDue             ?? 0;
  const pendingPaymentsCount = kpis.pendingPaymentsCount ?? 0;
  const collectionRate       = kpis.collectionRate       ?? 0;
  const occupiedCount        = kpis.occupiedCount        ?? 0;
  const occupancyRate        = kpis.occupancyRate        ?? 0;

  const loading = clientsLoading || propsLoading || txLoading || kpisLoading;
  const error = null;

  const isOverview = activeSection === 'dashboard';
  const normalizedSearch = normalizeSearchValue(searchQuery);
  const isFirstVisit = !kpisLoading
    && (kpis.totalProperties ?? 0) === 0
    && (kpis.totalClients ?? 0) === 0;

  const filteredProperties = properties;
  const filteredClients = clients;
  const filteredTransactions = transactions;
  const filteredOwners = owners;

  // Préparation des données pour le PieChart des statuts de biens
  const propertyStatusData = [
    { name: 'Loué', value: propStats.loue || 0, color: '#10b981' },
    { name: 'Vacant', value: propStats.vacant || 0, color: '#f43f5e' },
    { name: 'En Rénovation', value: propStats.en_renovation || 0, color: '#f59e0b' }
  ].filter(d => d.value > 0);

  const toggleTheme = () => {
    document.body.classList.toggle('dark-mode');
    setIsDark(document.body.classList.contains('dark-mode'));
  };

  const handleSectionNavigate = (key) => {
    setSearchQuery('');

    if (key === 'reports') navigate('/reports');
    else if (key === 'settings') navigate('/settings');
    else setActiveSection(key);
  };

  const searchEmptyMessage = (entity, defaultMessage) =>
    normalizedSearch
      ? `Aucun ${entity} ne correspond à « ${searchQuery.trim()} ».`
      : defaultMessage;

  const handleAddClient = async (e) => {
    e.preventDefault();
    if (!newClient.lastName || !newClient.firstName || !newClient.phone) { 
      showToast({ type: 'warning', message: 'Veuillez remplir les champs obligatoires.' }); 
      return; 
    }
    try {
      await createClient.mutateAsync(newClient);
      setClientModalOpen(false);
      setNewClient({ ...CLIENT_INIT });
      showToast({ type: 'success', message: 'Client ajouté avec succès !' });
    } catch (err) { 
      showToast({ type: 'error', message: 'Erreur: ' + err.message }); 
    }
  };

  const handleAddProperty = async (e) => {
    e.preventDefault();
    if (!newProperty.name || !newProperty.address) { 
      showToast({ type: 'warning', message: 'Veuillez remplir les champs obligatoires.' }); 
      return; 
    }
    try {
      await createProperty.mutateAsync(newProperty);
      setPropertyModalOpen(false);
      setNewProperty({ ...PROPERTY_INIT });
      showToast({ type: 'success', message: 'Bien immobilier ajouté avec succès !' });
    } catch (err) { 
      showToast({ type: 'error', message: 'Erreur: ' + err.message }); 
    }
  };

  return (
    <div className="space-y-8 w-full max-w-full overflow-hidden box-border">

      {loading && (
        <div className="bg-blue-50 text-blue-700 p-4 rounded-lg flex items-center gap-3">
          <i className="fas fa-spinner fa-spin"></i>
          <span>Synchronisation des données en cours...</span>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 text-rose-700 p-4 rounded-lg flex items-center gap-3">
          <i className="fas fa-exclamation-circle"></i>
          <span>Impossible de synchroniser les données. Les derniers chiffres disponibles restent affichés.</span>
        </div>
      )}

      {/* HEADER + FILTRE TEMPOREL */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bienvenue sur SYGIM</h1>
          <p className="text-slate-500 text-sm mt-0.5">Vue d'ensemble de votre patrimoine immobilier.</p>
        </div>
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

      {error && (
        <div className="bg-rose-50 text-rose-700 p-4 rounded-lg flex items-center gap-3">
          <i className="fas fa-exclamation-circle"></i>
          <span>Impossible de synchroniser les données. Les derniers chiffres disponibles restent affichés.</span>
        </div>
      )}

      {isFirstVisit ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
            <i className="fas fa-building text-2xl"></i>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Commencez par enregistrer votre premier bien</h2>
          <p className="text-slate-500 max-w-md mx-auto mb-6">Le suivi des loyers, de l'occupation et du recouvrement apparaîtra ici dès que votre portefeuille sera renseigné.</p>
          <button className="bg-primary text-white px-6 py-2 rounded-lg font-medium hover:bg-primary-dark transition-colors" onClick={() => navigate('/admin/properties')}>
            Ajouter un bien
          </button>
        </div>
      ) : (
        <>
          {/* ACTION 2: KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            {/* KPI 1 */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col justify-between hover:shadow-md transition-all">
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Recettes totales</div>
                <div className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">{formatXOF(totalRevenue)}</div>
              </div>
              <div className={`text-xs mt-4 flex items-center gap-1.5 ${totalRevenue > 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                <i className={`fas ${totalRevenue > 0 ? 'fa-arrow-trend-up' : 'fa-minus'}`}></i>
                Loyers perçus
              </div>
            </div>
            
            {/* KPI 2 */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col justify-between hover:shadow-md transition-all">
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Taux d'occupation</div>
                <div className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">{occupancyRate}%</div>
              </div>
              <div className="text-xs text-slate-500 mt-4 flex items-center gap-1.5">
                <i className="fas fa-building"></i>
                {occupiedCount} sur {propStats.total || 0} biens loués
              </div>
            </div>
            
            {/* KPI 3 */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col justify-between hover:shadow-md transition-all">
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Retards de paiement</div>
                <div className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">{pendingPaymentsCount}</div>
              </div>
              <div className={`text-xs mt-4 flex items-center gap-1.5 ${pendingPaymentsCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                <i className={`fas ${pendingPaymentsCount > 0 ? 'fa-triangle-exclamation' : 'fa-check-circle'}`}></i>
                Reste dû : {formatXOF(totalDue - totalRevenue, { compact: false })}
              </div>
            </div>
            
            {/* KPI 4 */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col justify-between hover:shadow-md transition-all">
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Recouvrement</div>
                <div className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">{collectionRate}%</div>
              </div>
              <div className={`text-xs mt-4 flex items-center gap-1.5 ${collectionRate >= 80 ? 'text-emerald-600' : collectionRate > 0 ? 'text-amber-600' : 'text-slate-500'}`}>
                <i className="fas fa-bullseye"></i>
                Objectif global : 80%
              </div>
            </div>
          </div>

          {/* ACTION 2.5: GRAPHIQUES */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-6">Répartition des Biens</h3>
              {propertyStatusData.length > 0 ? (
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={propertyStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {propertyStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value) => [value, 'Biens']} 
                        contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
                      />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-slate-400 text-sm">
                  Aucune donnée disponible
                </div>
              )}
            </div>
            
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-center items-center text-center">
              <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mb-4">
                <i className="fas fa-chart-line text-2xl"></i>
              </div>
              <h3 className="text-slate-900 font-medium mb-1">Croissance des revenus</h3>
              <p className="text-slate-500 text-sm">Collectez plus de données pour débloquer l'analyse temporelle.</p>
            </div>
          </div>

          {/* ACTION 3: SECTIONS DE CONTENU */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-slate-900">Activité récente</h3>
                <button onClick={() => navigate('/admin/transactions')} className="text-sm font-medium text-primary hover:text-primary-dark transition-colors">
                  Voir tout <i className="fas fa-arrow-right ml-1"></i>
                </button>
              </div>
              
              {transactions.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">
                  Aucune transaction enregistrée.
                </div>
              ) : (
                <div className="relative pl-3 mt-4 mb-2 space-y-6 border-l-2 border-slate-200 ml-4">
                  {transactions.slice(0, 5).map(tx => {
                    const isPaid = tx.status === 'processed' || tx.status === 'paid' || tx.status === 'completed';
                    const isPending = tx.status === 'pending';
                    const dotColor = isPaid ? 'bg-emerald-500' : (isPending ? 'bg-amber-500' : 'bg-rose-500');
                    return (
                      <div key={tx.id || tx.reference} className="relative">
                        <div className={`absolute -left-[23px] w-3.5 h-3.5 rounded-full border-2 border-white ${dotColor} shadow-sm`}></div>
                        <div className="pl-4">
                          <p className="text-sm font-medium text-slate-900">
                            {isPaid ? 'Encaissé' : isPending ? 'En attente de' : 'Annulé'} <span className={`font-bold ${isPaid ? 'text-emerald-600' : isPending ? 'text-amber-600' : 'text-rose-600'}`}>{formatXOF(tx.amount, { compact: false })}</span> de {tx.client}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            <i className="far fa-clock mr-1"></i> {formatDate(tx.date || tx.createdAt)} • {formatMethod(tx.method)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-6">Santé Système</h3>
              <ul className="space-y-4">
                <li className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <i className="fas fa-server text-slate-400"></i>
                    <span className="text-sm font-medium text-slate-700">API SYGIM</span>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Opérationnel
                  </span>
                </li>
                <li className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <i className="fas fa-database text-slate-400"></i>
                    <span className="text-sm font-medium text-slate-700">Base de données</span>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Connectée
                  </span>
                </li>
                <li className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <i className="fas fa-envelope text-slate-400"></i>
                    <span className="text-sm font-medium text-slate-700">Service Mail</span>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Actif
                  </span>
                </li>
              </ul>
              
              <div className="mt-8 pt-6 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Raccourcis</h4>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => navigate('/admin/clients')} className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-primary/30 transition-colors text-slate-600 hover:text-primary">
                    <i className="fas fa-user-plus mb-2 text-lg"></i>
                    <span className="text-xs font-medium">Locataire</span>
                  </button>
                  <button onClick={() => navigate('/admin/properties')} className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-primary/30 transition-colors text-slate-600 hover:text-primary">
                    <i className="fas fa-home mb-2 text-lg"></i>
                    <span className="text-xs font-medium">Bien</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
