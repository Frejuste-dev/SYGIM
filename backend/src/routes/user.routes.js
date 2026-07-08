const express = require('express');
const router = express.Router();
const UserController = require('../controllers/UserController');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);
router.use(authorize('admin'));

router.get('/', (req, res, next) => UserController.getAll(req, res, next));
router.get('/:id', (req, res, next) => UserController.getById(req, res, next));
router.post('/', (req, res, next) => UserController.create(req, res, next));
router.put('/:id', (req, res, next) => UserController.update(req, res, next));
router.delete('/:id', (req, res, next) => UserController.delete(req, res, next));

module.exports = router;
