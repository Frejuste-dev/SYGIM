import React, { useState, useEffect } from 'react';
import { useNavigate, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useClientStats } from '../hooks/queries/useClients';
import { usePropertyStats } from '../hooks/queries/useProperties';
import { useTransactionStats } from '../hooks/queries/useTransactions';
import { useOwnerStats } from '../hooks/queries/useOwners';
import { API } from '../api/services';
import AdminNav from '../components/AdminNav';
import StatsCard from '../components/StatsCard';
import UsersTable from '../components/UsersTable';
import UserFormModal from '../components/UserFormModal';
import OverdueAlertPanel from '../components/OverdueAlertPanel';
import DataIntegrityPanel from '../components/DataIntegrityPanel';
import ActivityLog from '../components/ActivityLog';
import SystemSettingsPanel from '../components/SystemSettingsPanel';
import { useToast } from '../components/ToastContext';
import { useConfirm } from '../components/ConfirmContext';

export default function Admin() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin' || user?.isSuperAdmin;
  const userRole = user?.role?.toLowerCase() || '';

  const dashboardPath = userRole === 'collector' || userRole === 'collecteur' 
    ? '/admin/collector' 
    : userRole === 'collector_manager' || userRole === 'manager' 
      ? '/admin/manager' 
      : '/admin/dashboard';

  const navigationSections = [
    {
      title: 'PRINCIPAL',
      items: [
        { name: 'Tableau de bord', path: dashboardPath, icon: 'fas fa-chart-pie', roles: ['admin', 'super_admin', 'gestionnaire', 'collecteur', 'collector', 'collector_manager', 'director', 'accounting'] },
      ]
    },
    {
      title: 'GESTION',
      items: [
        { name: 'Utilisateurs', path: '/admin/users', icon: 'fas fa-users', roles: ['admin', 'super_admin'] },
        { name: 'Propriétés', path: '/admin/properties', icon: 'fas fa-building', roles: ['admin', 'super_admin', 'gestionnaire', 'director', 'accounting', 'collector_manager'] },
        { name: 'Locataires', path: '/admin/clients', icon: 'fas fa-user-friends', roles: ['admin', 'super_admin', 'gestionnaire', 'director', 'accounting', 'collector_manager'] },
        { name: 'Propriétaires', path: '/admin/owners', icon: 'fas fa-user-tie', roles: ['admin', 'super_admin', 'gestionnaire', 'director', 'accounting', 'collector_manager'] },
        { name: 'Transactions', path: '/admin/transactions', icon: 'fas fa-exchange-alt', roles: ['admin', 'super_admin', 'gestionnaire', 'collector_manager', 'director', 'accounting'] },
      ]
    },
    {
      title: 'ANALYSE',
      items: [
        { name: 'Rapports', path: '/admin/reports', icon: 'fas fa-file-alt', roles: ['admin', 'super_admin', 'director', 'accounting'] },
        { name: 'Journal d\'activité', path: '/admin/activity', icon: 'fas fa-history', roles: ['admin', 'super_admin'] },
      ]
    },
    {
      title: 'SYSTÈME',
      items: [
        { name: 'Paramètres', path: '/admin/settings', icon: 'fas fa-cog', roles: ['super_admin', 'admin'] },
      ]
    }
  ];

  const navLinkStyle = ({ isActive }) => 
    isActive
      ? "w-full text-left px-6 py-2.5 border-none cursor-pointer flex items-center gap-3 bg-primary/10 text-primary rounded-r-full mr-4 font-medium transition-colors"
      : "w-full text-left px-6 py-2.5 bg-transparent border-none text-slate-700 cursor-pointer flex items-center gap-3 hover:bg-slate-50 hover:text-slate-900 rounded-r-full mr-4 transition-colors";

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const handleNotificationClick = (path) => {
    setIsNotificationsOpen(false);
    navigate(path);
  };

  const [overdueAlerts, setOverdueAlerts] = useState([]);

  useEffect(() => {
    API.Alerts.getOverduePayments()
      .then(res => { if (res?.success) setOverdueAlerts(res.data); })
      .catch(() => {});
  }, []);

  return (
    <div className="flex h-screen w-full bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* SIDEBAR */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}
      <aside className={`w-64 bg-white border-r border-slate-200 flex-col z-50 fixed inset-y-0 left-0 transform transition-transform duration-300 md:z-20 md:relative md:translate-x-0 md:flex ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* EN-TÊTE SIDEBAR */}
        <div className="h-16 flex items-center gap-3 border-b border-slate-200 px-6 shrink-0">
          <i className="fas fa-building text-primary text-2xl"></i>
          <span className="text-primary font-bold text-xl tracking-wide">SYGIM</span>
        </div>
        
        <nav className="flex-1 py-4 overflow-y-auto">
          {navigationSections.map((section, sIdx) => {
            const visibleItems = section.items.filter(item => item.roles.includes(userRole));
            if (visibleItems.length === 0) return null;
            return (
              <React.Fragment key={section.title}>
                <div className={`px-6 mb-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider ${sIdx > 0 ? 'mt-6' : 'mt-2'}`}>
                  {section.title}
                </div>
                {visibleItems.map(item => (
                  <NavLink key={item.path} to={item.path} className={navLinkStyle}>
                    <i className={`${item.icon} w-4 text-slate-400`}></i> {item.name}
                  </NavLink>
                ))}
              </React.Fragment>
            );
          })}
        </nav>
      </aside>

      {/* CONTENU PRINCIPAL */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        
        {/* HEADER FIXE EN HAUT */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-3 sm:px-6 z-10 shrink-0">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <button 
              className="md:hidden p-2 text-slate-600 hover:text-slate-900 focus:outline-none"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Ouvrir le menu"
            >
              <i className="fas fa-bars text-xl"></i>
            </button>
            {/* Titre dynamique possible ici avec Outlet context ou matches */}
            <div className="text-sm text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis">
              SYGIM <span className="mx-2">/</span> <span className="text-slate-900 font-medium">Administration</span>
            </div>
          </div>
          
          <div className="flex items-center gap-5">
            <span className="text-sm text-slate-500 hidden sm:inline">Dernière synchro : il y a 2 min</span>
            <button className="text-slate-500 hover:text-slate-900 p-2" title="Actualiser">
              <i className="fas fa-sync-alt"></i>
            </button>
            
            <div className="relative">
              <button 
                className="text-slate-500 hover:text-slate-900 text-lg relative focus:outline-none mr-2"
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              >
                <i className="fas fa-bell"></i>
                {overdueAlerts.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white ring-2 ring-white">
                    {overdueAlerts.length}
                  </span>
                )}
              </button>

              {isNotificationsOpen && (
                <div className="absolute right-0 mt-3 w-80 bg-white rounded-xl shadow-lg border border-slate-200 z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                    <h3 className="text-sm font-bold text-slate-800">Notifications</h3>
                  </div>
                  <div className="max-h-[320px] overflow-y-auto divide-y divide-slate-100">
                    {overdueAlerts.length > 0 ? overdueAlerts.map(alert => {
                      const clientName = (alert.first_name || alert.last_name) 
                        ? `${alert.first_name || ''} ${alert.last_name || ''}`.trim()
                        : alert.client_name || alert.clientName || alert.tenant_name || 'Client inconnu';
                      const propertyName = alert.property_name || alert.propertyName || alert.property || 'Propriété';
                      const alertTarget = userRole === 'collector' || userRole === 'collecteur' ? '/admin/collector' : '/admin/transactions';
                      return (
                      <div key={alert.id || Math.random()} 
                           onClick={() => handleNotificationClick(alertTarget)}
                           className="px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors">
                        <p className="text-sm text-slate-800 font-medium">Loyer en retard</p>
                        <p className="text-xs text-slate-500 mt-1">{clientName} - {propertyName}</p>
                      </div>
                      );
                    }) : (
                      <div className="px-4 py-6 text-center text-slate-500 text-sm">
                        Aucune notification pour le moment.
                      </div>
                    )}
                  </div>
                  <div className="p-2 bg-slate-50 border-t border-slate-100">
                    <button 
                      onClick={() => handleNotificationClick(userRole === 'collector' || userRole === 'collecteur' ? '/admin/collector' : '/admin/transactions')} 
                      className="w-full py-2 text-sm font-medium text-primary hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    >
                      Voir toutes les alertes
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div className="h-8 w-px bg-slate-200 hidden md:block"></div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm shadow-sm">
                  {user ? ((user.firstName?.[0] || '') + (user.lastName?.[0] || '')).toUpperCase() || user.username?.slice(0, 2).toUpperCase() : 'SA'}
                </div>
                <div className="hidden md:block text-left">
                  <p className="font-semibold text-slate-700 text-sm leading-none">{user?.firstName || user?.username} {user?.lastName}</p>
                  <p className="text-slate-500 text-xs mt-1 capitalize">{user?.role?.replace('_', ' ')}</p>
                </div>
              </div>

              <button 
                onClick={handleLogout} 
                className="ml-2 w-9 h-9 flex items-center justify-center text-slate-400 hover:text-danger hover:bg-red-50 rounded-full transition-colors"
                title="Se déconnecter"
              >
                <i className="fas fa-sign-out-alt text-lg"></i>
              </button>
            </div>
          </div>
        </header>

        {/* ZONE DE DONNÉES */}
        <main className={`flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-6 md:p-8 bg-slate-50 ${userRole === 'collector' ? 'pb-24 md:pb-8' : ''}`}>
           <Outlet />
        </main>

        {/* BARRE DE NAVIGATION MOBILE BAS D'ÉCRAN (Spécifique Collecteur Terrain) */}
        {userRole === 'collector' && (
          <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200 z-40 flex items-center justify-around h-16 px-4 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
            <NavLink 
              to="/admin/collector" 
              className={({ isActive }) => `flex flex-col items-center justify-center flex-1 py-1 text-[11px] font-semibold transition-colors ${isActive ? 'text-primary' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <i className="fas fa-route text-lg mb-0.5"></i>
              <span>Tournée</span>
            </NavLink>
            <NavLink 
              to="/admin/profile" 
              className={({ isActive }) => `flex flex-col items-center justify-center flex-1 py-1 text-[11px] font-semibold transition-colors ${isActive ? 'text-primary' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <i className="fas fa-user text-lg mb-0.5"></i>
              <span>Profil</span>
            </NavLink>
            <button 
              onClick={handleLogout} 
              className="flex flex-col items-center justify-center flex-1 py-1 text-[11px] font-semibold text-rose-500 hover:text-rose-600 transition-colors"
            >
              <i className="fas fa-sign-out-alt text-lg mb-0.5"></i>
              <span>Quitter</span>
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}
