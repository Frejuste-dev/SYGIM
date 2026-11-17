/**
 * Module   : Reports
 * Auteur   : SYGIM Team
 * Créé le  : 2026-06-16
 * Rôle     : Contrôleur des rapports & analyses
 */

const reportService = require('./report.service');
const OwnerRepository = require('../owners/owner.repository');
const ApiResponse = require('../../utils/responses/ApiResponse');
const AppError = require('../../utils/errors/AppError');

/**
 * Vérification stricte anti-IDOR et RBAC pour les rapports spécifiques à un propriétaire
 */
async function verifyOwnerAccess(ownerId, user) {
  if (!user) {
    throw AppError.unauthorized('Non authentifié');
  }

  const oId = parseInt(ownerId, 10);

  // Rôle Propriétaire : accès strictement restreint à son propre compte
  if (user.role === 'owner') {
    const owner = await OwnerRepository.findByUserId(user.id);
    if (!owner || owner.id !== oId) {
      throw AppError.forbidden('Accès refusé. Vous ne pouvez consulter que vos propres états financiers.');
    }
    return;
  }

  // Rôle Collecteur : formellement exclu des rapports propriétaires
  if (['collector', 'collecteur'].includes(user.role)) {
    throw AppError.forbidden('Accès refusé. Les collecteurs ne sont pas autorisés à consulter ces rapports financiers.');
  }

  // Rôle Manager / Gestionnaire : vérifier le périmètre de son équipe
  if (['manager', 'collector_manager', 'gestionnaire'].includes(user.role)) {
    const hasAccess = await OwnerRepository.isAccessibleByUser(oId, user);
    if (!hasAccess) {
      throw AppError.forbidden('Accès refusé. Ce propriétaire n\'est pas géré par votre équipe.');
    }
  }
}

class ReportController {
  async getKpis(req, res, next) {
    try {
      const data = await reportService.getKpis(req.query);
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

  async getOwnerSituation(req, res, next) {
    try {
      const { ownerId } = req.params;
      await verifyOwnerAccess(ownerId, req.user);
      const data = await reportService.getOwnerSituation(ownerId, req.query);
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
      await verifyOwnerAccess(ownerId, req.user);
      const pdf = await reportService.exportOwnerStatementPdf(ownerId, req.query);
      const label = req.query.month || (req.query.startDate && req.query.endDate ? `${req.query.startDate}_au_${req.query.endDate}` : 'periode');
      res.header('Content-Type', 'application/pdf');
      res.attachment(`bordereau_reddition_proprietaire_${ownerId}_${label}.pdf`);
      res.send(pdf);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/reports/aged-receivables
   * Balance Âgée Locataires (0-30j, 31-60j, 61-90j, >90j)
   */
  async getAgedReceivables(req, res, next) {
    try {
      const data = await reportService.getAgedReceivables(req.query);
      res.status(200).json(ApiResponse.success(data));
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/reports/deposits
   * Inventaire des Dépôts de Garantie (Cautions)
   */
  async getDepositsReport(req, res, next) {
    try {
      const data = await reportService.getDepositsReport(req.query);
      res.status(200).json(ApiResponse.success(data));
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/reports/owner-ledger/:ownerId
   * Extrait Chronologique du Compte Propriétaire
   */
  async getOwnerLedger(req, res, next) {
    try {
      const { ownerId } = req.params;
      await verifyOwnerAccess(ownerId, req.user);
      const data = await reportService.getOwnerLedger(ownerId, req.query);
      res.status(200).json(ApiResponse.success(data));
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/reports/tax-declaration/:ownerId
   * Aide à la Déclaration des Revenus Fonciers (Annuel)
   */
  async getTaxDeclaration(req, res, next) {
    try {
      const { ownerId } = req.params;
      await verifyOwnerAccess(ownerId, req.user);
      const data = await reportService.getTaxDeclaration(ownerId, req.query);
      res.status(200).json(ApiResponse.success(data));
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/reports/mandate-bfr
   * Analyse du BFR & Équilibre du Compte Mandat
   */
  async getMandateBfr(req, res, next) {
    try {
      const data = await reportService.getMandateBfr();
      res.status(200).json(ApiResponse.success(data));
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/reports/vacancy-loss
   * Vacance Locative & Manque à Gagner Financier
   */
  async getVacancyLoss(req, res, next) {
    try {
      const data = await reportService.getVacancyLoss(req.query);
      res.status(200).json(ApiResponse.success(data));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ReportController();
