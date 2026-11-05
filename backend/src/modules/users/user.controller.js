const BaseController = require('../../core/BaseController');
const UserService = require('./user.service');
const ApiResponse = require('../../utils/responses/ApiResponse');

class UserController extends BaseController {
  constructor() {
    super(UserService);
  }

  async activate(req, res, next) {
    try {
      const { id } = req.params;
      const data = await this.service.update(id, { active: 1 }, req.user);
      res.status(200).json(ApiResponse.success(data));
    } catch (error) {
      next(error);
    }
  }

  async deactivate(req, res, next) {
    try {
      const { id } = req.params;
      const data = await this.service.update(id, { active: 0 }, req.user);
      res.status(200).json(ApiResponse.success(data));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UserController();
