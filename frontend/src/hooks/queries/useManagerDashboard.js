import { useQuery } from '@tanstack/react-query';
import { API } from '../../api/services';

const unwrapData = (res) => res?.data ?? res;

export const useManagerDashboard = (params = {}) => {
  return useQuery({
    queryKey: ['reports', 'manager-dashboard', params],
    queryFn: () => API.Reports.getManagerDashboard(params).then(unwrapData),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
};
