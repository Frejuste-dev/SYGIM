/**
 * Module   : Collectors - Tests
 * Auteur   : SYGIM Team
 * Date     : 2026-06-16
 */

const collectorService = require('../collector.service');
const collectorRepository = require('../collector.repository');

jest.mock('../collector.repository');

describe('CollectorService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getAllCollectors should return paginated list', async () => {
    collectorRepository.findAll.mockResolvedValue([{ id: 1 }]);
    collectorRepository.count.mockResolvedValue(1);

    const result = await collectorService.getAllCollectors({}, 1, 10);
    expect(result.data).toHaveLength(1);
    expect(result.pagination.total).toBe(1);
  });
});
