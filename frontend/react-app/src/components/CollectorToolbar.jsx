import React from 'react';

export default function CollectorToolbar({
  searchTerm, onSearchChange,
  showOnlyAgent, onToggleAgent,
  onAddTenant, onRefresh, isRefreshing
}) {
  return (
    <div className="collector-toolbar">
      <div className="collector-toolbar-search">
        <i className="fas fa-search" aria-hidden="true"></i>
        <input
          type="text"
          placeholder="Rechercher par nom, adresse ou téléphone"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="collector-segment" role="group" aria-label="Filtrer les locataires">
        <button
          className={showOnlyAgent ? 'active' : ''}
          onClick={() => onToggleAgent(true)}
          type="button"
        >
          Mes locataires
        </button>
        <button
          className={!showOnlyAgent ? 'active' : ''}
          onClick={() => onToggleAgent(false)}
          type="button"
        >
          Tous les locataires
        </button>
      </div>

      <button className="btn btn-outline collector-add-action" onClick={onAddTenant} type="button">
        <i className="fas fa-user-plus"></i> Ajouter locataire
      </button>

      <button
        className="btn btn-outline collector-sync-action"
        onClick={onRefresh}
        disabled={isRefreshing}
        type="button"
        title="Synchroniser les données"
        aria-label="Synchroniser les données"
      >
        <i className={`fas fa-sync ${isRefreshing ? 'fa-spin' : ''}`}></i>
        <span>{isRefreshing ? 'Synchronisation...' : 'Synchroniser'}</span>
      </button>
    </div>
  );
}
