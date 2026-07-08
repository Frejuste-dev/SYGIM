const express = require('express');
const router = express.Router();
const OwnerController = require('../controllers/OwnerController');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/', (req, res, next) => OwnerController.getAll(req, res, next));
router.get('/:id', (req, res, next) => OwnerController.getById(req, res, next));
router.post('/', authorize('admin', 'director', 'collector_manager', 'accounting'), (req, res, next) => OwnerController.create(req, res, next));
router.put('/:id', authorize('admin', 'director', 'collector_manager', 'accounting'), (req, res, next) => OwnerController.update(req, res, next));
router.delete('/:id', authorize('admin', 'director', 'collector_manager'), (req, res, next) => OwnerController.delete(req, res, next));

module.exports = router;
