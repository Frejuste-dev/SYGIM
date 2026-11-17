/**
 * Module   : Collectors
 * Auteur   : SYGIM Team
 * Créé le  : 2026-06-16
 * Rôle     : Routes pour la gestion des collecteurs
 */

const express = require('express');
const collectorController = require('./collector.controller');
const { collectorValidator } = require('./collector.validator');
const { authenticate } = require('../../middleware/auth.middleware');
const { checkRole } = require('../../middleware/role.middleware');

const router = express.Router();

// Toutes les routes sont protégées
router.use(authenticate);

/**
 * @route   GET /api/collectors
 */
router.get('/', checkRole(['admin', 'super_admin', 'director', 'accounting', 'manager', 'collector_manager', 'collector']), collectorController.getAll);

/**
 * @route   POST /api/collectors/unassign-properties
 */
router.post('/unassign-properties', checkRole(['admin', 'super_admin', 'director', 'manager', 'collector_manager']), collectorController.unassignProperties);

/**
 * @route   GET /api/collectors/:id
 */
router.get('/:id', checkRole(['admin', 'super_admin', 'director', 'accounting', 'manager', 'collector_manager', 'collector']), collectorController.getById);

/**
 * @route   GET /api/collectors/:id/stats
 * Access   Admin, Manager uniquement
 */
router.get('/:id/stats', checkRole(['admin', 'super_admin', 'director', 'manager', 'collector_manager']), collectorController.getStats);

/**
 * @route   GET /api/collectors/owner/:ownerId
 */
router.get('/owner/:ownerId', checkRole(['admin', 'super_admin', 'director', 'accounting', 'manager', 'collector_manager', 'collector']), collectorController.getByOwner);

/**
 * @route   POST /api/collectors
 */
router.post('/', checkRole(['admin', 'super_admin', 'director']), collectorValidator, collectorController.create);

/**
 * @route   PUT /api/collectors/:id
 */
router.put('/:id', checkRole(['admin', 'super_admin', 'director']), collectorValidator, collectorController.update);

/**
 * @route   DELETE /api/collectors/:id
 */
router.delete('/:id', checkRole(['admin', 'super_admin', 'director']), collectorController.delete);

/**
 * @route   POST /api/collectors/:id/assign-properties
 */
router.post('/:id/assign-properties', checkRole(['admin', 'super_admin', 'director', 'manager', 'collector_manager']), collectorController.assignProperties);

module.exports = router;
