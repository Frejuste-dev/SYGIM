/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║    SYGIM - Données de test (volume recette/stress)              ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Exécuter après seed.js :  node database/seed-test-data.js
 *
 * Crée :
 *   1 manager supplémentaire (manager_b)
 *   5 collecteurs (dont 3 rattachés au manager A, 2 au manager B)
 *  15 propriétaires
 *  40 biens immobiliers
 *  60 locataires
 * 200 transactions
 *  15 préfinancements
 *  50 entrées de journal
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pool } = require('../src/config/database');

const log = (msg) => console.log(`   ${msg}`);

async function getId(table, field, value) {
  const [rows] = await pool.query(`SELECT id FROM ${table} WHERE ${field} = ? LIMIT 1`, [value]);
  return rows.length ? rows[0].id : null;
}

async function getUsers() {
  const [rows] = await pool.query('SELECT id, username, role FROM users');
  const byUsername = {};
  for (const r of rows) byUsername[r.username] = r;
  return { rows, byUsername };
}

// ---------------------------------------------------------------------------
// COLLECTORS
// ---------------------------------------------------------------------------
async function seedSecondManager() {
  const existing = await getId('users', 'username', 'manager_b');
  if (existing) { log('Manager B déjà existant'); return existing; }
  const bcrypt = require('bcryptjs');
  const hash = await bcrypt.hash('MgrB2026!', 10);
  const [res] = await pool.query(
    `INSERT INTO users (username, password_hash, role, first_name, last_name, display_name, avatar, active)
     VALUES (?, ?, 'collector_manager', 'Manager', 'B', 'Manager B', 'MGB', 1)`,
    ['manager_b', hash]
  );
  log('Manager B (manager_b / MgrB2026!) créé');
  return res.insertId;
}

