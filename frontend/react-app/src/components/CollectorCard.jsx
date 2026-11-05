import React from 'react';

export default function CollectorCard({ collector, assignedProperties }) {
  const ln = collector.lastName || collector.last_name || '';
  const fn = collector.firstName || collector.first_name || '';
  const initials = ((ln && ln[0]) || '').toUpperCase() + ((fn && fn[0]) || '').toUpperCase();
  const needsAssignment = assignedProperties.length === 0;

  return (
    <article className={`collector-assignment-card manager-collector-card ${needsAssignment ? 'needs-assignment' : ''}`}>
      <div className="manager-collector-header">
        <div className="manager-collector-avatar">
          {initials}
        </div>
        <div className="manager-collector-identity">
          <h4>{ln} {fn}</h4>
          <small>
            Portefeuille : {assignedProperties.length} bien{assignedProperties.length > 1 ? 's' : ''}
          </small>
        </div>
        {needsAssignment && <span className="manager-collector-status">Sans bien</span>}
      </div>
      <div className="manager-collector-properties">
        <strong>Biens assignés :</strong>
        <ul>
          {assignedProperties.length > 0 ? (
            assignedProperties.map(p => <li key={p.id}>{p.name} - {p.address}</li>)
          ) : (
            <li className="manager-collector-no-property">Aucun bien attribué</li>
          )}
        </ul>
      </div>
    </article>
  );
}
