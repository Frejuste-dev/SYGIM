/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║        SYGIM — Routes Gestion des Alertes et Notifications      ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// ─── GET /api/alerts/overdue-payments ─ Alertes retards de paiement ────
router.get('/overdue-payments', async (req, res) => {
    try {
        const { daysThreshold = 15, collectorId, severity = 'all' } = req.query;

        let sql = `
            SELECT 
                c.id,
                c.first_name,
                c.last_name,
                c.phone,
                c.email,
                c.property_name,
                p.address as property_address,
                CONCAT(col.first_name, ' ', col.last_name) as collector_name,
                col.phone as collector_phone,
                o.first_name as owner_first_name,
                o.last_name as owner_last_name,
                c.amount_due as rent_due,
                c.amount_paid,
                (c.amount_due - COALESCE(c.amount_paid, 0)) as amount_owed,
                c.status,
                DATEDIFF(CURDATE(), DATE(c.contract_start)) as days_since_contract,
                (SELECT MAX(date) FROM transactions WHERE client_id = c.id) as last_payment_date,
                CASE 
                    WHEN (c.amount_due - COALESCE(c.amount_paid, 0)) > c.amount_due * 2 THEN 'critique'
                    WHEN (c.amount_due - COALESCE(c.amount_paid, 0)) > c.amount_due THEN 'haute'
                    WHEN (c.amount_due - COALESCE(c.amount_paid, 0)) > 0 THEN 'normale'
                    ELSE 'basse'
                END as severity
            FROM clients c
            LEFT JOIN properties p ON c.property_id = p.id
            LEFT JOIN collectors col ON c.collector_id = col.id
            LEFT JOIN owners o ON c.owner_id = o.id
            WHERE c.status IN ('late', 'pending', 'partial')
                AND c.amount_due > 0
                AND (c.amount_due - COALESCE(c.amount_paid, 0)) > 0
        `;

        const params = [];

        // Filtre par collecteur si c'est un collecteur qui demande
        if (req.user.role === 'collector') {
            const [collectorRows] = await pool.query(
                'SELECT id FROM collectors WHERE user_id = ?',
                [req.user.id]
            );
            if (collectorRows.length > 0) {
                sql += ' AND c.collector_id = ?';
                params.push(collectorRows[0].id);
            }
        } else if (collectorId) {
            sql += ' AND c.collector_id = ?';
            params.push(collectorId);
        }

        // Filtre par sévérité
        if (severity !== 'all') {
            sql += `
                AND CASE 
                    WHEN (c.amount_due - COALESCE(c.amount_paid, 0)) > c.amount_due * 2 THEN 'critique'
                    WHEN (c.amount_due - COALESCE(c.amount_paid, 0)) > c.amount_due THEN 'haute'
                    WHEN (c.amount_due - COALESCE(c.amount_paid, 0)) > 0 THEN 'normale'
                    ELSE 'basse'
                END = ?
            `;
            params.push(severity);
        }

        sql += ' ORDER BY amount_owed DESC, days_since_contract DESC';

        const [alerts] = await pool.query(sql, params);

        // Agréger les statistiques
        const stats = {
            totalAlerts: alerts.length,
            bySeverity: {
                critique: alerts.filter(a => a.severity === 'critique').length,
                haute: alerts.filter(a => a.severity === 'haute').length,
                normale: alerts.filter(a => a.severity === 'normale').length,
                basse: alerts.filter(a => a.severity === 'basse').length
            },
            totalAmount: alerts.reduce((sum, a) => sum + (a.amount_owed || 0), 0),
            byStatus: {
                late: alerts.filter(a => a.status === 'late').length,
                pending: alerts.filter(a => a.status === 'pending').length,
                partial: alerts.filter(a => a.status === 'partial').length
            }
        };

        res.json({
            success: true,
            data: alerts,
            stats: stats,
            daysThreshold: parseInt(daysThreshold)
        });

    } catch (err) {
        console.error('Erreur GET /alerts/overdue-payments :', err);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// ─── GET /api/alerts/dashboard ─ Dashboard alertes synthétiques ────────
router.get('/dashboard', authorize('admin', 'director', 'accounting'), async (req, res) => {
    try {
        // Total dû
        const [totalOwed] = await pool.query(`
            SELECT 
                SUM(amount_due - COALESCE(amount_paid, 0)) as total_owed,
                COUNT(*) as client_count,
                SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late_count,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count
            FROM clients
            WHERE amount_due > 0 AND amount_paid < amount_due
        `);

        // Top 5 clients en retard
        const [topOverdue] = await pool.query(`
            SELECT 
                c.id,
                CONCAT(c.first_name, ' ', c.last_name) as client_name,
                c.property_name,
                (c.amount_due - COALESCE(c.amount_paid, 0)) as amount_owed,
                c.status
            FROM clients c
            WHERE c.amount_due > 0 AND c.amount_paid < c.amount_due
            ORDER BY amount_owed DESC
            LIMIT 5
        `);

        // Alarmes par collecteur
        const [byCollector] = await pool.query(`
            SELECT 
                CONCAT(col.first_name, ' ', col.last_name) as collector_name,
                COUNT(c.id) as overdue_count,
                SUM(c.amount_due - COALESCE(c.amount_paid, 0)) as total_owed
            FROM clients c
            LEFT JOIN collectors col ON c.collector_id = col.id
            WHERE c.amount_due > 0 AND c.amount_paid < c.amount_due
            GROUP BY col.id
            ORDER BY total_owed DESC
        `);

        // Performance collections aujourd'hui
        const [todayCollections] = await pool.query(`
            SELECT 
                COUNT(*) as transaction_count,
                SUM(amount) as total_collected,
                COUNT(DISTINCT client_id) as client_count
            FROM transactions
            WHERE DATE(date) = CURDATE() AND status = 'processed'
        `);

        res.json({
            success: true,
            data: {
                totalOwed: totalOwed[0],
                topOverdueClients: topOverdue,
                byCollector: byCollector,
                todayCollections: todayCollections[0] || { transaction_count: 0, total_collected: 0, client_count: 0 }
            }
        });

    } catch (err) {
        console.error('Erreur GET /alerts/dashboard :', err);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// ─── GET /api/alerts/summary ─ Résumé des alertes par sévérité ────────
router.get('/summary', async (req, res) => {
    try {
        const [summary] = await pool.query(`
            SELECT 
                CASE 
                    WHEN (c.amount_due - COALESCE(c.amount_paid, 0)) > c.amount_due * 2 THEN 'critique'
                    WHEN (c.amount_due - COALESCE(c.amount_paid, 0)) > c.amount_due THEN 'haute'
                    WHEN (c.amount_due - COALESCE(c.amount_paid, 0)) > 0 THEN 'normale'
                    ELSE 'basse'
                END as severity,
                COUNT(*) as count,
                SUM(c.amount_due - COALESCE(c.amount_paid, 0)) as total_amount
            FROM clients c
            WHERE c.amount_due > 0 AND c.amount_paid < c.amount_due
            GROUP BY severity
            ORDER BY FIELD(severity, 'critique', 'haute', 'normale', 'basse')
        `);

        res.json({
            success: true,
            data: summary
        });

    } catch (err) {
        console.error('Erreur GET /alerts/summary :', err);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// ─── PUT /api/alerts/:clientId/acknowledge ─ Marquer alerte comme lue ────
router.put('/:clientId/acknowledge', authorize('admin', 'director', 'collector_manager', 'accounting'), async (req, res) => {
    try {
        // Dans une implémentation future, on pourrait avoir une table d'alertes avec statut "acknowledged"
        // Pour maintenant, on peut juste retourner un succès
        
        res.json({
            success: true,
            message: 'Alerte marquée comme reconnue'
        });

    } catch (err) {
        console.error('Erreur PUT /alerts/:clientId/acknowledge :', err);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

module.exports = router;
