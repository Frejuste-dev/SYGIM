const express = require('express');
const router = express.Router();
const activityController = require('./activity.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

router.use(authenticate);

// Lecture seule de l'historique d'audit Manager
router.get(
  '/manager-logs',
  authorize('admin', 'director', 'manager', 'collector_manager', 'accounting'),
  (req, res, next) => activityController.getManagerLogs(req, res, next)
);

module.exports = router;
