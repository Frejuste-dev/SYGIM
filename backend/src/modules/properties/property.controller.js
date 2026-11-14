const BaseController = require('../../core/BaseController');
const PropertyService = require('./property.service');
const ApiResponse = require('../../utils/responses/ApiResponse');

class PropertyController extends BaseController {
  constructor() {
    super(PropertyService);
  }

  async getAll(req, res, next) {
    try {
      const { status, type, ownerId, search, page, limit, assignmentStatus, zone } = req.query;
      const result = await this.service.getProperties(
        { status, type, ownerId, search, page, limit, assignmentStatus, zone }
      );
      const { data, pagination } = result;
      res.json(ApiResponse.paginated(data, pagination.page, pagination.limit, pagination.total));
    } catch (error) {
      next(error);
    }
  }

  async getStats(req, res, next) {
    try {
      const { status, type, ownerId, search, assignmentStatus, zone } = req.query;
      const data = await this.service.getStats({ status, type, ownerId, search, assignmentStatus, zone });
      res.json(ApiResponse.success(data));
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const data = await this.service.getPropertyDetails(req.params.id);
      res.json(ApiResponse.success(data));
    } catch (error) {
      next(error);
    }
  }

  async assignTenant(req, res, next) {
    try {
      const data = await this.service.assignTenant(req.params.id, req.body, req.user);
      res.json(ApiResponse.success(data, 'Bien attribué avec succès au locataire'));
    } catch (error) {
      next(error);
    }
  }

  async assignOwner(req, res, next) {
    try {
      const { owner_id, notes } = req.body;
      const data = await this.service.assignOwner(req.params.id, owner_id, req.user, notes);
      return ApiResponse.success(res, data, 'Bien immobilier attribué avec succès au propriétaire');
    } catch (error) {
      next(error);
    }
  }

  async reassignOwner(req, res, next) {
    try {
      const { new_owner_id, notes } = req.body;
      const data = await this.service.reassignOwner(req.params.id, new_owner_id, req.user, notes);
      return ApiResponse.success(res, data, 'Bien immobilier réattribué avec succès');
    } catch (error) {
      next(error);
    }
  }

  async getAssignments(req, res, next) {
    try {
      const result = await this.service.getAssignments(req.query);
      return ApiResponse.success(res, result.data, 'Liste des attributions récupérée', 200, result.pagination);
    } catch (error) {
      next(error);
    }
  }

  async getAssignmentHistory(req, res, next) {
    try {
      const data = await this.service.getAssignmentHistory(req.query);
      return ApiResponse.success(res, data, 'Historique des attributions récupéré');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PropertyController();
