/**
 * Module   : Collectors
 * Auteur   : SYGIM Team
 * Créé le  : 2026-06-16
 * Rôle     : Contrôleur pour les récolteurs
 */

const collectorService = require('./collector.service');
const ApiResponse = require('../../utils/responses/ApiResponse');
const { validationResult } = require('express-validator');

class CollectorController {
  async getAll(req, res, next) {
    try {
      const { page, limit, search, active } = req.query;
      const result = await collectorService.getAllCollectors({ search, active }, page, limit, req.user);
      const { data, pagination } = result;
      res.status(200).json(ApiResponse.paginated(data, pagination.page, pagination.limit, pagination.total));
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const result = await collectorService.getCollectorById(req.params.id, req.user);
      res.status(200).json(ApiResponse.success(result));
    } catch (error) {
      next(error);
    }
  }

  async getStats(req, res, next) {
    try {
      const result = await collectorService.getCollectorWithStats(req.params.id, req.user);
      res.status(200).json(ApiResponse.success(result));
    } catch (error) {
      next(error);
    }
  }

  async getByOwner(req, res, next) {
    try {
      const result = await collectorService.getCollectorsByOwner(req.params.ownerId);
      res.status(200).json(ApiResponse.success(result));
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const result = await collectorService.createCollector(req.body);
      res.status(201).json(ApiResponse.created(result, 'Collecteur créé avec succès'));
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const result = await collectorService.updateCollector(req.params.id, req.body, req.user);
      res.status(200).json(ApiResponse.updated(result, 'Collecteur mis à jour avec succès'));
    } catch (error) {
      next(error);
    }
  }

  async assignProperties(req, res, next) {
    try {
      const { propertyIds } = req.body;
      if (!Array.isArray(propertyIds) || propertyIds.length === 0) {
        return res.status(400).json(ApiResponse.error('Liste de propriétés invalide', 400));
      }
      const result = await collectorService.assignProperties(req.params.id, propertyIds, req.user);
      res.status(200).json(ApiResponse.success(result));
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const result = await collectorService.deleteCollector(req.params.id, req.user);
      res.status(200).json(ApiResponse.success(result, 'Collecteur supprimé avec succès'));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CollectorController();
