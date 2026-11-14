import { useQuery } from '@tanstack/react-query';
import { API } from '../../api/services';

const unwrapData = (res) => res?.data ?? res;

export const useManagerActivityLogs = (filters = {}) => {
  return useQuery({
    queryKey: ['activity', 'manager-logs', filters],
    queryFn: async () => {
      const res = await API.Activity.getManagerLogs(filters);
      const payload = unwrapData(res);
      return {
        logs: Array.isArray(payload) ? payload : (payload?.data || []),
        pagination: payload?.pagination || res?.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 },
      };
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
};
