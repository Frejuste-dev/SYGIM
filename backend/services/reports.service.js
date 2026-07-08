/**
 * Services de génération de rapports
 * Support des 8 types de rapports: Mensuel, Trimestriel, Retard, Locataire, 
 * Propriétaire, Biens, Préfinancements, Agents
 */

const PDFDocument = require('pdfkit');
const moment = require('moment');
require('moment/locale/fr');
moment.locale('fr');

class ReportsService {
  constructor(db) {
    this.db = db;
  }

  /**
   * RAPPORT MENSUEL - Agrégation par mois avec revenus, dépenses, commissions
   */
  async getMonthlyReport(filters = {}) {
    const { year = new Date().getFullYear(), month = new Date().getMonth() + 1 } = filters;
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = moment(startDate).endOf('month').format('YYYY-MM-DD');

    try {
      // Revenus (paiements clients)
      const [revenues] = await this.db.execute(
        `SELECT 
          SUM(amount) as total_collected,
          COUNT(*) as transaction_count,
          method,
          status
        FROM transactions
        WHERE date BETWEEN ? AND ? AND status IN ('processed', 'pending')
        GROUP BY method, status`,
        [startDate, endDate]
      );

      // Paiements locataires
      const [clientPayments] = await this.db.execute(
        `SELECT 
          COUNT(*) as total_clients,
          SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_clients,
          SUM(CASE WHEN status IN ('late', 'pending') THEN 1 ELSE 0 END) as unpaid_clients,
          SUM(amount_due) as total_due,
          SUM(amount_paid) as total_paid
        FROM clients
        WHERE property_id IS NOT NULL`
      );

      // Propriétés et loyers
      const [properties] = await this.db.execute(
        `SELECT 
          COUNT(*) as total_properties,
          SUM(CASE WHEN status = 'loue' THEN 1 ELSE 0 END) as rented_properties,
          SUM(CASE WHEN status = 'vacant' THEN 1 ELSE 0 END) as vacant_properties,
          SUM(rent) as total_rent_expected
        FROM properties
        WHERE active = 1`
      );

      return {
        period: moment(startDate).format('MMMM YYYY'),
        startDate,
        endDate,
        revenues: {
          byMethod: revenues,
          totalRevenue: revenues.reduce((sum, r) => sum + (r.total_collected || 0), 0),
          transactionCount: revenues.reduce((sum, r) => sum + (r.transaction_count || 0), 0)
        },
        clients: clientPayments[0],
        properties: properties[0]
      };
    } catch (error) {
      throw new Error(`Erreur rapport mensuel: ${error.message}`);
    }
  }

  /**
   * RAPPORT TRIMESTRIEL - Groupement par trimestre
   */
  async getQuarterlyReport(filters = {}) {
    const { year = new Date().getFullYear(), quarter = 1 } = filters;
    const monthStart = (quarter - 1) * 3 + 1;
    const monthEnd = monthStart + 2;
    const startDate = `${year}-${String(monthStart).padStart(2, '0')}-01`;
    const endDate = moment(`${year}-${String(monthEnd).padStart(2, '0')}-01`).endOf('month').format('YYYY-MM-DD');

    try {
      const [transactions] = await this.db.execute(
        `SELECT 
          MONTH(date) as month,
          SUM(amount) as total,
          COUNT(*) as count
        FROM transactions
        WHERE date BETWEEN ? AND ? AND status IN ('processed', 'pending')
        GROUP BY MONTH(date)
        ORDER BY month`,
        [startDate, endDate]
      );

      const [topOwners] = await this.db.execute(
        `SELECT 
          o.id,
          CONCAT(o.first_name, ' ', o.last_name) as owner_name,
          SUM(c.amount_due) as total_due,
          SUM(c.amount_paid) as total_paid,
          COUNT(DISTINCT c.id) as tenant_count
        FROM owners o
        LEFT JOIN clients c ON o.id = c.owner_id 
          AND c.created_at BETWEEN ? AND ?
        GROUP BY o.id
        ORDER BY total_paid DESC
        LIMIT 10`,
        [startDate, endDate]
      );

      return {
        period: `Q${quarter} ${year}`,
        startDate,
        endDate,
        monthlyBreakdown: transactions,
        topOwners: topOwners,
        summary: {
          totalRevenue: transactions.reduce((sum, t) => sum + (t.total || 0), 0),
          totalTransactions: transactions.reduce((sum, t) => sum + (t.count || 0), 0)
        }
      };
    } catch (error) {
      throw new Error(`Erreur rapport trimestriel: ${error.message}`);
    }
  }

