import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTransactions, useTransactionStats } from '../hooks/queries/useTransactions';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ToastContext';
import { API } from '../api/services';
import StatsCard from '../components/StatsCard';
import { formatXOF, formatDate, formatMethod, formatStatus } from '../utils/formatters';
import { exportToExcel, exportToPDF, printOwnerSettlementReceipt } from '../utils/exportUtils';
import ReceiptTemplate from '../components/ReceiptTemplate';
import OwnerPayoutModal from '../components/OwnerPayoutModal';
import InstallmentHistoryModal from '../components/InstallmentHistoryModal';

const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'processed', label: 'Traité' },
  { value: 'pending', label: 'En attente' },
  { value: 'cancelled', label: 'Annulé' },
  { value: 'refunded', label: 'Remboursé' },
];

const METHOD_OPTIONS = [
  { value: '', label: 'Tous les moyens' },
  { value: 'cash', label: 'Espèces' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'bank_transfer', label: 'Virement' },
  { value: 'check', label: 'Chèque' },
  { value: 'card', label: 'Carte' },
];

const PAYOUT_MODE_BADGES = {
  full: { label: 'Paiement intégral', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  installment: { label: 'Paiement échelonné', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  prefinancing: { label: 'Préfinancement', cls: 'bg-amber-50 text-amber-800 border-amber-300' },
};

const SETTLEMENT_STATUS_BADGES = {
  paid: { label: 'Payé', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  prefinanced: { label: 'Préfinancé (Avance)', cls: 'bg-amber-100 text-amber-900 border-amber-300' },
  reimbursed: { label: 'Remboursé / Régularisé', cls: 'bg-teal-100 text-teal-900 border-teal-300' },
  partial: { label: 'Partiel (Échelonné)', cls: 'bg-blue-100 text-blue-800 border-blue-200' },
  pending: { label: 'En attente', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
};

export default function Transactions() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('transactions'); // 'transactions' | 'settlements' | 'ledger'
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [selectedSettlementForInstallments, setSelectedSettlementForInstallments] = useState(null);

  const [settlements, setSettlements] = useState([]);
  const [settlementStats, setSettlementStats] = useState({});
  const [ledgerData, setLedgerData] = useState({ entries: [], summary: {} });
  const [loadingFinancial, setLoadingFinancial] = useState(false);

  const [printTransaction, setPrintTransaction] = useState(null);
  const [viewTransaction, setViewTransaction] = useState(null);
  const [reversingTransaction, setReversingTransaction] = useState(null);
  const [reversalReason, setReversalReason] = useState('');
  const [isSubmittingReversal, setIsSubmittingReversal] = useState(false);

  const canReverse = ['admin', 'director', 'accounting'].includes(user?.role);
  const canManageOwnerPayouts = ['admin', 'director', 'accounting', 'manager'].includes(user?.role);

  const [searchParams, setSearchParams] = useSearchParams();
  const searchTerm = searchParams.get('search') || '';
  const statusFilter = searchParams.get('status') || '';
  const methodFilter = searchParams.get('method') || '';
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = 25;

  const handleFilterChange = (key, value) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    if (key !== 'page') newParams.delete('page');
    setSearchParams(newParams);
  };

  const filters = {
    page, limit,
    search: searchTerm,
    status: statusFilter,
    method: methodFilter,
    dateFrom, dateTo
  };

  const { data: queryResult = {}, isLoading: loading, error: listError } = useTransactions(filters);
  const transactions = Array.isArray(queryResult) ? queryResult : (queryResult?.data || []);
  const pagination = queryResult?.pagination || {};
  const isLastPage = pagination.hasNextPage === false;

  const { data: stats = {} } = useTransactionStats(filters);

  const loadFinancialData = useCallback(async () => {
    setLoadingFinancial(true);
    try {
      const [stlResult, ldgResult] = await Promise.allSettled([
        API.Financial.getSettlements(),
        API.Financial.getGeneralLedger()
      ]);

      if (stlResult.status === 'fulfilled') {
        const stlRes = stlResult.value;
        const stlPayload = stlRes?.data || stlRes || {};
        setSettlements(stlPayload.settlements || stlPayload.data || []);
        setSettlementStats(stlPayload.stats || {});
      }

      if (ldgResult.status === 'fulfilled') {
        const ldgRes = ldgResult.value;
        const ldgPayload = ldgRes?.data || ldgRes || {};
        setLedgerData({
          entries: ldgPayload.entries || [],
          summary: ldgPayload.summary || {}
        });
      }
    } catch (err) {
      console.error('Erreur chargement données comptables:', err);
    } finally {
      setLoadingFinancial(false);
    }
  }, []);

  useEffect(() => {
    loadFinancialData();
  }, [loadFinancialData]);

  const totalCollected = stats.totalCollected || 0;
  const totalPending = stats.totalPending || 0;
  const processedCount = stats.processedCount || 0;
  const transactionCount = stats.transactionCount || 0;
  const hasActiveFilters = Boolean(searchTerm || statusFilter || methodFilter || dateFrom || dateTo);
  const transactionsEmptyMessage = loading
    ? 'Chargement des transactions...'
    : (listError?.message || (typeof listError === 'string' ? listError : '')) || (hasActiveFilters
      ? 'Aucune transaction ne correspond aux filtres.'
      : 'Aucune transaction enregistrée pour le moment.');

  const today = new Date().toISOString().slice(0, 10);

  // Exports Transactions (Excel & PDF)
  const getTransactionExportRows = () => transactions.map(t => ({
    reference: t.reference || '-',
    date: formatDate(t.date || t.created_at),
    client: t.client_name || t.client || '-',
    description: t.description || 'Paiement loyer',
    amount: `${Number(t.amount || 0).toLocaleString('fr-FR')} FCFA`,
    method: formatMethod(t.method),
    status: formatStatus(t.status)?.label || t.status || '-'
  }));

  const transactionExportCols = {
    reference: 'Référence',
    date: 'Date',
    client: 'Locataire',
    description: 'Description',
    amount: 'Montant (FCFA)',
    method: 'Moyen de paiement',
    status: 'Statut'
  };

  const handleExportTransactionsExcel = () => {
    exportToExcel(
      getTransactionExportRows(),
      `transactions_locataires_${today}.xls`,
      transactionExportCols,
      'Historique des Transactions & Encaissements — SYGIM'
    );
  };

  const handleExportTransactionsPDF = () => {
    exportToPDF(
      getTransactionExportRows(),
      `transactions_locataires_${today}.pdf`,
      transactionExportCols,
      {
        title: 'Historique des Transactions & Encaissements',
        subtitle: 'Liste des paiements de loyers encaissés par SYGIM',
        summaryItems: [
          { label: 'Total Encaissé', value: formatXOF(totalCollected, { compact: false }) },
          { label: 'En attente', value: formatXOF(totalPending, { compact: false }) },
          { label: 'Total Transactions', value: String(transactionCount) }
        ]
      }
    );
  };

  // Exports Paiements Propriétaires (Excel & PDF)
  const getSettlementExportRows = () => settlements.map(s => ({
    reference: s.transaction_reference || `REV-${s.id}`,
    owner: s.owner_name || `Propriétaire #${s.owner_id}`,
    property: s.property_name || 'Tous les biens',
    period: `${formatDate(s.period_start)} au ${formatDate(s.period_end)}`,
    mode: PAYOUT_MODE_BADGES[s.payout_mode]?.label || s.payout_mode || 'Intégral',
    method: formatMethod(s.payment_method || 'bank_transfer'),
    net_amount: `${Number(s.net_amount || 0).toLocaleString('fr-FR')} FCFA`,
    amount_paid: `${Number(s.amount_paid || s.net_amount || 0).toLocaleString('fr-FR')} FCFA`,
    remaining: `${Number(s.remaining_to_pay || 0).toLocaleString('fr-FR')} FCFA`,
    status: SETTLEMENT_STATUS_BADGES[s.status]?.label || s.status
  }));

  const settlementExportCols = {
    reference: 'Référence',
    owner: 'Propriétaire',
    property: 'Bien(s)',
    period: 'Période',
    mode: 'Type de règlement',
    method: 'Moyen de paiement',
    net_amount: 'Net à reverser',
    amount_paid: 'Montant versé',
    remaining: 'Reste à payer',
    status: 'Statut'
  };

  const handleExportSettlementsExcel = () => {
    exportToExcel(
      getSettlementExportRows(),
      `paiements_proprietaires_${today}.xls`,
      settlementExportCols,
      'État des Paiements & Préfinancements Propriétaires — SYGIM'
    );
  };

  const handleExportSettlementsPDF = () => {
    exportToPDF(
      getSettlementExportRows(),
      `paiements_proprietaires_${today}.pdf`,
      settlementExportCols,
      {
        title: 'État des Paiements & Préfinancements Propriétaires',
        subtitle: 'Reversements mensuels, paiements échelonnés et avances de trésorerie',
        summaryItems: [
          { label: 'Total Reversé', value: formatXOF(settlementStats.totalDisbursed || 0, { compact: false }) },
          { label: 'Total Préfinancé', value: formatXOF(settlementStats.totalPrefinanced || 0, { compact: false }) },
          { label: 'Commissions Agence', value: formatXOF(settlementStats.totalCommission || 0, { compact: false }) },
          { label: 'Reste à verser', value: formatXOF(settlementStats.totalRemainingToPay || 0, { compact: false }) }
        ]
      }
    );
  };

  // Exports Grand Livre (Excel & PDF)
  const getLedgerExportRows = () => (ledgerData.entries || []).map(e => ({
    date: formatDate(e.date),
    reference: e.reference || '-',
    category: e.category || '-',
    third_party: e.third_party || '-',
    property_name: e.property_name || '-',
    description: e.description || '-',
    method: formatMethod(e.method),
    credit: e.credit > 0 ? `+${Number(e.credit).toLocaleString('fr-FR')} FCFA` : '-',
    debit: e.debit > 0 ? `-${Number(e.debit).toLocaleString('fr-FR')} FCFA` : '-',
    running_balance: `${Number(e.running_balance || 0).toLocaleString('fr-FR')} FCFA`
  }));

  const ledgerExportCols = {
    date: 'Date',
    reference: 'Référence',
    category: 'Catégorie',
    third_party: 'Tiers',
    property_name: 'Bien immobilier',
    description: 'Libellé comptable',
    method: 'Moyen',
    credit: 'Crédit (Entrée)',
    debit: 'Débit (Sortie)',
    running_balance: 'Solde Progressif'
  };

  const handleExportLedgerExcel = () => {
    exportToExcel(
      getLedgerExportRows(),
      `grand_livre_comptable_${today}.xls`,
      ledgerExportCols,
      'Grand Livre Comptable Général — SYGIM'
    );
  };

  const handleExportLedgerPDF = () => {
    exportToPDF(
      getLedgerExportRows(),
      `grand_livre_comptable_${today}.pdf`,
      ledgerExportCols,
      {
        title: 'Grand Livre Comptable Général — SYGIM',
        subtitle: 'Journal unifié des encaissements locataires, reversements propriétaires et préfinancements',
        summaryItems: [
          { label: 'Total Crédit (Encaissements)', value: formatXOF(ledgerData.summary?.totalCredit || 0, { compact: false }) },
          { label: 'Total Débit (Reversements)', value: formatXOF(ledgerData.summary?.totalDebit || 0, { compact: false }) },
          { label: 'Dont Préfinancements', value: formatXOF(ledgerData.summary?.totalPrefinanced || 0, { compact: false }) },
          { label: 'Solde Net de Trésorerie', value: formatXOF(ledgerData.summary?.netBalance || 0, { compact: false }) }
        ]
      }
    );
  };

  const handleCompleteInstallment = async (settlement) => {
    try {
      await API.Financial.paySettlement(settlement.id, {
        payment_method: settlement.payment_method || 'bank_transfer',
        amount_paid: settlement.net_amount
      });
      showToast({ type: 'success', message: 'Solde du paiement échelonné réglé avec succès.' });
      loadFinancialData();
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Erreur lors du règlement.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <i className="fas fa-exchange-alt text-primary"></i> Transactions, Paiements Propriétaires & Grand Livre
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Gérez les encaissements locataires, les reversements/préfinancements propriétaires et exportez en Excel ou PDF.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManageOwnerPayouts && (
            <button
              onClick={() => setShowPayoutModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm flex items-center gap-2"
            >
              <i className="fas fa-hand-holding-usd"></i> + Payer / Préfinancer Propriétaire
            </button>
          )}
        </div>
      </div>

      {/* ONGLETS */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('transactions')}
          className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'transactions'
              ? 'bg-primary text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <i className="fas fa-receipt"></i> Encaissements Locataires (Transactions)
        </button>
        <button
          onClick={() => setActiveTab('settlements')}
          className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'settlements'
              ? 'bg-primary text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <i className="fas fa-hand-holding-usd"></i> Paiements & Préfinancements Propriétaires
          <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'settlements' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
            {settlements.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('ledger')}
          className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'ledger'
              ? 'bg-primary text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <i className="fas fa-book"></i> Grand Livre Général
          <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'ledger' ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-800'}`}>
            {ledgerData.entries?.length || 0}
          </span>
        </button>
      </div>

      {/* ONGLET 1 : TRANSACTIONS LOCATAIRES */}
      {activeTab === 'transactions' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard label="Total encaissé" value={formatXOF(totalCollected, { compact: false })} icon="fa-wallet" color="var(--success)" />
            <StatsCard label="En attente" value={formatXOF(totalPending, { compact: false })} icon="fa-clock" color="var(--warning)" />
            <StatsCard label="Transactions" value={transactionCount} icon="fa-list" color="var(--primary)" />
            <StatsCard label="Traitées" value={processedCount} icon="fa-check-circle" color="#3B82F6" />
          </div>

          {/* OUTILS ET FILTRES */}
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <div className="relative w-full lg:w-80">
              <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
              <input
                type="text"
                placeholder="Rechercher par référence, client..."
                value={searchTerm}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            <div className="w-full lg:w-auto flex flex-wrap items-center gap-2.5">
              <select
                value={statusFilter}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 font-medium"
              >
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>

              <select
                value={methodFilter}
                onChange={(e) => handleFilterChange('method', e.target.value)}
                className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 font-medium"
              >
                {METHOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>

              <button
                onClick={handleExportTransactionsExcel}
                className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-colors"
              >
                <i className="fas fa-file-excel"></i> Excel
              </button>
              <button
                onClick={handleExportTransactionsPDF}
                className="px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-colors"
              >
                <i className="fas fa-file-pdf"></i> PDF
              </button>
            </div>
          </div>

          {/* TABLEAU TRANSACTIONS */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto min-w-0">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                    <th className="py-3 px-6 font-semibold">Réf.</th>
                    <th className="py-3 px-6 font-semibold">Date</th>
                    <th className="py-3 px-6 font-semibold">Client</th>
                    <th className="py-3 px-6 font-semibold">Montant</th>
                    <th className="py-3 px-6 font-semibold">Moyen</th>
                    <th className="py-3 px-6 font-semibold">Statut</th>
                    <th className="py-3 px-6 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="py-12 text-center text-slate-500">
                        <i className="fas fa-spinner fa-spin text-primary text-xl mb-3 block"></i>
                        Chargement des transactions...
                      </td>
                    </tr>
                  ) : transactions.length > 0 ? (
                    transactions.map(t => (
                      <tr key={t.id || t.reference || Math.random()} className="group hover:bg-slate-50/80 transition-colors">
                        <td className="py-4 px-6 text-slate-700 font-mono text-xs">{t.reference || '-'}</td>
                        <td className="py-4 px-6 text-xs text-slate-600">{formatDate(t.date || t.created_at)}</td>
                        <td className="py-4 px-6 text-sm text-slate-900 font-medium">{t.client_name || t.client || '-'}</td>
                        <td className="py-4 px-6 text-sm text-slate-900 font-bold">{formatXOF(t.amount, { compact: false })}</td>
                        <td className="py-4 px-6 text-sm text-slate-700">{formatMethod(t.method)}</td>
                        <td className="py-4 px-6">
                          {(() => {
                            const s = formatStatus(t.status);
                            return (
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${s.twClass}`}>
                                {s.label || t.status || 'Annulé'}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center justify-end gap-2">
                            {canReverse && t.status !== 'cancelled' && t.status !== 'refunded' && !t.is_reversed && (
                              <button
                                onClick={() => { setReversingTransaction(t); setReversalReason(''); }}
                                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                                title="Extourner / Annuler cette transaction"
                              >
                                <i className="fas fa-undo"></i>
                              </button>
                            )}
                            <button
                              onClick={() => setViewTransaction(t)}
                              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                              title="Voir les détails"
                            >
                              <i className="fas fa-eye"></i>
                            </button>
                            <button
                              onClick={() => setPrintTransaction(t)}
                              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/5 transition-all"
                              title="Imprimer le reçu"
                            >
                              <i className="fas fa-print"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="py-12 text-center text-slate-500">
                        {transactionsEmptyMessage}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {transactions.length > 0 && (
              <div className="flex justify-between items-center px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                <p className="text-sm text-slate-500">Page {page}</p>
                <div className="flex gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => handleFilterChange('page', page - 1)}
                    className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm disabled:opacity-50 hover:bg-slate-50"
                  >
                    Précédent
                  </button>
                  <button
                    disabled={isLastPage}
                    onClick={() => handleFilterChange('page', page + 1)}
                    className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm disabled:opacity-50 hover:bg-slate-50"
                  >
                    Suivant
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ONGLET 2 : PAIEMENTS & PRÉFINANCEMENTS PROPRIÉTAIRES */}
      {activeTab === 'settlements' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard label="Total reversé" value={formatXOF(settlementStats.totalDisbursed || 0, { compact: false })} icon="fa-hand-holding-usd" color="var(--success)" />
            <StatsCard label="Total préfinancé" value={formatXOF(settlementStats.totalPrefinanced || 0, { compact: false })} icon="fa-bolt" color="var(--warning)" />
            <StatsCard label="Commissions agence" value={formatXOF(settlementStats.totalCommission || 0, { compact: false })} icon="fa-percent" color="var(--primary)" />
            <StatsCard label="Reste à verser (échelonné)" value={formatXOF(settlementStats.totalRemainingToPay || 0, { compact: false })} icon="fa-calendar-check" color="var(--danger)" />
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">État des Paiements & Préfinancements Propriétaires</h3>
                <p className="text-xs text-slate-500">Paiements intégraux, paiements échelonnés et préfinancements en attente du loyer locataire.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleExportSettlementsExcel}
                  className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                >
                  <i className="fas fa-file-excel"></i> Exporter Excel
                </button>
                <button
                  onClick={handleExportSettlementsPDF}
                  className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                >
                  <i className="fas fa-file-pdf"></i> Exporter PDF
                </button>
                {canManageOwnerPayouts && (
                  <button
                    onClick={() => setShowPayoutModal(true)}
                    className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                  >
                    <i className="fas fa-plus"></i> Nouveau Paiement / Préfinancement
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase">
                    <th className="py-3 px-4">Réf.</th>
                    <th className="py-3 px-4">Propriétaire & Bien(s)</th>
                    <th className="py-3 px-4">Période / Échéance</th>
                    <th className="py-3 px-4">Mode & Moyen</th>
                    <th className="py-3 px-4">Net à Reverser</th>
                    <th className="py-3 px-4">Montant Versé</th>
                    <th className="py-3 px-4">Reste à Payer</th>
                    <th className="py-3 px-4">Statut</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingFinancial ? (
                    <tr>
                      <td colSpan="9" className="py-12 text-center text-slate-500">
                        <i className="fas fa-spinner fa-spin mr-2"></i> Chargement...
                      </td>
                    </tr>
                  ) : settlements.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="py-12 text-center text-slate-500">Aucun paiement propriétaire enregistré.</td>
                    </tr>
                  ) : (
                    settlements.map(s => {
                      const modeBadge = PAYOUT_MODE_BADGES[s.payout_mode] || PAYOUT_MODE_BADGES.full;
                      const statusBadge = SETTLEMENT_STATUS_BADGES[s.status] || SETTLEMENT_STATUS_BADGES.paid;
                      return (
                        <tr key={s.id} className="hover:bg-slate-50/80">
                          <td className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-700">{s.transaction_reference || `REV-${s.id}`}</td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900">{s.owner_name || `Propriétaire #${s.owner_id}`}</div>
                            <div className="text-xs text-slate-500">{s.property_name || 'Tous les biens attribués'}</div>
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-600">
                            <div>Du {formatDate(s.period_start)} au {formatDate(s.period_end)}</div>
                            {s.scheduled_date && <div className="text-slate-400">Date prévue : {formatDate(s.scheduled_date)}</div>}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${modeBadge.cls}`}>
                              {s.is_prefinanced ? <i className="fas fa-bolt mr-1 text-amber-600"></i> : null}
                              {modeBadge.label}
                            </span>
                            <div className="text-xs text-slate-500 mt-1">{formatMethod(s.payment_method || 'bank_transfer')}</div>
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-800">{formatXOF(s.net_amount, { compact: false })}</td>
                          <td className="py-3.5 px-4 font-bold text-emerald-700">{formatXOF(s.amount_paid || s.net_amount, { compact: false })}</td>
                          <td className="py-3.5 px-4 font-semibold text-rose-600">
                            {s.remaining_to_pay > 0 ? formatXOF(s.remaining_to_pay, { compact: false }) : '0 FCFA'}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${statusBadge.cls}`}>
                              {statusBadge.label}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {canManageOwnerPayouts && (
                                <button
                                  onClick={() => setSelectedSettlementForInstallments(s)}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                                    s.remaining_to_pay > 0
                                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                  }`}
                                  title="Voir l'historique des tranches ou enregistrer un versement partiel"
                                >
                                  <i className={`fas ${s.remaining_to_pay > 0 ? 'fa-plus-circle' : 'fa-layer-group'}`}></i>
                                  {s.remaining_to_pay > 0 ? '+ Tranche' : `Tranches (${s.installments?.length || 1})`}
                                </button>
                              )}
                              <button
                                onClick={() => printOwnerSettlementReceipt(s)}
                                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                                title="Imprimer le Bordereau / Reçu Officiel PDF"
                              >
                                <i className="fas fa-print"></i> Bordereau
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ONGLET 3 : GRAND LIVRE GÉNÉRAL */}
      {activeTab === 'ledger' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard label="Total Crédit (Entrées)" value={formatXOF(ledgerData.summary?.totalCredit || 0, { compact: false })} icon="fa-arrow-down" color="var(--success)" />
            <StatsCard label="Total Débit (Sorties)" value={formatXOF(ledgerData.summary?.totalDebit || 0, { compact: false })} icon="fa-arrow-up" color="var(--danger)" />
            <StatsCard label="Dont Préfinancements" value={formatXOF(ledgerData.summary?.totalPrefinanced || 0, { compact: false })} icon="fa-bolt" color="var(--warning)" />
            <StatsCard label="Solde Net Trésorerie" value={formatXOF(ledgerData.summary?.netBalance || 0, { compact: false })} icon="fa-scale-balanced" color="var(--primary)" />
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Grand Livre Comptable Général</h3>
                <p className="text-xs text-slate-500">Journal chronologique de toutes les opérations financières (Encaissements, Reversements, Préfinancements).</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportLedgerExcel}
                  className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                >
                  <i className="fas fa-file-excel"></i> Exporter Excel
                </button>
                <button
                  onClick={handleExportLedgerPDF}
                  className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                >
                  <i className="fas fa-file-pdf"></i> Exporter PDF
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Réf.</th>
                    <th className="py-3 px-4">Catégorie</th>
                    <th className="py-3 px-4">Tiers</th>
                    <th className="py-3 px-4">Bien</th>
                    <th className="py-3 px-4">Libellé</th>
                    <th className="py-3 px-4 text-right">Crédit (+)</th>
                    <th className="py-3 px-4 text-right">Débit (-)</th>
                    <th className="py-3 px-4 text-right">Solde Progressif</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(ledgerData.entries || []).length === 0 ? (
                    <tr>
                      <td colSpan="9" className="py-12 text-center text-slate-500">Aucune écriture comptable disponible.</td>
                    </tr>
                  ) : (
                    ledgerData.entries.map(e => (
                      <tr key={e.id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">{formatDate(e.date)}</td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-700">{e.reference}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                            e.direction === 'CREDIT'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : e.is_prefinanced
                              ? 'bg-amber-50 text-amber-800 border border-amber-300'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {e.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900">{e.third_party}</td>
                        <td className="py-3 px-4 text-xs text-slate-600">{e.property_name}</td>
                        <td className="py-3 px-4 text-xs text-slate-600 max-w-xs truncate" title={e.description}>{e.description}</td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-600">
                          {e.credit > 0 ? `+${formatXOF(e.credit, { compact: false })}` : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-rose-600">
                          {e.debit > 0 ? `-${formatXOF(e.debit, { compact: false })}` : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-extrabold text-slate-900 bg-slate-50/60">
                          {formatXOF(e.running_balance, { compact: false })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Impression de reçu */}
      <ReceiptTemplate
        transaction={printTransaction}
        onClose={() => setPrintTransaction(null)}
      />

      {/* Modal Paiement / Préfinancement Propriétaire */}
      {showPayoutModal && (
        <OwnerPayoutModal
          isOpen={showPayoutModal}
          onClose={() => setShowPayoutModal(false)}
          onSuccess={loadFinancialData}
        />
      )}

      {/* Modal Historique & Ajout de Tranches Échelonnées */}
      {selectedSettlementForInstallments && (
        <InstallmentHistoryModal
          settlement={selectedSettlementForInstallments}
          onClose={() => setSelectedSettlementForInstallments(null)}
          onSuccess={loadFinancialData}
        />
      )}

      {/* Modal de détails transaction */}
      {viewTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <i className="fas fa-file-invoice-dollar text-primary"></i> Détails de la transaction
              </h3>
              <button onClick={() => setViewTransaction(null)} className="text-slate-400 hover:text-slate-600">
                <i className="fas fa-times text-lg"></i>
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="flex justify-between items-start bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Montant payé</p>
                  <p className="text-3xl font-extrabold text-slate-900">{formatXOF(viewTransaction.amount, { compact: false })}</p>
                </div>
                <div className="text-right">
                  {(() => {
                    const s = formatStatus(viewTransaction.status);
                    return (
                      <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold border ${s.twClass}`}>
                        {s.label || viewTransaction.status || 'Annulé'}
                      </span>
                    );
                  })()}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Informations générales</h4>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-slate-500">Référence</p>
                      <p className="text-sm font-mono text-slate-900">{viewTransaction.reference || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Date</p>
                      <p className="text-sm text-slate-900 font-medium">{formatDate(viewTransaction.date || viewTransaction.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Moyen de paiement</p>
                      <p className="text-sm text-slate-900 font-medium">{formatMethod(viewTransaction.method)}</p>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Acteurs</h4>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-slate-500">Client / Locataire</p>
                      <p className="text-sm text-slate-900 font-bold">{viewTransaction.client_name || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Encaissé par</p>
                      <p className="text-sm text-slate-900 font-medium">{viewTransaction.collector_name || viewTransaction.username || 'Agence SYGIM'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setPrintTransaction(viewTransaction)}
                className="px-4 py-2 border border-primary text-primary hover:bg-primary hover:text-white font-medium text-sm rounded-lg transition-colors flex items-center gap-2"
              >
                <i className="fas fa-print"></i> Imprimer le reçu
              </button>
              <button onClick={() => setViewTransaction(null)} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium text-sm rounded-lg">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL D'EXTOURNE COMPTABLE */}
      {reversingTransaction && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-rose-50/50">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <i className="fas fa-undo text-lg"></i>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Extourne comptable</h3>
                <p className="text-xs text-slate-500">Annulation officielle avec écriture compensatoire</p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                <p><span className="font-semibold text-slate-700">Réf :</span> <span className="font-mono">{reversingTransaction.reference}</span></p>
                <p><span className="font-semibold text-slate-700">Client :</span> {reversingTransaction.client_name || '-'}</p>
                <p><span className="font-semibold text-slate-700">Montant :</span> <span className="font-bold text-slate-900">{formatXOF(reversingTransaction.amount)}</span></p>
              </div>
              <div>
                <label htmlFor="reversalReason" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Motif obligatoire de l'extourne <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id="reversalReason"
                  rows="3"
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  placeholder="Ex: Erreur de saisie caisse, chèque rejeté..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setReversingTransaction(null)}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isSubmittingReversal || !reversalReason.trim() || reversalReason.trim().length < 5}
                onClick={async () => {
                  setIsSubmittingReversal(true);
                  try {
                    const res = await API.Financial.reversePayment(reversingTransaction.id, {
                      reason: reversalReason.trim()
                    });
                    if (res?.success) {
                      showToast({ type: 'success', message: 'Transaction extournée avec succès.' });
                      setReversingTransaction(null);
                      window.location.reload();
                    } else {
                      showToast({ type: 'error', message: res?.error || 'Erreur lors de l\'extourne.' });
                    }
                  } catch (err) {
                    showToast({ type: 'error', message: err.message || 'Erreur lors de l\'extourne.' });
                  } finally {
                    setIsSubmittingReversal(false);
                  }
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium text-sm rounded-lg disabled:opacity-50"
              >
                {isSubmittingReversal ? 'Traitement...' : 'Confirmer l\'extourne'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
