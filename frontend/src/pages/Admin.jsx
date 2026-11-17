import React, { useState, useEffect } from 'react';
import { useNavigate, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { API } from '../api/services';
import { useConfirm } from '../components/ConfirmContext';
import { useNotifications, useOverdueAlerts } from '../hooks/queries/useNotifications';

export default function Admin() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { confirm } = useConfirm();
  const { data: notifData = {} } = useNotifications();
  const unreadCount = notifData.unreadCount || 0;
  const { data: alertsData = {} } = useOverdueAlerts();
  const overdueAlerts = alertsData.alerts || [];
  const overdueCount = alertsData.count ?? overdueAlerts.length;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleMobileLogout = async () => {
    const isConfirmed = await confirm('Voulez-vous vraiment vous déconnecter de votre tournée en cours ?');
    if (isConfirmed) {
      await handleLogout();
    }
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin' || user?.isSuperAdmin;
  const userRole = user?.role?.toLowerCase() || '';
  const isManager = userRole === 'manager' || userRole === 'collector_manager';
  const totalNotifications = isManager ? unreadCount : (unreadCount + overdueCount);

  const dashboardPath = userRole === 'collector' || userRole === 'collecteur' 
    ? '/admin/collector' 
    : isManager 
      ? '/admin/manager' 
      : '/admin/dashboard';

  // Navigation dédiée pour le rôle MANAGER
  const managerMenuItems = [
    { name: 'Tableau de bord', path: '/admin/manager', icon: 'fas fa-chart-pie' },
    { name: 'Biens immobiliers', path: '/admin/properties', icon: 'fas fa-building' },
    { name: 'Propriétaires', path: '/admin/owners', icon: 'fas fa-user-tie' },
    { name: 'Locataires', path: '/admin/clients', icon: 'fas fa-users' },
    { name: 'Attributions', path: '/admin/property-assignments', icon: 'fas fa-handshake' },
    { name: 'Rapports', path: '/admin/reports', icon: 'fas fa-file-alt' },
    { name: 'Journal d\'activité', path: '/admin/activity', icon: 'fas fa-history' },
    { name: 'Notifications', path: '/admin/notifications', icon: 'fas fa-bell', badge: unreadCount },
  ];

  const navigationSections = [
    {
      title: 'PRINCIPAL',
      items: [
        { name: 'Tableau de bord', path: dashboardPath, icon: 'fas fa-chart-pie', roles: ['admin', 'super_admin', 'gestionnaire', 'collecteur', 'collector', 'director', 'accounting'] },
      ]
    },
    {
      title: 'GESTION',
      items: [
        { name: 'Utilisateurs', path: '/admin/users', icon: 'fas fa-users', roles: ['admin', 'super_admin'] },
        { name: 'Propriétés', path: '/admin/properties', icon: 'fas fa-building', roles: ['admin', 'super_admin', 'gestionnaire', 'director', 'accounting', 'collector', 'collecteur'] },
        { name: 'Attributions', path: '/admin/property-assignments', icon: 'fas fa-handshake', roles: ['admin', 'super_admin', 'director'] },
        { name: 'Locataires', path: '/admin/clients', icon: 'fas fa-user-friends', roles: ['admin', 'super_admin', 'gestionnaire', 'director', 'accounting'] },
        { name: 'Propriétaires', path: '/admin/owners', icon: 'fas fa-user-tie', roles: ['admin', 'super_admin', 'gestionnaire', 'director', 'accounting'] },
        { name: 'Transactions', path: '/admin/transactions', icon: 'fas fa-exchange-alt', roles: ['admin', 'super_admin', 'gestionnaire', 'director', 'accounting'] },
      ]
    },
    {
      title: 'ANALYSE',
      items: [
        { name: 'Rapports', path: '/admin/reports', icon: 'fas fa-file-alt', roles: ['admin', 'super_admin', 'director', 'accounting', 'gestionnaire', 'manager', 'collector_manager'] },
        { name: 'Journal d\'activité', path: '/admin/activity', icon: 'fas fa-history', roles: ['admin', 'super_admin', 'director', 'accounting'] },
        { name: 'Notifications', path: '/admin/notifications', icon: 'fas fa-bell', roles: ['admin', 'super_admin', 'director', 'accounting'], badge: totalNotifications },
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
      ? "w-[calc(100%-1rem)] mx-2 text-left px-3.5 py-2.5 border-none cursor-pointer flex items-center gap-3 bg-primary/10 text-primary rounded-xl font-semibold transition-colors"
      : "w-[calc(100%-1rem)] mx-2 text-left px-3.5 py-2.5 bg-transparent border-none text-slate-700 cursor-pointer flex items-center gap-3 hover:bg-slate-100/70 hover:text-slate-900 rounded-xl font-medium transition-colors";

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const handleNotificationClick = (path) => {
    setIsNotificationsOpen(false);
    navigate(path);
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* SIDEBAR */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}
      <aside className={`w-64 lg:w-[268px] bg-white border-r border-slate-200 flex-col z-50 fixed inset-y-0 left-0 transform transition-transform duration-300 md:z-20 md:relative md:translate-x-0 md:flex ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* EN-TÊTE SIDEBAR */}
        <div className="h-16 flex items-center gap-3 border-b border-slate-200 px-6 shrink-0">
          <i className="fas fa-building text-primary text-2xl"></i>
          <span className="text-primary font-bold text-xl tracking-wide">SYGIM</span>
        </div>
        
        <nav className="flex-1 py-4 overflow-y-auto">
          {isManager ? (
            <div>
              <div className="px-6 mb-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-2">
                ESPACE MANAGER
              </div>
              {managerMenuItems.map((item) => (
                <NavLink key={item.path} to={item.path} className={navLinkStyle}>
                  <i className={`${item.icon} w-4 text-center text-slate-400 shrink-0`}></i>
                  <span className="flex-1 truncate whitespace-nowrap text-sm">{item.name}</span>
                  {Boolean(item.badge) && item.badge > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white shadow-2xs shrink-0">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ) : (
            navigationSections.map((section, sIdx) => {
              const visibleItems = section.items.filter(item => item.roles.includes(userRole));
              if (visibleItems.length === 0) return null;
              return (
                <React.Fragment key={section.title}>
                  <div className={`px-6 mb-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider ${sIdx > 0 ? 'mt-6' : 'mt-2'}`}>
                    {section.title}
                  </div>
                  {visibleItems.map(item => (
                    <NavLink key={item.path} to={item.path} className={navLinkStyle}>
                      <i className={`${item.icon} w-4 text-center text-slate-400 shrink-0`}></i>
                      <span className="flex-1 truncate whitespace-nowrap text-sm">{item.name}</span>
                      {Boolean(item.badge) && item.badge > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white shadow-2xs shrink-0">
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  ))}
                </React.Fragment>
              );
            })
          )}
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
                className="text-slate-500 hover:text-slate-900 text-lg relative focus:outline-none mr-2 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                onClick={() => {
                  if (isManager) {
                    navigate('/admin/notifications');
                  } else {
                    setIsNotificationsOpen(!isNotificationsOpen);
                  }
                }}
                title="Alertes & Notifications"
              >
                <i className="fas fa-bell"></i>
                {totalNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white ring-2 ring-white animate-pulse">
                    {totalNotifications}
                  </span>
                )}
              </button>

              {isNotificationsOpen && (
                <div className="absolute right-0 mt-3 w-88 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-800">Alertes & Notifications</span>
                      {totalNotifications > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                          {totalNotifications}
                        </span>
                      )}
                    </div>
                    <button 
                      type="button"
                      onClick={() => handleNotificationClick('/admin/notifications')}
                      className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                    >
                      Ouvrir le centre
                    </button>
                  </div>

                  <div className="max-h-[340px] overflow-y-auto divide-y divide-slate-100">
                    {overdueAlerts.length > 0 ? (
                      overdueAlerts.slice(0, 6).map((alert) => {
                        const clientName = (alert.first_name || alert.last_name) 
                          ? `${alert.first_name || ''} ${alert.last_name || ''}`.trim()
                          : alert.client_name || alert.clientName || alert.tenant_name || 'Client';
                        const propertyName = alert.property_name || alert.propertyName || alert.property || 'Bien';
                        const amountOwed = alert.amount_owed || alert.rent_due || 0;
                        const isCritique = alert.severity === 'critique';

                        return (
                          <div 
                            key={alert.id || Math.random()} 
                            onClick={() => handleNotificationClick('/admin/notifications')}
                            className="px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors flex items-start gap-3"
                          >
                            <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs ${
                              isCritique ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-700'
                            }`}>
                              <i className="fas fa-exclamation-triangle"></i>
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1">
                                <p className="text-xs text-slate-800 font-bold truncate">{clientName}</p>
                                <span className="text-[11px] font-bold text-rose-600 shrink-0">
                                  {Number(amountOwed).toLocaleString('fr-FR')} XOF
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 truncate mt-0.5">{propertyName}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-[9px] uppercase font-bold px-1.5 py-0.2 rounded ${
                                  isCritique ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}>
                                  {alert.severity || 'Impayé'}
                                </span>
                                <span className="text-[10px] text-slate-400">En retard de loyer</span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="px-4 py-8 text-center text-slate-400 text-xs">
                        <i className="fas fa-bell-slash text-2xl mb-1 text-slate-300 block"></i>
                        Aucune alerte urgente pour le moment.
                      </div>
                    )}
                    {overdueAlerts.length > 6 && (
                      <div className="p-2 text-center text-[11px] font-semibold text-slate-500 bg-slate-50/50">
                        + {overdueAlerts.length - 6} autre(s) dossier(s) d'impayé en attente
                      </div>
                    )}
                  </div>

                  <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex flex-col gap-1.5">
                    <button 
                      type="button"
                      onClick={() => handleNotificationClick('/admin/notifications')} 
                      className="w-full py-2 px-3 text-xs font-bold text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                    >
                      <i className="fas fa-layer-group text-[10px]"></i>
                      <span>Accéder au Centre de Notifications ({totalNotifications})</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => handleNotificationClick('/admin/reports?tab=overdue')} 
                      className="w-full py-1.5 px-3 text-[11px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer text-center"
                    >
                      Voir le plan de relance & recouvrement →
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
              onClick={handleMobileLogout} 
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
