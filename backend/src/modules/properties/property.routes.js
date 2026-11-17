const express = require('express');
const router = express.Router();
const PropertyController = require('./property.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const {
  propertyValidator,
  updatePropertyValidator,
  assignOwnerValidator,
  reassignOwnerValidator,
  assignTenantValidator
} = require('./property.validator');
router.use(authenticate);

router.get('/', authorize('admin', 'director', 'accounting', 'manager', 'collector_manager', 'collector'), (req, res, next) => PropertyController.getAll(req, res, next));
router.get('/stats', authorize('admin', 'director', 'accounting', 'manager', 'collector_manager'), (req, res, next) => PropertyController.getStats(req, res, next));
router.get('/assignments', authorize('admin', 'director', 'manager', 'collector_manager', 'accounting'), (req, res, next) => PropertyController.getAssignments(req, res, next));
router.get('/assignments/history', authorize('admin', 'director', 'manager', 'collector_manager', 'accounting'), (req, res, next) => PropertyController.getAssignmentHistory(req, res, next));
router.post('/:id/assign-owner', authorize('admin', 'director', 'manager', 'collector_manager'), assignOwnerValidator, (req, res, next) => PropertyController.assignOwner(req, res, next));
router.put('/:id/reassign-owner', authorize('admin', 'director', 'manager', 'collector_manager'), reassignOwnerValidator, (req, res, next) => PropertyController.reassignOwner(req, res, next));
router.get('/:id', authorize('admin', 'director', 'accounting', 'manager', 'collector_manager', 'collector'), (req, res, next) => PropertyController.getById(req, res, next));
router.post('/', authorize('admin', 'director', 'manager', 'collector_manager', 'accounting'), propertyValidator, (req, res, next) => PropertyController.create(req, res, next));
router.put('/:id', authorize('admin', 'director', 'manager', 'collector_manager', 'accounting'), updatePropertyValidator, (req, res, next) => PropertyController.update(req, res, next));
router.post('/:id/assign', authorize('admin', 'super_admin', 'director', 'manager', 'collector_manager', 'gestionnaire', 'accounting', 'collector'), assignTenantValidator, (req, res, next) => PropertyController.assignTenant(req, res, next));
router.post('/:id/assign-tenant', authorize('admin', 'super_admin', 'director', 'manager', 'collector_manager', 'gestionnaire', 'accounting', 'collector'), assignTenantValidator, (req, res, next) => PropertyController.assignTenant(req, res, next));
router.delete('/:id', authorize('admin', 'director', 'manager', 'collector_manager'), (req, res, next) => PropertyController.delete(req, res, next));

module.exports = router;
