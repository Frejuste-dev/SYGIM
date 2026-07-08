const express = require('express');
const router = express.Router();
const PropertyController = require('../controllers/PropertyController');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/', (req, res, next) => PropertyController.getAll(req, res, next));
router.get('/stats', (req, res, next) => PropertyController.getStats(req, res, next));
router.get('/:id', (req, res, next) => PropertyController.getById(req, res, next));
router.post('/', authorize('admin', 'director', 'collector_manager', 'accounting'), (req, res, next) => PropertyController.create(req, res, next));
router.put('/:id', authorize('admin', 'director', 'collector_manager', 'accounting'), (req, res, next) => PropertyController.update(req, res, next));
router.delete('/:id', authorize('admin', 'director', 'collector_manager'), (req, res, next) => PropertyController.delete(req, res, next));

module.exports = router;
