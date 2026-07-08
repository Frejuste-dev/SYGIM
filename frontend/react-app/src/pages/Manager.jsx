/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║        SYGIM — Responsable des Récolteurs (React)                 ║
 * ║     Supervision des récolteurs, attribution des biens et stats      ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { API } from '../api/services';

export default function Manager() {
    const { user, logout } = useAuth();
    const { collectors, properties, refreshData, setCollectors, setProperties } = useData();

    // Tab state
    const [activeTab, setActiveTab] = useState('collectors');
    const [isDark, setIsDark] = useState(document.body.classList.contains('dark-mode'));

    // Assignment state
    const [selectedCollectorId, setSelectedCollectorId] = useState('');
    const [assignSearch, setAssignSearch] = useState('');

    const toggleTheme = () => {
        document.body.classList.toggle('dark-mode');
        setIsDark(document.body.classList.contains('dark-mode'));
    };

    // Filter properties for assignment
    const unassignedProperties = properties.filter(p => !p.collectorId);
    
    const filteredProperties = unassignedProperties.filter(p => {
        const term = assignSearch.toLowerCase();
        return (
            (p.name || '').toLowerCase().includes(term) ||
            (p.address || '').toLowerCase().includes(term) ||
            (p.type || '').toLowerCase().includes(term)
        );
    });

    const handleAssignProperty = async (propertyId) => {
        if (!selectedCollectorId) {
            alert('Veuillez sélectionner un récolteur à qui assigner ce bien.');
            return;
        }

        try {
            const resp = await API.Collectors.assignProperties(selectedCollectorId, [propertyId]);
            if (resp.success) {
                // Update local states
                const updatedProps = properties.map(p => {
                    if (p.id === propertyId) {
                        return { ...p, collectorId: parseInt(selectedCollectorId) };
                    }
                    return p;
                });
                setProperties(updatedProps);

                // Update collector locally
                const updatedCollectors = collectors.map(c => {
                    if (c.id === parseInt(selectedCollectorId)) {
                        const currentAssigned = c.assignedProperties || [];
                        return { ...c, assignedProperties: [...currentAssigned, propertyId] };
                    }
                    return c;
                });
                setCollectors(updatedCollectors);

                alert('Bien immobilier assigné avec succès !');
            } else {
                alert('Erreur lors de l\'attribution: ' + resp.error);
            }
        } catch (err) {
            alert('Erreur réseau lors de l\'attribution: ' + err.message);
        }
    };

    return (
        <div className="collector-main" style={{ display: 'block', minHeight: '100vh' }}>
            <div className="main-content">
                <div className="header">
                    <h1 className="header-title">Interface Responsable des Récolteurs</h1>
                    <div className="header-actions">
                        <button className="btn btn-secondary" onClick={toggleTheme} title="Thème sombre/clair">
                            <i className={isDark ? "fas fa-sun" : "fas fa-moon"}></i>
                        </button>
                        <div className="user-profile">
                            <div className="avatar">RR</div>
                            <div>
                                <div style={{ fontWeight: 600 }}>{user?.displayName || 'Responsable'}</div>
                                <div style={{ fontSize: '12px', color: 'var(--gray-400)' }}>Gestion d'équipe</div>
                                <button className="btn btn-outline btn-small" onClick={logout} style={{ marginTop: '4px' }}>
                                    <i className="fas fa-sign-out-alt"></i> Déconnexion
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="alert info">
                    <i className="fas fa-users-cog"></i>
                    <div><strong>Gestion des récolteurs</strong> - Vous pouvez assigner des biens immobiliers aux agents et suivre leurs performances de recouvrement.</div>
                </div>

                {/* Tabs */}
                <div className="tabs" style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border)' }}>
                    <button className={`tab btn ${activeTab === 'collectors' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('collectors')}>
                        Gestion des récolteurs
                    </button>
                    <button className={`tab btn ${activeTab === 'assignment' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('assignment')}>
                        Attribution des biens
                    </button>
                    <button className={`tab btn ${activeTab === 'performance' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('performance')}>
                        Performance
                    </button>
                </div>

                {/* TAB content: collectors list */}
                {activeTab === 'collectors' && (
                    <div className="tab-content active" style={{ padding: '10px 0' }}>
                        <div className="collector-assignment-section">
                            <h3 style={{ color: 'var(--primary)', marginBottom: '16px' }}>Liste des récolteurs</h3>
                            
                            <div className="collector-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                                {collectors.length > 0 ? (
                                    collectors.map(c => {
                                        const cProps = properties.filter(p => p.collectorId === c.id);
                                        return (
                                            <div key={c.id} className="collector-assignment-card" style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', background: 'var(--surface)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                                    <div style={{ width: '42px', height: '42px', background: 'var(--primary-light)', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                                        {(c.lastName?.slice(0, 1) + c.firstName?.slice(0, 1)).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <h4 style={{ margin: 0 }}>{c.lastName} {c.firstName}</h4>
                                                        <small style={{ color: 'var(--gray-400)' }}>Portefeuille : {cProps.length} biens</small>
                                                    </div>
                                                </div>
                                                <div style={{ fontSize: '13px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                                                    <strong>Biens assignés :</strong>
                                                    <ul style={{ paddingLeft: '20px', marginTop: '6px', maxHeight: '100px', overflowY: 'auto' }}>
                                                        {cProps.length > 0 ? (
                                                            cProps.map(p => <li key={p.id}>{p.name} - {p.address}</li>)
                                                        ) : (
                                                            <li style={{ color: 'var(--gray-400)', listStyleType: 'none', marginLeft: '-20px' }}>Aucun bien attribué</li>
                                                        )}
                                                    </ul>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: 'var(--gray-400)' }}>
                                        Aucun agent récolteur enregistré.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB content: property assignment */}
                {activeTab === 'assignment' && (
                    <div className="tab-content active" style={{ padding: '10px 0' }}>
                        <div className="available-properties-section" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
                            <h3 style={{ color: 'var(--primary)', marginBottom: '16px' }}>Biens immobiliers disponibles à assigner</h3>

                            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
                                <select 
                                    value={selectedCollectorId} 
                                    onChange={(e) => setSelectedCollectorId(e.target.value)}
                                    style={{ flex: 1, minWidth: '200px', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'inherit' }}
                                >
                                    <option value="">-- Sélectionner l'agent récolteur --</option>
                                    {collectors.map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.lastName} {c.firstName}
                                        </option>
                                    ))}
                                </select>
                                <input 
                                    type="text" 
                                    placeholder="Filtrer les biens..." 
                                    value={assignSearch}
                                    onChange={(e) => setAssignSearch(e.target.value)}
                                    style={{ flex: 1, minWidth: '200px', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}
                                />
                            </div>

                            <div className="admin-table-wrapper" style={{ overflowX: 'auto' }}>
                                <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                                            <th style={{ padding: '12px' }}>Bien</th>
                                            <th style={{ padding: '12px' }}>Type</th>
                                            <th style={{ padding: '12px' }}>Adresse</th>
                                            <th style={{ padding: '12px' }}>Valeur</th>
                                            <th style={{ padding: '12px' }}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredProperties.length > 0 ? (
                                            filteredProperties.map(p => (
                                                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                    <td style={{ padding: '12px', fontWeight: '500' }}>{p.name}</td>
                                                    <td style={{ padding: '12px' }}>{p.type}</td>
                                                    <td style={{ padding: '12px' }}>{p.address}</td>
                                                    <td style={{ padding: '12px' }}>{(p.value || 0).toLocaleString()} XOF</td>
                                                    <td style={{ padding: '12px' }}>
                                                        <button 
                                                            className="btn btn-primary btn-small"
                                                            onClick={() => handleAssignProperty(p.id)}
                                                            disabled={!selectedCollectorId}
                                                        >
                                                            Attribuer
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: 'var(--gray-400)' }}>
                                                    Aucun bien disponible trouvé.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB content: performance */}
                {activeTab === 'performance' && (
                    <div className="tab-content active" style={{ padding: '10px 0' }}>
                        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
                            <h3 style={{ color: 'var(--primary)', marginBottom: '16px' }}>Suivi des performances de recouvrement</h3>
                            <p style={{ color: 'var(--gray-400)' }}>Statistiques d'efficacité par récolteur sur le terrain.</p>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginTop: '20px' }}>
                                {collectors.map(c => {
                                    const rate = Math.round(50 + Math.random() * 45); // Simulation
                                    return (
                                        <div key={c.id} style={{ padding: '15px', border: '1px solid var(--border)', borderRadius: '8px' }}>
                                            <div style={{ fontWeight: '600', marginBottom: '8px' }}>{c.lastName} {c.firstName}</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{ flex: 1, height: '8px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                                                    <div style={{ width: `${rate}%`, height: '100%', background: 'var(--success)' }}></div>
                                                </div>
                                                <span style={{ fontWeight: 'bold' }}>{rate}%</span>
                                            </div>
                                            <small style={{ color: 'var(--gray-400)', display: 'block', marginTop: '6px' }}>Taux de recouvrement du mois</small>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
