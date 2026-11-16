import { useQuery } from '@tanstack/react-query';
import { API } from '../../api/services';

/**
 * Hook : KPIs scalaires du Dashboard
 * Appelle GET /api/reports/kpis — calcul SQL côté serveur.
 *
 * Payload attendu :
 * {
 *   totalRevenue:         number,
 *   totalDue:             number,
 *   totalClients:         number,
 *   pendingPaymentsCount: number,
 *   collectionRate:       number,   // %
 *   totalProperties:      number,
 *   occupiedCount:        number,
 *   occupancyRate:        number,   // %
 * }
 */
export const useDashboardKpis = (params = {}) => {
  return useQuery({
    queryKey: ['dashboard', 'kpis', params],
    queryFn: () => API.Reports.getKpis(params).then(res => res.data?.data ?? res.data ?? {}),
    staleTime: 30_000,
  });
};
