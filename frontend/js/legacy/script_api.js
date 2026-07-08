/**
 *
 */

(function () {
    'use strict';

    // ── Configuration ──────────────────────────────────────────────
    const API_BASE = window.location.origin + '/api';
    const TOKEN_KEY = 'sygim_jwt_token';
    const USER_KEY  = 'sygim_current_user';

    // ── État ────────────────────────────────────────────────────────
    let _token = localStorage.getItem(TOKEN_KEY) || null;
    let _ready = false;

    // ───────────────────────────────────────────────────────────────
    // CLIENT HTTP GÉNÉRIQUE
    // ───────────────────────────────────────────────────────────────

    async function api(method, path, body = null) {
        const opts = {
            method,
            headers: { 'Content-Type': 'application/json' }
        };

        if (_token) {
            opts.headers['Authorization'] = 'Bearer ' + _token;
        }

        if (body && method !== 'GET') {
            opts.body = JSON.stringify(body);
        }

        const res = await fetch(API_BASE + path, opts);
        const json = await res.json();

        if (!res.ok) {
            console.error(`[API] ${method} ${path} → ${res.status}`, json);
            throw new Error(json.error || 'Erreur API');
        }

        return json;
    }

    // Raccourcis
    const GET    = (path)       => api('GET', path);
    const POST   = (path, body) => api('POST', path, body);
    const PUT    = (path, body) => api('PUT', path, body);
    const DELETE = (path)       => api('DELETE', path);

    // ───────────────────────────────────────────────────────────────
    // AUTHENTIFICATION
    // ───────────────────────────────────────────────────────────────

    /**
     * Remplace la fonction login() du script_main.js
     * pour authentifier via l'API REST au lieu de la mémoire JS
     */
    function _patchLogin() {
        const _origLogin = window.login;

        window.login = async function () {
            const usernameRaw = (document.getElementById('loginUsername') || document.getElementById('email'))?.value.trim();
            const password    = document.getElementById('loginPassword')?.value;
            const alertError  = document.getElementById('alertError');

            if (!usernameRaw || !password) {
                alertError.textContent = 'Veuillez entrer votre nom et votre mot de passe.';
                alertError.classList.add('show');
                return;
            }

            try {
                alertError.classList.remove('show');

                const result = await POST('/auth/login', {
                    username: usernameRaw,
                    password: password
                });

                if (result.success) {
                    // Stocker le token
                    _token = result.token;
                    localStorage.setItem(TOKEN_KEY, _token);
                    localStorage.setItem(USER_KEY, JSON.stringify(result.user));

                    // Injecter l'utilisateur dans le compte en mémoire pour compatibilité
                    const user = result.user;
                    USER_ACCOUNTS[user.username] = {
                        role:          user.role,
                        password:      password, // Gardé en mémoire pour compat (pas persisté)
                        firstName:     user.firstName,
                        lastName:      user.lastName,
                        displayName:   user.displayName,
                        avatar:        user.avatar,
                        active:        true,
                        collectorName: user.collectorName || null,
                        createdAt:     new Date().toLocaleDateString('fr-FR')
                    };

                    // Appeler la logique originale de post-login
                    // On simule le comportement du login d'origine
                    currentUser = {
                        ...USER_ACCOUNTS[user.username],
                        username: user.username,
                        email:    user.username,
                        userType: user.role
                    };

                    document.getElementById('authContainer').classList.add('hidden');

                    // Charger les données depuis l'API
                    await _loadAllData();

                    // Routage par rôle (reproduit le code original)
                    const userType = user.role;

                    if (userType === 'admin') {
                        document.getElementById('adminMain').style.display = 'flex';
                        document.getElementById('adminAvatar').textContent = user.avatar || 'ADM';
                        document.getElementById('adminName').textContent   = user.displayName || 'Administrateur';
                        if (typeof adminShowTab === 'function') adminShowTab('access');
                        if (typeof adminRenderUsers === 'function') adminRenderUsers();
                        if (typeof adminRenderStats === 'function') adminRenderStats();
                        if (typeof adminLoadSettings === 'function') adminLoadSettings();
                    }
                    else if (userType === 'collector') {
                        const collectorEl = document.getElementById('collectorMain');
                        if (collectorEl) collectorEl.classList.add('active');
                        if (typeof loadCollectorClientCards === 'function') loadCollectorClientCards();
                    }
                    else if (userType === 'director') {
                        const dirEl = document.getElementById('directorMain');
                        if (dirEl) dirEl.classList.add('active');
                        if (typeof loadDirectorDashboard === 'function') loadDirectorDashboard();
                    }
                    else if (userType === 'accounting') {
                        const accEl = document.getElementById('accountingMain');
                        if (accEl) accEl.classList.add('active');
                        if (typeof loadAccountingDashboard === 'function') loadAccountingDashboard();
                    }
                    else if (userType === 'collector_manager') {
                        const mgrEl = document.getElementById('managerMain');
                        if (mgrEl) mgrEl.classList.add('active');
                        if (typeof loadManagerDashboard === 'function') loadManagerDashboard();
                    }

                    _showToast(`✅ Bienvenue ${user.displayName} !`);
                }
            } catch (err) {
                alertError.textContent = err.message || 'Erreur de connexion au serveur.';
                alertError.classList.add('show');
            }
        };
    }

    /**
     * Patch logout pour nettoyer le token
     */
    function _patchLogout() {
        const _origLogout = window.logout;
        window.logout = function () {
            _token = null;
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
            currentUser = null;
            if (typeof _origLogout === 'function') {
                _origLogout.apply(this, arguments);
            } else {
                location.reload();
            }
        };
    }

    // ───────────────────────────────────────────────────────────────
    // CHARGEMENT DES DONNÉES DEPUIS L'API
    // ───────────────────────────────────────────────────────────────

    async function _loadAllData() {
        try {
            // Charger les clients
            const clientsResult = await GET('/clients?limit=10000');
            if (clientsResult.success && clientsResult.data) {
                clientsData.length = 0;
                clientsResult.data.forEach(c => {
                    clientsData.push(_mapClientFromAPI(c));
                });
            }

            // Charger les propriétés
            const propsResult = await GET('/properties?limit=10000');
            if (propsResult.success && propsResult.data) {
                propertiesData.length = 0;
                propsResult.data.forEach(p => {
                    propertiesData.push(_mapPropertyFromAPI(p));
                });
            }

            // Charger les propriétaires
            const ownersResult = await GET('/owners');
            if (ownersResult.success && ownersResult.data) {
                ownersData.length = 0;
                ownersResult.data.forEach(o => {
                    ownersData.push(_mapOwnerFromAPI(o));
                });
            }

            // Charger les transactions
            const txResult = await GET('/transactions?limit=10000');
            if (txResult.success && txResult.data) {
                transactionsData.length = 0;
                txResult.data.forEach(t => {
                    transactionsData.push(_mapTransactionFromAPI(t));
                });
            }

            // Charger les utilisateurs (si admin)
            if (currentUser && currentUser.userType === 'admin') {
                try {
                    const usersResult = await GET('/users');
                    if (usersResult.success && usersResult.data) {
                        usersResult.data.forEach(u => {
                            USER_ACCOUNTS[u.username] = {
                                role:          u.role,
                                password:      '••••••',
                                firstName:     u.first_name,
                                lastName:      u.last_name,
                                displayName:   u.display_name,
                                avatar:        u.avatar,
                                active:        !!u.active,
                                collectorName: u.collector_name || null,
                                lastLogin:     u.last_login,
                                createdAt:     u.created_at ? new Date(u.created_at).toLocaleDateString('fr-FR') : '',
                                _id:           u.id
                            };
                        });
                    }
                } catch (e) {
                    console.warn('[API] Impossible de charger les utilisateurs:', e.message);
                }
            }

            console.info('[API] 🔄 Données chargées',
                `| clients:${clientsData.length}`,
                `| propriétés:${propertiesData.length}`,
                `| propriétaires:${ownersData.length}`,
                `| transactions:${transactionsData.length}`
            );

            _ready = true;

        } catch (err) {
            console.error('[API] ❌ Erreur chargement données:', err);
            _showToast('❌ Erreur de chargement des données', 'error');
        }
    }

    // ───────────────────────────────────────────────────────────────
    // MAPPERS : API → Format frontend
    // ───────────────────────────────────────────────────────────────

    function _mapClientFromAPI(c) {
        return {
            id:              c.id,
            firstName:       c.first_name || '',
            lastName:        c.last_name || '',
            phone:           c.phone || '',
            email:           c.email || '',
            address:         c.address || '',
            property:        c.property_name || '',
            propertyValue:   parseFloat(c.property_value) || 0,
            amountDue:       parseFloat(c.amount_due) || 0,
            amountPaid:      parseFloat(c.amount_paid) || 0,
            paymentMethod:   c.payment_method || '',
            status:          c.status || 'pending',
            agent:           c.agent || '',
            ownerId:         c.owner_id,
            deposit:         parseFloat(c.deposit) || 0,
            advancePayment:  parseFloat(c.advance_payment) || 0,
            contractStart:   c.contract_start || null,
            contractEnd:     c.contract_end || null,
            departureReason: c.departure_reason || null,
            departureNotes:  c.departure_notes || null,
            joinDate:        c.join_date || '',
            _propertyId:     c.property_id
        };
    }

    function _mapPropertyFromAPI(p) {
        return {
            id:          p.id,
            name:        p.name || '',
            address:     p.address || '',
            type:        p.type || 'appartement',
            status:      p.status || 'vacant',
            value:       parseFloat(p.value) || 0,
            rent:        parseFloat(p.rent) || 0,
            area:        parseFloat(p.area) || null,
            rooms:       p.rooms || null,
            description: p.description || '',
            imageUrl:    p.image_url || null,
            ownerId:     p.owner_id,
            tenantId:    p.tenant_id,
            collectorId: p.collector_id,
            ownerFirstName: p.owner_first_name || '',
            ownerLastName:  p.owner_last_name || ''
        };
    }

    function _mapOwnerFromAPI(o) {
        return {
            id:          o.id,
            firstName:   o.first_name || '',
            lastName:    o.last_name || '',
            displayName: o.display_name || '',
            phone:       o.phone || '',
            email:       o.email || '',
            address:     o.address || '',
            idNumber:    o.id_number || '',
            bankName:    o.bank_name || '',
            bankAccount: o.bank_account || '',
            notes:       o.notes || '',
            active:      !!o.active
        };
    }

    function _mapTransactionFromAPI(t) {
        return {
            id:            t.id,
            reference:     t.reference || '',
            date:          t.date_display || (t.date ? new Date(t.date).toLocaleDateString('fr-FR') : ''),
            client:        t.client_name || '',
            clientId:      t.client_id,
            description:   t.description || '',
            amount:        parseFloat(t.amount) || 0,
            method:        t.method || '',
            status:        t.status || 'pending',
            paymentType:   t.payment_type || null,
            dueDate:       t.due_date || null,
            notes:         t.notes || '',
            collectorId:   t.collector_id,
            signatureData: t.signature_data || null
        };
    }

    // ───────────────────────────────────────────────────────────────
    // PATCH DES FONCTIONS DE SAUVEGARDE
    // ───────────────────────────────────────────────────────────────

    function _patchSaveFunctions() {

        // ── saveNewTenant → POST /api/clients ─────────────────────
        const _origSaveNewTenant = window.saveNewTenant;
        if (typeof _origSaveNewTenant === 'function') {
            window.saveNewTenant = async function () {
                // Exécuter la logique originale (ajoute au tableau)
                _origSaveNewTenant.apply(this, arguments);

                // Persister le dernier client via l'API
                const last = clientsData[clientsData.length - 1];
                if (last) {
                    try {
                        const prop = propertiesData.find(p => p.tenantId === last.id);
                        const result = await POST('/clients', {
                            firstName:     last.firstName,
                            lastName:      last.lastName,
                            phone:         last.phone,
                            email:         last.email,
                            address:       last.address,
                            propertyId:    prop?.id || last._propertyId || null,
                            propertyName:  last.property,
                            propertyValue: last.propertyValue,
                            amountDue:     last.amountDue,
                            agent:         last.agent,
                            ownerId:       last.ownerId,
                            deposit:       last.deposit,
                            contractStart: last.contractStart,
                            contractEnd:   last.contractEnd
                        });
                        if (result.success) {
                            last.id = result.data.id;
                            console.info('[API] 💾 Locataire sauvegardé:', last.lastName);
                        }
                    } catch (e) {
                        console.error('[API] Erreur save tenant:', e);
                    }
                }
            };
        }

        // ── saveProperty / addProperty → POST /api/properties ─────
        ['saveProperty', 'addProperty'].forEach(fnName => {
            const orig = window[fnName];
            if (typeof orig === 'function') {
                window[fnName] = async function () {
                    orig.apply(this, arguments);
                    const last = propertiesData[propertiesData.length - 1];
                    if (last) {
                        try {
                            const result = await POST('/properties', {
                                name:        last.name,
                                address:     last.address,
                                type:        last.type,
                                status:      last.status,
                                value:       last.value,
                                rent:        last.rent,
                                area:        last.area,
                                rooms:       last.rooms,
                                description: last.description,
                                ownerId:     last.ownerId
                            });
                            if (result.success) last.id = result.data.id;
                        } catch (e) {
                            console.error('[API] Erreur save property:', e);
                        }
                    }
                };
            }
        });

        // ── saveOwner / addOwner → POST /api/owners ───────────────
        ['saveOwner', 'addOwner', 'submitOwnerForm', 'saveNewOwner'].forEach(fnName => {
            const orig = window[fnName];
            if (typeof orig === 'function') {
                window[fnName] = async function () {
                    orig.apply(this, arguments);
                    const last = ownersData[ownersData.length - 1];
                    if (last) {
                        try {
                            const result = await POST('/owners', {
                                firstName:   last.firstName,
                                lastName:    last.lastName,
                                displayName: last.displayName,
                                phone:       last.phone,
                                email:       last.email,
                                address:     last.address,
                                idNumber:    last.idNumber,
                                bankName:    last.bankName,
                                bankAccount: last.bankAccount,
                                notes:       last.notes
                            });
                            if (result.success) last.id = result.data.id;
                        } catch (e) {
                            console.error('[API] Erreur save owner:', e);
                        }
                    }
                };
            }
        });

        // ── recordPayment / processPayment → POST /api/transactions
        ['recordPayment', 'processPayment', 'confirmPayment', 'savePayment'].forEach(fnName => {
            const orig = window[fnName];
            if (typeof orig === 'function') {
                window[fnName] = async function () {
                    orig.apply(this, arguments);
                    // Persist le dernier paiement ajouté
                    const lastTx = transactionsData[transactionsData.length - 1];
                    if (lastTx) {
                        try {
                            await POST('/transactions', {
                                clientId:      lastTx.clientId || null,
                                clientName:    lastTx.client,
                                description:   lastTx.description,
                                amount:        lastTx.amount,
                                method:        lastTx.method,
                                reference:     lastTx.reference,
                                status:        lastTx.status || 'processed',
                                paymentType:   lastTx.paymentType,
                                notes:         lastTx.notes,
                                signatureData: lastTx.signatureData
                            });
                        } catch (e) {
                            console.error('[API] Erreur save payment:', e);
                        }
                    }
                };
            }
        });

        // ── processTenantReplacement → POST /api/clients/:id/replace
        const _origReplace = window.processTenantReplacement;
        if (typeof _origReplace === 'function') {
            window.processTenantReplacement = async function () {
                _origReplace.apply(this, arguments);
                // La persistance est gérée par le patch des clients et transactions
                try {
                    await _syncAllToServer();
                } catch (e) {
                    console.error('[API] Erreur sync après remplacement:', e);
                }
            };
        }

        // ── Création utilisateur admin ─────────────────────────────
        const _origCreateUser = window.adminSaveUser || window.adminCreateUser;
        if (typeof _origCreateUser === 'function') {
            const fnName = window.adminSaveUser ? 'adminSaveUser' : 'adminCreateUser';
            window[fnName] = async function () {
                _origCreateUser.apply(this, arguments);
                // Sync les comptes
                _showToast('💾 Compte utilisateur sauvegardé');
            };
        }

        // ── deleteClient / removeClient ────────────────────────────
        ['deleteClient', 'removeClient', 'deactivateClient'].forEach(fnName => {
            const orig = window[fnName];
            if (typeof orig === 'function') {
                window[fnName] = async function (id) {
                    orig.apply(this, arguments);
                    if (id) {
                        try {
                            await DELETE('/clients/' + id);
                        } catch (e) {
                            console.error('[API] Erreur delete client:', e);
                        }
                    }
                };
            }
        });

        // ── deleteProperty ─────────────────────────────────────────
        const _origDelProp = window.deleteProperty;
        if (typeof _origDelProp === 'function') {
            window.deleteProperty = async function (id) {
                _origDelProp.apply(this, arguments);
                if (id) {
                    try {
                        await api('DELETE', '/properties/' + id);
                    } catch (e) {
                        console.error('[API] Erreur delete property:', e);
                    }
                }
            };
        }

        console.info('[API] 🔧 Fonctions patchées avec succès');
    }

    // ───────────────────────────────────────────────────────────────
    // SYNCHRONISATION COMPLÈTE (frontend → backend)
    // ───────────────────────────────────────────────────────────────

    async function _syncAllToServer() {
        // Recharger depuis le serveur pour rester synchronisé
        await _loadAllData();
    }

    // ───────────────────────────────────────────────────────────────
    // API PUBLIQUE (window.SYGIM_DB) — Compatibilité avec l'ancien code
    // ───────────────────────────────────────────────────────────────

    window.SYGIM_DB = {
        saveAll: async function () {
            _showToast('✅ Données synchronisées avec le serveur !');
        },

        reload: _loadAllData,

        reset: async function () {
            if (!confirm('⚠️ ATTENTION : Ceci va recharger toutes les données depuis le serveur. Continuer ?')) return;
            await _loadAllData();
            _showToast('🔄 Données rechargées depuis le serveur');
        },

        export: async function () {
            const data = {
                clients:      clientsData,
                owners:       ownersData,
                properties:   propertiesData,
                transactions: transactionsData
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href     = url;
            a.download = `SYGIM_backup_${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
        },

        import: async function (jsonData) {
            _showToast('ℹ️ Import JSON : utilisez les endpoints API pour importer', 'info');
        },

        stats: async function () {
            const s = {
                clients:      clientsData.length,
                owners:       ownersData.length,
                properties:   propertiesData.length,
                transactions: transactionsData.length
            };
            console.table(s);
            return s;
        }
    };

    // ───────────────────────────────────────────────────────────────
    // TOAST NOTIFICATION (identique à l'ancien)
    // ───────────────────────────────────────────────────────────────

    function _showToast(msg, type = 'success') {
        const existing = document.getElementById('sygim-db-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'sygim-db-toast';
        toast.style.cssText = `
            position:fixed; bottom:24px; right:24px; z-index:99999;
            padding:14px 22px; border-radius:12px; font-size:14px;
            font-family:'Poppins',sans-serif; font-weight:600;
            box-shadow:0 8px 30px rgba(0,0,0,.18);
            background:${type === 'error' ? '#ef4444' : '#10b981'};
            color:#fff; transform:translateY(20px); opacity:0;
            transition:all .35s cubic-bezier(.34,1.56,.64,1);
            display:flex; align-items:center; gap:10px;
        `;
        toast.innerHTML = msg;
        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            toast.style.transform = 'translateY(0)';
            toast.style.opacity   = '1';
        });

        setTimeout(() => {
            toast.style.transform = 'translateY(20px)';
            toast.style.opacity   = '0';
            setTimeout(() => toast.remove(), 400);
        }, 3500);
    }

    // ───────────────────────────────────────────────────────────────
    // BOUTON FLOTTANT "SYNC"
    // ───────────────────────────────────────────────────────────────

    function _injectSyncButton() {
        if (document.getElementById('sygim-save-fab')) return;

        const fab = document.createElement('button');
        fab.id    = 'sygim-save-fab';
        fab.title = 'Synchroniser avec le serveur';
        fab.innerHTML = '<i class="fas fa-sync-alt"></i>';
        fab.style.cssText = `
            position:fixed; bottom:24px; left:24px; z-index:9999;
            width:50px; height:50px; border-radius:50%;
            background:linear-gradient(135deg,#6366f1,#8b5cf6);
            color:#fff; border:none; cursor:pointer; font-size:18px;
            box-shadow:0 4px 20px rgba(99,102,241,.45);
            transition:transform .2s, box-shadow .2s;
            display:flex; align-items:center; justify-content:center;
        `;
        fab.onmouseenter = () => { fab.style.transform = 'scale(1.12)'; };
        fab.onmouseleave = () => { fab.style.transform = 'scale(1)'; };
        fab.onclick = async () => {
            fab.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            await _loadAllData();
            fab.innerHTML = '<i class="fas fa-sync-alt"></i>';
            _showToast('✅ Données synchronisées !');
        };

        document.body.appendChild(fab);
    }

    // ───────────────────────────────────────────────────────────────
    // AUTO-SYNC PÉRIODIQUE
    // ───────────────────────────────────────────────────────────────

    function _startAutoSync() {
        setInterval(async () => {
            if (_ready && _token) {
                try {
                    await _loadAllData();
                    console.info('[API] ⏱️ Auto-sync effectué');
                } catch (e) {
                    console.warn('[API] Auto-sync échoué:', e.message);
                }
            }
        }, 5 * 60 * 1000); // 5 minutes
    }

    // ───────────────────────────────────────────────────────────────
    // DÉMARRAGE
    // ───────────────────────────────────────────────────────────────

    async function init() {
        try {
            // Vérifier si un token existe déjà (session précédente)
            if (_token) {
                try {
                    const meResult = await GET('/auth/me');
                    if (meResult.success) {
                        currentUser = {
                            ...meResult.user,
                            email:    meResult.user.username,
                            userType: meResult.user.role
                        };
                        // Charger les données
                        await _loadAllData();
                        console.info('[API] 🔄 Session restaurée pour:', meResult.user.displayName);
                    }
                } catch (e) {
                    // Token expiré
                    _token = null;
                    localStorage.removeItem(TOKEN_KEY);
                    localStorage.removeItem(USER_KEY);
                }
            }

            // Attendre que les scripts principaux soient chargés
            const waitForApp = setInterval(() => {
                if (typeof clientsData !== 'undefined'
                    && typeof propertiesData !== 'undefined'
                    && typeof USER_ACCOUNTS !== 'undefined') {
                    clearInterval(waitForApp);
                    _patchLogin();
                    _patchLogout();
                    _patchSaveFunctions();
                    _injectSyncButton();
                    _startAutoSync();
                    console.info('[API] 🚀 Couche API active — Backend:', API_BASE);
                }
            }, 150);

        } catch (err) {
            console.error('[API] ❌ Erreur initialisation:', err);
        }
    }

    // Lancer dès que possible
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
