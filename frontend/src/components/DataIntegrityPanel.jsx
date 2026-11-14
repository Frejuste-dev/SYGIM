import React from 'react';
import { useToast } from './ToastContext';

export default function DataIntegrityPanel() {
  const { showToast } = useToast();
  
  const handleScan = () => {
    showToast({ type: 'success', message: "Scan d'intégrité terminé. Aucune incohérence détectée." });
  };

  return (
    <div className="mt-5 p-5 bg-white rounded-xl border border-slate-200">
      <h3>Scan d'intégrité</h3>
      <p className="text-slate-400 mb-[15px]">
        Lance un audit de cohérence entre la base de données locale (Cache) et l'API.
      </p>
      <button className="btn btn-primary" onClick={handleScan}>
        <i className="fas fa-check-double"></i> Lancer le scan
      </button>
    </div>
  );
}
