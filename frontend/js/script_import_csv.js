/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║   SYGIM — Moteur d'Import CSV Complet                                   ║
 * ║                                                                          ║
 * ║   3 FEUILLES CSV SUFFISENT POUR NOURRIR TOUT L'ÉCOSYSTÈME :             ║
 * ║                                                                          ║
 * ║   FEUILLE 1 — PROPRIÉTAIRES                                             ║
 * ║     Nom | Prénom | Bien(s) | Localisation | Commission% ou Fixe XOF     ║
 * ║     | Date paiement                                                       ║
 * ║     → crée ownersData + propertiesData (biens liés)                     ║
 * ║                                                                          ║
 * ║   FEUILLE 2 — LOCATAIRES                                                ║
 * ║     Nom | Prénom | Bien loué | Récolteur | Loyer | Impayé | Payé        ║
 * ║     | Date paiement                                                       ║
 * ║     → crée clientsData + lie property.tenantId + client.ownerId         ║
 * ║     → calcule amountDue, amountPaid, status, balance                    ║
 * ║                                                                          ║
 * ║   FEUILLE 3 — RÉCOLTEURS / MANAGER                                      ║
 * ║     Nom | Prénom | Biens assignés | Locataires assignés                  ║
 * ║     → crée collectorsData + assignedProperties[] + performance{}        ║
 * ║                                                                          ║
 * ║   INSTALLATION :                                                         ║
 * ║     Dans index.html avant </body> (après script_fixes.js) :             ║
 * ║     <script src="script_import_csv.js"></script>                        ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

