import React from 'react';

const STATUS_LABELS = { paid: 'Payé', partial: 'Partiel', overdue: 'Non Payé', pending: 'Non Payé' };
const STATUS_CLASSES = { paid: 'paid', partial: 'partial', overdue: 'overdue', pending: 'overdue' };

export default function ClientCard({ client, onPayment }) {
  const remaining = Math.max(0, (client.amountDue || 0) - (client.amountPaid || 0));
  const status = client.status || 'pending';
  const isSettled = remaining <= 0;

  return (
    <article className={`client-card ${status} ${isSettled ? 'client-card-settled' : ''}`}>
      <div className="client-header">
        <div className="client-name">{client.lastName} {client.firstName}</div>
        <span className={`status-badge ${STATUS_CLASSES[status] || 'overdue'}`}>
          {STATUS_LABELS[status] || 'Non Payé'}
        </span>
      </div>
      <div className="client-details">
        <div className="client-detail">
          <i className="fas fa-map-marker-alt" aria-hidden="true"></i>
          <span>{client.address || 'Aucune adresse'}</span>
        </div>
        <div className="client-detail">
          <i className="fas fa-phone" aria-hidden="true"></i>
          <span>{client.phone || 'Aucun téléphone'}</span>
        </div>
      </div>

      <div className="client-payment-summary">
        <div className={`client-balance ${isSettled ? 'client-balance-settled' : ''}`}>
          <span>{isSettled ? 'Solde' : 'Reste à payer'}</span>
          <strong>{isSettled ? 'Soldé' : `${remaining.toLocaleString()} XOF`}</strong>
        </div>
        <div className="client-payment-detail">
          <span>Loyer mensuel</span>
          <strong>{(client.amountDue || 0).toLocaleString()} XOF</strong>
        </div>
        <div className="client-payment-detail">
          <span>Déjà payé</span>
          <strong>{(client.amountPaid || 0).toLocaleString()} XOF</strong>
        </div>
        {remaining > 0 && (
          <button className="btn btn-primary btn-full client-payment-action" onClick={() => onPayment(client)}>
            <i className="fas fa-plus-circle" aria-hidden="true"></i> Enregistrer un paiement
          </button>
        )}
      </div>
    </article>
  );
}
