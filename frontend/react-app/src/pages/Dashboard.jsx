/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║        SYGIM — Direction / Comptabilité Dashboard (React)         ║
 * ║     Gestion de portefeuille, suivi financier, clients et rapports  ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { API } from '../api/services';

export default function Dashboard() {
    const { user, logout } = useAuth();
    const { clients, properties, transactions, owners, collectors, refreshData, setClients, setProperties, setOwners } = useData();

    // Menu and navigation state
    const [activeSection, setActiveSection] = useState('dashboard');
    const [isDark, setIsDark] = useState(document.body.classList.contains('dark-mode'));
    const [searchQuery, setSearchQuery] = useState('');

    // Dashboard calculations
    const totalRevenue = clients.reduce((sum, c) => sum + (c.amountPaid || 0), 0);
    const activeClientsCount = clients.filter(c => c.status !== 'inactive').length;
    const pendingPaymentsCount = clients.filter(c => c.status === 'pending' || c.status === 'overdue').length;
    const totalDue = clients.reduce((sum, c) => sum + (c.amountDue || 0), 0);
    const collectionRate = totalDue > 0 ? Math.round((totalRevenue / totalDue) * 100) : 0;
    const occupiedCount = properties.filter(p => p.status === 'loue' || p.status === 'partiel' || p.tenantId).length;
    const occupancyRate = properties.length > 0 ? Math.round((occupiedCount / properties.length) * 100) : 0;

    // Modals
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [isPropertyModalOpen, setIsPropertyModalOpen] = useState(false);

    // Forms
    const [newClient, setNewClient] = useState({
        lastName: '', firstName: '', phone: '', email: '', address: '', amountDue: 50000, status: 'pending'
    });
    const [newProperty, setNewProperty] = useState({
        name: '', type: 'Appartement', address: '', value: 15000000, status: 'vacant'
    });

    const toggleTheme = () => {
        document.body.classList.toggle('dark-mode');
        setIsDark(document.body.classList.contains('dark-mode'));
    };

    // Client submission
    const handleAddClient = async (e) => {
        e.preventDefault();
        if (!newClient.lastName || !newClient.firstName || !newClient.phone) {
            alert('Veuillez remplir les champs obligatoires.');
            return;
        }
        try {
            const resp = await API.Clients.create(newClient);
            if (resp.success) {
                setClients([{ ...newClient, id: resp.data.id, amountPaid: 0 }, ...clients]);
                setIsClientModalOpen(false);
                setNewClient({ lastName: '', firstName: '', phone: '', email: '', address: '', amountDue: 50000, status: 'pending' });
                alert('Client ajouté avec succès !');
            }
        } catch (err) {
            alert('Erreur: ' + err.message);
        }
    };

    // Property submission
    const handleAddProperty = async (e) => {
        e.preventDefault();
        if (!newProperty.name || !newProperty.address) {
            alert('Veuillez remplir les champs obligatoires.');
            return;
        }
        try {
            const resp = await API.Properties.create(newProperty);
            if (resp.success) {
                setProperties([{ ...newProperty, id: resp.data.id }, ...properties]);
                setIsPropertyModalOpen(false);
                setNewProperty({ name: '', type: 'Appartement', address: '', value: 15000000, status: 'vacant' });
                alert('Bien immobilier ajouté avec succès !');
            }
        } catch (err) {
            alert('Erreur: ' + err.message);
        }
    };

    const getSectionTitle = () => {
        const titles = {
            dashboard: 'Tableau de bord',
            portfolio: 'Portefeuille Immobilier',
            clients: 'Clients & Locataires',
            payments: 'Historique des Transactions',
            reports: 'Rapports & Documents',
            analytics: 'Statistiques & Analyse',
            owners: 'Propriétaires partenaires',
            settings: 'Paramètres Généraux'
        };
        return titles[activeSection] || 'SYGIM';
    };

    return (
        <div className="app-container" style={{ display: 'flex', minHeight: '100vh' }}>
            {/* SIDEBAR */}
            <div className="sidebar" style={{ width: '260px', flexShrink: 0 }}>
                <div className="sidebar-header" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <i className="fas fa-building" style={{ fontSize: '24px', color: 'var(--primary)' }}></i>
                    <span style={{ fontSize: '20px', fontWeight: 'bold' }}>SYGIM</span>
                </div>
                <div className="sidebar-menu">
                    {[
                        { id: 'dashboard', label: 'Tableau de bord', icon: 'fa-th-large' },
                        { id: 'portfolio', label: 'Portefeuille', icon: 'fa-layer-group', badge: properties.length },
                        { id: 'clients', label: 'Clients & Biens', icon: 'fa-users', badge: clients.length },
                        { id: 'payments', label: 'Transactions', icon: 'fa-exchange-alt' },
                        { id: 'reports', label: 'Rapports', icon: 'fa-chart-bar' },
                        { id: 'analytics', label: 'Analyse', icon: 'fa-chart-line' },
                        { id: 'owners', label: 'Propriétaires', icon: 'fa-user-tie', badge: owners.length },
                        { id: 'settings', label: 'Paramètres', icon: 'fa-cog' }
                    ].map(item => (
                        <div 
                            key={item.id} 
                            className={`menu-item ${activeSection === item.id ? 'active' : ''}`}
                            onClick={() => setActiveSection(item.id)}
                            style={{ display: 'flex', alignItems: 'center', padding: '12px 24px', cursor: 'pointer', transition: 'all 0.2s', gap: '12px' }}
                        >
                            <i className={`fas ${item.icon}`}></i>
                            <span style={{ flex: 1 }}>{item.label}</span>
                            {item.badge !== undefined && (
                                <span className="menu-badge" style={{ background: 'var(--border)', padding: '2px 8px', borderRadius: '10px', fontSize: '11px' }}>
                                    {item.badge}
                                </span>
                            )}
                        </div>
                    ))}
                    <div className="menu-item" onClick={logout} style={{ display: 'flex', alignItems: 'center', padding: '12px 24px', cursor: 'pointer', gap: '12px', marginTop: 'auto', color: 'var(--danger)' }}>
                        <i className="fas fa-sign-out-alt"></i>
                        <span>Déconnexion</span>
                    </div>
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div className="header" style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h1 className="header-title" style={{ margin: 0, fontSize: '22px', fontWeight: 'bold' }}>{getSectionTitle()}</h1>
                    <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div className="search-bar" style={{ display: 'flex', alignItems: 'center', background: 'var(--surface)', padding: '6px 12px', borderRadius: '20px', border: '1px solid var(--border)' }}>
                            <i className="fas fa-search" style={{ color: 'var(--gray-400)', marginRight: '8px' }}></i>
                            <input 
                                type="text" 
                                placeholder="Rechercher..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{ border: 'none', background: 'none', outline: 'none', color: 'inherit' }}
                            />
                        </div>
                        <button className="btn btn-secondary btn-small" onClick={toggleTheme} title="Thème">
                            <i className={isDark ? "fas fa-sun" : "fas fa-moon"}></i>
                        </button>
                        <div className="user-profile" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="avatar" style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                {user?.role === 'director' ? 'DIR' : 'CPT'}
                            </div>
                            <div style={{ fontSize: '13px' }}>
                                <div style={{ fontWeight: '600' }}>{user?.displayName || 'Direction'}</div>
                                <div style={{ color: 'var(--gray-400)', fontSize: '11px' }}>{user?.role === 'director' ? 'Directeur Général' : 'Comptable'}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* SCROLLABLE BODY */}
                <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
                    {/* SECTION: Dashboard */}
                    {activeSection === 'dashboard' && (
                        <div>
                            {/* KPI Grid */}
                            <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                                <div className="stat-card success" style={{ padding: '20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px' }}>
                                    <div className="stat-label" style={{ color: 'var(--gray-400)', fontSize: '13px' }}>Recettes totales</div>
                                    <div className="stat-value xof" style={{ fontSize: '26px', fontWeight: 'bold', margin: '8px 0' }}>{(totalRevenue / 1000000).toFixed(2)}M</div>
                                    <div className="stat-change positive">Loyers perçus</div>
                                </div>
                                <div className="stat-card" style={{ padding: '20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px' }}>
                                    <div className="stat-label" style={{ color: 'var(--gray-400)', fontSize: '13px' }}>Taux d'occupation</div>
                                    <div className="stat-value" style={{ fontSize: '26px', fontWeight: 'bold', margin: '8px 0' }}>{occupancyRate}%</div>
                                    <div className="stat-change positive">{occupiedCount} sur {properties.length} biens loués</div>
                                </div>
                                <div className="stat-card warning" style={{ padding: '20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px' }}>
                                    <div className="stat-label" style={{ color: 'var(--gray-400)', fontSize: '13px' }}>Retards de paiement</div>
                                    <div className="stat-value" style={{ fontSize: '26px', fontWeight: 'bold', margin: '8px 0' }}>{pendingPaymentsCount}</div>
                                    <div className="stat-change negative">Reste dû : {(totalDue - totalRevenue).toLocaleString()} XOF</div>
                                </div>
                                <div className="stat-card info" style={{ padding: '20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px' }}>
                                    <div className="stat-label" style={{ color: 'var(--gray-400)', fontSize: '13px' }}>Recouvrement</div>
                                    <div className="stat-value" style={{ fontSize: '26px', fontWeight: 'bold', margin: '8px 0' }}>{collectionRate}%</div>
                                    <div className="stat-change positive">Objectif global: 80%</div>
                                </div>
                            </div>

                            {/* Recent Transactions */}
                            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                    <h3 style={{ margin: 0 }}>Dernières Transactions</h3>
                                    <button className="btn btn-outline btn-small" onClick={() => setActiveSection('payments')}>Voir tout</button>
                                </div>
                                <div className="admin-table-wrapper">
                                    <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                                                <th style={{ padding: '12px' }}>Locataire</th>
                                                <th style={{ padding: '12px' }}>Montant</th>
                                                <th style={{ padding: '12px' }}>Mode</th>
                                                <th style={{ padding: '12px' }}>Référence</th>
                                                <th style={{ padding: '12px' }}>Date</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {transactions.slice(0, 5).map(tx => (
                                                <tr key={tx.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                    <td style={{ padding: '12px', fontWeight: '500' }}>{tx.client || 'Client inconnu'}</td>
                                                    <td style={{ padding: '12px', color: 'var(--success)' }}>{(tx.amount || 0).toLocaleString()} XOF</td>
                                                    <td style={{ padding: '12px' }}><span className="status-badge info">{tx.method || 'Espèces'}</span></td>
                                                    <td style={{ padding: '12px' }}>{tx.reference}</td>
                                                    <td style={{ padding: '12px', color: 'var(--gray-400)' }}>{tx.date || new Date(tx.createdAt).toLocaleDateString('fr-FR')}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SECTION: Portfolio */}
                    {activeSection === 'portfolio' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h3>Liste des Biens Immobiliers</h3>
                                <button className="btn btn-primary" onClick={() => setIsPropertyModalOpen(true)}>
                                    <i className="fas fa-plus"></i> Nouveau Bien
                                </button>
                            </div>
                            <div className="admin-table-wrapper" style={{ background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                                            <th style={{ padding: '12px' }}>Nom</th>
                                            <th style={{ padding: '12px' }}>Type</th>
                                            <th style={{ padding: '12px' }}>Adresse</th>
                                            <th style={{ padding: '12px' }}>Valeur</th>
                                            <th style={{ padding: '12px' }}>Statut</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {properties.map(p => (
                                            <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                <td style={{ padding: '12px', fontWeight: '500' }}>{p.name}</td>
                                                <td style={{ padding: '12px' }}>{p.type}</td>
                                                <td style={{ padding: '12px' }}>{p.address}</td>
                                                <td style={{ padding: '12px' }}>{(p.value || 0).toLocaleString()} XOF</td>
                                                <td style={{ padding: '12px' }}>
                                                    <span className={`status-badge ${p.status === 'loue' ? 'paid' : 'overdue'}`}>
                                                        {p.status === 'loue' ? 'Loué' : 'Vacant'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* SECTION: Clients */}
                    {activeSection === 'clients' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h3>Locataires Actifs</h3>
                                <button className="btn btn-primary" onClick={() => setIsClientModalOpen(true)}>
                                    <i className="fas fa-user-plus"></i> Nouveau Locataire
                                </button>
                            </div>
                            <div className="admin-table-wrapper" style={{ background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                                            <th style={{ padding: '12px' }}>Nom</th>
                                            <th style={{ padding: '12px' }}>Téléphone</th>
                                            <th style={{ padding: '12px' }}>Loyer mensuel</th>
                                            <th style={{ padding: '12px' }}>Montant payé</th>
                                            <th style={{ padding: '12px' }}>Statut</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {clients.map(c => (
                                            <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                <td style={{ padding: '12px', fontWeight: '500' }}>{c.lastName} {c.firstName}</td>
                                                <td style={{ padding: '12px' }}>{c.phone}</td>
                                                <td style={{ padding: '12px' }}>{(c.amountDue || 0).toLocaleString()} XOF</td>
                                                <td style={{ padding: '12px', color: 'var(--success)' }}>{(c.amountPaid || 0).toLocaleString()} XOF</td>
                                                <td style={{ padding: '12px' }}>
                                                    <span className={`status-badge ${c.status === 'paid' ? 'paid' : (c.status === 'partial' ? 'partial' : 'overdue')}`}>
                                                        {c.status === 'paid' ? 'Payé' : (c.status === 'partial' ? 'Partiel' : 'Non payé')}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* SECTION: Payments */}
                    {activeSection === 'payments' && (
                        <div>
                            <h3>Historique des Transactions de Recouvrement</h3>
                            <div className="admin-table-wrapper" style={{ background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                                            <th style={{ padding: '12px' }}>ID</th>
                                            <th style={{ padding: '12px' }}>Client</th>
                                            <th style={{ padding: '12px' }}>Montant</th>
                                            <th style={{ padding: '12px' }}>Mode</th>
                                            <th style={{ padding: '12px' }}>Date</th>
                                            <th style={{ padding: '12px' }}>Référence</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {transactions.map(tx => (
                                            <tr key={tx.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                <td style={{ padding: '12px', color: 'var(--gray-400)' }}>{tx.id}</td>
                                                <td style={{ padding: '12px', fontWeight: '500' }}>{tx.client}</td>
                                                <td style={{ padding: '12px', color: 'var(--success)' }}>{(tx.amount || 0).toLocaleString()} XOF</td>
                                                <td style={{ padding: '12px' }}>{tx.method || 'Espèces'}</td>
                                                <td style={{ padding: '12px' }}>{tx.date || new Date(tx.createdAt).toLocaleDateString('fr-FR')}</td>
                                                <td style={{ padding: '12px', color: 'var(--gray-400)' }}>{tx.reference}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* SECTION: Owners */}
                    {activeSection === 'owners' && (
                        <div>
                            <div style={{ display: 'flex', justifyOrigin: 'space-between', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h3>Propriétaires partenaires</h3>
                                <button className="btn btn-primary" onClick={() => alert('Création de propriétaire disponible prochainement.')}>Nouveau Propriétaire</button>
                            </div>
                            <div className="admin-table-wrapper" style={{ background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                                            <th style={{ padding: '12px' }}>Propriétaire</th>
                                            <th style={{ padding: '12px' }}>Email</th>
                                            <th style={{ padding: '12px' }}>Téléphone</th>
                                            <th style={{ padding: '12px' }}>Commission</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {owners.map(o => (
                                            <tr key={o.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                <td style={{ padding: '12px', fontWeight: '500' }}>{o.lastName} {o.firstName}</td>
                                                <td style={{ padding: '12px' }}>{o.email || 'N/A'}</td>
                                                <td style={{ padding: '12px' }}>{o.phone || 'N/A'}</td>
                                                <td style={{ padding: '12px' }}>{o.commissionRate || 10}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Placeholder Sections */}
                    {['reports', 'analytics', 'settings'].includes(activeSection) && (
                        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '40px', textAlign: 'center' }}>
                            <i className="fas fa-cogs fa-3x" style={{ color: 'var(--primary)', marginBottom: '16px' }}></i>
                            <h3>Section {getSectionTitle()} en développement</h3>
                            <p style={{ color: 'var(--gray-400)' }}>Cette page sera disponible prochainement dans la version React de SYGIM.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal Nouveau Locataire */}
            {isClientModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, fontFamily: 'Poppins, sans-serif' }}>
                    <div style={{ background: 'var(--surface)', padding: '24px', borderRadius: '14px', width: '90%', maxWidth: '450px', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0 }}>Nouveau Locataire</h3>
                            <button onClick={() => setIsClientModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--gray-400)' }}><i className="fas fa-times"></i></button>
                        </div>
                        <form onSubmit={handleAddClient}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                                <div className="form-group">
                                    <label>Prénom *</label>
                                    <input type="text" required value={newClient.firstName} onChange={(e) => setNewClient({ ...newClient, firstName: e.target.value })} style={{ width: '100%', padding: '8px' }} />
                                </div>
                                <div className="form-group">
                                    <label>Nom *</label>
                                    <input type="text" required value={newClient.lastName} onChange={(e) => setNewClient({ ...newClient, lastName: e.target.value })} style={{ width: '100%', padding: '8px' }} />
                                </div>
                            </div>
                            <div className="form-group" style={{ marginBottom: '12px' }}>
                                <label>Téléphone *</label>
                                <input type="text" required value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} style={{ width: '100%', padding: '8px' }} />
                            </div>
                            <div className="form-group" style={{ marginBottom: '12px' }}>
                                <label>Loyer dû mensuel</label>
                                <input type="number" required value={newClient.amountDue} onChange={(e) => setNewClient({ ...newClient, amountDue: parseInt(e.target.value) || 0 })} style={{ width: '100%', padding: '8px' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                                <button type="button" className="btn btn-outline" onClick={() => setIsClientModalOpen(false)}>Annuler</button>
                                <button type="submit" className="btn btn-primary">Enregistrer</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Nouveau Bien */}
            {isPropertyModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, fontFamily: 'Poppins, sans-serif' }}>
                    <div style={{ background: 'var(--surface)', padding: '24px', borderRadius: '14px', width: '90%', maxWidth: '450px', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0 }}>Nouveau Bien Immobilier</h3>
                            <button onClick={() => setIsPropertyModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--gray-400)' }}><i className="fas fa-times"></i></button>
                        </div>
                        <form onSubmit={handleAddProperty}>
                            <div className="form-group" style={{ marginBottom: '12px' }}>
                                <label>Nom du bien *</label>
                                <input type="text" required value={newProperty.name} onChange={(e) => setNewProperty({ ...newProperty, name: e.target.value })} style={{ width: '100%', padding: '8px' }} />
                            </div>
                            <div className="form-group" style={{ marginBottom: '12px' }}>
                                <label>Type *</label>
                                <select value={newProperty.type} onChange={(e) => setNewProperty({ ...newProperty, type: e.target.value })} style={{ width: '100%', padding: '8px' }}>
                                    <option value="Appartement">Appartement</option>
                                    <option value="Villa">Villa</option>
                                    <option value="Bureau">Bureau</option>
                                    <option value="Magasin">Magasin</option>
                                </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: '12px' }}>
                                <label>Adresse *</label>
                                <input type="text" required value={newProperty.address} onChange={(e) => setNewProperty({ ...newProperty, address: e.target.value })} style={{ width: '100%', padding: '8px' }} />
                            </div>
                            <div className="form-group" style={{ marginBottom: '12px' }}>
                                <label>Valeur estimée (XOF)</label>
                                <input type="number" value={newProperty.value} onChange={(e) => setNewProperty({ ...newProperty, value: parseInt(e.target.value) || 0 })} style={{ width: '100%', padding: '8px' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                                <button type="button" className="btn btn-outline" onClick={() => setIsPropertyModalOpen(false)}>Annuler</button>
                                <button type="submit" className="btn btn-primary">Enregistrer</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
