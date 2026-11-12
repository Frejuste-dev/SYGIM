const express = require('express');
const router = express.Router();
const TransactionController = require('./transaction.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { transactionValidator, updateTransactionValidator } = require('./transaction.validator');

router.use(authenticate);

router.get('/', authorize('admin', 'director', 'accounting', 'collector_manager'), (req, res, next) => TransactionController.getAll(req, res, next));
router.get('/stats', authorize('admin', 'director', 'accounting', 'collector_manager'), (req, res, next) => TransactionController.getStats(req, res, next));
router.get('/export/csv', authorize('admin', 'director', 'accounting', 'collector_manager'), (req, res, next) => TransactionController.exportCSV(req, res, next));
router.get('/:id', authorize('admin', 'director', 'accounting', 'collector_manager'), (req, res, next) => TransactionController.getById(req, res, next));
router.post('/', authorize('admin', 'director', 'accounting', 'collector_manager', 'collector'), transactionValidator, (req, res, next) => TransactionController.create(req, res, next));
router.post('/:id/validate', authorize('admin', 'director', 'accounting'), (req, res, next) => TransactionController.validate(req, res, next));
router.post('/:id/reject', authorize('admin', 'director', 'accounting'), (req, res, next) => TransactionController.reject(req, res, next));
router.put('/:id', authorize('admin', 'director', 'accounting', 'collector_manager'), updateTransactionValidator, (req, res, next) => TransactionController.update(req, res, next));
router.delete('/:id', authorize('admin', 'director', 'accounting', 'collector_manager'), (req, res, next) => TransactionController.delete(req, res, next));

module.exports = router;
