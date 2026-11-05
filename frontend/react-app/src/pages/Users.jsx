import React, { useState, useEffect } from 'react';
import { API } from '../api/services';
import UsersTable from '../components/UsersTable';
import UserFormModal from '../components/UserFormModal';
import { useToast } from '../components/ToastContext';
import { useConfirm } from '../components/ConfirmContext';

export default function Users() {
  const [usersList, setUsersList] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [searchUser, setSearchUser] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [usersNotice, setUsersNotice] = useState(null);

  const { showToast } = useToast();
  const { confirm } = useConfirm();

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setUsersLoading(true);
    setUsersError('');
    try {
      const resp = await API.Users.getAll();
      if (resp?.data) {
        const rawList = Array.isArray(resp.data) ? resp.data : resp.data.data || resp.data.rows || [];
        setUsersList(rawList.map(u => ({
          ...u,
          firstName: u.firstName || u.first_name || '',
          lastName: u.lastName || u.last_name || '',
          displayName: u.displayName || u.display_name || '',
          active: u.active === 1 || u.active === true
        })));
      }
    } catch (err) {
      console.error('Error loading users:', err);
      setUsersError("Impossible de charger les utilisateurs. Réessayez ou vérifiez la connexion au serveur.");
    } finally {
      setUsersLoading(false);
    }
  };

  const handleCreateUser = async (formData) => {
    const resp = await API.Users.create(formData);
    if (resp.success) {
      await loadUsers();
      setUsersNotice({
        type: 'success',
        message: `L'utilisateur ${resp.data?.username || formData.username} a été créé avec succès.`
      });
    } else {
      throw new Error(resp.error || 'Erreur lors de la création.');
    }
  };

  const handleDeleteUser = async (userItem) => {
    const isConfirmed = await confirm(`Voulez-vous vraiment supprimer l'utilisateur ${userItem.username} ?`);
    if (!isConfirmed) return;
    setUsersNotice(null);
    try {
      const resp = await API.Users.delete(userItem.id);
      if (resp.success) {
        setUsersList(usersList.filter(u => u.id !== userItem.id));
        setUsersNotice({
          type: 'success',
          message: `L'utilisateur ${userItem.username} a été supprimé.`
        });
      }
    } catch (err) {
      showToast({ type: 'error', message: 'Erreur lors de la suppression: ' + err.message });
    }
  };

  const handleToggleUserStatus = async (userItem) => {
    setUsersNotice(null);
    try {
      const newStatus = !userItem.active;
      const resp = newStatus
        ? await API.Users.activate(userItem.id)
        : await API.Users.deactivate(userItem.id);
      if (resp.success) {
        setUsersList(usersList.map(u => u.id === userItem.id ? { ...u, active: newStatus } : u));
        setUsersNotice({
          type: 'success',
          message: `${userItem.username} est maintenant ${newStatus ? 'actif' : 'inactif'}.`
        });
      }
    } catch (err) {
      showToast({ type: 'error', message: 'Erreur de modification du statut: ' + err.message });
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
          loadUsers();
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
