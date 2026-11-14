/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║     SYGIM v2.0 — JEU DE DONNÉES DE DÉMONSTRATION RÉALISTE GRAND PÉRIMÈTRE    ║
 * ║     Grand Abidjan • Collecteurs avec >10 biens • Tous cas de figure métiers  ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const { pool } = require('../src/config/database');

async function seedComprehensive() {
  console.log('🚀 Démarrage du peuplement exhaustif de la base SYGIM...');
  const conn = await pool.getConnection();

  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    const tables = [
      'activity_logs',
      'alert_acknowledgements',
      'refresh_tokens',
      'tenant_credit_ledger',
      'tenant_repairs',
      'payment_allocations',
      'payments',
      'invoices',
      'owner_settlement_installments',
      'owner_settlements',
      'prefinancings',
      'transactions',
      'clients',
      'properties',
      'owners',
      'collectors',
      'users'
    ];

    console.log('🧹 Purge complète des tables...');
    for (const table of tables) {
      try {
        await conn.query(`TRUNCATE TABLE ${table}`);
      } catch (e) {
        console.warn(`Note: impossible de tronquer ${table} (${e.message})`);
      }
    }
    console.log('✅ Tables purgées avec succès.');

    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    // ═══════════════════════════════════════════════════════════════════
    // 1. UTILISATEURS DU SYSTÈME (7 Comptes Démo)
    // ═══════════════════════════════════════════════════════════════════
    console.log('👤 1. Création des utilisateurs système (7 profils)...');
    const users = [
      { id: 1, username: 'admin', role: 'admin', pass: 'Admin2026!', first: 'Super', last: 'Admin', display: 'Administrateur Général', email: 'admin@sygim.ci', phone: '+225 07 00 00 00 01' },
      { id: 2, username: 'directeur', role: 'director', pass: 'Dir2026!', first: 'Marc', last: 'BAMBA', display: 'Marc BAMBA (Directeur)', email: 'directeur@sygim.ci', phone: '+225 07 00 00 00 02' },
      { id: 3, username: 'comptable', role: 'accounting', pass: 'Comptable2026!', first: 'Sophie', last: 'KOFFI', display: 'Sophie KOFFI (Comptable)', email: 'comptable@sygim.ci', phone: '+225 07 00 00 00 03' },
      { id: 4, username: 'manager', role: 'collector_manager', pass: 'Mgr2026!', first: 'Hervé', last: 'YAO', display: 'Hervé YAO (Resp. Recouvrement)', email: 'manager@sygim.ci', phone: '+225 07 00 00 00 04' },
      { id: 5, username: 'korede', role: 'collector', pass: 'Korede2026!', first: 'Kouassi', last: 'KOREDE', display: 'Kouassi KOREDE (Collecteur)', email: 'korede@sygim.ci', phone: '+225 07 01 02 03 04', collName: 'KOREDE' },
      { id: 6, username: 'leonce', role: 'collector', pass: 'Leonce2026!', first: 'Léonce', last: 'YAO', display: 'Léonce YAO (Collecteur)', email: 'leonce@sygim.ci', phone: '+225 07 05 06 07 08', collName: 'LEONCE' },
      { id: 7, username: 'diabate', role: 'collector', pass: 'Diabate2026!', first: 'Mamadou', last: 'DIABATE', display: 'Mamadou DIABATE (Collecteur)', email: 'diabate@sygim.ci', phone: '+225 07 09 10 11 12', collName: 'DIABATE' }
    ];

    for (const u of users) {
      const hash = await bcrypt.hash(u.pass, 10);
      await conn.query(
        `INSERT INTO users 
         (id, username, password_hash, role, first_name, last_name, display_name, email, phone, collector_name, active, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
        [u.id, u.username, hash, u.role, u.first, u.last, u.display, u.email, u.phone, u.collName || null]
      );
    }
    console.log('✅ 7 utilisateurs créés.');

    // ═══════════════════════════════════════════════════════════════════
    // 2. COLLECTEURS TERRAIN (Couvrant tout le Grand Abidjan)
    // ═══════════════════════════════════════════════════════════════════
    console.log('📱 2. Création des 3 collecteurs terrain régionaux...');
    await conn.query(
      `INSERT INTO collectors (id, first_name, last_name, phone, email, zone, commission_rate, active, user_id, manager_id, created_at, updated_at) VALUES 
       (1, 'Kouassi', 'KOREDE', '+225 07 01 02 03 04', 'korede@sygim.ci', 'Abidjan Nord & Est (Cocody / Riviera / Angré / Bingerville)', 5.00, 1, 5, 4, NOW(), NOW()),
       (2, 'Léonce', 'YAO', '+225 07 05 06 07 08', 'leonce@sygim.ci', 'Abidjan Sud (Marcory / Biétry / Zone 4 / Koumassi / Port-Bouët)', 5.00, 1, 6, 4, NOW(), NOW()),
       (3, 'Mamadou', 'DIABATE', '+225 07 09 10 11 12', 'diabate@sygim.ci', 'Abidjan Ouest & Centre (Yopougon / Plateau / Adjamé / Abobo)', 5.00, 1, 7, 4, NOW(), NOW())`
    );
    console.log('✅ 3 collecteurs terrain configurés.');

    // ═══════════════════════════════════════════════════════════════════
    // 3. PROPRIÉTAIRES (10 Bailleurs avec préférences complètes)
    // ═══════════════════════════════════════════════════════════════════
    console.log('🏛️ 3. Création des 10 propriétaires avec préférences bancaires & Mobile Money...');
    const owners = [
      {
        id: 1,
        first: 'Aminata',
        last: 'KONE',
        display: 'Mme Aminata KONE',
        phone: '+225 01 02 03 04 05',
        email: 'aminata.kone@example.com',
        address: 'Cocody Danga Rue des Jasmins',
        bank: 'SOCIETE GENERALE CI (SGCI)',
        account: 'CI026 01001 012345678901 22',
        method: 'bank_transfer',
        schedule: 'monthly_full',
        day: '5',
        comm: 10
      },
      {
        id: 2,
        first: 'Jean-Marc',
        last: 'KOUAME',
        display: 'M. Jean-Marc KOUAME',
        phone: '+225 05 06 07 08 09',
        email: 'jm.kouame@example.com',
        address: 'Plateau Dokui Boulevard Principal',
        bank: 'NSIA BANQUE CI',
        account: 'CI042 01002 987654321098 44',
        method: 'bank_transfer',
        schedule: 'monthly_full',
        day: '10',
        comm: 8
      },
      {
        id: 3,
        first: 'Bakayoko (SCI Ivoire)',
        last: 'PATRIMOINE',
        display: 'SCI Ivoire Patrimoine (M. Bakayoko)',
        phone: '+225 27 22 44 55 66',
        email: 'direction@ivoirepatrimoine.ci',
        address: 'Plateau Immeuble CCIA 14e étage',
        bank: 'ECOBANK COTE D\'IVOIRE',
        account: 'CI059 01003 456789012345 66',
        method: 'bank_transfer',
        schedule: 'monthly_full',
        day: '5',
        comm: 10
      },
      {
        id: 4,
        first: 'Philippe',
        last: 'DIOMANDE',
        display: 'Dr. Philippe DIOMANDE',
        phone: '+225 07 08 09 10 11',
        email: 'dr.diomande@example.com',
        address: 'Marcory Résidentiel Rue Paul Langevin',
        bank: 'BNI (Banque Nationale d\'Investissement)',
        account: 'CI092 01004 678901234567 88',
        method: 'bank_transfer',
        schedule: 'monthly_split',
        day: '15',
        comm: 12
      },
      {
        id: 5,
        first: 'Salimata',
        last: 'COULIBALY',
        display: 'Mme Salimata COULIBALY',
        phone: '+225 07 07 11 22 33',
        email: 'salimata.coul@example.com',
        address: 'Riviera Golf Cité des Cadres',
        bank: 'WAVE CI',
        account: 'WAVE-+2250707112233',
        method: 'wave',
        schedule: 'monthly_full',
        day: '5',
        comm: 10
      },
      {
        id: 6,
        first: 'Germain',
        last: 'N\'GUESSAN',
        display: 'M. Kouadio Germain N\'GUESSAN',
        phone: '+225 07 48 99 00 11',
        email: 'germain.nguessan@example.com',
        address: 'Yopougon Toit Rouge Carrefour Charly',
        bank: 'ORANGE MONEY CI',
        account: 'OM-+2250748990011',
        method: 'orange_money',
        schedule: 'monthly_full',
        day: '10',
        comm: 10
      },
      {
        id: 7,
        first: 'Alain',
        last: 'TOURE',
        display: 'Maître Alain TOURE',
        phone: '+225 07 88 44 22 00',
        email: 'etude.toure@avocats.ci',
        address: 'Deux Plateaux Vallons Rue des Jardins',
        bank: 'BANK OF AFRICA (BOA CI)',
        account: 'CI032 01005 112233445566 77',
        method: 'bank_transfer',
        schedule: 'monthly_full',
        day: '5',
        comm: 8
      },
      {
        id: 8,
        first: 'Succession Lanciné',
        last: 'BAMBA',
        display: 'Succession Bamba Lanciné',
        phone: '+225 21 24 55 88 99',
        email: 'famille.bamba@example.com',
        address: 'Treichville Boulevard Nanan Yamousso',
        bank: 'CAISSE CENTRALE SYGIM',
        account: 'ESPECES AU SIEGE DE L\'AGENCE',
        method: 'cash',
        schedule: 'monthly_full',
        day: '25',
        comm: 15
      },
      {
        id: 9,
        first: 'Patricia',
        last: 'BROU-DJEDJE',
        display: 'Mme Patricia BROU-DJEDJE',
        phone: '+225 05 05 44 33 22',
        email: 'patricia.brou@example.com',
        address: 'Bingerville Feh Kessé Cité Belle Vue',
        bank: 'MTN MOBILE MONEY CI',
        account: 'MOMO-+2250505443322',
        method: 'mtn_momo',
        schedule: 'monthly_full',
        day: '5',
        comm: 10
      },
      {
        id: 10,
        first: 'Cheick Tidiane',
        last: 'SANOGO',
        display: 'M. Cheick Tidiane SANOGO',
        phone: '+225 01 44 77 88 99',
        email: 'tidiane.sanogo@example.com',
        address: 'Koumassi Remblais Cité Prodomo',
        bank: 'CORIS BANK INTERNATIONAL CI',
        account: 'CI128 01007 889900112233 44',
        method: 'bank_transfer',
        schedule: 'monthly_full',
        day: '10',
        comm: 10
      }
    ];

    for (const o of owners) {
      await conn.query(
        `INSERT INTO owners 
         (id, first_name, last_name, display_name, phone, email, address, bank_name, bank_account, 
          preferred_payment_method, payout_schedule, preferred_payout_day, commission_rate, active, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
        [o.id, o.first, o.last, o.display, o.phone, o.email, o.address, o.bank, o.account, o.method, o.schedule, o.day, o.comm]
      );
    }
    console.log('✅ 10 propriétaires enregistrés avec préférences complètes.');

    // ═══════════════════════════════════════════════════════════════════
    // 4. PARC IMMOBILIER (50 Biens dans tout Abidjan)
    //    • Collecteur 1 (KOREDE)  : 15 biens gérés
    //    • Collecteur 2 (LEONCE)  : 14 biens gérés
    //    • Collecteur 3 (DIABATE) : 13 biens gérés
    //    • Biens vacants / dispos : 6 biens
    //    • En maintenance         : 2 biens
    // ═══════════════════════════════════════════════════════════════════
    console.log('🏡 4. Création des 50 biens immobiliers (répartis sur tout Abidjan)...');

    const properties = [
      // ── ZONE 1 : COCODY / RIVIERA / BINGERVILLE (KOREDE - 15 biens) ──
      { id: 1, name: 'Villa Les Hibiscus - 5P Duplex', address: 'Cocody Ambassades Rue B12', type: 'villa', status: 'loue', value: 220000000, rent: 900000, area: 350, rooms: 5, owner_id: 1, collector_id: 1 },
      { id: 2, name: 'Appartement F4 Palmier Bonoumin', address: 'Riviera Bonoumin Rue Ministre', type: 'appartement', status: 'loue', value: 85000000, rent: 380000, area: 140, rooms: 4, owner_id: 1, collector_id: 1 },
      { id: 3, name: 'Studio Meublé Cocody St-Jean', address: 'Cocody Saint-Jean Cité Universitaire', type: 'studio', status: 'loue', value: 45000000, rent: 200000, area: 45, rooms: 1, owner_id: 2, collector_id: 1 },
      { id: 4, name: 'Villa Duplex Jardin Riviera 3', address: 'Riviera 3 Cité Verdoyante', type: 'villa', status: 'loue', value: 160000000, rent: 750000, area: 280, rooms: 5, owner_id: 3, collector_id: 1 },
      { id: 5, name: 'Appartement F3 Prestige Angré 8e', address: 'Cocody Angré 8e Tranche Résidence Soleil', type: 'appartement', status: 'loue', value: 65000000, rent: 300000, area: 115, rooms: 3, owner_id: 5, collector_id: 1 },
      { id: 6, name: 'Villa Basse 4P Piscine Riviera Golf', address: 'Riviera Golf Rue des Ambassadeurs', type: 'villa', status: 'loue', value: 280000000, rent: 1400000, area: 420, rooms: 4, owner_id: 5, collector_id: 1 },
      { id: 7, name: 'Penthouse F5 Vue Lagune Danga', address: 'Cocody Danga Boulevard de France', type: 'appartement', status: 'loue', value: 310000000, rent: 1600000, area: 290, rooms: 5, owner_id: 7, collector_id: 1 },
      { id: 8, name: 'Appartement F2 Cosy Deux Plateaux', address: 'Deux Plateaux Vallons Rue des Jardins', type: 'appartement', status: 'loue', value: 55000000, rent: 250000, area: 65, rooms: 2, owner_id: 7, collector_id: 1 },
      { id: 9, name: 'Villa Duplex 5P Bingerville', address: 'Bingerville Feh Kessé Lot 24', type: 'villa', status: 'loue', value: 125000000, rent: 500000, area: 260, rooms: 5, owner_id: 9, collector_id: 1 },
      { id: 10, name: 'Appartement F3 Moderne Bingerville', address: 'Bingerville Nouvelle Ville Cité Marine', type: 'appartement', status: 'loue', value: 48000000, rent: 220000, area: 95, rooms: 3, owner_id: 9, collector_id: 1 },
      { id: 11, name: 'Local Commercial Angré Nouveau Goudron', address: 'Cocody Angré Nouveau Goudron Carrefour Petro', type: 'commercial', status: 'loue', value: 90000000, rent: 450000, area: 85, rooms: 2, owner_id: 1, collector_id: 1 },
      { id: 12, name: 'Studio Moderne Riviera Palmeraie', address: 'Riviera Palmeraie Rond-Point Ado', type: 'studio', status: 'loue', value: 35000000, rent: 160000, area: 38, rooms: 1, owner_id: 3, collector_id: 1 },
      { id: 13, name: 'Appartement F4 Duplex Riviera Attoban', address: 'Riviera Attoban Cité BAD', type: 'appartement', status: 'loue', value: 95000000, rent: 420000, area: 155, rooms: 4, owner_id: 3, collector_id: 1 },
      { id: 14, name: 'Villa 6P avec Dépendance Riviera 4', address: 'Riviera 4 Beverly Hills Rue C4', type: 'villa', status: 'loue', value: 350000000, rent: 1800000, area: 500, rooms: 6, owner_id: 7, collector_id: 1 },
      { id: 15, name: 'Bureaux d\'Entreprise 90m² Vallons', address: 'Deux Plateaux Vallons Immeuble Kharrat', type: 'bureau', status: 'loue', value: 140000000, rent: 700000, area: 90, rooms: 3, owner_id: 3, collector_id: 1 },

      // ── ZONE 2 : MARCORY / ZONE 4 / BIÉTRY / KOUMASSI / PORT-BOUËT (LEONCE - 14 biens) ──
      { id: 16, name: 'Appartement F3 La Lagune Biétry', address: 'Marcory Biétry Boulevard de Marseille', type: 'appartement', status: 'loue', value: 95000000, rent: 480000, area: 120, rooms: 3, owner_id: 2, collector_id: 2 },
      { id: 17, name: 'Appartement F4 Standing Zone 4C', address: 'Marcory Zone 4C Rue du Canal', type: 'appartement', status: 'loue', value: 130000000, rent: 650000, area: 160, rooms: 4, owner_id: 4, collector_id: 2 },
      { id: 18, name: 'Studio Cosy Marcory Résidentiel', address: 'Marcory Résidentiel Boulevard Achalme', type: 'studio', status: 'loue', value: 38000000, rent: 180000, area: 42, rooms: 1, owner_id: 4, collector_id: 2 },
      { id: 19, name: 'Villa Duplex Biétry Bord d\'Eau', address: 'Biétry Cité des Cadres Bord de Lagune', type: 'villa', status: 'loue', value: 260000000, rent: 1300000, area: 380, rooms: 5, owner_id: 4, collector_id: 2 },
      { id: 20, name: 'Boutique Commerciale Zone 4 Rue Thomas Edison', address: 'Marcory Zone 4 Rue Thomas Edison', type: 'commercial', status: 'loue', value: 110000000, rent: 550000, area: 75, rooms: 2, owner_id: 3, collector_id: 2 },
      { id: 21, name: 'Appartement F3 Koumassi Remblais', address: 'Koumassi Remblais Face Pharmacie Kahira', type: 'appartement', status: 'loue', value: 50000000, rent: 230000, area: 90, rooms: 3, owner_id: 10, collector_id: 2 },
      { id: 22, name: 'Appartement F4 Cité Prodomo', address: 'Koumassi Remblais Cité Prodomo Bât B', type: 'appartement', status: 'loue', value: 68000000, rent: 310000, area: 125, rooms: 4, owner_id: 10, collector_id: 2 },
      { id: 23, name: 'Studio Moderne Koumassi Divo', address: 'Koumassi Boulevard du Gabon', type: 'studio', status: 'loue', value: 28000000, rent: 130000, area: 32, rooms: 1, owner_id: 10, collector_id: 2 },
      { id: 24, name: 'Boutique Boulevard de Marseille Treichville', address: 'Treichville Boulevard de Marseille Angle Rue 12', type: 'commercial', status: 'loue', value: 85000000, rent: 400000, area: 60, rooms: 1, owner_id: 8, collector_id: 2 },
      { id: 25, name: 'Appartement F3 Treichville Arras', address: 'Treichville Avenue Reine Pokou', type: 'appartement', status: 'loue', value: 42000000, rent: 200000, area: 85, rooms: 3, owner_id: 8, collector_id: 2 },
      { id: 26, name: 'Villa Basse 4P Port-Bouët Vridi', address: 'Port-Bouët Vridi Cité Sir', type: 'villa', status: 'loue', value: 90000000, rent: 420000, area: 240, rooms: 4, owner_id: 4, collector_id: 2 },
      { id: 27, name: 'Appartement F2 Port-Bouët Centre', address: 'Port-Bouët Phare Rue du Commerce', type: 'appartement', status: 'loue', value: 35000000, rent: 170000, area: 55, rooms: 2, owner_id: 8, collector_id: 2 },
      { id: 28, name: 'Local Entrepôt 150m² Zone Industrielle Vridi', address: 'Vridi Zone Industrielle Rue des Pétroliers', type: 'commercial', status: 'loue', value: 180000000, rent: 900000, area: 150, rooms: 2, owner_id: 3, collector_id: 2 },
      { id: 29, name: 'Appartement F3 Marcory Anoumabo', address: 'Marcory Anoumabo Proche Échangeur', type: 'appartement', status: 'loue', value: 40000000, rent: 190000, area: 80, rooms: 3, owner_id: 4, collector_id: 2 },

      // ── ZONE 3 : YOPOUGON / PLATEAU / ADJAMÉ / ABOBO (DIABATE - 13 biens) ──
      { id: 30, name: 'Villa Duplex 5P Yopougon Maroc', address: 'Yopougon Maroc Carrefour Oasis', type: 'villa', status: 'loue', value: 110000000, rent: 450000, area: 250, rooms: 5, owner_id: 6, collector_id: 3 },
      { id: 31, name: 'Appartement F4 Niangon Sud', address: 'Yopougon Niangon Sud Cité Verte', type: 'appartement', status: 'loue', value: 52000000, rent: 240000, area: 120, rooms: 4, owner_id: 6, collector_id: 3 },
      { id: 32, name: 'Studio Moderne Yopougon Toit Rouge', address: 'Yopougon Toit Rouge Proche BAE', type: 'studio', status: 'loue', value: 24000000, rent: 110000, area: 30, rooms: 1, owner_id: 6, collector_id: 3 },
      { id: 33, name: 'Boutique Commerciale Yopougon Bel Air', address: 'Yopougon Bel Air Boulevard Principal', type: 'commercial', status: 'loue', value: 60000000, rent: 280000, area: 55, rooms: 1, owner_id: 6, collector_id: 3 },
      { id: 34, name: 'Appartement F3 Yopougon Sideci', address: 'Yopougon Sideci Carrefour Saint-Pierre', type: 'appartement', status: 'loue', value: 45000000, rent: 210000, area: 88, rooms: 3, owner_id: 6, collector_id: 3 },
      { id: 35, name: 'Local Commercial Plateau Galerie Marchande', address: 'Plateau Rue du Commerce Angle Chardy', type: 'commercial', status: 'loue', value: 140000000, rent: 700000, area: 95, rooms: 2, owner_id: 3, collector_id: 3 },
      { id: 36, name: 'Bureaux Open Space Plateau 130m²', address: 'Plateau Avenue Noguès Immeuble Alpha 2000', type: 'bureau', status: 'loue', value: 250000000, rent: 1250000, area: 130, rooms: 4, owner_id: 3, collector_id: 3 },
      { id: 37, name: 'Appartement F4 Vue Lagune Corniche Plateau', address: 'Plateau Corniche Résidence Les Flamboyants', type: 'appartement', status: 'loue', value: 190000000, rent: 950000, area: 175, rooms: 4, owner_id: 3, collector_id: 3 },
      { id: 38, name: 'Appartement F3 Adjamé 220 Logements', address: 'Adjamé 220 Logements Bâtiment H', type: 'appartement', status: 'loue', value: 38000000, rent: 180000, area: 85, rooms: 3, owner_id: 2, collector_id: 3 },
      { id: 39, name: 'Magasin de Stockage Adjamé Marché', address: 'Adjamé Forum des Marchés Rue 14', type: 'commercial', status: 'loue', value: 75000000, rent: 350000, area: 110, rooms: 1, owner_id: 2, collector_id: 3 },
      { id: 40, name: 'Appartement F3 Abobo Samaké', address: 'Abobo Samaké Face Pharmacie la Paix', type: 'appartement', status: 'loue', value: 32000000, rent: 150000, area: 78, rooms: 3, owner_id: 2, collector_id: 3 },
      { id: 41, name: 'Studio Économique Abobo Baoulé', address: 'Abobo Baoulé Carrefour Église', type: 'studio', status: 'loue', value: 18000000, rent: 85000, area: 28, rooms: 1, owner_id: 6, collector_id: 3 },
      { id: 42, name: 'Villa Basse 4P Yopougon Selmer', address: 'Yopougon Selmer Carrefour CHU', type: 'villa', status: 'loue', value: 80000000, rent: 360000, area: 210, rooms: 4, owner_id: 6, collector_id: 3 },

      // ── BIENS VACANTS / DISPONIBLES À LA LOCATION (6 biens pour tests d'attribution) ──
      { id: 43, name: 'Villa Moderne 5P Riviera Bonoumin (LIBRE)', address: 'Riviera Bonoumin Proche Abidjan Mall', type: 'villa', status: 'disponible', value: 170000000, rent: 800000, area: 300, rooms: 5, owner_id: 1, collector_id: null },
      { id: 44, name: 'Appartement F3 Neuf Plateau Dokui (LIBRE)', address: 'Plateau Dokui Cité Trésor', type: 'appartement', status: 'disponible', value: 55000000, rent: 260000, area: 105, rooms: 3, owner_id: 2, collector_id: null },
      { id: 45, name: 'Studio Aménagé Marcory Zone 4 (LIBRE)', address: 'Marcory Zone 4C Rue du Dr Blanchard', type: 'studio', status: 'disponible', value: 32000000, rent: 150000, area: 35, rooms: 1, owner_id: 4, collector_id: null },
      { id: 46, name: 'Local Commercial Libre Yopougon Niangon (LIBRE)', address: 'Yopougon Niangon Carrefour Lubafrique', type: 'commercial', status: 'disponible', value: 50000000, rent: 240000, area: 65, rooms: 1, owner_id: 6, collector_id: null },
      { id: 47, name: 'Duplex 5P Bingerville Cité Blanche (LIBRE)', address: 'Bingerville Cité Blanche Lot 48', type: 'villa', status: 'disponible', value: 140000000, rent: 600000, area: 275, rooms: 5, owner_id: 9, collector_id: null },
      { id: 48, name: 'Appartement F4 Koumassi Prodomo (LIBRE)', address: 'Koumassi Prodomo Bâtiment E', type: 'appartement', status: 'disponible', value: 65000000, rent: 290000, area: 130, rooms: 4, owner_id: 10, collector_id: null },

      // ── BIENS EN MAINTENANCE / RÉNOVATION (2 biens) ──
      { id: 49, name: 'Villa Duplex en Rénovation Cocody Angré', address: 'Cocody Angré 7e Tranche', type: 'villa', status: 'en_maintenance', value: 150000000, rent: 650000, area: 280, rooms: 5, owner_id: 5, collector_id: null },
      { id: 50, name: 'Appartement F2 Rénovation Peinture Biétry', address: 'Marcory Biétry Rue du Canal', type: 'appartement', status: 'en_maintenance', value: 45000000, rent: 210000, area: 60, rooms: 2, owner_id: 4, collector_id: null }
    ];

    for (const p of properties) {
      await conn.query(
        `INSERT INTO properties 
         (id, name, address, type, status, value, rent, area, rooms, owner_id, collector_id, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [p.id, p.name, p.address, p.type, p.status, p.value, p.rent, p.area, p.rooms, p.owner_id, p.collector_id]
      );
    }
    console.log('✅ 50 biens immobiliers injectés.');

    // ═══════════════════════════════════════════════════════════════════
    // 5. LOCATAIRES (Clients avec TOUS les cas de figure)
    //    • À jour (soldés)
    //    • En avance / créditeurs
    //    • En retard modéré (1 mois)
    //    • En impayé lourd (2-3 mois) -> Éligibles Préfinancement
    //    • Avec Réparations actives imputées sur le loyer
    //    • Locataires partis (historique de départ)
    // ═══════════════════════════════════════════════════════════════════
    console.log('👨‍👩‍👧 5. Création des locataires avec scénarios financiers variés...');

    const clients = [
      // ── COLLECTEUR 1 (KOREDE : 15 locataires) ──
      { id: 1, first: 'Ibrahima', last: 'FALL', phone: '+225 07 48 11 22 33', email: 'ibrahima.fall@example.com', pid: 1, due: 900000, paid: 900000, status: 'paid', cid: 1, oid: 1, start: '2026-01-01', end: '2026-12-31', deposit: 1800000 },
      { id: 2, first: 'Fatou', last: 'TRAORE', phone: '+225 05 55 44 33 22', email: 'fatou.traore@example.com', pid: 2, due: 1140000, paid: 0, status: 'late', cid: 1, oid: 1, start: '2026-02-01', end: '2027-01-31', deposit: 760000 }, // 3 mois d'impayés -> ALERTE ROUGE
      { id: 3, first: 'Kévin', last: 'BROU', phone: '+225 07 77 88 99 00', email: 'kevin.brou@example.com', pid: 3, due: 200000, paid: 200000, status: 'paid', cid: 1, oid: 2, start: '2026-03-01', end: '2027-02-28', deposit: 400000 }, // A une avance de 150 000 FCFA
      { id: 4, first: 'Aïssatou', last: 'DIALLO', phone: '+225 07 12 34 56 78', email: 'aissatou.diallo@example.com', pid: 4, due: 750000, paid: 750000, status: 'paid', cid: 1, oid: 3, start: '2026-01-15', end: '2027-01-14', deposit: 1500000 },
      { id: 5, first: 'Cédric', last: 'GNAHOUE', phone: '+225 01 02 44 88 12', email: 'cedric.gnahoue@example.com', pid: 5, due: 300000, paid: 150000, status: 'partial', cid: 1, oid: 5, start: '2026-04-01', end: '2027-03-31', deposit: 600000 }, // Acompte versé
      { id: 6, first: 'Ambassadeur', last: 'HENDERSON', phone: '+225 07 89 00 11 22', email: 'henderson.residence@diplomatie.org', pid: 6, due: 1400000, paid: 1400000, status: 'paid', cid: 1, oid: 5, start: '2026-01-01', end: '2027-12-31', deposit: 4200000 },
      { id: 7, first: 'Dr. Marc-André', last: 'KOUASSI', phone: '+225 05 66 77 88 99', email: 'dr.kouassi@clinique.ci', pid: 7, due: 1600000, paid: 1600000, status: 'paid', cid: 1, oid: 7, start: '2026-01-01', end: '2026-12-31', deposit: 3200000 },
      { id: 8, first: 'Estelle', last: 'BOHUI', phone: '+225 07 23 45 67 89', email: 'estelle.bohui@example.com', pid: 8, due: 250000, paid: 0, status: 'late', cid: 1, oid: 7, start: '2026-05-01', end: '2027-04-30', deposit: 500000 }, // 1 mois de retard
      { id: 9, first: 'Serge', last: 'KOFFI-KAN', phone: '+225 07 34 56 78 90', email: 'serge.kan@example.com', pid: 9, due: 500000, paid: 500000, status: 'paid', cid: 1, oid: 9, start: '2026-03-01', end: '2027-02-28', deposit: 1000000 }, // AVEC RÉPARATION TOITURE (50k/mois déduits)
      { id: 10, first: 'Marie-Paule', last: 'YACE', phone: '+225 05 45 67 89 01', email: 'mp.yace@example.com', pid: 10, due: 220000, paid: 220000, status: 'paid', cid: 1, oid: 9, start: '2026-06-01', end: '2027-05-31', deposit: 440000 },
      { id: 11, first: 'Pharmacie du Nouveau Goudron', last: 'SARL', phone: '+225 27 22 40 11 22', email: 'contact@pharmacienouveaugoudron.ci', pid: 11, due: 450000, paid: 450000, status: 'paid', cid: 1, oid: 1, start: '2026-01-01', end: '2028-12-31', deposit: 1350000 },
      { id: 12, first: 'Christelle', last: 'N\'DA', phone: '+225 07 56 78 90 12', email: 'christelle.nda@example.com', pid: 12, due: 160000, paid: 0, status: 'pending', cid: 1, oid: 3, start: '2026-11-01', end: '2027-10-31', deposit: 320000 }, // Nouveau contrat de novembre, prêt à être encaissé
      { id: 13, first: 'Olivier', last: 'AMANI', phone: '+225 05 67 89 01 23', email: 'olivier.amani@example.com', pid: 13, due: 420000, paid: 420000, status: 'paid', cid: 1, oid: 3, start: '2026-02-01', end: '2027-01-31', deposit: 840000 },
      { id: 14, first: 'Directeur Général', last: 'SITAB', phone: '+225 27 20 30 40 50', email: 'dg@sitab.ci', pid: 14, due: 1800000, paid: 1800000, status: 'paid', cid: 1, oid: 7, start: '2026-01-01', end: '2027-12-31', deposit: 5400000 },
      { id: 15, first: 'Cabinet Conseil Audit & Fisc', last: 'AFRIQUE', phone: '+225 27 22 41 52 63', email: 'secretariat@caf-afrique.ci', pid: 15, due: 700000, paid: 700000, status: 'paid', cid: 1, oid: 3, start: '2026-01-01', end: '2028-12-31', deposit: 2100000 },

      // ── COLLECTEUR 2 (LEONCE : 14 locataires) ──
      { id: 16, first: 'Danielle', last: 'KOFFI', phone: '+225 01 23 45 67 89', email: 'danielle.koffi@example.com', pid: 16, due: 480000, paid: 480000, status: 'paid', cid: 2, oid: 2, start: '2026-04-01', end: '2027-03-31', deposit: 960000 },
      { id: 17, first: 'Jean-Philippe', last: 'GOUROU', phone: '+225 07 78 90 12 34', email: 'jp.gourou@example.com', pid: 17, due: 1300000, paid: 0, status: 'late', cid: 2, oid: 4, start: '2026-01-01', end: '2026-12-31', deposit: 1300000 }, // 2 mois d'arriérés (1,3M) -> Éligible préfinancement
      { id: 18, first: 'Sandrine', last: 'DJE', phone: '+225 05 89 01 23 45', email: 'sandrine.dje@example.com', pid: 18, due: 180000, paid: 180000, status: 'paid', cid: 2, oid: 4, start: '2026-07-01', end: '2027-06-30', deposit: 360000 },
      { id: 19, first: 'Thierry', last: 'MEITE', phone: '+225 07 90 12 34 56', email: 'thierry.meite@example.com', pid: 19, due: 1300000, paid: 1300000, status: 'paid', cid: 2, oid: 4, start: '2026-01-01', end: '2026-12-31', deposit: 2600000 }, // AVEC RÉPARATION PLOMBERIE (40k/mois déduits)
      { id: 20, first: 'Boutique Mode & Tissus', last: 'PRESTIGE', phone: '+225 21 35 44 88', email: 'contact@modeprestige.ci', pid: 20, due: 550000, paid: 550000, status: 'paid', cid: 2, oid: 3, start: '2026-02-01', end: '2028-01-31', deposit: 1650000 },
      { id: 21, first: 'Lassina', last: 'KONATE', phone: '+225 05 01 23 45 67', email: 'lassina.konate@example.com', pid: 21, due: 230000, paid: 100000, status: 'partial', cid: 2, oid: 10, start: '2026-05-01', end: '2027-04-30', deposit: 460000 },
      { id: 22, first: 'Viviane', last: 'AHOUA', phone: '+225 07 12 98 76 54', email: 'viviane.ahoua@example.com', pid: 22, due: 310000, paid: 310000, status: 'paid', cid: 2, oid: 10, start: '2026-03-01', end: '2027-02-28', deposit: 620000 },
      { id: 23, first: 'Boris', last: 'TIE BI', phone: '+225 05 23 87 65 43', email: 'boris.tiebi@example.com', pid: 23, due: 130000, paid: 130000, status: 'paid', cid: 2, oid: 10, start: '2026-08-01', end: '2027-07-31', deposit: 260000 }, // A une avance de 100 000 FCFA
      { id: 24, first: 'Quincaillerie Générale Treichville', last: 'SARL', phone: '+225 21 25 36 98', email: 'qg.treichville@aviso.ci', pid: 24, due: 400000, paid: 400000, status: 'paid', cid: 2, oid: 8, start: '2026-01-01', end: '2027-12-31', deposit: 1200000 },
      { id: 25, first: 'Moussa', last: 'CAMARA', phone: '+225 07 34 76 54 32', email: 'moussa.camara@example.com', pid: 25, due: 400000, paid: 0, status: 'late', cid: 2, oid: 8, start: '2026-02-01', end: '2027-01-31', deposit: 400000 }, // 2 mois de retard
      { id: 26, first: 'Capitaine', last: 'SORO', phone: '+225 05 45 65 43 21', email: 'capitaine.soro@marine.ci', pid: 26, due: 420000, paid: 420000, status: 'paid', cid: 2, oid: 4, start: '2026-01-01', end: '2026-12-31', deposit: 840000 },
      { id: 27, first: 'Adèle', last: 'BAMBA', phone: '+225 07 56 54 32 10', email: 'adele.bamba@example.com', pid: 27, due: 170000, paid: 170000, status: 'paid', cid: 2, oid: 8, start: '2026-06-01', end: '2027-05-31', deposit: 340000 },
      { id: 28, first: 'Logistique Transit International', last: 'LTI-CI', phone: '+225 21 27 88 00', email: 'exploitation@lti-ci.com', pid: 28, due: 900000, paid: 900000, status: 'paid', cid: 2, oid: 3, start: '2026-01-01', end: '2028-12-31', deposit: 2700000 },
      { id: 29, first: 'Koffi', last: 'ANOH', phone: '+225 05 67 43 21 09', email: 'koffi.anoh@example.com', pid: 29, due: 190000, paid: 0, status: 'pending', cid: 2, oid: 4, start: '2026-11-01', end: '2027-10-31', deposit: 380000 }, // À encaisser

      // ── COLLECTEUR 3 (DIABATE : 13 locataires) ──
      { id: 30, first: 'Kouakou', last: 'N\'DRI', phone: '+225 07 68 32 10 98', email: 'kouakou.ndri@example.com', pid: 30, due: 450000, paid: 450000, status: 'paid', cid: 3, oid: 6, start: '2026-01-01', end: '2026-12-31', deposit: 900000 },
      { id: 31, first: 'Clarisse', last: 'YAPO', phone: '+225 05 79 21 09 87', email: 'clarisse.yapo@example.com', pid: 31, due: 240000, paid: 240000, status: 'paid', cid: 3, oid: 6, start: '2026-03-01', end: '2027-02-28', deposit: 480000 }, // AVEC RÉPARATION SERRURERIE (20k/mois déduits)
      { id: 32, first: 'Arsène', last: 'GBAKA', phone: '+225 07 80 10 98 76', email: 'arsene.gbaka@example.com', pid: 32, due: 110000, paid: 110000, status: 'paid', cid: 3, oid: 6, start: '2026-07-01', end: '2027-06-30', deposit: 220000 },
      { id: 33, first: 'Boulangerie Pâtisserie', last: 'L\'EPI D\'OR', phone: '+225 23 45 67 89', email: 'lepidor.yop@aviso.ci', pid: 33, due: 280000, paid: 280000, status: 'paid', cid: 3, oid: 6, start: '2026-01-01', end: '2027-12-31', deposit: 840000 },
      { id: 34, first: 'Honorine', last: 'KOUASSI', phone: '+225 05 91 09 87 65', email: 'honorine.kouassi@example.com', pid: 34, due: 210000, paid: 100000, status: 'partial', cid: 3, oid: 6, start: '2026-04-01', end: '2027-03-31', deposit: 420000 },
      { id: 35, first: 'SARL Ivoire Tech', last: 'INNOVATION', phone: '+225 27 20 21 22 23', email: 'direction@ivoiretech.ci', pid: 35, due: 700000, paid: 700000, status: 'paid', cid: 3, oid: 3, start: '2026-01-01', end: '2028-12-31', deposit: 2100000 },
      { id: 36, first: 'Cabinet d\'Avocats Associés', last: 'JURIS-AFRICA', phone: '+225 27 20 33 44 55', email: 'contact@juris-africa.ci', pid: 36, due: 1250000, paid: 1250000, status: 'paid', cid: 3, oid: 3, start: '2026-01-01', end: '2027-12-31', deposit: 3750000 },
      { id: 37, first: 'Christian', last: 'BLA', phone: '+225 05 12 34 56 78', email: 'c.bla@example.com', pid: 37, due: 950000, paid: 950000, status: 'paid', cid: 3, oid: 3, start: '2026-01-01', end: '2026-12-31', deposit: 1900000 },
      { id: 38, first: 'Yacouba', last: 'SANOGO', phone: '+225 07 02 98 76 54', email: 'yacouba.sanogo@example.com', pid: 38, due: 360000, paid: 0, status: 'late', cid: 3, oid: 2, start: '2026-02-01', end: '2027-01-31', deposit: 360000 }, // 2 mois de retard
      { id: 39, first: 'Société Ivoirienne de Négoce', last: 'SIN-CI', phone: '+225 27 20 44 55 66', email: 'negoce@sin-ci.com', pid: 39, due: 350000, paid: 350000, status: 'paid', cid: 3, oid: 2, start: '2026-01-01', end: '2028-12-31', deposit: 1050000 },
      { id: 40, first: 'Mamadou', last: 'FOFANA', phone: '+225 05 13 87 65 43', email: 'mamadou.fofana@example.com', pid: 40, due: 150000, paid: 150000, status: 'paid', cid: 3, oid: 2, start: '2026-05-01', end: '2027-04-30', deposit: 300000 },
      { id: 41, first: 'Awa', last: 'COULIBALY', phone: '+225 07 24 76 54 32', email: 'awa.coulibaly@example.com', pid: 41, due: 85000, paid: 0, status: 'pending', cid: 3, oid: 6, start: '2026-11-01', end: '2027-10-31', deposit: 170000 }, // À encaisser
      { id: 42, first: 'Gaston', last: 'ZOUZOUA', phone: '+225 05 35 65 43 21', email: 'gaston.zouzoua@example.com', pid: 42, due: 360000, paid: 360000, status: 'paid', cid: 3, oid: 6, start: '2026-01-01', end: '2026-12-31', deposit: 720000 },

      // ── LOCATAIRES AYANT QUITTÉ LES LIEUX (HISTORIQUE DÉPART / ANCIENS BAUX) ──
      { id: 43, first: 'Stéphane', last: 'TOURE (ANCIEN)', phone: '+225 07 99 88 77 66', email: 'stephane.toure@example.com', pid: 43, due: 0, paid: 0, status: 'departed', cid: 1, oid: 1, start: '2025-01-01', end: '2026-10-31', deposit: 1600000, departed: '2026-10-31', reason: 'Achat de résidence personnelle', notes: 'État des lieux de sortie impeccable, clés restituées, caution remboursée.' },
      { id: 44, first: 'Paul', last: 'KOUADIO (ANCIEN)', phone: '+225 05 11 22 33 44', email: 'paul.kouadio@example.com', pid: 44, due: 0, paid: 0, status: 'departed', cid: 2, oid: 2, start: '2025-06-01', end: '2026-09-30', deposit: 520000, departed: '2026-09-30', reason: 'Mutation professionnelle à San-Pédro', notes: 'Logement nettoyé et remis en disponibilité.' }
    ];

    for (const c of clients) {
      const prop = properties.find(p => p.id === c.pid);
      await conn.query(
        `INSERT INTO clients 
         (id, first_name, last_name, phone, email, address, property_id, property_name, property_value, 
          amount_due, amount_paid, status, collector_id, owner_id, deposit, contract_start, contract_end, 
          departure_date, departure_reason, departure_notes, join_date, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '01/01/2026', NOW(), NOW())`,
        [
          c.id, c.first, c.last, c.phone, c.email, prop?.address || '', c.pid, prop?.name || '', 
          c.due, c.paid, c.status, c.cid, c.oid, c.deposit, c.start, c.end,
          c.departed || null, c.reason || null, c.notes || null
        ]
      );

      // Associer le locataire au bien si actif (non parti)
      if (c.status !== 'departed') {
        await conn.query('UPDATE properties SET tenant_id = ? WHERE id = ?', [c.id, c.pid]);
      }
    }
    console.log(`✅ ${clients.length} locataires créés avec tous les profils de recouvrement.`);

    // ═══════════════════════════════════════════════════════════════════
    // 6. MODULE RÉPARATIONS & TRAVAUX IMPUTÉS SUR LE LOYER (`tenant_repairs`)
    // ═══════════════════════════════════════════════════════════════════
    console.log('🔧 6. Enregistrement des réparations imputées sur le loyer locataire...');

    const repairs = [
      {
        id: 1,
        clientId: 9, // Serge KOFFI-KAN (Villa Bingerville, loyer 500k)
        propertyId: 9,
        collectorId: 1,
        desc: 'Réfection étanchéité toiture suite fortes pluies et infiltration',
        total: 150000,
        mode: 'monthly',
        monthly: 50000,
        reimbursed: 50000,
        remaining: 100000,
        date: '2026-10-15',
        ref: 'FAC-TOIT-2026-09',
        status: 'ACTIVE',
        notes: 'Travaux validés par le propriétaire. Déduction de 50 000 FCFA/mois sur 3 mois.'
      },
      {
        id: 2,
        clientId: 19, // Thierry MEITE (Villa Biétry, loyer 1,3M)
        propertyId: 19,
        collectorId: 2,
        desc: 'Remplacement pompe de surpresseur et robinetterie générale',
        total: 120000,
        mode: 'monthly',
        monthly: 40000,
        reimbursed: 40000,
        remaining: 80000,
        date: '2026-10-20',
        ref: 'FAC-PLOMB-2026-19',
        status: 'ACTIVE',
        notes: 'Devis plomberie approuvé par Dr Diomandé. Imputation mensuelle de 40 000 FCFA.'
      },
      {
        id: 3,
        clientId: 31, // Clarisse YAPO (Appartement Yopougon, loyer 240k)
        propertyId: 31,
        collectorId: 3,
        desc: 'Changement serrure de sécurité blindée et poignées',
        total: 60000,
        mode: 'monthly',
        monthly: 20000,
        reimbursed: 20000,
        remaining: 40000,
        date: '2026-10-28',
        ref: 'FAC-SERR-2026-31',
        status: 'ACTIVE',
        notes: 'Clés restituées avec facture acquittée du serrurier.'
      },
      {
        id: 4,
        clientId: 1, // Ibrahima FALL (Villa Cocody Ambassades)
        propertyId: 1,
        collectorId: 1,
        desc: 'Réparation climatiseur split salon et recharge gaz R410',
        total: 80000,
        mode: 'monthly',
        monthly: 40000,
        reimbursed: 80000,
        remaining: 0,
        date: '2026-08-10',
        ref: 'FAC-CLIM-2026-01',
        status: 'SETTLED',
        notes: 'Réparation entièrement amortie sur les loyers de septembre et octobre 2026.'
      }
    ];

    for (const r of repairs) {
      await conn.query(
        `INSERT INTO tenant_repairs 
         (id, client_id, property_id, collector_id, description, total_cost, deduction_mode, 
          monthly_deduction, reimbursed_amount, remaining_amount, repair_date, receipt_ref, status, notes, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [r.id, r.clientId, r.propertyId, r.collectorId, r.desc, r.total, r.mode, r.monthly, r.reimbursed, r.remaining, r.date, r.ref, r.status, r.notes]
      );
    }
    console.log('✅ 4 dossiers de réparation enregistrés (3 actifs, 1 soldé).');

    // ═══════════════════════════════════════════════════════════════════
    // 7. GRAND LIVRE D'AVANCES LOCATAIRES (`tenant_credit_ledger`)
    // ═══════════════════════════════════════════════════════════════════
    console.log('📖 7. Inscription des avances locataires au Grand Livre Créditeur...');

    await conn.query(
      `INSERT INTO tenant_credit_ledger 
       (id, uuid, client_id, transaction_type, amount, running_balance, source_payment_id, created_at) VALUES 
       (1, ?, 3, 'CREDIT_ADVANCE', 150000, 150000, NULL, '2026-10-05 10:00:00'),
       (2, ?, 23, 'CREDIT_ADVANCE', 100000, 100000, NULL, '2026-10-06 14:30:00')`,
      [randomUUID(), randomUUID()]
    );
    console.log('✅ Avances locataires créditées au Grand Livre.');

    // ═══════════════════════════════════════════════════════════════════
    // 8. FACTURES DE LOYER (Invoices sur Octobre & Novembre 2026)
    // ═══════════════════════════════════════════════════════════════════
    console.log('📄 8. Émission des factures de loyer mensuelles...');

    let invoiceCounter = 1;
    for (const c of clients) {
      if (c.status === 'departed') continue;
      const prop = properties.find(p => p.id === c.pid);
      if (!prop) continue;

      const isLateMultiMonth = c.id === 2 || c.id === 17 || c.id === 25 || c.id === 38;
      
      // Facture du mois d'octobre (si impayé multi-mois)
      if (isLateMultiMonth) {
        await conn.query(
          `INSERT INTO invoices 
           (id, uuid, invoice_number, client_id, property_id, invoice_type, billing_period_start, billing_period_end, 
            contract_rent_applied, base_amount, total_amount, paid_amount, status, due_date, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, 'RENT_FULL', '2026-10-01', '2026-10-31', ?, ?, ?, 0, 'PENDING', '2026-10-05', '2026-10-01 08:00:00', NOW())`,
          [invoiceCounter, randomUUID(), `FAC-2026-10-${String(invoiceCounter).padStart(3, '0')}`, c.id, c.pid, prop.rent, prop.rent, prop.rent]
        );
        invoiceCounter++;
      }

      // Facture du mois courant (Novembre 2026)
      const isPaid = c.status === 'paid';
      const isPartial = c.status === 'partial';
      const paidAmt = isPaid ? c.due : (isPartial ? c.paid : 0);
      const statusInv = isPaid ? 'PAID' : (isPartial ? 'PARTIALLY_PAID' : 'PENDING');

      await conn.query(
        `INSERT INTO invoices 
         (id, uuid, invoice_number, client_id, property_id, invoice_type, billing_period_start, billing_period_end, 
            contract_rent_applied, base_amount, total_amount, paid_amount, status, due_date, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, 'RENT_FULL', '2026-11-01', '2026-11-30', ?, ?, ?, ?, ?, '2026-11-05', '2026-11-01 08:00:00', NOW())`,
        [invoiceCounter, randomUUID(), `FAC-2026-11-${String(invoiceCounter).padStart(3, '0')}`, c.id, c.pid, prop.rent, prop.rent, prop.rent, paidAmt, statusInv]
      );
      invoiceCounter++;
    }
    console.log(`✅ ${invoiceCounter - 1} factures générées avec suivi des soldes.`);

    // ═══════════════════════════════════════════════════════════════════
    // 9. ENCAISSEMENTS & HISTORIQUE DES TRANSACTIONS (Grand Livre & KPIs)
    // ═══════════════════════════════════════════════════════════════════
    console.log('💰 9. Enregistrement des encaissements physiques et transactions comptables...');

    const transactionsData = [
      // ── Encaissements récents Novembre 2026 ──
      { ref: 'RC-202611-001', date: '2026-11-02', cid: 1, cname: 'Ibrahima FALL', desc: 'Loyer Novembre 2026 - Villa Les Hibiscus (Cocody)', amount: 900000, method: 'transfer', status: 'processed', collId: 1 },
      { ref: 'RC-202611-002', date: '2026-11-03', cid: 3, cname: 'Kévin BROU', desc: 'Loyer Novembre 2026 - Studio Cocody St-Jean', amount: 200000, method: 'cash', status: 'processed', collId: 1 },
      { ref: 'RC-202611-003', date: '2026-11-04', cid: 4, cname: 'Aïssatou DIALLO', desc: 'Loyer Novembre 2026 - Villa Duplex Riviera 3', amount: 750000, method: 'mobile_money', status: 'processed', collId: 1 },
      { ref: 'RC-202611-004', date: '2026-11-04', cid: 5, cname: 'Cédric GNAHOUE', desc: 'Acompte 50% loyer Novembre 2026 - Angré 8e', amount: 150000, method: 'mobile_money', status: 'processed', collId: 1 },
      { ref: 'RC-202611-005', date: '2026-11-01', cid: 6, cname: 'Ambassadeur HENDERSON', desc: 'Loyer diplomatique Novembre 2026 - Riviera Golf', amount: 1400000, method: 'transfer', status: 'processed', collId: 1 },
      { ref: 'RC-202611-006', date: '2026-11-03', cid: 7, cname: 'Dr. Marc-André KOUASSI', desc: 'Loyer Penthouse Danga Novembre 2026', amount: 1600000, method: 'transfer', status: 'processed', collId: 1 },
      { ref: 'RC-202611-007', date: '2026-11-04', cid: 9, cname: 'Serge KOFFI-KAN', desc: 'Loyer Novembre 2026 (Déduction Réparation 50k incluse)', amount: 450000, method: 'transfer', status: 'processed', collId: 1 },
      { ref: 'RC-202611-008', date: '2026-11-05', cid: 10, cname: 'Marie-Paule YACE', desc: 'Loyer Novembre 2026 - Bingerville Nouvelle Ville', amount: 220000, method: 'mobile_money', status: 'processed', collId: 1 },
      { ref: 'RC-202611-009', date: '2026-11-02', cid: 11, cname: 'Pharmacie Nouveau Goudron', desc: 'Loyer Commercial Novembre 2026 - Angré', amount: 450000, method: 'check', status: 'processed', collId: 1 },
      { ref: 'RC-202611-010', date: '2026-11-02', cid: 13, cname: 'Olivier AMANI', desc: 'Loyer Novembre 2026 - Riviera Attoban', amount: 420000, method: 'transfer', status: 'processed', collId: 1 },
      { ref: 'RC-202611-011', date: '2026-11-01', cid: 14, cname: 'Directeur Général SITAB', desc: 'Loyer Villa Riviera 4 Novembre 2026', amount: 1800000, method: 'transfer', status: 'processed', collId: 1 },
      { ref: 'RC-202611-012', date: '2026-11-02', cid: 15, cname: 'Cabinet Conseil Audit', desc: 'Loyer Bureaux Vallons Novembre 2026', amount: 700000, method: 'check', status: 'processed', collId: 1 },

      // Zone Sud (Léonce)
      { ref: 'RC-202611-013', date: '2026-11-03', cid: 16, cname: 'Danielle KOFFI', desc: 'Loyer Novembre 2026 - Biétry Bord Lagune', amount: 480000, method: 'mobile_money', status: 'processed', collId: 2 },
      { ref: 'RC-202611-014', date: '2026-11-04', cid: 18, cname: 'Sandrine DJE', desc: 'Loyer Novembre 2026 - Studio Marcory Résidentiel', amount: 180000, method: 'cash', status: 'processed', collId: 2 },
      { ref: 'RC-202611-015', date: '2026-11-02', cid: 19, cname: 'Thierry MEITE', desc: 'Loyer Novembre 2026 (Déduction Réparation 40k)', amount: 1260000, method: 'transfer', status: 'processed', collId: 2 },
      { ref: 'RC-202611-016', date: '2026-11-03', cid: 20, cname: 'Boutique Mode Prestige', desc: 'Loyer Commercial Novembre 2026 - Zone 4', amount: 550000, method: 'check', status: 'processed', collId: 2 },
      { ref: 'RC-202611-017', date: '2026-11-05', cid: 21, cname: 'Lassina KONATE', desc: 'Acompte partiel loyer Novembre 2026 - Koumassi', amount: 100000, method: 'mobile_money', status: 'processed', collId: 2 },
      { ref: 'RC-202611-018', date: '2026-11-04', cid: 22, cname: 'Viviane AHOUA', desc: 'Loyer Novembre 2026 - Cité Prodomo Bât B', amount: 310000, method: 'cash', status: 'processed', collId: 2 },
      { ref: 'RC-202611-019', date: '2026-11-03', cid: 23, cname: 'Boris TIE BI', desc: 'Loyer Novembre 2026 - Studio Koumassi Divo', amount: 130000, method: 'cash', status: 'processed', collId: 2 },
      { ref: 'RC-202611-020', date: '2026-11-02', cid: 24, cname: 'Quincaillerie Treichville', desc: 'Loyer Commercial Treichville Bd Marseille', amount: 400000, method: 'transfer', status: 'processed', collId: 2 },
      { ref: 'RC-202611-021', date: '2026-11-01', cid: 26, cname: 'Capitaine SORO', desc: 'Loyer Villa Vridi Cité Sir Novembre 2026', amount: 420000, method: 'transfer', status: 'processed', collId: 2 },
      { ref: 'RC-202611-022', date: '2026-11-04', cid: 27, cname: 'Adèle BAMBA', desc: 'Loyer Appartement Port-Bouët Novembre 2026', amount: 170000, method: 'mobile_money', status: 'processed', collId: 2 },
      { ref: 'RC-202611-023', date: '2026-11-01', cid: 28, cname: 'Logistique Transit Inter.', desc: 'Loyer Entrepôt Vridi 150m² Novembre 2026', amount: 900000, method: 'transfer', status: 'processed', collId: 2 },

      // Zone Ouest (Diabaté)
      { ref: 'RC-202611-024', date: '2026-11-03', cid: 30, cname: 'Kouakou N\'DRI', desc: 'Loyer Villa Yopougon Maroc Novembre 2026', amount: 450000, method: 'cash', status: 'processed', collId: 3 },
      { ref: 'RC-202611-025', date: '2026-11-04', cid: 31, cname: 'Clarisse YAPO', desc: 'Loyer Niangon Sud (Déduction Serrure 20k)', amount: 220000, method: 'mobile_money', status: 'processed', collId: 3 },
      { ref: 'RC-202611-026', date: '2026-11-02', cid: 32, cname: 'Arsène GBAKA', desc: 'Loyer Studio Yopougon Toit Rouge Novembre 2026', amount: 110000, method: 'cash', status: 'processed', collId: 3 },
      { ref: 'RC-202611-027', date: '2026-11-03', cid: 33, cname: 'Boulangerie L\'EPI D\'OR', desc: 'Loyer Commercial Bel Air Novembre 2026', amount: 280000, method: 'check', status: 'processed', collId: 3 },
      { ref: 'RC-202611-028', date: '2026-11-05', cid: 34, cname: 'Honorine KOUASSI', desc: 'Acompte partiel loyer Yopougon Sideci', amount: 100000, method: 'mobile_money', status: 'processed', collId: 3 },
      { ref: 'RC-202611-029', date: '2026-11-01', cid: 35, cname: 'SARL Ivoire Tech', desc: 'Loyer Commercial Plateau Galerie Marchande', amount: 700000, method: 'check', status: 'processed', collId: 3 },
      { ref: 'RC-202611-030', date: '2026-11-02', cid: 36, cname: 'Cabinet JURIS-AFRICA', desc: 'Loyer Bureaux Plateau Avenue Noguès', amount: 1250000, method: 'transfer', status: 'processed', collId: 3 },
      { ref: 'RC-202611-031', date: '2026-11-03', cid: 37, cname: 'Christian BLA', desc: 'Loyer Appartement Corniche Plateau', amount: 950000, method: 'transfer', status: 'processed', collId: 3 },
      { ref: 'RC-202611-032', date: '2026-11-03', cid: 39, cname: 'SIN-CI Négoce', desc: 'Loyer Magasin Adjamé Forum', amount: 350000, method: 'transfer', status: 'processed', collId: 3 },
      { ref: 'RC-202611-033', date: '2026-11-04', cid: 40, cname: 'Mamadou FOFANA', desc: 'Loyer Abobo Samaké Novembre 2026', amount: 150000, method: 'mobile_money', status: 'processed', collId: 3 },
      { ref: 'RC-202611-034', date: '2026-11-02', cid: 42, cname: 'Gaston ZOUZOUA', desc: 'Loyer Villa Yopougon Selmer Novembre 2026', amount: 360000, method: 'cash', status: 'processed', collId: 3 },

      // En attente pour test direct d'encaissement
      { ref: 'RC-202611-035', date: '2026-11-08', cid: 12, cname: 'Christelle N\'DA', desc: 'Loyer en attente d\'encaissement - Riviera Palmeraie', amount: 160000, method: 'cash', status: 'pending', collId: 1 },
      { ref: 'RC-202611-036', date: '2026-11-08', cid: 29, cname: 'Koffi ANOH', desc: 'Loyer en attente d\'encaissement - Marcory Anoumabo', amount: 190000, method: 'mobile_money', status: 'pending', collId: 2 },
      { ref: 'RC-202611-037', date: '2026-11-08', cid: 41, cname: 'Awa COULIBALY', desc: 'Loyer en attente d\'encaissement - Abobo Baoulé', amount: 85000, method: 'cash', status: 'pending', collId: 3 }
    ];

    for (const t of transactionsData) {
      const dateDisplay = new Date(t.date).toLocaleDateString('fr-FR');
      await conn.query(
        `INSERT INTO transactions 
         (reference, date, date_display, client_id, client_name, description, amount, method, status, payment_type, collector_id, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'rent', ?, NOW(), NOW())`,
        [t.ref, t.date, dateDisplay, t.cid, t.cname, t.desc, t.amount, t.method, t.status, t.collId]
      );
    }
    console.log(`✅ ${transactionsData.length} transactions enregistrées pour le Dashboard.`);

    // ═══════════════════════════════════════════════════════════════════
    // 10. GESTION COMPTABLE : REVERSEMENTS PROPRIÉTAIRES & PRÉFINANCEMENTS
    //     (`owner_settlements` & `owner_settlement_installments`)
    // ═══════════════════════════════════════════════════════════════════
    console.log('📊 10. Enregistrement des règlements propriétaires, échelonnements et préfinancements...');

    const settlementsData = [
      // ── CAS A : Reversements intégraux réglés (Mois d'Octobre & Novembre) ──
      {
        id: 1,
        ownerId: 1, // Aminata KONE (10%)
        propertyId: 1,
        start: '2026-10-01',
        end: '2026-10-31',
        collected: 900000,
        expected: 900000,
        commRate: 10,
        commAmount: 90000,
        maint: 0,
        net: 810000,
        paid: 810000,
        status: 'PAID',
        payoutDate: '2026-10-05',
        ref: 'VIR-SGCI-202610-001',
        method: 'bank_transfer',
        mode: 'full',
        isPrefinanced: 0,
        notes: 'Reversement intégral loyer Octobre 2026 par virement SGCI.'
      },
      {
        id: 2,
        ownerId: 3, // SCI Ivoire Patrimoine (10%)
        propertyId: 4,
        start: '2026-10-01',
        end: '2026-10-31',
        collected: 2750000,
        expected: 2750000,
        commRate: 10,
        commAmount: 275000,
        maint: 0,
        net: 2475000,
        paid: 2475000,
        status: 'PAID',
        payoutDate: '2026-10-05',
        ref: 'VIR-ECOBANK-202610-003',
        method: 'bank_transfer',
        mode: 'full',
        isPrefinanced: 0,
        notes: 'Reversement groupé loyers commerciaux et résidentiels Ecobank.'
      },
      {
        id: 3,
        ownerId: 5, // Salimata COULIBALY (Wave)
        propertyId: 5,
        start: '2026-10-01',
        end: '2026-10-31',
        collected: 1700000,
        expected: 1700000,
        commRate: 10,
        commAmount: 170000,
        maint: 0,
        net: 1530000,
        paid: 1530000,
        status: 'PAID',
        payoutDate: '2026-10-05',
        ref: 'WAVE-TR-202610-005',
        method: 'wave',
        mode: 'full',
        isPrefinanced: 0,
        notes: 'Reversement instantané Wave sur compte Mme Coulibaly.'
      },

      // ── CAS B : Règlement échelonné en cours (50% payé, reste à payer) ──
      {
        id: 4,
        ownerId: 4, // Dr Philippe DIOMANDE (12%)
        propertyId: 19,
        start: '2026-11-01',
        end: '2026-11-30',
        collected: 1300000,
        expected: 1300000,
        commRate: 12,
        commAmount: 156000,
        maint: 40000, // Déduction plomberie
        net: 1104000,
        paid: 600000, // Première tranche versée
        status: 'PARTIALLY_PAID',
        payoutDate: '2026-11-05',
        ref: 'VIR-BNI-202611-TR1',
        method: 'bank_transfer',
        mode: 'installment',
        isPrefinanced: 0,
        notes: 'Tranche 1/2 versée (600 000 FCFA). Solde de 504 000 FCFA prévu le 15 novembre.'
      },

      // ── CAS C : PRÉFINANCEMENT AGENCE ACTIF (Avance agence sur loyer locataire impayé) ──
      {
        id: 5,
        ownerId: 1, // Aminata KONE (locataire Fatou TRAORE en retard de 3 mois)
        propertyId: 2,
        start: '2026-11-01',
        end: '2026-11-30',
        collected: 0, // Rien encaissé du locataire
        expected: 380000,
        commRate: 10,
        commAmount: 38000,
        maint: 0,
        net: 342000,
        paid: 342000, // L'agence a avancé 342 000 FCFA à la propriétaire !
        status: 'PREFINANCED',
        payoutDate: '2026-11-05',
        ref: 'PREFIN-AGENCE-202611-001',
        method: 'bank_transfer',
        mode: 'prefinancing',
        isPrefinanced: 1,
        notes: 'Avance agence garantie bailleur. Locataire Fatou Traoré en retard de paiement.'
      },
      {
        id: 6,
        ownerId: 4, // Dr DIOMANDE (locataire Jean-Philippe Gouro en retard)
        propertyId: 17,
        start: '2026-11-01',
        end: '2026-11-30',
        collected: 0,
        expected: 650000,
        commRate: 12,
        commAmount: 78000,
        maint: 0,
        net: 572000,
        paid: 572000, // Avancé par l'agence
        status: 'PREFINANCED',
        payoutDate: '2026-11-05',
        ref: 'PREFIN-AGENCE-202611-002',
        method: 'bank_transfer',
        mode: 'prefinancing',
        isPrefinanced: 1,
        notes: 'Avance de trésorerie agence sur loyer F4 Zone 4C.'
      },

      // ── CAS D : Préfinancement remboursé (L'avance agence a été récupérée) ──
      {
        id: 7,
        ownerId: 6, // Germain N'GUESSAN (Yopougon)
        propertyId: 30,
        start: '2026-09-01',
        end: '2026-09-30',
        collected: 450000,
        expected: 450000,
        commRate: 10,
        commAmount: 45000,
        maint: 0,
        net: 405000,
        paid: 405000,
        status: 'REIMBURSED',
        payoutDate: '2026-09-05',
        ref: 'PREFIN-SOLDE-202609-001',
        method: 'orange_money',
        mode: 'prefinancing',
        isPrefinanced: 1,
        notes: 'Préfinancement de septembre intégralement remboursé suite au règlement du locataire.'
      }
    ];

    for (const s of settlementsData) {
      await conn.query(
        `INSERT INTO owner_settlements 
         (id, uuid, owner_id, property_id, period_start, period_end, expected_rent, total_collected, 
          commission_rate, agency_commission, maintenance_deductions, net_owner_payout, amount_paid, 
          payment_method, payout_mode, is_prefinanced, status, payout_date, payout_reference, notes, created_by, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 3, NOW())`,
        [
          s.id, randomUUID(), s.ownerId, s.propertyId, s.start, s.end, s.expected, s.collected,
          s.commRate, s.commAmount, s.maint, s.net, s.paid,
          s.method, s.mode, s.isPrefinanced, s.status, s.payoutDate, s.ref, s.notes
        ]
      );
    }

    // Inscription de la tranche 1 du règlement échelonné #4
    await conn.query(
      `INSERT INTO owner_settlement_installments 
       (id, settlement_id, installment_number, amount, payment_method, payment_date, reference, notes, created_by, created_at) VALUES 
       (1, 4, 1, 600000, 'bank_transfer', '2026-11-05', 'VIR-BNI-202611-TR1', 'Premier versement 50%', 3, NOW())`
    );

    console.log('✅ Règlements, tranches et préfinancements créés.');

    // ═══════════════════════════════════════════════════════════════════
    // 11. JOURNAUX D'ACTIVITÉ RÉCENTS (`activity_logs`)
    // ═══════════════════════════════════════════════════════════════════
    console.log('📝 11. Génération des journaux d\'audit et activité...');
    const now = new Date();
    const timeStr = now.toLocaleTimeString('fr-FR');
    const dateStr = now.toISOString().slice(0, 10);

    const logs = [
      { type: 'payment', msg: 'Encaissement de 900 000 XOF validé pour Ibrahima FALL (Villa Les Hibiscus)', uid: 5, uname: 'Kouassi KOREDE' },
      { type: 'repair', msg: 'Dossier réparation toiture validé pour Serge KOFFI-KAN (-50 000 XOF/mois)', uid: 5, uname: 'Kouassi KOREDE' },
      { type: 'settlement', msg: 'Versement propriétaire de 810 000 XOF exécuté vers Mme Aminata KONE (SGCI)', uid: 3, uname: 'Sophie KOFFI' },
      { type: 'prefinancing', msg: 'Préfinancement de 342 000 XOF accordé pour le bien de Mme Aminata KONE', uid: 3, uname: 'Sophie KOFFI' },
      { type: 'departure', msg: 'Départ locataire confirmé pour M. Stéphane TOURE (Villa Riviera 4 libérée)', uid: 1, uname: 'Administrateur' }
    ];

    for (const l of logs) {
      await conn.query(
        `INSERT INTO activity_logs (type, message, user_id, user_name, ip_address, date, time, created_at) 
         VALUES (?, ?, ?, ?, '127.0.0.1', ?, ?, NOW())`,
        [l.type, l.msg, l.uid, l.uname, dateStr, timeStr]
      );
    }
    console.log('✅ Journaux d\'activité générés.');

    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('🎉 BASE DE DONNÉES ENTIÈREMENT PEUPLÉE AVEC SUCCÈS !');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log(`• Utilisateurs      : ${users.length} comptes`);
    console.log(`• Collecteurs       : 3 agents sur tout Abidjan (Nord/Est, Sud, Ouest)`);
    console.log(`• Biens Immobiliers : ${properties.length} biens (Korede: 15, Léonce: 14, Diabaté: 13, Dispos: 6, Maint: 2)`);
    console.log(`• Propriétaires     : ${owners.length} bailleurs avec coordonnées complètes`);
    console.log(`• Locataires        : ${clients.length} locataires (soldés, avances, retards, réparations, départs)`);
    console.log(`• Réparations       : 4 dossiers avec imputations mensuelles sur le loyer`);
    console.log(`• Reversements      : 7 règlements (intégraux, tranches, préfinancements agence)`);
    console.log(`• Transactions      : ${transactionsData.length} écritures pour graphiques et KPIs`);
    console.log('═══════════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Erreur lors du seed exhaustif :', error);
    throw error;
  } finally {
    conn.release();
  }
}

seedComprehensive().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
