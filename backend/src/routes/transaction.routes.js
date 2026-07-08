const express = require('express');
const router = express.Router();
const TransactionController = require('../controllers/TransactionController');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/', (req, res, next) => TransactionController.getAll(req, res, next));
router.get('/stats', (req, res, next) => TransactionController.getStats(req, res, next));
router.get('/:id', (req, res, next) => TransactionController.getById(req, res, next));
router.post('/', authorize('admin', 'director', 'accounting', 'collector_manager', 'collector'), (req, res, next) => TransactionController.create(req, res, next));
router.put('/:id', authorize('admin', 'director', 'accounting', 'collector_manager'), (req, res, next) => TransactionController.update(req, res, next));
router.delete('/:id', authorize('admin', 'director', 'accounting', 'collector_manager'), (req, res, next) => TransactionController.delete(req, res, next));

module.exports = router;
