/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║           SYGIM — Routes Gestion des Propriétés                 ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

const express = require('express');
const router  = express.Router();
const { pool }       = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// ─── GET /api/properties ─ Liste avec filtrage ─────────────────
router.get('/', async (req, res) => {
    try {
        const { status, type, ownerId, search, page = 1, limit = 50 } = req.query;
        let sql = `SELECT p.*, o.first_name AS owner_first_name, o.last_name AS owner_last_name
                    FROM properties p
                    LEFT JOIN owners o ON p.owner_id = o.id
                    WHERE 1=1`;
        const params = [];

        if (status && status !== 'all') {
            sql += ' AND p.status = ?';
            params.push(status);
        }

        if (type && type !== 'all') {
            sql += ' AND p.type = ?';
            params.push(type);
        }

        if (ownerId) {
            sql += ' AND p.owner_id = ?';
            params.push(ownerId);
        }

        if (search) {
            sql += ' AND (p.name LIKE ? OR p.address LIKE ?)';
            const s = `%${search}%`;
            params.push(s, s);
        }

        sql += ' ORDER BY p.created_at DESC';

        const offset = (parseInt(page) - 1) * parseInt(limit);
        sql += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const [rows] = await pool.query(sql, params);

        res.json({ success: true, data: rows });

    } catch (err) {
        console.error('Erreur GET /properties :', err);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// ─── GET /api/properties/stats ─ Statistiques ──────────────────
router.get('/stats', async (req, res) => {
    try {
        const [total]   = await pool.query('SELECT COUNT(*) as count FROM properties');
        const [vacant]  = await pool.query("SELECT COUNT(*) as count FROM properties WHERE status = 'vacant'");
        const [loue]    = await pool.query("SELECT COUNT(*) as count FROM properties WHERE status = 'loue'");
        const [renov]   = await pool.query("SELECT COUNT(*) as count FROM properties WHERE status = 'en_renovation'");
        const [sumVal]  = await pool.query('SELECT COALESCE(SUM(value), 0) as total FROM properties');
        const [sumRent] = await pool.query("SELECT COALESCE(SUM(rent), 0) as total FROM properties WHERE status = 'loue'");

        res.json({
            success: true,
            data: {
                total:        total[0].count,
                vacant:       vacant[0].count,
                loue:         loue[0].count,
                en_renovation: renov[0].count,
                totalValue:   sumVal[0].total,
                totalRent:    sumRent[0].total
            }
        });
    } catch (err) {
        console.error('Erreur GET /properties/stats :', err);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// ─── GET /api/properties/:id ───────────────────────────────────
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT p.*, o.first_name AS owner_first_name, o.last_name AS owner_last_name,
                    c.first_name AS tenant_first_name, c.last_name AS tenant_last_name
             FROM properties p
             LEFT JOIN owners o ON p.owner_id = o.id
             LEFT JOIN clients c ON p.tenant_id = c.id
             WHERE p.id = ?`,
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Propriété non trouvée' });
        }

        res.json({ success: true, data: rows[0] });

    } catch (err) {
        console.error('Erreur GET /properties/:id :', err);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// ─── POST /api/properties ──────────────────────────────────────
router.post('/', authorize('admin', 'director', 'collector_manager', 'accounting'), async (req, res) => {
    try {
        const {
            name, address, type, status, value, rent,
            area, rooms, description, imageUrl, ownerId, collectorId
        } = req.body;

        if (!name || !address) {
            return res.status(400).json({
                success: false,
                error: 'Nom et adresse sont requis'
            });
        }

        const [result] = await pool.query(
            `INSERT INTO properties 
             (name, address, type, status, value, rent, area, rooms, description, image_url, owner_id, collector_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                name, address,
                type || 'appartement',
                status || 'vacant',
                value || 0,
                rent || 0,
                area || null,
                rooms || null,
                description || null,
                imageUrl || null,
                ownerId || null,
                collectorId || null
            ]
        );

        res.status(201).json({
            success: true,
            data: { id: result.insertId, name, address }
        });

    } catch (err) {
        console.error('Erreur POST /properties :', err);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// ─── PUT /api/properties/:id ───────────────────────────────────
router.put('/:id', authorize('admin', 'director', 'collector_manager', 'accounting'), async (req, res) => {
    try {
        const fields = [];
        const values = [];
        const fieldMap = {
            name:        'name',
            address:     'address',
            type:        'type',
            status:      'status',
            value:       'value',
            rent:        'rent',
            area:        'area',
            rooms:       'rooms',
            description: 'description',
            imageUrl:    'image_url',
            ownerId:     'owner_id',
            tenantId:    'tenant_id',
            collectorId: 'collector_id'
        };

        for (const [key, col] of Object.entries(fieldMap)) {
            if (req.body[key] !== undefined) {
                fields.push(`${col} = ?`);
                values.push(req.body[key]);
            }
        }

        if (fields.length === 0) {
            return res.status(400).json({ success: false, error: 'Aucun champ à modifier' });
        }

        values.push(req.params.id);
        await pool.query(`UPDATE properties SET ${fields.join(', ')} WHERE id = ?`, values);

        res.json({ success: true, message: 'Propriété modifiée avec succès' });

    } catch (err) {
        console.error('Erreur PUT /properties/:id :', err);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// ─── DELETE /api/properties/:id ────────────────────────────────
router.delete('/:id', authorize('admin', 'director', 'collector_manager'), async (req, res) => {
    try {
        const [result] = await pool.query('DELETE FROM properties WHERE id = ?', [req.params.id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'Propriété non trouvée' });
        }

        res.json({ success: true, message: 'Propriété supprimée avec succès' });

    } catch (err) {
        console.error('Erreur DELETE /properties/:id :', err);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

module.exports = router;
