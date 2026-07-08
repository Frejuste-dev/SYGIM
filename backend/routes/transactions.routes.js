/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║           SYGIM — Routes Gestion des Transactions               ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

const express = require('express');
const router  = express.Router();
const { pool }       = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { validateAmount } = require('../utils/validators');

router.use(authenticate);

// ─── GET /api/transactions ─ Liste avec filtrage ───────────────
router.get('/', async (req, res) => {
    try {
        const { status, method, clientId, dateFrom, dateTo, search, page = 1, limit = 50 } = req.query;
        let sql = 'SELECT * FROM transactions WHERE 1=1';
        const params = [];

        if (status && status !== 'all') {
            sql += ' AND status = ?';
            params.push(status);
        }

        if (method && method !== 'all') {
            sql += ' AND method = ?';
            params.push(method);
        }

        if (clientId) {
            sql += ' AND client_id = ?';
            params.push(clientId);
        }

        if (dateFrom) {
            sql += ' AND date >= ?';
            params.push(dateFrom);
        }

        if (dateTo) {
            sql += ' AND date <= ?';
            params.push(dateTo);
        }

        if (search) {
            sql += ' AND (client_name LIKE ? OR reference LIKE ? OR description LIKE ?)';
            const s = `%${search}%`;
            params.push(s, s, s);
        }

        // Récolteur : ne voit que ses transactions
        if (req.user.role === 'collector') {
            const [userRow] = await pool.query('SELECT id FROM collectors WHERE user_id = ?', [req.user.id]);
            if (userRow.length > 0) {
                sql += ' AND collector_id = ?';
                params.push(userRow[0].id);
            }
        }

        sql += ' ORDER BY date DESC, created_at DESC';

        const offset = (parseInt(page) - 1) * parseInt(limit);
        sql += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const [rows] = await pool.query(sql, params);

        res.json({ success: true, data: rows });

    } catch (err) {
        console.error('Erreur GET /transactions :', err);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// ─── GET /api/transactions/stats ─ Rapports financiers ─────────
router.get('/stats', async (req, res) => {
    try {
        const { period } = req.query; // 'day', 'month', 'year'
        let dateFilter = '';

        if (period === 'day') {
            dateFilter = 'AND date = CURDATE()';
        } else if (period === 'month') {
            dateFilter = 'AND MONTH(date) = MONTH(CURDATE()) AND YEAR(date) = YEAR(CURDATE())';
        } else if (period === 'year') {
            dateFilter = 'AND YEAR(date) = YEAR(CURDATE())';
        }

        const [totalCollected] = await pool.query(
            `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE status = 'processed' ${dateFilter}`
        );

        const [totalPending] = await pool.query(
            `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE status = 'pending' ${dateFilter}`
        );

        const [countByMethod] = await pool.query(
            `SELECT method, COUNT(*) as count, COALESCE(SUM(amount), 0) as total 
             FROM transactions WHERE status = 'processed' ${dateFilter}
             GROUP BY method`
        );

        const [recentTransactions] = await pool.query(
            `SELECT * FROM transactions ORDER BY created_at DESC LIMIT 10`
        );

        res.json({
            success: true,
            data: {
                totalCollected: totalCollected[0].total,
                totalPending:   totalPending[0].total,
                byMethod:       countByMethod,
                recent:         recentTransactions
            }
        });

    } catch (err) {
        console.error('Erreur GET /transactions/stats :', err);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// ─── GET /api/transactions/:id ─────────────────────────────────
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM transactions WHERE id = ?', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Transaction non trouvée' });
        }
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        console.error('Erreur GET /transactions/:id :', err);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// ─── POST /api/transactions ─ Enregistrer un paiement ──────────
router.post('/', authorize('admin', 'director', 'accounting', 'collector_manager', 'collector'), async (req, res) => {
    let connection;
    try {
        const {
            clientId, clientName, description, amount,
            method, reference, status, paymentType,
            dueDate, notes, collectorId, signatureData
        } = req.body;

        // Auto-résolution du collector_id pour un récolteur connecté
        let resolvedCollectorId = collectorId || null;
        if (req.user.role === 'collector' && !resolvedCollectorId) {
            const [collectorRow] = await pool.query('SELECT id FROM collectors WHERE user_id = ?', [req.user.id]);
            if (collectorRow.length > 0) {
                resolvedCollectorId = collectorRow[0].id;
            }
        }

        // ✅ VALIDATION 1 : Le montant est requis
        if (!amount) {
            return res.status(400).json({
                success: false,
                error: 'Le montant est requis'
            });
        }

        // ✅ VALIDATION 2 : Format et valeur du montant
        if (!validateAmount(amount)) {
            return res.status(400).json({
                success: false,
                error: 'Montant invalide (doit être > 0 et <= 999,999,999.99)'
            });
        }

        // ✅ VALIDATION 3 : Un client DOIT être assigné (nouvelle règle)
        if (!clientId) {
            return res.status(400).json({
                success: false,
                error: 'Une transaction DOIT être liée à un client'
            });
        }

        // ✅ VALIDATION 4 : Vérifier que le client existe
        const [clientCheck] = await pool.query('SELECT id FROM clients WHERE id = ?', [clientId]);
        if (clientCheck.length === 0) {
            return res.status(400).json({
                success: false,
                error: `Client ${clientId} inexistant`
            });
        }

        const ref = reference || `REC-${Date.now()}`;
        const dateDisplay = new Date().toLocaleDateString('fr-FR');

        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [result] = await connection.query(
            `INSERT INTO transactions 
             (reference, date, date_display, client_id, client_name, description, amount,
              method, status, payment_type, due_date, notes, collector_id, signature_data)
             VALUES (?, CURDATE(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                ref, dateDisplay,
                clientId,  // ✅ Maintenant obligatoire
                clientName || null,
                description || null,
                amount,
                method || 'cash',
                status || 'processed',
                paymentType || null,
                dueDate || null,
                notes || null,
                resolvedCollectorId,
                signatureData || null
            ]
        );

        // Mettre à jour le montant payé du client
        if (clientId && (status === 'processed' || !status)) {
            await connection.query(
                `UPDATE clients SET amount_paid = amount_paid + ?, 
                 payment_method = ?,
                 status = CASE 
                    WHEN amount_paid + ? >= amount_due THEN 'paid'
                    WHEN amount_paid + ? > 0 THEN 'partial'
                    ELSE status 
                 END
                 WHERE id = ?`,
                [amount, method || 'cash', amount, amount, clientId]
            );
        }

        await connection.commit();

        res.status(201).json({
            success: true,
            data: { id: result.insertId, reference: ref, amount }
        });

    } catch (err) {
        if (connection) await connection.rollback();
        console.error('Erreur POST /transactions :', err);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    } finally {
        if (connection) connection.release();
    }
});

// ─── PUT /api/transactions/:id ─────────────────────────────────
router.put('/:id', authorize('admin', 'director', 'accounting', 'collector_manager'), async (req, res) => {
    try {
        const fields = [];
        const values = [];
        const fieldMap = {
            description: 'description',
            amount:      'amount',
            method:      'method',
            status:      'status',
            notes:       'notes'
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
        await pool.query(`UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`, values);

        res.json({ success: true, message: 'Transaction modifiée avec succès' });

    } catch (err) {
        console.error('Erreur PUT /transactions/:id :', err);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// ─── DELETE /api/transactions/:id ──────────────────────────────
router.delete('/:id', authorize('admin', 'director', 'accounting', 'collector_manager'), async (req, res) => {
    try {
        const [result] = await pool.query('DELETE FROM transactions WHERE id = ?', [req.params.id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'Transaction non trouvée' });
        }

        res.json({ success: true, message: 'Transaction supprimée avec succès' });

    } catch (err) {
        console.error('Erreur DELETE /transactions/:id :', err);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

module.exports = router;
