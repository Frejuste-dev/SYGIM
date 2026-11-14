import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useDashboardKpis } from '../hooks/queries/useDashboardKpis';
import { useTransactions, useTransactionStats } from '../hooks/queries/useTransactions';
import { API } from '../api/services';
import { useToast } from '../components/ToastContext';
import Modal from '../components/Modal';
import OwnerPayoutModal from '../components/OwnerPayoutModal';
import InstallmentHistoryModal from '../components/InstallmentHistoryModal';
import TableSkeleton from '../components/ui/TableSkeleton';
import { formatXOF, formatDate, formatMethod } from '../utils/formatters';
import { exportToExcel, exportToPDF, printOwnerSettlementReceipt } from '../utils/exportUtils';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import PerformanceDashboardView from '../components/accounting/performance/PerformanceDashboardView';

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

export default function AccountingDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('performance'); // 'performance' | 'overview' | 'pending_validation' | 'settlements' | 'ledger'
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [selectedOwnerForPayout, setSelectedOwnerForPayout] = useState(null);
  const [selectedSettlementForInstallments, setSelectedSettlementForInstallments] = useState(null);

  const [settlements, setSettlements] = useState([]);
  const [settlementStats, setSettlementStats] = useState({});
  const [ledgerData, setLedgerData] = useState({ entries: [], summary: {} });
  const [pendingTransactions, setPendingTransactions] = useState([]);
  const [loadingFinancial, setLoadingFinancial] = useState(false);

  // Modale de validation réception des fonds
  const [selectedTxForValidation, setSelectedTxForValidation] = useState(null);
  const [validationNotes, setValidationNotes] = useState('');
  const [validatingTx, setValidatingTx] = useState(false);

  // Modale de rejet d'encaissement
  const [selectedTxForRejection, setSelectedTxForRejection] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectingTx, setRejectingTx] = useState(false);

  const { data: kpis = {}, isLoading: kpisLoading } = useDashboardKpis();
  const { data: transactionsData = {}, isLoading: txLoading } = useTransactions({ limit: 15 });
  const transactions = Array.isArray(transactionsData) ? transactionsData : (transactionsData?.data || []);
  const { data: stats = {}, isLoading: statsLoading } = useTransactionStats({});

  const loadFinancialData = useCallback(async () => {
    setLoadingFinancial(true);
    try {
      const [stlResult, ldgResult, pendingResult] = await Promise.allSettled([
        API.Financial.getSettlements(),
        API.Financial.getGeneralLedger(),
        API.Transactions.getAll({ status: 'pending', limit: 100 })
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

      if (pendingResult.status === 'fulfilled') {
        const pendingRes = pendingResult.value;
        const pendingPayload = pendingRes?.data || pendingRes || [];
        setPendingTransactions(Array.isArray(pendingPayload) ? pendingPayload : (pendingPayload.data || []));
      }
    } catch (err) {
      console.error('Erreur chargement données comptables:', err);
    } finally {
      setLoadingFinancial(false);
    }
  }, []);

  const handleConfirmValidation = async () => {
    if (!selectedTxForValidation) return;
    try {
      setValidatingTx(true);
      await API.Transactions.validate(selectedTxForValidation.id, { notes: validationNotes });
      showToast({
        type: 'success',
        message: `Encaissement de ${formatXOF(selectedTxForValidation.amount)} validé avec succès. Les fonds ont été réceptionnés en caisse.`
      });
      setSelectedTxForValidation(null);
      setValidationNotes('');
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      loadFinancialData();
    } catch (err) {
      showToast({
        type: 'error',
        message: err.response?.data?.message || err.message || 'Erreur lors de la validation.'
      });
    } finally {
      setValidatingTx(false);
    }
  };

  const handleConfirmRejection = async () => {
    if (!selectedTxForRejection) return;
    try {
      setRejectingTx(true);
      await API.Transactions.reject(selectedTxForRejection.id, { reason: rejectionReason });
      showToast({
        type: 'info',
        message: `Transaction ${selectedTxForRejection.reference} rejetée.`
      });
      setSelectedTxForRejection(null);
      setRejectionReason('');
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      loadFinancialData();
    } catch (err) {
      showToast({
        type: 'error',
        message: err.response?.data?.message || err.message || 'Erreur lors du rejet.'
      });
    } finally {
      setRejectingTx(false);
    }
  };

  useEffect(() => {
    loadFinancialData();
  }, [loadFinancialData]);

  const totalRevenue = kpis.totalRevenue ?? 0;
  const totalDue = kpis.totalDue ?? 0;
  const collectionRate = kpis.collectionRate ?? 0;
  const todayRevenue = stats.todayCollected || 0;

  const totalPendingAmount = useMemo(() => {
    return pendingTransactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  }, [pendingTransactions]);

  const methodColors = { cash: '#10b981', mobile_money: '#f59e0b', bank_transfer: '#3b82f6', cheque: '#8b5cf6', default: '#94a3b8' };
  const paymentMethodData = (stats.methodStats || []).map(m => ({
    name: formatMethod(m.name),
    value: m.value,
    color: methodColors[m.name] || methodColors.default
  })).filter(d => d.value > 0);

  const sparklineDataDay = [{ v: 5 }, { v: 15 }, { v: 10 }, { v: 25 }, { v: 20 }, { v: 35 }, { v: todayRevenue > 0 ? 50 : 40 }];
  const sparklineDataDue = [{ v: 100 }, { v: 85 }, { v: 90 }, { v: 75 }, { v: 80 }, { v: 60 }, { v: Math.max(0, totalDue - totalRevenue) > 0 ? 50 : 40 }];

  const today = new Date().toISOString().slice(0, 10);

  // Exports Transactions
  const handleExportTransactionsExcel = () => {
    const rows = transactions.map(tx => ({
      reference: tx.reference || tx.id,
      date: formatDate(tx.date || tx.createdAt),
      client: tx.client_name || tx.client || 'N/A',
      montant: `${Number(tx.amount || 0).toLocaleString('fr-FR')} FCFA`,
      methode: formatMethod(tx.method),
      statut: tx.status === 'processed' || tx.status === 'paid' ? 'Traité / Payé' : tx.status
    }));
    const columns = {
      reference: 'Référence',
      date: 'Date',
      client: 'Locataire',
      montant: 'Montant (FCFA)',
      methode: 'Moyen de paiement',
      statut: 'Statut'
    };
    exportToExcel(rows, `transactions_${today}.xls`, columns, 'Journal des Encaissements & Transactions — SYGIM');
  };

  const handleExportTransactionsPDF = () => {
    const rows = transactions.map(tx => ({
      reference: tx.reference || tx.id,
      date: formatDate(tx.date || tx.createdAt),
      client: tx.client_name || tx.client || 'N/A',
      montant: `${Number(tx.amount || 0).toLocaleString('fr-FR')} FCFA`,
      methode: formatMethod(tx.method),
      statut: tx.status === 'processed' || tx.status === 'paid' ? 'Payé' : tx.status
    }));
    const columns = {
      reference: 'Référence',
      date: 'Date',
      client: 'Locataire',
      montant: 'Montant (FCFA)',
      methode: 'Moyen',
      statut: 'Statut'
    };
    exportToPDF(rows, `transactions_${today}.pdf`, columns, {
      title: 'Journal des Transactions & Encaissements Locataires',
      subtitle: 'Historique des paiements de loyers encaissés',
      summaryItems: [
        { label: 'Total Encaissé', value: formatXOF(totalRevenue, { compact: false }) },
        { label: 'Encaissements du jour', value: formatXOF(todayRevenue, { compact: false }) },
        { label: 'Nombre de transactions', value: String(transactions.length) }
      ]
    });
  };

  // Exports Paiements Propriétaires
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

  const settlementColumns = {
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
      settlementColumns,
      'État des Paiements & Préfinancements Propriétaires — SYGIM'
    );
  };

  const handleExportSettlementsPDF = () => {
    exportToPDF(
      getSettlementExportRows(),
      `paiements_proprietaires_${today}.pdf`,
      settlementColumns,
      {
        title: 'État des Paiements & Préfinancements Propriétaires',
        subtitle: 'Reversements mensuels, paiements échelonnés et avances de trésorerie',
        summaryItems: [
          { label: 'Total Reversé aux Propriétaires', value: formatXOF(settlementStats.totalDisbursed || 0, { compact: false }) },
          { label: 'Total Préfinancé (Avances)', value: formatXOF(settlementStats.totalPrefinanced || 0, { compact: false }) },
          { label: 'Commissions Agence', value: formatXOF(settlementStats.totalCommission || 0, { compact: false }) },
          { label: 'Reste à verser (Échelonné)', value: formatXOF(settlementStats.totalRemainingToPay || 0, { compact: false }) }
        ]
      }
    );
  };

  // Exports Grand Livre
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

  const ledgerColumns = {
    date: 'Date',
    reference: 'Référence',
    category: 'Catégorie',
    third_party: 'Tiers (Locataire / Propriétaire)',
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
      ledgerColumns,
      'Grand Livre Comptable Général — SYGIM'
    );
  };

  const handleExportLedgerPDF = () => {
    exportToPDF(
      getLedgerExportRows(),
      `grand_livre_comptable_${today}.pdf`,
      ledgerColumns,
      {
        title: 'Grand Livre Comptable Général — SYGIM',
        subtitle: 'Journal unifié des encaissements locataires, reversements propriétaires et préfinancements',
        summaryItems: [
          { label: 'Total Crédit (Encaissements)', value: formatXOF(ledgerData.summary?.totalCredit || 0, { compact: false }) },
          { label: 'Total Débit (Reversements & Avances)', value: formatXOF(ledgerData.summary?.totalDebit || 0, { compact: false }) },
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

  const loading = kpisLoading || txLoading || statsLoading;

  if (loading) {
    return (
      <div className="bg-blue-50 text-blue-700 p-4 rounded-lg flex items-center gap-3">
        <i className="fas fa-spinner fa-spin"></i>
        <span>Chargement de l'espace comptable...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden box-border">
      {/* EN-TÊTE COMPTABLE + ACTIONS RAPIDES */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <i className="fas fa-calculator text-lg"></i>
            </span>
            <span>Espace Comptabilité &amp; Trésorerie</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Gérez les encaissements locataires, les reversements propriétaires (intégraux, échelonnés, préfinancements) et le Grand Livre.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0 flex-nowrap">
          <button
            type="button"
            onClick={() => navigate('/admin/owners')}
            className="h-9 px-3.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg shadow-2xs inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
          >
            <i className="fas fa-user-tie text-primary"></i>
            <span>Propriétaires &amp; Biens</span>
          </button>
          <button
            type="button"
            onClick={() => { setSelectedOwnerForPayout(null); setShowPayoutModal(true); }}
            className="h-9 px-3.5 bg-primary hover:bg-primary-dark text-white text-xs font-bold rounded-lg shadow-2xs inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
          >
            <i className="fas fa-hand-holding-dollar"></i>
            <span>+ Payer / Préfinancer</span>
          </button>
        </div>
      </div>

      {/* BARRE D'ONGLETS COMPTABLES */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto flex-nowrap sm:flex-wrap mb-6">
        <button
          type="button"
          onClick={() => setActiveTab('performance')}
          className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all inline-flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'performance'
              ? 'bg-primary text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <i className="fas fa-chart-line text-xs"></i>
          <span>Performance</span>
          <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
            activeTab === 'performance'
              ? 'bg-white/20 text-white'
              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          }`}>
            Nouveau
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all inline-flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-primary text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <i className="fas fa-chart-pie text-xs"></i>
          <span>Vue d'ensemble</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('pending_validation')}
          className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all inline-flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'pending_validation'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-amber-50 hover:text-amber-800 border border-amber-200'
          }`}
        >
          <i className={`fas fa-clock text-xs ${activeTab === 'pending_validation' ? 'text-white' : 'text-amber-500'}`}></i>
          <span>À valider</span>
          {pendingTransactions.length > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
              activeTab === 'pending_validation' ? 'bg-white text-amber-800' : 'bg-amber-500 text-white'
            }`}>
              {pendingTransactions.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('settlements')}
          className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all inline-flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'settlements'
              ? 'bg-primary text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <i className="fas fa-hand-holding-dollar text-xs"></i>
          <span>Reversements</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${activeTab === 'settlements' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
            {settlements.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('ledger')}
          className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all inline-flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'ledger'
              ? 'bg-primary text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <i className="fas fa-book text-xs"></i>
          <span>Grand Livre</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${activeTab === 'ledger' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'}`}>
            {ledgerData.entries?.length || 0}
          </span>
        </button>
      </div>

      {/* ONGLET 0 : PERFORMANCE & ANALYTIQUE (Shopify Analytics Light Mode) */}
      {activeTab === 'performance' && (
        <PerformanceDashboardView />
      )}

      {/* ONGLET 1 : VUE D'ENSEMBLE */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Bannière Alerte Versements Terrain en attente */}
          {pendingTransactions.length > 0 && (
            <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center text-lg shrink-0 shadow-2xs">
                  <i className="fas fa-hand-holding-dollar"></i>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-amber-950">
                    {pendingTransactions.length} encaissement(s) terrain en attente de versement ({formatXOF(totalPendingAmount)})
                  </h4>
                  <p className="text-xs text-amber-800 mt-0.5">
                    Les collecteurs ont saisi des paiements sur le terrain. Réceptionnez physiquement les fonds avant de valider l'entrée en caisse.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('pending_validation')}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-2xs"
              >
                <i className="fas fa-check-double"></i> Valider les versements
              </button>
            </div>
          )}
          {/* KPIs Comptables */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Total Loyers Encaissés</div>
                  <div className="text-2xl font-extrabold text-emerald-600 tracking-tight">{formatXOF(totalRevenue)}</div>
                </div>
                <div className="w-16 h-10 opacity-70">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sparklineDataDay}>
                      <Line type="monotone" dataKey="v" stroke="#10b981" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="text-xs mt-4 flex items-center gap-1.5 text-emerald-600">
                <i className="fas fa-check-circle"></i> Taux de recouvrement : {collectionRate}%
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Arriérés Locataires</div>
                  <div className="text-2xl font-extrabold text-rose-600 tracking-tight">{formatXOF(Math.max(0, totalDue - totalRevenue))}</div>
                </div>
                <div className="w-16 h-10 opacity-70">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sparklineDataDue}>
                      <Line type="monotone" dataKey="v" stroke="#f43f5e" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="text-xs mt-4 flex items-center gap-1.5 text-rose-600">
                <i className="fas fa-bolt"></i> Éligible au préfinancement propriétaire
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col justify-between">
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Reversé aux Propriétaires</div>
                <div className="text-2xl font-extrabold text-slate-900 tracking-tight">{formatXOF(settlementStats.totalDisbursed || 0)}</div>
              </div>
              <div className="text-xs mt-4 flex items-center gap-1.5 text-blue-600">
                <i className="fas fa-hand-holding-usd"></i> {settlements.length} règlement(s) enregistré(s)
              </div>
            </div>

            <div className="bg-amber-50/70 rounded-2xl border border-amber-200 shadow-sm p-6 flex flex-col justify-between">
              <div>
                <div className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-2">Préfinancements Actifs</div>
                <div className="text-2xl font-extrabold text-amber-900 tracking-tight">{formatXOF(settlementStats.totalPrefinanced || 0)}</div>
              </div>
              <div className="text-xs mt-4 flex items-center gap-1.5 text-amber-800 font-medium">
                <i className="fas fa-shield-alt"></i> Avances versées avant paiement locataire
              </div>
            </div>
          </div>

          {/* Graphique & Synthèse */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Répartition des Encaissements par Méthode</h3>
              {paymentMethodData.length > 0 ? (
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={paymentMethodData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={5} dataKey="value">
                        {paymentMethodData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={(value) => formatXOF(value, { compact: false })} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[240px] flex items-center justify-center text-slate-400 text-sm">
                  Aucune donnée financière disponible
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Synthèse Trésorerie & Reversements</h3>
                <p className="text-xs text-slate-500 mb-4">Position financière consolidée entre les loyers perçus et les reversements propriétaires.</p>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                    <span className="text-sm font-medium text-emerald-900"><i className="fas fa-arrow-down mr-2 text-emerald-600"></i>Total Crédit (Loyers encaissés)</span>
                    <span className="text-sm font-bold text-emerald-700">{formatXOF(ledgerData.summary?.totalCredit || totalRevenue, { compact: false })}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-rose-50 rounded-xl border border-rose-100">
                    <span className="text-sm font-medium text-rose-900"><i className="fas fa-arrow-up mr-2 text-rose-600"></i>Total Débit (Paiements propriétaires)</span>
                    <span className="text-sm font-bold text-rose-700">{formatXOF(ledgerData.summary?.totalDebit || settlementStats.totalDisbursed || 0, { compact: false })}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-amber-50 rounded-xl border border-amber-200">
                    <span className="text-sm font-medium text-amber-900"><i className="fas fa-bolt mr-2 text-amber-600"></i>Dont Préfinancements (Avances agence)</span>
                    <span className="text-sm font-bold text-amber-800">{formatXOF(settlementStats.totalPrefinanced || 0, { compact: false })}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-slate-900 text-white rounded-xl">
                    <span className="text-sm font-semibold">Solde Net de Trésorerie</span>
                    <span className="text-base font-extrabold text-emerald-400">{formatXOF(ledgerData.summary?.netBalance ?? (totalRevenue - (settlementStats.totalDisbursed || 0)), { compact: false })}</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button onClick={() => setActiveTab('settlements')} className="text-xs font-semibold text-primary hover:underline">
                  Voir les paiements propriétaires →
                </button>
              </div>
            </div>
          </div>

          {/* Dernières Transactions Locataires */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <i className="fas fa-list text-primary"></i>
                  Dernières Transactions (Encaissements Locataires)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Flux récents d'encaissements validés et intégrés en caisse.</p>
              </div>
              <div className="flex items-center gap-2.5 shrink-0 flex-nowrap">
                <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50/80 p-0.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={handleExportTransactionsExcel}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold text-slate-700 hover:text-emerald-700 hover:bg-white transition-colors cursor-pointer"
                    title="Exporter en Excel"
                  >
                    <i className="fas fa-file-excel text-emerald-600"></i>
                    <span>Excel</span>
                  </button>
                  <div className="h-4 w-px bg-slate-200"></div>
                  <button
                    type="button"
                    onClick={handleExportTransactionsPDF}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold text-slate-700 hover:text-rose-700 hover:bg-white transition-colors cursor-pointer"
                    title="Exporter en PDF"
                  >
                    <i className="fas fa-file-pdf text-rose-600"></i>
                    <span>PDF</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/admin/transactions')}
                  className="h-8 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  <span>Toutes les transactions</span>
                  <i className="fas fa-arrow-right text-[10px]"></i>
                </button>
              </div>
            </div>

            {transactions.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">Aucune transaction récente.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50/70 border-b border-slate-200/80 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                      <th className="py-3.5 px-4 whitespace-nowrap">Réf.</th>
                      <th className="py-3.5 px-4 whitespace-nowrap">Date</th>
                      <th className="py-3.5 px-4 whitespace-nowrap">Locataire</th>
                      <th className="py-3.5 px-4 whitespace-nowrap">Moyen</th>
                      <th className="py-3.5 px-4 text-right whitespace-nowrap">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transactions.slice(0, 10).map(tx => (
                      <tr key={tx.id || tx.reference} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-600 whitespace-nowrap">{tx.reference || tx.id}</td>
                        <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">{formatDate(tx.date || tx.createdAt)}</td>
                        <td className="py-3.5 px-4 font-medium text-slate-900 whitespace-nowrap">{tx.client_name || tx.client || '-'}</td>
                        <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">{formatMethod(tx.method)}</td>
                        <td className="py-3.5 px-4 text-right font-bold text-emerald-600 tabular-nums whitespace-nowrap">+{formatXOF(tx.amount, { compact: false })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ONGLET 2 : ENCAISSEMENTS TERRAIN À VALIDER (REMISE DES FONDS COLLECTEURS) */}
      {activeTab === 'pending_validation' && (
        <div className="space-y-6">
          {/* KPIs Versements Terrain */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-6 bg-amber-50/20">
              <div className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-2">Total Fonds Terrain à Réceptionner</div>
              <div className="text-2xl font-black text-amber-900 tracking-tight">{formatXOF(totalPendingAmount)}</div>
              <div className="text-xs text-amber-700 mt-2 font-medium flex items-center gap-1">
                <i className="fas fa-clock"></i> En attente de remise physique à la caisse
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nombre d'Encaissements Saisis</div>
              <div className="text-2xl font-black text-slate-900 tracking-tight">{pendingTransactions.length} transaction(s)</div>
              <div className="text-xs text-slate-500 mt-2">Enregistrées avec signature client</div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Agents Collecteurs Porteurs</div>
              <div className="text-2xl font-black text-slate-900 tracking-tight">
                {new Set(pendingTransactions.map(t => t.collector_id).filter(Boolean)).size} collecteur(s)
              </div>
              <div className="text-xs text-slate-500 mt-2">Porteurs de fonds sur le terrain</div>
            </div>
          </div>

          {/* Tableau de validation des encaissements */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <i className="fas fa-hand-holding-usd text-amber-600"></i>
                  File d'Attente de Validation des Encaissements Terrain
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Vérifiez le montant physique remis par le collecteur et cliquez sur « Valider la réception » pour créditer le locataire et intégrer les fonds.
                </p>
              </div>
              <button
                type="button"
                onClick={loadFinancialData}
                disabled={loadingFinancial}
                className="h-8 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <i className={`fas fa-sync text-xs ${loadingFinancial ? 'fa-spin' : ''}`}></i>
                <span>Actualiser</span>
              </button>
            </div>

            {pendingTransactions.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 text-2xl">
                  <i className="fas fa-check-double"></i>
                </div>
                <h4 className="text-base font-bold text-slate-800">Aucun encaissement en attente de validation</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Tous les fonds saisis par les récolteurs terrain ont été réceptionnés et validés en caisse.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50/70 border-b border-slate-200/80 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                      <th className="py-3.5 px-4 font-semibold whitespace-nowrap">Réf. &amp; Date</th>
                      <th className="py-3.5 px-4 font-semibold whitespace-nowrap">Collecteur (Porteur)</th>
                      <th className="py-3.5 px-4 font-semibold whitespace-nowrap">Locataire &amp; Bien</th>
                      <th className="py-3.5 px-4 font-semibold whitespace-nowrap">Moyen</th>
                      <th className="py-3.5 px-4 text-right font-semibold whitespace-nowrap">Montant Reçu</th>
                      <th className="py-3.5 px-4 text-center font-semibold whitespace-nowrap">Statut</th>
                      <th className="py-3.5 px-4 text-right font-semibold whitespace-nowrap min-w-[150px]">Action Comptable</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pendingTransactions.map(t => (
                      <tr key={t.id} className="hover:bg-amber-50/30 transition-colors">
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-mono text-xs font-bold text-slate-900">{t.reference || `TX-${t.id}`}</div>
                          <div className="text-xs text-slate-400">{formatDate(t.date || t.created_at)}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-800">{t.collector_name || 'Agent Collecteur'}</div>
                          {t.collector_phone && <div className="text-xs text-slate-400">{t.collector_phone}</div>}
                          {t.collector_zone && <span className="inline-block text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded mt-0.5">{t.collector_zone}</span>}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900 truncate max-w-[180px]" title={t.client_name || t.client || 'Locataire'}>{t.client_name || t.client || 'Locataire'}</div>
                          <div className="text-xs text-slate-500 truncate max-w-[180px]" title={t.property_name || '—'}>{t.property_name || '—'}</div>
                        </td>
                        <td className="py-3.5 px-4 text-xs font-medium text-slate-600 whitespace-nowrap">
                          {formatMethod(t.method)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-amber-900 text-sm tabular-nums whitespace-nowrap">
                          {formatXOF(t.amount, { compact: false })}
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200/80">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                            À réceptionner
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => { setSelectedTxForValidation(t); setValidationNotes(''); }}
                              className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs transition-all whitespace-nowrap cursor-pointer"
                              title="Valider la réception physique des fonds en caisse"
                            >
                              <i className="fas fa-check-circle text-xs"></i>
                              <span>Valider réception</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => { setSelectedTxForRejection(t); setRejectionReason(''); }}
                              className="w-8 h-8 rounded-lg inline-flex items-center justify-center bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-700 border border-slate-200 transition-colors cursor-pointer"
                              title="Rejeter cet encaissement"
                            >
                              <i className="fas fa-times text-xs"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ONGLET 3 : PAIEMENTS & PRÉFINANCEMENTS PROPRIÉTAIRES */}
      {activeTab === 'settlements' && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <i className="fas fa-hand-holding-usd text-emerald-600"></i>
                Historique des Paiements & Préfinancements Propriétaires
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Suivi des reversements propriétaires (paiement intégral, paiement échelonné, ou préfinancement sur loyer impayé).
              </p>
            </div>
            <div className="flex items-center gap-2.5 shrink-0 flex-nowrap">
              <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50/80 p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={handleExportSettlementsExcel}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold text-slate-700 hover:text-emerald-700 hover:bg-white transition-colors cursor-pointer"
                  title="Exporter les règlements en Excel"
                >
                  <i className="fas fa-file-excel text-emerald-600"></i>
                  <span>Excel</span>
                </button>
                <div className="h-4 w-px bg-slate-200"></div>
                <button
                  type="button"
                  onClick={handleExportSettlementsPDF}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold text-slate-700 hover:text-rose-700 hover:bg-white transition-colors cursor-pointer"
                  title="Exporter les règlements en PDF"
                >
                  <i className="fas fa-file-pdf text-rose-600"></i>
                  <span>PDF</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => { setSelectedOwnerForPayout(null); setShowPayoutModal(true); }}
                className="h-9 px-3.5 bg-primary hover:bg-primary-dark text-white rounded-lg text-xs font-bold transition-all shadow-2xs inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <i className="fas fa-plus text-xs"></i>
                <span>Nouveau Versement</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200/80 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4 whitespace-nowrap">Réf.</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Propriétaire & Bien(s)</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Période / Date</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Mode & Moyen</th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">Net Dû</th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">Versé</th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">Reste</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Statut</th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap min-w-[170px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingFinancial ? (
                  <TableSkeleton rows={5} columns={9} />
                ) : settlements.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="py-12 text-center text-slate-500">
                      Aucun règlement propriétaire enregistré. Cliquez sur « Nouveau Versement ».
                    </td>
                  </tr>
                ) : (
                  settlements.map(s => {
                    const modeBadge = PAYOUT_MODE_BADGES[s.payout_mode] || PAYOUT_MODE_BADGES.full;
                    const statusBadge = SETTLEMENT_STATUS_BADGES[s.status] || SETTLEMENT_STATUS_BADGES.paid;
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-700 whitespace-nowrap">
                          {s.transaction_reference || `REV-${s.id}`}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900 leading-tight">{s.owner_name || `Propriétaire #${s.owner_id}`}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{s.property_name || 'Tous les biens attribués'}</div>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                          <div>Du {formatDate(s.period_start)} au {formatDate(s.period_end)}</div>
                          {s.scheduled_date && <div className="text-slate-400 mt-0.5">Échéance : {formatDate(s.scheduled_date)}</div>}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${modeBadge.cls}`}>
                            {s.is_prefinanced ? <i className="fas fa-bolt mr-1 text-amber-600"></i> : null}
                            {modeBadge.label}
                          </span>
                          <div className="text-xs text-slate-500 mt-1">{formatMethod(s.payment_method || 'bank_transfer')}</div>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-800 text-right tabular-nums whitespace-nowrap">{formatXOF(s.net_amount, { compact: false })}</td>
                        <td className="py-3.5 px-4 font-bold text-emerald-700 text-right tabular-nums whitespace-nowrap">{formatXOF(s.amount_paid || s.net_amount, { compact: false })}</td>
                        <td className="py-3.5 px-4 font-semibold text-rose-600 text-right tabular-nums whitespace-nowrap">
                          {s.remaining_to_pay > 0 ? formatXOF(s.remaining_to_pay, { compact: false }) : formatXOF(0, { compact: false })}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${statusBadge.cls}`}>
                            {statusBadge.label}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1.5 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setSelectedSettlementForInstallments(s)}
                              className={`h-8 px-2.5 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer ${
                                s.remaining_to_pay > 0
                                  ? 'bg-primary hover:bg-primary-dark text-white shadow-2xs'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                              }`}
                              title="Voir l'historique des tranches ou enregistrer un versement partiel"
                            >
                              <i className={`fas ${s.remaining_to_pay > 0 ? 'fa-plus-circle' : 'fa-layer-group'} text-xs`}></i>
                              <span>{s.remaining_to_pay > 0 ? '+ Tranche' : `Tranches (${s.installments?.length || 1})`}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => printOwnerSettlementReceipt(s)}
                              className="h-8 px-2.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                              title="Imprimer le Bordereau / Reçu Officiel PDF"
                            >
                              <i className="fas fa-print text-xs"></i>
                              <span>Bordereau</span>
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
      )}

      {/* ONGLET 3 : GRAND LIVRE COMPTABLE */}
      {activeTab === 'ledger' && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <i className="fas fa-book text-indigo-600"></i>
                Grand Livre Comptable Général (Journal Centralisé)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Toutes les écritures de Crédit (encaissements) et Débit (règlements propriétaires) avec solde progressif.
              </p>
            </div>
            <div className="flex items-center gap-2.5 shrink-0 flex-nowrap">
              <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50/80 p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={handleExportLedgerExcel}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold text-slate-700 hover:text-emerald-700 hover:bg-white transition-colors cursor-pointer"
                  title="Exporter le Grand Livre en Excel"
                >
                  <i className="fas fa-file-excel text-emerald-600"></i>
                  <span>Excel</span>
                </button>
                <div className="h-4 w-px bg-slate-200"></div>
                <button
                  type="button"
                  onClick={handleExportLedgerPDF}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold text-slate-700 hover:text-rose-700 hover:bg-white transition-colors cursor-pointer"
                  title="Exporter le Grand Livre en PDF"
                >
                  <i className="fas fa-file-pdf text-rose-600"></i>
                  <span>PDF</span>
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200/80 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4 whitespace-nowrap">Date</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Réf.</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Catégorie</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Tiers</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Bien</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Libellé</th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">Crédit (+)</th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">Débit (-)</th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">Solde Progressif</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(ledgerData.entries || []).length === 0 ? (
                  <tr>
                    <td colSpan="9" className="py-12 text-center text-slate-500">Aucune écriture au Grand Livre.</td>
                  </tr>
                ) : (
                  ledgerData.entries.map(e => (
                    <tr key={e.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">{formatDate(e.date)}</td>
                      <td className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-700 whitespace-nowrap">{e.reference}</td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
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
                      <td className="py-3.5 px-4 font-medium text-slate-900 whitespace-nowrap">{e.third_party}</td>
                      <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">{e.property_name || '—'}</td>
                      <td className="py-3.5 px-4 text-xs text-slate-600 max-w-[220px] truncate" title={e.description}>{e.description}</td>
                      <td className="py-3.5 px-4 text-right font-bold text-emerald-600 tabular-nums whitespace-nowrap">
                        {e.credit > 0 ? `+${formatXOF(e.credit, { compact: false })}` : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-rose-600 tabular-nums whitespace-nowrap">
                        {e.debit > 0 ? `-${formatXOF(e.debit, { compact: false })}` : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-extrabold text-slate-900 bg-slate-50/60 tabular-nums whitespace-nowrap">
                        {formatXOF(e.running_balance, { compact: false })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showPayoutModal && (
        <OwnerPayoutModal
          isOpen={showPayoutModal}
          onClose={() => setShowPayoutModal(false)}
          preselectedOwner={selectedOwnerForPayout}
          onSuccess={loadFinancialData}
        />
      )}

      {selectedSettlementForInstallments && (
        <InstallmentHistoryModal
          settlement={selectedSettlementForInstallments}
          onClose={() => setSelectedSettlementForInstallments(null)}
          onSuccess={loadFinancialData}
        />
      )}

      {/* MODALE DE VALIDATION DE RÉCEPTION DES FONDS PAR LE COMPTABLE */}
      {selectedTxForValidation && (
        <Modal
          isOpen={Boolean(selectedTxForValidation)}
          onClose={() => !validatingTx && setSelectedTxForValidation(null)}
          title="Validation de Réception des Fonds Collecteur"
        >
          <div className="space-y-4 text-sm text-slate-700">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-xl shrink-0 shadow-2xs">
                <i className="fas fa-hand-holding-usd"></i>
              </div>
              <div>
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">Montant à réceptionner en caisse</span>
                <span className="text-2xl font-black text-emerald-950">{formatXOF(selectedTxForValidation.amount, { compact: false })}</span>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Référence encaissement :</span>
                <span className="font-mono font-bold text-slate-800">{selectedTxForValidation.reference || `TX-${selectedTxForValidation.id}`}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Agent Récolteur (Porteur) :</span>
                <span className="font-bold text-slate-900">{selectedTxForValidation.collector_name || 'Agent Collecteur'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Locataire payeur :</span>
                <span className="font-semibold text-slate-800">{selectedTxForValidation.client_name || selectedTxForValidation.client || 'Locataire'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Bien immobilier concerné :</span>
                <span className="text-slate-700 font-medium">{selectedTxForValidation.property_name || '—'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Mode de paiement :</span>
                <span className="font-semibold text-slate-800">{formatMethod(selectedTxForValidation.method)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Date de collecte terrain :</span>
                <span className="text-slate-700">{formatDate(selectedTxForValidation.date || selectedTxForValidation.created_at)}</span>
              </div>
            </div>

            {selectedTxForValidation.signature_data && (
              <div className="border border-slate-200 rounded-xl p-2.5 bg-white">
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Émargement / Signature numérique du locataire</span>
                <img
                  src={selectedTxForValidation.signature_data}
                  alt="Signature locataire"
                  className="max-h-20 max-w-full object-contain mx-auto"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Observations de caisse (optionnel)
              </label>
              <input
                type="text"
                value={validationNotes}
                onChange={(e) => setValidationNotes(e.target.value)}
                placeholder="Ex: Espèces comptées et versées à la caisse N°1..."
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={validatingTx}
                onClick={() => setSelectedTxForValidation(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={validatingTx}
                onClick={handleConfirmValidation}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition disabled:opacity-50"
              >
                {validatingTx ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i> Validation...
                  </>
                ) : (
                  <>
                    <i className="fas fa-check-circle"></i> Confirmer la réception des fonds
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODALE DE REJET D'ENCAISSEMENT */}
      {selectedTxForRejection && (
        <Modal
          isOpen={Boolean(selectedTxForRejection)}
          onClose={() => !rejectingTx && setSelectedTxForRejection(null)}
          title="Rejet d'un Encaissement Terrain"
        >
          <div className="space-y-4 text-sm text-slate-700">
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
              <i className="fas fa-exclamation-triangle mr-1.5"></i>
              Vous êtes sur le point de rejeter la transaction <strong>{selectedTxForRejection.reference}</strong> de <strong>{formatXOF(selectedTxForRejection.amount)}</strong>.
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Motif du rejet (obligatoire)
              </label>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Ex: Montant physique non conforme au reçu, doublon de saisie..."
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={rejectingTx}
                onClick={() => setSelectedTxForRejection(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={rejectingTx || !rejectionReason.trim()}
                onClick={handleConfirmRejection}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition disabled:opacity-50"
              >
                {rejectingTx ? 'Rejet...' : 'Confirmer le rejet'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
