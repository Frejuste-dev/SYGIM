const AlertRepository = require('./alert.repository');
const Logger = require('../../utils/logger/Logger');

class AlertService {
  async getOverduePayments(filters, user) {
    const alerts = await AlertRepository.findOverduePayments(filters, user.role, user.id);

    const stats = {
      totalAlerts: alerts.length,
      bySeverity: {
        critique: alerts.filter(a => a.severity === 'critique').length,
        haute: alerts.filter(a => a.severity === 'haute').length,
        normale: alerts.filter(a => a.severity === 'normale').length,
        basse: alerts.filter(a => a.severity === 'basse').length
      },
      totalAmount: alerts.reduce((sum, a) => sum + (a.amount_owed || 0), 0),
      byStatus: {
        late: alerts.filter(a => a.status === 'late').length,
        pending: alerts.filter(a => a.status === 'pending').length,
        partial: alerts.filter(a => a.status === 'partial').length
      }
    };

    return { alerts, stats };
  }

  async getDashboard() {
    return await AlertRepository.findDashboardData();
  }

  async getSummary() {
    return await AlertRepository.findSummary();
  }

  async acknowledge(clientId, user) {
    const ClientService = require('../clients/client.service');
    await ClientService.checkOwnership(clientId, user);

    Logger.info(`Alert acknowledged for client ${clientId} by user ${user.id}`);
    return await AlertRepository.acknowledge(clientId, user.id);
  }
}

module.exports = new AlertService();
