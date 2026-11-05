const bcrypt = require('bcryptjs');
const BaseService = require('../../core/BaseService');
const UserRepository = require('./user.repository');
const AppError = require('../../utils/errors/AppError');

class UserService extends BaseService {
  constructor() {
    super(UserRepository);
  }

  async create(data, requestingUser) {
    // Whitelist stricte des champs autorisés pour la création
    const allowedFields = ['username', 'email', 'password', 'role', 'active'];
    const filteredData = {};

    Object.keys(data).forEach(key => {
      if (allowedFields.includes(key)) {
        filteredData[key] = data[key];
      }
    });

    if (!filteredData.password || filteredData.password.length < 8) {
      throw AppError.validation('Le mot de passe doit contenir au moins 8 caractères.', 'password');
    }

    // Validation du rôle
    const validRoles = ['admin', 'director', 'accounting', 'collector_manager', 'collector'];
    if (filteredData.role && !validRoles.includes(filteredData.role)) {
      throw AppError.badRequest('Rôle invalide.');
    }

    // Seul un admin ou director peut créer un utilisateur avec privilèges élevés
    if (filteredData.role && ['admin', 'director', 'accounting', 'collector_manager'].includes(filteredData.role)) {
      if (!requestingUser || !['admin', 'director'].includes(requestingUser.role)) {
        throw AppError.forbidden('Privilèges insuffisants pour créer cet utilisateur.');
      }
    }

    // Si aucun rôle n'est spécifié, on force à 'collector'
    filteredData.role = filteredData.role || 'collector';

    filteredData.password_hash = await bcrypt.hash(filteredData.password, 12);
    delete filteredData.password;
    
    return super.create(filteredData, requestingUser);
  }

  async update(id, data, requestingUser) {
    // Whitelist stricte des champs autorisés pour la modification (pas de password_hash)
    const allowedFields = ['username', 'email', 'role', 'active'];
    const filteredData = {};

    Object.keys(data).forEach(key => {
      if (allowedFields.includes(key)) {
        filteredData[key] = data[key];
      }
    });

    // S'il n'y a aucune donnée valide à mettre à jour, on rejette
    if (Object.keys(filteredData).length === 0) {
      throw AppError.badRequest('Aucun champ valide à mettre à jour.');
    }

    // Validation et autorisation si modification du rôle ou active
    if (filteredData.role || filteredData.active !== undefined) {
      if (!requestingUser || requestingUser.role !== 'admin') {
        throw AppError.forbidden('Privilèges insuffisants pour modifier le rôle ou le statut.');
      }
    }

    const validRoles = ['admin', 'director', 'accounting', 'collector_manager', 'collector'];
    if (filteredData.role && !validRoles.includes(filteredData.role)) {
      throw AppError.badRequest('Rôle invalide.');
    }

    return super.update(id, filteredData, requestingUser);
  }
}

module.exports = new UserService();
