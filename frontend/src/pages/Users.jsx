import React, { useState } from 'react';
import { useUsers, useCreateUser, useDeleteUser, useToggleUserStatus } from '../hooks/queries/useUsers';
import UsersTable from '../components/UsersTable';
import UserFormModal from '../components/UserFormModal';
import { useToast } from '../components/ToastContext';
import { useConfirm } from '../components/ConfirmContext';

export default function Users() {
  const [searchUser, setSearchUser] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [usersNotice, setUsersNotice] = useState(null);

  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const { data: usersData = {}, isLoading: usersLoading, error: queryError, refetch } = useUsers();
  const usersList = usersData.data || [];
  const usersError = queryError ? (queryError.message || 'Impossible de charger les utilisateurs.') : '';

  const createUserMutation = useCreateUser();
  const deleteUserMutation = useDeleteUser();
  const toggleStatusMutation = useToggleUserStatus();

  const handleCreateUser = async (formData) => {
    try {
      const resp = await createUserMutation.mutateAsync(formData);
      setUsersNotice({
        type: 'success',
        message: `L'utilisateur ${resp.data?.username || formData.username} a été créé avec succès.`
      });
    } catch (err) {
      throw new Error(err.response?.data?.message || err.message || 'Erreur lors de la création.');
    }
  };

  const handleDeleteUser = async (userItem) => {
    const isConfirmed = await confirm(`Voulez-vous vraiment supprimer l'utilisateur ${userItem.username} ?`);
    if (!isConfirmed) return;
    setUsersNotice(null);
    try {
      await deleteUserMutation.mutateAsync(userItem.id);
      setUsersNotice({
        type: 'success',
        message: `L'utilisateur ${userItem.username} a été supprimé.`
      });
    } catch (err) {
      showToast({ type: 'error', message: 'Erreur lors de la suppression: ' + (err.response?.data?.message || err.message) });
    }
  };

  const handleToggleUserStatus = async (userItem) => {
    setUsersNotice(null);
    try {
      const newStatus = !userItem.active;
      await toggleStatusMutation.mutateAsync({ id: userItem.id, active: newStatus });
      setUsersNotice({
        type: 'success',
        message: `${userItem.username} est maintenant ${newStatus ? 'actif' : 'inactif'}.`
      });
    } catch (err) {
      showToast({ type: 'error', message: 'Erreur de modification du statut: ' + (err.response?.data?.message || err.message) });
    }
  };

  return (
    <>
      <UsersTable
        users={usersList}
        loading={usersLoading}
        error={usersError}
        notice={usersNotice}
        search={searchUser}
        roleFilter={roleFilter}
        statusFilter={statusFilter}
        onSearchChange={setSearchUser}
        onRoleFilterChange={setRoleFilter}
        onStatusFilterChange={setStatusFilter}
        onRefresh={() => {
          setUsersNotice(null);
          refetch();
        }}
        onToggleStatus={handleToggleUserStatus}
        onDelete={handleDeleteUser}
        onAdd={() => {
          setUsersNotice(null);
          setShowCreateModal(true);
        }}
      />
      <UserFormModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateUser}
      />
    </>
  );
}
