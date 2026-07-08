const express = require('express');
const router = express.Router();
const ClientController = require('../controllers/ClientController');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/', (req, res, next) => ClientController.getAll(req, res, next));
router.get('/:id', (req, res, next) => ClientController.getById(req, res, next));
router.post('/', authorize('admin', 'director', 'collector_manager', 'accounting'), (req, res, next) => ClientController.create(req, res, next));
router.put('/:id', authorize('admin', 'director', 'collector_manager', 'accounting'), (req, res, next) => ClientController.update(req, res, next));
router.delete('/:id', authorize('admin', 'director', 'collector_manager'), (req, res, next) => ClientController.delete(req, res, next));
router.post('/:id/replace', authorize('admin', 'director', 'collector_manager'), (req, res, next) => ClientController.replaceTenant(req, res, next));

module.exports = router;
