import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API } from '../../api/services';

const unwrapData = (res) => res?.data ?? res;

export const useNotifications = (filters = {}, options = {}) => {
  return useQuery({
    queryKey: ['notifications', filters],
    queryFn: async () => {
      try {
        const res = await API.Notifications.getAll(filters);
        const data = unwrapData(res);
        const unreadCount = res?.meta?.unreadCount ?? res?.pagination?.unreadCount ?? (Array.isArray(data) ? data.filter(n => !n.is_read).length : 0);
        return {
          notifications: Array.isArray(data) ? data : (data?.notifications || []),
          unreadCount,
        };
      } catch (err) {
        if (err?.status === 401 || err?.response?.status === 401) {
          return { notifications: [], unreadCount: 0 };
        }
        throw err;
      }
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: (failureCount, error) => {
      if (error?.status === 401 || error?.response?.status === 401) return false;
      return failureCount < 2;
    },
    ...options,
  });
};

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => API.Notifications.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};

export const useMarkAllNotificationsRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => API.Notifications.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};

export const useOverdueAlerts = (filters = {}, options = {}) => {
  return useQuery({
    queryKey: ['alerts', 'overdue-payments', filters],
    queryFn: async () => {
      try {
        const res = await API.Alerts.getOverduePayments(filters);
        const alerts = res?.data || [];
        const stats = res?.stats || {
          totalAlerts: alerts.length,
          totalAmount: alerts.reduce((sum, a) => sum + (Number(a.amount_owed) || 0), 0),
          bySeverity: {
            critique: alerts.filter(a => a.severity === 'critique').length,
            haute: alerts.filter(a => a.severity === 'haute').length,
            normale: alerts.filter(a => a.severity === 'normale').length,
            basse: alerts.filter(a => a.severity === 'basse').length,
          }
        };
        return { alerts, stats, count: alerts.length };
      } catch (err) {
        if (err?.status === 401 || err?.response?.status === 401) {
          return { alerts: [], stats: {}, count: 0 };
        }
        throw err;
      }
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    ...options,
  });
};

export const useAcknowledgeAlert = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (clientId) => API.Alerts.acknowledge(clientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts', 'overdue-payments'] });
    },
  });
};
