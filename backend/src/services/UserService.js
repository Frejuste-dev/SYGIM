const BaseService = require('./BaseService');
const UserRepository = require('../repositories/UserRepository');

class UserService extends BaseService {
  constructor() {
    super(UserRepository);
  }

  // Add user-specific business logic here if needed
}

module.exports = new UserService();
