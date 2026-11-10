import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { API } from '../api/services';
import StatsCard from '../components/StatsCard';
import OwnerPayoutModal from '../components/OwnerPayoutModal';
import { useToast } from '../components/ToastContext';
import { formatXOF, formatDate, formatStatus, formatMethod } from '../utils/formatters';
import { exportToExcel, exportToPDF, printOwnerSettlementReceipt } from '../utils/exportUtils';

const REPORT_TABS = [
  { key: 'overview', label: "Vue d'ensemble", icon: 'fa-chart-pie' },
  { key: 'prefinancing', label: 'Rapport de Préfinancement', icon: 'fa-bolt', badgeColor: 'bg-amber-100 text-amber-800' },
  { key: 'collectors', label: 'Performance Récolteurs', icon: 'fa-users' },
  { key: 'properties', label: 'Biens & Occupation', icon: 'fa-building' },
  { key: 'overdue', label: 'Impayés & Créances', icon: 'fa-exclamation-triangle', badgeColor: 'bg-rose-100 text-rose-800' },
];

const SEVERITY_BADGES = {
  critique: 'bg-rose-100 text-rose-800 border-rose-200',
  haute: 'bg-orange-100 text-orange-800 border-orange-200',
  normale: 'bg-amber-100 text-amber-800 border-amber-200',
  basse: 'bg-slate-100 text-slate-700 border-slate-200',
};

const createSectionErrors = () => ({
  dashboard: null,
  prefinancing: null,
  collectors: null,
  properties: null,
  overdue: null,
});

const SECTION_LABELS = {
  dashboard: 'Synthèse',
  prefinancing: 'Préfinancements',
  collectors: 'Récolteurs',
  properties: 'Biens',
  overdue: 'Impayés',
};

const unwrapReportData = (response) => response?.data ?? response;

const normalizeReportList = (response) => {
  const data = unwrapReportData(response);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.rows)) return data.rows;
  return [];
};

