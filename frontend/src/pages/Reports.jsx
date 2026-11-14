import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { API } from '../api/services';
import Modal from '../components/Modal';
import OwnerPayoutModal from '../components/OwnerPayoutModal';
import { useToast } from '../components/ToastContext';
import { formatXOF, formatDate, formatStatus, formatMethod } from '../utils/formatters';
import { exportToExcel, exportToPDF } from '../utils/exportUtils';
import {
  useReportDashboard,
  useReportPrefinancing,
  useReportCollectors,
  useReportProperties,
  useReportOverdue,
  useReportOwnerStatements
} from '../hooks/queries/useReports';

// Sous-composants modulaires des onglets
import ReportOverviewTab from '../components/reports/ReportOverviewTab';
import ReportOwnersTab from '../components/reports/ReportOwnersTab';
import ReportPrefinancingTab from '../components/reports/ReportPrefinancingTab';
import ReportCollectorsTab from '../components/reports/ReportCollectorsTab';
import ReportPropertiesTab from '../components/reports/ReportPropertiesTab';
import ReportOverdueTab from '../components/reports/ReportOverdueTab';

const REPORT_TABS = [
  { key: 'overview', label: "Vue d'ensemble", icon: 'fa-chart-pie' },
  { key: 'owner_statements', label: 'Décompte Bailleurs & Locataires', icon: 'fa-file-invoice-dollar', badgeColor: 'bg-primary/10 text-primary border border-primary/20' },
  { key: 'prefinancing', label: 'Rapport de Préfinancement', icon: 'fa-bolt', badgeColor: 'bg-amber-100 text-amber-800' },
  { key: 'collectors', label: 'Performance Récolteurs', icon: 'fa-users' },
  { key: 'properties', label: 'Biens & Occupation', icon: 'fa-building' },
  { key: 'overdue', label: 'Impayés & Créances', icon: 'fa-exclamation-triangle', badgeColor: 'bg-rose-100 text-rose-800' },
];

const MANAGER_REPORT_TABS = [
  { key: 'owner_statements', label: 'Décompte Bailleurs & Locataires', icon: 'fa-file-invoice-dollar', badgeColor: 'bg-primary/10 text-primary border border-primary/20' },
  { key: 'collectors', label: 'Tournées & Collecteurs', icon: 'fa-users' },
  { key: 'overdue', label: 'Impayés & Plan de Relance', icon: 'fa-exclamation-triangle', badgeColor: 'bg-rose-100 text-rose-800' },
  { key: 'properties', label: 'Biens, Vacance & Travaux', icon: 'fa-building' },
];

