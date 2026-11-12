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
export const useDashboardKpis = () => {
  return useQuery({
    queryKey: ['dashboard', 'kpis'],
    queryFn: () => API.Reports.getKpis().then(res => res.data?.data ?? res.data ?? {}),
    staleTime: 60_000, // 60s — les KPIs n'ont pas besoin d'être frais à la milliseconde
  });
};
