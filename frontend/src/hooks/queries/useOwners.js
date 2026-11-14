import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API } from '../../api/services';

const extractData = (res) => {
  let data = [];
  if (res?.data) {
    data = Array.isArray(res.data) ? res.data : (res.data.data || res.data.rows || res.data || []);
  }
  return { data, pagination: res?.pagination || null };
};

export const useOwners = (filters = {}) => {
  return useQuery({
    queryKey: ['owners', filters],
    queryFn: () => API.Owners.getAll(filters).then(extractData),
    placeholderData: (prev) => prev,
  });
};

export const useOwnerStats = (filters = {}) => {
  return useQuery({
    queryKey: ['owners', 'stats', filters],
    queryFn: () => API.Owners.getStats(filters).then(res => res.data?.data || res.data),
    placeholderData: (prev) => prev,
  });
};

export const useOwner = (id) => {
  return useQuery({
    queryKey: ['owners', id],
    queryFn: () => API.Owners.getById(id).then(res => res.data?.data || res.data),
    enabled: !!id
  });
};

export const useCreateOwner = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => API.Owners.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owners'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['manager-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['property-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['manager-activity'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });
};

export const useUpdateOwner = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => API.Owners.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['owners'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['manager-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['property-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['manager-activity'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });
};

export const useDeleteOwner = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => API.Owners.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owners'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['manager-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['property-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['manager-activity'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });
};
