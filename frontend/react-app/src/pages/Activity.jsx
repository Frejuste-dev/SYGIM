import React, { useState } from 'react';

export default function Activity() {
  // Mock data pour la démo
  const [logs] = useState([
    { id: 1, type: 'auth', message: 'Connexion réussie', date: '2026-08-15', time: '09:00', user: 'Admin' },
    { id: 2, type: 'action', message: 'Création d\'un nouveau locataire (Jean Dupont)', date: '2026-08-15', time: '09:45', user: 'Gestionnaire A' },
    { id: 3, type: 'alert', message: 'Relance envoyée pour impayé (Propriété A2)', date: '2026-08-14', time: '14:20', user: 'Système' },
    { id: 4, type: 'auth', message: 'Déconnexion', date: '2026-08-14', time: '18:00', user: 'Admin' },
    { id: 5, type: 'action', message: 'Modification des paramètres système', date: '2026-08-13', time: '11:15', user: 'Super Admin' },
  ]);

  const getBadgeStyle = (type) => {
    switch (type) {
      case 'auth':
        return 'bg-primary/10 text-primary border border-primary/20';
      case 'alert':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'auth': return 'fas fa-sign-in-alt';
      case 'alert': return 'fas fa-exclamation-circle';
      default: return 'fas fa-pencil-alt';
    }
  };

  return (
    <div className="flex flex-col min-h-full">
      {/* EN-TÊTE */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Journal d'activité</h1>
          <p className="text-slate-500 text-sm mt-1">Historique des actions et événements du système</p>
        </div>
        <div className="flex items-center gap-3 mt-4 md:mt-0">
          <div className="relative">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
            <input 
              type="text" 
              placeholder="Rechercher..." 
              className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 w-64"
            />
          </div>
          <button className="bg-white border border-slate-200 text-slate-700 rounded-lg px-4 py-2 hover:bg-slate-50 transition-colors text-sm font-medium flex items-center gap-2">
            <i className="fas fa-filter text-slate-400"></i>
            Filtres
          </button>
        </div>
      </div>

      {/* TABLEAU DES LOGS */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3 px-6 font-semibold">Date & Heure</th>
                <th className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3 px-6 font-semibold">Type</th>
                <th className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3 px-6 font-semibold">Utilisateur</th>
                <th className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3 px-6 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-4 px-6">
                    <div className="text-sm font-medium text-slate-900">{log.date}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{log.time}</div>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getBadgeStyle(log.type)}`}>
                      <i className={`${getIcon(log.type)} text-[10px]`}></i>
                      {log.type.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold">
                        {log.user.charAt(0)}
                      </div>
                      <span className="text-sm text-slate-700">{log.user}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-sm text-slate-800">{log.message}</span>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan="4" className="py-12 text-center text-slate-500">
                    Aucune activité enregistrée.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* PAGINATION */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
          <span className="text-sm text-slate-500">Affichage de 1 à 5 sur 5 entrées</span>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 text-sm font-medium text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50" disabled>Précédent</button>
            <button className="px-3 py-1.5 text-sm font-medium text-white bg-primary rounded-lg">1</button>
            <button className="px-3 py-1.5 text-sm font-medium text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50" disabled>Suivant</button>
          </div>
        </div>
      </div>
    </div>
  );
}
