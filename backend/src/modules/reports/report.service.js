/**
 * Module   : Reports
 * Auteur   : SYGIM Team
 * Créé le  : 2026-06-16
 * Rôle     : Service de gestion des rapports & analyses
 */

const reportRepository = require('./report.repository');
const cacheService = require('../../infrastructure/cache/cache.service');
const AppError = require('../../utils/errors/AppError');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const { Parser } = require('json2csv');

class ReportService {
  /**
   * Génération de clé de cache basée sur les filtres
   */
  _getCacheKey(prefix, filters) {
    const hash = crypto.createHash('md5').update(JSON.stringify(filters || {})).digest('hex');
    return `report:${prefix}:${hash}`;
  }

  /**
   * KPIs scalaires du Dashboard (TTL: 15s)
   */
  async getKpis() {
    const cacheKey = 'report:kpis:global';
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    const data = await reportRepository.getKpis();
    await cacheService.set(cacheKey, data, 15);
    return data;
  }

  /**
   * Dashboard (Résumé global)
   */
  async getDashboardReport(filters = {}) {
    const cacheKey = this._getCacheKey('dashboard_v2', filters);
    const cached = await cacheService.get(cacheKey);
    if (cached && typeof cached === 'object' && !Array.isArray(cached)) {
      return cached;
    }

    const data = await reportRepository.getTransactionSummary(filters);
    await cacheService.set(cacheKey, data, 15);
    return data;
  }

  /**
   * Performance des collecteurs
   */
  async getCollectorReport(filters = {}) {
    const cacheKey = this._getCacheKey('collector_v2', filters);
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const data = await reportRepository.getCollectorPerformance(filters);
    await cacheService.set(cacheKey, data, 15);
    return data;
  }

  /**
   * Rapport des propriétés
   */
  async getPropertyReport(filters = {}) {
    const cacheKey = this._getCacheKey('property_v2', filters);
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const data = await reportRepository.getPropertyOccupancy(filters);
    await cacheService.set(cacheKey, data, 15);
    return data;
  }

  /**
   * Rapport de Préfinancement & Reversements Propriétaires
   */
  async getPrefinancingReport(filters = {}) {
    return await reportRepository.getPrefinancingReport(filters);
  }

  async _getExportRows(reportType, filters = {}) {
    if (reportType === 'collectors') {
      return await reportRepository.getCollectorPerformance(filters);
    }
    if (reportType === 'properties') {
      return await reportRepository.getPropertyOccupancy(filters);
    }
    if (reportType === 'prefinancing') {
      const pref = await reportRepository.getPrefinancingReport(filters);
      return pref.prefinancings?.length ? pref.prefinancings : pref.eligibleCases || [];
    }
    if (reportType === 'overdue') {
      const pref = await reportRepository.getPrefinancingReport(filters);
      return pref.eligibleCases || [];
    }
    return await reportRepository.getDetailedTransactions(filters);
  }

  /**
   * Export CSV
   */
  async exportToCsv(reportType, filters) {
    try {
      const data = await this._getExportRows(reportType, filters);

      if (!data || data.length === 0) {
        throw new AppError('Aucune donnée disponible pour l\'export', 404);
      }

      const parser = new Parser();
      const csv = parser.parse(data);
      return Buffer.from('\uFEFF' + csv, 'utf8'); // BOM for Excel
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Erreur lors de l\'export CSV: ' + error.message, 500);
    }
  }

  /**
   * Export PDF
   */
  async exportToPdf(reportType, filters) {
    try {
      const data = await this._getExportRows(reportType, filters);

      if (!data || data.length === 0) {
        throw new AppError('Aucune donnée disponible pour l\'export', 404);
      }

      return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        // Header
        doc.fontSize(18).text(`SYGIM — Rapport: ${reportType.toUpperCase()}`, { align: 'center' });
        doc.fontSize(10).text(`Généré le: ${new Date().toLocaleDateString('fr-FR')}`, { align: 'center' });
        doc.moveDown();

        const fields = Object.keys(data[0]).slice(0, 6);
        doc.fontSize(9).font('Helvetica-Bold').text(fields.join(' | '), { underline: true });
        doc.moveDown(0.5);
        doc.font('Helvetica');
        data.forEach(item => {
          doc.text(fields.map(k => String(item[k] ?? '')).join(' | '));
        });

        doc.end();
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Erreur lors de l\'export PDF: ' + error.message, 500);
    }
  }
}

module.exports = new ReportService();
