/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║           SYGIM — Routes Gestion des Clients (Locataires)       ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

const express = require('express');
const router  = express.Router();
const { pool }       = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { validateEmail, validatePhone, validateAmount } = require('../utils/validators');

router.use(authenticate);

// ─── GET /api/clients ─ Liste avec filtrage ────────────────────
router.get('/', async (req, res) => {
    try {
        const { status, collectorId, search, page = 1, limit = 50 } = req.query;
        let sql = `SELECT c.*, CONCAT(col.first_name, ' ', col.last_name) as collector_name
                   FROM clients c
                   LEFT JOIN collectors col ON c.collector_id = col.id
                   WHERE 1=1`;
        const params = [];

        if (status && status !== 'all') {
            sql += ' AND c.status = ?';
            params.push(status);
        }

        if (collectorId) {
            sql += ' AND c.collector_id = ?';
            params.push(collectorId);
        }

        // Récolteur : ne voit que ses clients
        if (req.user.role === 'collector') {
            const [collectorRows] = await pool.query('SELECT id FROM collectors WHERE user_id = ?', [req.user.id]);
            if (collectorRows.length > 0) {
                sql += ' AND c.collector_id = ?';
                params.push(collectorRows[0].id);
            }
        }

        if (search) {
            sql += ' AND (c.first_name LIKE ? OR c.last_name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)';
            const s = `%${search}%`;
            params.push(s, s, s, s);
        }

        sql += ' ORDER BY c.created_at DESC';

        // Pagination
        const offset = (parseInt(page) - 1) * parseInt(limit);
        sql += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const [rows] = await pool.query(sql, params);

        // Count total
        let countSql = `SELECT COUNT(*) as total FROM clients c WHERE 1=1`;
        const countParams = [];
        if (status && status !== 'all') {
            countSql += ' AND c.status = ?';
            countParams.push(status);
        }
        if (collectorId) {
            countSql += ' AND c.collector_id = ?';
            countParams.push(collectorId);
        }
        const [countRows] = await pool.query(countSql, countParams);

        res.json({
            success: true,
            data: rows,
            total: countRows[0]?.total || 0,
            page: parseInt(page),
            limit: parseInt(limit)
        });

    } catch (err) {
        console.error('Erreur GET /clients :', err);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// ─── GET /api/clients/:id ──────────────────────────────────────
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM clients WHERE id = ?', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Client non trouvé' });
        }
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        console.error('Erreur GET /clients/:id :', err);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// ─── POST /api/clients ─ Créer un locataire ────────────────────
router.post('/', authorize('admin', 'director', 'collector_manager', 'accounting'), async (req, res) => {
    try {
        const {
            firstName, lastName, phone, email, address,
            propertyId, propertyName, propertyValue,
            amountDue, collectorId, ownerId, deposit,
            contractStart, contractEnd
        } = req.body;

        // ✅ Validation des champs requis
        if (!lastName || !phone) {
            return res.status(400).json({
                success: false,
                error: 'Nom et téléphone sont requis'
            });
        }

        // ✅ Validation du format téléphone
        if (!validatePhone(phone)) {
            return res.status(400).json({
                success: false,
                error: 'Format téléphone invalide (exemple: +225 07 00 00 00 00)'
            });
        }

        // ✅ Validation du format email (optionnel mais validé si fourni)
        if (email && !validateEmail(email)) {
            return res.status(400).json({
                success: false,
                error: 'Format email invalide'
            });
        }

        // ✅ Validation du montant (amountDue doit être > 0)
        if (amountDue && !validateAmount(amountDue)) {
            return res.status(400).json({
                success: false,
                error: 'Montant invalide (doit être > 0)'
            });
        }

        // ✅ Vérifier l'unicité du téléphone
        const [existingPhone] = await pool.query(
            'SELECT id FROM clients WHERE phone = ? AND id != ?',
            [phone, 0]
        );
        if (existingPhone.length > 0) {
            return res.status(409).json({
                success: false,
                error: 'Ce numéro de téléphone est déjà utilisé'
            });
        }

        // ✅ Vérifier l'unicité de l'email (si fourni)
        if (email) {
            const [existingEmail] = await pool.query(
                'SELECT id FROM clients WHERE email = ? AND id != ?',
                [email, 0]
            );
            if (existingEmail.length > 0) {
                return res.status(409).json({
                    success: false,
                    error: 'Cet email est déjà utilisé'
                });
            }
        }

        // Valider que le collecteur existe si fourni
        if (collectorId) {
            const [collectorRows] = await pool.query(
                'SELECT id FROM collectors WHERE id = ? AND active = 1',
                [collectorId]
            );
            if (collectorRows.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Collecteur non trouvé ou inactif'
                });
            }
        }

        const joinDate = new Date().toLocaleDateString('fr-FR');

        const [result] = await pool.query(
            `INSERT INTO clients 
             (first_name, last_name, phone, email, address, property_id, property_name, 
              property_value, amount_due, amount_paid, status, collector_id, owner_id, deposit, 
              contract_start, contract_end, join_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'pending', ?, ?, ?, ?, ?, ?)`,
            [
                firstName || '', lastName, phone, email || null, address || null,
                propertyId || null, propertyName || null, propertyValue || 0,
                amountDue || 0, collectorId || null, ownerId || null, deposit || 0,
                contractStart || null, contractEnd || null, joinDate
            ]
        );

        // Mettre à jour la propriété si associée
        if (propertyId) {
            await pool.query(
                `UPDATE properties SET status = 'loue', tenant_id = ? WHERE id = ?`,
                [result.insertId, propertyId]
            );
        }

        res.status(201).json({
            success: true,
            data: { id: result.insertId, lastName, firstName }
        });

    } catch (err) {
        console.error('Erreur POST /clients :', err);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// ─── PUT /api/clients/:id ──────────────────────────────────────
router.put('/:id', authorize('admin', 'director', 'collector_manager', 'accounting'), async (req, res) => {
    try {
        const fields = [];
        const values = [];
        const fieldMap = {
            firstName:        'first_name',
            lastName:         'last_name',
            phone:            'phone',
            email:            'email',
            address:          'address',
            propertyId:       'property_id',
            propertyName:     'property_name',
            propertyValue:    'property_value',
            amountDue:        'amount_due',
            amountPaid:       'amount_paid',
            paymentMethod:    'payment_method',
            status:           'status',
            collectorId:      'collector_id',
            agent:            'agent', // Rétro-compatibilité
            ownerId:          'owner_id',
            deposit:          'deposit',
            advancePayment:   'advance_payment',
            contractStart:    'contract_start',
            contractEnd:      'contract_end',
            departureReason:  'departure_reason',
            departureNotes:   'departure_notes'
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
        const [result] = await pool.query(`UPDATE clients SET ${fields.join(', ')} WHERE id = ?`, values);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'Client non trouvé' });
        }

        res.json({ success: true, message: 'Client modifié avec succès' });

    } catch (err) {
        console.error('Erreur PUT /clients/:id :', err);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// ─── DELETE /api/clients/:id ───────────────────────────────────
router.delete('/:id', authorize('admin', 'director', 'collector_manager'), async (req, res) => {
    try {
        // Libérer la propriété associée
        await pool.query(
            `UPDATE properties SET status = 'vacant', tenant_id = NULL WHERE tenant_id = ?`,
            [req.params.id]
        );

        const [result] = await pool.query('DELETE FROM clients WHERE id = ?', [req.params.id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'Client non trouvé' });
        }

        res.json({ success: true, message: 'Client supprimé avec succès' });

    } catch (err) {
        console.error('Erreur DELETE /clients/:id :', err);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// ─── POST /api/clients/:id/replace ─ Remplacement locataire ───
router.post('/:id/replace', authorize('admin', 'director', 'collector_manager'), async (req, res) => {
    try {
        const oldId = parseInt(req.params.id);
        const {
            departureReason, departureNotes, endDate,
            newTenant, existingTenantId,
            newRent, newStartDate
        } = req.body;

        // 1. Récupérer l'ancien locataire et sa propriété
        const [oldRows] = await pool.query('SELECT * FROM clients WHERE id = ?', [oldId]);
        if (oldRows.length === 0) {
            return res.status(404).json({ success: false, error: 'Ancien locataire non trouvé' });
        }
        const oldClient = oldRows[0];

        const [propRows] = await pool.query('SELECT * FROM properties WHERE tenant_id = ?', [oldId]);
        if (propRows.length === 0) {
            return res.status(404).json({ success: false, error: 'Aucun bien trouvé pour ce locataire' });
        }
        const property = propRows[0];

        // 2. Marquer l'ancien locataire comme inactif
        await pool.query(
            `UPDATE clients SET status = 'inactive', contract_end = ?, departure_reason = ?, departure_notes = ? WHERE id = ?`,
            [endDate, departureReason, departureNotes || null, oldId]
        );

        // 3. Créer ou utiliser le nouveau locataire
        let newTenantId;
        let newTenantName;

        if (existingTenantId) {
            newTenantId = existingTenantId;
            const [existRows] = await pool.query('SELECT first_name, last_name FROM clients WHERE id = ?', [existingTenantId]);
            newTenantName = existRows[0] ? `${existRows[0].last_name} ${existRows[0].first_name}` : 'Inconnu';

            // Mettre à jour le locataire existant avec le même collecteur
            await pool.query(
                `UPDATE clients SET property_id = ?, property_name = ?, property_value = ?, amount_due = ?, collector_id = ? WHERE id = ?`,
                [property.id, property.name, property.value, newRent, oldClient.collector_id, existingTenantId]
            );
        } else if (newTenant) {
            const joinDate = new Date().toLocaleDateString('fr-FR');
            const [insertResult] = await pool.query(
                `INSERT INTO clients (first_name, last_name, phone, email, address, property_id, property_name, 
                 property_value, amount_due, amount_paid, status, collector_id, owner_id, contract_start, join_date)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'pending', ?, ?, ?, ?)`,
                [
                    newTenant.firstName || '', newTenant.lastName,
                    newTenant.phone, newTenant.email || null,
                    property.address, property.id, property.name,
                    property.value, newRent, oldClient.collector_id,
                    property.owner_id, newStartDate, joinDate
                ]
            );
            newTenantId = insertResult.insertId;
            newTenantName = `${newTenant.lastName} ${newTenant.firstName || ''}`.trim();
        }

        // 4. Mettre à jour la propriété
        await pool.query(
            `UPDATE properties SET tenant_id = ?, rent = ? WHERE id = ?`,
            [newTenantId, newRent, property.id]
        );

        // 5. Créer une transaction de remplacement
        await pool.query(
            `INSERT INTO transactions (reference, date, client_name, description, amount, method, status, collector_id)
             VALUES (?, CURDATE(), ?, ?, 0, 'replacement', 'processed', ?)`,
            [
                `REPL-${oldId}-${newTenantId}`,
                newTenantName,
                `Remplacement locataire — ${oldClient.last_name} ${oldClient.first_name}`,
                oldClient.collector_id
            ]
        );

        res.json({
            success: true,
            message: 'Remplacement effectué avec succès',
            data: { oldTenantId: oldId, newTenantId, propertyId: property.id }
        });

    } catch (err) {
        console.error('Erreur POST /clients/:id/replace :', err);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

module.exports = router;
