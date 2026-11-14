import React from 'react';
import { useToast } from './ToastContext';

export default function SystemSettingsPanel() {
  const { showToast } = useToast();
  
  return (
    <div className="mt-5 p-5 bg-white rounded-lg border border-slate-200">
      <div className="flex justify-between items-center border-b border-slate-200 pb-[15px] mb-[15px]">
        <div>
          <h4 className="m-0">Mode maintenance</h4>
          <small className="text-slate-400">
            Désactive l'accès à la plateforme pour les récolteurs.
          </small>
        </div>
        <button className="btn btn-outline" onClick={() => showToast({ type: 'warning', message: 'Mode maintenance activé.' })}>
          Activer
        </button>
      </div>
      <div className="flex justify-between items-center">
        <div>
          <h4 className="m-0">Sauvegarde automatique</h4>
          <small className="text-slate-400">
            Effectuer des sauvegardes automatiques dans localStorage.
          </small>
        </div>
        <span className="text-emerald-600 font-semibold">
          <i className="fas fa-check-circle"></i> Activé
        </span>
      </div>
    </div>
  );
}