  /**
   * RAPPORT RETARD - Clients en retard de paiement
   */
  async getOverdueReport(filters = {}) {
    const { daysOverdue = 15 } = filters;
    const thresholdDate = moment().subtract(daysOverdue, 'days').format('YYYY-MM-DD');

    try {
      const [overdueClients] = await this.db.execute(
        `SELECT 
          c.id,
          CONCAT(c.first_name, ' ', c.last_name) as client_name,
          c.phone,
          c.email,
          c.property_name,
          p.address,
          o.first_name as owner_first_name,
          o.last_name as owner_last_name,
          o.phone as owner_phone,
          c.amount_due as rent_due,
          c.amount_paid,
          (c.amount_due - c.amount_paid) as amount_owed,
          c.status,
          c.agent,
          DATEDIFF(NOW(), c.created_at) as days_overdue,
          (SELECT MAX(date) FROM transactions WHERE client_id = c.id) as last_payment_date
        FROM clients c
        LEFT JOIN properties p ON c.property_id = p.id
        LEFT JOIN owners o ON c.owner_id = o.id
        WHERE c.status IN ('late', 'pending') 
          AND c.amount_due > 0
          AND c.amount_paid < c.amount_due
          AND c.created_at <= ?
        ORDER BY days_overdue DESC`,
        [thresholdDate]
      );

      const summary = {
        totalOverdueClients: overdueClients.length,
        totalAmountOwed: overdueClients.reduce((sum, c) => sum + (c.amount_owed || 0), 0),
        averageDaysOverdue: overdueClients.reduce((sum, c) => sum + (c.days_overdue || 0), 0) / Math.max(overdueClients.length, 1),
        byAgent: this._groupBy(overdueClients, 'agent')
      };

      return {
        reportDate: new Date().toISOString(),
        daysThreshold: daysOverdue,
        clients: overdueClients,
        summary
      };
    } catch (error) {
      throw new Error(`Erreur rapport retard: ${error.message}`);
    }
  }

  /**
   * RAPPORT LOCATAIRE - Détails d'un locataire spécifique
   */
  async getTenantReport(clientId) {
    try {
      const [client] = await this.db.execute(
        `SELECT 
          c.id,
          c.first_name,
          c.last_name,
          c.phone,
          c.email,
          c.address,
          c.property_name,
          p.address as property_address,
          p.rent,
          o.first_name as owner_first_name,
          o.last_name as owner_last_name,
          c.amount_due,
          c.amount_paid,
          c.status,
          c.agent,
          c.deposit,
          c.advance_payment,
          c.contract_start,
          c.contract_end,
          c.created_at,
          c.updated_at
        FROM clients c
        LEFT JOIN properties p ON c.property_id = p.id
        LEFT JOIN owners o ON c.owner_id = o.id
        WHERE c.id = ?`,
        [clientId]
      );

      if (client.length === 0) {
        throw new Error('Locataire non trouvé');
      }

      const [transactions] = await this.db.execute(
        `SELECT 
          id,
          reference,
          date,
          description,
          amount,
          method,
          status,
          payment_type,
          notes
        FROM transactions
        WHERE client_id = ?
        ORDER BY date DESC
        LIMIT 50`,
        [clientId]
      );

      const tenantData = client[0];
      return {
        tenant: tenantData,
        transactions: transactions,
        balance: {
          due: tenantData.amount_due,
          paid: tenantData.amount_paid,
          owed: tenantData.amount_due - tenantData.amount_paid
        },
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Erreur rapport locataire: ${error.message}`);
    }
  }

  /**
   * RAPPORT PROPRIÉTAIRE - Résumé financier par propriétaire
   */
  async getOwnerReport(ownerId = null) {
    try {
      let query = `
        SELECT 
          o.id,
          CONCAT(o.first_name, ' ', o.last_name) as owner_name,
          o.phone,
          o.email,
          o.bank_account,
          COUNT(DISTINCT p.id) as property_count,
          SUM(p.rent) as expected_rental_income,
          SUM(c.amount_due) as total_due_from_tenants,
          SUM(c.amount_paid) as total_received_from_tenants,
          (SUM(c.amount_due) - SUM(c.amount_paid)) as total_owed_by_tenants
        FROM owners o
        LEFT JOIN properties p ON o.id = p.owner_id
        LEFT JOIN clients c ON p.id = c.property_id
      `;

      if (ownerId) {
        query += `WHERE o.id = ? `;
      }

      query += `GROUP BY o.id`;

      const params = ownerId ? [ownerId] : [];
      const [owners] = await this.db.execute(query, params);

      // Pour chaque propriétaire, récupérer les propriétés et locataires
      const detailedOwners = await Promise.all(
        owners.map(async (owner) => {
          const [properties] = await this.db.execute(
            `SELECT 
              id,
              name,
              address,
              type,
              status,
              value,
              rent,
              (SELECT COUNT(*) FROM clients WHERE property_id = properties.id) as tenant_count
            FROM properties
            WHERE owner_id = ?`,
            [owner.id]
          );

          return {
            ...owner,
            properties
          };
        })
      );

      return {
        owners: detailedOwners || [],
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Erreur rapport propriétaire: ${error.message}`);
    }
  }

