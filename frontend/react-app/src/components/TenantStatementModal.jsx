import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { API } from '../api/services';
import { formatXOF, formatDate, formatMethod } from '../utils/formatters';
import { exportToExcel, exportToPDF } from '../utils/exportUtils';

export default function TenantStatementModal({ client, onClose }) {
  const [statement, setStatement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('invoices'); // 'invoices' | 'payments' | 'ledger'

  useEffect(() => {
    if (!client?.id) return;
    setLoading(true);
    API.Financial.getTenantStatement(client.id)
      .then((res) => {
        setStatement(res.data || res);
      })
      .catch((err) => {
        console.error('Erreur chargement relevé financier:', err);
        setError('Impossible de charger le relevé de compte.');
      })
      .finally(() => setLoading(false));
  }, [client?.id]);

  if (!client) return null;

  const renderBadge = (netPosition) => {
    if (!netPosition) return null;
    if (netPosition === 'A_JOUR') {
      return <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full font-semibold text-xs">✅ Compte à jour (0 FCFA)</span>;
    }
    if (netPosition.startsWith('DOIT_')) {
      const amount = netPosition.replace('DOIT_', '');
      return <span className="px-3 py-1 bg-rose-100 text-rose-800 rounded-full font-semibold text-xs">⚠️ Reste dû : {formatXOF(amount)}</span>;
    }
    if (netPosition.startsWith('CREDITEUR_')) {
      const amount = netPosition.replace('CREDITEUR_', '');
      return <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-semibold text-xs">ℹ️ Solde créditeur : {formatXOF(amount)}</span>;
    }
    return <span className="px-3 py-1 bg-slate-100 text-slate-800 rounded-full font-semibold text-xs">{netPosition}</span>;
  };

  return (
    <Modal title={`Grand Livre Locataire — ${client.name || `${client.first_name || ''} ${client.last_name || ''}`}`} onClose={onClose} maxWidth="850px">
      {loading ? (
        <div className="py-12 text-center text-slate-500">
          <i className="fas fa-spinner fa-spin text-2xl mb-2"></i>
          <p>Chargement des écritures comptables...</p>
        </div>
      ) : error ? (
        <div className="py-8 text-center text-rose-600">
          <i className="fas fa-exclamation-triangle text-2xl mb-2"></i>
          <p>{error}</p>
        </div>
      ) : statement ? (
        <div className="space-y-6">
          {/* Synthèse en cartes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-xs uppercase font-medium text-slate-500">Position Nette</span>
              <div className="mt-2">{renderBadge(statement.summary?.netPosition)}</div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-xs uppercase font-medium text-slate-500">Total Dettes Émises</span>
              <div className="mt-1 text-lg font-bold text-slate-900">
                {formatXOF(statement.summary?.totalDebtRemaining || 0)}
              </div>
            </div>

            <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl">
              <span className="text-xs uppercase font-bold text-primary">Compte d'Avance Séquestré</span>
              <div className="mt-1 text-lg font-black text-primary">
                {formatXOF(statement.summary?.creditAdvanceBalance || 0)}
              </div>
            </div>
          </div>

          {/* Onglets de navigation */}
          <div className="flex border-b border-slate-200 space-x-4 text-sm font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('invoices')}
              className={`pb-2 border-b-2 font-bold transition-colors ${
                activeTab === 'invoices'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Échéances & Factures ({statement.invoices?.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('payments')}
              className={`pb-2 border-b-2 font-bold transition-colors ${
                activeTab === 'payments'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Paiements & Reçus ({statement.payments?.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ledger')}
              className={`pb-2 border-b-2 font-bold transition-colors ${
                activeTab === 'ledger'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Journal des Avances ({statement.ledger?.length || 0})
            </button>
          </div>

          {/* Contenu de l'onglet Factures */}
          {activeTab === 'invoices' && (
            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-100 text-slate-700 uppercase font-semibold">
                  <tr>
                    <th className="p-2.5">N° Facture</th>
                    <th className="p-2.5">Période</th>
                    <th className="p-2.5">Échéance</th>
                    <th className="p-2.5">Total Dû</th>
                    <th className="p-2.5">Réglé</th>
                    <th className="p-2.5">Solde</th>
                    <th className="p-2.5">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {statement.invoices?.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="p-4 text-center text-slate-400">Aucune facture enregistrée.</td>
                    </tr>
                  ) : (
                    statement.invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-mono font-medium">{inv.invoice_number}</td>
                        <td className="p-2.5">{formatDate(inv.billing_period_start)} au {formatDate(inv.billing_period_end)}</td>
                        <td className="p-2.5">{formatDate(inv.due_date)}</td>
                        <td className="p-2.5 font-semibold text-slate-900">{formatXOF(inv.total_amount)}</td>
                        <td className="p-2.5 text-emerald-600">{formatXOF(inv.paid_amount)}</td>
                        <td className="p-2.5 font-semibold text-rose-600">{formatXOF(inv.balance_due)}</td>
                        <td className="p-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            inv.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' :
                            inv.status === 'PARTIALLY_PAID' ? 'bg-amber-100 text-amber-800' :
                            inv.status === 'CANCELLED' ? 'bg-slate-200 text-slate-700 line-through' :
                            'bg-rose-100 text-rose-800'
                          }`}>
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Contenu de l'onglet Paiements */}
          {activeTab === 'payments' && (
            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-100 text-slate-700 uppercase font-semibold">
                  <tr>
                    <th className="p-2.5">Réf. Transaction</th>
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Moyen</th>
                    <th className="p-2.5">Montant Reçu</th>
                    <th className="p-2.5">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {statement.payments?.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="p-4 text-center text-slate-400">Aucun encaissement enregistré.</td>
                    </tr>
                  ) : (
                    statement.payments.map((p) => (
                      <tr key={p.id} className={`hover:bg-slate-50 ${p.is_reversed ? 'opacity-60 bg-rose-50/50' : ''}`}>
                        <td className="p-2.5 font-mono">{p.transaction_reference}</td>
                        <td className="p-2.5">{formatDate(p.payment_date)}</td>
                        <td className="p-2.5">{formatMethod(p.payment_method)}</td>
                        <td className="p-2.5 font-semibold text-slate-900">{formatXOF(p.amount_received)}</td>
                        <td className="p-2.5">
                          {p.is_reversed ? (
                            <span className="px-2 py-0.5 bg-rose-200 text-rose-900 rounded text-[10px] font-semibold" title={p.reversal_reason}>
                              ❌ Extourné
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-semibold">
                              {p.status}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Contenu de l'onglet Journal des Avances */}
          {activeTab === 'ledger' && (
            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-100 text-slate-700 uppercase font-semibold">
                  <tr>
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Opération</th>
                    <th className="p-2.5">Montant Mouvementé</th>
                    <th className="p-2.5">Solde Résultant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {statement.ledger?.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="p-4 text-center text-slate-400">Aucun mouvement d'avance sur ce compte.</td>
                    </tr>
                  ) : (
                    statement.ledger.map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-50">
                        <td className="p-2.5">{formatDate(entry.created_at)}</td>
                        <td className="p-2.5 font-medium">
                          {entry.transaction_type === 'CREDIT_ADVANCE' ? (
                            <span className="text-emerald-700 font-semibold">🟢 Crédit (Surpaiement)</span>
                          ) : entry.transaction_type === 'DEBIT_CONSUMPTION' ? (
                            <span className="text-indigo-700 font-semibold">🔵 Débit (Consommation Facture)</span>
                          ) : (
                            <span className="text-amber-700 font-semibold">🟠 Remboursement</span>
                          )}
                        </td>
                        <td className="p-2.5 font-semibold text-slate-900">{formatXOF(entry.amount)}</td>
                        <td className="p-2.5 font-bold text-blue-900">{formatXOF(entry.running_balance)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="pt-4 border-t border-slate-200 flex flex-wrap justify-between items-center gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const tenantName = client.name || `${client.first_name || ''} ${client.last_name || ''}`.trim();
                  const rows = (statement.invoices || []).map(inv => ({
                    invoice_number: inv.invoice_number,
                    period: `${formatDate(inv.billing_period_start)} au ${formatDate(inv.billing_period_end)}`,
                    due_date: formatDate(inv.due_date),
                    total_amount: `${Number(inv.total_amount || 0).toLocaleString('fr-FR')} FCFA`,
                    paid_amount: `${Number(inv.paid_amount || 0).toLocaleString('fr-FR')} FCFA`,
                    balance_due: `${Number(inv.balance_due || 0).toLocaleString('fr-FR')} FCFA`,
                    status: inv.status
                  }));
                  const cols = {
                    invoice_number: 'N° Facture',
                    period: 'Période',
                    due_date: 'Échéance',
                    total_amount: 'Total Dû',
                    paid_amount: 'Réglé',
                    balance_due: 'Solde',
                    status: 'Statut'
                  };
                  exportToExcel(rows, `grand_livre_locataire_${client.id}.xls`, cols, `Grand Livre Locataire — ${tenantName}`);
                }}
                className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-1.5"
              >
                <i className="fas fa-file-excel"></i> Exporter Excel
              </button>
              <button
                type="button"
                onClick={() => {
                  const tenantName = client.name || `${client.first_name || ''} ${client.last_name || ''}`.trim();
                  const rows = (statement.invoices || []).map(inv => ({
                    invoice_number: inv.invoice_number,
                    period: `${formatDate(inv.billing_period_start)} au ${formatDate(inv.billing_period_end)}`,
                    due_date: formatDate(inv.due_date),
                    total_amount: `${Number(inv.total_amount || 0).toLocaleString('fr-FR')} FCFA`,
                    paid_amount: `${Number(inv.paid_amount || 0).toLocaleString('fr-FR')} FCFA`,
                    balance_due: `${Number(inv.balance_due || 0).toLocaleString('fr-FR')} FCFA`,
                    status: inv.status
                  }));
                  const cols = {
                    invoice_number: 'N° Facture',
                    period: 'Période',
                    due_date: 'Échéance',
                    total_amount: 'Total Dû',
                    paid_amount: 'Réglé',
                    balance_due: 'Solde',
                    status: 'Statut'
                  };
                  exportToPDF(rows, `grand_livre_locataire_${client.id}.pdf`, cols, {
                    title: `Grand Livre & Relevé Locataire — ${tenantName}`,
                    subtitle: `Historique des factures, paiements et solde locatif`,
                    summaryItems: [
                      { label: 'Total Dettes Restantes', value: formatXOF(statement.summary?.totalDebtRemaining || 0, { compact: false }) },
                      { label: 'Avance Séquestrée', value: formatXOF(statement.summary?.creditAdvanceBalance || 0, { compact: false }) }
                    ]
                  });
                }}
                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1.5"
              >
                <i className="fas fa-file-pdf"></i> Exporter PDF
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-sm font-medium transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
