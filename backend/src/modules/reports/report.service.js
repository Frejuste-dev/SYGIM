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

  /**
   * Rapport décompte bailleurs et locataires (Master-Detail)
   */
  async getOwnerStatements(query = {}) {
    return await reportRepository.getOwnerStatements(query);
  }

  /**
   * Export Excel hiérarchique du décompte bailleurs & locataires
   */
  async exportOwnerStatementsExcel(query = {}, user = null) {
    const data = await reportRepository.getOwnerStatements(query);
    const { month, period_label, statements } = data;
    const isManager = user && ['collector_manager', 'gestionnaire', 'manager'].includes(user.role);

    let csv = `ÉTAT RÉCAPITULATIF DES BAILLEURS ET DÉCOMPTE LOCATIF - PÉRIODE : ${period_label.toUpperCase()}\n`;
    csv += `Généré le : ${new Date().toLocaleDateString('fr-FR')} - SYGIM Gestion Immobilière\n\n`;

    if (isManager) {
      // Pour le manager : pas de flux financier agence, colonnes strictement opérationnelles
      csv += `PROPRIÉTAIRE / LOCATAIRE;BIEN IMMOBILIER;LOYER GLOBAL (ATTENDU);LOYER ENCAISSÉ;ARRIÉRÉ (RESTE);MONTANT PRÉFINANCÉ\n`;

      for (const s of statements) {
        csv += `"${s.owner_name.toUpperCase()}";"${s.properties_count} bien(s)";${s.total_expected_rent};${s.total_collected_rent};${s.total_arrears};${s.total_prefinanced}\n`;
        for (const u of s.units) {
          csv += `"-- ${u.tenant_name}";"${u.property_name}";${u.expected_rent};${u.collected_rent};${u.arrears};${u.prefinanced_amount}\n`;
        }
        csv += `;;;;;\n`;
      }

      csv += `"TOTAL GÉNÉRAL CONSOLIDÉ";"${data.totals.total_owners} propriétaire(s)";${data.totals.global_expected};${data.totals.global_collected};${data.totals.global_arrears};${data.totals.global_prefinanced}\n`;
    } else {
      // Pour la direction et la comptabilité : inclut la commission agence et le net propriétaire
      csv += `PROPRIÉTAIRE / LOCATAIRE;BIEN IMMOBILIER;LOYER GLOBAL (ATTENDU);LOYER ENCAISSÉ;ARRIÉRÉ (RESTE);MONTANT PRÉFINANCÉ;COMMISSION AGENCE;NET PROPRIÉTAIRE\n`;

      for (const s of statements) {
        csv += `"${s.owner_name.toUpperCase()}";"${s.properties_count} bien(s)";${s.total_expected_rent};${s.total_collected_rent};${s.total_arrears};${s.total_prefinanced};${s.agency_commission};${s.net_owner_payout}\n`;
        for (const u of s.units) {
          csv += `"-- ${u.tenant_name}";"${u.property_name}";${u.expected_rent};${u.collected_rent};${u.arrears};${u.prefinanced_amount};;\n`;
        }
        csv += `;;;;;;;\n`;
      }

      csv += `"TOTAL GÉNÉRAL CONSOLIDÉ";"${data.totals.total_owners} propriétaire(s)";${data.totals.global_expected};${data.totals.global_collected};${data.totals.global_arrears};${data.totals.global_prefinanced};${data.totals.global_commission};${data.totals.global_net_payout}\n`;
    }

    return Buffer.from('\uFEFF' + csv, 'utf8');
  }

  /**
   * Bordereau de reddition de comptes mensuel officiel (PDF individuel propriétaire)
   * Note : La commission agence est EXCLUE du bordereau selon la demande formelle du client
   */
  async exportOwnerStatementPdf(ownerId, filtersOrMonth) {
    const filters = typeof filtersOrMonth === 'object' ? filtersOrMonth : { month: filtersOrMonth };
    const data = await reportRepository.getOwnerStatements({ ...filters, ownerId: parseInt(ownerId, 10) });
    const statement = data.statements[0];

    if (!statement) {
      throw new AppError('Propriétaire ou données introuvables pour cette période', 404);
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 36, size: 'A4', bufferPages: true });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const formatNum = (n) => new Intl.NumberFormat('fr-FR').format(Number(n) || 0) + ' XOF';

      // ── EN-TÊTE DU DOCUMENT ──
      doc.rect(36, 36, 523, 50).fill('#1e1b4b');
      doc.fillColor('#ffffff').fontSize(16).font('Helvetica-Bold')
         .text('SYGIM IMMOBILIER', 50, 48);
      doc.fontSize(8).font('Helvetica')
         .text('Gestion Locative, Recouvrement & Administration de Biens • Abidjan, Côte d\'Ivoire', 50, 68);

      doc.fillColor('#fbbf24').fontSize(12).font('Helvetica-Bold')
         .text('BORDEREAU DE REDDITION DE COMPTES', 300, 48, { width: 245, align: 'right' });
      doc.fillColor('#ffffff').fontSize(9).font('Helvetica')
         .text(`Période : ${data.period_label.toUpperCase()}`, 300, 68, { width: 245, align: 'right' });

      doc.moveDown(2);

      // ── BLOC INFOS BAILLEUR ──
      const yBox = 100;
      doc.rect(36, yBox, 523, 75).fill('#f8fafc').stroke('#cbd5e1');
      doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold')
         .text('INFORMATIONS DU BAILLEUR', 48, yBox + 10);

      doc.fontSize(9).font('Helvetica-Bold').text('Propriétaire :', 48, yBox + 28);
      doc.font('Helvetica').text(statement.owner_name, 125, yBox + 28);

      doc.font('Helvetica-Bold').text('Téléphone :', 48, yBox + 42);
      doc.font('Helvetica').text(statement.phone, 125, yBox + 42);

      doc.font('Helvetica-Bold').text('Mode Règlement :', 48, yBox + 56);
      doc.font('Helvetica').text(statement.preferred_payment_method.toUpperCase(), 125, yBox + 56);

      doc.font('Helvetica-Bold').text('Réf. Bordereau :', 320, yBox + 28);
      doc.font('Helvetica').text(`BR-${statement.owner_id}-${(month || 'COURANT').replace('-', '')}`, 410, yBox + 28);

      doc.font('Helvetica-Bold').text('Date d\'émission :', 320, yBox + 42);
      doc.font('Helvetica').text(new Date().toLocaleDateString('fr-FR'), 410, yBox + 42);

      doc.font('Helvetica-Bold').text('Compte / RIB :', 320, yBox + 56);
      doc.font('Helvetica').text(statement.bank_account || statement.bank_name || '—', 410, yBox + 56, { width: 140, ellipsis: true });

      // ── TABLEAU DÉTAILLÉ DES LOCATAIRES ──
      const yTable = 190;
      doc.rect(36, yTable, 523, 22).fill('#334155');
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
      doc.text('LOCATAIRE', 42, yTable + 6, { width: 110 });
      doc.text('BIEN IMMOBILIER', 155, yTable + 6, { width: 120 });
      doc.text('LOYER ATTENDU', 280, yTable + 6, { width: 70, align: 'right' });
      doc.text('LOYER ENCAISSÉ', 355, yTable + 6, { width: 70, align: 'right' });
      doc.text('ARRIÉRÉ / SOLDE', 430, yTable + 6, { width: 60, align: 'right' });
      doc.text('PRÉFINANCÉ', 495, yTable + 6, { width: 60, align: 'right' });

      let currentY = yTable + 22;
      doc.font('Helvetica').fontSize(8);

      statement.units.forEach((u, idx) => {
        const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
        doc.rect(36, currentY, 523, 20).fill(bg).stroke('#e2e8f0');

        doc.fillColor(u.is_vacant ? '#94a3b8' : '#0f172a')
           .font(u.is_vacant ? 'Helvetica-Oblique' : 'Helvetica')
           .text(u.tenant_name, 42, currentY + 5, { width: 110, ellipsis: true });

        doc.fillColor('#475569')
           .text(u.property_name, 155, currentY + 5, { width: 120, ellipsis: true });

        doc.fillColor('#0f172a').font('Helvetica')
           .text(u.is_vacant ? '—' : formatNum(u.expected_rent), 280, currentY + 5, { width: 70, align: 'right' });

        doc.fillColor('#059669').font('Helvetica-Bold')
           .text(u.is_vacant ? '—' : formatNum(u.collected_rent), 355, currentY + 5, { width: 70, align: 'right' });

        const arrearsColor = u.arrears > 0 ? '#dc2626' : (u.arrears < 0 ? '#2563eb' : '#64748b');
        doc.fillColor(arrearsColor)
           .text(u.is_vacant ? '—' : formatNum(u.arrears), 430, currentY + 5, { width: 60, align: 'right' });

        doc.fillColor('#d97706')
           .text(u.prefinanced_amount > 0 ? formatNum(u.prefinanced_amount) : '—', 495, currentY + 5, { width: 60, align: 'right' });

        currentY += 20;
      });

      // ── BLOC DE SYNTHÈSE DES REVERSEMENTS (SANS COMMISSION AGENCE) ──
      currentY += 15;
      const maintenanceDed = Number(statement.maintenance_deductions || 0);
      const totalPayoutToOwner = Math.max(0, statement.total_collected_rent + statement.total_prefinanced - maintenanceDed);

      doc.rect(36, currentY, 523, maintenanceDed > 0 ? 75 : 65).fill('#f1f5f9').stroke('#94a3b8');
      doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold')
         .text('SYNTHÈSE DE LA REDDITION DE COMPTES AU PROPRIÉTAIRE', 48, currentY + 10);

      doc.font('Helvetica').fontSize(8.5);
      doc.text(`Total Loyers Attendus : ${formatNum(statement.total_expected_rent)}`, 48, currentY + 28);
      doc.text(`Total Loyers Encaissés : ${formatNum(statement.total_collected_rent)}`, 48, currentY + 44);

      if (maintenanceDed > 0) {
        doc.fillColor('#b45309').font('Helvetica-Bold')
           .text(`Retenues Travaux / Réparations : - ${formatNum(maintenanceDed)}`, 48, currentY + 58);
      }

      doc.fillColor('#0f172a').font('Helvetica');
      doc.text(`Arriérés Locataires Restants : ${formatNum(statement.total_arrears)}`, 220, currentY + 28);
      doc.text(`Avances Préfinancées versées : ${formatNum(statement.total_prefinanced)}`, 220, currentY + 44);

      doc.rect(375, currentY + 8, 175, maintenanceDed > 0 ? 58 : 48).fill('#047857');
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold')
         .text('NET REVERSÉ AU BAILLEUR', 385, currentY + 16, { width: 155, align: 'center' });
      doc.fontSize(12).font('Helvetica-Bold')
         .text(formatNum(totalPayoutToOwner), 385, currentY + (maintenanceDed > 0 ? 36 : 32), { width: 155, align: 'center' });

      // ── CADRES DE SIGNATURES ──
      const ySign = currentY + (maintenanceDed > 0 ? 95 : 85);
      doc.rect(36, ySign, 250, 75).stroke('#cbd5e1');
      doc.fillColor('#334155').fontSize(8).font('Helvetica-Bold')
         .text('POUR L\'AGENCE SYGIM (Cachet & Signature)', 46, ySign + 8);

      doc.rect(309, ySign, 250, 75).stroke('#cbd5e1');
      doc.fillColor('#334155').fontSize(8).font('Helvetica-Bold')
         .text('POUR LE BAILLEUR (Accusé de Réception)', 319, ySign + 8);

      // Bas de page
      doc.fontSize(7).font('Helvetica').fillColor('#94a3b8')
         .text('Ce bordereau certifie le décompte des encaissements et versements effectués par SYGIM. Document officiel faisant foi.', 36, 790, { width: 523, align: 'center' });

      doc.end();
    });
  }
}

module.exports = new ReportService();
