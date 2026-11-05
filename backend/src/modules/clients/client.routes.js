const express = require('express');
const router = express.Router();
const ClientController = require('./client.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { clientValidator, updateClientValidator } = require('./client.validator');
router.use(authenticate);

router.get('/', authorize('admin', 'director', 'accounting', 'collector_manager', 'collector'), (req, res, next) => ClientController.getAll(req, res, next));
router.get('/stats', authorize('admin', 'director', 'accounting', 'collector_manager', 'collector'), (req, res, next) => ClientController.getStats(req, res, next));
router.get('/:id', authorize('admin', 'director', 'accounting', 'collector_manager', 'collector'), (req, res, next) => ClientController.getById(req, res, next));
router.post('/', authorize('admin', 'director', 'collector_manager', 'accounting', 'collector'), clientValidator, (req, res, next) => ClientController.create(req, res, next));
router.put('/:id', authorize('admin', 'director', 'collector_manager', 'accounting', 'collector'), updateClientValidator, (req, res, next) => ClientController.update(req, res, next));
router.delete('/:id', authorize('admin', 'director', 'collector_manager'), (req, res, next) => ClientController.delete(req, res, next));
router.post('/:id/replace', authorize('admin', 'director', 'collector_manager', 'collector'), (req, res, next) => ClientController.replaceTenant(req, res, next));

module.exports = router;