  /**
   * RAPPORT BIENS - Inventaire et status des propriétés
   */
  async getPropertyReport(filters = {}) {
    try {
      const [properties] = await this.db.execute(
        `SELECT 
          p.id,
          p.name,
          p.address,
          p.type,
          p.status,
          p.value,
          p.rent,
          p.area,
          p.rooms,
          CONCAT(o.first_name, ' ', o.last_name) as owner_name,
          CONCAT(c.first_name, ' ', c.last_name) as tenant_name,
          col.first_name as collector_first_name,
          col.last_name as collector_last_name,
          (SELECT COUNT(*) FROM clients WHERE property_id = p.id AND status = 'paid') as paid_tenants,
          (SELECT COUNT(*) FROM clients WHERE property_id = p.id AND status IN ('late', 'pending')) as unpaid_tenants
        FROM properties p
        LEFT JOIN owners o ON p.owner_id = o.id
        LEFT JOIN clients c ON p.tenant_id = c.id
        LEFT JOIN collectors col ON p.collector_id = col.id
        WHERE p.active = 1
        ORDER BY p.status, p.name`
      );

      const summary = {
        totalProperties: properties.length,
        byStatus: this._groupByCount(properties, 'status'),
        byType: this._groupByCount(properties, 'type'),
        totalValue: properties.reduce((sum, p) => sum + (p.value || 0), 0),
        totalRentExpected: properties.reduce((sum, p) => sum + (p.rent || 0), 0)
      };

      return {
        properties,
        summary,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Erreur rapport biens: ${error.message}`);
    }
  }

  /**
   * RAPPORT PRÉFINANCEMENTS - Suivi des préfinancements
   */
  async getPrefinancingReport(filters = {}) {
    const { status = null } = filters;

    try {
      let query = `
        SELECT 
          pf.id,
          pf.reference,
          CONCAT(o.first_name, ' ', o.last_name) as owner_name,
          p.name as property_name,
          pf.amount,
          pf.interest_rate,
          pf.start_date,
          pf.end_date,
          pf.actual_end_date,
          pf.amount_repaid,
          pf.status,
          pf.notes,
          DATEDIFF(COALESCE(pf.actual_end_date, pf.end_date), pf.start_date) as duration_days,
          (pf.amount * (1 + pf.interest_rate / 100)) as total_with_interest,
          (pf.amount - pf.amount_repaid) as remaining_balance
        FROM prefinancings pf
        LEFT JOIN owners o ON pf.owner_id = o.id
        LEFT JOIN properties p ON pf.property_id = p.id
      `;

      if (status) {
        query += `WHERE pf.status = ? `;
      }

      query += `ORDER BY pf.start_date DESC`;

      const params = status ? [status] : [];
      const [prefinancings] = await this.db.execute(query, params);

      const summary = {
        total: prefinancings.length,
        byStatus: this._groupByCount(prefinancings, 'status'),
        totalAmount: prefinancings.reduce((sum, pf) => sum + (pf.amount || 0), 0),
        totalRepaid: prefinancings.reduce((sum, pf) => sum + (pf.amount_repaid || 0), 0),
        totalOutstanding: prefinancings.reduce((sum, pf) => sum + (pf.remaining_balance || 0), 0)
      };

      return {
        prefinancings,
        summary,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Erreur rapport préfinancements: ${error.message}`);
    }
  }