async function seedCollectors(userMap, managerBId) {
  const entries = [
    { first: 'Korede',  last: 'KOREDE',   phone: '77 111 00 01', email: 'korede@sygim.sn', zone: 'Dakar Nord',  rate: 5.00, manager: 'A' },
    { first: 'Léonce',  last: 'LEONCE',   phone: '77 111 00 02', email: 'leonce@sygim.sn', zone: 'Dakar Sud',   rate: 5.00, manager: 'A' },
    { first: 'Marième', last: 'NDIAYE',   phone: '77 111 00 03', email: 'marieme@sygim.sn', zone: 'Pikine',     rate: 4.50, manager: 'A' },
    { first: 'Oumar',   last: 'DIOP',     phone: '77 111 00 04', email: 'oumar@sygim.sn',  zone: 'Guédiawaye', rate: 4.50, manager: 'B' },
    { first: 'Aminata', last: 'SOW',      phone: '77 111 00 05', email: 'aminata@sygim.sn', zone: 'Rufisque',   rate: 5.00, manager: 'B' },
  ];
  const managerIdA = userMap['manager']?.id;
  const created = [];

  for (const e of entries) {
    const existing = await getId('collectors', 'last_name', e.last);
    if (existing) { created.push(existing); continue; }
    const user = userMap[e.first.toLowerCase() === 'korede' ? 'korede' : e.first.toLowerCase() === 'leonce' ? 'leonce' : null];
    const mgrId = e.manager === 'B' ? managerBId : managerIdA;
    const [res] = await pool.query(
      `INSERT INTO collectors (first_name, last_name, phone, email, zone, commission_rate, active, user_id, manager_id)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [e.first, e.last, e.phone, e.email, e.zone, e.rate, user?.id || null, mgrId]
    );
    created.push(res.insertId);
    log(`Collecteur ${e.first} ${e.last} créé (manager ${e.manager})`);
  }
  return created;
}

// ---------------------------------------------------------------------------
// OWNERS (15)
// ---------------------------------------------------------------------------
async function seedOwners() {
  const list = [
    { first: 'Mamadou', last: 'DIALLO',     phone: '77 100 00 01', email: 'mdiallo@sygim.sn', bank: 'CBAO',   account: 'SN012 0001 2000 0001' },
    { first: 'Aïcha',   last: 'BA',         phone: '77 100 00 02', email: 'aba@sygim.sn',     bank: 'SGBS',   account: 'SN013 0002 3000 0002' },
    { first: 'Ousmane', last: 'SOW',        phone: '77 100 00 03', email: 'osow@sygim.sn',    bank: 'BICIS',  account: 'SN014 0003 4000 0003' },
    { first: 'Fatou',   last: 'NDIAYE',     phone: '77 100 00 04', email: 'fndiaye@sygim.sn', bank: 'CBAO',   account: 'SN012 0004 5000 0004' },
    { first: 'Cheikh',  last: 'FALL',       phone: '77 100 00 05', email: 'cfall@sygim.sn',   bank: 'ECOBANK', account: 'SN015 0005 6000 0005' },
    { first: 'Ndeye',   last: 'GUEYE',      phone: '77 100 00 06', email: 'ngueye@sygim.sn',  bank: 'ORABANK', account: 'SN016 0006 7000 0006' },
    { first: 'Abdou',   last: 'DIOUF',      phone: '77 100 00 07', email: 'adiouf@sygim.sn',  bank: 'CBAO',   account: 'SN012 0007 8000 0007' },
    { first: 'Rokhaya', last: 'SY',         phone: '77 100 00 08', email: 'rsy@sygim.sn',     bank: 'BICIS',  account: 'SN014 0008 9000 0008' },
    { first: 'Moussa',  last: 'THIAM',      phone: '77 100 00 09', email: 'mthiam@sygim.sn',  bank: 'SGBS',   account: 'SN013 0009 1000 0009' },
    { first: 'Awa',     last: 'CAMARA',     phone: '77 100 00 10', email: 'acamara@sygim.sn', bank: 'ECOBANK', account: 'SN015 0010 2000 0010' },
    { first: 'Pape',    last: 'DIENG',      phone: '77 100 00 11', email: 'pdieng@sygim.sn',  bank: 'CBAO',   account: 'SN012 0011 3000 0011' },
    { first: 'Mariama', last: 'FALL',       phone: '77 100 00 12', email: 'mfall@sygim.sn',   bank: 'ORABANK', account: 'SN016 0012 4000 0012' },
    { first: 'Babacar', last: 'NDAO',       phone: '77 100 00 13', email: 'bndao@sygim.sn',   bank: 'BICIS',  account: 'SN014 0013 5000 0013' },
    { first: 'Astou',   last: 'GAYE',       phone: '77 100 00 14', email: 'agaye@sygim.sn',   bank: 'SGBS',   account: 'SN013 0014 6000 0014' },
    { first: 'Modou',   last: 'MBACKE',     phone: '77 100 00 15', email: 'mmbacke@sygim.sn', bank: 'CBAO',   account: 'SN012 0015 7000 0015' },
  ];
  const ids = [];
  for (const o of list) {
    const existing = await getId('owners', 'email', o.email);
    if (existing) { ids.push(existing); continue; }
    const [res] = await pool.query(
      `INSERT INTO owners (first_name, last_name, phone, email, address, bank_name, bank_account, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [o.first, o.last, o.phone, o.email, `Dakar, ${o.last.toUpperCase()} résidence`, o.bank, o.account]
    );
    ids.push(res.insertId);
  }
  log(`${ids.length} propriétaires` + (ids.length === list.length ? '' : ' (existants inclus)'));
  return ids;
}

// ---------------------------------------------------------------------------
// PROPERTIES (40)
// ---------------------------------------------------------------------------
async function seedProperties(ownerIds, collectorIds, clientIds) {
  const types = ['appartement', 'maison', 'commercial', 'terrain', 'villa'];
  const statuses = ['loue', 'vacant', 'en_renovation', 'vendu'];

  const props = [
    { name: 'Villa Ngor', addr: 'Ngor plage, Dakar',                   type: 0, rent: 250000, val: 35000000, area: 250, rooms: 5 },
    { name: 'Immeuble Médina', addr: 'Médina rue 13 x 16',            type: 0, rent: 180000, val: 25000000, area: 180, rooms: 3 },
    { name: 'Maison Sicap Baobab', addr: 'Sicap Baobab n°22',          type: 1, rent: 350000, val: 45000000, area: 200, rooms: 4 },
    { name: 'Local Colobane', addr: 'Colobane Av principale',          type: 2, rent: 500000, val: 60000000, area: 300, rooms: 0 },
    { name: 'Appartement Fann', addr: 'Fann résidence n°5',            type: 0, rent: 200000, val: 28000000, area: 120, rooms: 3 },
    { name: 'Villa Almadies', addr: 'Almadies lot 14',                 type: 4, rent: 600000, val: 80000000, area: 400, rooms: 6 },
    { name: 'Immeuble Plateau', addr: 'Place de l\'Indépendance',      type: 0, rent: 150000, val: 22000000, area: 140, rooms: 2 },
    { name: 'Villa Liberté 6', addr: 'Liberté 6 extension',           type: 4, rent: 550000, val: 70000000, area: 350, rooms: 5 },
    { name: 'Appartement Sacré-Cœur', addr: 'Sacré-Cœur n°8',          type: 0, rent: 220000, val: 30000000, area: 130, rooms: 3 },
    { name: 'Terrain Mbao', addr: 'Mbao sortie autoroute',             type: 3, rent: 0,     val: 15000000, area: 500, rooms: 0 },
    { name: 'Maison Grand-Yoff', addr: 'Grand-Yoff marché',            type: 1, rent: 280000, val: 38000000, area: 180, rooms: 4 },
    { name: 'Bureau Sicap', addr: 'Sicap Liberté n°42',               type: 2, rent: 120000, val: 18000000, area: 80,  rooms: 0 },
    { name: 'Villa Mermoz', addr: 'Mermoz rue 10',                    type: 4, rent: 450000, val: 65000000, area: 300, rooms: 5 },
    { name: 'Appartement Ouakam', addr: 'Ouakam plage',               type: 0, rent: 190000, val: 26000000, area: 110, rooms: 2 },
    { name: 'Maison Pikine', addr: 'Pikine Tally Boubess',             type: 1, rent: 150000, val: 20000000, area: 160, rooms: 3 },
    { name: 'Local Marché Sandaga', addr: 'Sandaga étage 2',          type: 2, rent: 400000, val: 50000000, area: 200, rooms: 0 },
    { name: 'Villa Yoff', addr: 'Yoff plage lot 7',                   type: 4, rent: 380000, val: 52000000, area: 280, rooms: 4 },
    { name: 'Terrain Rufisque', addr: 'Rufisque côté mer',             type: 3, rent: 0,     val: 12000000, area: 600, rooms: 0 },
    { name: 'Appartement HLM', addr: 'HLM Grand Médine',               type: 0, rent: 140000, val: 19000000, area: 90,  rooms: 2 },
    { name: 'Villa Point E', addr: 'Point E n°72',                    type: 4, rent: 520000, val: 72000000, area: 320, rooms: 5 },
    { name: 'Immeuble Ndar', addr: 'Saint-Louis rive gauche',          type: 0, rent: 170000, val: 24000000, area: 160, rooms: 3 },
    { name: 'Boutique Thiès', addr: 'Thiès avenue principale',        type: 2, rent: 180000, val: 25000000, area: 100, rooms: 0 },
    { name: 'Maison Kaolack', addr: 'Kaolack zone industrielle',       type: 1, rent: 130000, val: 17000000, area: 140, rooms: 3 },
    { name: 'Villa Ziguinchor', addr: 'Ziguinchor escale',            type: 4, rent: 300000, val: 40000000, area: 250, rooms: 4 },
    { name: 'Terrain Diamniadio', addr: 'Diamniadio nouveau pôle',    type: 3, rent: 0,     val: 25000000, area: 800, rooms: 0 },
    { name: 'Appartement Soprim', addr: 'Mermoz Soprim n°5',          type: 0, rent: 210000, val: 29000000, area: 115, rooms: 2 },
    { name: 'Local Av Dakar', addr: 'Av Dakar centre',                type: 2, rent: 350000, val: 45000000, area: 180, rooms: 0 },
    { name: 'Maison Parcelles', addr: 'Parcelles Niarry Tally',       type: 1, rent: 160000, val: 21000000, area: 150, rooms: 3 },
    { name: 'Villa Ngor - B', addr: 'Ngor Virage',                    type: 4, rent: 420000, val: 58000000, area: 300, rooms: 5 },
    { name: 'Appartement Cité Keur', addr: 'Cité Keur Gorgui',        type: 0, rent: 240000, val: 33000000, area: 135, rooms: 3 },
    { name: 'Terrain Touba', addr: 'Touba Darou Marnane',              type: 3, rent: 0,     val: 8000000,  area: 400, rooms: 0 },
    { name: 'Local Pikine', addr: 'Pikine rue 10',                    type: 2, rent: 250000, val: 32000000, area: 140, rooms: 0 },
    { name: 'Villa Stele Mermoz', addr: 'Stele Mermoz lot 12',        type: 4, rent: 480000, val: 68000000, area: 310, rooms: 5 },
    { name: 'Appartement Mariste', addr: 'Cité Mariste n°3',          type: 0, rent: 170000, val: 23000000, area: 100, rooms: 2 },
    { name: 'Maison Golf Nord', addr: 'Golf Nord lot 5',             type: 1, rent: 200000, val: 27000000, area: 170, rooms: 3 },
    { name: 'Bureau Sacré-Cœur', addr: 'Sacré-Cœur 3e étage',        type: 2, rent: 350000, val: 45000000, area: 160, rooms: 0 },
    { name: 'Villa Bambilor', addr: 'Bambilor sortie Thiaroye',       type: 4, rent: 320000, val: 42000000, area: 260, rooms: 4 },
    { name: 'Terrain Keur Massar', addr: 'Keur Massar Thiaroye',     type: 3, rent: 0,     val: 10000000, area: 350, rooms: 0 },
    { name: 'Appartement Sicap 3', addr: 'Sicap 2 rue 6',            type: 0, rent: 155000, val: 21000000, area: 95,  rooms: 2 },
    { name: 'Local Mermoz Ecole', addr: 'Mermoz école n°4',          type: 2, rent: 220000, val: 30000000, area: 120, rooms: 0 },
  ];

  const ids = [];
  for (const p of props) {
    const existing = await getId('properties', 'name', p.name);
    if (existing) { ids.push(existing); continue; }
    const oIdx = (ids.length % ownerIds.length);
    const status = p.rent > 0 ? 'loue' : 'vacant';
    const cId = p.rent > 0 ? collectorIds[(ids.length % collectorIds.length)] : null;
    const [res] = await pool.query(
      `INSERT INTO properties (name, address, type, status, value, rent, area, rooms, owner_id, collector_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [p.name, p.addr, types[p.type], status, p.val, p.rent, p.area, p.rooms, ownerIds[oIdx], cId]
    );
    ids.push(res.insertId);
  }
  log(`${ids.length} biens immobiliers` + (ids.length === props.length ? '' : ' (existants inclus)'));
  return ids;
}

// ---------------------------------------------------------------------------
// CLIENTS (60)
// ---------------------------------------------------------------------------
async function seedClients(propertyIds, collectorIds) {
  const firstNames = [
    'Ibrahima','Maguette','Adama','Moussa','Fatoumata','Samba','Khadija',
    'Mamadou','Aminata','Baye','Sokhna','Idrissa','Ramatoulaye','Ousseynou',
    'Bineta','Mor','Coumba','Souleymane','Mariama','Daouda','Aissatou',
    'Moustapha','Penda','El Hadj','Fanta','Thierno','Oulimata','Mansour',
    'Astou','Samba','Dior','Cheikh','Maïmouna','Boubacar','Nafissatou',
    'Lamine','Kine','Abdoulaye','Dieynaba','Mamadou','Arame','Balla',
    'Tidiane','Ndiémé','Elimane','Colette','Saliou','Yacine','Ngor',
    'Mbaye','Diama','Malick','Anta','Seynabou','Gora','Coumba','Alassane',
    'Sophie','Babacar','Alimatou',
  ];
  const lastNames = [
    'FALL','DIOUF','NDIAYE','DIOP','SOW','BA','GUEYE','THIAM','MBENGUE',
    'CAMARA','SY','MBACKE','DIAGNE','NDAO','WADE','KANE','NDOYE','GAYE',
    'DIOUF','FALL','NDIAYE','DIOP','SOW','BA','GUEYE','THIAM','MBENGUE',
    'CAMARA','SY','MBACKE','DIAGNE','NDAO','WADE','KANE','NDOYE','GAYE',
    'FALL','DIOUF','NDIAYE','DIOP','SOW','BA','GUEYE','THIAM','MBENGUE',
    'CAMARA','SY','MBACKE','DIAGNE','NDAO','WADE','KANE','NDOYE','GAYE',
    'FALL','DIOUF','NDIAYE','DIOP','SOW',
  ];

  const statuses = ['paid', 'partial', 'late', 'pending', 'paid', 'paid', 'partial', 'late', 'paid']; // weighted to paid

  const ids = [];
  for (let i = 0; i < 60; i++) {
    const first = firstNames[i] || 'Inconnu';
    const last = lastNames[i] || 'INCONNU';
    const email = `${first.toLowerCase()}.${last.toLowerCase()}@email.sn`;
    const existing = await getId('clients', 'email', email);
    if (existing) { ids.push(existing); continue; }
    const pId = propertyIds[i % propertyIds.length];
    const cId = collectorIds[i % collectorIds.length];
    const rent = (Math.floor(Math.random() * 20) + 5) * 10000; // 50000-250000
    const status = statuses[i % statuses.length];
    const paid = status === 'paid' ? rent : status === 'partial' ? Math.round(rent * 0.5) : status === 'late' ? Math.round(rent * 0.3) : 0;
    const start = new Date(2024, 0, 1);
    start.setDate(start.getDate() + Math.floor(Math.random() * 500));
    const startStr = start.toISOString().slice(0, 10);

    const [res] = await pool.query(
      `INSERT INTO clients (first_name, last_name, phone, email, status, property_id, amount_due, amount_paid, agent, collector_id, contract_start, join_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [first, last, `77 ${Math.floor(100 + Math.random() * 899)} ${Math.floor(10 + Math.random() * 89)} ${Math.floor(10 + Math.random() * 89)}`, email,
       status, pId, rent, paid, '', cId, startStr, new Date(start).toLocaleDateString('fr-FR')]
    );
    ids.push(res.insertId);
  }
  log(`${ids.length} locataires créés` + (ids.length === 60 ? '' : ` (${60 - ids.length} existants ignorés)`));
  return ids;
}

// ---------------------------------------------------------------------------
// TRANSACTIONS (200)
// ---------------------------------------------------------------------------
async function seedTransactions(clientIds, collectorIds) {
  const methods = ['cash', 'mobile_money', 'bank_transfer', 'mobile_money'];
  const statuses = ['processed', 'processed', 'processed', 'processed', 'pending', 'cancelled', 'refunded']; // weighted
  const existing = await pool.query('SELECT COUNT(*) as cnt FROM transactions');
  if (existing[0][0].cnt >= 200) { log(`${existing[0][0].cnt} transactions déjà existantes, on ignore`); return; }

  const BATCH = 50;
  let total = 0;
  for (let batch = 0; batch < 4; batch++) {
    const values = [];
    const now = new Date();
    for (let i = 0; i < BATCH; i++) {
      const ci = clientIds[(batch * BATCH + i) % clientIds.length];
      const coi = collectorIds[(batch * BATCH + i) % collectorIds.length];
      const method = methods[Math.floor(Math.random() * methods.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const amount = [50000, 75000, 100000, 125000, 150000, 200000, 250000, 300000, 400000, 500000][Math.floor(Math.random() * 10)];
      const ref = `REC-${String(Date.now()).slice(-6)}-${String(batch * BATCH + i).padStart(3, '0')}`;
      const d = new Date(now);
      d.setDate(d.getDate() - Math.floor(Math.random() * 180));
      const dateStr = d.toISOString().slice(0, 10);
      const displayStr = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
      values.push([ref, dateStr, displayStr, ci, `Client #${ci}`, `Paiement loyer ${d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`, amount, method, status, coi]);
    }

    const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const flat = values.flat();
    await pool.query(
      `INSERT INTO transactions (reference, date, date_display, client_id, client_name, description, amount, method, status, collector_id)
       VALUES ${placeholders}`,
      flat
    );
    total += BATCH;
    log(`${total} transactions insérées`);
  }
}

// ---------------------------------------------------------------------------
// ACTIVITY LOGS (50)
// ---------------------------------------------------------------------------
async function seedActivityLogs(userMap) {
  const adminId = userMap['admin']?.id || 1;
  const managerId = userMap['manager']?.id || 1;
  const koredeId = userMap['korede']?.id || 1;
  const leonceId = userMap['leonce']?.id || 1;
  const userIds = [adminId, managerId, koredeId, leonceId];

  const types = ['login', 'payment', 'create', 'update', 'login', 'payment', 'create'];
  const messages = [
    'Connexion utilisateur réussie',
    'Paiement enregistré pour le locataire',
    'Nouveau locataire créé',
    'Profil utilisateur mis à jour',
    'Déconnexion session',
    'Transaction de loyer validée',
    'Nouveau bien immobilier ajouté',
    'Attribution de récolteur modifiée',
    'Export CSV des transactions',
    'Acquittement d\'alerte impayé',
  ];

  for (let i = 0; i < 50; i++) {
    const d = new Date();
    d.setDate(d.getDate() - Math.floor(Math.random() * 30) + 1);
    const type = types[Math.floor(Math.random() * types.length)];
    const message = messages[Math.floor(Math.random() * messages.length)];
    const userId = userIds[Math.floor(Math.random() * userIds.length)];
    const ip = `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
    await pool.query(
      `INSERT INTO activity_logs (type, message, user_id, ip_address, date, time)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [type, message, userId, ip, d.toISOString().slice(0, 10), `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`]
    );
  }
  log('50 entrées de journal créées');
}

// ---------------------------------------------------------------------------
// PREFINANCINGS (15)
// ---------------------------------------------------------------------------
async function seedPrefinancings(ownerIds, propertyIds) {
  const statuses = ['active', 'active', 'active', 'completed', 'overdue'];
  for (let i = 0; i < 15; i++) {
    const ownerId = ownerIds[i % ownerIds.length];
    const propId = propertyIds[i % propertyIds.length];
    const amount = (Math.floor(Math.random() * 50) + 5) * 100000;
    const rate = [3.5, 4.0, 4.5, 5.0, 5.5, 6.0][Math.floor(Math.random() * 6)];
    const status = statuses[i % statuses.length];
    const start = new Date();
    start.setDate(start.getDate() - Math.floor(Math.random() * 180) - 30);
    const end = new Date(start);
    end.setMonth(end.getMonth() + [6, 6, 6, 12, 12][Math.floor(Math.random() * 5)]);
    const repaid = status === 'completed' ? amount : status === 'active' ? Math.round(amount * (Math.random() * 0.4 + 0.1)) : Math.round(amount * 0.2);

    const ref = `PREF-${String(2026000 + i)}`;
    const [exist] = await pool.query('SELECT id FROM prefinancings WHERE reference = ?', [ref]);
    if (exist.length) continue;

    await pool.query(
      `INSERT INTO prefinancings (reference, property_id, owner_id, amount, interest_rate, start_date, end_date, amount_repaid, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [ref, propId, ownerId, amount, rate, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10), repaid, status]
    );
  }
  log(`15 préfinancements créés`);
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
async function main() {
  console.log('');
  console.log('🧪 SYGIM - Génération des données de test (volume recette/stress)...');
  console.log('');

  try {
    const { byUsername: userMap } = await getUsers();
    const required = ['admin', 'manager', 'korede', 'leonce'];
    const missing = required.filter(u => !userMap[u]);
    if (missing.length) {
      console.error(`❌ Utilisateurs manquants : ${missing.join(', ')}. Exécutez d'abord node database/seed.js`);
      process.exit(1);
    }

    console.log('━━━ SECOND MANAGER ━━━');
    const managerBId = await seedSecondManager();

    console.log('━━━ RÉCOLTEURS ━━━');
    const collectorIds = await seedCollectors(userMap, managerBId);

    console.log('━━━ PROPRIÉTAIRES ━━━');
    const ownerIds = await seedOwners();

    console.log('━━━ BIENS IMMOBILIERS ━━━');
    const propertyIds = await seedProperties(ownerIds, collectorIds);

    console.log('━━━ LOCATAIRES ━━━');
    const clientIds = await seedClients(propertyIds, collectorIds);

    console.log('━━━ TRANSACTIONS ━━━');
    await seedTransactions(clientIds, collectorIds);

    console.log('━━━ JOURNAL D\'ACTIVITÉ ━━━');
    await seedActivityLogs(userMap);

    console.log('━━━ PRÉFINANCEMENTS ━━━');
    await seedPrefinancings(ownerIds, propertyIds);

    console.log('');
    console.log('✅ Données de test générées avec succès !');
    console.log('');
    console.log('Récapitulatif :');
    console.log('─────────────────────────────────');
    console.log(`   Managers       : 2 (manager + manager_b)`);
    console.log(`   Collecteurs    : ${collectorIds.length}`);
    console.log(`   Propriétaires  : ${ownerIds.length}`);
    console.log(`   Biens          : ${propertyIds.length}`);
    console.log(`   Locataires     : ${clientIds.length}`);
    console.log(`   Transactions   : 200`);
    console.log(`   Journal        : 50`);
    console.log(`   Préfinancements: 15`);
    console.log('─────────────────────────────────');
    console.log('');
  } catch (err) {
    console.error('❌ Erreur :', err);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();
