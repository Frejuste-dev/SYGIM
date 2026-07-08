/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║        SYGIM — Services API                                       ║
 * ║     Endpoints métier organisés par domaine                        ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */

const API = {
    /**
     * ─────────────────────────────────────────────────────────
     * Authentification & Utilisateurs
     * ─────────────────────────────────────────────────────────
     */
    Auth: {
        login: (credentials) => 
            window.httpClient.post('/auth/login', credentials),
        
        logout: () => {
            localStorage.removeItem(CONFIG.STORAGE.JWT_TOKEN);
            localStorage.removeItem(CONFIG.STORAGE.CURRENT_USER);
            window.httpClient.setToken(null);
            return Promise.resolve();
        },

        register: (userData) => 
            window.httpClient.post('/auth/register', userData),

        refreshToken: () => 
            window.httpClient.post('/auth/refresh', {}),

        getCurrentUser: () => 
            window.httpClient.get('/auth/me'),

        updateProfile: (data) => 
            window.httpClient.put('/auth/profile', data),

        changePassword: (data) => 
            window.httpClient.post('/auth/change-password', data),

        requestPasswordReset: (email) => 
            window.httpClient.post('/auth/reset-password', { email }),

        resetPassword: (token, newPassword) => 
            window.httpClient.post('/auth/reset-password/confirm', { token, newPassword })
    },

    /**
     * ─────────────────────────────────────────────────────────
     * Utilisateurs
     * ─────────────────────────────────────────────────────────
     */
    Users: {
        getAll: (filters = {}) => 
            window.httpClient.get('/users', { params: filters }),
        
        getById: (userId) => 
            window.httpClient.get(`/users/${userId}`),
        
        create: (userData) => 
            window.httpClient.post('/users', userData),
        
        update: (userId, userData) => 
            window.httpClient.put(`/users/${userId}`, userData),
        
        delete: (userId) => 
            window.httpClient.delete(`/users/${userId}`),
        
        activate: (userId) => 
            window.httpClient.patch(`/users/${userId}/activate`, {}),
        
        deactivate: (userId) => 
            window.httpClient.patch(`/users/${userId}/deactivate`, {})
    },

    /**
     * ─────────────────────────────────────────────────────────
     * Clients
     * ─────────────────────────────────────────────────────────
     */
    Clients: {
        getAll: (filters = {}) => 
            window.httpClient.get('/clients', { params: filters }),
        
        getById: (clientId) => 
            window.httpClient.get(`/clients/${clientId}`),
        
        create: (clientData) => 
            window.httpClient.post('/clients', clientData),
        
        update: (clientId, clientData) => 
            window.httpClient.put(`/clients/${clientId}`, clientData),
        
        delete: (clientId) => 
            window.httpClient.delete(`/clients/${clientId}`),
        
        getTransactions: (clientId) => 
            window.httpClient.get(`/clients/${clientId}/transactions`),
        
        getProperties: (clientId) => 
            window.httpClient.get(`/clients/${clientId}/properties`)
    },

    /**
     * ─────────────────────────────────────────────────────────
     * Propriétés
     * ─────────────────────────────────────────────────────────
     */
    Properties: {
        getAll: (filters = {}) => 
            window.httpClient.get('/properties', { params: filters }),
        
        getById: (propertyId) => 
            window.httpClient.get(`/properties/${propertyId}`),
        
        create: (propertyData) => 
            window.httpClient.post('/properties', propertyData),
        
        update: (propertyId, propertyData) => 
            window.httpClient.put(`/properties/${propertyId}`, propertyData),
        
        delete: (propertyId) => 
            window.httpClient.delete(`/properties/${propertyId}`),
        
        getTransactions: (propertyId) => 
            window.httpClient.get(`/properties/${propertyId}/transactions`),
        
        getDocuments: (propertyId) => 
            window.httpClient.get(`/properties/${propertyId}/documents`),
        
        uploadDocument: (propertyId, formData) => 
            window.httpClient.post(`/properties/${propertyId}/documents`, formData, { 
                headers: { 'Content-Type': 'multipart/form-data' } 
            })
    },

    /**
     * ─────────────────────────────────────────────────────────
     * Propriétaires
     * ─────────────────────────────────────────────────────────
     */
    Owners: {
        getAll: (filters = {}) => 
            window.httpClient.get('/owners', { params: filters }),
        
        getById: (ownerId) => 
            window.httpClient.get(`/owners/${ownerId}`),
        
        create: (ownerData) => 
            window.httpClient.post('/owners', ownerData),
        
        update: (ownerId, ownerData) => 
            window.httpClient.put(`/owners/${ownerId}`, ownerData),
        
        delete: (ownerId) => 
            window.httpClient.delete(`/owners/${ownerId}`),
        
        getProperties: (ownerId) => 
            window.httpClient.get(`/owners/${ownerId}/properties`),
        
        getTransactions: (ownerId) => 
            window.httpClient.get(`/owners/${ownerId}/transactions`)
    },

    /**
     * ─────────────────────────────────────────────────────────
     * Transactions
     * ─────────────────────────────────────────────────────────
     */
    Transactions: {
        getAll: (filters = {}) => 
            window.httpClient.get('/transactions', { params: filters }),
        
        getById: (transactionId) => 
            window.httpClient.get(`/transactions/${transactionId}`),
        
        create: (transactionData) => 
            window.httpClient.post('/transactions', transactionData),
        
        update: (transactionId, transactionData) => 
            window.httpClient.put(`/transactions/${transactionId}`, transactionData),
        
        delete: (transactionId) => 
            window.httpClient.delete(`/transactions/${transactionId}`),
        
        getByClient: (clientId) => 
            window.httpClient.get(`/transactions/client/${clientId}`),
        
        getByProperty: (propertyId) => 
            window.httpClient.get(`/transactions/property/${propertyId}`),
        
        getByOwner: (ownerId) => 
            window.httpClient.get(`/transactions/owner/${ownerId}`),
        
        export: (filters = {}) => 
            window.httpClient.get('/transactions/export/csv', { params: filters })
    },

    /**
     * ─────────────────────────────────────────────────────────
     * Collecteurs / Récolteurs
     * ─────────────────────────────────────────────────────────
     */
    Collectors: {
        getAll: (filters = {}) => 
            window.httpClient.get('/collectors', { params: filters }),
        
        getById: (collectorId) => 
            window.httpClient.get(`/collectors/${collectorId}`),
        
        create: (collectorData) => 
            window.httpClient.post('/collectors', collectorData),
        
        update: (collectorId, collectorData) => 
            window.httpClient.put(`/collectors/${collectorId}`, collectorData),
        
        delete: (collectorId) => 
            window.httpClient.delete(`/collectors/${collectorId}`),
        
        getStats: () => 
            window.httpClient.get('/collectors/stats'),
        
        assignProperties: (collectorId, propertyIds) => 
            window.httpClient.post(`/collectors/${collectorId}/assign-properties`, { propertyIds })
    },

    /**
     * ─────────────────────────────────────────────────────────
     * Alertes & Notifications
     * ─────────────────────────────────────────────────────────
     */
    Alerts: {
        getOverduePayments: (filters = {}) => 
            window.httpClient.get('/alerts/overdue-payments', { params: filters }),
        
        getDashboard: () => 
            window.httpClient.get('/alerts/dashboard'),
        
        getSummary: () => 
            window.httpClient.get('/alerts/summary'),
        
        acknowledge: (clientId) => 
            window.httpClient.put(`/alerts/${clientId}/acknowledge`, {})
    },

    /**
     * ─────────────────────────────────────────────────────────
     * Rapports & Analytics
     * ─────────────────────────────────────────────────────────
     */
    Reports: {
        getDashboard: () => 
            window.httpClient.get('/reports/dashboard'),
        
        getRevenue: (dateRange) => 
            window.httpClient.get('/reports/revenue', { params: dateRange }),
        
        getPropertyStats: () => 
            window.httpClient.get('/reports/properties/stats'),
        
        getClientStats: () => 
            window.httpClient.get('/reports/clients/stats'),
        
        generatePdf: (reportType, filters = {}) => 
            window.httpClient.get(`/reports/export/pdf/${reportType}`, { params: filters }),

        getMonthly: (filters = {}) =>
            window.httpClient.get('/reports/monthly', { params: { ...filters, format: 'json' } }),

        getOverdue: (filters = {}) =>
            window.httpClient.get('/reports/overdue', { params: { ...filters, format: 'json' } }),

        getOwner: (filters = {}) =>
            window.httpClient.get('/reports/owner', { params: { ...filters, format: 'json' } }),

        getAgent: (filters = {}) =>
            window.httpClient.get('/reports/agent', { params: { ...filters, format: 'json' } })
    }
};

// Exporter pour usage global
if (typeof window !== 'undefined') {
    window.API = API;
}
