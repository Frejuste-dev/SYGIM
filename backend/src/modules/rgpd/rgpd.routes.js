const express = require('express');
const router = express.Router();
const RgpdController = require('./rgpd.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { purgeLogsValidator } = require('../../validators/rgpd.validator');

router.use(authenticate);

router.get('/me/export', (req, res, next) => RgpdController.exportData(req, res, next));
router.delete('/me/data', authorize('admin', 'director', 'accounting', 'collector_manager', 'collector'), (req, res, next) => RgpdController.deleteData(req, res, next));
router.post('/admin/purge-logs', authorize('admin'), purgeLogsValidator, (req, res, next) => RgpdController.purgeLogs(req, res, next));

module.exports = router;
