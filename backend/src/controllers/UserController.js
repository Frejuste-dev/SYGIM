const BaseController = require('./BaseController');
const UserService = require('../services/UserService');

class UserController extends BaseController {
  constructor() {
    super(UserService);
  }
}

module.exports = new UserController();
