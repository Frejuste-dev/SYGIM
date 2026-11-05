import React from 'react';

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Tableau de bord', icon: 'fa-th-large' },
  { key: 'portfolio', label: 'Portefeuille', icon: 'fa-layer-group', badgeKey: 'properties' },
  { key: 'clients', label: 'Locataires', icon: 'fa-users', badgeKey: 'clients' },
  { key: 'payments', label: 'Transactions', icon: 'fa-exchange-alt' },
  { key: 'reports', label: 'Rapports', icon: 'fa-chart-bar' },
  { key: 'analytics', label: 'Analyse', icon: 'fa-chart-line' },
  { key: 'owners', label: 'Propriétaires', icon: 'fa-user-tie', badgeKey: 'owners' },
  { key: 'settings', label: 'Paramètres', icon: 'fa-cog' },
];

const BADGE_COUNTS = { properties: 0, clients: 0, owners: 0 };

export default function DashboardSidebar({ activeSection, onNavigate, onLogout, badgeCounts }) {
  const counts = { ...BADGE_COUNTS, ...badgeCounts };

  return (
    <div className="sidebar w-[260px] shrink-0 flex flex-col h-full">
      <div className="sidebar-header p-6 flex items-center gap-2.5">
        <i className="fas fa-building text-[24px] text-primary"></i>
        <span className="text-[20px] font-bold">SYGIM</span>
      </div>
      <div className="sidebar-menu">
        {NAV_ITEMS.map(item => (
          <div key={item.key}
            className={`menu-item ${activeSection === item.key ? 'active' : ''} flex items-center py-3 px-6 cursor-pointer transition-all duration-200 gap-3`}
            onClick={() => onNavigate(item.key)}>
            <i className={`fas ${item.icon}`}></i>
            <span className="flex-1">{item.label}</span>
            {item.badgeKey !== undefined && (
              <span className="menu-badge bg-slate-200 px-2 py-0.5 rounded-full text-[11px]">
                {counts[item.badgeKey]}
              </span>
            )}
          </div>
        ))}
        <div className="menu-item flex items-center py-3 px-6 cursor-pointer gap-3 mt-auto text-rose-600" onClick={onLogout}>
          <i className="fas fa-sign-out-alt"></i>
          <span>Déconnexion</span>
        </div>
      </div>
    </div>
  );
}

export { NAV_ITEMS };