(function () {
    'use strict';

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 1 — COLONNES CSV ACCEPTÉES PAR FEUILLE
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * FEUILLE PROPRIÉTAIRES
     * Colonnes possibles (insensibles à la casse, accents optionnels) :
     *
     *  NOM               → owner.lastName         (obligatoire)
     *  PRÉNOM            → owner.firstName
     *  TÉLÉPHONE         → owner.phone
     *  EMAIL             → owner.email
     *  BIEN(S)           → property.name           (crée le bien automatiquement)
     *  LOCALISATION      → property.address / city  (adresse du bien)
     *  TYPE BIEN         → property.type           (appartement|immeuble|villa|terrain)
     *  SUPERFICIE        → property.area
     *  VALEUR            → property.value
     *  COMMISSION        → owner.commissionRate    (ex: "10" ou "10%")
     *  MONTANT FIXE      → owner.commissionFixed + commissionType='fixed'
     *  DATE PAIEMENT     → owner.paymentDay        (ex: "15" ou "dernier")
     *  RIB / IBAN        → owner.bankAccount
     */
    const COL_OWNER = {
        'nom':'lastName','name':'lastName','lastname':'lastName',
        'prénom':'firstName','prenom':'firstName','firstname':'firstName',
        'téléphone':'phone','telephone':'phone','tel':'phone','mobile':'phone',
        'email':'email','mail':'email','courriel':'email',
        'adresse':'address','address':'address','localisation':'address',
        'ville':'city','city':'city',
        // Bien(s) du propriétaire
        'bien':'_bienNom','biens':'_bienNom','bien(s)':'_bienNom',
        'bien(s) en gestion':'_bienNom','propriété':'_bienNom','propriete':'_bienNom',
        // Localisation du bien (distinct de l'adresse du proprio)
        'localisation du bien':'_bienAdresse','adresse du bien':'_bienAdresse',
        'adresse bien':'_bienAdresse','localisation bien':'_bienAdresse',
        // Type de bien
        'type bien':'_bienType','type de bien':'_bienType','type':'_bienType',
        // Superficie / valeur
        'superficie':'_bienArea','surface':'_bienArea','m²':'_bienArea',
        'valeur':'_bienValue','valeur bien':'_bienValue','valeur xof':'_bienValue',
        // Commission
        'commission':'commissionRate','commission%':'commissionRate','taux%':'commissionRate',
        'taux commission':'commissionRate','taux de commission':'commissionRate',
        'montant fixe':'commissionFixed','montant fixe xof':'commissionFixed',
        'commission fixe':'commissionFixed','fixe xof':'commissionFixed',
        // Date de paiement
        'date paiement':'paymentDay','date de paiement':'paymentDay',
        'jour paiement':'paymentDay','jour de paiement':'paymentDay',
        'jour versement':'paymentDay','date versement':'paymentDay',
        // RIB
        'rib':'bankAccount','iban':'bankAccount','compte':'bankAccount',
        'banque':'bankAccount','bankaccount':'bankAccount',
        // Notes
        'notes':'notes','note':'notes','observations':'notes',
    };

    /**
     * FEUILLE LOCATAIRES
     *
     *  NOM               → client.lastName         (obligatoire)
     *  PRÉNOM            → client.firstName
     *  TÉLÉPHONE         → client.phone
     *  EMAIL             → client.email
     *  BIEN LOUÉ         → client.property + lie property.tenantId
     *  RÉCOLTEUR         → client.agent (= collector.lastName)
     *  LOYER             → client.amountDue (loyer mensuel)
     *  IMPAYÉ            → client.unpaidAmount (montant total impayé)
     *  MOIS IMPAYÉS      → client.unpaidMonths
     *  MONTANT PAYÉ      → client.amountPaid
     *  DATE PAIEMENT     → client.lastPaymentDate
     *  STATUT            → client.status (auto-calculé si absent)
     *  DATE DÉBUT        → client.contractStart
     *  DATE FIN          → client.contractEnd
     *  CAUTION           → client.deposit
     *  ADRESSE           → client.address
     */
    const COL_CLIENT = {
        'nom':'lastName','name':'lastName','lastname':'lastName',
        'prénom':'firstName','prenom':'firstName','firstname':'firstName',
        'téléphone':'phone','telephone':'phone','tel':'phone','mobile':'phone',
        'email':'email','mail':'email','courriel':'email',
        'adresse':'address','address':'address',
        // Bien loué
        'bien loué':'property','bien loue':'property','bien':'property',
        'logement':'property','appartement':'property','bien assigné':'property',
        'bien assigne':'property','propertyname':'property',
        // Récolteur (clé de liaison : son lastName)
        'récolteur':'agent','recolteur':'agent','agent':'agent',
        'agent récolteur':'agent','agent recolteur':'agent','collecteur':'agent',
        'collector':'agent','responsable':'agent',
        // Montants
        'loyer':'amountDue','loyer mensuel':'amountDue','montant loyer':'amountDue',
        'rent':'amountDue','montant dû':'amountDue','montant du':'amountDue',
        'impayé':'unpaidAmount','impaye':'unpaidAmount','montant impayé':'unpaidAmount',
        'montant impaye':'unpaidAmount','arriéré':'unpaidAmount','arriere':'unpaidAmount',
        'mois impayés':'unpaidMonths','mois impayes':'unpaidMonths','mois retard':'unpaidMonths',
        'montant payé':'amountPaid','montant paye':'amountPaid','amountpaid':'amountPaid',
        'payé':'amountPaid','paye':'amountPaid','encaissé':'amountPaid','encaisse':'amountPaid',
        // Dates
        'date paiement':'lastPaymentDate','date de paiement':'lastPaymentDate',
        'dernier paiement':'lastPaymentDate','last payment':'lastPaymentDate',
        'date début':'contractStart','date debut':'contractStart','début contrat':'contractStart',
        'date fin':'contractEnd','fin contrat':'contractEnd',
        // Statut (auto-calculé si absent)
        'statut':'status','status':'status','état':'status','etat':'status',
        // Caution
        'caution':'deposit','dépôt':'deposit','depot':'deposit','garantie':'deposit',
        // Notes
        'notes':'notes','note':'notes','observations':'notes',
    };

    /**
     * FEUILLE RÉCOLTEURS / MANAGER
     *
     *  NOM               → collector.lastName       (obligatoire)
     *  PRÉNOM            → collector.firstName
     *  TÉLÉPHONE         → collector.phone
     *  EMAIL             → collector.email
     *  ZONE              → collector.zone
     *  BIENS ASSIGNÉS    → _biensAssignes (noms séparés par | ou ,)
     *  LOCATAIRES        → _locatairesAssignes (noms)
     *  STATUT            → collector.status
     *  DATE PAIEMENT     → collector.paymentDay
     */
    const COL_COLLECTOR = {
        'nom':'lastName','name':'lastName','lastname':'lastName',
        'prénom':'firstName','prenom':'firstName','firstname':'firstName',
        'téléphone':'phone','telephone':'phone','tel':'phone','mobile':'phone',
        'email':'email','mail':'email',
        'zone':'zone','secteur':'zone','sector':'zone','territoire':'zone',
        // Biens et locataires assignés (résolution par noms)
        'biens assignés':'_biensAssignes','biens assigies':'_biensAssignes',
        'biens assignes':'_biensAssignes','biens':'_biensAssignes',
        'propriétés assignées':'_biensAssignes','proprietes assignees':'_biensAssignes',
        'locataires assignés':'_locatairesAssignes','locataires assigies':'_locatairesAssignes',
        'locataires assignes':'_locatairesAssignes','locataires':'_locatairesAssignes',
        'clients assignés':'_locatairesAssignes','clients assignes':'_locatairesAssignes',
        // Statut
        'statut':'status','status':'status',
        // Date paiement
        'date paiement':'paymentDay','jour paiement':'paymentDay',
        'jour versement':'paymentDay',
        // Notes
        'notes':'notes',
    };

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 2 — PARSER CSV ROBUSTE
    // ═══════════════════════════════════════════════════════════════════════

    function parseCSV(text) {
        const clean = text.replace(/^\uFEFF/, ''); // BOM
        const lines = clean.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) return { headers: [], rows: [] };

        // Détection automatique du séparateur
        const first = lines[0];
        const nbSemi  = (first.match(/;/g)  || []).length;
        const nbComma = (first.match(/,/g)  || []).length;
        const nbTab   = (first.match(/\t/g) || []).length;
        const sep = nbTab > nbSemi && nbTab > nbComma ? '\t'
                  : nbSemi >= nbComma ? ';' : ',';

        const headers = splitLine(first, sep)
            .map(h => h.trim().replace(/^["']|["']$/g, '').trim().toLowerCase());

        const rows = lines.slice(1)
            .map(line => {
                const vals = splitLine(line, sep);
                const obj  = {};
                headers.forEach((h, i) => {
                    obj[h] = (vals[i] || '').trim().replace(/^["']|["']$/g, '');
                });
                return obj;
            })
            .filter(r => Object.values(r).some(v => v !== ''));

        return { headers, rows };
    }

    function splitLine(line, sep) {
        const res = []; let cur = '', inQ = false;
        for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (c === '"') {
                if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
                else inQ = !inQ;
            } else if (c === sep && !inQ) { res.push(cur); cur = ''; }
            else cur += c;
        }
        res.push(cur);
        return res;
    }

    // Mapper une ligne brute selon la colMap
    function mapRow(raw, colMap) {
        const out = {};
        for (const [col, val] of Object.entries(raw)) {
            const key = col.toLowerCase().trim()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // déaccenter pour comparaison
                .trim();
            // Chercher dans colMap avec et sans accents
            let field = colMap[col.toLowerCase().trim()];
            if (!field) field = colMap[key];
            if (!field) {
                // Essai partiel : si la colonne contient un mot-clé
                for (const [k, v] of Object.entries(colMap)) {
                    if (col.toLowerCase().includes(k) || k.includes(col.toLowerCase())) {
                        field = v; break;
                    }
                }
            }
            if (!field || field === '_skip') continue;
            if (val !== '') out[field] = val;
        }
        return out;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 3 — DÉTECTION AUTOMATIQUE DU TYPE DE FEUILLE
    // ═══════════════════════════════════════════════════════════════════════

    function detectSheetType(headers) {
        const h = headers.map(x => x.toLowerCase());

        // Récolteur/Manager : "biens assignés" ou "locataires assignés" ou "zone"
        if (h.some(x => x.includes('bien') && x.includes('assign')) ||
            h.some(x => x.includes('locataire') && x.includes('assign')) ||
            h.some(x => x.includes('client') && x.includes('assign')) ||
            (h.includes('zone') && !h.some(x => x.includes('loyer') || x.includes('rent') || x.includes('payé')))) {
            return 'collectors';
        }

        // Locataire : "bien loué" ou "loyer" + "impayé/payé"
        if (h.some(x => x.includes('bien lou') || x.includes('loue')) ||
            (h.some(x => x.includes('loyer') || x.includes('rent')) &&
             h.some(x => x.includes('payé') || x.includes('paye') || x.includes('impay')))) {
            return 'clients';
        }

        // Propriétaire : "bien(s)" ou "commission" ou "date paiement" sans "loyer"
        if (h.some(x => x.includes('commission') || x.includes('versement') || x.includes('rib') || x.includes('iban')) ||
            (h.some(x => x.includes('bien') || x.includes('localisation')) &&
             !h.some(x => x.includes('loyer') || x.includes('impay')))) {
            return 'owners';
        }

        // Fallback : si colonnes ressemblent à locataires
        if (h.some(x => x.includes('loyer') || x.includes('agent') || x.includes('récolteur'))) {
            return 'clients';
        }

        return 'owners'; // défaut
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 4 — CONVERTISSEURS PAR TYPE
    // ═══════════════════════════════════════════════════════════════════════

    // Statuts locataire normalisés
    const S_CLIENT = {
        'payé':'paid','paye':'paid','paid':'paid','ok':'paid','à jour':'paid','a jour':'paid',
        'en attente':'pending','attente':'pending','pending':'pending',
        'en retard':'overdue','retard':'overdue','overdue':'overdue','late':'overdue',
        'impayé':'overdue','impaye':'overdue','arriéré':'overdue','arriere':'overdue',
        'inactif':'inactive','inactive':'inactive','parti':'inactive','sorti':'inactive',
    };

    // Statuts propriété normalisés
    const S_PROP = {
        'loué':'loue','loue':'loue','occupied':'loue','occupé':'loue','pris':'loue',
        'libre':'libre','vacant':'libre','disponible':'libre','free':'libre','vide':'libre',
        'partiel':'partiel','partial':'partiel','partiellement':'partiel',
        'rénovation':'en_renovation','renovation':'en_renovation','travaux':'en_renovation',
    };

    // Types de bien normalisés
    const T_PROP = {
        'appartement':'appartement','appt':'appartement','app':'appartement','apt':'appartement','studio':'appartement',
        'immeuble':'immeuble','building':'immeuble','résidence':'immeuble','residence':'immeuble',
        'villa':'villa','maison':'villa','house':'villa',
        'terrain':'terrain','land':'terrain','parcelle':'terrain',
        'bureau':'bureau','office':'bureau','local':'bureau','commerce':'bureau',
        'quartier':'quartier','cité':'quartier','cite':'quartier',
    };

    function normalizeCommission(str) {
        if (!str) return { type: 'percentage', rate: 10, fixed: 0 };
        const clean = str.replace('%', '').trim();
        const num   = parseFloat(clean.replace(/\s/g, '').replace(',', '.')) || 0;
        // Si > 100, c'est probablement un montant fixe
        if (num > 100) return { type: 'fixed', rate: 0, fixed: num };
        return { type: 'percentage', rate: num || 10, fixed: 0 };
    }

    function normalizePaymentDay(str) {
        if (!str) return '';
        const s = str.toLowerCase().trim();
        if (s.includes('dern') || s === '31' || s === '30') return 'dernier';
        const n = parseInt(s);
        if (n >= 1 && n <= 31) return String(n);
        return s;
    }

    // ── Convertir une ligne PROPRIÉTAIRE ──────────────────────────────
    function rowToOwner(raw, idx) {
        const r = mapRow(raw, COL_OWNER);
        const newId = idx + 1;

        // Commission : colonne "commission" peut être % ou montant fixe
        let commType = 'percentage', commRate = 10, commFixed = 0;
        if (r.commissionFixed && parseFloat(r.commissionFixed) > 0) {
            commType  = 'fixed';
            commFixed = parseFloat(r.commissionFixed) || 0;
            commRate  = 0;
        } else if (r.commissionRate) {
            const norm = normalizeCommission(r.commissionRate);
            commType   = norm.type;
            commRate   = norm.rate;
            commFixed  = norm.fixed;
        }

        const owner = {
            id:              newId,
            lastName:        r.lastName   || '',
            firstName:       r.firstName  || '',
            phone:           r.phone      || '',
            email:           r.email      || '',
            address:         r.address    || '',
            joinDate:        new Date().toLocaleDateString('fr-FR'),
            commissionType:  commType,
            commissionRate:  commRate,
            commissionFixed: commFixed,
            paymentDay:      normalizePaymentDay(r.paymentDay),
            bankAccount:     r.bankAccount || '',
            propertiesCount: 0,
            totalRevenue:    0,
            status:          'actif',
            notes:           r.notes || '',
            // Données temporaires pour créer le bien
            _bienNom:        r._bienNom      || '',
            _bienAdresse:    r._bienAdresse  || r.city || '',
            _bienType:       r._bienType     || '',
            _bienArea:       parseFloat(r._bienArea)  || 0,
            _bienValue:      parseFloat(r._bienValue) || 0,
        };

        return owner;
    }

    // ── Convertir une ligne LOCATAIRE ─────────────────────────────────
    function rowToClient(raw, idx) {
        const r = mapRow(raw, COL_CLIENT);

        const amountDue    = parseFloat(r.amountDue)    || 0;
        const amountPaid   = parseFloat(r.amountPaid)   || 0;
        const unpaidAmount = parseFloat(r.unpaidAmount) || 0;
        const unpaidMonths = parseInt(r.unpaidMonths)   || 0;

        // Calcul automatique du statut si absent
        let status = S_CLIENT[(r.status || '').toLowerCase().trim()] || '';
        if (!status) {
            if (unpaidAmount > 0 || unpaidMonths > 0) status = 'overdue';
            else if (amountPaid >= amountDue && amountDue > 0) status = 'paid';
            else if (amountPaid > 0) status = 'pending';
            else status = 'pending';
        }

        return {
            id:              idx + 1,
            lastName:        r.lastName  || '',
            firstName:       r.firstName || '',
            phone:           r.phone     || '',
            email:           r.email     || '',
            address:         r.address   || '',
            property:        r.property  || '',   // nom du bien (clé de liaison)
            agent:           r.agent     || '',   // lastName du récolteur (CLÉ)
            amountDue,
            amountPaid,
            unpaidAmount,
            unpaidMonths,
            balance:         amountDue - amountPaid,
            status,
            lastPaymentDate: r.lastPaymentDate || '',
            contractStart:   r.contractStart   || '',
            contractEnd:     r.contractEnd     || null,
            deposit:         parseFloat(r.deposit) || 0,
            joinDate:        r.contractStart   || new Date().toLocaleDateString('fr-FR'),
            paymentMethod:   '',
            documents:       [],
            notes:           r.notes || '',
            // ownerId et propertyId seront résolus en section 5
        };
    }

    // ── Convertir une ligne RÉCOLTEUR ─────────────────────────────────
    function rowToCollector(raw, idx) {
        const r = mapRow(raw, COL_COLLECTOR);

        return {
            id:               idx + 1,
            lastName:         r.lastName  || '',
            firstName:        r.firstName || '',
            phone:            r.phone     || '',
            email:            r.email     || '',
            zone:             r.zone      || '',
            status:           r.status    || 'active',
            paymentDay:       normalizePaymentDay(r.paymentDay),
            joinDate:         new Date().toLocaleDateString('fr-FR'),
            notes:            r.notes || '',
            // Temporaires pour résolution
            _biensAssignes:       r._biensAssignes      || '',
            _locatairesAssignes:  r._locatairesAssignes || '',
            // Initialisés vides, recalculés en section 5
            assignedProperties: [],
            performance: { clients:0, collected:0, due:0, collectionRate:0, lateClients:0 },
        };
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 5 — RÉSOLUTION DES LIAISONS (le cœur du système)
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Cette fonction recolle TOUTES les liaisons entre les 4 entités.
     * Elle doit être appelée APRÈS la conversion des 3 feuilles.
     *
     * Ordre obligatoire :
     *   1. Propriétaires → créer biens manquants
     *   2. Biens → assigner ownerId
     *   3. Locataires → lier au bien (tenantId, propertyId, ownerId)
     *   4. Récolteurs → lier aux clients (assignedProperties = client.ids)
     *   5. Recalcul performances récolteurs
     */
    function resolveAllRelations(owners, properties, clients, collectors) {

        // ─── 1. Créer les biens définis dans la feuille propriétaires ───
        let nextPropId = Math.max(...properties.map(p => p.id || 0), 0) + 1;

        owners.forEach(owner => {
            if (!owner._bienNom) return;
            // Support de plusieurs biens séparés par | ou /
            const bienNoms = owner._bienNom.split(/[|\/,]/g).map(s => s.trim()).filter(Boolean);

            bienNoms.forEach(bienNom => {
                // Vérifier si le bien existe déjà
                let prop = properties.find(p =>
                    p.name && p.name.toLowerCase().trim() === bienNom.toLowerCase().trim()
                );
                if (!prop) {
                    // Créer le bien
                    prop = {
                        id:          nextPropId++,
                        name:        bienNom,
                        address:     owner._bienAdresse || owner.address || '',
                        city:        owner._bienAdresse || '',
                        type:        T_PROP[((owner._bienType || 'appartement').toLowerCase())] || 'appartement',
                        area:        owner._bienArea  || 0,
                        value:       owner._bienValue || 0,
                        rent:        0,          // sera rempli par le locataire
                        ownerId:     owner.id,
                        status:      'libre',    // mis à jour quand un locataire est lié
                        tenantId:    null,
                        tags:        [],
                    };
                    properties.push(prop);
                } else {
                    // Bien existant : s'assurer qu'il appartient à ce proprio
                    if (!prop.ownerId) prop.ownerId = owner.id;
                }
            });

            // Nettoyer les champs temporaires
            delete owner._bienNom;
            delete owner._bienAdresse;
            delete owner._bienType;
            delete owner._bienArea;
            delete owner._bienValue;
        });

        // ─── 2. S'assurer que tous les biens ont un ownerId ─────────────
        properties.forEach(p => {
            if (!p.ownerId) {
                // Chercher un proprio qui a cet adresse ou ce nom
                const found = owners.find(o =>
                    (o.address && p.address && o.address.toLowerCase() === p.address.toLowerCase())
                );
                if (found) p.ownerId = found.id;
            }
        });

        // ─── 3. Lier les locataires aux biens ───────────────────────────
        clients.forEach(client => {
            if (!client.property) return;

            // Trouver le bien par nom
            const prop = properties.find(p =>
                p.name && client.property &&
                p.name.toLowerCase().trim() === client.property.toLowerCase().trim()
            );

            if (prop) {
                // Liaisons croisées
                client.propertyId = prop.id;
                client.ownerId    = prop.ownerId || 0;   // ← copie comme saveNewTenant() ligne 252
                client.property   = prop.name;           // normaliser le nom

                // Mettre à jour le bien
                if (client.status !== 'inactive') {
                    prop.tenantId = client.id;
                    prop.status   = 'loue';
                    if (client.amountDue > 0) prop.rent = client.amountDue;
                }
            }
        });

        // ─── 4. Lier les récolteurs ──────────────────────────────────────
        collectors.forEach(col => {
            // Méthode A : via _locatairesAssignes (noms en clair)
            if (col._locatairesAssignes) {
                const noms = col._locatairesAssignes.split(/[|,;]/g).map(s => s.trim()).filter(Boolean);
                noms.forEach(nom => {
                    const found = clients.find(c => {
                        const full = (c.lastName + ' ' + c.firstName).toLowerCase();
                        const rev  = (c.firstName + ' ' + c.lastName).toLowerCase();
                        return full.includes(nom.toLowerCase()) || rev.includes(nom.toLowerCase());
                    });
                    if (found && !found.agent) {
                        found.agent = col.lastName; // assigner ce récolteur
                    }
                });
            }

            // Méthode B : via _biensAssignes (noms de biens en clair)
            if (col._biensAssignes) {
                const bienNoms = col._biensAssignes.split(/[|,;]/g).map(s => s.trim()).filter(Boolean);
                bienNoms.forEach(bienNom => {
                    const prop = properties.find(p =>
                        p.name && p.name.toLowerCase().includes(bienNom.toLowerCase())
                    );
                    if (prop && prop.tenantId) {
                        const client = clients.find(c => c.id === prop.tenantId);
                        if (client && !client.agent) {
                            client.agent = col.lastName;
                        }
                    }
                });
            }

            // Méthode C (principale) : assignedProperties = IDs clients dont agent == col.lastName
            // C'est exactement ce que fait loadManagerDashboard() ligne 1264-1270
            const myClients = clients.filter(c =>
                (c.agent || '').toUpperCase() === (col.lastName || '').toUpperCase() ||
                (c.collector || '').toUpperCase() === (col.lastName || '').toUpperCase()
            );

            col.assignedProperties = myClients.map(c => c.id); // IDs clients, comme dans l'app

            // Nettoyer les champs temporaires
            delete col._biensAssignes;
            delete col._locatairesAssignes;

            // ─── 5. Recalculer les performances ─────────────────────────
            const due       = myClients.reduce((s, c) => s + (c.amountDue  || 0), 0);
            const collected = myClients.reduce((s, c) => s + (c.amountPaid || 0), 0);
            const unpaid    = myClients.reduce((s, c) => s + (c.unpaidAmount || 0), 0);

            col.performance = {
                clients:        myClients.filter(c => c.status !== 'inactive').length,
                collected,
                due,
                unpaid,
                collectionRate: due > 0 ? Math.round(collected / due * 100) : 0,
                lateClients:    myClients.filter(c => c.status === 'overdue').length,
            };
        });

        return { owners, properties, clients, collectors };
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 6 — INJECTION DANS L'ÉCOSYSTÈME SYGIM
    // ═══════════════════════════════════════════════════════════════════════

    function injectIntoSYGIM(resolved, mode) {
        const { owners, properties, clients, collectors } = resolved;

        function apply(target, source, label) {
            if (!source || !source.length) return 0;
            if (mode === 'replace') {
                target.length = 0;
                source.forEach(r => target.push(r));
                return source.length;
            } else { // merge
                let n = 0;
                source.forEach(r => {
                    // Dédupliquer par id ou par nom+prénom
                    const dup = target.find(x =>
                        x.id === r.id ||
                        (x.lastName === r.lastName && x.firstName === r.firstName)
                    );
                    if (!dup) { target.push(r); n++; }
                    else { Object.assign(dup, r); n++; } // mise à jour
                });
                return n;
            }
        }

        let total = 0;
        const log = [];

        if (owners.length && typeof ownersData !== 'undefined') {
            const n = apply(ownersData, owners, 'propriétaires');
            total += n;
            log.push(`🏛 ${n} propriétaire(s)`);
        }
        if (properties.length && typeof propertiesData !== 'undefined') {
            const n = apply(propertiesData, properties, 'biens');
            total += n;
            log.push(`🏠 ${n} bien(s)`);
        }
        if (clients.length && typeof clientsData !== 'undefined') {
            const n = apply(clientsData, clients, 'locataires');
            total += n;
            log.push(`👤 ${n} locataire(s)`);
        }
        if (collectors.length && typeof collectorsData !== 'undefined') {
            const n = apply(collectorsData, collectors, 'récolteurs');
            total += n;
            log.push(`🧾 ${n} récolteur(s)`);
        }

        return { total, log };
    }

    // Rafraîchir toute l'interface après import
    function refreshUI() {
        const fns = [
            'loadDashboard','loadClientsGrid','loadOwnersList','loadPropertiesGrid',
            'loadCollectorsGrid','loadManagerDashboard','updateManagerStats',
            'adminRefreshDataTab','updatePortfolioStats','loadOwnerPaymentsTable',
            'updateOverdueStatuses','refreshOwnerDropdowns',
        ];
        fns.forEach(fn => {
            if (typeof window[fn] === 'function') {
                try { window[fn](); } catch (e) {}
            }
        });
        // Mettre à jour les badges
        ['clientBadge','propertyBadge'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                if (id === 'clientBadge' && typeof clientsData !== 'undefined')
                    el.textContent = clientsData.filter(c => c.status === 'pending' || c.status === 'overdue').length;
                if (id === 'propertyBadge' && typeof propertiesData !== 'undefined')
                    el.textContent = propertiesData.length;
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 7 — PATCH adminHandleImportFile + adminConfirmImport
    // ═══════════════════════════════════════════════════════════════════════

    // Données de session pour l'import en cours
    let _session = null;

    function handleFile(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        if (ext !== 'json' && ext !== 'csv') {
            _msg('❌ Format non supporté. Utilisez .json ou .csv', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                if (ext === 'json') {
                    // JSON backup SYGIM : comportement original
                    const data = JSON.parse(e.target.result);
                    window._importData = data;
                    _session = null;
                    _showPreviewJSON(file.name, data);
                    return;
                }

                // ── CSV ──────────────────────────────────────────────────
                const { headers, rows } = parseCSV(e.target.result);
                if (!rows.length) {
                    _msg('❌ Fichier CSV vide ou format non reconnu.', 'error');
                    return;
                }

                const type = detectSheetType(headers);

                // Convertir les lignes selon le type détecté
                let rawOwners = [], rawProperties = [], rawClients = [], rawCollectors = [];

                if (type === 'owners')     rawOwners     = rows.map((r, i) => rowToOwner(r, i));
                if (type === 'clients')    rawClients    = rows.map((r, i) => rowToClient(r, i));
                if (type === 'collectors') rawCollectors = rows.map((r, i) => rowToCollector(r, i));

                // Enrichir avec les données existantes pour la résolution relationnelle
                const existOwners     = _getExisting('ownersData');
                const existProperties = _getExisting('propertiesData');
                const existClients    = _getExisting('clientsData');
                const existCollectors = _getExisting('collectorsData');

                // Fusionner nouvelles + existantes pour résolution cross
                const allOwners     = rawOwners.length     ? rawOwners     : [...existOwners];
                const allProperties = [...existProperties]; // les biens sont créés par les proprios
                const allClients    = rawClients.length    ? rawClients    : [...existClients];
                const allCollectors = rawCollectors.length ? rawCollectors : [...existCollectors];

                // Résoudre toutes les liaisons
                const resolved = resolveAllRelations(allOwners, allProperties, allClients, allCollectors);

                // Calculer les stats de prévisualisation
                const stats = {
                    type,
                    newOwners:      rawOwners.length,
                    newProperties:  resolved.properties.length - existProperties.length,
                    newClients:     rawClients.length,
                    newCollectors:  rawCollectors.length,
                    linkedClients:  allClients.filter(c => c.propertyId).length,
                    linkedProps:    resolved.properties.filter(p => p.tenantId).length,
                    linkedAgents:   allClients.filter(c => c.agent).length,
                };

                _session = { resolved, stats, filename: file.name };
                window._importData = {}; // non-null pour que confirmImport ne sorte pas
                _showPreviewCSV(file.name, stats, resolved);

            } catch (err) {
                _msg('❌ Erreur de lecture : ' + err.message, 'error');
                console.error('[SYGIM-IMPORT]', err);
            }
        };
        reader.readAsText(file, 'UTF-8');
    }

    function _getExisting(varName) {
        try { return (window[varName] && Array.isArray(window[varName])) ? window[varName] : []; }
        catch (e) { return []; }
    }

    // ── Aperçu JSON (original) ────────────────────────────────────────
    function _showPreviewJSON(filename, data) {
        const preview = document.getElementById('importPreviewBox');
        const modSel  = document.getElementById('importModuleSelect');
        const btn     = document.getElementById('importConfirmBtn');

        const counts = [];
        if (data.clients)     counts.push(`${data.clients.length} locataires`);
        if (data.owners)      counts.push(`${data.owners.length} propriétaires`);
        if (data.properties)  counts.push(`${data.properties.length} biens`);
        if (data.collectors)  counts.push(`${data.collectors.length} récolteurs`);
        if (data.transactions)counts.push(`${data.transactions.length} transactions`);

        if (preview) {
            preview.style.display = 'block';
            preview.innerHTML = `
                <div style="color:var(--success);font-weight:600;font-size:13px;margin-bottom:4px;">
                    <i class="fas fa-check-circle"></i> ${filename}
                </div>
                <div style="font-size:12px;color:var(--gray);">${counts.join(' · ')}</div>
                ${data.exportedAt ? `<div style="font-size:11px;color:var(--gray);margin-top:4px;">Exporté le ${new Date(data.exportedAt).toLocaleString('fr-FR')}</div>` : ''}
            `;
        }
        if (modSel) modSel.style.display = data.clients && data.owners ? 'none' : 'block';
        if (btn) { btn.style.display = 'block'; btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Confirmer l\'import'; }
    }

    // ── Aperçu CSV (riche) ────────────────────────────────────────────
    function _showPreviewCSV(filename, stats, resolved) {
        const preview = document.getElementById('importPreviewBox');
        const modSel  = document.getElementById('importModuleSelect');
        const btn     = document.getElementById('importConfirmBtn');

        const TYPES = { owners:'Propriétaires', clients:'Locataires', collectors:'Récolteurs' };
        const badge = (label, n, color) =>
            `<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;background:${color}20;color:${color};margin:2px;">${label} : ${n}</span>`;

        if (preview) {
            preview.style.display = 'block';
            preview.innerHTML = `
                <div style="color:var(--success);font-weight:600;font-size:13px;margin-bottom:8px;">
                    <i class="fas fa-check-circle"></i> ${filename}
                    <span style="font-size:11px;font-weight:400;color:var(--gray);margin-left:6px;">Feuille détectée : ${TYPES[stats.type] || stats.type}</span>
                </div>
                <div style="margin-bottom:8px;">
                    ${stats.newOwners    ? badge('Propriétaires importés', stats.newOwners,    '#10b981') : ''}
                    ${stats.newClients   ? badge('Locataires importés',    stats.newClients,   '#6366f1') : ''}
                    ${stats.newCollectors? badge('Récolteurs importés',    stats.newCollectors,'#8b5cf6') : ''}
                    ${stats.newProperties > 0 ? badge('Biens créés auto', stats.newProperties,'#f59e0b') : ''}
                </div>
                <div style="font-size:12px;color:var(--gray);border-top:1px solid var(--border);padding-top:8px;margin-top:4px;">
                    <strong style="color:var(--text);">🔗 Liaisons résolues automatiquement :</strong><br>
                    ${stats.newOwners && resolved.properties.filter(p=>p.ownerId).length
                        ? `• Biens liés à un propriétaire : <strong>${resolved.properties.filter(p=>p.ownerId).length}</strong><br>` : ''}
                    ${stats.newClients && stats.linkedClients
                        ? `• Locataires liés à un bien : <strong>${stats.linkedClients}/${stats.newClients}</strong><br>` : ''}
                    ${stats.newClients && resolved.clients.filter(c=>c.ownerId).length
                        ? `• Locataires liés à un propriétaire : <strong>${resolved.clients.filter(c=>c.ownerId).length}</strong><br>` : ''}
                    ${stats.newClients && stats.linkedAgents
                        ? `• Locataires assignés à un récolteur : <strong>${stats.linkedAgents}</strong><br>` : ''}
                    ${stats.newCollectors
                        ? `• Récolteurs avec performance calculée : <strong>${resolved.collectors.filter(c=>c.performance.clients>0).length}</strong>` : ''}
                </div>
            `;
        }

        if (modSel) modSel.style.display = 'none'; // pas besoin de sélectionner le module
        if (btn) {
            btn.style.display = 'block';
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-check"></i> Confirmer l\'import et alimenter le système';
        }
    }

    // ─── adminConfirmImport patché ────────────────────────────────────
    function _patchConfirmImport() {
        const _orig = window.adminConfirmImport;
        if (_orig && _orig._sygimPatched) return;

        window.adminConfirmImport = async function () {
            const msgEl = document.getElementById('importResultMsg');
            const mode  = document.getElementById('importMode')?.value || 'merge';

            if (_session) {
                // ── Import CSV avec session résolu ──────────────────────
                const { resolved } = _session;
                const { total, log } = injectIntoSYGIM(resolved, mode);

                // Sauvegarder en IndexedDB
                if (window.SYGIM_DB) await window.SYGIM_DB.saveAll();

                // Mettre à jour les statuts overdue
                if (typeof updateOverdueStatuses === 'function') updateOverdueStatuses();

                // Rafraîchir toute l'UI
                refreshUI();

                if (typeof adminLog === 'function') {
                    adminLog('import', `📥 Import CSV ${mode} : ${total} enregistrements | ${log.join(', ')}`);
                }

                if (msgEl) {
                    msgEl.innerHTML = `<div style="color:var(--success);font-weight:600;">
                        <i class="fas fa-check-circle"></i> Écosystème alimenté avec succès !<br>
                        <span style="font-size:12px;font-weight:400;">${log.join(' · ')}</span>
                    </div>`;
                }

                if (typeof adminRefreshDataTab === 'function') adminRefreshDataTab();

                const btn = document.getElementById('importConfirmBtn');
                if (btn) btn.disabled = true;
                _session = null;
                window._importData = null;

            } else if (window._importData) {
                // ── Import JSON : comportement original ─────────────────
                if (_orig) {
                    _orig.apply(this, arguments);
                } else {
                    // Fallback si _orig non disponible
                    let imported = 0;
                    const data = window._importData;
                    if (mode === 'replace') {
                        if (data.clients)    { clientsData.length=0;    data.clients.forEach(c=>clientsData.push(c));       imported += data.clients.length; }
                        if (data.owners)     { ownersData.length=0;     data.owners.forEach(o=>ownersData.push(o));         imported += data.owners.length; }
                        if (data.properties) { propertiesData.length=0; data.properties.forEach(p=>propertiesData.push(p)); imported += data.properties.length; }
                        if (data.collectors) { collectorsData.length=0; data.collectors.forEach(c=>collectorsData.push(c)); imported += data.collectors.length; }
                    }
                    if (window.SYGIM_DB) await window.SYGIM_DB.saveAll();
                    if (msgEl) msgEl.innerHTML = `<span style="color:var(--success);font-weight:600;"><i class="fas fa-check-circle"></i> ${imported} enregistrements importés.</span>`;
                    window._importData = null;
                    refreshUI();
                }
            } else {
                if (msgEl) msgEl.innerHTML = `<span style="color:var(--warning);">⚠️ Aucune donnée à importer.</span>`;
            }
        };

        window.adminConfirmImport._sygimPatched = true;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 8 — INJECTION DES HANDLERS
    // ═══════════════════════════════════════════════════════════════════════

    function _inject() {
        // Remplacer les handlers de fichier
        window._parseImportFile = handleFile;

        window.adminHandleImportFile = function (e) {
            const f = e.target?.files?.[0];
            if (f) handleFile(f);
        };

        window.adminHandleImportDrop = function (e) {
            e.preventDefault();
            const dz = document.getElementById('importDropZone');
            if (dz) dz.style.borderColor = 'var(--border)';
            const f = e.dataTransfer?.files?.[0];
            if (f) handleFile(f);
        };

        window.adminImportData = function () {
            if (typeof switchDataSubTab === 'function') switchDataSubTab('importexport');
            const inp = document.getElementById('importFileInput');
            if (inp) { inp.accept = '.json,.csv'; inp.click(); }
        };

        // Élargir l'accept de l'input file
        const inp = document.getElementById('importFileInput');
        if (inp) inp.accept = '.json,.csv';

        // Patcher adminConfirmImport
        _patchConfirmImport();

        // Badge CSV dans la zone de drop
        const p = document.querySelector('#dsImportExport p[style]') ||
                  document.querySelector('#dsImportExport .drop-zone p') ||
                  document.querySelector('[ondragover] p');
        if (p && !p.innerHTML.includes('CSV')) {
            p.innerHTML = p.innerHTML + ' <span style="background:#10b981;color:#fff;font-size:10px;font-weight:700;padding:1px 7px;border-radius:10px;vertical-align:middle;">CSV</span>';
        }

        console.info('[SYGIM-IMPORT] ✅ Moteur d\'import complet actif\n' +
            '  Feuille 1 (Propriétaires) → ownersData + propertiesData (biens auto-créés)\n' +
            '  Feuille 2 (Locataires)    → clientsData + property.tenantId + client.ownerId\n' +
            '  Feuille 3 (Récolteurs)    → collectorsData + assignedProperties + performance\n' +
            '  Tout l\'écosystème est nourri en un seul import.');
    }

    function _msg(text, type) {
        if (typeof showAlert === 'function') showAlert(text, type);
        else alert(text);
    }

    // Lancer après chargement complet
    const delay = document.readyState === 'loading' ? 900 : 700;
    setTimeout(() => {
        _inject();
        setTimeout(_patchConfirmImport, 1800); // re-patch si chargement tardif
    }, delay);

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 9 — AIDE ET MODÈLES CSV
    // ═══════════════════════════════════════════════════════════════════════

    window.SYGIM_IMPORT_HELP = function () {
        console.group('📋 SYGIM Import CSV — Guide complet');
        console.log(`
╔════════════════════════════════════════════════════════════╗
║  FEUILLE 1 — PROPRIÉTAIRES (crée aussi les biens)         ║
╠════════════════════════════════════════════════════════════╣
║  Colonnes :                                                ║
║  Nom* | Prénom | Téléphone | Email                        ║
║  Bien(s)           → nom du bien (crée le bien auto)       ║
║  Localisation bien → adresse/ville du bien                 ║
║  Type bien         → appartement|immeuble|villa|terrain    ║
║  Superficie        → en m²                                ║
║  Commission        → ex: "10" (%) ou "50000" (fixe XOF)   ║
║  Montant fixe XOF  → si commission fixe                    ║
║  Date paiement     → ex: "15" ou "dernier"                ║
║  RIB               → numéro de compte                      ║
╠════════════════════════════════════════════════════════════╣
║  FEUILLE 2 — LOCATAIRES (lie au bien + au proprio)        ║
╠════════════════════════════════════════════════════════════╣
║  Nom* | Prénom | Téléphone | Email                        ║
║  Bien loué*        → DOIT correspondre à un bien existant  ║
║  Récolteur         → lastName exact du récolteur           ║
║  Loyer             → montant mensuel dû (XOF)              ║
║  Impayé            → montant total en retard (XOF)         ║
║  Mois impayés      → nombre de mois en retard              ║
║  Montant payé      → cumul des paiements reçus             ║
║  Date paiement     → dernier paiement (JJ/MM/AAAA)        ║
║  Date début        → début du contrat                      ║
╠════════════════════════════════════════════════════════════╣
║  FEUILLE 3 — RÉCOLTEURS / MANAGER                         ║
╠════════════════════════════════════════════════════════════╣
║  Nom* | Prénom | Téléphone | Zone                         ║
║  Biens assignés    → noms séparés par | (optionnel)        ║
║  Locataires assignés → noms séparés par | (optionnel)      ║
╠════════════════════════════════════════════════════════════╣
║  ORDRE D'IMPORT RECOMMANDÉ :                              ║
║  1. Propriétaires  (crée les biens automatiquement)        ║
║  2. Locataires     (lie aux biens → remplit propriétaires) ║
║  3. Récolteurs     (calcule performances auto)             ║
║                                                            ║
║  Séparateur : ; (point-virgule) ou , (virgule) ou Tab      ║
║  Encodage   : UTF-8 (avec ou sans BOM)                     ║
╚════════════════════════════════════════════════════════════╝`);
        console.groupEnd();
    };

    // Modèles CSV téléchargeables
    window.SYGIM_DOWNLOAD_TEMPLATE = function (type) {
        const templates = {
            owners: `Nom;Prénom;Téléphone;Email;Bien(s);Localisation bien;Type bien;Superficie;Commission;Date paiement;RIB
`,

            clients: `Nom;Prénom;Téléphone;Email;Bien loué;Récolteur;Loyer;Impayé;Montant payé;Date paiement;Date début
`,

            collectors: `Nom;Prénom;Téléphone;Zone;Biens assignés;Locataires assignés
`,
        };

        const csv  = templates[type];
        if (!csv) return;
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `SYGIM_modele_${type}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        console.info(`[SYGIM-IMPORT] Modèle ${type} téléchargé`);
    };

    console.info('[SYGIM-IMPORT] 📄 Moteur chargé.\n' +
        '  SYGIM_IMPORT_HELP()              → guide complet\n' +
        '  SYGIM_DOWNLOAD_TEMPLATE("owners")    → modèle propriétaires\n' +
        '  SYGIM_DOWNLOAD_TEMPLATE("clients")   → modèle locataires\n' +
        '  SYGIM_DOWNLOAD_TEMPLATE("collectors")→ modèle récolteurs');

})();
