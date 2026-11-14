import { useQuery } from '@tanstack/react-query';
import { API } from '../../api/services';

const unwrapData = (res) => res?.data ?? res;

const normalizeList = (res) => {
  const data = unwrapData(res);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.rows)) return data.rows;
  return [];
};

export const useReportDashboard = (dateParams = {}) => {
  return useQuery({
    queryKey: ['reports', 'dashboard', dateParams],
    queryFn: () => API.Reports.getDashboard(dateParams).then(unwrapData),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
};

export const useReportPrefinancing = (dateParams = {}) => {
  return useQuery({
    queryKey: ['reports', 'prefinancing', dateParams],
    queryFn: () => API.Reports.getPrefinancing(dateParams).then(res => {
      const data = unwrapData(res);
      return data || { summary: {}, prefinancings: [], eligibleCases: [] };
    }),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
};

export const useReportCollectors = (dateParams = {}) => {
  return useQuery({
    queryKey: ['reports', 'collectors', dateParams],
    queryFn: () => API.Reports.getAgent(dateParams).then(normalizeList),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
};

export const useReportProperties = (filters = {}) => {
  return useQuery({
    queryKey: ['reports', 'properties', filters],
    queryFn: () => API.Reports.getPropertyStats(filters).then(normalizeList),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
};

export const useReportOverdue = (filters = {}) => {
  return useQuery({
    queryKey: ['reports', 'overdue', filters],
    queryFn: () => API.Reports.getOverdue(filters).then(normalizeList),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
};

export const useReportOwnerStatements = (params = {}, options = {}) => {
  return useQuery({
    queryKey: ['reports', 'owner-statements', params],
    queryFn: () => API.Reports.getOwnerStatements(params).then(res => {
      const data = unwrapData(res);
      return data || { totals: {}, statements: [] };
    }),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
    enabled: options.enabled !== undefined ? options.enabled : true,
  });
};
