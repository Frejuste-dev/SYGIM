/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║        SYGIM — Adaptateur API (Révisé)                            ║
 * ║     Synchronisation API directe - Pas d'interception asynchrone    ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */

(function() {
    'use strict';

    /**
     * 🔧 IMPORTANT: Cet adaptateur fournit des méthodes utilitaires
     * pour synchroniser les données avec l'API de manière SYNCHRONE.
     *
     * UTILISATION: Au lieu de sauvegarder directement dans localStorage,
     * les formulaires doivent appeler les méthodes de ce module qui vont:
     * 1. Appeler l'API
     * 2. Attendre la réponse
     * 3. Sauvegarder dans localStorage avec les IDs retournés
     * 4. Retourner le résultat au formulaire
     */

    window.SyncAdapter = {
        _pendingRequests: new Set(),

        // ─────────────────────────────────────────────────────────
        // CLIENTS
        // ─────────────────────────────────────────────────────────

        /**
         * Créer un client et le sauvegarder localement
         * @param {object} clientData
         * @returns {Promise<object>} {success, data, message}
         */
        createClient: async function(clientData) {
            const lockKey = `client_${clientData.phone || Date.now()}`;
            if (this._pendingRequests.has(lockKey)) {
                return { success: false, error: 'Traitement en cours, veuillez patienter...' };
            }
            this._pendingRequests.add(lockKey);

            try {
                // Valider les données obligatoires
                if (!clientData.lastName || !clientData.phone) {
                    return {
                        success: false,
                        error: 'Nom et téléphone sont obligatoires'
                    };
                }

                console.log('[SyncAdapter] Création client:', clientData);

                // Appeler l'API
                const response = await API.Clients.create(clientData);

                if (response.success) {
                    // Récupérer la liste locale et ajouter le client avec l'ID
                    const clients = JSON.parse(localStorage.getItem('CLIENTS_DB') || '[]');
                    const newClient = {
                        ...clientData,
                        id: response.data.id,
                        _synced: true,
                        createdAt: new Date().toISOString()
                    };
                    clients.push(newClient);

                    // Sauvegarder localement
                    localStorage.setItem('CLIENTS_DB', JSON.stringify(clients));

                    console.log('[SyncAdapter] ✅ Client créé et synchronisé:', response.data.id);

                    return {
                        success: true,
                        data: response.data,
                        message: 'Client créé avec succès'
                    };
                } else {
                    return {
                        success: false,
                        error: response.error || 'Erreur lors de la création'
                    };
                }
            } catch (error) {
                console.error('[SyncAdapter] Erreur creation client:', error);
                return {
                    success: false,
                    error: error.message || 'Erreur serveur'
                };
            } finally {
                this._pendingRequests.delete(lockKey);
            }
        },

        /**
         * Mettre à jour un client
         * @param {number} clientId
         * @param {object} clientData
         * @returns {Promise<object>}
         */
        updateClient: async function(clientId, clientData) {
            try {
                console.log('[SyncAdapter] Mise à jour client:', clientId);

                const response = await API.Clients.update(clientId, clientData);

                if (response.success) {
                    // Mettre à jour localement
                    const clients = JSON.parse(localStorage.getItem('CLIENTS_DB') || '[]');
                    const index = clients.findIndex(c => c.id === clientId);
                    if (index !== -1) {
                        clients[index] = { ...clients[index], ...clientData, _synced: true };
                        localStorage.setItem('CLIENTS_DB', JSON.stringify(clients));
                    }

                    console.log('[SyncAdapter] ✅ Client mis à jour:', clientId);
                    return { success: true, message: 'Client mis à jour' };
                } else {
                    return { success: false, error: response.error };
                }
            } catch (error) {
                console.error('[SyncAdapter] Erreur update client:', error);
                return { success: false, error: error.message };
            }
        },

        /**
         * Supprimer un client
         * @param {number} clientId
         * @returns {Promise<object>}
         */
        deleteClient: async function(clientId) {
            try {
                const response = await API.Clients.delete(clientId);

                if (response.success) {
                    // Supprimer localement
                    const clients = JSON.parse(localStorage.getItem('CLIENTS_DB') || '[]');
                    const filtered = clients.filter(c => c.id !== clientId);
                    localStorage.setItem('CLIENTS_DB', JSON.stringify(filtered));

                    return { success: true, message: 'Client supprimé' };
                } else {
                    return { success: false, error: response.error };
                }
            } catch (error) {
                return { success: false, error: error.message };
            }
        },

        // ─────────────────────────────────────────────────────────
        // TRANSACTIONS
        // ─────────────────────────────────────────────────────────

        /**
         * Créer une transaction et mettre à jour le client
         * @param {object} transactionData
         * @returns {Promise<object>}
         */
        createTransaction: async function(transactionData) {
            const lockKey = `tx_${transactionData.clientId}_${transactionData.amount}`;
            if (this._pendingRequests.has(lockKey)) {
                return { success: false, error: 'Une transaction identique est déjà en cours...' };
            }
            this._pendingRequests.add(lockKey);

            try {
                if (!transactionData.amount || transactionData.amount <= 0) {
                    return {
                        success: false,
                        error: 'Le montant doit être supérieur à 0'
                    };
                }

                console.log('[SyncAdapter] Création transaction:', transactionData);

                const response = await API.Transactions.create(transactionData);

                if (response.success) {
                    // Sauvegarder transaction localement
                    const transactions = JSON.parse(localStorage.getItem('TRANSACTIONS_DB') || '[]');
                    const newTx = {
                        ...transactionData,
                        id: response.data.id,
                        reference: response.data.reference,
                        _synced: true,
                        createdAt: new Date().toISOString()
                    };
                    transactions.push(newTx);
                    localStorage.setItem('TRANSACTIONS_DB', JSON.stringify(transactions));

                    // Mettre à jour le client si lié
                    if (transactionData.clientId) {
                        this._updateClientAfterTransaction(
                            transactionData.clientId,
                            transactionData.amount
                        );
                    }

                    console.log('[SyncAdapter] ✅ Transaction créée:', response.data.id);

                    return {
                        success: true,
                        data: response.data,
                        message: 'Transaction enregistrée'
                    };
                } else {
                    return { success: false, error: response.error };
                }
            } catch (error) {
                console.error('[SyncAdapter] Erreur creation transaction:', error);
                return { success: false, error: error.message };
            } finally {
                this._pendingRequests.delete(lockKey);
            }
        },

        /**
         * Mettre à jour les données du client après transaction
         * @private
         */
        _updateClientAfterTransaction: function(clientId, amount) {
            const clients = JSON.parse(localStorage.getItem('CLIENTS_DB') || '[]');
            const client = clients.find(c => c.id === clientId);

            if (client) {
                client.amount_paid = (client.amount_paid || 0) + amount;

                // Calculer le nouveau status
                if (client.amount_paid >= client.amount_due) {
                    client.status = 'paid';
                } else if (client.amount_paid > 0) {
                    client.status = 'partial';
                }

                localStorage.setItem('CLIENTS_DB', JSON.stringify(clients));
            }
        },

        // ─────────────────────────────────────────────────────────
        // PROPRIÉTÉS
        // ─────────────────────────────────────────────────────────

        /**
         * Créer une propriété
         * @param {object} propertyData
         * @returns {Promise<object>}
         */
        createProperty: async function(propertyData) {
            try {
                if (!propertyData.name || !propertyData.address) {
                    return {
                        success: false,
                        error: 'Nom et adresse sont obligatoires'
                    };
                }

                const response = await API.Properties.create(propertyData);

                if (response.success) {
                    const properties = JSON.parse(localStorage.getItem('PROPERTIES_DB') || '[]');
                    const newProp = {
                        ...propertyData,
                        id: response.data.id,
                        _synced: true,
                        createdAt: new Date().toISOString()
                    };
                    properties.push(newProp);
                    localStorage.setItem('PROPERTIES_DB', JSON.stringify(properties));

                    return {
                        success: true,
                        data: response.data,
                        message: 'Propriété créée'
                    };
                } else {
                    return { success: false, error: response.error };
                }
            } catch (error) {
                return { success: false, error: error.message };
            }
        },

        /**
         * Mettre à jour une propriété
         * @param {number} propertyId
         * @param {object} propertyData
         * @returns {Promise<object>}
         */
        updateProperty: async function(propertyId, propertyData) {
            try {
                const response = await API.Properties.update(propertyId, propertyData);

                if (response.success) {
                    const properties = JSON.parse(localStorage.getItem('PROPERTIES_DB') || '[]');
                    const index = properties.findIndex(p => p.id === propertyId);
                    if (index !== -1) {
                        properties[index] = { ...properties[index], ...propertyData, _synced: true };
                        localStorage.setItem('PROPERTIES_DB', JSON.stringify(properties));
                    }
                    return { success: true, message: 'Propriété mise à jour' };
                } else {
                    return { success: false, error: response.error };
                }
            } catch (error) {
                return { success: false, error: error.message };
            }
        },

        // ─────────────────────────────────────────────────────────
        // UTILISATEURS
        // ─────────────────────────────────────────────────────────

        /**
         * Créer un utilisateur (Admin)
         * @param {object} userData
         * @returns {Promise<object>}
         */
        createUser: async function(userData) {
            try {
                if (!userData.username || !userData.password || !userData.role) {
                    return {
                        success: false,
                        error: 'Username, password et role sont obligatoires'
                    };
                }

                const response = await API.Users.create(userData);

                if (response.success) {
                    return {
                        success: true,
                        data: response.data,
                        message: 'Utilisateur créé'
                    };
                } else {
                    return { success: false, error: response.error };
                }
            } catch (error) {
                return { success: false, error: error.message };
            }
        },

        /**
         * Inscription publique (auto-register)
         * @param {object} userData
         * @returns {Promise<object>}
         */
        registerUser: async function(userData) {
            try {
                if (!userData.username || !userData.password) {
                    return {
                        success: false,
                        error: 'Username et password obligatoires'
                    };
                }

                const response = await API.Auth.register(userData);

                if (response.success) {
                    // Sauvegarder le token et l'utilisateur
                    localStorage.setItem(CONFIG.STORAGE.JWT_TOKEN, response.token);
                    localStorage.setItem(CONFIG.STORAGE.CURRENT_USER, JSON.stringify(response.user));

                    return {
                        success: true,
                        data: response.user,
                        token: response.token,
                        message: 'Inscription réussie'
                    };
                } else {
                    return { success: false, error: response.error };
                }
            } catch (error) {
                return { success: false, error: error.message };
            }
        },

        // ─────────────────────────────────────────────────────────
        // UTILITAIRES
        // ─────────────────────────────────────────────────────────

        /**
         * Synchroniser toutes les données non-synchronisées avec l'API
         * À appeler au démarrage ou après reconnexion
         * @returns {Promise<object>}
         */
        syncAll: async function() {
            try {
                console.log('[SyncAdapter] Synchronisation complète...');

                let synced = 0;
                let failed = 0;

                // Sync clients
                const clients = JSON.parse(localStorage.getItem('CLIENTS_DB') || '[]');
                for (const client of clients) {
                    if (!client._synced && client.id) {
                        try {
                            await API.Clients.update(client.id, client);
                            client._synced = true;
                            synced++;
                        } catch (e) {
                            failed++;
                        }
                    }
                }
                localStorage.setItem('CLIENTS_DB', JSON.stringify(clients));

                // Sync properties
                const properties = JSON.parse(localStorage.getItem('PROPERTIES_DB') || '[]');
                for (const prop of properties) {
                    if (!prop._synced && prop.id) {
                        try {
                            await API.Properties.update(prop.id, prop);
                            prop._synced = true;
                            synced++;
                        } catch (e) {
                            failed++;
                        }
                    }
                }
                localStorage.setItem('PROPERTIES_DB', JSON.stringify(properties));

                console.log(`[SyncAdapter] ✅ Synchronisé: ${synced}, ❌ Échoué: ${failed}`);

                return {
                    success: failed === 0,
                    synced,
                    failed,
                    message: `${synced} éléments synchronisés, ${failed} échoués`
                };
            } catch (error) {
                return { success: false, error: error.message };
            }
        },

        /**
         * Vider le cache local et re-télécharger depuis API
         * @returns {Promise<void>}
         */
        refreshAll: async function() {
            try {
                const [clients, properties] = await Promise.all([
                    API.Clients.getAll(),
                    API.Properties.getAll()
                ]);

                if (clients.success) {
                    localStorage.setItem('CLIENTS_DB', JSON.stringify(clients.data));
                }
                if (properties.success) {
                    localStorage.setItem('PROPERTIES_DB', JSON.stringify(properties.data));
                }

                console.log('[SyncAdapter] ✅ Cache local actualisé');
                return { success: true };
            } catch (error) {
                return { success: false, error: error.message };
            }
        }
    };

    console.log('✅ SyncAdapter initialisé');
})();
