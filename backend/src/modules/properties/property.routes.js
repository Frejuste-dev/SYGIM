const express = require('express');
const router = express.Router();
const PropertyController = require('./property.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { propertyValidator, updatePropertyValidator } = require('./property.validator');
router.use(authenticate);

router.get('/', authorize('admin', 'director', 'accounting', 'collector_manager', 'collector'), (req, res, next) => PropertyController.getAll(req, res, next));
router.get('/stats', authorize('admin', 'director', 'accounting', 'collector_manager'), (req, res, next) => PropertyController.getStats(req, res, next));
router.get('/:id', authorize('admin', 'director', 'accounting', 'collector_manager', 'collector'), (req, res, next) => PropertyController.getById(req, res, next));
router.post('/', authorize('admin', 'director', 'collector_manager', 'accounting'), propertyValidator, (req, res, next) => PropertyController.create(req, res, next));
router.put('/:id', authorize('admin', 'director', 'collector_manager', 'accounting'), updatePropertyValidator, (req, res, next) => PropertyController.update(req, res, next));
router.delete('/:id', authorize('admin', 'director', 'collector_manager'), (req, res, next) => PropertyController.delete(req, res, next));

module.exports = router;
