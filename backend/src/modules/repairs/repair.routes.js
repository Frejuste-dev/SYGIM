const express = require('express');
const router = express.Router();
const RepairController = require('./repair.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

router.use(authenticate);

router.get('/', authorize('admin', 'director', 'accounting', 'collector_manager', 'collector'), (req, res, next) => RepairController.getAll(req, res, next));
router.post('/', authorize('admin', 'director', 'accounting', 'collector_manager', 'collector'), (req, res, next) => RepairController.create(req, res, next));
router.post('/:id/settle', authorize('admin', 'director', 'accounting', 'collector_manager', 'collector'), (req, res, next) => RepairController.settle(req, res, next));

module.exports = router;

