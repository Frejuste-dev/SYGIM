/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║           SYGIM — Routes Gestion des Propriétaires              ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

const express = require('express');
const router  = express.Router();
const { pool }       = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// ─── GET /api/owners ───────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const { search } = req.query;
        let sql = 'SELECT * FROM owners WHERE 1=1';
        const params = [];

        if (search) {
            sql += ' AND (first_name LIKE ? OR last_name LIKE ? OR phone LIKE ? OR email LIKE ?)';
            const s = `%${search}%`;
            params.push(s, s, s, s);
        }

        sql += ' ORDER BY created_at DESC';

        const [rows] = await pool.query(sql, params);
        res.json({ success: true, data: rows });

    } catch (err) {
        console.error('Erreur GET /owners :', err);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// ─── GET /api/owners/:id ─ Avec propriétés associées ───────────
router.get('/:id', async (req, res) => {
    try {
        const [ownerRows] = await pool.query('SELECT * FROM owners WHERE id = ?', [req.params.id]);
        if (ownerRows.length === 0) {
            return res.status(404).json({ success: false, error: 'Propriétaire non trouvé' });
        }

        // Récupérer ses propriétés
        const [properties] = await pool.query(
            'SELECT * FROM properties WHERE owner_id = ? ORDER BY name',
            [req.params.id]
        );

        res.json({
            success: true,
            data: { ...ownerRows[0], properties }
        });

    } catch (err) {
        console.error('Erreur GET /owners/:id :', err);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// ─── POST /api/owners ──────────────────────────────────────────
router.post('/', authorize('admin', 'director', 'collector_manager', 'accounting'), async (req, res) => {
    try {
        const {
            firstName, lastName, displayName, phone, email,
            address, idNumber, bankName, bankAccount, notes
        } = req.body;

        if (!lastName) {
            return res.status(400).json({
                success: false,
                error: 'Le nom est requis'
            });
        }

        const [result] = await pool.query(
            `INSERT INTO owners 
             (first_name, last_name, display_name, phone, email, address, id_number, bank_name, bank_account, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                firstName || '', lastName,
                displayName || `${firstName || ''} ${lastName}`.trim(),
                phone || null, email || null,
                address || null, idNumber || null,
                bankName || null, bankAccount || null,
                notes || null
            ]
        );

        res.status(201).json({
            success: true,
            data: { id: result.insertId, lastName, firstName }
        });

    } catch (err) {
        console.error('Erreur POST /owners :', err);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// ─── PUT /api/owners/:id ───────────────────────────────────────
router.put('/:id', authorize('admin', 'director', 'collector_manager', 'accounting'), async (req, res) => {
    try {
        const fields = [];
        const values = [];
        const fieldMap = {
            firstName:   'first_name',
            lastName:    'last_name',
            displayName: 'display_name',
            phone:       'phone',
            email:       'email',
            address:     'address',
            idNumber:    'id_number',
            bankName:    'bank_name',
            bankAccount: 'bank_account',
            notes:       'notes',
            active:      'active'
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
        await pool.query(`UPDATE owners SET ${fields.join(', ')} WHERE id = ?`, values);

        res.json({ success: true, message: 'Propriétaire modifié avec succès' });

    } catch (err) {
        console.error('Erreur PUT /owners/:id :', err);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// ─── DELETE /api/owners/:id ────────────────────────────────────
router.delete('/:id', authorize('admin', 'director', 'collector_manager'), async (req, res) => {
    try {
        // Décrocher les propriétés
        await pool.query('UPDATE properties SET owner_id = NULL WHERE owner_id = ?', [req.params.id]);

        const [result] = await pool.query('DELETE FROM owners WHERE id = ?', [req.params.id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'Propriétaire non trouvé' });
        }

        res.json({ success: true, message: 'Propriétaire supprimé avec succès' });

    } catch (err) {
        console.error('Erreur DELETE /owners/:id :', err);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

module.exports = router;
