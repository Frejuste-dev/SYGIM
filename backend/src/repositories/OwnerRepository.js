const BaseRepository = require('./BaseRepository');
const { pool } = require('../../config/db');

class OwnerRepository extends BaseRepository {
  constructor() {
    super('owners');
  }

  async findAll(filters = {}) {
    let sql = 'SELECT * FROM owners WHERE 1=1';
    const params = [];

    if (filters.search) {
      sql += ' AND (first_name LIKE ? OR last_name LIKE ? OR phone LIKE ? OR email LIKE ?)';
      const s = `%${filters.search}%`;
      params.push(s, s, s, s);
    }

    sql += ' ORDER BY created_at DESC';

    const [rows] = await pool.query(sql, params);
    return rows;
  }

  async findByIdWithProperties(id) {
    const [ownerRows] = await pool.query('SELECT * FROM owners WHERE id = ?', [id]);
    if (ownerRows.length === 0) return null;

    const [properties] = await pool.query(
      'SELECT * FROM properties WHERE owner_id = ? ORDER BY name',
      [id]
    );

    return { ...ownerRows[0], properties };
  }
}

module.exports = new OwnerRepository();
