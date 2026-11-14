import React, { useState, useEffect, useRef } from 'react';
import TableSkeleton from './ui/TableSkeleton';

const ROLE_LABELS = {
  admin: 'Administrateur',
  director: 'Directeur',
  accounting: 'Comptable',
  collector_manager: 'Manager des Récolteurs',
  collector: 'Récolteur'
};

export default function UsersTable({
  users, loading, error, notice, search, roleFilter, statusFilter,
  onSearchChange, onRoleFilterChange, onStatusFilterChange,
  onRefresh, onToggleStatus, onDelete, onAdd, onEdit, onResetPassword
}) {
  const hasActiveFilters = Boolean(search || roleFilter || statusFilter);
  const filteredUsers = users.filter(u => {
    const q = search.toLowerCase();
    return (
      (u.username || '').toLowerCase().includes(q) ||
      (u.firstName || u.first_name || '').toLowerCase().includes(q) ||
      (u.lastName || u.last_name || '').toLowerCase().includes(q) ||
      (u.role || '').toLowerCase().includes(q)
    ) && (roleFilter ? u.role === roleFilter : true)
      && (statusFilter
        ? (statusFilter === 'active' ? u.active || u.active === 1 : !u.active && u.active !== 1)
        : true);
  });

  const emptyTitle = hasActiveFilters
    ? 'Aucun utilisateur ne correspond aux filtres.'
    : 'Aucun utilisateur créé.';
  const emptyDetail = hasActiveFilters
    ? 'Modifiez la recherche, le rôle ou le statut pour élargir les résultats.'
    : 'Créez le premier compte pour donner accès à la plateforme.';

  const totalUsers = users.length;
  const activeUsers = users.filter(u => u.active || u.active === 1).length;
  const inactiveUsers = totalUsers - activeUsers;
  const rolesCount = new Set(users.map(u => u.role)).size;

  return (
    <div className="flex flex-col gap-6">
      
      {/* 1. En-tête de page & Statistiques */}
      <div>
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 m-0 pb-1">Utilisateurs</h1>
            <p className="text-slate-500 m-0 text-sm">Gérez les comptes et leurs permissions</p>
          </div>
          <button className="bg-primary text-white px-5 py-2.5 rounded-lg font-medium hover:bg-primary-dark shadow-sm transition-all border-none cursor-pointer flex items-center gap-2 self-start shrink-0" onClick={onAdd} type="button">
            <i className="fas fa-plus"></i> Nouvel utilisateur
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col gap-2">
            <span className="text-xs text-slate-500 font-semibold uppercase">Total</span>
            <span className="text-2xl font-bold text-slate-900">{totalUsers}</span>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col gap-2">
            <span className="text-xs text-slate-500 font-semibold uppercase">Actifs</span>
            <span className="text-2xl font-bold text-slate-900">{activeUsers}</span>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col gap-2">
            <span className="text-xs text-slate-500 font-semibold uppercase">Inactifs</span>
            <span className="text-2xl font-bold text-slate-900">{inactiveUsers}</span>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col gap-2">
            <span className="text-xs text-slate-500 font-semibold uppercase">Rôles distincts</span>
            <span className="text-2xl font-bold text-slate-900">{rolesCount}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-600/10 text-red-600 rounded-md flex items-center gap-2" role="alert">
          <i className="fas fa-exclamation-circle" aria-hidden="true"></i>
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="px-4 py-3 bg-green-600/10 text-green-600 rounded-md flex items-center gap-2" role="status">
          <i className="fas fa-check-circle" aria-hidden="true"></i>
          <span>{notice.message}</span>
        </div>
      )}

      {/* 2. La Toolbar (Recherche et Filtres) */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <div className="relative flex-1 min-w-[250px]">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input type="text" placeholder="Rechercher un utilisateur..."
              value={search} onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm" />
          </div>
          <select value={roleFilter} onChange={(e) => onRoleFilterChange(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm focus:outline-none focus:border-primary cursor-pointer w-full md:w-auto shadow-sm">
            <option value="">Tous les rôles</option>
            {Object.entries(ROLE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => onStatusFilterChange(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm focus:outline-none focus:border-primary cursor-pointer w-full md:w-auto shadow-sm">
            <option value="">Tous les statuts</option>
            <option value="active">Actifs</option>
            <option value="inactive">Inactifs</option>
          </select>
          <button className="bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 px-3 py-2 rounded-lg focus:outline-none cursor-pointer shadow-sm transition-colors" onClick={onRefresh} type="button" aria-label="Actualiser la liste" title="Actualiser la liste">
            <i className="fas fa-sync"></i>
          </button>
        </div>
        <div className="text-sm text-slate-500 font-medium hidden md:block">
          {filteredUsers.length} utilisateur{filteredUsers.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* 3. Le Tableau */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3 px-4 font-semibold">Utilisateur</th>
                  <th className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3 px-4 font-semibold">Identifiant</th>
                  <th className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3 px-4 font-semibold">Rôle</th>
                  <th className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3 px-4 font-semibold">Statut</th>
                  <th className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3 px-4 font-semibold text-right w-48">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <TableSkeleton rows={5} columns={5} />
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3 px-4 font-semibold">Utilisateur</th>
                  <th className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3 px-4 font-semibold">Identifiant</th>
                  <th className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3 px-4 font-semibold">Rôle</th>
                  <th className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3 px-4 font-semibold">Statut</th>
                  <th className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3 px-4 font-semibold text-right w-48">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length > 0 ? filteredUsers.map(u => (
                  <tr key={u.id} className="group table-row border-b border-slate-200 hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4 flex items-center gap-3">
                      <div className="w-9 h-9 flex items-center justify-center bg-primary/10 text-primary rounded-full text-sm font-bold shrink-0">
                        {(((u.firstName || u.first_name || '')[0] || '') + ((u.lastName || u.last_name || '')[0] || '') || (u.username || '').slice(0, 2)).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-slate-900 text-sm">{u.firstName || u.first_name} {u.lastName || u.last_name}</div>
                        <div className="text-slate-500 text-[13px]">{u.email || 'Aucun email'}</div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-900 text-sm">{u.username}</td>
                    <td className="px-5 py-4">
                      <span className="badge-info">{ROLE_LABELS[u.role] || u.role}</span>
                    </td>
                    <td className="px-5 py-4">
                      {u.active || u.active === 1 ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">Actif</span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">Inactif</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button onClick={() => onEdit && onEdit(u)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors" title="Modifier">
                          <i className="fas fa-pencil-alt text-sm"></i>
                        </button>
                        <button onClick={() => onToggleStatus && onToggleStatus(u)} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${u.active || u.active === 1 ? 'text-amber-400 hover:text-amber-600 hover:bg-amber-50' : 'text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50'}`} title={u.active || u.active === 1 ? 'Désactiver' : 'Activer'}>
                          <i className={`fas ${u.active || u.active === 1 ? 'fa-pause' : 'fa-play'} text-sm`}></i>
                        </button>
                        <button onClick={() => onResetPassword && onResetPassword(u)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors" title="Réinitialiser le mot de passe">
                          <i className="fas fa-key text-sm"></i>
                        </button>
                        <button onClick={() => onDelete && onDelete(u)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors" title="Supprimer">
                          <i className="fas fa-trash text-sm"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="5" className="py-10 px-5 text-center">
                      <div className="text-slate-900 font-medium mb-2">{emptyTitle}</div>
                      <div className="text-slate-500 text-sm">{emptyDetail}</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
