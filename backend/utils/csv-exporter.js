/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║           SYGIM — Utilitaire d'Export CSV                       ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

class CSVExporter {
    /**
     * Convertir un tableau d'objets en CSV
     */
    static toCSV(data, columns = null) {
        if (!Array.isArray(data) || data.length === 0) {
            return '';
        }

        // Déterminer les colonnes
        const cols = columns || Object.keys(data[0]);

        // Header
        const header = cols.map(col => this._escapeCSV(col)).join(';');

        // Rows
        const rows = data.map(row => {
            return cols.map(col => {
                const value = row[col];
                return this._escapeCSV(value);
            }).join(';');
        });

        return [header, ...rows].join('\n');
    }

    /**
     * Exporter un rapport mensuel en CSV
     */
    static exportMonthlyReport(reportData) {
        const lines = [];

        // En-tête
        lines.push(`RAPPORT MENSUEL - ${reportData.period}`);
        lines.push(`Période: ${reportData.startDate} au ${reportData.endDate}`);
        lines.push('');

        // Section REVENUS
        lines.push('REVENUS PAR MÉTHODE');
        lines.push('Méthode;Montant Collecté;Nombre Transactions;Status');
        if (reportData.revenues && reportData.revenues.byMethod) {
            reportData.revenues.byMethod.forEach(r => {
                lines.push(`${r.method};${r.total_collected || 0};${r.transaction_count || 0};${r.status}`);
            });
        }
        lines.push(`TOTAL REVENUS;${reportData.revenues.totalRevenue};${reportData.revenues.transactionCount};`);
        lines.push('');

        // Section COMMISSIONS
        lines.push('COMMISSIONS COLLECTEURS');
        lines.push('Collecteur;Nombre Transactions;Montant Collecté;Commission (%)');
        if (reportData.commissions && reportData.commissions.data) {
            reportData.commissions.data.forEach(c => {
                lines.push(`${c.collector_name};${c.transaction_count || 0};${c.total_collected || 0};${c.commission_amount || 0}`);
            });
        }
        lines.push(`TOTAL COMMISSIONS;;;${reportData.commissions.totalCommissions}`);
        lines.push('');

        // Section CLIENTS
        lines.push('CLIENTS');
        lines.push('Métrique;Valeur');
        if (reportData.clients) {
            const c = reportData.clients;
            lines.push(`Total Clients;${c.total_clients}`);
            lines.push(`Clients Payés;${c.paid_clients}`);
            lines.push(`Clients Non Payés;${c.unpaid_clients}`);
            lines.push(`Montant Total Dû;${c.total_due}`);
            lines.push(`Montant Total Payé;${c.total_paid}`);
        }
        lines.push('');

        // Section PROPRIÉTÉS
        lines.push('PROPRIÉTÉS');
        lines.push('Métrique;Valeur');
        if (reportData.properties) {
            const p = reportData.properties;
            lines.push(`Propriétés Totales;${p.total_properties}`);
            lines.push(`Propriétés Louées;${p.rented_properties}`);
            lines.push(`Propriétés Vacantes;${p.vacant_properties}`);
            lines.push(`Loyers Attendus;${p.total_rent_expected}`);
        }

        return lines.join('\n');
    }

    /**
     * Exporter un rapport de retard en CSV
     */
    static exportOverdueReport(reportData) {
        const lines = [];

        // En-tête
        lines.push(`RAPPORT RETARDS - ${new Date().toLocaleDateString('fr-FR')}`);
        lines.push(`Seuil d'alerte: ${reportData.daysThreshold} jours`);
        lines.push('');

        // Résumé
        lines.push('RÉSUMÉ');
        lines.push('Métrique;Valeur');
        if (reportData.summary) {
            lines.push(`Total Clients en Retard;${reportData.summary.totalOverdueClients}`);
            lines.push(`Montant Total Dû;${reportData.summary.totalAmountOwed}`);
            lines.push(`Jours Moyens en Retard;${reportData.summary.averageDaysOverdue.toFixed(2)}`);
        }
        lines.push('');

        // Détails clients
        lines.push('CLIENTS EN RETARD');
        lines.push('Nom;Téléphone;Propriété;Adresse;Collecteur;Loyer Dû;Loyer Payé;Montant Dû;Status;Jours Retard');

        if (reportData.clients) {
            reportData.clients.forEach(client => {
                const name = `${client.last_name} ${client.first_name}`;
                lines.push([
                    this._escapeCSV(name),
                    client.phone || '',
                    this._escapeCSV(client.property_name || ''),
                    this._escapeCSV(client.property_address || ''),
                    client.collector_name || '',
                    client.rent_due || 0,
                    client.amount_paid || 0,
                    client.amount_owed || 0,
                    client.status,
                    client.days_overdue || 0
                ].join(';'));
            });
        }

        return lines.join('\n');
    }

