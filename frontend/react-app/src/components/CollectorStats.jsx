import React from 'react';

export default function CollectorStats({ displayName, clientCount, totalCollected, overdueCount, collectionRate }) {
  const overdueTone = overdueCount > 0 ? 'danger' : 'success';
  const rateTone = collectionRate >= 80 ? 'success' : collectionRate >= 50 ? 'warning' : 'danger';

  return (
    <section className="collector-summary" aria-label="Résumé de la tournée">
      <div className="collector-summary-identity">
        <div className="collector-summary-avatar">
          {displayName?.slice(0, 1).toUpperCase() || 'C'}
        </div>
        <div>
          <strong>{displayName || 'Collecteur'}</strong>
          <span>Collecte terrain</span>
        </div>
      </div>

      <div className="collector-summary-metrics">
        <div className="collector-summary-metric">
          <strong>{clientCount}</strong>
          <span>Locataires</span>
        </div>
        <div className="collector-summary-metric collector-summary-metric-success">
          <strong>{totalCollected.toLocaleString()}</strong>
          <span>Total payé (XOF)</span>
        </div>
        <div className={`collector-summary-metric collector-summary-metric-${overdueTone}`}>
          <strong>{overdueCount}</strong>
          <span>En retard</span>
        </div>
        <div className={`collector-summary-metric collector-summary-metric-${rateTone}`}>
          <strong>{collectionRate}%</strong>
          <span>Recouvrement</span>
        </div>
      </div>
    </section>
  );
}
