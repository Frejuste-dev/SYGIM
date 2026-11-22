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

export const useReportDashboard = (dateParams = {}, options = {}) => {
  return useQuery({
    queryKey: ['reports', 'dashboard', dateParams],
    queryFn: () => API.Reports.getDashboard(dateParams).then(unwrapData),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
    enabled: options.enabled !== undefined ? options.enabled : true,
  });
};

export const useReportPrefinancing = (dateParams = {}, options = {}) => {
  return useQuery({
    queryKey: ['reports', 'prefinancing', dateParams],
    queryFn: () => API.Reports.getPrefinancing(dateParams).then(res => {
      const data = unwrapData(res);
      return data || { summary: {}, prefinancings: [], eligibleCases: [] };
    }),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
    enabled: options.enabled !== undefined ? options.enabled : true,
  });
};

export const useReportCollectors = (dateParams = {}, options = {}) => {
  return useQuery({
    queryKey: ['reports', 'collectors', dateParams],
    queryFn: () => API.Reports.getAgent(dateParams).then(normalizeList),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
    enabled: options.enabled !== undefined ? options.enabled : true,
  });
};

export const useReportProperties = (filters = {}, options = {}) => {
  return useQuery({
    queryKey: ['reports', 'properties', filters],
    queryFn: () => API.Reports.getPropertyStats(filters).then(normalizeList),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
    enabled: options.enabled !== undefined ? options.enabled : true,
  });
};

export const useReportOverdue = (filters = {}, options = {}) => {
  return useQuery({
    queryKey: ['reports', 'overdue', filters],
    queryFn: () => API.Reports.getOverdue(filters).then(normalizeList),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
    enabled: options.enabled !== undefined ? options.enabled : true,
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

export const usePerformanceDashboard = (params = {}) => {
  return useQuery({
    queryKey: ['reports', 'performance-dashboard', params],
    queryFn: () => API.Reports.getPerformanceDashboard(params).then(unwrapData),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
};

export const useOwnerSituation = (ownerId, params = {}, options = {}) => {
  return useQuery({
    queryKey: ['reports', 'owner-situation', ownerId, params],
    queryFn: () => API.Reports.getOwnerSituation(ownerId, params).then(unwrapData),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
    enabled: Boolean(ownerId) && (options.enabled !== undefined ? options.enabled : true),
  });
};

export const useAgedReceivables = (params = {}, options = {}) => {
  return useQuery({
    queryKey: ['reports', 'aged-receivables', params],
    queryFn: () => API.Reports.getAgedReceivables(params).then(unwrapData),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
    enabled: options.enabled !== undefined ? options.enabled : true,
  });
};

export const useDepositsReport = (params = {}, options = {}) => {
  return useQuery({
    queryKey: ['reports', 'deposits', params],
    queryFn: () => API.Reports.getDepositsReport(params).then(unwrapData),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
    enabled: options.enabled !== undefined ? options.enabled : true,
  });
};

export const useOwnerLedger = (ownerId, params = {}, options = {}) => {
  return useQuery({
    queryKey: ['reports', 'owner-ledger', ownerId, params],
    queryFn: () => API.Reports.getOwnerLedger(ownerId, params).then(unwrapData),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
    enabled: Boolean(ownerId) && (options.enabled !== undefined ? options.enabled : true),
  });
};

export const useTaxDeclaration = (ownerId, params = {}, options = {}) => {
  return useQuery({
    queryKey: ['reports', 'tax-declaration', ownerId, params],
    queryFn: () => API.Reports.getTaxDeclaration(ownerId, params).then(unwrapData),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
    enabled: Boolean(ownerId) && (options.enabled !== undefined ? options.enabled : true),
  });
};

export const useMandateBfr = (options = {}) => {
  return useQuery({
    queryKey: ['reports', 'mandate-bfr'],
    queryFn: () => API.Reports.getMandateBfr().then(unwrapData),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
    enabled: options.enabled !== undefined ? options.enabled : true,
  });
};

export const useVacancyLoss = (params = {}, options = {}) => {
  return useQuery({
    queryKey: ['reports', 'vacancy-loss', params],
    queryFn: () => API.Reports.getVacancyLoss(params).then(unwrapData),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
    enabled: options.enabled !== undefined ? options.enabled : true,
  });
};
