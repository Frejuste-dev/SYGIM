import React, { useState } from 'react';
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useToggleUserStatus,
  useResetUserPassword
} from '../hooks/queries/useUsers';
import UsersTable from '../components/UsersTable';
import UserFormModal from '../components/UserFormModal';
import ResetPasswordModal from '../components/ResetPasswordModal';
import { useToast } from '../components/ToastContext';
import { useConfirm } from '../components/ConfirmContext';

export default function Users() {
  const [searchUser, setSearchUser] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [resettingUser, setResettingUser] = useState(null);
  const [usersNotice, setUsersNotice] = useState(null);

  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const { data: usersData = {}, isLoading: usersLoading, error: queryError, refetch } = useUsers();
  const usersList = usersData.data || [];
  const usersError = queryError ? (queryError.message || 'Impossible de charger les utilisateurs.') : '';

  const createUserMutation = useCreateUser();
  const updateUserMutation = useUpdateUser();
  const deleteUserMutation = useDeleteUser();
  const toggleStatusMutation = useToggleUserStatus();
  const resetPasswordMutation = useResetUserPassword();

  const handleSaveUser = async (formData) => {
    try {
      if (editingUser && editingUser.id) {
        const resp = await updateUserMutation.mutateAsync({ id: editingUser.id, ...formData });
        setUsersNotice({
          type: 'success',
          message: `La fiche de ${resp.data?.username || formData.username} a été mise à jour.`
        });
      } else {
        const resp = await createUserMutation.mutateAsync(formData);
        setUsersNotice({
          type: 'success',
          message: `L'utilisateur ${resp.data?.username || formData.username} a été créé avec succès.`
        });
      }
    } catch (err) {
      throw new Error(err.response?.data?.message || err.message || 'Erreur lors de l\'enregistrement.');
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
    const newStatus = !(userItem.active || userItem.active === 1);
    const actionLabel = newStatus ? 'activer' : 'désactiver';
    const isConfirmed = await confirm(`Voulez-vous ${actionLabel} le compte de ${userItem.username} ?`);
    if (!isConfirmed) return;

    setUsersNotice(null);
    try {
      await toggleStatusMutation.mutateAsync({ id: userItem.id, active: newStatus });
      setUsersNotice({
        type: 'success',
        message: `${userItem.username} est maintenant ${newStatus ? 'actif' : 'inactif'}.`
      });
    } catch (err) {
      showToast({ type: 'error', message: 'Erreur de modification du statut: ' + (err.response?.data?.message || err.message) });
    }
  };

  const handleResetPassword = async (payload) => {
    const resp = await resetPasswordMutation.mutateAsync(payload);
    setUsersNotice({
      type: 'success',
      message: `Le mot de passe de ${resettingUser?.username || 'l\'utilisateur'} a été réinitialisé.`
    });
    return resp;
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
        onEdit={(u) => {
          setUsersNotice(null);
          setEditingUser(u);
          setShowUserModal(true);
        }}
        onResetPassword={(u) => {
          setUsersNotice(null);
          setResettingUser(u);
        }}
        onToggleStatus={handleToggleUserStatus}
        onDelete={handleDeleteUser}
        onAdd={() => {
          setUsersNotice(null);
          setEditingUser(null);
          setShowUserModal(true);
        }}
      />
      <UserFormModal
        isOpen={showUserModal}
        initialUser={editingUser}
        onClose={() => {
          setShowUserModal(false);
          setEditingUser(null);
        }}
        onSubmit={handleSaveUser}
      />
      <ResetPasswordModal
        isOpen={Boolean(resettingUser)}
        user={resettingUser}
        onClose={() => setResettingUser(null)}
        onSubmit={handleResetPassword}
      />
    </>
  );
}
