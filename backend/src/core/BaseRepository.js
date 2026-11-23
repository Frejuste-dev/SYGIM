/**
 * Base Repository - Classe abstraite pour tous les repositories
 * Implémente les opérations CRUD génériques
 */

const Logger = require('../utils/logger/Logger');
const AppError = require('../utils/errors/AppError');
const { pool: db } = require('../config/database');

const IDENTIFIER_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

class BaseRepository {
  constructor(tableName) {
    if (!IDENTIFIER_REGEX.test(tableName)) {
      throw new Error(`Nom de table SQL invalide: ${tableName}`);
    }
    this.tableName = tableName;
  }

  _validateIdentifier(identifier, label = 'colonne') {
    if (!IDENTIFIER_REGEX.test(identifier)) {
      throw AppError.badRequest(`Identifiant de ${label} SQL invalide: ${identifier}`);
    }
    const allowed = Array.isArray(this.allowedColumns || this.fillable)
      ? (this.allowedColumns || this.fillable)
      : null;
    if (allowed && !allowed.includes(identifier)) {
      return false;
    }
    return true;
  }

  _sanitizeFilters(filters = {}) {
    const whereConditions = [];
    const params = [];

    for (const [key, value] of Object.entries(filters || {})) {
      if (value !== undefined && value !== null) {
        if (!this._validateIdentifier(key, 'filtre')) {
          continue;
        }
        whereConditions.push(`\`${key}\` = ?`);
        params.push(value);
      }
    }

    return { whereConditions, params };
  }

  async findAll(filters = {}, limit = 100, offset = 0) {
    try {
      const start = Date.now();
      let query = `SELECT * FROM \`${this.tableName}\``;
      const { whereConditions, params } = this._sanitizeFilters(filters);

      if (whereConditions.length > 0) {
        query += ` WHERE ${whereConditions.join(' AND ')}`;
      }

      query += ' LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const [results] = await db.query(query, params);
      const duration = Date.now() - start;

      Logger.debug(`${this.tableName}.findAll completed`, { duration, count: results.length });
      return results;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      Logger.error(`Error in ${this.tableName}.findAll`, error);
      throw AppError.internal(`Erreur lors de la lecture de ${this.tableName}`);
    }
  }

  async findById(id) {
    try {
      const query = `SELECT * FROM \`${this.tableName}\` WHERE id = ? LIMIT 1`;
      const [results] = await db.query(query, [id]);

      if (results.length === 0) {
        throw AppError.notFound(this.tableName);
      }

      return results[0];
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      Logger.error(`Error in ${this.tableName}.findById`, error);
      throw AppError.internal(`Erreur lors de la lecture de ${this.tableName}`);
    }
  }

  _sanitizeData(data, isUpdate = false) {
    const IDENTIFIER_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    const allowed = Array.isArray(this.allowedColumns || this.fillable)
      ? (this.allowedColumns || this.fillable)
      : null;

    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      if (!IDENTIFIER_REGEX.test(key)) {
        throw AppError.badRequest(`Identifiant de colonne SQL invalide: ${key}`);
      }
      if (isUpdate && (key === 'id' || key === 'created_at')) {
        continue;
      }
      if (allowed && !allowed.includes(key)) {
        continue;
      }
      sanitized[key] = value;
    }

    if (Object.keys(sanitized).length === 0) {
      throw AppError.badRequest('Aucune donnée valide à enregistrer');
    }

    return sanitized;
  }

  async create(data) {
    try {
      const sanitized = this._sanitizeData(data, false);
      const keys = Object.keys(sanitized);
      const columns = keys.map(k => `\`${k}\``).join(',');
      const placeholders = keys.map(() => '?').join(',');
      const query = `INSERT INTO \`${this.tableName}\` (${columns}) VALUES (${placeholders})`;

      const [result] = await db.query(query, Object.values(sanitized));

      return {
        id: result.insertId,
        ...sanitized
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error(`Error in ${this.tableName}.create`, error);
      if (error.code === 'ER_DUP_ENTRY') {
        throw AppError.conflict('Enregistrement dupliqué');
      }
      throw AppError.internal('Erreur lors de la création');
    }
  }

  async update(id, data) {
    try {
      const sanitized = this._sanitizeData(data, true);
      const keys = Object.keys(sanitized);
      const updates = keys.map(k => `\`${k}\` = ?`).join(',');
      const query = `UPDATE \`${this.tableName}\` SET ${updates} WHERE id = ?`;
      const params = [...Object.values(sanitized), id];

      const [result] = await db.query(query, params);

      if (result.affectedRows === 0) {
        throw AppError.notFound(this.tableName);
      }

      return { id, ...sanitized };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      Logger.error(`Error in ${this.tableName}.update`, error);
      throw AppError.internal('Erreur lors de la mise à jour');
    }
  }

  async delete(id) {
    try {
      const query = `DELETE FROM \`${this.tableName}\` WHERE id = ?`;
      const [result] = await db.query(query, [id]);

      if (result.affectedRows === 0) {
        throw AppError.notFound(this.tableName);
      }

      return { success: true, id };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      Logger.error(`Error in ${this.tableName}.delete`, error);
      throw AppError.internal('Erreur lors de la suppression');
    }
  }

  async count(filters = {}) {
    try {
      let query = `SELECT COUNT(*) as total FROM \`${this.tableName}\``;
      const { whereConditions, params } = this._sanitizeFilters(filters);

      if (whereConditions.length > 0) {
        query += ` WHERE ${whereConditions.join(' AND ')}`;
      }

      const [results] = await db.query(query, params);
      return results[0].total;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      Logger.error(`Error in ${this.tableName}.count`, error);
      throw AppError.internal('Erreur lors du comptage');
    }
  }
}

module.exports = BaseRepository;
