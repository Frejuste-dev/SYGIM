const express = require('express');
const router = express.Router();
const UserController = require('./user.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { userValidator, updateUserValidator } = require('./user.validator');
router.use(authenticate);
router.use(authorize('admin'));

router.get('/', (req, res, next) => UserController.getAll(req, res, next));
router.get('/:id', (req, res, next) => UserController.getById(req, res, next));
router.post('/', userValidator, (req, res, next) => UserController.create(req, res, next));
router.put('/:id', updateUserValidator, (req, res, next) => UserController.update(req, res, next));
router.delete('/:id', (req, res, next) => UserController.delete(req, res, next));
router.patch('/:id/activate', (req, res, next) => UserController.activate(req, res, next));
router.patch('/:id/deactivate', (req, res, next) => UserController.deactivate(req, res, next));

module.exports = router;
