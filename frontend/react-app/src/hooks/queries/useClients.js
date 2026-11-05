import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API } from '../../api/services';

const extractData = (res) => {
  let data = [];
  if (res?.data) {
    data = Array.isArray(res.data) ? res.data : (res.data.data || res.data.rows || res.data || []);
  }
  return { data, pagination: res?.pagination || null };
};

export const useClients = (filters = {}) => {
  return useQuery({
    queryKey: ['clients', filters],
    queryFn: () => API.Clients.getAll(filters).then(extractData),
    placeholderData: (prev) => prev,
  });
};

export const useClientStats = (filters = {}) => {
  return useQuery({
    queryKey: ['clients', 'stats', filters],
    queryFn: () => API.Clients.getStats(filters).then(res => res.data?.data || res.data),
    placeholderData: (prev) => prev,
  });
};

export const useClient = (id) => {
  return useQuery({
    queryKey: ['clients', id],
    queryFn: () => API.Clients.getById(id).then(res => res.data?.data || res.data),
    enabled: !!id
  });
};

export const useCreateClient = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => API.Clients.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
    }
  });
};

export const useUpdateClient = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => API.Clients.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });
};

export const useDeleteClient = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => API.Clients.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
    }
  });
};
