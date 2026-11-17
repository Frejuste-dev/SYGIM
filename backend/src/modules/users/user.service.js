const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const BaseService = require('../../core/BaseService');
const UserRepository = require('./user.repository');
const AppError = require('../../utils/errors/AppError');

const VALID_ROLES = ['admin', 'super_admin', 'director', 'manager', 'collector_manager', 'accounting', 'collector', 'owner'];

class UserService extends BaseService {
  constructor() {
    super(UserRepository);
  }

  _normalizePayload(data) {
    const mapped = {};
    if (data.username !== undefined) {
      mapped.username = String(data.username).trim();
    }
    if (data.email !== undefined) mapped.email = data.email ? String(data.email).trim() : null;
    if (data.phone !== undefined) mapped.phone = data.phone ? String(data.phone).trim() : null;
    if (data.role !== undefined) mapped.role = data.role;

    if (data.firstName !== undefined || data.first_name !== undefined) {
      mapped.first_name = String(data.firstName ?? data.first_name ?? '').trim();
    }
    if (data.lastName !== undefined || data.last_name !== undefined) {
      mapped.last_name = String(data.lastName ?? data.last_name ?? '').trim();
    }
    if (data.displayName !== undefined || data.display_name !== undefined || data.name !== undefined) {
      const fullName = String(data.displayName ?? data.display_name ?? data.name ?? '').trim();
      mapped.display_name = fullName;
      if (mapped.first_name === undefined && mapped.last_name === undefined && fullName) {
        const parts = fullName.split(/\s+/);
        mapped.first_name = parts[0] || '';
        mapped.last_name = parts.slice(1).join(' ') || '';
      }
    } else if (mapped.first_name !== undefined || mapped.last_name !== undefined) {
      const combined = [mapped.first_name, mapped.last_name].filter(Boolean).join(' ').trim();
      if (combined) mapped.display_name = combined;
    }

    if (data.active !== undefined) {
      mapped.active = (data.active === true || data.active === 1 || data.active === '1') ? 1 : 0;
    } else if (data.is_active !== undefined) {
      mapped.active = (data.is_active === true || data.is_active === 1 || data.is_active === '1') ? 1 : 0;
    } else if (data.status !== undefined) {
      mapped.active = (data.status === 'active' || data.status === 1 || data.status === true) ? 1 : 0;
    }

    if (data.password !== undefined) {
      mapped.password = data.password;
    }

    return mapped;
  }

  async create(data, requestingUser) {
    const filteredData = this._normalizePayload(data);

    if (!filteredData.password || filteredData.password.length < 8 || !/[A-Za-z]/.test(filteredData.password) || !/[0-9]/.test(filteredData.password)) {
      throw AppError.validation('Le mot de passe doit contenir au moins 8 caractères avec lettres et chiffres (SEC-07).', 'password');
    }

    if (filteredData.role && !VALID_ROLES.includes(filteredData.role)) {
      throw AppError.badRequest('Rôle invalide.');
    }

    // Seul un admin, super_admin ou director peut créer un utilisateur avec privilèges élevés
    if (filteredData.role && ['admin', 'super_admin', 'director', 'manager', 'accounting', 'collector_manager'].includes(filteredData.role)) {
      if (!requestingUser || !['admin', 'super_admin', 'director'].includes(requestingUser.role)) {
        throw AppError.forbidden('Privilèges insuffisants pour créer cet utilisateur.');
      }
    }

    filteredData.role = filteredData.role || 'collector';
    filteredData.active = filteredData.active !== undefined ? filteredData.active : 1;

    filteredData.password_hash = await bcrypt.hash(filteredData.password, 12);
    delete filteredData.password;

    const created = await super.create(filteredData, requestingUser);
    if (created && created.password_hash) {
      delete created.password_hash;
    }
    return created;
  }

  async update(id, data, requestingUser) {
    const filteredData = this._normalizePayload(data);
    // Ne jamais modifier le mot de passe directement via update générique
    delete filteredData.password;

    if (Object.keys(filteredData).length === 0) {
      throw AppError.badRequest('Aucun champ valide à mettre à jour.');
    }

    if (!requestingUser || !['admin', 'super_admin'].includes(requestingUser.role)) {
      throw AppError.forbidden('Privilèges insuffisants pour modifier cet utilisateur.');
    }

    if (filteredData.role && !VALID_ROLES.includes(filteredData.role)) {
      throw AppError.badRequest('Rôle invalide.');
    }

    // Empêcher un admin de désactiver ou rétrograder son propre compte
    if (Number(id) === Number(requestingUser.id)) {
      if (filteredData.active === 0) {
        throw AppError.badRequest('Vous ne pouvez pas désactiver votre propre compte.');
      }
      if (filteredData.role && filteredData.role !== requestingUser.role) {
        throw AppError.badRequest('Vous ne pouvez pas modifier votre propre rôle.');
      }
    }

    const updated = await super.update(id, filteredData, requestingUser);
    if (updated && updated.password_hash) {
      delete updated.password_hash;
    }
    return updated;
  }

  async resetPassword(id, { password, autoGenerate } = {}, requestingUser) {
    if (!requestingUser || !['admin', 'super_admin'].includes(requestingUser.role)) {
      throw AppError.forbidden('Privilèges insuffisants pour réinitialiser le mot de passe.');
    }

    const existingUser = await this.repository.findById(id);
    if (!existingUser) {
      throw AppError.notFound('Utilisateur');
    }

    const shouldAutoGenerate = Boolean(autoGenerate) || !password;
    let plainPassword = password;

    if (shouldAutoGenerate) {
      const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase();
      plainPassword = `Sygim@2026#${randomPart}`;
    } else {
      if (plainPassword.length < 8 || !/[A-Za-z]/.test(plainPassword) || !/[0-9]/.test(plainPassword)) {
        throw AppError.validation('Le mot de passe doit contenir au moins 8 caractères avec lettres et chiffres (SEC-07).', 'password');
      }
    }

    const password_hash = await bcrypt.hash(plainPassword, 12);
    await this.repository.update(id, { password_hash });
    await this.repository.revokeUserRefreshTokens(id);

    return {
      userId: Number(id),
      username: existingUser.username,
      autoGenerated: shouldAutoGenerate,
      temporaryPassword: shouldAutoGenerate ? plainPassword : null
    };
  }
}

module.exports = new UserService();
