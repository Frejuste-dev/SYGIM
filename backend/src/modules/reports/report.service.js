/**
 * Module   : Reports
 * Auteur   : SYGIM Team
 * Créé le  : 2026-06-16
 * Rôle     : Service de gestion des rapports
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
    const hash = crypto.createHash('md5').update(JSON.stringify(filters)).digest('hex');
    return `report:${prefix}:${hash}`;
  }

  /**
   * Dashboard (Résumé global)
   */
  async getDashboardReport(filters) {
    const cacheKey = this._getCacheKey('dashboard', filters);
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    const data = await reportRepository.getTransactionSummary(filters);
    await cacheService.set(cacheKey, data, 300);
    return data;
  }

  /**
   * Performance des collecteurs
   */
  async getCollectorReport(filters) {
    const cacheKey = this._getCacheKey('collector', filters);
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    const data = await reportRepository.getCollectorPerformance(filters);
    await cacheService.set(cacheKey, data, 180);
    return data;
  }

  /**
   * Rapport des propriétés
   */
  async getPropertyReport(filters) {
    const cacheKey = this._getCacheKey('property', filters);
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    const data = await reportRepository.getPropertyOccupancy(filters);
    await cacheService.set(cacheKey, data, 180);
    return data;
  }

  _getRepositoryMethod(reportType) {
    const mapping = {
      dashboard: 'getTransactionSummary',
      collectors: 'getCollectorPerformance',
      properties: 'getPropertyOccupancy',
      transactions: 'getDetailedTransactions'
    };
    return mapping[reportType] || 'getDetailedTransactions';
  }

  /**
   * Export CSV
   */
  async exportToCsv(reportType, filters) {
    try {
      const methodName = this._getRepositoryMethod(reportType);
      const data = await reportRepository[methodName](filters);
      
      if (!data || data.length === 0) {
        throw new AppError('Aucune donnée pour la période sélectionnée', 404);
      }
      
      const parser = new Parser();
      const csv = parser.parse(data);
      return Buffer.from('\uFEFF' + csv, 'utf8'); // BOM for Excel
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Erreur lors de l\'export CSV: ' + error.message, 500);
    }
  }

  /**
   * Export PDF
   */
  async exportToPdf(reportType, filters) {
    try {
      const methodName = this._getRepositoryMethod(reportType);
      const data = await reportRepository[methodName](filters);
      
      if (!data || data.length === 0) {
        throw new AppError('Aucune donnée pour la période sélectionnée', 404);
      }

      return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        // Header
        doc.fontSize(18).text(`SYGIM — Rapport: ${reportType.toUpperCase()}`, { align: 'center' });
        doc.fontSize(10).text(`Généré le: ${new Date().toISOString()}`, { align: 'center' });
        doc.text(`Filtres: ${JSON.stringify(filters)}`, { align: 'center' });
        doc.moveDown();

        // Table Data (Simplified for PDF)
        const fields = Object.keys(data[0]);
        doc.fontSize(10).font('Helvetica-Bold').text(fields.join(' | '), { underline: true });
        doc.moveDown(0.5);
        doc.font('Helvetica');
        data.forEach(item => {
          doc.text(Object.values(item).join(' | '));
        });

        doc.end();
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Erreur lors de l\'export PDF: ' + error.message, 500);
    }
  }
}

module.exports = new ReportService();
