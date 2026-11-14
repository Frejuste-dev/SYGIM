import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API } from '../../api/services';

const unwrapData = (res) => res?.data ?? res;

export const usePropertyAssignments = (filters = {}) => {
  return useQuery({
    queryKey: ['properties', 'assignments', filters],
    queryFn: async () => {
      const res = await API.Properties.getAssignments(filters);
      const data = unwrapData(res);
      return {
        assignments: Array.isArray(data) ? data : (data?.data || []),
        pagination: res?.pagination || { page: 1, limit: 50, total: 0, totalPages: 1 },
      };
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
};

export const usePropertyAssignmentHistory = (filters = {}) => {
  return useQuery({
    queryKey: ['properties', 'assignments', 'history', filters],
    queryFn: () => API.Properties.getAssignmentHistory(filters).then(unwrapData),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
};

export const useAssignOwner = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ propertyId, ownerId, notes }) =>
      API.Properties.assignOwner(propertyId, { owner_id: ownerId, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['reports', 'manager-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['activity'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};

export const useReassignOwner = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ propertyId, newOwnerId, notes }) =>
      API.Properties.reassignOwner(propertyId, { new_owner_id: newOwnerId, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['reports', 'manager-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['activity'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};
