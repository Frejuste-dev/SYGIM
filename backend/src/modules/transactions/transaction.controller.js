const BaseController = require('../../core/BaseController');
const TransactionService = require('./transaction.service');
const ApiResponse = require('../../utils/responses/ApiResponse');

class TransactionController extends BaseController {
  constructor() {
    super(TransactionService);
  }

  async getAll(req, res, next) {
    try {
      const { status, method, clientId, dateFrom, dateTo, search, page, limit } = req.query;
      const result = await this.service.getTransactions(
        { status, method, clientId, dateFrom, dateTo, search, page, limit },
        req.user
      );
      const { data, pagination } = result;
      res.json(ApiResponse.paginated(data, pagination.page, pagination.limit, pagination.total));
    } catch (error) {
      next(error);
    }
  }

  async getStats(req, res, next) {
    try {
      const { status, method, clientId, dateFrom, dateTo, search, period } = req.query;
      const data = await this.service.getStats({ status, method, clientId, dateFrom, dateTo, search, period }, req.user);
      res.json(ApiResponse.success(data));
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const data = await this.service.createTransaction(req.body, req.user);
      res.status(201).json(ApiResponse.created(data));
    } catch (error) {
      next(error);
    }
  }

  async exportCSV(req, res, next) {
    try {
      const { status, method, clientId, dateFrom, dateTo, search } = req.query;
      const data = await this.service.getTransactions(
        { status, method, clientId, dateFrom, dateTo, search, page: 1, limit: 10000 },
        req.user
      );
      const rows = data?.data || [];

      const headers = ['Référence', 'Date', 'Client', 'Description', 'Montant (XOF)', 'Moyen', 'Statut'];
      const csvRows = [headers.join(';')];

      const methodLabels = { cash: 'Espèces', mobile_money: 'Mobile Money', bank_transfer: 'Virement', check: 'Chèque', card: 'Carte' };
      const statusLabels = { processed: 'Traité', pending: 'En attente', cancelled: 'Annulé', refunded: 'Remboursé' };

      for (const tx of rows) {
        csvRows.push([
          tx.reference || '',
          tx.date || '',
          (tx.client_name || '').replace(/;/g, ','),
          ((tx.description || '').replace(/;/g, ',')),
          tx.amount || 0,
          methodLabels[tx.method] || tx.method || '',
          statusLabels[tx.status] || tx.status || ''
        ].join(';'));
      }

      const csv = '\uFEFF' + csvRows.join('\r\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=transactions_${new Date().toISOString().slice(0, 10)}.csv`);
      res.send(csv);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new TransactionController();
