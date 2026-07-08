/**
 * Module   : Reports
 * Auteur   : SYGIM Team
 * Créé le  : 2026-06-16
 * Rôle     : Routes pour la génération de rapports
 */

const express = require('express');
const reportController = require('./report.controller');
const reportValidator = require('./report.validator');
const { authenticate } = require('../../middleware/auth.middleware');
const { checkRole } = require('../../middleware/role.middleware');

const router = express.Router();

// Middleware de protection
router.use(authenticate);
router.use(checkRole(['admin', 'director']));

/**
 * @route   GET /api/reports/dashboard
 */
router.get('/dashboard', reportValidator, reportController.getDashboard);

/**
 * @route   GET /api/reports/collectors
 */
router.get('/collectors', reportValidator, reportController.getCollector);

/**
 * @route   GET /api/reports/properties
 */
router.get('/properties', reportValidator, reportController.getProperty);

/**
 * @route   GET /api/reports/export/csv/:type
 */
router.get('/export/csv/:type', reportValidator, reportController.exportCsv);

/**
 * @route   GET /api/reports/export/pdf/:type
 */
router.get('/export/pdf/:type', reportValidator, reportController.exportPdf);

module.exports = router;
