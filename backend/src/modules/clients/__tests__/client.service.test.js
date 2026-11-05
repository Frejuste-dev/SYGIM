const ClientService = require('../client.service');
const ClientRepository = require('../client.repository');

// Mock the repository
jest.mock('../client.repository');

describe('ClientService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getClients should call repository.findAllWithCollector', async () => {
    const mockUser = { role: 'admin', id: 1 };
    const mockFilters = { status: 'active' };
    const mockData = [{ id: 1, last_name: 'Doe' }];

    ClientRepository.findAllWithCollector.mockResolvedValue(mockData);

    const result = await ClientService.getClients(mockFilters, mockUser);

    expect(ClientRepository.findAllWithCollector).toHaveBeenCalledWith({ status: 'active', page: 1, limit: 20 }, mockUser.role, mockUser.id);
    expect(result.data).toEqual(mockData);
  });
});
