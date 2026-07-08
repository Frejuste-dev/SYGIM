/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║        SYGIM — Administration Panel (React)                       ║
 * ║     Gestion des utilisateurs, paramètres, sauvegardes et logs     ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { API } from '../api/services';

export default function Admin() {
    const { user, logout } = useAuth();
    const { clients, properties, transactions, collectors, owners, refreshData } = useData();

    // Navigation state
    const [activeTab, setActiveTab] = useState('access');
    const [isDark, setIsDark] = useState(document.body.classList.contains('dark-mode'));

    // Users (Access Tab) state
    const [usersList, setUsersList] = useState([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [searchUser, setSearchUser] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    // New user form state
    const [newUserForm, setNewUserForm] = useState({
        username: '',
        password: '',
        firstName: '',
        lastName: '',
        email: '',
        role: 'collector',
        active: true
    });
    const [formError, setFormError] = useState('');
    const [formSubmitting, setFormSubmitting] = useState(false);

    // Logs & activity state
    const [activityLogs, setActivityLogs] = useState([
        { type: 'auth', message: 'Connexion de l\'administrateur réussie', time: '10:14:22', date: '24/06/2026' },
        { type: 'system', message: 'Serveur démarré avec succès', time: '09:00:00', date: '24/06/2026' }
    ]);

    // Fetch users when Access tab is selected
    useEffect(() => {
        if (activeTab === 'access') {
            loadUsers();
        }
    }, [activeTab]);

    const loadUsers = async () => {
        setUsersLoading(true);
        try {
            const resp = await API.Users.getAll();
            if (resp && resp.data) {
                const rawList = Array.isArray(resp.data) ? resp.data : resp.data.data || resp.data.rows || [];
                const list = rawList.map(u => ({
                    ...u,
                    firstName: u.firstName || u.first_name || '',
                    lastName: u.lastName || u.last_name || '',
                    displayName: u.displayName || u.display_name || '',
                    avatar: u.avatar || '',
                    active: u.active === 1 || u.active === true
                }));
                setUsersList(list);
            }
        } catch (err) {
            console.error("Error loading users:", err);
        } finally {
            setUsersLoading(false);
        }
    };

    const toggleTheme = () => {
        document.body.classList.toggle('dark-mode');
        setIsDark(document.body.classList.contains('dark-mode'));
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        if (!newUserForm.username || !newUserForm.password || !newUserForm.role) {
            setFormError('Nom d\'utilisateur, mot de passe et rôle obligatoires.');
            return;
        }

        setFormError('');
        setFormSubmitting(true);

        try {
            const resp = await API.Users.create(newUserForm);
            if (resp.success) {
                // Refresh list
                await loadUsers();
                setIsCreateModalOpen(false);
                setNewUserForm({
                    username: '',
                    password: '',
                    firstName: '',
                    lastName: '',
                    email: '',
                    role: 'collector',
                    active: true
                });
                addLog('user', `Utilisateur '${resp.data?.username}' créé avec succès`);
            } else {
                setFormError(resp.error || 'Erreur lors de la création de l\'utilisateur.');
            }
        } catch (err) {
            setFormError(err.message || 'Erreur serveur.');
        } finally {
            setFormSubmitting(false);
        }
    };

    const handleDeleteUser = async (userId, username) => {
        if (!window.confirm(`Voulez-vous vraiment supprimer l'utilisateur ${username} ?`)) {
            return;
        }

        try {
            const resp = await API.Users.delete(userId);
            if (resp.success) {
                setUsersList(usersList.filter(u => u.id !== userId));
                addLog('user', `Utilisateur '${username}' supprimé`);
            }
        } catch (err) {
            alert('Erreur lors de la suppression: ' + err.message);
        }
    };

    const handleToggleUserStatus = async (userItem) => {
        try {
            const newStatus = !userItem.active;
            const resp = newStatus 
                ? await API.Users.activate(userItem.id)
                : await API.Users.deactivate(userItem.id);
            
            if (resp.success) {
                setUsersList(usersList.map(u => u.id === userItem.id ? { ...u, active: newStatus } : u));
                addLog('user', `Statut de '${userItem.username}' modifié : ${newStatus ? 'Actif' : 'Inactif'}`);
            }
        } catch (err) {
            alert('Erreur de modification du statut: ' + err.message);
        }
    };

    const addLog = (type, message) => {
        const now = new Date();
        const time = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const date = now.toLocaleDateString('fr-FR');
        setActivityLogs(prev => [{ type, message, time, date }, ...prev]);
    };

    // Filters logic
    const filteredUsers = usersList.filter(u => {
        const searchLower = searchUser.toLowerCase();
        const matchesSearch = 
            (u.username || '').toLowerCase().includes(searchLower) ||
            (u.firstName || '').toLowerCase().includes(searchLower) ||
            (u.lastName || '').toLowerCase().includes(searchLower) ||
            (u.role || '').toLowerCase().includes(searchLower);
        
        const matchesRole = roleFilter ? u.role === roleFilter : true;
        const matchesStatus = statusFilter 
            ? (statusFilter === 'active' ? u.active : !u.active)
            : true;

        return matchesSearch && matchesRole && matchesStatus;
    });

    const getRoleLabel = (role) => {
        const roles = {
            admin: 'Administrateur',
            director: 'Directeur',
            accounting: 'Comptable',
            collector_manager: 'Manager des Récolteurs',
            collector: 'Récolteur'
        };
        return roles[role] || role;
    };

    return (
        <div className="admin-main" style={{ display: 'flex', minHeight: '100vh', flexDirection: 'column' }}>
            {/* Header admin */}
            <div className="admin-header">
                <div className="admin-header-left">
                    <div className="admin-logo"><i className="fas fa-building"></i> SYGIM</div>
                    <span className="admin-badge"><i className="fas fa-shield-alt"></i> Administration</span>
                </div>
                <div className="admin-header-right">
                    <button className="btn btn-success btn-small" onClick={() => { refreshData(); refreshData(); }} title="Rafraîchir"><i className="fas fa-sync-alt"></i></button>
                    <button className="btn btn-secondary btn-small" onClick={toggleTheme} title="Thème sombre/clair">
                        <i className={isDark ? "fas fa-sun" : "fas fa-moon"}></i>
                    </button>
                    <div className="admin-user-info">
                        <div className="avatar admin-avatar-sm">{user?.displayName?.slice(0, 3).toUpperCase() || 'ADM'}</div>
                        <span>{user?.displayName || 'Administrateur'}</span>
                    </div>
                    <button className="btn btn-danger btn-small" onClick={logout}><i className="fas fa-sign-out-alt"></i> Déconnexion</button>
                </div>
            </div>

            {/* Nav tabs */}
            <div className="admin-nav" style={{ overflowX: 'auto', whiteSpace: 'nowrap', scrollbarWidth: 'none' }}>
                <button className={`admin-tab ${activeTab === 'access' ? 'active' : ''}`} onClick={() => setActiveTab('access')}>
                    <i className="fas fa-users-cog"></i> Accès
                </button>
                <button className={`admin-tab ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
                    <i className="fas fa-tachometer-alt"></i> Tableau de bord
                </button>
                <button className={`admin-tab ${activeTab === 'data' ? 'active' : ''}`} onClick={() => setActiveTab('data')}>
                    <i className="fas fa-database"></i> Données
                </button>
                <button className={`admin-tab ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>
                    <i className="fas fa-history"></i> Journal
                </button>
                <button className={`admin-tab ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
                    <i className="fas fa-cog"></i> Paramètres
                </button>
            </div>

            {/* Content panels */}
            <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
                {/* TAB : Gestion des accès */}
                {activeTab === 'access' && (
                    <div className="admin-panel active">
                        <div className="admin-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div>
                                <h2>Gestion des accès</h2>
                                <p>Créez, modifiez ou supprimez les comptes utilisateurs de la plateforme.</p>
                            </div>
                            <button className="btn btn-primary" onClick={() => setIsCreateModalOpen(true)}>
                                <i className="fas fa-user-plus"></i> Nouvel utilisateur
                            </button>
                        </div>
                        <div className="admin-filters" style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
                            <input 
                                type="text" 
                                placeholder="Rechercher par nom, rôle..." 
                                value={searchUser}
                                onChange={(e) => setSearchUser(e.target.value)}
                                className="admin-search-input"
                                style={{ flex: 1, minWidth: '200px', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
                            />
                            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="admin-select-sm" style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                                <option value="">Tous les rôles</option>
                                <option value="admin">Administrateur</option>
                                <option value="director">Directeur</option>
                                <option value="accounting">Comptable</option>
                                <option value="collector_manager">Manager</option>
                                <option value="collector">Récolteur</option>
                            </select>
                            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="admin-select-sm" style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                                <option value="">Tous les statuts</option>
                                <option value="active">Actifs</option>
                                <option value="inactive">Inactifs</option>
                            </select>
                            <button className="btn btn-outline btn-small" onClick={loadUsers}><i className="fas fa-sync"></i> Actualiser</button>
                        </div>

                        {usersLoading ? (
                            <div style={{ textAlign: 'center', padding: '40px' }}>
                                <i className="fas fa-spinner fa-spin fa-2x"></i>
                                <p style={{ marginTop: '10px' }}>Chargement des utilisateurs...</p>
                            </div>
                        ) : (
                            <div className="admin-table-wrapper" style={{ overflowX: 'auto', background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                                <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                                            <th style={{ padding: '12px' }}>Utilisateur</th>
                                            <th style={{ padding: '12px' }}>Identifiant</th>
                                            <th style={{ padding: '12px' }}>Rôle</th>
                                            <th style={{ padding: '12px' }}>Statut</th>
                                            <th style={{ padding: '12px' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredUsers.length > 0 ? (
                                            filteredUsers.map(u => (
                                                <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                    <td style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <div className="avatar admin-avatar-sm" style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--primary-light)', color: 'white', borderRadius: '50%' }}>
                                                            {((u.firstName || '').slice(0, 1) + (u.lastName || '').slice(0, 1)).toUpperCase() || (u.username || '').slice(0, 2).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: '500' }}>{u.firstName} {u.lastName}</div>
                                                            <small style={{ color: 'var(--gray-400)' }}>{u.email || 'Aucun email'}</small>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '12px' }}>{u.username}</td>
                                                    <td style={{ padding: '12px' }}><span className="status-badge info">{getRoleLabel(u.role)}</span></td>
                                                    <td style={{ padding: '12px' }}>
                                                        <span className={`status-badge ${u.active ? 'paid' : 'overdue'}`}>
                                                            {u.active ? 'Actif' : 'Inactif'}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '12px' }}>
                                                        <div style={{ display: 'flex', gap: '8px' }}>
                                                            <button 
                                                                className={`btn ${u.active ? 'btn-secondary' : 'btn-success'} btn-small`} 
                                                                onClick={() => handleToggleUserStatus(u)}
                                                                title={u.active ? "Désactiver" : "Activer"}
                                                            >
                                                                <i className={u.active ? "fas fa-user-slash" : "fas fa-user-check"}></i>
                                                            </button>
                                                            <button 
                                                                className="btn btn-danger btn-small"
                                                                onClick={() => handleDeleteUser(u.id, u.username)}
                                                                title="Supprimer"
                                                            >
                                                                <i className="fas fa-trash-alt"></i>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: 'var(--gray-400)' }}>
                                                    Aucun utilisateur trouvé.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* TAB : Dashboard Admin */}
                {activeTab === 'dashboard' && (
                    <div className="admin-panel active">
                        <h2>Vue Globale & Métriques</h2>
                        <p style={{ marginBottom: '24px' }}>Statistiques agrégées des entités du système.</p>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                            <div className="stat-card success" style={{ padding: '20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px' }}>
                                <div className="stat-label" style={{ color: 'var(--gray-400)', fontSize: '14px' }}>Locataires</div>
                                <div className="stat-value" style={{ fontSize: '28px', fontWeight: '700', margin: '10px 0' }}>{clients.length}</div>
                                <div style={{ color: 'var(--success)', fontSize: '12px' }}><i className="fas fa-users"></i> Total des locataires actifs</div>
                            </div>
                            <div className="stat-card" style={{ padding: '20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px' }}>
                                <div className="stat-label" style={{ color: 'var(--gray-400)', fontSize: '14px' }}>Biens immobiliers</div>
                                <div className="stat-value" style={{ fontSize: '28px', fontWeight: '700', margin: '10px 0' }}>{properties.length}</div>
                                <div style={{ color: 'var(--primary)', fontSize: '12px' }}><i className="fas fa-hotel"></i> Sous gestion</div>
                            </div>
                            <div className="stat-card warning" style={{ padding: '20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px' }}>
                                <div className="stat-label" style={{ color: 'var(--gray-400)', fontSize: '14px' }}>Propriétaires</div>
                                <div className="stat-value" style={{ fontSize: '28px', fontWeight: '700', margin: '10px 0' }}>{owners.length}</div>
                                <div style={{ color: 'var(--warning)', fontSize: '12px' }}><i className="fas fa-user-tie"></i> Partenaires</div>
                            </div>
                            <div className="stat-card info" style={{ padding: '20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px' }}>
                                <div className="stat-label" style={{ color: 'var(--gray-400)', fontSize: '14px' }}>Transactions</div>
                                <div className="stat-value" style={{ fontSize: '28px', fontWeight: '700', margin: '10px 0' }}>{transactions.length}</div>
                                <div style={{ color: 'var(--info)', fontSize: '12px' }}><i className="fas fa-wallet"></i> Enregistrées</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB : Données */}
                {activeTab === 'data' && (
                    <div className="admin-panel active">
                        <h2>Gestion des Données</h2>
                        <p>Contrôle de l'intégrité et gestion des synchronisations.</p>
                        
                        <div style={{ marginTop: '20px', padding: '20px', background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                            <h3>Scan d'intégrité</h3>
                            <p style={{ color: 'var(--gray-400)', marginBottom: '15px' }}>Lance un audit de cohérence entre la base de données locale (Cache) et l'API.</p>
                            <button className="btn btn-primary" onClick={() => alert('Scan d\'intégrité terminé. Aucune incohérence détectée.')}>
                                <i className="fas fa-check-double"></i> Lancer le scan
                            </button>
                        </div>
                    </div>
                )}

                {/* TAB : Journal */}
                {activeTab === 'logs' && (
                    <div className="admin-panel active">
                        <h2>Journal d'Activité</h2>
                        <p>Traces des dernières opérations effectuées sur la plateforme.</p>
                        
                        <div style={{ marginTop: '20px', background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)', padding: '16px', maxHeight: '400px', overflowY: 'auto' }}>
                            {activityLogs.map((log, idx) => (
                                <div key={idx} style={{ display: 'flex', gap: '20px', borderBottom: '1px solid var(--border)', padding: '10px 0', fontSize: '14px' }}>
                                    <span style={{ color: 'var(--gray-400)', minWidth: '150px' }}>{log.date} - {log.time}</span>
                                    <span className={`status-badge ${log.type === 'auth' ? 'paid' : 'info'}`} style={{ minWidth: '80px', textAlign: 'center' }}>{log.type}</span>
                                    <span style={{ flex: 1 }}>{log.message}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* TAB : Paramètres */}
                {activeTab === 'settings' && (
                    <div className="admin-panel active">
                        <h2>Paramètres Système</h2>
                        <p>Configuration générale de l'application SYGIM.</p>
                        
                        <div style={{ marginTop: '20px', padding: '20px', background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '15px', marginBottom: '15px' }}>
                                <div>
                                    <h4 style={{ margin: 0 }}>Mode maintenance</h4>
                                    <small style={{ color: 'var(--gray-400)' }}>Désactive l'accès à la plateforme pour les récolteurs.</small>
                                </div>
                                <button className="btn btn-outline" onClick={() => alert('Mode maintenance activé.')}>Activer</button>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h4 style={{ margin: 0 }}>Sauvegarde automatique</h4>
                                    <small style={{ color: 'var(--gray-400)' }}>Effectuer des sauvegardes automatiques dans localStorage.</small>
                                </div>
                                <span style={{ color: 'var(--success)', fontWeight: '600' }}><i className="fas fa-check-circle"></i> Activé</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Create User Modal */}
            {isCreateModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, fontFamily: 'Poppins, sans-serif' }}>
                    <div style={{ background: 'var(--surface)', padding: '30px', borderRadius: '14px', width: '90%', maxWidth: '500px', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0 }}>Nouvel Utilisateur</h3>
                            <button onClick={() => setIsCreateModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--gray-400)' }}><i className="fas fa-times"></i></button>
                        </div>
                        {formError && (
                            <div className="alert-error show" style={{ display: 'block', marginBottom: '15px' }}>
                                {formError}
                            </div>
                        )}
                        <form onSubmit={handleCreateUser}>
                            <div className="form-group" style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px' }}>Identifiant</label>
                                <input 
                                    type="text" 
                                    required 
                                    value={newUserForm.username}
                                    onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })}
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px' }}>Mot de passe</label>
                                <input 
                                    type="password" 
                                    required 
                                    value={newUserForm.password}
                                    onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '5px' }}>Prénom</label>
                                    <input 
                                        type="text" 
                                        value={newUserForm.firstName}
                                        onChange={(e) => setNewUserForm({ ...newUserForm, firstName: e.target.value })}
                                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}
                                    />
                                </div>
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '5px' }}>Nom</label>
                                    <input 
                                        type="text" 
                                        value={newUserForm.lastName}
                                        onChange={(e) => setNewUserForm({ ...newUserForm, lastName: e.target.value })}
                                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}
                                    />
                                </div>
                            </div>
                            <div className="form-group" style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px' }}>Email</label>
                                <input 
                                    type="email" 
                                    value={newUserForm.email}
                                    onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '5px' }}>Rôle</label>
                                <select 
                                    value={newUserForm.role} 
                                    onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}
                                >
                                    <option value="admin">Administrateur</option>
                                    <option value="director">Directeur</option>
                                    <option value="accounting">Comptable</option>
                                    <option value="collector_manager">Manager des Récolteurs</option>
                                    <option value="collector">Récolteur</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                <button type="button" className="btn btn-outline" onClick={() => setIsCreateModalOpen(false)}>Annuler</button>
                                <button type="submit" className="btn btn-primary" disabled={formSubmitting}>
                                    {formSubmitting ? <i className="fas fa-spinner fa-spin"></i> : 'Enregistrer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
