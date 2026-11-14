/**
 * Module   : Reports
 * Auteur   : SYGIM Team
 * Créé le  : 2026-06-16
 * Rôle     : Contrôleur des rapports & analyses
 */

const reportService = require('./report.service');
const ApiResponse = require('../../utils/responses/ApiResponse');

class ReportController {
  async getKpis(req, res, next) {
    try {
      const data = await reportService.getKpis();
      res.status(200).json(ApiResponse.success(data));
    } catch (error) {
      next(error);
    }
  }

  async getDashboard(req, res, next) {
    try {
      const data = await reportService.getDashboardReport(req.query);
      res.status(200).json(ApiResponse.success(data));
    } catch (error) {
      next(error);
    }
  }

  async getCollector(req, res, next) {
    try {
      const data = await reportService.getCollectorReport(req.query);
      res.status(200).json(ApiResponse.success(data));
    } catch (error) {
      next(error);
    }
  }

  async getProperty(req, res, next) {
    try {
      const data = await reportService.getPropertyReport(req.query);
      res.status(200).json(ApiResponse.success(data));
    } catch (error) {
      next(error);
    }
  }

  async getPrefinancing(req, res, next) {
    try {
      const data = await reportService.getPrefinancingReport(req.query);
      res.status(200).json(ApiResponse.success(data));
    } catch (error) {
      next(error);
    }
  }

  async getPerformanceDashboard(req, res, next) {
    try {
      const data = await reportService.getPerformanceDashboard(req.query);
      res.status(200).json(ApiResponse.success(data));
    } catch (error) {
      next(error);
    }
  }

  async getManagerDashboard(req, res, next) {
    try {
      const data = await reportService.getManagerDashboard(req.query);
      res.status(200).json(ApiResponse.success(data));
    } catch (error) {
      next(error);
    }
  }

  async exportCsv(req, res, next) {
    try {
      const csv = await reportService.exportToCsv(req.params.type, req.query);
      res.header('Content-Type', 'text/csv');
      res.attachment(`sygim_report_${req.params.type}.csv`);
      res.send(csv);
    } catch (error) {
      next(error);
    }
  }

  async exportPdf(req, res, next) {
    try {
      const pdf = await reportService.exportToPdf(req.params.type, req.query);
      res.header('Content-Type', 'application/pdf');
      res.attachment(`sygim_report_${req.params.type}.pdf`);
      res.send(pdf);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/reports/owner-statements
   * Décompte hiérarchique Bailleurs & Locataires
   */
  async getOwnerStatements(req, res, next) {
    try {
      const data = await reportService.getOwnerStatements(req.query);
      res.status(200).json(ApiResponse.success(data));
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/reports/owner-statements/export/excel
   * Export Excel complet du rapport décompte bailleurs & locataires
   */
  async exportOwnerStatementsExcel(req, res, next) {
    try {
      const csv = await reportService.exportOwnerStatementsExcel(req.query, req.user);
      const month = req.query.month || new Date().toISOString().slice(0, 7);
      res.header('Content-Type', 'text/csv; charset=utf-8');
      res.attachment(`decompte_bailleurs_locataires_${month}.csv`);
      res.send(csv);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/reports/owner-statements/:ownerId/pdf
   * Bordereau de reddition de comptes mensuel officiel pour un propriétaire
   */
  async exportOwnerStatementPdf(req, res, next) {
    try {
      const { ownerId } = req.params;
      const pdf = await reportService.exportOwnerStatementPdf(ownerId, req.query);
      const label = req.query.month || (req.query.startDate && req.query.endDate ? `${req.query.startDate}_au_${req.query.endDate}` : 'periode');
      res.header('Content-Type', 'application/pdf');
      res.attachment(`bordereau_reddition_proprietaire_${ownerId}_${label}.pdf`);
      res.send(pdf);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ReportController();
