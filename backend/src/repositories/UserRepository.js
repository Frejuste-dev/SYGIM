const BaseRepository = require('./BaseRepository');

class UserRepository extends BaseRepository {
  constructor() {
    super('users');
  }

  // Add user-specific queries here if needed
}

module.exports = new UserRepository();
