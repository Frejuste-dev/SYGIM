import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API } from '../../api/services';

const extractUserData = (res) => {
  let data = [];
  if (res?.data) {
    const raw = Array.isArray(res.data) ? res.data : (res.data.data || res.data.rows || res.data || []);
    data = raw.map(u => ({
      ...u,
      firstName: u.firstName || u.first_name || '',
      lastName: u.lastName || u.last_name || '',
      displayName: u.displayName || u.display_name || '',
      active: u.active === 1 || u.active === true
    }));
  }
  return { data, pagination: res?.pagination || null };
};

export const useUsers = (filters = {}) => {
  return useQuery({
    queryKey: ['users', filters],
    queryFn: () => API.Users.getAll(filters).then(extractUserData),
    placeholderData: (prev) => prev,
  });
};

export const useUser = (id) => {
  return useQuery({
    queryKey: ['users', id],
    queryFn: () => API.Users.getById(id).then(res => res.data?.data || res.data),
    enabled: !!id,
  });
};

export const useCreateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userData) => API.Users.create(userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => API.Users.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};

export const useDeleteUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => API.Users.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};

export const useToggleUserStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }) => active ? API.Users.activate(id) : API.Users.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};
