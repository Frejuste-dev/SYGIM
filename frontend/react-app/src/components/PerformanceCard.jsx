import React from 'react';

const SUCCESSFUL_TRANSACTION_STATUSES = new Set(['processed', 'paid', 'completed', 'success']);

const getCollectorId = item => Number(item?.collectorId ?? item?.collector_id);
const getAmount = (item, camelKey, snakeKey) => Number(item?.[camelKey] ?? item?.[snakeKey] ?? 0);

export default function PerformanceCard({ collector, properties, clients, transactions, periodLabel }) {
  const assignedCount = properties.filter(p => getCollectorId(p) === Number(collector.id)).length;
  const ln = collector.lastName || collector.last_name || '';
  const fn = collector.firstName || collector.first_name || '';
  const collectorId = Number(collector.id);
  const now = new Date();
  const directRateValue = collector.collectionRate ?? collector.collection_rate;
  const directRate = directRateValue === undefined || directRateValue === null || directRateValue === ''
    ? null
    : Number(directRateValue);

  const assignedClients = clients.filter(client =>
    getCollectorId(client) === collectorId && client.status !== 'inactive'
  );
  const totalDue = assignedClients.reduce(
    (sum, client) => sum + getAmount(client, 'amountDue', 'amount_due'),
    0
  );
  const totalCollected = transactions.reduce((sum, transaction) => {
    const transactionDate = new Date(transaction.date || transaction.createdAt || transaction.created_at);
    const isCurrentMonth = !Number.isNaN(transactionDate.getTime())
      && transactionDate.getFullYear() === now.getFullYear()
      && transactionDate.getMonth() === now.getMonth();
    const status = String(transaction.status || '').toLowerCase();

    if (getCollectorId(transaction) !== collectorId
      || !isCurrentMonth
      || !SUCCESSFUL_TRANSACTION_STATUSES.has(status)) {
      return sum;
    }
    return sum + Number(transaction.amount || 0);
  }, 0);

  const derivedRate = totalDue > 0
    ? Math.min(100, Math.max(0, Math.round((totalCollected / totalDue) * 100)))
    : null;
  const rate = Number.isFinite(directRate)
    ? Math.min(100, Math.max(0, Math.round(directRate)))
    : derivedRate;
  const tone = rate === null ? 'unavailable' : rate >= 80 ? 'success' : rate >= 50 ? 'warning' : 'danger';

  return (
    <article className={`manager-performance-card performance-${tone}`}>
      <div className="manager-performance-header">
        <div className="manager-performance-avatar">
          {((ln && ln[0]) || '').toUpperCase() + ((fn && fn[0]) || '').toUpperCase()}
        </div>
        <div className="manager-performance-name">{ln} {fn}</div>
        <small>{assignedCount} bien{assignedCount > 1 ? 's' : ''}</small>
      </div>

      {rate !== null ? (
        <>
          <div className="manager-performance-rate">
            <div className="manager-performance-track">
              <div style={{ width: `${rate}%` }}></div>
            </div>
            <strong>{rate}%</strong>
          </div>
          <div className="manager-performance-amounts">
            <span>{totalCollected.toLocaleString()} XOF encaissés</span>
            <span>sur {totalDue.toLocaleString()} XOF dus</span>
          </div>
        </>
      ) : (
        <div className="manager-performance-unavailable">
          <i className="fas fa-minus-circle" aria-hidden="true"></i>
          <strong>Taux non disponible</strong>
        </div>
      )}
      <small className="manager-performance-period">Recouvrement · {periodLabel}</small>
    </article>
  );
}