export default function Reports() {
  const { user } = useAuth();
  const isManager = Boolean(user && ['collector_manager', 'gestionnaire', 'manager'].includes(user?.role));
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState(isManager ? 'owner_statements' : 'overview');

  // Filtres de période synchronisés
  const [selectedMonth, setSelectedMonth] = useState('2026-11');
  const [startDate, setStartDate] = useState('2026-11-01');
  const [endDate, setEndDate] = useState('2026-11-30');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [collectorFilter, setCollectorFilter] = useState('all');
  const [propertyFilter, setPropertyFilter] = useState('all');

  // Modale de relance locataire pour le Manager
  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [selectedOverdueForReminder, setSelectedOverdueForReminder] = useState(null);
  const [reminderType, setReminderType] = useState('phone');
  const [reminderPromiseDate, setReminderPromiseDate] = useState('');
  const [reminderNotes, setReminderNotes] = useState('');
  const [remindersHistory, setRemindersHistory] = useState([]);

  // Modale de préfinancement rapide depuis le rapport
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [preselectedOwner, setPreselectedOwner] = useState(null);

  // Décompte Bailleurs & Locataires (Accordéon hiérarchique)
  const [tenantSearch, setTenantSearch] = useState('');
  const [expandedOwnerIds, setExpandedOwnerIds] = useState(new Set());
  const [exportingExcel, setExportingExcel] = useState(false);

  const handleMonthChange = (delta) => {
    const [yStr, mStr] = (selectedMonth || '2026-11').split('-');
    let y = parseInt(yStr, 10);
    let m = parseInt(mStr, 10) + delta;
    if (m > 12) {
      m = 1;
      y += 1;
    } else if (m < 1) {
      m = 12;
      y -= 1;
    }
    const newMonth = `${y}-${String(m).padStart(2, '0')}`;
    const lastDay = new Date(y, m, 0).getDate();
    setSelectedMonth(newMonth);
    setStartDate(`${newMonth}-01`);
    setEndDate(`${newMonth}-${String(lastDay).padStart(2, '0')}`);
  };

  const handleMonthSelect = (newMonth) => {
    if (!newMonth) {
      setSelectedMonth('');
      return;
    }
    const [yStr, mStr] = newMonth.split('-');
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);
    const lastDay = new Date(y, m, 0).getDate();
    setSelectedMonth(newMonth);
    setStartDate(`${newMonth}-01`);
    setEndDate(`${newMonth}-${String(lastDay).padStart(2, '0')}`);
  };

  const handleStartDateChange = (val) => {
    setStartDate(val);
    if (val && val.length >= 7) {
      setSelectedMonth(val.slice(0, 7));
    }
  };

  const handleEndDateChange = (val) => {
    setEndDate(val);
    if (!startDate && val && val.length >= 7) {
      setSelectedMonth(val.slice(0, 7));
    }
  };

  const applyPeriodPreset = (preset) => {
    if (preset === 'current_month') {
      const y = 2026, m = 11;
      const mStr = `${y}-${String(m).padStart(2, '0')}`;
      const lastDay = new Date(y, m, 0).getDate();
      setSelectedMonth(mStr);
      setStartDate(`${mStr}-01`);
      setEndDate(`${mStr}-${String(lastDay).padStart(2, '0')}`);
    } else if (preset === 'prev_month') {
      const y = 2026, m = 10;
      const mStr = `${y}-${String(m).padStart(2, '0')}`;
      const lastDay = new Date(y, m, 0).getDate();
      setSelectedMonth(mStr);
      setStartDate(`${mStr}-01`);
      setEndDate(`${mStr}-${String(lastDay).padStart(2, '0')}`);
    } else if (preset === 'q4_2026') {
      setSelectedMonth('2026-11');
      setStartDate('2026-10-01');
      setEndDate('2026-12-31');
    } else if (preset === 'year_2026') {
      setSelectedMonth('2026-11');
      setStartDate('2026-01-01');
      setEndDate('2026-12-31');
    } else if (preset === 'all') {
      setSelectedMonth('');
      setStartDate('');
      setEndDate('');
    }
  };

  const dateParams = useMemo(() => {
    const p = {};
    if (startDate) p.startDate = startDate;
    if (endDate) p.endDate = endDate;
    return p;
  }, [startDate, endDate]);

  // TanStack Query Hooks
  const { data: dashboard, isLoading: loadingDashboard, refetch: refetchDashboard } = useReportDashboard(dateParams);
  const {
    data: prefinancingData = { summary: {}, prefinancings: [], eligibleCases: [] },
    isLoading: loadingPrefinancing,
    refetch: refetchPrefinancing
  } = useReportPrefinancing(dateParams);
  const { data: collectors = [], isLoading: loadingCollectors, refetch: refetchCollectors } = useReportCollectors(dateParams);
  const { data: properties = [], isLoading: loadingProperties, refetch: refetchProperties } = useReportProperties();
  const { data: overdue = [], isLoading: loadingOverdue, refetch: refetchOverdue } = useReportOverdue();
  const {
    data: ownerStatementsData = { totals: {}, statements: [] },
    isLoading: loadingStatements,
    refetch: refetchOwnerStatements
  } = useReportOwnerStatements({
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    month: selectedMonth || undefined,
    search: tenantSearch
  }, {
    enabled: activeTab === 'owner_statements'
  });

  const loading = loadingDashboard || loadingPrefinancing || loadingCollectors || loadingProperties || loadingOverdue;

  const handleRefreshAll = () => {
    refetchDashboard();
    refetchPrefinancing();
    refetchCollectors();
    refetchProperties();
    refetchOverdue();
    if (activeTab === 'owner_statements') {
      refetchOwnerStatements();
    }
  };

  useEffect(() => {
    if (tenantSearch.trim() && Array.isArray(ownerStatementsData?.statements)) {
      setExpandedOwnerIds(new Set(ownerStatementsData.statements.map(s => s.owner_id)));
    }
  }, [tenantSearch, ownerStatementsData?.statements]);

  const toggleOwnerExpand = (ownerId) => {
    setExpandedOwnerIds(prev => {
      const next = new Set(prev);
      if (next.has(ownerId)) {
        next.delete(ownerId);
      } else {
        next.add(ownerId);
      }
      return next;
    });
  };

  const expandAllOwners = () => {
    if (ownerStatementsData?.statements) {
      setExpandedOwnerIds(new Set(ownerStatementsData.statements.map(s => s.owner_id)));
    }
  };

  const collapseAllOwners = () => {
    setExpandedOwnerIds(new Set());
  };

  const handleExportOwnerStatementsExcel = async () => {
    try {
      setExportingExcel(true);
      const response = await API.Reports.exportOwnerStatementsExcel({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        month: selectedMonth || undefined,
        search: tenantSearch
      });
      const blob = new Blob([response.data || response], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `decompte_bailleurs_locataires_${selectedMonth}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showToast({ type: 'success', message: 'Export Excel téléchargé avec succès !' });
    } catch (err) {
      console.error('Erreur export Excel:', err);
      showToast({ type: 'error', message: 'Erreur lors de l\'export Excel' });
    } finally {
      setExportingExcel(false);
    }
  };

  // Liste des collecteurs uniques pour le filtrage
  const collectorOptions = useMemo(() => {
    const names = new Set();
    overdue.forEach(o => {
      const name = (o.collector_name || '').trim();
      if (name) names.add(name);
    });
    return Array.from(names).sort();
  }, [overdue]);

  // Liste filtrée des impayés selon la sévérité et le récolteur assigné
  const filteredOverdue = useMemo(() => {
    let list = overdue;
    if (severityFilter !== 'all') {
      list = list.filter(o => (o.severity || 'normale') === severityFilter);
    }
    if (collectorFilter !== 'all') {
      list = list.filter(o => (o.collector_name || '').trim() === collectorFilter);
    }
    return list;
  }, [overdue, severityFilter, collectorFilter]);

  // Actions de relance pour le Manager
  const handleOpenReminderModal = (item) => {
    setSelectedOverdueForReminder(item);
    setReminderType('phone');
    setReminderPromiseDate('');
    setReminderNotes('');
    setReminderModalOpen(true);
  };

  const handleSaveReminder = () => {
    if (!selectedOverdueForReminder) return;
    const clientName = selectedOverdueForReminder.client || `${selectedOverdueForReminder.first_name || ''} ${selectedOverdueForReminder.last_name || ''}`.trim() || 'Locataire';
    const newEntry = {
      id: Date.now(),
      clientName,
      propertyName: selectedOverdueForReminder.property || selectedOverdueForReminder.property_name || '—',
      amountOwed: Number(selectedOverdueForReminder.amount_owed ?? selectedOverdueForReminder.amount ?? 0),
      type: reminderType,
      promiseDate: reminderPromiseDate,
      notes: reminderNotes,
      date: new Date().toISOString()
    };
    setRemindersHistory(prev => [newEntry, ...prev]);
    showToast({ type: 'success', message: `Action de relance enregistrée pour ${clientName}` });
    setReminderModalOpen(false);
  };

  const prefSummary = prefinancingData?.summary || {};
  const prefinancingsList = prefinancingData?.prefinancings || [];
  const eligiblePrefList = prefinancingData?.eligibleCases || [];

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

  const handleExportTourneeExcel = () => {
    if (!collectors.length) return showToast({ type: 'warning', message: 'Aucun collecteur à exporter.' });
    const rows = collectors.map(c => ({
      recolteur: c.collectorName,
      zone: c.zone || 'Toutes zones',
      telephone: c.phone || '—',
      biens_assignes: c.assignedPropertiesCount || 0,
      locataires: c.assignedClientsCount || 0,
      objectif: c.targetAmount || 0,
      collecte: c.totalCollected || 0,
      taux: `${c.recoveryRate || 0}%`
    }));
    exportToExcel(rows, `feuille_tournees_collecteurs_${today}.xls`, {
      recolteur: 'Agent Collecteur',
      zone: 'Secteur / Zone',
      telephone: 'Téléphone',
      biens_assignes: 'Biens Assignés',
      locataires: 'Locataires',
      objectif: 'Objectif de Recouvrement (XOF)',
      collecte: 'Total Recouvré (XOF)',
      taux: 'Taux de Recouvrement'
    }, 'Feuille de Tournées & Encaissements Terrain — SYGIM');
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

  const handleExportRelancesSheet = () => {
    const rows = filteredOverdue.map(o => ({
      locataire: o.client || `${o.first_name || ''} ${o.last_name || ''}`.trim() || '—',
      telephone: o.phone || '—',
      bien: o.property || o.property_name || '—',
      recolteur: (o.collector_name || '').trim() || 'Non assigné',
      loyer: Number(o.rent_due ?? o.amount ?? 0),
      impaye: Number(o.amount_owed ?? o.amount ?? 0),
      retard: `${o.days_since_contract ?? o.daysLate ?? 0} jours`,
      priorite: (o.severity || 'normale').toUpperCase(),
      action_prevue: 'Visite terrain ou appel de relance'
    }));
    if (!rows.length) return showToast({ type: 'warning', message: 'Aucun dossier de relance à exporter.' });
    exportToExcel(rows, `feuille_relances_terrain_${today}.xls`, {
      locataire: 'Locataire',
      telephone: 'Téléphone',
      bien: 'Bien Immobilier',
      recolteur: 'Récolteur Assigné',
      loyer: 'Loyer Mensuel (XOF)',
      impaye: 'Montant Impayé (XOF)',
      retard: 'Retard Constaté',
      priorite: 'Priorité',
      action_prevue: 'Action Recommandée'
    }, 'Feuille de Relances Terrain & Recouvrement — SYGIM');
  };

  // Export rapide contextuel selon l'onglet actif
  const handleGlobalExport = (format = 'pdf') => {
    if (activeTab === 'owner_statements') {
      return format === 'excel'
        ? handleExportOwnerStatementsExcel()
        : showToast({ type: 'info', message: 'Veuillez cliquer sur le bouton "Bordereau PDF" du propriétaire pour éditer son bordereau officiel.' });
    }
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
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-sm font-semibold hover:bg-emerald-100 transition-colors cursor-pointer"
          >
            <i className="fas fa-file-excel"></i> Exporter Excel
          </button>
          <button
            type="button"
            onClick={() => handleGlobalExport('pdf')}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-sm font-semibold hover:bg-rose-100 transition-colors cursor-pointer"
          >
            <i className="fas fa-file-pdf"></i> Exporter PDF
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
              onChange={(e) => handleStartDateChange(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-primary focus:bg-white"
            />
            <span className="text-xs text-slate-400 font-medium">au</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => handleEndDateChange(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-primary focus:bg-white"
            />
          </div>

          {/* Raccourcis de période rapides synchronisés */}
          <div className="flex flex-wrap items-center gap-1.5 pl-2 border-l border-slate-200">
            <button
              type="button"
              onClick={() => applyPeriodPreset('current_month')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                selectedMonth === '2026-11' && startDate === '2026-11-01' && endDate === '2026-11-30'
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              Ce mois (Nov)
            </button>
            <button
              type="button"
              onClick={() => applyPeriodPreset('prev_month')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                selectedMonth === '2026-10' && startDate === '2026-10-01' && endDate === '2026-10-31'
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              Mois préc. (Oct)
            </button>
            <button
              type="button"
              onClick={() => applyPeriodPreset('q4_2026')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                startDate === '2026-10-01' && endDate === '2026-12-31'
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              T4 2026
            </button>
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => applyPeriodPreset('all')}
                className="px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                title="Supprimer les filtres de date"
              >
                Réinitialiser
              </button>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleRefreshAll}
          disabled={loading || loadingStatements}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
        >
          <i className={`fas fa-sync-alt ${loading || loadingStatements ? 'fa-spin' : ''}`}></i>
          {loading || loadingStatements ? 'Actualisation...' : 'Actualiser'}
        </button>
      </div>

      {/* 3. NAVIGATION PAR ONGLETS */}
      <div className="flex flex-wrap gap-2 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/80">
        {(isManager ? MANAGER_REPORT_TABS : REPORT_TABS).map(tab => {
          const isActive = activeTab === tab.key;
          const badgeCount =
            tab.key === 'owner_statements'
              ? ownerStatementsData?.statements?.length || null
              : tab.key === 'prefinancing'
                ? prefinancingsList.length || eligiblePrefList.length
                : tab.key === 'overdue'
                  ? overdue.length
                  : null;

          return (
            <button
              key={tab.key}
              type="button"
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
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

      {/* 4. CONTENU DES ONGLETS MODULAIRES */}
      {!isManager && activeTab === 'overview' && (
        <ReportOverviewTab
          dashboard={dashboard}
          prefSummary={prefSummary}
          loading={loadingDashboard}
          onNavigateTab={setActiveTab}
        />
      )}

      {activeTab === 'owner_statements' && (
        <ReportOwnersTab
          ownerStatementsData={ownerStatementsData}
          loadingStatements={loadingStatements}
          selectedMonth={selectedMonth}
          handleMonthChange={handleMonthChange}
          handleMonthSelect={handleMonthSelect}
          tenantSearch={tenantSearch}
          setTenantSearch={setTenantSearch}
          expandedOwnerIds={expandedOwnerIds}
          toggleOwnerExpand={toggleOwnerExpand}
          expandAllOwners={expandAllOwners}
          collapseAllOwners={collapseAllOwners}
          handleExportOwnerStatementsExcel={handleExportOwnerStatementsExcel}
          exportingExcel={exportingExcel}
          isManager={isManager}
        />
      )}

      {!isManager && activeTab === 'prefinancing' && (
        <ReportPrefinancingTab
          prefinancingData={prefinancingData}
          loading={loadingPrefinancing}
          handleExportPrefinancingExcel={handleExportPrefinancingExcel}
          handleExportPrefinancingPDF={handleExportPrefinancingPDF}
          handleOpenPrefinanceForCase={handleOpenPrefinanceForCase}
        />
      )}

      {activeTab === 'collectors' && (
        <ReportCollectorsTab
          collectors={collectors}
          recentTransactions={dashboard?.recentTransactions || []}
          loading={loadingCollectors}
          handleExportTourneeExcel={handleExportTourneeExcel}
          handleExportCollectorsExcel={handleExportCollectorsExcel}
          handleExportCollectorsPDF={handleExportCollectorsPDF}
        />
      )}

      {activeTab === 'properties' && (
        <ReportPropertiesTab
          properties={properties}
          dashboard={dashboard}
          loading={loadingProperties}
          propertyFilter={propertyFilter}
          setPropertyFilter={setPropertyFilter}
          handleExportPropertiesExcel={handleExportPropertiesExcel}
          handleExportPropertiesPDF={handleExportPropertiesPDF}
        />
      )}

      {activeTab === 'overdue' && (
        <ReportOverdueTab
          overdue={overdue}
          filteredOverdue={filteredOverdue}
          loading={loadingOverdue}
          severityFilter={severityFilter}
          setSeverityFilter={setSeverityFilter}
          collectorFilter={collectorFilter}
          setCollectorFilter={setCollectorFilter}
          collectorOptions={collectorOptions}
          handleExportRelancesSheet={handleExportRelancesSheet}
          handleExportOverdueExcel={handleExportOverdueExcel}
          handleExportOverduePDF={handleExportOverduePDF}
          handleOpenReminderModal={handleOpenReminderModal}
          remindersHistory={remindersHistory}
          setRemindersHistory={setRemindersHistory}
        />
      )}

      {/* Modale d'Action de Relance Locataire pour le Manager */}
      {reminderModalOpen && selectedOverdueForReminder && (
        <Modal
          title={`Enregistrer une Action de Relance — ${selectedOverdueForReminder.client || `${selectedOverdueForReminder.first_name || ''} ${selectedOverdueForReminder.last_name || ''}`.trim() || 'Locataire'}`}
          onClose={() => setReminderModalOpen(false)}
        >
          <div className="space-y-4 text-sm text-slate-700">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Bien concerné :</span>
                <span className="font-semibold text-slate-800">{selectedOverdueForReminder.property || selectedOverdueForReminder.property_name || '—'}</span>
              </div>
              <div className="flex justify-between items-center text-xs mt-1.5">
                <span className="text-slate-500">Montant impayé :</span>
                <span className="font-bold text-rose-600">{formatXOF(Number(selectedOverdueForReminder.amount_owed ?? selectedOverdueForReminder.amount ?? 0))}</span>
              </div>
              <div className="flex justify-between items-center text-xs mt-1.5">
                <span className="text-slate-500">Récolteur assigné :</span>
                <span className="font-semibold text-slate-700">{(selectedOverdueForReminder.collector_name || '').trim() || 'Non assigné'}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Type de démarche terrain
              </label>
              <select
                value={reminderType}
                onChange={(e) => setReminderType(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white"
              >
                <option value="phone">Appel téléphonique de rappel</option>
                <option value="visit">Visite terrain par le collecteur</option>
                <option value="sms">SMS / Message WhatsApp de relance</option>
                <option value="letter">Courrier / Mise en demeure</option>
                <option value="promise">Promesse de règlement négociée</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Date d'engagement / Promesse de paiement (optionnel)
              </label>
              <input
                type="date"
                value={reminderPromiseDate}
                onChange={(e) => setReminderPromiseDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Compte-rendu & Notes de l'échange
              </label>
              <textarea
                rows={3}
                value={reminderNotes}
                onChange={(e) => setReminderNotes(e.target.value)}
                placeholder="Ex: Le locataire s'engage à verser 50% le vendredi 15 et le solde en fin de mois..."
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setReminderModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSaveReminder}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <i className="fas fa-check"></i> Enregistrer le suivi
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modale d'enregistrement d'un Préfinancement / Paiement Propriétaire */}
      {payoutModalOpen && (
        <OwnerPayoutModal
          isOpen={payoutModalOpen}
          onClose={() => setPayoutModalOpen(false)}
          preselectedOwner={preselectedOwner}
          onSuccess={() => {
            showToast({ type: 'success', message: 'Opération propriétaire enregistrée avec succès.' });
            queryClient.invalidateQueries({ queryKey: ['reports'] });
          }}
        />
      )}
    </div>
  );
}
