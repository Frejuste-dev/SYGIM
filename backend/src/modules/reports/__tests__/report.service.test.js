/**
 * Module   : Reports - Tests
 * Auteur   : SYGIM Team
 * Date     : 2026-06-16
 */

const reportService = require('../report.service');
const reportRepository = require('../report.repository');
const cacheService = require('../../../infrastructure/cache/cache.service');

jest.mock('../report.repository');
jest.mock('../../../infrastructure/cache/cache.service');

describe('ReportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getDashboardReport should return from cache', async () => {
    cacheService.get.mockResolvedValue({ total: 100 });
    const result = await reportService.getDashboardReport({});
    expect(result.total).toBe(100);
    expect(reportRepository.getTransactionSummary).not.toHaveBeenCalled();
  });
});
