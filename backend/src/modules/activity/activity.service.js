const activityRepository = require('./activity.repository');

class ActivityService {
  async getManagerLogs(filters = {}) {
    const page = Math.max(1, parseInt(filters.page || 1, 10));
    const limit = Math.max(1, Math.min(100, parseInt(filters.limit || 20, 10)));

    const [logs, total] = await Promise.all([
      activityRepository.findManagerLogs(filters),
      activityRepository.countManagerLogs(filters),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }
}

module.exports = new ActivityService();
