/**
 * Module   : Reports
 * Auteur   : SYGIM Team
 * Créé le  : 2026-06-16
 * Rôle     : Routes pour la génération de rapports & analyses
 */

const express = require('express');
const reportController = require('./report.controller');
const {
  reportValidator,
  exportTypeValidator,
  ownerReportParamValidator,
  agedReceivablesValidator,
  depositsValidator,
  taxDeclarationValidator,
  vacancyLossValidator,
  performanceDashboardValidator,
  managerDashboardValidator
} = require('./report.validator');
const { authenticate } = require('../../middleware/auth.middleware');
const { checkRole } = require('../../middleware/role.middleware');
const { exportLimiter } = require('../../middleware/rateLimiter');

const router = express.Router();

// Profils de rôles autorisés
const STAFF_ROLES = ['admin', 'super_admin', 'director', 'accounting', 'gestionnaire', 'manager', 'collector_manager'];
const OWNER_OR_STAFF_ROLES = [...STAFF_ROLES, 'owner'];
const ALL_REPORT_ROLES = [...STAFF_ROLES, 'collector', 'collecteur', 'owner'];

// Middleware de protection globale
router.use(authenticate);
router.use(checkRole(ALL_REPORT_ROLES));

/**
 * @route   GET /api/reports/kpis
 * @desc    KPIs scalaires du Dashboard (autorisé aux collecteurs et au staff)
 */
router.get('/kpis', reportController.getKpis);

/**
 * @route   GET /api/reports/performance-dashboard
 * @desc    Tableau de bord dynamique de suivi des performances financières & opérationnelles
 */
router.get(
  '/performance-dashboard',
  checkRole(STAFF_ROLES),
  performanceDashboardValidator,
  reportController.getPerformanceDashboard
);

/**
 * @route   GET /api/reports/manager-dashboard
 * @desc    Tableau de bord minimaliste du Manager (Section 6 & Maquette 1)
 */
router.get(
  '/manager-dashboard',
  checkRole(STAFF_ROLES),
  managerDashboardValidator,
  reportController.getManagerDashboard
);

/**
 * @route   GET /api/reports/dashboard
 */
router.get(
  '/dashboard',
  checkRole(STAFF_ROLES),
  reportValidator,
  reportController.getDashboard
);
router.get(
  '/monthly',
  checkRole(STAFF_ROLES),
  reportValidator,
  reportController.getDashboard
);

/**
 * @route   GET /api/reports/collectors
 */
router.get(
  '/collectors',
  checkRole(STAFF_ROLES),
  reportValidator,
  reportController.getCollector
);

/**
 * @route   GET /api/reports/properties
 */
router.get(
  '/properties',
  checkRole(STAFF_ROLES),
  reportValidator,
  reportController.getProperty
);

/**
 * @route   GET /api/reports/prefinancing
 */
router.get(
  '/prefinancing',
  checkRole(STAFF_ROLES),
  reportValidator,
  reportController.getPrefinancing
);

/**
 * @route   GET /api/reports/owner-statements
 * @desc    Rapport hiérarchique Bailleurs & Locataires (Lignes propriétaires déroulantes)
 */
router.get(
  '/owner-statements',
  checkRole(STAFF_ROLES),
  reportController.getOwnerStatements
);

/**
 * @route   GET /api/reports/owner-statements/export/excel
 * @desc    Export Excel hiérarchique de l'état des bailleurs et décompte locatif
 */
router.get(
  '/owner-statements/export/excel',
  checkRole(STAFF_ROLES),
  exportLimiter,
  reportController.exportOwnerStatementsExcel
);

/**
 * @route   GET /api/reports/owner-statements/:ownerId/pdf
 * @desc    Bordereau de reddition de comptes mensuel officiel pour un propriétaire
 */
router.get(
  '/owner-statements/:ownerId/pdf',
  checkRole(OWNER_OR_STAFF_ROLES),
  exportLimiter,
  ownerReportParamValidator,
  reportController.exportOwnerStatementPdf
);

/**
 * @route   GET /api/reports/owner-situation/:ownerId
 * @desc    Situation officielle du Propriétaire (Cabinet Me DOUHO MAXIME)
 */
router.get(
  '/owner-situation/:ownerId',
  checkRole(OWNER_OR_STAFF_ROLES),
  ownerReportParamValidator,
  reportController.getOwnerSituation
);

/**
 * @route   GET /api/reports/aged-receivables
 * @desc    Balance Âgée Locataires (0-30j, 31-60j, 61-90j, >90j)
 */
router.get(
  '/aged-receivables',
  checkRole(STAFF_ROLES),
  agedReceivablesValidator,
  reportController.getAgedReceivables
);

/**
 * @route   GET /api/reports/deposits
 * @desc    Inventaire des Dépôts de Garantie (Cautions)
 */
router.get(
  '/deposits',
  checkRole(STAFF_ROLES),
  depositsValidator,
  reportController.getDepositsReport
);

/**
 * @route   GET /api/reports/owner-ledger/:ownerId
 * @desc    Extrait Chronologique du Compte Propriétaire (Grand Livre Bailleur)
 */
router.get(
  '/owner-ledger/:ownerId',
  checkRole(OWNER_OR_STAFF_ROLES),
  ownerReportParamValidator,
  reportController.getOwnerLedger
);

/**
 * @route   GET /api/reports/tax-declaration/:ownerId
 * @desc    Aide à la Déclaration des Revenus Fonciers (Annuel 12 mois)
 */
router.get(
  '/tax-declaration/:ownerId',
  checkRole(OWNER_OR_STAFF_ROLES),
  taxDeclarationValidator,
  reportController.getTaxDeclaration
);

/**
 * @route   GET /api/reports/mandate-bfr
 * @desc    Analyse du BFR & Équilibre du Compte Mandat
 */
router.get(
  '/mandate-bfr',
  checkRole(['admin', 'super_admin', 'director', 'accounting']),
  reportController.getMandateBfr
);

/**
 * @route   GET /api/reports/vacancy-loss
 * @desc    Vacance Locative & Manque à Gagner Financier
 */
router.get(
  '/vacancy-loss',
  checkRole(STAFF_ROLES),
  vacancyLossValidator,
  reportController.getVacancyLoss
);

/**
 * @route   GET /api/reports/export/csv/:type
 */
router.get(
  '/export/csv/:type',
  checkRole(STAFF_ROLES),
  exportLimiter,
  exportTypeValidator,
  reportController.exportCsv
);

/**
 * @route   GET /api/reports/export/pdf/:type
 */
router.get(
  '/export/pdf/:type',
  checkRole(STAFF_ROLES),
  exportLimiter,
  exportTypeValidator,
  reportController.exportPdf
);

module.exports = router;
