/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║     SYGIM v2.0 — Jeu de Données de Démonstration Haute Qualité    ║
 * ║     Données réalistes, cohérentes, complètes et variées            ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const { pool } = require('../config/db');

async function seed() {
  console.log('🚀 Démarrage de la réinitialisation et injection des données démo...');
  const conn = await pool.getConnection();

  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    const tables = [
      'activity_logs',
      'alert_acknowledgements',
      'refresh_tokens',
      'tenant_credit_ledger',
      'payment_allocations',
      'payments',
      'invoices',
      'owner_settlements',
      'prefinancings',
      'transactions',
      'clients',
      'properties',
      'owners',
      'collectors',
      'users'
    ];

    console.log('🧹 Purge des tables existantes...');
    for (const table of tables) {
      await conn.query(`TRUNCATE TABLE ${table}`);
    }
    console.log('✅ Tables vidées avec succès.');

    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    // ═══════════════════════════════════════════════════════════════════
    // 1. UTILISATEURS (Comptes Démo)
    // ═══════════════════════════════════════════════════════════════════
    console.log('👤 Création des utilisateurs...');
    const users = [
      { id: 1, username: 'admin', role: 'admin', pass: 'Admin2026!', first: 'Admin', last: 'SYGIM', email: 'admin@sygim.ci', phone: '+225 07 00 00 00 01' },
      { id: 2, username: 'directeur', role: 'director', pass: 'Dir2026!', first: 'Marc', last: 'BAMBA', email: 'directeur@sygim.ci', phone: '+225 07 00 00 00 02' },
      { id: 3, username: 'comptable', role: 'accounting', pass: 'Cpt2026!', first: 'Sophie', last: 'KOFFI', email: 'comptable@sygim.ci', phone: '+225 07 00 00 00 03' },
      { id: 4, username: 'manager', role: 'collector_manager', pass: 'Mgr2026!', first: 'Hervé', last: 'YAO', email: 'manager@sygim.ci', phone: '+225 07 00 00 00 04' },
      { id: 5, username: 'korede', role: 'collector', pass: 'Korede2026!', first: 'Kouassi', last: 'KOREDE', email: 'korede@sygim.ci', phone: '+225 07 01 02 03 04', collName: 'KOREDE' },
      { id: 6, username: 'leonce', role: 'collector', pass: 'Leonce2026!', first: 'Léonce', last: 'YAO', email: 'leonce@sygim.ci', phone: '+225 07 05 06 07 08', collName: 'LEONCE' }
    ];

    for (const u of users) {
      const hash = await bcrypt.hash(u.pass, 10);
      await conn.query(
        `INSERT INTO users 
         (id, username, password_hash, role, first_name, last_name, display_name, email, phone, collector_name, active, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
        [u.id, u.username, hash, u.role, u.first, u.last, `${u.first} ${u.last}`, u.email, u.phone, u.collName || null]
      );
    }
    console.log('✅ 6 utilisateurs créés.');

    // ═══════════════════════════════════════════════════════════════════
    // 2. COLLECTEURS
    // ═══════════════════════════════════════════════════════════════════
    console.log('📱 Création des collecteurs terrain...');
    await conn.query(
      `INSERT INTO collectors (id, first_name, last_name, phone, email, zone, commission_rate, active, user_id, manager_id, created_at, updated_at) VALUES 
       (1, 'Kouassi', 'KOREDE', '+225 07 01 02 03 04', 'korede@sygim.ci', 'Abidjan Nord (Cocody / Plateau / Riviera)', 5.00, 1, 5, 4, NOW(), NOW()),
       (2, 'Léonce', 'YAO', '+225 07 05 06 07 08', 'leonce@sygim.ci', 'Abidjan Sud (Marcory / Biétry / Zone 4)', 5.00, 1, 6, 4, NOW(), NOW())`
    );
    console.log('✅ 2 collecteurs enregistrés.');

    // ═══════════════════════════════════════════════════════════════════
    // 3. PROPRIÉTAIRES (Bailleurs)
    // ═══════════════════════════════════════════════════════════════════
    console.log('🏛️ Création des propriétaires...');
    const owners = [
      { id: 1, first: 'Aminata', last: 'KONE', display: 'Mme Aminata KONE', phone: '+225 01 02 03 04 05', email: 'aminata.kone@example.com', address: 'Cocody Danga', bank: 'SGCI', account: 'CI026 01001 012345678901 22' },
      { id: 2, first: 'Jean-Marc', last: 'KOUAME', display: 'M. Jean-Marc KOUAME', phone: '+225 05 06 07 08 09', email: 'jm.kouame@example.com', address: 'Plateau Dokui', bank: 'NSIA Banque', account: 'CI042 01002 987654321098 44' },
      { id: 3, first: 'SCI', last: 'Ivoire Patrimoine', display: 'SCI Ivoire Patrimoine', phone: '+225 27 22 44 55 66', email: 'contact@ivoirepatrimoine.ci', address: 'Plateau Immeuble CCIA', bank: 'Ecobank CI', account: 'CI059 01003 456789012345 66' },
      { id: 4, first: 'Philippe', last: 'DIOMANDE', display: 'Dr. Philippe DIOMANDE', phone: '+225 07 08 09 10 11', email: 'p.diomande@example.com', address: 'Marcory Résidentiel', bank: 'BNI', account: 'CI092 01004 678901234567 88' }
    ];

    for (const o of owners) {
      await conn.query(
        `INSERT INTO owners 
         (id, first_name, last_name, display_name, phone, email, address, bank_name, bank_account, active, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
        [o.id, o.first, o.last, o.display, o.phone, o.email, o.address, o.bank, o.account]
      );
    }
    console.log('✅ 4 propriétaires créés.');

    // ═══════════════════════════════════════════════════════════════════
    // 4. BIENS IMMOBILIERS (12 Biens variés)
    // ═══════════════════════════════════════════════════════════════════
    console.log('🏡 Création des biens immobiliers...');
    const properties = [
      { id: 1, name: 'Villa Les Hibiscus - 5P Duplex', address: 'Cocody Ambassades Rue B12', type: 'villa', status: 'loue', value: 180000000, rent: 850000, area: 320, rooms: 5, owner_id: 1, collector_id: 1 },
      { id: 2, name: 'Appartement F4 Palmier', address: 'Riviera Palmeraie Rue Ministre', type: 'appartement', status: 'loue', value: 75000000, rent: 350000, area: 135, rooms: 4, owner_id: 1, collector_id: 1 },
      { id: 3, name: 'Studio Meublé Cocody Center', address: 'Cocody St-Jean Lot 14', type: 'studio', status: 'loue', value: 45000000, rent: 200000, area: 45, rooms: 1, owner_id: 2, collector_id: 1 },
      { id: 4, name: 'Appartement F3 La Lagune', address: 'Marcory Biétry Boulevard de Marseille', type: 'appartement', status: 'loue', value: 90000000, rent: 450000, area: 110, rooms: 3, owner_id: 2, collector_id: 2 },
      { id: 5, name: 'Local Commercial - Galerie Plateau', address: 'Plateau Rue du Commerce', type: 'commercial', status: 'loue', value: 120000000, rent: 600000, area: 90, rooms: 2, owner_id: 3, collector_id: 1 },
      { id: 6, name: 'Bureaux Open Space 120m²', address: 'Plateau Avenue Chardy', type: 'bureau', status: 'loue', value: 220000000, rent: 1200000, area: 120, rooms: 3, owner_id: 3, collector_id: 2 },
      { id: 7, name: 'Villa Basse 4P avec Jardin', address: 'Riviera Bonoumin', type: 'villa', status: 'disponible', value: 110000000, rent: 550000, area: 250, rooms: 4, owner_id: 1, collector_id: null },
      { id: 8, name: 'Studio Économique Marcory', address: 'Marcory Résidentiel Rue Paul Langevin', type: 'studio', status: 'disponible', value: 25000000, rent: 120000, area: 30, rooms: 1, owner_id: 4, collector_id: null },
      { id: 9, name: 'Appartement F2 Cosy Zone 4', address: 'Marcory Zone 4C Rue du Canal', type: 'appartement', status: 'en_maintenance', value: 55000000, rent: 280000, area: 65, rooms: 2, owner_id: 4, collector_id: null },
      { id: 10, name: 'Boutique Rez-de-Chaussée Treichville', address: 'Treichville Boulevard Nanan Yamousso', type: 'commercial', status: 'disponible', value: 40000000, rent: 250000, area: 50, rooms: 1, owner_id: 3, collector_id: null },
      { id: 11, name: 'Penthouse Vue Lagune F5', address: 'Plateau Corniche', type: 'appartement', status: 'loue', value: 300000000, rent: 1500000, area: 280, rooms: 5, owner_id: 3, collector_id: 1 },
      { id: 12, name: 'Duplex Riviera 3', address: 'Riviera 3 Cité Verdoyante', type: 'villa', status: 'disponible', value: 150000000, rent: 700000, area: 290, rooms: 5, owner_id: 2, collector_id: null }
    ];

    for (const p of properties) {
      await conn.query(
        `INSERT INTO properties 
         (id, name, address, type, status, value, rent, area, rooms, owner_id, collector_id, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [p.id, p.name, p.address, p.type, p.status, p.value, p.rent, p.area, p.rooms, p.owner_id, p.collector_id]
      );
    }
    console.log('✅ 12 biens immobiliers enregistrés.');

    // ═══════════════════════════════════════════════════════════════════
    // 5. LOCATAIRES (Clients avec scénarios démo précis)
    // ═══════════════════════════════════════════════════════════════════
    console.log('👨‍👩‍👧 Création des locataires et scénarios financiers...');
    const clients = [
      {
        id: 1,
        first: 'Ibrahima',
        last: 'FALL',
        phone: '+225 07 48 11 22 33',
        email: 'ibrahima.fall@example.com',
        address: 'Cocody Ambassades Rue B12',
        propId: 1,
        propName: 'Villa Les Hibiscus - 5P Duplex',
        due: 850000,
        paid: 850000,
        status: 'paid', // À JOUR
        collId: 1,
        ownerId: 1,
        deposit: 1700000,
        start: '2026-01-01',
        end: '2026-12-31'
      },
      {
        id: 2,
        first: 'Fatou',
        last: 'TRAORE',
        phone: '+225 05 55 44 33 22',
        email: 'fatou.traore@example.com',
        address: 'Riviera Palmeraie Rue Ministre',
        propId: 2,
        propName: 'Appartement F4 Palmier',
        due: 700000, // 2 mois impayés -> ALERTE ROUGE
        paid: 0,
        status: 'late',
        collId: 1,
        ownerId: 1,
        deposit: 700000,
        start: '2026-02-01',
        end: '2027-01-31'
      },
      {
        id: 3,
        first: 'Kévin',
        last: 'BROU',
        phone: '+225 07 77 88 99 00',
        email: 'kevin.brou@example.com',
        address: 'Cocody St-Jean Lot 14',
        propId: 3,
        propName: 'Studio Meublé Cocody Center',
        due: 200000,
        paid: 200000,
        status: 'paid', // CRÉDITEUR AVEC AVANCE AU GRAND LIVRE
        collId: 1,
        ownerId: 2,
        deposit: 400000,
        start: '2026-03-01',
        end: '2027-02-28'
      },
      {
        id: 4,
        first: 'Danielle',
        last: 'KOFFI',
        phone: '+225 01 23 45 67 89',
        email: 'danielle.koffi@example.com',
        address: 'Marcory Biétry Boulevard de Marseille',
        propId: 4,
        propName: 'Appartement F3 La Lagune',
        due: 450000,
        paid: 250000, // PARTIEL
        status: 'partial',
        collId: 2,
        ownerId: 2,
        deposit: 900000,
        start: '2026-04-01',
        end: '2027-03-31'
      },
      {
        id: 5,
        first: 'SARL Ivoire Tech',
        last: 'Innovation',
        phone: '+225 27 20 21 22 23',
        email: 'direction@ivoiretech.ci',
        address: 'Plateau Rue du Commerce',
        propId: 5,
        propName: 'Local Commercial - Galerie Plateau',
        due: 600000,
        paid: 600000,
        status: 'paid',
        collId: 1,
        ownerId: 3,
        deposit: 1800000,
        start: '2026-01-01',
        end: '2028-12-31'
      },
      {
        id: 6,
        first: 'Stéphane',
        last: 'TOURE',
        phone: '+225 07 99 88 77 66',
        email: 'stephane.toure@example.com',
        address: 'Plateau Avenue Chardy',
        propId: 6,
        propName: 'Bureaux Open Space 120m²',
        due: 1200000, // EN ATTENTE -> PRÊT POUR DÉMO LIVE D'ENCAISSEMENT
        paid: 0,
        status: 'pending',
        collId: 2,
        ownerId: 3,
        deposit: 2400000,
        start: '2026-11-01',
        end: '2027-10-31'
      },
      {
        id: 7,
        first: 'Christian',
        last: 'BLA',
        phone: '+225 05 12 34 56 78',
        email: 'c.bla@example.com',
        address: 'Plateau Corniche',
        propId: 11,
        propName: 'Penthouse Vue Lagune F5',
        due: 1500000,
        paid: 1500000,
        status: 'paid',
        collId: 1,
        ownerId: 3,
        deposit: 3000000,
        start: '2026-01-01',
        end: '2026-12-31'
      }
    ];

    for (const c of clients) {
      await conn.query(
        `INSERT INTO clients 
         (id, first_name, last_name, phone, email, address, property_id, property_name, property_value, 
          amount_due, amount_paid, status, collector_id, owner_id, deposit, contract_start, contract_end, join_date, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, '01/01/2026', NOW(), NOW())`,
        [c.id, c.first, c.last, c.phone, c.email, c.address, c.propId, c.propName, c.due, c.paid, c.status, c.collId, c.ownerId, c.deposit, c.start, c.end]
      );
      // Associer le locataire au bien
      await conn.query('UPDATE properties SET tenant_id = ? WHERE id = ?', [c.id, c.propId]);
    }
    console.log('✅ 7 locataires enregistrés avec scénarios financiers.');

    // ═══════════════════════════════════════════════════════════════════
    // 6. FACTURES DE LOYER (Invoices)
    // ═══════════════════════════════════════════════════════════════════
    console.log('📄 Émission des factures de loyer...');
    const invoices = [
      // Client 1 : Facture payée (Octobre 2026)
      { id: 1, num: 'FAC-2026-10-001', cid: 1, pid: 1, type: 'RENT_FULL', start: '2026-10-01', end: '2026-10-31', amount: 850000, paid: 850000, due: 0, status: 'PAID', due_date: '2026-10-05' },
      
      // Client 2 : 2 Factures impayées (Septembre + Octobre 2026) -> Alerte Retard
      { id: 2, num: 'FAC-2026-09-002', cid: 2, pid: 2, type: 'RENT_FULL', start: '2026-09-01', end: '2026-09-30', amount: 350000, paid: 0, due: 350000, status: 'PENDING', due_date: '2026-09-05' },
      { id: 3, num: 'FAC-2026-10-003', cid: 2, pid: 2, type: 'RENT_FULL', start: '2026-10-01', end: '2026-10-31', amount: 350000, paid: 0, due: 350000, status: 'PENDING', due_date: '2026-10-05' },

      // Client 3 : Facture payée (Octobre 2026)
      { id: 4, num: 'FAC-2026-10-004', cid: 3, pid: 3, type: 'RENT_FULL', start: '2026-10-01', end: '2026-10-31', amount: 200000, paid: 200000, due: 0, status: 'PAID', due_date: '2026-10-05' },

      // Client 4 : Facture partiellement payée (Octobre 2026)
      { id: 5, num: 'FAC-2026-10-005', cid: 4, pid: 4, type: 'RENT_FULL', start: '2026-10-01', end: '2026-10-31', amount: 450000, paid: 250000, due: 200000, status: 'PARTIALLY_PAID', due_date: '2026-10-05' },

      // Client 5 : Facture payée (Octobre 2026)
      { id: 6, num: 'FAC-2026-10-006', cid: 5, pid: 5, type: 'RENT_FULL', start: '2026-10-01', end: '2026-10-31', amount: 600000, paid: 600000, due: 0, status: 'PAID', due_date: '2026-10-05' },

      // Client 6 : Facture en attente de paiement (Novembre 2026, prêt pour démo encaissement)
      { id: 7, num: 'FAC-2026-11-007', cid: 6, pid: 6, type: 'RENT_FULL', start: '2026-11-01', end: '2026-11-30', amount: 1200000, paid: 0, due: 1200000, status: 'PENDING', due_date: '2026-11-05' },

      // Client 7 : Facture payée (Octobre 2026)
      { id: 8, num: 'FAC-2026-10-008', cid: 7, pid: 11, type: 'RENT_FULL', start: '2026-10-01', end: '2026-10-31', amount: 1500000, paid: 1500000, due: 0, status: 'PAID', due_date: '2026-10-05' }
    ];

    for (const inv of invoices) {
      await conn.query(
        `INSERT INTO invoices 
         (id, uuid, invoice_number, client_id, property_id, invoice_type, billing_period_start, billing_period_end, 
          contract_rent_applied, base_amount, total_amount, paid_amount, status, due_date, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [inv.id, randomUUID(), inv.num, inv.cid, inv.pid, inv.type, inv.start, inv.end, inv.amount, inv.amount, inv.amount, inv.paid, inv.status, inv.due_date]
      );
    }
    console.log('✅ 8 factures émises.');

    // ═══════════════════════════════════════════════════════════════════
    // 7. ENCAISSEMENTS & PAIEMENTS (Payments, Allocations & Grand Livre)
    // ═══════════════════════════════════════════════════════════════════
    console.log('💰 Enregistrement des règlements et allocations FIFO...');

    // Règlement 1 : Client 1 (850 000 FCFA par Virement)
    await conn.query(
      `INSERT INTO payments 
       (id, uuid, transaction_reference, receipt_number, client_id, collector_id, property_id, amount_received, payment_method, payment_date, status, is_reversed, created_by, created_at) 
       VALUES (1, ?, 'TR-2026-10-001', 'RC-202610-001', 1, 1, 1, 850000, 'BANK_TRANSFER', '2026-10-04 10:30:00', 'RECEIVED', 0, 1, NOW())`,
      [randomUUID()]
    );
    await conn.query(
      `INSERT INTO payment_allocations (id, uuid, payment_id, invoice_id, allocated_amount, status, created_at) 
       VALUES (1, ?, 1, 1, 850000, 'ACTIVE', NOW())`,
      [randomUUID()]
    );

    // Règlement 2 : Client 3 (Avance de 500 000 FCFA en Cash pour un loyer de 200 000 -> 300 000 en avance au Grand Livre !)
    await conn.query(
      `INSERT INTO payments 
       (id, uuid, transaction_reference, receipt_number, client_id, collector_id, property_id, amount_received, payment_method, payment_date, status, is_reversed, created_by, created_at) 
       VALUES (2, ?, 'TR-2026-10-002', 'RC-202610-002', 3, 1, 3, 500000, 'CASH', '2026-10-03 14:15:00', 'RECEIVED', 0, 5, NOW())`,
      [randomUUID()]
    );
    await conn.query(
      `INSERT INTO payment_allocations (id, uuid, payment_id, invoice_id, allocated_amount, status, created_at) 
       VALUES (2, ?, 2, 4, 200000, 'ACTIVE', NOW())`,
      [randomUUID()]
    );
    // Écriture d'avance locataire (CREDIT_ADVANCE de 300 000 FCFA)
    await conn.query(
      `INSERT INTO tenant_credit_ledger 
       (id, uuid, client_id, transaction_type, amount, running_balance, source_payment_id, created_at) 
       VALUES (1, ?, 3, 'CREDIT_ADVANCE', 300000, 300000, 2, NOW())`,
      [randomUUID()]
    );

    // Règlement 3 : Client 4 (Paiement partiel de 250 000 FCFA par Mobile Money)
    await conn.query(
      `INSERT INTO payments 
       (id, uuid, transaction_reference, receipt_number, client_id, collector_id, property_id, amount_received, payment_method, payment_date, status, is_reversed, created_by, created_at) 
       VALUES (3, ?, 'TR-2026-10-003', 'RC-202610-003', 4, 2, 4, 250000, 'MOBILE_MONEY', '2026-10-05 16:45:00', 'RECEIVED', 0, 6, NOW())`,
      [randomUUID()]
    );
    await conn.query(
      `INSERT INTO payment_allocations (id, uuid, payment_id, invoice_id, allocated_amount, status, created_at) 
       VALUES (3, ?, 3, 5, 250000, 'ACTIVE', NOW())`,
      [randomUUID()]
    );

    // Règlement 4 : Client 5 (600 000 FCFA par Chèque)
    await conn.query(
      `INSERT INTO payments 
       (id, uuid, transaction_reference, receipt_number, client_id, collector_id, property_id, amount_received, payment_method, payment_date, status, is_reversed, created_by, created_at) 
       VALUES (4, ?, 'TR-2026-10-004', 'RC-202610-004', 5, 1, 5, 600000, 'CHEQUE', '2026-10-02 11:00:00', 'RECEIVED', 0, 1, NOW())`,
      [randomUUID()]
    );
    await conn.query(
      `INSERT INTO payment_allocations (id, uuid, payment_id, invoice_id, allocated_amount, status, created_at) 
       VALUES (4, ?, 4, 6, 600000, 'ACTIVE', NOW())`,
      [randomUUID()]
    );

    // Règlement 5 : Client 7 (1 500 000 FCFA par Virement)
    await conn.query(
      `INSERT INTO payments 
       (id, uuid, transaction_reference, receipt_number, client_id, collector_id, property_id, amount_received, payment_method, payment_date, status, is_reversed, created_by, created_at) 
       VALUES (5, ?, 'TR-2026-10-005', 'RC-202610-005', 7, 1, 11, 1500000, 'BANK_TRANSFER', '2026-10-01 09:00:00', 'RECEIVED', 0, 1, NOW())`,
      [randomUUID()]
    );
    await conn.query(
      `INSERT INTO payment_allocations (id, uuid, payment_id, invoice_id, allocated_amount, status, created_at) 
       VALUES (5, ?, 5, 8, 1500000, 'ACTIVE', NOW())`,
      [randomUUID()]
    );

    console.log('✅ 5 encaissements et écritures comptables injectés.');

    // ═══════════════════════════════════════════════════════════════════
    // 8. TRANSACTIONS (Pour l'historique et les graphiques du Dashboard)
    // ═══════════════════════════════════════════════════════════════════
    console.log('📊 Génération des transactions pour le Dashboard...');
    const transactions = [
      { ref: 'RC-04102026-FALL', date: '2026-10-04', cid: 1, cname: 'M. Ibrahima FALL', desc: 'Règlement loyer Octobre 2026 - Villa Les Hibiscus', amount: 850000, method: 'transfer', status: 'processed', collId: 1 },
      { ref: 'RC-03102026-BROU', date: '2026-10-03', cid: 3, cname: 'M. Kévin BROU', desc: 'Règlement loyer Octobre + Avance loyer Novembre', amount: 500000, method: 'cash', status: 'processed', collId: 1 },
      { ref: 'RC-05102026-KOFF', date: '2026-10-05', cid: 4, cname: 'Mme Danielle KOFFI', desc: 'Acompte partiel loyer Octobre 2026', amount: 250000, method: 'mobile_money', status: 'processed', collId: 2 },
      { ref: 'RC-02102026-TECH', date: '2026-10-02', cid: 5, cname: 'SARL Ivoire Tech Innovation', desc: 'Loyer commercial Octobre 2026', amount: 600000, method: 'check', status: 'processed', collId: 1 },
      { ref: 'RC-01102026-BLAA', date: '2026-10-01', cid: 7, cname: 'M. Christian BLA', desc: 'Loyer Penthouse Octobre 2026', amount: 1500000, method: 'transfer', status: 'processed', collId: 1 },
      { ref: 'RC-04112026-PEND', date: '2026-11-04', cid: 6, cname: 'M. Stéphane TOURE', desc: 'Loyer commercial Novembre 2026 en attente', amount: 1200000, method: 'cash', status: 'pending', collId: 2 }
    ];

    for (const t of transactions) {
      const dateDisplay = new Date(t.date).toLocaleDateString('fr-FR');
      await conn.query(
        `INSERT INTO transactions 
         (reference, date, date_display, client_id, client_name, description, amount, method, status, payment_type, collector_id, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'rent', ?, NOW(), NOW())`,
        [t.ref, t.date, dateDisplay, t.cid, t.cname, t.desc, t.amount, t.method, t.status, t.collId]
      );
    }
    console.log('✅ 6 transactions enregistrées pour les KPIs.');

    console.log('\n🎉 JEU DE DONNÉES DÉMO INJECTÉ AVEC SUCCÈS !');
    console.log('----------------------------------------------------');
    console.log('Comptes de test prêts :');
    console.log('  Admin        : admin     / Admin2026!');
    console.log('  Directeur    : directeur / Dir2026!');
    console.log('  Comptable    : comptable / Cpt2026!');
    console.log('  Manager      : manager   / Mgr2026!');
    console.log('  Collecteur 1 : korede    / Korede2026!');
    console.log('  Collecteur 2 : leonce    / Leonce2026!');
    console.log('----------------------------------------------------');

  } catch (error) {
    console.error('❌ Erreur lors du seed :', error);
    throw error;
  } finally {
    conn.release();
  }
}

seed().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
