const express = require('express');
const multer = require('multer');
const router = express.Router();
const ImportController = require('./import.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const AppError = require('../../utils/errors/AppError');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 Mo max
  fileFilter: (req, file, cb) => {
    const allowedExt = /\.(xlsx|xls|csv)$/i;
    if (!allowedExt.test(file.originalname || '')) {
      return cb(AppError.badRequest('Format de fichier non supporté. Utilisez .xlsx, .xls ou .csv.'));
    }
    cb(null, true);
  }
});

router.use(authenticate);
router.use(authorize('admin', 'super_admin', 'director', 'manager'));

router.get('/template', (req, res, next) => ImportController.downloadTemplate(req, res, next));
router.post('/portfolio/preview', upload.single('file'), (req, res, next) => ImportController.preview(req, res, next));
router.post('/portfolio/execute', upload.single('file'), (req, res, next) => ImportController.execute(req, res, next));

module.exports = router;