  /**
   * RAPPORT AGENTS - Performance des collecteurs
   */
  async getAgentReport(filters = {}) {
    try {
      const [agents] = await this.db.execute(
        `SELECT 
          c.id,
          CONCAT(c.first_name, ' ', c.last_name) as agent_name,
          c.zone,
          COUNT(DISTINCT p.id) as properties_assigned,
          COUNT(DISTINCT cl.id) as clients_assigned,
          SUM(t.amount) as total_collected,
          COUNT(t.id) as transaction_count,
          (SELECT COUNT(*) FROM clients WHERE agent = c.first_name) as active_clients,
          (SELECT SUM(amount_due - amount_paid) FROM clients WHERE agent = c.first_name) as recovery_potential
        FROM collectors c
        LEFT JOIN properties p ON c.id = p.collector_id
        LEFT JOIN clients cl ON c.id = (
          SELECT collector_id FROM transactions WHERE client_id = cl.id 
          GROUP BY collector_id 
          ORDER BY MAX(date) DESC LIMIT 1
        )
        LEFT JOIN transactions t ON c.id = t.collector_id 
          AND t.status IN ('processed', 'pending')
          AND MONTH(t.date) = MONTH(NOW())
        WHERE c.active = 1
        GROUP BY c.id
        ORDER BY total_collected DESC`
      );

      return {
        agents: agents,
        summary: {
          totalAgents: agents.length,
          totalCollected: agents.reduce((sum, a) => sum + (a.total_collected || 0), 0),
          averagePerAgent: agents.reduce((sum, a) => sum + (a.total_collected || 0), 0) / Math.max(agents.length, 1)
        },
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Erreur rapport agents: ${error.message}`);
    }
  }

  /**
   * Génération PDF générique pour les rapports
   * @param {string} reportType - Type de rapport
   * @param {object} data - Données du rapport
   * @returns {Buffer} Buffer PDF
   */
  generatePDF(reportType, data) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        margin: 40,
        bufferPages: true
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      try {
        this._drawPDFHeader(doc, reportType, data);

        switch (reportType.toLowerCase()) {
          case 'monthly':
            this._drawMonthlyPDF(doc, data);
            break;
          case 'quarterly':
            this._drawQuarterlyPDF(doc, data);
            break;
          case 'overdue':
            this._drawOverduePDF(doc, data);
            break;
          case 'tenant':
            this._drawTenantPDF(doc, data);
            break;
          case 'owner':
            this._drawOwnerPDF(doc, data);
            break;
          case 'property':
            this._drawPropertyPDF(doc, data);
            break;
          case 'prefinancing':
            this._drawPrefinancingPDF(doc, data);
            break;
          case 'agent':
            this._drawAgentPDF(doc, data);
            break;
          default:
            throw new Error(`Type de rapport inconnu: ${reportType}`);
        }

        this._drawPDFFooter(doc);
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  // ────────────────────────────────────────────────────
  // HELPERS - PDF Drawing Functions
  // ────────────────────────────────────────────────────

  _drawPDFHeader(doc, reportType, data) {
    doc.fontSize(24).font('Helvetica-Bold').text('SYGIM', { underline: true });
    doc.fontSize(10).font('Helvetica').text('Système de Gestion Immobilière', { underline: false });
    doc.moveDown(0.5);

    const reportTitles = {
      monthly: 'Rapport Mensuel',
      quarterly: 'Rapport Trimestriel',
      overdue: 'Rapport Retard',
      tenant: 'Rapport Locataire',
      owner: 'Rapport Propriétaire',
      property: 'Rapport Biens',
      prefinancing: 'Rapport Préfinancements',
      agent: 'Rapport Agents'
    };

    doc.fontSize(16).font('Helvetica-Bold').text(reportTitles[reportType.toLowerCase()] || reportType);
    doc.fontSize(10).text(`Généré le: ${moment().format('DD/MM/YYYY HH:mm')}`);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(1);
  }

  _drawPDFFooter(doc) {
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).text(
        `Page ${i + 1} sur ${pageCount}`,
        40, doc.page.height - 30, { align: 'center' }
      );
    }
  }

  _drawMonthlyPDF(doc, data) {
    doc.fontSize(12).font('Helvetica-Bold').text('Période: ' + data.period);
    doc.moveDown(0.5);

    // KPIs
    doc.fontSize(11).font('Helvetica-Bold').text('Indicateurs Clés');
    doc.fontSize(10).font('Helvetica');
    doc.text(`Revenus collectés: ${this._formatCurrency(data.revenues.totalRevenue)}`);
    doc.text(`Nombre de transactions: ${data.revenues.transactionCount}`);
    doc.text(`Total commissions: ${this._formatCurrency(data.commissions.totalCommissions)}`);
    doc.text(`Locataires payants: ${data.clients.paid_clients}/${data.clients.total_clients}`);
    doc.moveDown(0.5);

    // Revenus par méthode
    doc.fontSize(11).font('Helvetica-Bold').text('Revenus par Méthode');
    data.revenues.byMethod.forEach(revenue => {
      doc.fontSize(10).text(
        `${revenue.method}: ${this._formatCurrency(revenue.total_collected)} (${revenue.transaction_count} transactions)`
      );
    });
    doc.moveDown(0.5);

    // Top agents
    if (data.commissions.data && data.commissions.data.length > 0) {
      doc.fontSize(11).font('Helvetica-Bold').text('Top Collecteurs');
      data.commissions.data.slice(0, 5).forEach(commission => {
        doc.fontSize(10).text(
          `${commission.collector_name}: ${this._formatCurrency(commission.total_collected)} (Commissions: ${this._formatCurrency(commission.commission_amount)})`
        );
      });
    }
  }

  _drawQuarterlyPDF(doc, data) {
    doc.fontSize(12).font('Helvetica-Bold').text('Période: ' + data.period);
    doc.moveDown(0.5);

    doc.fontSize(11).font('Helvetica-Bold').text('Résumé Trimestriel');
    doc.fontSize(10).font('Helvetica');
    doc.text(`Total des revenues: ${this._formatCurrency(data.summary.totalRevenue)}`);
    doc.text(`Total des transactions: ${data.summary.totalTransactions}`);
    doc.moveDown(0.5);

    doc.fontSize(11).font('Helvetica-Bold').text('Ventilation Mensuelle');
    data.monthlyBreakdown.forEach(month => {
      doc.fontSize(10).text(`Mois ${month.month}: ${this._formatCurrency(month.total)} (${month.count} transactions)`);
    });
    doc.moveDown(0.5);

    if (data.topOwners && data.topOwners.length > 0) {
      doc.fontSize(11).font('Helvetica-Bold').text('Top Propriétaires');
      data.topOwners.slice(0, 5).forEach(owner => {
        doc.fontSize(10).text(
          `${owner.owner_name}: ${owner.tenant_count} locataires - Collecté: ${this._formatCurrency(owner.total_paid)}`
        );
      });
    }
  }

  _drawOverduePDF(doc, data) {
    doc.fontSize(12).font('Helvetica-Bold').text(`Clients en Retard (> ${data.daysThreshold} jours)`);
    doc.moveDown(0.5);

    doc.fontSize(11).font('Helvetica-Bold').text('Résumé');
    doc.fontSize(10).font('Helvetica');
    doc.text(`Total clients en retard: ${data.summary.totalOverdueClients}`);
    doc.text(`Montant total dû: ${this._formatCurrency(data.summary.totalAmountOwed)}`);
    doc.text(`Jours moyens de retard: ${data.summary.averageDaysOverdue.toFixed(1)}`);
    doc.moveDown(0.5);

    doc.fontSize(11).font('Helvetica-Bold').text('Liste des Clients en Retard');
    doc.fontSize(9).font('Helvetica');

    const maxRows = 15;
    data.clients.slice(0, maxRows).forEach(client => {
      doc.text(`${client.client_name}`, { continued: true });
      doc.text(` - ${client.property_name}`, { continued: true });
      doc.text(` - Dû: ${this._formatCurrency(client.amount_owed)}`);
      doc.text(`  Agent: ${client.agent || 'N/A'} | Retard: ${client.days_overdue}j`);
    });

    if (data.clients.length > maxRows) {
      doc.text(`... et ${data.clients.length - maxRows} autres clients`);
    }
  }

  _drawTenantPDF(doc, data) {
    const t = data.tenant;
    doc.fontSize(12).font('Helvetica-Bold').text('Informations Locataire');
    doc.fontSize(10).font('Helvetica');
    doc.text(`Nom: ${t.first_name} ${t.last_name}`);
    doc.text(`Téléphone: ${t.phone || 'N/A'}`);
    doc.text(`Email: ${t.email || 'N/A'}`);
    doc.text(`Bien: ${t.property_name}`);
    doc.text(`Adresse: ${t.property_address}`);
    doc.text(`Propriétaire: ${t.owner_first_name} ${t.owner_last_name}`);
    doc.moveDown(0.5);

    doc.fontSize(11).font('Helvetica-Bold').text('Situation Financière');
    doc.fontSize(10).font('Helvetica');
    doc.text(`Loyer dû: ${this._formatCurrency(t.amount_due)}`);
    doc.text(`Payé ce mois: ${this._formatCurrency(t.amount_paid)}`);
    doc.text(`Solde: ${this._formatCurrency(data.balance.owed)}`);
    doc.text(`Caution: ${this._formatCurrency(t.deposit)}`);
    doc.text(`Paiement anticipé: ${this._formatCurrency(t.advance_payment)}`);
    doc.moveDown(0.5);

    if (data.transactions && data.transactions.length > 0) {
      doc.fontSize(11).font('Helvetica-Bold').text('Historique des Paiements');
      doc.fontSize(9).font('Helvetica');
      data.transactions.slice(0, 10).forEach(tx => {
        doc.text(`${moment(tx.date).format('DD/MM/YYYY')}: ${this._formatCurrency(tx.amount)} (${tx.method})`);
      });
    }
  }

  _drawOwnerPDF(doc, data) {
    data.owners.forEach((owner, idx) => {
      if (idx > 0) doc.addPage();

      doc.fontSize(12).font('Helvetica-Bold').text('Propriétaire: ' + owner.owner_name);
      doc.fontSize(10).font('Helvetica');
      doc.text(`Téléphone: ${owner.phone || 'N/A'}`);
      doc.text(`Email: ${owner.email || 'N/A'}`);
      doc.text(`Compte bancaire: ${owner.bank_account || 'N/A'}`);
      doc.moveDown(0.3);

      doc.fontSize(11).font('Helvetica-Bold').text('Résumé Financier');
      doc.fontSize(10).text(`Nombre de biens: ${owner.property_count}`);
      doc.text(`Loyers attendus: ${this._formatCurrency(owner.expected_rental_income)}`);
      doc.text(`Total collecté: ${this._formatCurrency(owner.total_received_from_tenants)}`);
      doc.text(`Dû par locataires: ${this._formatCurrency(owner.total_owed_by_tenants)}`);
      doc.moveDown(0.3);

      if (owner.properties && owner.properties.length > 0) {
        doc.fontSize(11).font('Helvetica-Bold').text('Propriétés');
        doc.fontSize(9).font('Helvetica');
        owner.properties.forEach(prop => {
          doc.text(`${prop.name} - ${prop.address} (Loyer: ${this._formatCurrency(prop.rent)})`);
        });
      }
    });
  }

  _drawPropertyPDF(doc, data) {
    doc.fontSize(12).font('Helvetica-Bold').text('Rapport de Biens');
    doc.moveDown(0.3);

    doc.fontSize(11).font('Helvetica-Bold').text('Résumé');
    doc.fontSize(10).font('Helvetica');
    doc.text(`Total de biens: ${data.summary.totalProperties}`);
    doc.text(`Valeur totale: ${this._formatCurrency(data.summary.totalValue)}`);
    doc.text(`Loyer total attendu: ${this._formatCurrency(data.summary.totalRentExpected)}`);
    doc.moveDown(0.3);

    doc.fontSize(11).font('Helvetica-Bold').text('Statut des Biens');
    Object.entries(data.summary.byStatus).forEach(([status, count]) => {
      doc.fontSize(10).text(`${status}: ${count}`);
    });
    doc.moveDown(0.3);

    doc.fontSize(11).font('Helvetica-Bold').text('Liste des Biens');
    doc.fontSize(9).font('Helvetica');
    const maxRows = 20;
    data.properties.slice(0, maxRows).forEach(prop => {
      doc.text(`${prop.name}`);
      doc.text(`  ${prop.address} | Type: ${prop.type} | Status: ${prop.status}`);
      doc.text(`  Propriétaire: ${prop.owner_name} | Locataire: ${prop.tenant_name || 'Vacant'}`);
    });

    if (data.properties.length > maxRows) {
      doc.text(`... et ${data.properties.length - maxRows} autres biens`);
    }
  }

  _drawPrefinancingPDF(doc, data) {
    doc.fontSize(12).font('Helvetica-Bold').text('Rapport Préfinancements');
    doc.moveDown(0.3);

    doc.fontSize(11).font('Helvetica-Bold').text('Résumé');
    doc.fontSize(10).font('Helvetica');
    doc.text(`Total préfinancements: ${data.summary.total}`);
    doc.text(`Montant total: ${this._formatCurrency(data.summary.totalAmount)}`);
    doc.text(`Montant remboursé: ${this._formatCurrency(data.summary.totalRepaid)}`);
    doc.text(`Solde dû: ${this._formatCurrency(data.summary.totalOutstanding)}`);
    doc.moveDown(0.3);

    doc.fontSize(11).font('Helvetica-Bold').text('Détail de Chaque Préfinancement');
    doc.fontSize(9).font('Helvetica');
    data.prefinancings.slice(0, 10).forEach(pf => {
      doc.text(`${pf.reference} - ${pf.owner_name}`);
      doc.text(`  Montant: ${this._formatCurrency(pf.amount)} | Taux: ${pf.interest_rate}% | Statut: ${pf.status}`);
      doc.text(`  Du: ${moment(pf.start_date).format('DD/MM/YYYY')} au ${moment(pf.end_date).format('DD/MM/YYYY')}`);
      doc.text(`  Remboursé: ${this._formatCurrency(pf.amount_repaid)} / ${this._formatCurrency(pf.amount)}`);
    });
  }

  _drawAgentPDF(doc, data) {
    doc.fontSize(12).font('Helvetica-Bold').text('Rapport Agents');
    doc.moveDown(0.3);

    doc.fontSize(11).font('Helvetica-Bold').text('Résumé');
    doc.fontSize(10).font('Helvetica');
    doc.text(`Nombre d'agents: ${data.summary.totalAgents}`);
    doc.text(`Total collecté: ${this._formatCurrency(data.summary.totalCollected)}`);
    doc.text(`Total commissions: ${this._formatCurrency(data.summary.totalCommissions)}`);
    doc.text(`Moyenne par agent: ${this._formatCurrency(data.summary.averagePerAgent)}`);
    doc.moveDown(0.3);

    doc.fontSize(11).font('Helvetica-Bold').text('Performance des Agents');
    doc.fontSize(9).font('Helvetica');
    data.agents.forEach(agent => {
      doc.text(`${agent.agent_name} - Zone: ${agent.zone || 'N/A'}`);
      doc.text(`  Collecté: ${this._formatCurrency(agent.total_collected)} | Commissions: ${this._formatCurrency(agent.commission_earned)}`);
      doc.text(`  Clients actifs: ${agent.active_clients} | Clients assignés: ${agent.clients_assigned}`);
    });
  }

  // ────────────────────────────────────────────────────
  // HELPERS - Utility Functions
  // ────────────────────────────────────────────────────

  _formatCurrency(value) {
    if (!value) return '0 XOF';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0
    }).format(value);
  }

  _groupBy(array, key) {
    return array.reduce((result, item) => {
      const group = item[key] || 'Other';
      if (!result[group]) result[group] = [];
      result[group].push(item);
      return result;
    }, {});
  }

  _groupByCount(array, key) {
    return array.reduce((result, item) => {
      const group = item[key] || 'Other';
      result[group] = (result[group] || 0) + 1;
      return result;
    }, {});
  }
}

module.exports = ReportsService;
