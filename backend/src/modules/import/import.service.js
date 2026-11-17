const ExcelJS = require('exceljs');
const XLSX = require('xlsx');
const { pool } = require('../../config/database');
const AppError = require('../../utils/errors/AppError');

const VALID_PROPERTY_TYPES = ['appartement', 'villa', 'studio', 'commerce', 'bureau', 'terrain', 'immeuble', 'autre'];

const TEMPLATE_COLUMNS = [
  { header: 'proprietaire_nom', key: 'proprietaire_nom', width: 24 },
  { header: 'proprietaire_telephone', key: 'proprietaire_telephone', width: 22 },
  { header: 'proprietaire_email', key: 'proprietaire_email', width: 25 },
  { header: 'bien_reference', key: 'bien_reference', width: 16 },
  { header: 'bien_titre', key: 'bien_titre', width: 30 },
  { header: 'bien_type', key: 'bien_type', width: 16 },
  { header: 'bien_etage', key: 'bien_etage', width: 15 },
  { header: 'bien_zone', key: 'bien_zone', width: 22 },
  { header: 'loyer_mensuel', key: 'loyer_mensuel', width: 16 },
  { header: 'charges_mensuelles', key: 'charges_mensuelles', width: 18 },
  { header: 'locataire_nom', key: 'locataire_nom', width: 24 },
  { header: 'locataire_telephone', key: 'locataire_telephone', width: 22 },
  { header: 'locataire_email', key: 'locataire_email', width: 24 },
  { header: 'caution_versee', key: 'caution_versee', width: 16 },
  { header: 'arriere_initial', key: 'arriere_initial', width: 16 },
  { header: 'date_entree', key: 'date_entree', width: 15 },
];

function normalizePhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('225') && digits.length >= 13) {
    return digits.slice(3);
  }
  return digits;
}

function normalizeName(name) {
  if (!name) return '';
  return String(name).trim().replace(/\s+/g, ' ').toLowerCase();
}

function splitFullName(fullName) {
  const cleaned = String(fullName || '').trim().replace(/\s+/g, ' ');
  if (!cleaned) return { first_name: '', last_name: '', display_name: '' };
  const parts = cleaned.split(' ');
  if (parts.length === 1) {
    return { first_name: '', last_name: parts[0], display_name: parts[0] };
  }
  return {
    last_name: parts[0],
    first_name: parts.slice(1).join(' '),
    display_name: cleaned
  };
}

function parseAmount(val) {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return val;
  const cleaned = String(val).replace(/\s+/g, '').replace(/FCFA/gi, '').replace(/,/g, '.');
  const num = Number(cleaned);
  return num;
}

function parseDateValue(val) {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString().slice(0, 10);
  }
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // Support DD/MM/YYYY
  const dmy = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return null;
}

function normalizeRowKeys(rawRow) {
  const out = {};
  Object.entries(rawRow || {}).forEach(([k, v]) => {
    const cleanKey = String(k)
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_');
    out[cleanKey] = typeof v === 'string' ? v.trim() : v;
  });
  return out;
}

