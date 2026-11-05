import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API } from '../../api/services';

const extractData = (res) => {
  let data = [];
  if (res?.data) {
    data = Array.isArray(res.data) ? res.data : (res.data.data || res.data.rows || res.data || []);
  }
  return { data, pagination: res?.pagination || null };
};

export const useProperties = (filters = {}) => {
  return useQuery({
    queryKey: ['properties', filters],
    queryFn: () => API.Properties.getAll(filters).then(extractData),
    placeholderData: (prev) => prev,
  });
};

export const usePropertyStats = (filters = {}) => {
  return useQuery({
    queryKey: ['properties', 'stats', filters],
    queryFn: () => API.Properties.getStats(filters).then(res => res.data?.data || res.data),
    placeholderData: (prev) => prev,
  });
};

export const useProperty = (id) => {
  return useQuery({
    queryKey: ['properties', id],
    queryFn: () => API.Properties.getById(id).then(res => res.data?.data || res.data),
    enabled: !!id
  });
};

export const useCreateProperty = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => API.Properties.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });
};

export const useUpdateProperty = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => API.Properties.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });
};

export const useDeleteProperty = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => API.Properties.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });
};
