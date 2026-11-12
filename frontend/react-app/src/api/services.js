/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║        SYGIM — Services API (React ES Module)                      ║
 * ║     Endpoints métier organisés par domaine                        ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */

import { httpClient } from './client.js';
import { CONFIG } from './config.js';

export const API = {
    /**
     * Authentification & Profil
     */
    Auth: {
        login: (credentials) => 
            httpClient.post('/auth/login', credentials),
        
        logout: () => {
            return httpClient.post('/auth/logout')
                .then(() => {
                    if (typeof window !== 'undefined') {
                        localStorage.removeItem(CONFIG.STORAGE.CURRENT_USER);
                    }
                    return { success: true };
                })
                .catch((error) => {
                    console.error("Erreur lors de l'appel logout API:", error);
                    if (typeof window !== 'undefined') {
                        localStorage.removeItem(CONFIG.STORAGE.CURRENT_USER);
                    }
                    return { success: true };
                });
        },

        register: (userData) => 
            httpClient.post('/auth/register', userData),

        refreshToken: () => 
            httpClient.post('/auth/refresh'),

        getCurrentUser: () => 
            httpClient.get('/auth/me'),

        updateProfile: (data) => 
            httpClient.put('/auth/profile', data),

        changePassword: (data) => 
            httpClient.post('/auth/change-password', data),

        requestPasswordReset: (email) => 
            httpClient.post('/auth/reset-password', { email }),

        resetPassword: (token, newPassword) => 
            httpClient.post('/auth/reset-password/confirm', { token, newPassword })
    },

    /**
     * Utilisateurs
     */
    Users: {
        getAll: (filters = {}) => 
            httpClient.get('/users', { params: filters }),
        
        getById: (userId) => 
            httpClient.get(`/users/${userId}`),
        
        create: (userData) => 
            httpClient.post('/users', userData),
        
        update: (userId, userData) => 
            httpClient.put(`/users/${userId}`, userData),
        
        delete: (userId) => 
            httpClient.delete(`/users/${userId}`),
        
        activate: (userId) => 
            httpClient.patch(`/users/${userId}/activate`, {}),
        
        deactivate: (userId) => 
            httpClient.patch(`/users/${userId}/deactivate`, {})
    },

    /**
     * Clients & Locataires
     */
    Clients: {
        getAll: (filters = {}) => 
            httpClient.get('/clients', { params: filters }),
        
        getStats: (filters = {}) =>
            httpClient.get('/clients/stats', { params: filters }),
        
        getById: (clientId) => 
            httpClient.get(`/clients/${clientId}`),
        
        create: (clientData) => 
            httpClient.post('/clients', clientData),
        
        update: (clientId, clientData) => 
            httpClient.put(`/clients/${clientId}`, clientData),
        
        delete: (clientId) => 
            httpClient.delete(`/clients/${clientId}`),
        
        getTransactions: (clientId) => 
            httpClient.get(`/clients/${clientId}/transactions`),
        
        getProperties: (clientId) => 
            httpClient.get(`/clients/${clientId}/properties`),

        depart: (clientId, data) =>
            httpClient.post(`/clients/${clientId}/depart`, data),

        replace: (clientId, data) =>
            httpClient.post(`/clients/${clientId}/replace`, data)
    },

    /**
     * Propriétés & Biens
     */
    Properties: {
        getAll: (filters = {}) => 
            httpClient.get('/properties', { params: filters }),
        
        getStats: (filters = {}) =>
            httpClient.get('/properties/stats', { params: filters }),
        
        getById: (propertyId) => 
            httpClient.get(`/properties/${propertyId}`),
        
        create: (propertyData) => 
            httpClient.post('/properties', propertyData),
        
        update: (propertyId, propertyData) => 
            httpClient.put(`/properties/${propertyId}`, propertyData),
        
        delete: (propertyId) => 
            httpClient.delete(`/properties/${propertyId}`),
        
        getTransactions: (propertyId) => 
            httpClient.get(`/properties/${propertyId}/transactions`),
        
        getDocuments: (propertyId) => 
            httpClient.get(`/properties/${propertyId}/documents`),
        
        uploadDocument: (propertyId, file) => {
            const formData = new FormData();
            formData.append('document', file);
            return httpClient.post(`/properties/${propertyId}/documents`, formData, {
                headers: {}
            });
        },

        assignTenant: (propertyId, data) =>
            httpClient.post(`/properties/${propertyId}/assign`, data)
    },

    /**
     * Propriétaires
     */
    Owners: {
        getAll: (filters = {}) => 
            httpClient.get('/owners', { params: filters }),
        
        getStats: (filters = {}) =>
            httpClient.get('/owners/stats', { params: filters }),
        
        getById: (ownerId) => 
            httpClient.get(`/owners/${ownerId}`),
        
        create: (ownerData) => 
            httpClient.post('/owners', ownerData),
        
        update: (ownerId, ownerData) => 
            httpClient.put(`/owners/${ownerId}`, ownerData),
        
        delete: (ownerId) => 
            httpClient.delete(`/owners/${ownerId}`),
        
        getProperties: (ownerId) => 
            httpClient.get(`/owners/${ownerId}/properties`),
        
        getTransactions: (ownerId) => 
            httpClient.get(`/owners/${ownerId}/transactions`)
    },

    /**
     * Transactions
     */
    Transactions: {
        getAll: (filters = {}) => 
            httpClient.get('/transactions', { params: filters }),
        
        getStats: (filters = {}) =>
            httpClient.get('/transactions/stats', { params: filters }),
        
        getById: (transactionId) => 
            httpClient.get(`/transactions/${transactionId}`),
        
        create: (transactionData) => 
            httpClient.post('/transactions', transactionData),
        
        update: (transactionId, transactionData) => 
            httpClient.put(`/transactions/${transactionId}`, transactionData),
        
        delete: (transactionId) => 
            httpClient.delete(`/transactions/${transactionId}`),
        
        getByClient: (clientId) => 
            httpClient.get(`/transactions/client/${clientId}`),
        
        getByProperty: (propertyId) => 
            httpClient.get(`/transactions/property/${propertyId}`),
        
        getByOwner: (ownerId) => 
            httpClient.get(`/transactions/owner/${ownerId}`),
        
        export: (filters = {}) => 
            httpClient.get('/transactions/export/csv', { params: filters }),

        validate: (transactionId, data = {}) =>
            httpClient.post(`/transactions/${transactionId}/validate`, data),

        reject: (transactionId, data = {}) =>
            httpClient.post(`/transactions/${transactionId}/reject`, data)
    },

    /**
     * Collecteurs / Récolteurs
     */
    Collectors: {
        getAll: (filters = {}) => 
            httpClient.get('/collectors', { params: filters }),
        
        getById: (collectorId) => 
            httpClient.get(`/collectors/${collectorId}`),
        
        create: (collectorData) => 
            httpClient.post('/collectors', collectorData),
        
        update: (collectorId, collectorData) => 
            httpClient.put(`/collectors/${collectorId}`, collectorData),
        
        delete: (collectorId) => 
            httpClient.delete(`/collectors/${collectorId}`),
        
        getStats: () => 
            httpClient.get('/collectors/stats'),
        
        assignProperties: (collectorId, propertyIds) => 
            httpClient.post(`/collectors/${collectorId}/assign-properties`, { propertyIds })
    },

    /**
     * Alertes & Notifications
     */
    Alerts: {
        getOverduePayments: (filters = {}) => 
            httpClient.get('/alerts/overdue-payments', { params: filters }),
        
        getDashboard: () => 
            httpClient.get('/alerts/dashboard'),
        
        getSummary: () => 
            httpClient.get('/alerts/summary'),
        
        acknowledge: (clientId) => 
            httpClient.put(`/alerts/${clientId}/acknowledge`, {})
    },

    /**
     * Rapports & Analytics
     */
    Reports: {
        getDashboard: (filters = {}) => 
            httpClient.get('/reports/dashboard', { params: filters }),

        getKpis: () =>
            httpClient.get('/reports/kpis'),
        
        getRevenue: (dateRange) => 
            httpClient.get('/reports/revenue', { params: dateRange }),
        
        getPropertyStats: (filters = {}) => 
            httpClient.get('/reports/properties', { params: filters }),
        
        getClientStats: () => 
            httpClient.get('/reports/clients/stats'),

        getPrefinancing: (filters = {}) =>
            httpClient.get('/reports/prefinancing', { params: filters }),
        
        generatePdf: (reportType, filters = {}) => 
            httpClient.get(`/reports/export/pdf/${reportType}`, { params: filters }),

        getMonthly: (filters = {}) =>
            httpClient.get('/reports/monthly', { params: { ...filters, format: 'json' } }),

        getOverdue: (filters = {}) =>
            httpClient.get('/alerts/overdue-payments', { params: { ...filters, format: 'json' } }),

        getOwner: (filters = {}) =>
            httpClient.get('/reports/owner', { params: { ...filters, format: 'json' } }),

        getOwnerStatements: (filters = {}) =>
            httpClient.get('/reports/owner-statements', { params: filters }),

        exportOwnerStatementsExcel: (filters = {}) =>
            httpClient.get('/reports/owner-statements/export/excel', { params: filters, responseType: 'blob' }),

        downloadOwnerStatementPdf: (ownerId, filters = {}) =>
            httpClient.get(`/reports/owner-statements/${ownerId}/pdf`, { params: filters, responseType: 'blob' }),

        getAgent: (filters = {}) =>
            httpClient.get('/reports/collectors', { params: { ...filters } })
    },

    /**
     * Moteur Financier (Grand Livre, Reversements Propriétaires, Préfinancements, FIFO & Extournes)
     */
    Financial: {
        registerPayment: (paymentData) =>
            httpClient.post('/financial/payments', paymentData),

        reversePayment: (paymentId, data) =>
            httpClient.post(`/financial/payments/${paymentId}/reverse`, data),

        generateMonthlyInvoice: (invoiceData) =>
            httpClient.post('/financial/invoices/generate-monthly', invoiceData),

        generateSettlement: (settlementData) =>
            httpClient.post('/financial/settlements/generate', settlementData),

        getTenantStatement: (clientId) =>
            httpClient.get(`/financial/tenants/${clientId}/statement`),

        getSettlements: (filters = {}) =>
            httpClient.get('/financial/settlements', { params: filters }),

        recordOwnerPayment: (paymentData) =>
            httpClient.post('/financial/settlements', paymentData),

        paySettlement: (settlementId, data) =>
            httpClient.put(`/financial/settlements/${settlementId}/pay`, data),

        getOwnersSummary: () =>
            httpClient.get('/financial/owners-summary'),

        getGeneralLedger: (filters = {}) =>
            httpClient.get('/financial/ledger', { params: filters })
    },

    /**
     * Réparations & Déductions Travaux
     */
    Repairs: {
        getAll: (filters = {}) =>
            httpClient.get('/repairs', { params: filters }),
        create: (data) =>
            httpClient.post('/repairs', data),
        settle: (id, data = {}) =>
            httpClient.post(`/repairs/${id}/settle`, data)
    }
};
