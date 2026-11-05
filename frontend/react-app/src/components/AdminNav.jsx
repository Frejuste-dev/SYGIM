import React from 'react';

const TABS = [
  { key: 'access', icon: 'fa-users-cog', label: 'Utilisateurs' },
  { key: 'dashboard', icon: 'fa-tachometer-alt', label: 'Tableau de bord' },
  { key: 'data', icon: 'fa-database', label: 'Données' },
  { key: 'logs', icon: 'fa-history', label: 'Journal' },
  { key: 'settings', icon: 'fa-cog', label: 'Paramètres' }
];

export default function AdminNav({ activeTab, onTabChange }) {
  return (
    <div className="admin-nav overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {TABS.map(tab => (
        <button
          key={tab.key}
          className={`admin-tab ${activeTab === tab.key ? 'active' : ''}`}
          onClick={() => onTabChange(tab.key)}
        >
          <i className={`fas ${tab.icon}`}></i> {tab.label}
        </button>
      ))}
    </div>
  );
}
