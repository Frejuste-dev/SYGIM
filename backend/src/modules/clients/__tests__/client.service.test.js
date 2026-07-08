const ClientService = require('../../../services/ClientService');
const ClientRepository = require('../../../repositories/ClientRepository');

// Mock the repository
jest.mock('../../../repositories/ClientRepository');

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

    expect(ClientRepository.findAllWithCollector).toHaveBeenCalledWith(mockFilters, mockUser.role, mockUser.id);
    expect(result).toEqual(mockData);
  });
});
