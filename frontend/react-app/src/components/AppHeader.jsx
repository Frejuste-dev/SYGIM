import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';

export default function AppHeader({
  title,
  showSyncAction = true,
  syncAppearance = 'success',
  showSyncProgress = false
}) {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDark, setIsDark] = useState(document.body.classList.contains('dark-mode'));
  const syncClass = syncAppearance === 'outline' ? 'btn-outline' : 'btn-success';

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    await queryClient.invalidateQueries();
    setIsSyncing(false);
  };

  const toggleTheme = () => {
    document.body.classList.toggle('dark-mode');
    setIsDark(document.body.classList.contains('dark-mode'));
  };

  return (
    <div className="header">
      <h1 className="header-title">{title}</h1>
      <div className="header-actions">
        <button className="btn btn-secondary" onClick={toggleTheme}
          title={isDark ? 'Activer le thème clair' : 'Activer le thème sombre'}
          aria-label={isDark ? 'Activer le thème clair' : 'Activer le thème sombre'}>
          <i className={isDark ? 'fas fa-sun' : 'fas fa-moon'}></i>
        </button>
        {showSyncAction && (
          <button className={`btn ${syncClass} btn-small app-header-sync-action`} onClick={handleSync}
            title="Synchroniser les données" disabled={isSyncing}>
            <i className={`fas fa-sync-alt ${isSyncing ? 'fa-spin' : ''}`}></i>
            <span>{isSyncing ? 'Synchronisation...' : 'Synchroniser les données'}</span>
          </button>
        )}
        <div className="user-profile app-header-user-profile">
          <div className="avatar">{user?.displayName?.slice(0, 2).toUpperCase() || 'US'}</div>
          <div>
            <div className="font-semibold">{user?.displayName || 'Utilisateur'}</div>
            <button className="btn btn-outline btn-small mt-1" onClick={logout}>
              <i className="fas fa-sign-out-alt"></i> Déconnexion
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