export default function Reports() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sectionErrors, setSectionErrors] = useState(createSectionErrors);

  // Filtres de période optionnels
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');

  // Données des sections
  const [dashboard, setDashboard] = useState(null);
  const [prefinancingData, setPrefinancingData] = useState({
    summary: {},
    prefinancings: [],
    eligibleCases: []
  });
  const [collectors, setCollectors] = useState([]);
  const [properties, setProperties] = useState([]);
  const [overdue, setOverdue] = useState([]);

  // Modale de préfinancement rapide depuis le rapport
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [preselectedOwner, setPreselectedOwner] = useState(null);

  const dateParams = useMemo(() => {
    const p = {};
    if (startDate) p.startDate = startDate;
    if (endDate) p.endDate = endDate;
    return p;
  }, [startDate, endDate]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const nextSectionErrors = createSectionErrors();

    const safeCall = async (key, apiFn, normalize, fallback) => {
      try {
        const response = await apiFn();
        if (response?.success === false) {
          throw new Error(response.message || response.error || 'Erreur applicative serveur');
        }
        return normalize(response);
      } catch (err) {
        console.error(`[Reports] Erreur section "${key}":`, err);
        nextSectionErrors[key] = err.message || 'Erreur de chargement';
        return fallback;
      }
    };

    try {
      const [dashboardData, prefinData, collectorsData, propertiesData, overdueData] = await Promise.all([
        safeCall('dashboard', () => API.Reports.getDashboard(dateParams), unwrapReportData, null),
        safeCall(
          'prefinancing',
          () => API.Reports.getPrefinancing(dateParams),
          unwrapReportData,
          { summary: {}, prefinancings: [], eligibleCases: [] }
        ),
        safeCall('collectors', () => API.Reports.getAgent(dateParams), normalizeReportList, []),
        safeCall('properties', () => API.Reports.getPropertyStats(), normalizeReportList, []),
        safeCall('overdue', () => API.Reports.getOverdue({}), normalizeReportList, []),
      ]);

      setDashboard(dashboardData);
      setPrefinancingData(prefinData || { summary: {}, prefinancings: [], eligibleCases: [] });
      setCollectors(collectorsData);
      setProperties(propertiesData);
      setOverdue(overdueData);
      setSectionErrors(nextSectionErrors);

      const errorMessages = Object.entries(nextSectionErrors)
        .filter(([, message]) => message)
        .map(([key, message]) => `${SECTION_LABELS[key]} : ${message}`);

      if (errorMessages.length > 0) {
        setError(`Certaines sections n'ont pas pu être chargées :\n${errorMessages.join('\n')}`);
      }
    } catch (globalError) {
      console.error('[Reports] Erreur globale:', globalError);
      setSectionErrors(nextSectionErrors);
      setError(globalError.message || 'Impossible de charger les rapports.');
    } finally {
      setLoading(false);
    }
  }, [dateParams]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Liste filtrée des impayés selon la sévérité
  const filteredOverdue = useMemo(() => {
    if (severityFilter === 'all') return overdue;
    return overdue.filter(o => (o.severity || 'normale') === severityFilter);
  }, [overdue, severityFilter]);

  const prefSummary = prefinancingData?.summary || {};
  const prefinancingsList = prefinancingData?.prefinancings || [];
  const eligiblePrefList = prefinancingData?.eligibleCases || [];

  // =========================================================================
  // EXPORTS EXCEL & PDF PAR ONGLET (Côté client instantané & mis en forme)
  // =========================================================================
  const today = new Date().toISOString().slice(0, 10);

  // 1. Export Rapport de Préfinancement
  const getPrefinancingExportData = () => {
    if (prefinancingsList.length > 0) {
      return prefinancingsList.map(p => ({
        reference: p.reference,
        date: formatDate(p.payout_date),
        owner_name: p.owner_name,
        property_name: p.property_name,
        period: `${formatDate(p.period_start)} au ${formatDate(p.period_end)}`,
        expected_rent: p.expected_rent,
        amount_paid: p.amount_paid,
        agency_commission: p.agency_commission,
        total_collected: p.total_collected,
        unrecovered_amount: p.unrecovered_amount,
        method: formatMethod(p.payment_method),
        status: p.status === 'reimbursed' ? 'Remboursé (Régularisé)' : 'Préfinancé (Actif)'
      }));
    }
    return eligiblePrefList.map(e => ({
      reference: 'ÉLIGIBLE',
      date: formatDate(new Date()),
      owner_name: e.owner_name,
      property_name: `${e.property_name} (Locataire: ${e.tenant_name})`,
      period: 'Mois en cours',
      expected_rent: e.rent_due,
      amount_paid: e.net_prefinance_suggested,
      agency_commission: e.agency_commission,
      total_collected: e.rent_paid,
      unrecovered_amount: e.tenant_arrears,
      method: formatMethod(e.preferred_payment_method),
      status: 'En attente de préfinancement'
    }));
  };

  const PREF_EXPORT_COLS = {
    reference: 'Référence',
    date: 'Date',
    owner_name: 'Propriétaire',
    property_name: 'Bien Immobilier',
    period: 'Période',
    expected_rent: 'Loyer Attendu (XOF)',
    amount_paid: 'Montant Préfinancé (XOF)',
    agency_commission: 'Commission Agence (XOF)',
    total_collected: 'Recouvré Locataire (XOF)',
    unrecovered_amount: 'Reste à Recouvrer (XOF)',
    method: 'Moyen de paiement',
    status: 'Statut'
  };

  const handleExportPrefinancingExcel = () => {
    const rows = getPrefinancingExportData();
    if (!rows.length) {
      return showToast({ type: 'warning', message: 'Aucune donnée de préfinancement à exporter.' });
    }
    exportToExcel(rows, `sygim_rapport_prefinancement_${today}.xls`, PREF_EXPORT_COLS, 'Rapport des Préfinancements Propriétaires — SYGIM');
  };

  const handleExportPrefinancingPDF = () => {
    const rows = getPrefinancingExportData();
    if (!rows.length) {
      return showToast({ type: 'warning', message: 'Aucune donnée de préfinancement à exporter.' });
    }
    exportToPDF(rows, `sygim_rapport_prefinancement_${today}.pdf`, PREF_EXPORT_COLS, {
      title: 'Rapport Officiel des Préfinancements Propriétaires',
      subtitle: 'Suivi des avances de trésorerie agence sur loyers impayés et état des recouvrements locataires',
      summary: [
        { label: 'Total Préfinancé', value: formatXOF(prefSummary.totalPrefinancedAmount || 0, { compact: false }) },
        { label: 'Préfinancements Actifs', value: formatXOF(prefSummary.activePrefinancedAmount || 0, { compact: false }) },
        { label: 'Remboursés (Régularisés)', value: formatXOF(prefSummary.reimbursedAmount || 0, { compact: false }) },
        { label: 'Taux de Régularisation', value: `${prefSummary.reimbursementRate || 0}%` },
        { label: 'Arriérés Éligibles', value: formatXOF(prefSummary.totalEligibleArrears || 0, { compact: false }) }
      ]
    });
  };

  // 2. Export Récolteurs
  const COLLECTOR_EXPORT_COLS = {
    collectorName: 'Récolteur',
    zone: 'Zone',
    assignedPropertiesCount: 'Biens assignés',
    assignedClientsCount: 'Locataires',
    transactionCount: 'Transactions',
    targetAmount: 'Objectif (XOF)',
    totalCollected: 'Total Collecté (XOF)',
    remainingToCollect: 'Reste à Collecter (XOF)',
    recoveryRateStr: 'Taux de Recouvrement'
  };

  const handleExportCollectorsExcel = () => {
    if (!collectors.length) return showToast({ type: 'warning', message: 'Aucun récolteur à exporter.' });
    const rows = collectors.map(c => ({ ...c, recoveryRateStr: `${c.recoveryRate || 0}%` }));
    exportToExcel(rows, `sygim_rapport_recolteurs_${today}.xls`, COLLECTOR_EXPORT_COLS, 'Performance des Récolteurs — SYGIM');
  };

  const handleExportCollectorsPDF = () => {
    if (!collectors.length) return showToast({ type: 'warning', message: 'Aucun récolteur à exporter.' });
    const rows = collectors.map(c => ({ ...c, recoveryRateStr: `${c.recoveryRate || 0}%` }));
    exportToPDF(rows, `sygim_rapport_recolteurs_${today}.pdf`, COLLECTOR_EXPORT_COLS, {
      title: 'Rapport de Performance des Récolteurs',
      subtitle: 'Comparatif des encaissements terrain, objectifs et taux de recouvrement',
      summary: [
        { label: 'Nombre de Récolteurs', value: collectors.length },
        { label: 'Total Collecté', value: formatXOF(collectors.reduce((s, c) => s + Number(c.totalCollected || 0), 0), { compact: false }) },
        { label: 'Total Transactions', value: collectors.reduce((s, c) => s + Number(c.transactionCount || 0), 0) }
      ]
    });
  };

  // 3. Export Biens & Occupation
  const PROPERTY_EXPORT_COLS = {
    statusLabel: 'Statut d\'occupation',
    count: 'Nombre de biens',
    percentageStr: 'Part du parc (%)',
    totalRent: 'Loyers mensuels cumulés (XOF)',
    totalValue: 'Valeur patrimoniale (XOF)'
  };

  const handleExportPropertiesExcel = () => {
    if (!properties.length) return showToast({ type: 'warning', message: 'Aucune statistique immobilière à exporter.' });
    const rows = properties.map(p => ({
      ...p,
      statusLabel: formatStatus(p.status).label || p.status,
      percentageStr: `${p.percentage || 0}%`
    }));
    exportToExcel(rows, `sygim_rapport_occupation_biens_${today}.xls`, PROPERTY_EXPORT_COLS, 'État d\'Occupation du Parc Immobilier — SYGIM');
  };

  const handleExportPropertiesPDF = () => {
    if (!properties.length) return showToast({ type: 'warning', message: 'Aucune statistique immobilière à exporter.' });
    const rows = properties.map(p => ({
      ...p,
      statusLabel: formatStatus(p.status).label || p.status,
      percentageStr: `${p.percentage || 0}%`
    }));
    exportToPDF(rows, `sygim_rapport_occupation_biens_${today}.pdf`, PROPERTY_EXPORT_COLS, {
      title: 'Rapport d\'Occupation du Parc Immobilier',
      subtitle: 'Répartition des biens par statut, potentiel locatif mensuel et valorisation',
      summary: [
        { label: 'Total Biens', value: properties.reduce((s, p) => s + Number(p.count || 0), 0) },
        { label: 'Taux d\'Occupation', value: `${dashboard?.occupancyRate || 0}%` },
        { label: 'Potentiel Locatif Mensuel', value: formatXOF(properties.reduce((s, p) => s + Number(p.totalRent || 0), 0), { compact: false }) }
      ]
    });
  };

  // 4. Export Impayés & Créances
  const getOverdueExportRows = () => filteredOverdue.map(o => ({
    client_name: o.client || `${o.first_name || ''} ${o.last_name || ''}`.trim() || '—',
    phone: o.phone || '—',
    property_name: o.property || o.property_name || '—',
    owner_name: `${o.owner_first_name || ''} ${o.owner_last_name || ''}`.trim() || '—',
    collector_name: (o.collector_name || '').trim() || 'Non assigné',
    rent_due: Number(o.rent_due ?? o.amount ?? 0),
    amount_paid: Number(o.amount_paid || 0),
    amount_owed: Number(o.amount_owed ?? o.amount ?? 0),
    days_late: `${o.days_since_contract ?? o.daysLate ?? 0} j`,
    severity: (o.severity || 'normale').toUpperCase()
  }));

  const OVERDUE_EXPORT_COLS = {
    client_name: 'Locataire',
    phone: 'Téléphone',
    property_name: 'Bien occupé',
    owner_name: 'Propriétaire',
    collector_name: 'Récolteur',
    rent_due: 'Loyer Mensuel (XOF)',
    amount_paid: 'Déjà Versé (XOF)',
    amount_owed: 'Reste Impayé (XOF)',
    days_late: 'Ancienneté / Retard',
    severity: 'Priorité'
  };

  const handleExportOverdueExcel = () => {
    const rows = getOverdueExportRows();
    if (!rows.length) return showToast({ type: 'warning', message: 'Aucun impayé à exporter.' });
    exportToExcel(rows, `sygim_rapport_impayes_${today}.xls`, OVERDUE_EXPORT_COLS, 'État des Impayés & Créances Locataires — SYGIM');
  };

  const handleExportOverduePDF = () => {
    const rows = getOverdueExportRows();
    if (!rows.length) return showToast({ type: 'warning', message: 'Aucun impayé à exporter.' });
    exportToPDF(rows, `sygim_rapport_impayes_${today}.pdf`, OVERDUE_EXPORT_COLS, {
      title: 'Rapport Officiel des Impayés & Créances Locataires',
      subtitle: 'Suivi des retards de loyer, priorités de recouvrement et éligibilité au préfinancement',
      summary: [
        { label: 'Dossiers en Retard', value: rows.length },
        { label: 'Total Créances (Impayés)', value: formatXOF(rows.reduce((s, r) => s + r.amount_owed, 0), { compact: false }) },
        { label: 'Cas Critiques / Haute Priorité', value: filteredOverdue.filter(o => o.severity === 'critique' || o.severity === 'haute').length }
      ]
    });
  };

  // Export rapide contextuel selon l'onglet actif
  const handleGlobalExport = (format = 'pdf') => {
    if (activeTab === 'prefinancing') {
      return format === 'excel' ? handleExportPrefinancingExcel() : handleExportPrefinancingPDF();
    }
    if (activeTab === 'collectors') {
      return format === 'excel' ? handleExportCollectorsExcel() : handleExportCollectorsPDF();
    }
    if (activeTab === 'properties') {
      return format === 'excel' ? handleExportPropertiesExcel() : handleExportPropertiesPDF();
    }
    if (activeTab === 'overdue') {
      return format === 'excel' ? handleExportOverdueExcel() : handleExportOverduePDF();
    }
    // Par défaut sur overview : exporter la synthèse des dernières transactions ou des impayés
    const recentTx = dashboard?.recentTransactions || [];
    if (recentTx.length > 0) {
      const cols = {
        reference: 'Référence',
        date: 'Date',
        client: 'Locataire',
        propertyName: 'Bien immobilier',
        method: 'Moyen de paiement',
        amount: 'Montant (XOF)',
        status: 'Statut'
      };
      const rows = recentTx.map(tx => ({
        reference: tx.reference || `TX-${tx.id}`,
        date: formatDate(tx.date),
        client: tx.client || '—',
        propertyName: tx.propertyName || '—',
        method: formatMethod(tx.method),
        amount: tx.amount,
        status: formatStatus(tx.status).label || tx.status
      }));
      if (format === 'excel') {
        return exportToExcel(rows, `sygim_synthese_analytique_${today}.xls`, cols, 'Synthèse Analytique & Transactions — SYGIM');
      }
      return exportToPDF(rows, `sygim_synthese_analytique_${today}.pdf`, cols, {
        title: 'Rapport de Synthèse Générale & Analytique — SYGIM',
        subtitle: 'Indicateurs consolidés des revenus, reversements propriétaires, préfinancements et impayés',
        summary: [
          { label: 'Revenus Encaissés', value: formatXOF(dashboard?.totalRevenue || 0, { compact: false }) },
          { label: 'Reversements Propriétaires', value: formatXOF(dashboard?.totalDisbursed || 0, { compact: false }) },
          { label: 'Dont Préfinancements', value: formatXOF(dashboard?.totalPrefinanced || 0, { compact: false }) },
          { label: 'Créances Locataires', value: formatXOF(dashboard?.totalOverdue || 0, { compact: false }) },
          { label: 'Taux d\'Occupation', value: `${dashboard?.occupancyRate || 0}%` }
        ]
      });
    }
    return format === 'excel' ? handleExportOverdueExcel() : handleExportOverduePDF();
  };

  const handleOpenPrefinanceForCase = (eligibleCase) => {
    if (eligibleCase) {
      setPreselectedOwner({
        id: eligibleCase.owner_id,
        first_name: eligibleCase.owner_name,
        last_name: '',
        preferred_payment_method: eligibleCase.preferred_payment_method || 'bank_transfer',
        payout_schedule: 'prefinancing',
        commission_rate: eligibleCase.commission_rate ?? 10
      });
    } else {
      setPreselectedOwner(null);
    }
    setPayoutModalOpen(true);
  };

  if (loading && !dashboard) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Rapports, Analyses & Préfinancements</h1>
            <p className="text-slate-500 text-sm mt-1">
              Suivez les revenus, les préfinancements propriétaires, la performance des récolteurs, l'occupation et les impayés.
            </p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200">
          <i className="fas fa-spinner fa-spin text-primary text-4xl mb-4"></i>
          <h3 className="text-lg font-bold text-slate-700">Chargement des rapports analytiques...</h3>
          <p className="text-slate-500 mt-1 text-sm">Consolidation des indicateurs financiers, préfinancements et opérations.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 min-w-0 overflow-x-hidden">
      {/* 1. EN-TÊTE ET ACTIONS GLOBALES */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <i className="fas fa-chart-line text-primary"></i>
            Rapports, Analyses & Préfinancements
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Pilotage financier complet : encaissements, préfinancements propriétaires, récolteurs, occupation et créances.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => handleGlobalExport('excel')}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-sm font-semibold hover:bg-emerald-100 transition-colors"
          >
            <i className="fas fa-file-excel"></i> Exporter Excel
          </button>
          <button
            type="button"
            onClick={() => handleGlobalExport('pdf')}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-sm font-semibold hover:bg-rose-100 transition-colors"
          >
            <i className="fas fa-file-pdf"></i> Exporter PDF
          </button>
          <button
            type="button"
            onClick={() => handleOpenPrefinanceForCase(null)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl text-sm font-bold hover:bg-amber-700 transition-colors shadow-xs"
          >
            <i className="fas fa-bolt"></i> + Préfinancer un Propriétaire
          </button>
        </div>
      </div>

      {/* 2. BARRE DE FILTRES DE PÉRIODE */}
      <div className="bg-white px-5 py-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <i className="fas fa-calendar-alt text-primary"></i> Période d'analyse :
          </span>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:border-primary"
            />
            <span className="text-xs text-slate-400">au</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:border-primary"
            />
          </div>
          {(startDate || endDate) && (
            <button
              type="button"
              onClick={() => { setStartDate(''); setEndDate(''); }}
              className="text-xs font-semibold text-rose-600 hover:underline"
            >
              Réinitialiser
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={fetchData}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
        >
          <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`}></i>
          {loading ? 'Actualisation...' : 'Actualiser les données'}
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl flex items-start justify-between shadow-xs">
          <div className="flex items-start gap-3">
            <i className="fas fa-exclamation-circle mt-0.5"></i>
            <div>
              <h3 className="font-semibold text-sm">Avertissement de chargement</h3>
              <p className="text-xs mt-1 whitespace-pre-line">{error}</p>
            </div>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-3 py-1.5 bg-white border border-rose-200 rounded-lg text-xs font-semibold hover:bg-rose-50 transition-colors"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* 3. NAVIGATION PAR ONGLETS */}
      <div className="flex flex-wrap gap-2 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/80">
        {REPORT_TABS.map(tab => {
          const isActive = activeTab === tab.key;
          const badgeCount =
            tab.key === 'prefinancing'
              ? prefinancingsList.length || eligiblePrefList.length
              : tab.key === 'overdue'
                ? overdue.length
                : null;

          return (
            <button
              key={tab.key}
              type="button"
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
              }`}
              onClick={() => setActiveTab(tab.key)}
            >
              <i className={`fas ${tab.icon}`}></i>
              <span>{tab.label}</span>
              {badgeCount > 0 && (
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    isActive ? 'bg-white/20 text-white' : (tab.badgeColor || 'bg-slate-200 text-slate-700')
                  }`}
                >
                  {badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* =====================================================================
          ONGLET 1 : VUE D'ENSEMBLE & ANALYTICS
         ===================================================================== */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Ligne 1 : KPIs Opérationnels & Encaissements */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              label="Revenus Encaissés"
              value={formatXOF(dashboard?.totalRevenue || 0)}
              icon="fa-money-bill-wave"
              color="var(--success)"
            />
            <StatsCard
              label="Taux de Recouvrement"
              value={`${dashboard?.collectionRate || 0}%`}
              icon="fa-chart-pie"
              color="var(--primary)"
            />
            <StatsCard
              label="Taux d'Occupation"
              value={`${dashboard?.occupancyRate || 0}% (${dashboard?.occupiedCount || 0}/${dashboard?.totalProperties || 0})`}
              icon="fa-home"
              color="#0284c7"
            />
            <StatsCard
              label="Créances Locataires"
              value={formatXOF(dashboard?.totalOverdue || 0)}
              icon="fa-exclamation-triangle"
              color="var(--danger)"
            />
          </div>

          {/* Ligne 2 : KPIs Reversements Propriétaires & Préfinancements */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              label="Reversé aux Propriétaires"
              value={formatXOF(dashboard?.totalDisbursed || 0)}
              icon="fa-hand-holding-dollar"
              color="#059669"
            />
            <StatsCard
              label="Total Préfinancé (Agence)"
              value={formatXOF(dashboard?.totalPrefinanced || 0)}
              icon="fa-bolt"
              color="var(--warning)"
            />
            <StatsCard
              label="Préfinancements Remboursés"
              value={formatXOF(dashboard?.reimbursedPrefinanced || 0)}
              icon="fa-check-double"
              color="#2563eb"
            />
            <StatsCard
              label="Commissions Agence"
              value={formatXOF(dashboard?.totalCommission || 0)}
              icon="fa-percent"
              color="#7c3aed"
            />
          </div>

          {/* Analyse visuelle : Répartition par mode de paiement & Synthèse Préfinancement */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Répartition des encaissements par moyen de paiement */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
              <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
                <i className="fas fa-wallet text-primary"></i>
                Répartition des Encaissements par Mode de Paiement
              </h3>
              <p className="text-xs text-slate-500 mb-5">Ventilation des loyers encaissés par canal de règlement</p>

              {(dashboard?.byMethod || []).length > 0 ? (
                <div className="space-y-4">
                  {dashboard.byMethod.map((m, idx) => {
                    const maxTotal = Math.max(1, dashboard.totalRevenue || 1);
                    const pct = Math.min(100, Math.round((m.totalAmount / maxTotal) * 100));
                    return (
                      <div key={idx} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-semibold text-slate-800">{formatMethod(m.method)}</span>
                          <span className="font-bold text-slate-900">
                            {formatXOF(m.totalAmount, { compact: false })}{' '}
                            <span className="text-xs font-normal text-slate-500">({m.count} op. — {pct}%)</span>
                          </span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${Math.max(4, pct)}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400 text-sm">
                  Aucune transaction ventilée sur cette période.
                </div>
              )}
            </div>

            {/* Encart de synthèse du Préfinancement Propriétaire */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <i className="fas fa-bolt text-amber-500"></i>
                    Synthèse des Préfinancements Propriétaires
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('prefinancing')}
                    className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                  >
                    Ouvrir le rapport complet <i className="fas fa-arrow-right text-[10px]"></i>
                  </button>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  Avances versées par l'agence aux propriétaires en attente du règlement des locataires
                </p>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200">
                    <div className="text-xs font-semibold text-amber-800">Avances Actives (À recouvrer)</div>
                    <div className="text-lg font-extrabold text-amber-900 mt-1">
                      {formatXOF(prefSummary.activePrefinancedAmount || 0, { compact: false })}
                    </div>
                    <div className="text-[11px] text-amber-700 mt-0.5">
                      {prefSummary.activeCount || 0} dossier(s) en attente du locataire
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                    <div className="text-xs font-semibold text-emerald-800">Avances Remboursées</div>
                    <div className="text-lg font-extrabold text-emerald-900 mt-1">
                      {formatXOF(prefSummary.reimbursedAmount || 0, { compact: false })}
                    </div>
                    <div className="text-[11px] text-emerald-700 mt-0.5">
                      {prefSummary.reimbursedCount || 0} dossier(s) régularisé(s) ({prefSummary.reimbursementRate || 0}%)
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                <div className="text-xs text-slate-600">
                  <span className="font-bold text-slate-900">{prefSummary.eligibleCount || 0} locataire(s)</span> en retard sur des biens de propriétaires ({formatXOF(prefSummary.totalEligibleArrears || 0)} d'arriérés).
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('prefinancing')}
                  className="shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  Voir les éligibles
                </button>
              </div>
            </div>
          </div>

          {/* Dernières transactions */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
              <div>
                <h4 className="text-base font-bold text-slate-900">Dernières Transactions Enregistrées</h4>
                <p className="text-xs text-slate-500">Flux récents d'encaissements locataires</p>
              </div>
            </div>

            {dashboard?.recentTransactions && dashboard.recentTransactions.length > 0 ? (
              <div className="overflow-x-auto min-w-0">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                      <th className="py-3 px-4 font-semibold">Référence</th>
                      <th className="py-3 px-4 font-semibold">Locataire</th>
                      <th className="py-3 px-4 font-semibold">Bien immobilier</th>
                      <th className="py-3 px-4 font-semibold">Mode</th>
                      <th className="py-3 px-4 font-semibold">Date</th>
                      <th className="py-3 px-4 font-semibold text-right">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dashboard.recentTransactions.map((tx, idx) => (
                      <tr key={tx.id || idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 text-xs font-mono font-semibold text-slate-600">{tx.reference}</td>
                        <td className="py-3 px-4 text-sm font-medium text-slate-900">{tx.client}</td>
                        <td className="py-3 px-4 text-xs text-slate-600">{tx.propertyName || '—'}</td>
                        <td className="py-3 px-4 text-sm">
                          <span className="px-2.5 py-1 bg-sky-50 text-sky-700 text-xs font-semibold rounded-full border border-sky-100">
                            {formatMethod(tx.method)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-500">{formatDate(tx.date)}</td>
                        <td className="py-3 px-4 text-sm font-bold text-emerald-600 text-right">
                          {formatXOF(tx.amount, { compact: false })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 bg-slate-50 rounded-xl border border-slate-100">
                <i className="fas fa-inbox text-slate-400 text-3xl mb-3"></i>
                <h4 className="text-sm font-bold text-slate-700">Aucune transaction récente</h4>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          ONGLET 2 : RAPPORT DE PRÉFINANCEMENT PROPRIÉTAIRES
         ===================================================================== */}
      {activeTab === 'prefinancing' && (
        <div className="space-y-6">
          {/* KPIs du Rapport de Préfinancement */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              label="Total Préfinancé (Agence)"
              value={formatXOF(prefSummary.totalPrefinancedAmount || 0, { compact: false })}
              icon="fa-bolt"
              color="var(--warning)"
            />
            <StatsCard
              label="Avances Actives (À recouvrer)"
              value={formatXOF(prefSummary.activePrefinancedAmount || 0, { compact: false })}
              icon="fa-clock"
              color="var(--danger)"
            />
            <StatsCard
              label="Préfinancements Remboursés"
              value={`${formatXOF(prefSummary.reimbursedAmount || 0)} (${prefSummary.reimbursementRate || 0}%)`}
              icon="fa-check-circle"
              color="var(--success)"
            />
            <StatsCard
              label="Impayés Éligibles au Préfinancement"
              value={formatXOF(prefSummary.totalEligibleArrears || 0, { compact: false })}
              icon="fa-hand-holding-dollar"
              color="var(--primary)"
            />
          </div>

          {/* Tableau 1 : Journal Officiel des Préfinancements Accordés */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <i className="fas fa-bolt text-amber-500"></i>
                  Journal des Préfinancements Propriétaires Accordés
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Avances versées aux propriétaires avant le paiement du locataire et suivi du remboursement automatique.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportPrefinancingExcel}
                  className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                >
                  <i className="fas fa-file-excel"></i> Excel
                </button>
                <button
                  type="button"
                  onClick={handleExportPrefinancingPDF}
                  className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                >
                  <i className="fas fa-file-pdf"></i> PDF
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenPrefinanceForCase(null)}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
                >
                  <i className="fas fa-plus"></i> Enregistrer un Préfinancement
                </button>
              </div>
            </div>

            {prefinancingsList.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase">
                      <th className="py-3 px-4">Réf. & Date</th>
                      <th className="py-3 px-4">Propriétaire</th>
                      <th className="py-3 px-4">Bien(s) & Période</th>
                      <th className="py-3 px-4 text-right">Loyer Attendu</th>
                      <th className="py-3 px-4 text-right">Avance Versée</th>
                      <th className="py-3 px-4 text-right">Recouvré Locataire</th>
                      <th className="py-3 px-4 text-right">Reste à Recouvrer</th>
                      <th className="py-3 px-4">Statut</th>
                      <th className="py-3 px-4 text-right">Bordereau</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {prefinancingsList.map(item => {
                      const isReimbursed = item.status === 'reimbursed';
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-mono text-xs font-bold text-slate-800">{item.reference}</div>
                            <div className="text-xs text-slate-400">{formatDate(item.payout_date)}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">{item.owner_name}</div>
                            <div className="text-xs text-slate-500">{formatMethod(item.payment_method)}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="text-xs font-semibold text-slate-800">{item.property_name}</div>
                            <div className="text-[11px] text-slate-400">
                              Du {formatDate(item.period_start)} au {formatDate(item.period_end)}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right font-medium text-slate-700">
                            {formatXOF(item.expected_rent, { compact: false })}
                          </td>
                          <td className="py-3.5 px-4 text-right font-extrabold text-amber-700">
                            {formatXOF(item.amount_paid, { compact: false })}
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold text-emerald-700">
                            {formatXOF(item.total_collected, { compact: false })}
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold text-rose-600">
                            {formatXOF(item.unrecovered_amount, { compact: false })}
                          </td>
                          <td className="py-3.5 px-4">
                            {isReimbursed ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                <i className="fas fa-check-double text-[10px]"></i> Remboursé (Locataire)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
                                <i className="fas fa-bolt text-[10px] text-amber-600"></i> Préfinancé (Actif)
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => printOwnerSettlementReceipt(item)}
                              className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-colors"
                              title="Imprimer le Bordereau Officiel de Préfinancement"
                            >
                              <i className="fas fa-print"></i> Reçu PDF
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-10 text-center bg-slate-50/50">
                <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-3 text-xl">
                  <i className="fas fa-bolt"></i>
                </div>
                <h4 className="text-sm font-bold text-slate-800">Aucun préfinancement enregistré sur la période</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Vous pouvez déclencher un préfinancement ci-dessous pour tout propriétaire dont le locataire est en retard de paiement.
                </p>
              </div>
            )}
          </div>

          {/* Tableau 2 : Dossiers Locataires en Impayé Éligibles au Préfinancement */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <i className="fas fa-user-clock text-rose-500"></i>
                  Dossiers Locataires en Retard Éligibles au Préfinancement ({eligiblePrefList.length})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Biens occupés dont le locataire n'a pas encore soldé son loyer : le comptable peut préfinancer le propriétaire en 1 clic.
                </p>
              </div>
              <div className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
                Net suggéré à préfinancer : {formatXOF(prefSummary.totalSuggestedNetPrefinance || 0, { compact: false })}
              </div>
            </div>

            {eligiblePrefList.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase">
                      <th className="py-3 px-4">Propriétaire</th>
                      <th className="py-3 px-4">Bien Immobilier</th>
                      <th className="py-3 px-4">Locataire en Retard</th>
                      <th className="py-3 px-4 text-right">Loyer Dû</th>
                      <th className="py-3 px-4 text-right">Impayé Locataire</th>
                      <th className="py-3 px-4 text-right">Commission ({`%`})</th>
                      <th className="py-3 px-4 text-right">Net à Préfinancer</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {eligiblePrefList.map(c => (
                      <tr key={c.client_id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{c.owner_name}</div>
                          <div className="text-xs text-slate-400">
                            {formatMethod(c.preferred_payment_method)} &bull; Le {c.preferred_payout_day} du mois
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-800">{c.property_name}</div>
                          <div className="text-xs text-slate-400 truncate max-w-[180px]">{c.property_address}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-900">{c.tenant_name}</div>
                          <div className="text-xs text-slate-400">{c.tenant_phone}</div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-medium text-slate-700">
                          {formatXOF(c.rent_due, { compact: false })}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-rose-600">
                          {formatXOF(c.tenant_arrears, { compact: false })}
                        </td>
                        <td className="py-3.5 px-4 text-right text-xs text-slate-500">
                          {c.commission_rate}% ({formatXOF(c.agency_commission)})
                        </td>
                        <td className="py-3.5 px-4 text-right font-extrabold text-amber-700">
                          {formatXOF(c.net_prefinance_suggested, { compact: false })}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleOpenPrefinanceForCase(c)}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs transition-colors"
                          >
                            <i className="fas fa-bolt"></i> Préfinancer
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 text-sm">
                Aucun arriéré locataire en attente de préfinancement.
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          ONGLET 3 : PERFORMANCE DES RÉCOLTEURS
         ===================================================================== */}
      {activeTab === 'collectors' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Performance des Récolteurs</h3>
              <p className="text-slate-500 text-xs mt-0.5">
                Comparez les portefeuilles assignés, le volume de transactions et le taux de recouvrement par agent.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportCollectorsExcel}
                className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-1.5"
              >
                <i className="fas fa-file-excel"></i> Excel
              </button>
              <button
                type="button"
                onClick={handleExportCollectorsPDF}
                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold flex items-center gap-1.5"
              >
                <i className="fas fa-file-pdf"></i> PDF
              </button>
            </div>
          </div>

          {!sectionErrors.collectors && (
            collectors.length > 0 ? (
              <div className="overflow-x-auto min-w-0">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                      <th className="py-3.5 px-4 font-semibold">Récolteur</th>
                      <th className="py-3.5 px-4 font-semibold">Zone</th>
                      <th className="py-3.5 px-4 font-semibold text-center">Portefeuille</th>
                      <th className="py-3.5 px-4 font-semibold text-center">Transactions</th>
                      <th className="py-3.5 px-4 font-semibold text-right">Objectif Attendu</th>
                      <th className="py-3.5 px-4 font-semibold text-right">Total Collecté</th>
                      <th className="py-3.5 px-4 font-semibold">Taux de Recouvrement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {collectors.map((r, idx) => {
                      const rate = Number(r.recoveryRate || 0);
                      const barColor = rate >= 80 ? 'bg-emerald-500' : rate >= 50 ? 'bg-amber-500' : 'bg-rose-500';
                      return (
                        <tr key={r.collectorId || idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="text-sm font-bold text-slate-900">{r.collectorName}</div>
                            <div className="text-xs text-slate-400">{r.phone || ''}</div>
                          </td>
                          <td className="py-3.5 px-4 text-xs font-medium text-slate-600">{r.zone || 'Toutes zones'}</td>
                          <td className="py-3.5 px-4 text-xs text-center text-slate-600">
                            <span className="font-semibold text-slate-800">{r.assignedPropertiesCount || 0}</span> bien(s) &bull;{' '}
                            <span className="font-semibold text-slate-800">{r.assignedClientsCount || 0}</span> loc.
                          </td>
                          <td className="py-3.5 px-4 text-sm font-semibold text-center text-slate-700">
                            {r.transactionCount}
                          </td>
                          <td className="py-3.5 px-4 text-sm text-right text-slate-700">
                            {formatXOF(r.targetAmount || 0, { compact: false })}
                          </td>
                          <td className="py-3.5 px-4 text-sm font-bold text-emerald-600 text-right">
                            {formatXOF(r.totalCollected, { compact: false })}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2 min-w-[120px]">
                              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, rate)}%` }}></div>
                              </div>
                              <span className="text-xs font-bold text-slate-700 w-9 text-right">{rate}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 bg-slate-50">
                <i className="fas fa-users text-slate-400 text-3xl mb-3"></i>
                <h4 className="text-sm font-bold text-slate-700">Aucun récolteur à afficher</h4>
              </div>
            )
          )}
        </div>
      )}

      {/* =====================================================================
          ONGLET 4 : BIENS & OCCUPATION
         ===================================================================== */}
      {activeTab === 'properties' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Répartition des Biens par Statut d'Occupation</h3>
              <p className="text-slate-500 text-xs mt-0.5">
                Visualisez l'état du portefeuille immobilier, les loyers mensuels associés et la valeur vénale.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportPropertiesExcel}
                className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-1.5"
              >
                <i className="fas fa-file-excel"></i> Excel
              </button>
              <button
                type="button"
                onClick={handleExportPropertiesPDF}
                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold flex items-center gap-1.5"
              >
                <i className="fas fa-file-pdf"></i> PDF
              </button>
            </div>
          </div>

          {!sectionErrors.properties && (
            properties.length > 0 ? (
              <div className="overflow-x-auto min-w-0">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                      <th className="py-3.5 px-6 font-semibold">Statut</th>
                      <th className="py-3.5 px-6 font-semibold">Nombre de biens</th>
                      <th className="py-3.5 px-6 font-semibold">Part du parc</th>
                      <th className="py-3.5 px-6 font-semibold text-right">Loyers mensuels cumulés</th>
                      <th className="py-3.5 px-6 font-semibold text-right">Valeur patrimoniale</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {properties.map((p, idx) => {
                      const ps = formatStatus(p.status);
                      return (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-4 px-6 text-sm">
                            <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${ps.twClass}`}>
                              {ps.label || p.status || 'Inconnu'}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-sm font-bold text-slate-900">{p.count} bien(s)</td>
                          <td className="py-4 px-6 text-sm text-slate-600">{p.percentage || 0}%</td>
                          <td className="py-4 px-6 text-sm font-bold text-emerald-700 text-right">
                            {formatXOF(p.totalRent, { compact: false })}
                          </td>
                          <td className="py-4 px-6 text-sm font-medium text-slate-800 text-right">
                            {formatXOF(p.totalValue || 0, { compact: false })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 bg-slate-50">
                <i className="fas fa-building text-slate-400 text-3xl mb-3"></i>
                <h4 className="text-sm font-bold text-slate-700">Aucune statistique immobilière</h4>
              </div>
            )
          )}
        </div>
      )}

      {/* =====================================================================
          ONGLET 5 : IMPAYÉS & CRÉANCES LOCATAIRES
         ===================================================================== */}
      {activeTab === 'overdue' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">État des Paiements en Retard & Créances Locataires</h3>
              <p className="text-slate-500 text-xs mt-0.5">
                Identifiez les locataires à relancer, les montants restant dus et déclenchez un préfinancement si nécessaire.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
              >
                <option value="all">Toutes les priorités ({overdue.length})</option>
                <option value="critique">Priorité Critique</option>
                <option value="haute">Priorité Haute</option>
                <option value="normale">Priorité Normale</option>
              </select>

              <button
                type="button"
                onClick={handleExportOverdueExcel}
                className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-1.5"
              >
                <i className="fas fa-file-excel"></i> Excel
              </button>
              <button
                type="button"
                onClick={handleExportOverduePDF}
                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold flex items-center gap-1.5"
              >
                <i className="fas fa-file-pdf"></i> PDF
              </button>
            </div>
          </div>

          {!sectionErrors.overdue && (
            filteredOverdue.length > 0 ? (
              <div className="overflow-x-auto min-w-0">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                      <th className="py-3.5 px-4 font-semibold">Locataire</th>
                      <th className="py-3.5 px-4 font-semibold">Bien Immobilier</th>
                      <th className="py-3.5 px-4 font-semibold">Récolteur</th>
                      <th className="py-3.5 px-4 font-semibold text-right">Loyer Mensuel</th>
                      <th className="py-3.5 px-4 font-semibold text-right">Déjà Payé</th>
                      <th className="py-3.5 px-4 font-semibold text-right">Reste Dû (Impayé)</th>
                      <th className="py-3.5 px-4 font-semibold text-center">Ancienneté</th>
                      <th className="py-3.5 px-4 font-semibold">Priorité</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOverdue.map((o, idx) => {
                      const clientName = o.client || `${o.first_name || ''} ${o.last_name || ''}`.trim() || '—';
                      const propName = o.property || o.property_name || '—';
                      const rentDue = Number(o.rent_due ?? o.amount ?? 0);
                      const paid = Number(o.amount_paid || 0);
                      const owed = Number(o.amount_owed ?? o.amount ?? 0);
                      const daysLate = o.days_since_contract ?? o.daysLate ?? 0;
                      const sev = o.severity || 'normale';

                      return (
                        <tr key={o.id || idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">{clientName}</div>
                            <div className="text-xs text-slate-400">{o.phone || ''}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-medium text-slate-800">{propName}</div>
                            {o.property_address && (
                              <div className="text-xs text-slate-400 truncate max-w-[180px]">{o.property_address}</div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-600">
                            {(o.collector_name || '').trim() || 'Non assigné'}
                          </td>
                          <td className="py-3.5 px-4 text-right text-slate-700">
                            {formatXOF(rentDue, { compact: false })}
                          </td>
                          <td className="py-3.5 px-4 text-right text-emerald-600 font-medium">
                            {formatXOF(paid, { compact: false })}
                          </td>
                          <td className="py-3.5 px-4 text-right font-extrabold text-rose-600">
                            {formatXOF(owed, { compact: false })}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className="px-2.5 py-1 bg-rose-50 text-rose-700 text-xs font-semibold rounded-full border border-rose-100">
                              {daysLate > 0 ? `${daysLate} j` : 'Mois en cours'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full border uppercase ${SEVERITY_BADGES[sev] || SEVERITY_BADGES.normale}`}>
                              {sev}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 bg-slate-50">
                <i className="fas fa-check-circle text-emerald-500 text-3xl mb-3"></i>
                <h4 className="text-sm font-bold text-slate-700">Aucun impayé à signaler</h4>
              </div>
            )
          )}
        </div>
      )}

      {/* Modale d'enregistrement d'un Préfinancement / Paiement Propriétaire */}
      {payoutModalOpen && (
        <OwnerPayoutModal
          isOpen={payoutModalOpen}
          onClose={() => setPayoutModalOpen(false)}
          preselectedOwner={preselectedOwner}
          onSuccess={() => {
            showToast({ type: 'success', message: 'Opération propriétaire enregistrée avec succès.' });
            fetchData();
          }}
        />
      )}
    </div>
  );
}