    /**
     * Exporter un rapport trimestriel en CSV
     */
    static exportQuarterlyReport(reportData) {
        const lines = [];

        // En-tête
        lines.publish(`RAPPORT TRIMESTRIEL - ${reportData.period}`);
        lines.push(`Période: ${reportData.startDate} au ${reportData.endDate}`);
        lines.push('');

        // Résumé
        lines.push('RÉSUMÉ');
        lines.push('Métrique;Valeur');
        lines.push(`Total Revenus;${reportData.summary.totalRevenue}`);
        lines.push(`Total Transactions;${reportData.summary.totalTransactions}`);
        lines.push('');

        // Ventilation mensuelle
        lines.push('VENTILATION MENSUELLE');
        lines.push('Mois;Montant;Nombre Transactions');
        if (reportData.monthlyBreakdown) {
            reportData.monthlyBreakdown.forEach(m => {
                lines.push(`${m.month || 'N/A'};${m.total || 0};${m.count || 0}`);
            });
        }
        lines.push('');

        // Top propriétaires
        lines.push('TOP PROPRIÉTAIRES');
        lines.push('Propriétaire;Montant Dû;Montant Payé;Nombre Locataires');
        if (reportData.topOwners) {
            reportData.topOwners.forEach(owner => {
                lines.push(`${owner.owner_name};${owner.total_due || 0};${owner.total_paid || 0};${owner.tenant_count || 0}`);
            });
        }

        return lines.join('\n');
    }

    /**
     * Exporter un liste de clients en CSV
     */
    static exportClientsList(clients, columns = null) {
        const defaultColumns = ['id', 'first_name', 'last_name', 'phone', 'email', 'property_name', 'amount_due', 'amount_paid', 'status'];
        const cols = columns || defaultColumns;
        return this.toCSV(clients, cols);
    }

    /**
     * Exporter une liste de transactions en CSV
     */
    static exportTransactionsList(transactions, columns = null) {
        const defaultColumns = ['reference', 'date', 'client_name', 'amount', 'method', 'status'];
        const cols = columns || defaultColumns;
        return this.toCSV(transactions, cols);
    }

    /**
     * Exporter une liste de propriétés en CSV
     */
    static exportPropertiesList(properties, columns = null) {
        const defaultColumns = ['id', 'name', 'address', 'type', 'status', 'rent', 'owner_first_name', 'owner_last_name'];
        const cols = columns || defaultColumns;
        return this.toCSV(properties, cols);
    }

    /**
     * Exporter les alertes en CSV
     */
    static exportAlerts(alerts) {
        const lines = [];

        lines.push('ALERTES RETARDS DE PAIEMENT');
        lines.push(`Généré: ${new Date().toLocaleString('fr-FR')}`);
        lines.push('');

        lines.push('Client;Téléphone;Property;Collecteur;Montant Dû;Status;Sévérité');
        alerts.forEach(alert => {
            const name = `${alert.last_name} ${alert.first_name}`;
            lines.push([
                this._escapeCSV(name),
                alert.phone || '',
                this._escapeCSV(alert.property_name || ''),
                alert.collector_name || '',
                alert.amount_owed || 0,
                alert.status,
                alert.severity
            ].join(';'));
        });

        return lines.join('\n');
    }

    /**
     * Helper: Échapper les caractères spéciaux CSV
     */
    static _escapeCSV(value) {
        if (value === null || value === undefined) return '';
        const str = String(value);
        if (str.includes(';') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    }
}

module.exports = CSVExporter;
