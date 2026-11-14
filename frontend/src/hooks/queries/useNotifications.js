import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API } from '../../api/services';

const unwrapData = (res) => res?.data ?? res;

export const useNotifications = (filters = {}) => {
  return useQuery({
    queryKey: ['notifications', filters],
    queryFn: async () => {
      const res = await API.Notifications.getAll(filters);
      const data = unwrapData(res);
      const unreadCount = res?.pagination?.unreadCount ?? (Array.isArray(data) ? data.filter(n => !n.is_read).length : 0);
      return {
        notifications: Array.isArray(data) ? data : (data?.notifications || []),
        unreadCount,
      };
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
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
