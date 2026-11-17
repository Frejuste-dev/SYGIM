const ImportService = require('./import.service');
const ApiResponse = require('../../utils/responses/ApiResponse');
const AppError = require('../../utils/errors/AppError');

class ImportController {
  /**
   * GET /api/import/template
   * Télécharge le modèle Excel (.xlsx) prêt à remplir
   */
  async downloadTemplate(req, res, next) {
    try {
      const buffer = await ImportService.generateTemplateWorkbook();
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="modele_import_sygim.xlsx"'
      );
      return res.status(200).send(Buffer.from(buffer));
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/import/portfolio/preview
   * Analyse un fichier multipart (.xlsx/.xls/.csv) ou un payload JSON { rows: [...] }
   */
  async preview(req, res, next) {
    try {
      let rows = [];
      if (req.file && req.file.buffer) {
        rows = ImportService.parseFileBuffer(req.file.buffer);
      } else if (Array.isArray(req.body?.rows)) {
        rows = req.body.rows;
      } else {
        throw AppError.badRequest('Veuillez fournir un fichier Excel/CSV ou un tableau de lignes.');
      }

      const result = await ImportService.previewPortfolio(rows);
      return res.status(200).json(ApiResponse.success(result, 'Analyse du fichier terminée'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/import/portfolio/execute
   * Exécute l'importation transactionnelle des lignes valides
   */
  async execute(req, res, next) {
    try {
      let rows = [];
      if (req.file && req.file.buffer) {
        rows = ImportService.parseFileBuffer(req.file.buffer);
      } else if (Array.isArray(req.body?.rows)) {
        rows = req.body.rows;
      } else {
        throw AppError.badRequest('Aucune donnée à importer.');
      }

      const result = await ImportService.executePortfolio(rows, req.user);
      return res.status(200).json(ApiResponse.success(result, 'Importation exécutée avec succès'));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ImportController();
