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
}

module.exports = new ReportController();
