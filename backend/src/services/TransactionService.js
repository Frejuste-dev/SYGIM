const BaseService = require('./BaseService');
const TransactionRepository = require('../repositories/TransactionRepository');
const { validateAmount } = require('../../utils/validators');

class TransactionService extends BaseService {
  constructor() {
    super(TransactionRepository);
  }

  async getTransactions(filters, user) {
    return await this.repository.findAll(filters, user);
  }

  async getStats(period) {
    return await this.repository.getStats(period);
  }

  async createTransaction(data, user) {
    // Validation
    if (!data.amount) throw new Error('Le montant est requis');
    if (!validateAmount(data.amount)) throw new Error('Montant invalide');
    if (!data.clientId) throw new Error('Une transaction DOIT être liée à un client');
    
    // Check client existence (simplification: let repo throw or check here)
    const { pool } = require('../../config/db');
    const [clientCheck] = await pool.query('SELECT id FROM clients WHERE id = ?', [data.clientId]);
    if (clientCheck.length === 0) throw new Error(`Client ${data.clientId} inexistant`);

    return await this.repository.createWithClientUpdate(data, user);
  }
}

module.exports = new TransactionService();
