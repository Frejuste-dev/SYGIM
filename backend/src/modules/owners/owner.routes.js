const express = require('express');
const router = express.Router();
const OwnerController = require('./owner.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { ownerValidator, updateOwnerValidator } = require('./owner.validator');
router.use(authenticate);

router.get('/', authorize('admin', 'director', 'accounting', 'collector_manager', 'collector'), (req, res, next) => OwnerController.getAll(req, res, next));
router.get('/stats', authorize('admin', 'director', 'accounting', 'collector_manager', 'collector'), (req, res, next) => OwnerController.getStats(req, res, next));
router.get('/:id', authorize('admin', 'director', 'accounting', 'collector_manager', 'collector'), (req, res, next) => OwnerController.getById(req, res, next));
router.post('/', authorize('admin', 'director', 'collector_manager', 'accounting'), ownerValidator, (req, res, next) => OwnerController.create(req, res, next));
router.put('/:id', authorize('admin', 'director', 'collector_manager', 'accounting'), updateOwnerValidator, (req, res, next) => OwnerController.update(req, res, next));
router.delete('/:id', authorize('admin', 'director', 'collector_manager'), (req, res, next) => OwnerController.delete(req, res, next));

module.exports = router;
