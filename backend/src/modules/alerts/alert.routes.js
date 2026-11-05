const express = require('express');
const router = express.Router();
const AlertController = require('./alert.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { overduePaymentsValidator, acknowledgeValidator } = require('../../validators/alert.validator');

router.use(authenticate);

router.get('/overdue-payments', authorize('admin', 'director', 'accounting', 'collector_manager', 'collector'), overduePaymentsValidator, (req, res, next) => AlertController.getOverduePayments(req, res, next));
router.get('/dashboard', authorize('admin', 'director', 'accounting'), (req, res, next) => AlertController.getDashboard(req, res, next));
router.get('/summary', authorize('admin', 'director', 'accounting', 'collector_manager'), (req, res, next) => AlertController.getSummary(req, res, next));
router.put('/:clientId/acknowledge', authorize('admin', 'director', 'collector_manager', 'accounting'), acknowledgeValidator, (req, res, next) => AlertController.acknowledge(req, res, next));

module.exports = router;
