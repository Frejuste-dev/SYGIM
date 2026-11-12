import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API } from '../../api/services';

const extractData = (res) => {
  let data = [];
  if (res?.data) {
    data = Array.isArray(res.data) ? res.data : (res.data.data || res.data.rows || res.data || []);
  }
  return { data, pagination: res?.pagination || null };
};

export const useTransactions = (filters = {}) => {
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => API.Transactions.getAll(filters).then(extractData),
    placeholderData: (prev) => prev,
  });
};

export const useTransactionStats = (filters = {}) => {
  return useQuery({
    queryKey: ['transactions', 'stats', filters],
    queryFn: () => API.Transactions.getStats(filters).then(res => res.data?.data || res.data),
    placeholderData: (prev) => prev,
  });
};

export const useTransaction = (id) => {
  return useQuery({
    queryKey: ['transactions', id],
    queryFn: () => API.Transactions.getById(id).then(res => res.data?.data || res.data),
    enabled: !!id
  });
};

export const useCreateTransaction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => API.Transactions.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });
};

export const useUpdateTransaction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => API.Transactions.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });
};

export const useDeleteTransaction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => API.Transactions.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });
};
