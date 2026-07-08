const BaseController = require('./BaseController');
const TransactionService = require('../services/TransactionService');

class TransactionController extends BaseController {
  constructor() {
    super(TransactionService);
  }

  async getAll(req, res, next) {
    try {
      const { status, method, clientId, dateFrom, dateTo, search, page, limit } = req.query;
      const data = await this.service.getTransactions(
        { status, method, clientId, dateFrom, dateTo, search, page, limit },
        req.user
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getStats(req, res, next) {
    try {
      const { period } = req.query;
      const data = await this.service.getStats(period);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const data = await this.service.createTransaction(req.body, req.user);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new TransactionController();
