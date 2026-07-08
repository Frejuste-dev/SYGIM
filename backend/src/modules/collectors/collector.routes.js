/**
 * Module   : Collectors
 * Auteur   : SYGIM Team
 * Créé le  : 2026-06-16
 * Rôle     : Routes pour la gestion des collecteurs
 */

const express = require('express');
const collectorController = require('./collector.controller');
const collectorValidator = require('./collector.validator');
const { authenticate } = require('../../middleware/auth.middleware');
const { checkRole } = require('../../middleware/role.middleware');

const router = express.Router();

// Toutes les routes sont protégées
router.use(authenticate);

/**
 * @route   GET /api/collectors
 */
router.get('/', collectorController.getAll);

/**
 * @route   GET /api/collectors/:id
 */
router.get('/:id', collectorController.getById);

/**
 * @route   GET /api/collectors/:id/stats
 * Access   Admin, Manager uniquement
 */
router.get('/:id/stats', checkRole(['admin', 'director', 'collector_manager']), collectorController.getStats);

/**
 * @route   GET /api/owners/:ownerId/collectors
 */
router.get('/owner/:ownerId', collectorController.getByOwner);

/**
 * @route   POST /api/collectors
 */
router.post('/', checkRole(['admin', 'director', 'collector_manager']), collectorValidator, collectorController.create);

/**
 * @route   PUT /api/collectors/:id
 */
router.put('/:id', checkRole(['admin', 'director', 'collector_manager']), collectorValidator, collectorController.update);

/**
 * @route   DELETE /api/collectors/:id
 */
router.delete('/:id', checkRole(['admin', 'director', 'collector_manager']), collectorController.delete);

module.exports = router;
