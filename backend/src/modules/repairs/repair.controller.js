const repairRepository = require('./repair.repository');
const ApiResponse = require('../../utils/responses/ApiResponse');
const AppError = require('../../utils/errors/AppError');

class RepairController {
  async getAll(req, res, next) {
    try {
      const filters = {
        clientId: req.query.clientId,
        propertyId: req.query.propertyId,
        collectorId: req.query.collectorId,
        status: req.query.status,
        search: req.query.search
      };

      if (req.user?.role === 'collector') {
        const CollectorRepository = require('../collectors/collector.repository');
        const col = await CollectorRepository.findByUserId(req.user.id);
        if (col) {
          filters.collectorId = col.id;
        }
      }

      const rows = await repairRepository.findAll(filters);
      res.json(ApiResponse.success(rows));
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const { clientId, description, totalCost } = req.body;
      if (!clientId || !description || !totalCost || parseFloat(totalCost) <= 0) {
        throw AppError.badRequest('Client, description et coût total valide (> 0) sont requis');
      }

      let collectorId = req.body.collectorId;
      if (req.user?.role === 'collector') {
        const CollectorRepository = require('../collectors/collector.repository');
        const col = await CollectorRepository.findByUserId(req.user.id);
        if (col) collectorId = col.id;
      }

      const repair = await repairRepository.create({
        ...req.body,
        collectorId
      });

      res.status(201).json(ApiResponse.created(repair, 'Dépense de réparation enregistrée avec succès'));
    } catch (err) {
      next(err);
    }
  }

  async settle(req, res, next) {
    try {
      const { id } = req.params;
      const existing = await repairRepository.findById(id);
      if (!existing) throw AppError.notFound('Réparation introuvable');

      const updated = await repairRepository.update(id, {
        status: 'SETTLED',
        reimbursed_amount: existing.total_cost,
        remaining_amount: 0,
        notes: req.body.notes || 'Soldé manuellement'
      });

      res.json(ApiResponse.success(updated, 'Réparation soldée avec succès'));
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new RepairController();