class ImportService {
  /**
   * Génère le classeur Excel modèle (.xlsx) avec 2 feuilles
   */
  async generateTemplateWorkbook() {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SYGIM';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Portefeuille_Locatif', {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    sheet.columns = TEMPLATE_COLUMNS;

    // Style de l'en-tête
    const headerRow = sheet.getRow(1);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        bottom: { style: 'medium', color: { argb: 'FF3B82F6' } }
      };
    });

    // 3 lignes d'exemples réalistes
    const samples = [
      {
        proprietaire_nom: 'KOUASSI Jean-Marc',
        proprietaire_telephone: '0709881442',
        proprietaire_email: 'jm.kouassi@email.ci',
        bien_reference: 'BIEN-101',
        bien_titre: 'Appt 3 pièces Cocody Angré',
        bien_type: 'appartement',
        bien_etage: '2ème étage',
        bien_zone: 'Cocody Angré',
        loyer_mensuel: 250000,
        charges_mensuelles: 15000,
        locataire_nom: 'TRAORE Aminata',
        locataire_telephone: '0504123456',
        locataire_email: 'a.traore@email.ci',
        caution_versee: 500000,
        arriere_initial: 0,
        date_entree: '2026-01-01'
      },
      {
        proprietaire_nom: 'KOUASSI Jean-Marc',
        proprietaire_telephone: '0709881442',
        proprietaire_email: 'jm.kouassi@email.ci',
        bien_reference: 'BIEN-102',
        bien_titre: 'Studio Meublé Angré 8e Tranche',
        bien_type: 'studio',
        bien_etage: 'RDC',
        bien_zone: 'Cocody Angré',
        loyer_mensuel: 150000,
        charges_mensuelles: 10000,
        locataire_nom: '',
        locataire_telephone: '',
        locataire_email: '',
        caution_versee: 0,
        arriere_initial: 0,
        date_entree: ''
      },
      {
        proprietaire_nom: 'BAMBA Ibrahim',
        proprietaire_telephone: '0102030405',
        proprietaire_email: 'bamba.ib@email.ci',
        bien_reference: '',
        bien_titre: 'Villa Duplex Riviera Palmeraie',
        bien_type: 'villa',
        bien_etage: 'R+1',
        bien_zone: 'Cocody Riviera',
        loyer_mensuel: 650000,
        charges_mensuelles: 0,
        locataire_nom: 'KONE Moussa',
        locataire_telephone: '0777889900',
        locataire_email: '',
        caution_versee: 1300000,
        arriere_initial: 150000,
        date_entree: '2025-11-01'
      }
    ];

    samples.forEach((s) => sheet.addRow(s));

    // Feuille 2 : Instructions
    const guideSheet = workbook.addWorksheet('Instructions');
    guideSheet.columns = [
      { header: 'Colonne', key: 'col', width: 25 },
      { header: 'Obligatoire ?', key: 'req', width: 16 },
      { header: 'Format & Description', key: 'desc', width: 70 }
    ];
    const gHeader = guideSheet.getRow(1);
    gHeader.height = 26;
    gHeader.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    });

    const docs = [
      { col: 'proprietaire_nom', req: 'OUI', desc: 'Nom complet du propriétaire (ex: KOUASSI Jean-Marc). Si le nom ou le téléphone existe déjà, le bien sera automatiquement rattaché sans doublon.' },
      { col: 'proprietaire_telephone', req: 'Recommandé', desc: 'Numéro à 10 chiffres (ex: 0709881442). Utilisé pour la déduplication automatique.' },
      { col: 'proprietaire_email', req: 'Optionnel', desc: 'Adresse email du propriétaire.' },
      { col: 'bien_reference', req: 'Optionnel', desc: 'Référence unique du bien (ex: BIEN-101). Si laissé vide, une référence automatique sera générée.' },
      { col: 'bien_titre', req: 'OUI', desc: 'Désignation du bien (ex: Appt 3 pièces Cocody Angré).' },
      { col: 'bien_type', req: 'Optionnel', desc: 'Valeurs acceptées : appartement, villa, studio, commerce, bureau, terrain, immeuble, autre (défaut : appartement).' },
      { col: 'bien_etage', req: 'Optionnel', desc: 'Niveau / étage (ex: RDC, 1er étage, R+1).' },
      { col: 'bien_zone', req: 'Optionnel', desc: 'Commune ou quartier (ex: Cocody Angré, Marcory Zone 4).' },
      { col: 'loyer_mensuel', req: 'OUI', desc: 'Montant numérique positif en FCFA (ex: 250000).' },
      { col: 'charges_mensuelles', req: 'Optionnel', desc: 'Montant numérique >= 0 en FCFA (défaut : 0).' },
      { col: 'locataire_nom', req: 'Optionnel', desc: 'Nom complet du locataire. Si renseigné, le bien passe automatiquement au statut Loué.' },
      { col: 'locataire_telephone', req: 'Optionnel', desc: 'Numéro de téléphone du locataire.' },
      { col: 'locataire_email', req: 'Optionnel', desc: 'Adresse email du locataire.' },
      { col: 'caution_versee', req: 'Optionnel', desc: 'Montant de la caution déposée en FCFA (défaut : 0).' },
      { col: 'arriere_initial', req: 'Optionnel', desc: 'Solde d\'impayés initial à reprendre en FCFA (défaut : 0).' },
      { col: 'date_entree', req: 'Optionnel', desc: 'Date d\'entrée dans les lieux au format AAAA-MM-JJ (ex: 2026-01-01).' },
    ];
    docs.forEach((d) => guideSheet.addRow(d));

    return workbook.xlsx.writeBuffer();
  }

  /**
   * Parse un fichier Excel (.xlsx, .xls) ou CSV en tableau d'objets normalisés
   */
  parseFileBuffer(buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw AppError.badRequest('Le fichier est vide ou ne contient aucune feuille.');
    }
    const targetSheetName = workbook.SheetNames.includes('Portefeuille_Locatif')
      ? 'Portefeuille_Locatif'
      : workbook.SheetNames[0];
    const sheet = workbook.Sheets[targetSheetName];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    return rawRows;
  }

  /**
   * Analyse et prévisualise les lignes à importer sans modifier la base
   */
  async previewPortfolio(rawRows = []) {
    if (!Array.isArray(rawRows) || rawRows.length === 0) {
      throw AppError.badRequest('Aucune ligne détectée dans le fichier d\'import.');
    }

    // Charger les propriétaires et références de biens existants
    const [existingOwners] = await pool.query(
      'SELECT id, first_name, last_name, display_name, phone FROM owners'
    );
    const [existingProperties] = await pool.query(
      'SELECT id, reference_code FROM properties WHERE reference_code IS NOT NULL'
    );

    const ownerByPhone = new Map();
    const ownerByName = new Map();
    existingOwners.forEach((o) => {
      const nPhone = normalizePhone(o.phone);
      if (nPhone) ownerByPhone.set(nPhone, o);
      const fullName = o.display_name || `${o.last_name || ''} ${o.first_name || ''}`.trim();
      const nName = normalizeName(fullName);
      if (nName) ownerByName.set(nName, o);
      const altName = normalizeName(`${o.first_name || ''} ${o.last_name || ''}`.trim());
      if (altName && !ownerByName.has(altName)) ownerByName.set(altName, o);
    });

    const existingRefs = new Set(existingProperties.map((p) => String(p.reference_code).trim().toUpperCase()));
    const batchRefs = new Set();
    const batchNewOwners = new Map(); // key -> { name }

    const validRows = [];
    const errorRows = [];

    let newOwnersCount = 0;
    let existingOwnersLinkedCount = 0;
    let tenantsToAssignCount = 0;

    rawRows.forEach((item, index) => {
      const rowNumber = index + 2; // ligne 1 = en-tête Excel
      const r = normalizeRowKeys(item);

      // Ignorer les lignes totalement vides
      const hasAnyValue = Object.values(r).some((v) => v !== '' && v !== null && v !== undefined);
      if (!hasAnyValue) return;

      const rowErrors = [];

      const ownerName = String(r.proprietaire_nom || '').trim();
      const ownerPhone = String(r.proprietaire_telephone || '').trim();
      const ownerEmail = String(r.proprietaire_email || '').trim();
      const propRef = String(r.bien_reference || '').trim().toUpperCase();
      const propTitle = String(r.bien_titre || '').trim();
      const propTypeRaw = String(r.bien_type || 'appartement').trim().toLowerCase();
      const propType = VALID_PROPERTY_TYPES.includes(propTypeRaw) ? propTypeRaw : 'appartement';
      const propFloor = String(r.bien_etage || '').trim();
      const propZone = String(r.bien_zone || '').trim();

      const rent = parseAmount(r.loyer_mensuel);
      const charges = parseAmount(r.charges_mensuelles);
      const tenantName = String(r.locataire_nom || '').trim();
      const tenantPhone = String(r.locataire_telephone || '').trim();
      const tenantEmail = String(r.locataire_email || '').trim();
      const deposit = parseAmount(r.caution_versee);
      const arrears = parseAmount(r.arriere_initial);
      const startDate = parseDateValue(r.date_entree);

      if (!ownerName) {
        rowErrors.push(`Ligne ${rowNumber} : Nom du propriétaire manquant`);
      }
      if (!propTitle) {
        rowErrors.push(`Ligne ${rowNumber} : Titre du bien manquant`);
      }
      if (r.loyer_mensuel === '' || r.loyer_mensuel === null || isNaN(rent) || rent < 0) {
        rowErrors.push(`Ligne ${rowNumber} : Loyer mensuel invalide (${r.loyer_mensuel || 'vide'})`);
      }
      if (isNaN(charges) || charges < 0) {
        rowErrors.push(`Ligne ${rowNumber} : Charges mensuelles invalides`);
      }
      if (isNaN(deposit) || deposit < 0) {
        rowErrors.push(`Ligne ${rowNumber} : Montant de caution invalide`);
      }
      if (isNaN(arrears) || arrears < 0) {
        rowErrors.push(`Ligne ${rowNumber} : Arriéré initial invalide`);
      }
      if (propRef) {
        if (existingRefs.has(propRef)) {
          rowErrors.push(`Ligne ${rowNumber} : La référence ${propRef} existe déjà en base`);
        } else if (batchRefs.has(propRef)) {
          rowErrors.push(`Ligne ${rowNumber} : La référence ${propRef} est en doublon dans le fichier`);
        }
      }

      if (rowErrors.length > 0) {
        errorRows.push({
          rowNumber,
          errors: rowErrors,
          raw: r
        });
        return;
      }

      if (propRef) batchRefs.add(propRef);

      // Détection propriétaire existant (DB ou lot)
      const normPhone = normalizePhone(ownerPhone);
      const normName = normalizeName(ownerName);
      const matchedDbOwner = (normPhone && ownerByPhone.get(normPhone)) || ownerByName.get(normName) || null;
      const batchKey = normPhone ? `P:${normPhone}` : `N:${normName}`;

      let ownerStatus = 'NEW';
      let existingOwnerId = null;
      let existingOwnerDisplay = null;

      if (matchedDbOwner) {
        ownerStatus = 'EXISTING';
        existingOwnerId = matchedDbOwner.id;
        existingOwnerDisplay = matchedDbOwner.display_name || `${matchedDbOwner.last_name || ''} ${matchedDbOwner.first_name || ''}`.trim();
        existingOwnersLinkedCount += 1;
      } else if (batchNewOwners.has(batchKey)) {
        ownerStatus = 'BATCH_LINKED';
      } else {
        batchNewOwners.set(batchKey, { ownerName });
        newOwnersCount += 1;
      }

      if (tenantName) {
        tenantsToAssignCount += 1;
      }

      validRows.push({
        rowNumber,
        status: 'READY',
        ownerStatus,
        existingOwnerId,
        existingOwnerName: existingOwnerDisplay,
        batchOwnerKey: batchKey,
        proprietaire_nom: ownerName,
        proprietaire_telephone: ownerPhone,
        proprietaire_email: ownerEmail,
        bien_reference: propRef || '',
        bien_titre: propTitle,
        bien_type: propType,
        bien_etage: propFloor,
        bien_zone: propZone,
        loyer_mensuel: rent,
        charges_mensuelles: charges || 0,
        locataire_nom: tenantName,
        locataire_telephone: tenantPhone,
        locataire_email: tenantEmail,
        caution_versee: deposit || 0,
        arriere_initial: arrears || 0,
        date_entree: startDate || new Date().toISOString().slice(0, 10)
      });
    });

    return {
      validRows,
      errorRows,
      summary: {
        totalRows: validRows.length + errorRows.length,
        validCount: validRows.length,
        errorCount: errorRows.length,
        newOwnersCount,
        existingOwnersLinkedCount,
        propertiesToCreateCount: validRows.length,
        tenantsToAssignCount
      }
    };
  }

  /**
   * Exécute l'importation sous transaction SQL ACID
   */
  async executePortfolio(rawRows = [], user = {}) {
    const preview = await this.previewPortfolio(rawRows);
    const { validRows, errorRows } = preview;

    if (validRows.length === 0) {
      throw AppError.badRequest('Aucune ligne valide à importer.');
    }

    const conn = await pool.getConnection();
    let ownersCreated = 0;
    let ownersLinked = 0;
    let propertiesCreated = 0;
    let tenantsCreated = 0;

    try {
      await conn.beginTransaction();

      // Calculer le prochain index pour BIEN-XXX
      const [maxRows] = await conn.query(
        "SELECT MAX(CAST(SUBSTRING(reference_code, 6) AS UNSIGNED)) AS maxNum FROM properties WHERE reference_code REGEXP '^BIEN-[0-9]+$'"
      );
      let nextBienNum = (maxRows[0]?.maxNum || 100) + 1;

      // Map pour dédupliquer les nouveaux propriétaires créés durant cette transaction
      const txOwnerCache = new Map();
      const linkedExistingOwnerIds = new Set();

      for (const row of validRows) {
        let ownerId = row.existingOwnerId;

        if (ownerId) {
          if (!linkedExistingOwnerIds.has(ownerId)) {
            linkedExistingOwnerIds.add(ownerId);
            ownersLinked += 1;
          }
        } else if (txOwnerCache.has(row.batchOwnerKey)) {
          ownerId = txOwnerCache.get(row.batchOwnerKey);
        } else {
          const { first_name, last_name, display_name } = splitFullName(row.proprietaire_nom);
          const [ownerRes] = await conn.execute(
            `INSERT INTO owners (first_name, last_name, display_name, phone, email, active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())`,
            [first_name, last_name, display_name, row.proprietaire_telephone || null, row.proprietaire_email || null]
          );
          ownerId = ownerRes.insertId;
          txOwnerCache.set(row.batchOwnerKey, ownerId);
          ownersCreated += 1;
        }

        // Référence bien
        let propRef = row.bien_reference;
        if (!propRef) {
          propRef = `BIEN-${String(nextBienNum).padStart(3, '0')}`;
          nextBienNum += 1;
        }

        const propStatus = row.locataire_nom ? 'loue' : 'disponible';
        const descriptionParts = [];
        if (row.charges_mensuelles > 0) {
          descriptionParts.push(`Charges mensuelles : ${row.charges_mensuelles} FCFA`);
        }
        const description = descriptionParts.join(' | ') || null;

        const [propRes] = await conn.execute(
          `INSERT INTO properties
           (reference_code, name, address, zone, type, floor_level, status, rent, description, owner_id, assigned_at, assigned_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, NOW(), NOW())`,
          [
            propRef,
            row.bien_titre,
            row.bien_zone || null,
            row.bien_zone || null,
            row.bien_type || 'appartement',
            row.bien_etage || null,
            propStatus,
            row.loyer_mensuel,
            description,
            ownerId,
            user?.id || null
          ]
        );
        const propertyId = propRes.insertId;
        propertiesCreated += 1;

        // Locataire optionnel
        if (row.locataire_nom) {
          const tName = splitFullName(row.locataire_nom);
          const [clientRes] = await conn.execute(
            `INSERT INTO clients
             (first_name, last_name, phone, email, property_id, property_name, owner_id, amount_due, amount_paid, deposit, contract_start, status, join_date, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'active', ?, NOW(), NOW())`,
            [
              tName.first_name,
              tName.last_name,
              row.locataire_telephone || '',
              row.locataire_email || null,
              propertyId,
              row.bien_titre,
              ownerId,
              row.arriere_initial || 0,
              row.caution_versee || 0,
              row.date_entree,
              row.date_entree
            ]
          );
          const clientId = clientRes.insertId;
          tenantsCreated += 1;

          await conn.execute(
            'UPDATE properties SET tenant_id = ? WHERE id = ?',
            [clientId, propertyId]
          );

          await conn.execute(
            `INSERT INTO property_tenant_assignments
             (property_id, owner_id, new_client_id, action_type, rent_amount, performed_by, notes, created_at)
             VALUES (?, ?, ?, 'INITIAL_ASSIGNMENT', ?, ?, 'Importation massive Excel/CSV', NOW())`,
            [propertyId, ownerId, clientId, row.loyer_mensuel, user?.id || 1]
          );
        }
      }

      // Trace d'audit globale dans manager_activity_logs
      try {
        await conn.execute(
          `INSERT INTO manager_activity_logs
           (user_id, operation_type, operation_label, target_summary, description, new_values, status, created_at)
           VALUES (?, 'IMPORT_PORTFOLIO', 'Importation massive portefeuille', ?, ?, ?, 'SUCCESS', NOW())`,
          [
            user?.id || 1,
            `${propertiesCreated} biens / ${tenantsCreated} locataires`,
            `Importation de ${propertiesCreated} bien(s), ${ownersCreated} nouveau(x) propriétaire(s), ${ownersLinked} propriétaire(s) rattaché(s), ${tenantsCreated} locataire(s).`,
            JSON.stringify({ ownersCreated, ownersLinked, propertiesCreated, tenantsCreated, skippedErrors: errorRows.length })
          ]
        );
      } catch (_) {
        // Ne pas bloquer l'import si la table de log a une contrainte mineure
      }

      await conn.commit();

      return {
        ownersCreated,
        ownersLinked,
        propertiesCreated,
        tenantsCreated,
        skippedErrors: errorRows.length
      };
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }
}

module.exports = new ImportService();
