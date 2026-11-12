import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API } from '../../api/services';

const extractData = (res) => {
  let data = [];
  if (res?.data) {
    data = Array.isArray(res.data) ? res.data : (res.data.data || res.data.rows || res.data || []);
  }
  return { data, pagination: res?.pagination || null };
};

export const useCollectors = (filters = {}) => {
  return useQuery({
    queryKey: ['collectors', filters],
    queryFn: () => API.Collectors.getAll(filters).then(extractData),
    placeholderData: (prev) => prev,
  });
};

export const useCollector = (id) => {
  return useQuery({
    queryKey: ['collectors', id],
    queryFn: () => API.Collectors.getById(id).then(res => res.data?.data || res.data),
    enabled: !!id
  });
};

export const useCreateCollector = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => API.Collectors.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collectors'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });
};

export const useUpdateCollector = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => API.Collectors.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['collectors'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });
};

export const useDeleteCollector = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => API.Collectors.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collectors'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });
};
