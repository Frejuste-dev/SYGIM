/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║        SYGIM — Interface Collecteur de Loyer (React)               ║
 * ║     Collecte terrain, encaissement rapide, signature et ajout      ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { API } from '../api/services';

export default function Collector() {
    const { user, logout } = useAuth();
    const { clients, properties, transactions, refreshData, setClients, setTransactions, setProperties } = useData();

    // UI state
    const [searchTerm, setSearchTerm] = useState('');
    const [isDark, setIsDark] = useState(document.body.classList.contains('dark-mode'));
    const [showOnlyAgent, setShowOnlyAgent] = useState(true);

    // Modals state
    const [activeModal, setActiveModal] = useState(null); // 'payment', 'signature', 'newTenant'
    const [selectedClient, setSelectedClient] = useState(null);

    // Payment form state
    const [paymentAmount, setPaymentAmount] = useState(0);
    const [paymentMethod, setPaymentMethod] = useState('');
    const [paymentReference, setPaymentReference] = useState('');

    // Signature state
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [signatureImg, setSignatureImg] = useState(null);

    // New tenant form state
    const [newTenant, setNewTenant] = useState({
        lastName: '',
        firstName: '',
        phone: '',
        email: '',
        address: '',
        propertyId: '',
        rent: 0,
        deposit: 0,
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]
    });

    const collectorKey = (user?.collectorName || '').toUpperCase();
    
    // Filter clients for this collector
    const baseClients = showOnlyAgent 
        ? clients.filter(c => (c.agent || '').toUpperCase() === collectorKey)
        : clients;

    const filteredClients = baseClients.filter(c => {
        const term = searchTerm.toLowerCase();
        return (
            (c.firstName || '').toLowerCase().includes(term) ||
            (c.lastName || '').toLowerCase().includes(term) ||
            (c.address || '').toLowerCase().includes(term) ||
            (c.phone || '').includes(term)
        );
    });

    // Stats
    const totalCollected = baseClients.reduce((sum, c) => sum + (c.amountPaid || 0), 0);
    const totalDue = baseClients.reduce((sum, c) => sum + (c.amountDue || 0), 0);
    const overdueCount = baseClients.filter(c => c.status === 'overdue' || c.status === 'pending').length;
    const collectionRate = totalDue > 0 ? Math.round((totalCollected / totalDue) * 100) : 0;

    const toggleTheme = () => {
        document.body.classList.toggle('dark-mode');
        setIsDark(document.body.classList.contains('dark-mode'));
    };

    // Payment logic
    const handleOpenPayment = (client) => {
        setSelectedClient(client);
        setPaymentAmount(client.amountDue - client.amountPaid);
        setPaymentMethod('');
        setPaymentReference('');
        setActiveModal('payment');
    };

    const handleSelectPaymentMethod = (method) => {
        setPaymentMethod(method);
    };

    const handleValidatePayment = () => {
        if (!paymentMethod) {
            alert('Veuillez sélectionner un mode de paiement.');
            return;
        }
        setActiveModal('signature');
    };

    // Signature drawing handlers
    const startDrawing = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        
        ctx.beginPath();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        ctx.moveTo(clientX - rect.left, clientY - rect.top);
        setIsDrawing(true);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        ctx.lineTo(clientX - rect.left, clientY - rect.top);
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
        const canvas = canvasRef.current;
        if (canvas) {
            setSignatureImg(canvas.toDataURL('image/png'));
        }
    };

    const clearSignature = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            setSignatureImg(null);
        }
    };

    const handleValidateSignature = async () => {
        if (!signatureImg) {
            alert('Veuillez fournir une signature.');
            return;
        }

        try {
            const txData = {
                clientId: selectedClient.id,
                amount: paymentAmount,
                method: paymentMethod,
                reference: paymentReference || `REC-${Date.now()}`,
                status: 'paid',
                type: 'rent',
                signature: signatureImg
            };

            const response = await API.Transactions.create(txData);
            if (response && response.success) {
                // Update client locally
                const updatedClients = clients.map(c => {
                    if (c.id === selectedClient.id) {
                        const paid = (c.amountPaid || 0) + paymentAmount;
                        return {
                            ...c,
                            amountPaid: paid,
                            status: paid >= c.amountDue ? 'paid' : 'partial'
                        };
                    }
                    return c;
                });
                setClients(updatedClients);

                // Add transaction locally
                const newTx = {
                    ...txData,
                    id: response.data?.id || `TRX-${Date.now()}`,
                    date: new Date().toLocaleDateString('fr-FR'),
                    client: `${selectedClient.lastName} ${selectedClient.firstName}`
                };
                setTransactions([newTx, ...transactions]);

                alert('Paiement enregistré avec succès !');
                setActiveModal(null);
                setSelectedClient(null);
                setSignatureImg(null);
            } else {
                alert('Erreur: ' + (response.error || 'Impossible d\'enregistrer la transaction'));
            }
        } catch (error) {
            alert('Erreur réseau lors de l\'enregistrement du paiement: ' + error.message);
        }
    };

    // New tenant logic
    const handleNewTenantChange = (field, value) => {
        setNewTenant(prev => {
            const next = { ...prev, [field]: value };
            if (field === 'propertyId') {
                const selectedProp = properties.find(p => p.id === parseInt(value));
                if (selectedProp) {
                    next.rent = selectedProp.rent || Math.round(selectedProp.value * 0.003) || 50000;
                    next.address = selectedProp.address;
                }
            }
            return next;
        });
    };

    const handleSaveNewTenant = async (e) => {
        e.preventDefault();
        const pId = parseInt(newTenant.propertyId);
        if (!newTenant.lastName || !newTenant.firstName || !newTenant.phone || !pId || !newTenant.rent) {
            alert('Veuillez remplir tous les champs obligatoires.');
            return;
        }

        try {
            const clientData = {
                firstName: newTenant.firstName,
                lastName: newTenant.lastName,
                phone: newTenant.phone,
                email: newTenant.email || null,
                address: newTenant.address || null,
                property_id: pId,
                amount_due: newTenant.rent,
                amount_paid: 0,
                status: 'pending',
                deposit: newTenant.deposit || 0,
                contract_start: newTenant.startDate,
                contract_end: newTenant.endDate || null
            };

            const response = await API.Clients.create(clientData);
            if (response && response.success) {
                const addedTenant = {
                    id: response.data?.id,
                    firstName: newTenant.firstName,
                    lastName: newTenant.lastName,
                    phone: newTenant.phone,
                    email: newTenant.email || '',
                    address: newTenant.address || '',
                    amountDue: newTenant.rent,
                    amountPaid: 0,
                    status: 'pending',
                    property: properties.find(p => p.id === pId)?.name || '',
                    joinDate: new Date().toLocaleDateString('fr-FR'),
                    agent: user?.collectorName || ''
                };
                
                // Add to states
                setClients([addedTenant, ...clients]);

                // Update property status
                const updatedProps = properties.map(p => {
                    if (p.id === pId) {
                        return { ...p, status: 'loue', tenantId: response.data?.id };
                    }
                    return p;
                });
                setProperties(updatedProps);

                alert(`Locataire "${newTenant.firstName} ${newTenant.lastName}" créé avec succès !`);
                setActiveModal(null);
                setNewTenant({
                    lastName: '',
                    firstName: '',
                    phone: '',
                    email: '',
                    address: '',
                    propertyId: '',
                    rent: 0,
                    deposit: 0,
                    startDate: new Date().toISOString().split('T')[0],
                    endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]
                });
            } else {
                alert('Erreur: ' + (response.error || 'Impossible d\'ajouter le locataire'));
            }
        } catch (err) {
            alert('Erreur lors de la création du locataire: ' + err.message);
        }
    };

    return (
        <div className="collector-main" style={{ display: 'block', minHeight: '100vh' }}>
            <div className="main-content">
                <div className="header">
                    <h1 className="header-title" id="collectorPageTitle">Interface Récolteur de Loyer</h1>
                    <div className="header-actions">
                        <button className="btn btn-secondary" onClick={toggleTheme} title="Thème sombre/clair">
                            <i className={isDark ? "fas fa-sun" : "fas fa-moon"}></i>
                        </button>
                        <div className="user-profile">
                            <div className="avatar" id="collectorAvatar">
                                {user?.displayName?.slice(0, 2).toUpperCase() || 'RC'}
                            </div>
                            <div>
                                <div id="collectorName" style={{ fontWeight: 600 }}>{user?.displayName || 'Récolteur'}</div>
                                <div id="collectorAgentBadge" style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: '600' }}>
                                    Agent récolteur · {baseClients.length} locataires
                                </div>
                                <button className="btn btn-outline btn-small" onClick={logout} style={{ marginTop: '4px' }}>
                                    <i className="fas fa-sign-out-alt"></i> Déconnexion
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="collector-search" style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    <input 
                        type="text" 
                        placeholder="Rechercher un locataire..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ flex: 1, minWidth: '200px' }}
                    />
                    <button className={`btn ${showOnlyAgent ? 'btn-primary' : 'btn-outline'}`} onClick={() => setShowOnlyAgent(true)}>
                        Mes locataires
                    </button>
                    <button className={`btn ${!showOnlyAgent ? 'btn-primary' : 'btn-outline'}`} onClick={() => setShowOnlyAgent(false)}>
                        Tous
                    </button>
                    <button className="btn btn-success" onClick={() => setActiveModal('newTenant')}>
                        <i className="fas fa-user-plus"></i> Ajouter locataire
                    </button>
                    <button className="btn btn-outline" onClick={() => { refreshData(); refreshData(); }} title="Synchroniser"><i className="fas fa-sync"></i> Sync</button>
                </div>

                {/* Stats panel */}
                <div id="collectorAgentBanner" style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 20px', marginBottom: '16px', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyOrigin: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '16px' }}>
                            {user?.displayName?.slice(0, 1).toUpperCase() || 'K'}
                        </div>
                        <div>
                            <div style={{ fontWeight: '600', fontSize: '15px' }}>{user?.displayName}</div>
                            <div style={{ fontSize: '12px', color: 'var(--gray-400)' }}>Collecte terrain</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '24px', marginLeft: 'auto', flexWrap: 'wrap' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--primary)' }}>{baseClients.length}</div>
                            <div style={{ fontSize: '11px', color: 'var(--gray-400)' }}>Locataires</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--success)' }}>{totalCollected.toLocaleString()}</div>
                            <div style={{ fontSize: '11px', color: 'var(--gray-400)' }}>Encaissé (XOF)</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--danger)' }}>{overdueCount}</div>
                            <div style={{ fontSize: '11px', color: 'var(--gray-400)' }}>En retard</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--warning)' }}>{collectionRate}%</div>
                            <div style={{ fontSize: '11px', color: 'var(--gray-400)' }}>Recouvrement</div>
                        </div>
                    </div>
                </div>

                <div className="alert info">
                    <i className="fas fa-info-circle"></i>
                    <div id="collectorAlertMsg">Bonjour {user?.displayName} ! Interface optimisée pour la collecte de loyer en direct.</div>
                </div>

                {/* Clients Grid */}
                <div className="collector-container">
                    <div className="collector-client-list">
                        {filteredClients.length > 0 ? (
                            filteredClients.map(client => {
                                const remaining = (client.amountDue || 0) - (client.amountPaid || 0);
                                return (
                                    <div key={client.id} className={`client-card ${client.status || 'pending'}`}>
                                        <div className="client-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                            <div className="client-name" style={{ fontWeight: '600' }}>{client.lastName} {client.firstName}</div>
                                            <span className={`status-badge ${client.status === 'paid' ? 'paid' : (client.status === 'partial' ? 'partial' : 'overdue')}`}>
                                                {client.status === 'paid' ? 'Payé' : (client.status === 'partial' ? 'Partiel' : 'Non Payé')}
                                            </span>
                                        </div>
                                        <div className="client-details" style={{ fontSize: '13px', color: 'var(--gray-400)', marginBottom: '12px' }}>
                                            <div className="client-detail" style={{ marginBottom: '4px' }}>
                                                <i className="fas fa-map-marker-alt" style={{ marginRight: '8px' }}></i>
                                                <span>{client.address || 'Aucune adresse'}</span>
                                            </div>
                                            <div className="client-detail">
                                                <i className="fas fa-phone" style={{ marginRight: '8px' }}></i>
                                                <span>{client.phone}</span>
                                            </div>
                                        </div>
                                        <div className="payment-section" style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                                                <span>Loyer mensuel:</span>
                                                <span style={{ fontWeight: '600' }}>{client.amountDue?.toLocaleString()} XOF</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                                                <span>Montant payé:</span>
                                                <span style={{ fontWeight: '600', color: 'var(--success)' }}>{client.amountPaid?.toLocaleString()} XOF</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '12px' }}>
                                                <span>Reste à payer:</span>
                                                <span style={{ fontWeight: '600', color: 'var(--danger)' }}>{remaining.toLocaleString()} XOF</span>
                                            </div>
                                            {remaining > 0 && (
                                                <button className="btn btn-primary btn-full" onClick={() => handleOpenPayment(client)}>
                                                    <i className="fas fa-plus-circle"></i> Enregistrer un paiement
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div style={{ padding: '40px', textAlign: 'center', width: '100%', color: 'var(--gray-400)' }}>
                                Aucun locataire trouvé.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Payment Modal */}
            {activeModal === 'payment' && selectedClient && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, fontFamily: 'Poppins, sans-serif' }}>
                    <div style={{ background: 'var(--surface)', padding: '24px', borderRadius: '14px', width: '90%', maxWidth: '450px', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0 }}>Enregistrer Paiement</h3>
                            <button onClick={() => setActiveModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--gray-400)' }}><i className="fas fa-times"></i></button>
                        </div>
                        <div className="form-group" style={{ marginBottom: '15px' }}>
                            <label>Montant du paiement</label>
                            <input 
                                type="number" 
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(parseInt(e.target.value) || 0)}
                                style={{ width: '100%', padding: '10px', fontSize: '18px', fontWeight: 'bold', textAlign: 'center', borderRadius: '8px', border: '1px solid var(--border)' }}
                            />
                        </div>
                        <div className="form-group" style={{ marginBottom: '15px' }}>
                            <label>Mode de paiement *</label>
                            <div className="payment-methods" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                {[
                                    { id: 'wave', name: 'Wave', icon: 'fa-money-bill' },
                                    { id: 'om', name: 'Orange Money', icon: 'fa-mobile-screen-button' },
                                    { id: 'cash', name: 'Espèces', icon: 'fa-money-bill-wave' },
                                    { id: 'cheque', name: 'Chèque', icon: 'fa-money-check' }
                                ].map(m => (
                                    <div 
                                        key={m.id} 
                                        className={`payment-method ${paymentMethod === m.id ? 'active' : ''}`}
                                        onClick={() => handleSelectPaymentMethod(m.id)}
                                        style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: '8px', textAlign: 'center', cursor: 'pointer', background: paymentMethod === m.id ? 'rgba(99, 102, 241, 0.1)' : 'none', color: paymentMethod === m.id ? 'var(--primary)' : 'inherit' }}
                                    >
                                        <i className={`fas ${m.icon}`} style={{ display: 'block', fontSize: '18px', marginBottom: '4px' }}></i>
                                        <span>{m.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="form-group" style={{ marginBottom: '20px' }}>
                            <label>Notes / Référence</label>
                            <input 
                                type="text" 
                                value={paymentReference}
                                onChange={(e) => setPaymentReference(e.target.value)}
                                placeholder="ex. Wave Ref #..."
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}
                            />
                        </div>
                        <button className="btn btn-success btn-full" onClick={handleValidatePayment}>
                            <i className="fas fa-check-circle"></i> Valider et Passer à la signature
                        </button>
                    </div>
                </div>
            )}

            {/* Signature Modal */}
            {activeModal === 'signature' && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, fontFamily: 'Poppins, sans-serif' }}>
                    <div style={{ background: 'var(--surface)', padding: '24px', borderRadius: '14px', width: '90%', maxWidth: '450px', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h3 style={{ margin: 0 }}>Signature Électronique</h3>
                            <button onClick={() => setActiveModal('payment')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--gray-400)' }}><i className="fas fa-times"></i></button>
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--gray-400)', marginBottom: '10px' }}>Veuillez demander au locataire de signer dans le cadre ci-dessous.</p>
                        <div 
                            id="signatureContainer" 
                            style={{ width: '100%', height: '160px', border: '2px dashed var(--border)', borderRadius: '8px', position: 'relative', overflow: 'hidden', background: '#fff' }}
                        >
                            <canvas 
                                ref={canvasRef}
                                width="400"
                                height="160"
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                                onTouchStart={startDrawing}
                                onTouchMove={draw}
                                onTouchEnd={stopDrawing}
                                style={{ width: '100%', height: '100%', cursor: 'crosshair', display: 'block' }}
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', margin: '15px 0' }}>
                            <button className="btn btn-outline btn-small" onClick={clearSignature}><i className="fas fa-eraser"></i> Effacer</button>
                            <span style={{ fontSize: '12px', color: 'var(--success)', alignSelf: 'center' }}>
                                {signatureImg ? '✓ Signé' : 'Dessinez votre signature'}
                            </span>
                        </div>
                        <button className="btn btn-primary btn-full" onClick={handleValidateSignature}>
                            <i className="fas fa-check"></i> Enregistrer et finaliser
                        </button>
                    </div>
                </div>
            )}

            {/* New Tenant Modal */}
            {activeModal === 'newTenant' && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, fontFamily: 'Poppins, sans-serif' }}>
                    <div style={{ background: 'var(--surface)', padding: '24px', borderRadius: '14px', width: '90%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0 }}>Ajouter un Locataire</h3>
                            <button onClick={() => setActiveModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--gray-400)' }}><i className="fas fa-times"></i></button>
                        </div>
                        <form onSubmit={handleSaveNewTenant}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                                <div className="form-group">
                                    <label>Prénom *</label>
                                    <input 
                                        type="text" 
                                        required 
                                        value={newTenant.firstName} 
                                        onChange={(e) => handleNewTenantChange('firstName', e.target.value)} 
                                        style={{ width: '100%', padding: '8px' }}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Nom *</label>
                                    <input 
                                        type="text" 
                                        required 
                                        value={newTenant.lastName} 
                                        onChange={(e) => handleNewTenantChange('lastName', e.target.value)} 
                                        style={{ width: '100%', padding: '8px' }}
                                    />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                                <div className="form-group">
                                    <label>Téléphone *</label>
                                    <input 
                                        type="text" 
                                        required 
                                        value={newTenant.phone} 
                                        onChange={(e) => handleNewTenantChange('phone', e.target.value)} 
                                        style={{ width: '100%', padding: '8px' }}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Email</label>
                                    <input 
                                        type="email" 
                                        value={newTenant.email} 
                                        onChange={(e) => handleNewTenantChange('email', e.target.value)} 
                                        style={{ width: '100%', padding: '8px' }}
                                    />
                                </div>
                            </div>
                            <div className="form-group" style={{ marginBottom: '12px' }}>
                                <label>Bien disponible *</label>
                                <select 
                                    required 
                                    value={newTenant.propertyId} 
                                    onChange={(e) => handleNewTenantChange('propertyId', e.target.value)}
                                    style={{ width: '100%', padding: '8px' }}
                                >
                                    <option value="">-- Choisir un bien disponible --</option>
                                    {properties.filter(p => p.status === 'vacant' || p.status === 'en_renovation' || !p.tenantId).map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} - {p.address} ({p.type})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                                <div className="form-group">
                                    <label>Loyer mensuel *</label>
                                    <input 
                                        type="number" 
                                        required 
                                        value={newTenant.rent} 
                                        onChange={(e) => handleNewTenantChange('rent', parseInt(e.target.value) || 0)} 
                                        style={{ width: '100%', padding: '8px' }}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Caution (XOF)</label>
                                    <input 
                                        type="number" 
                                        value={newTenant.deposit} 
                                        onChange={(e) => handleNewTenantChange('deposit', parseInt(e.target.value) || 0)} 
                                        style={{ width: '100%', padding: '8px' }}
                                    />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                                <div className="form-group">
                                    <label>Date début *</label>
                                    <input 
                                        type="date" 
                                        required 
                                        value={newTenant.startDate} 
                                        onChange={(e) => handleNewTenantChange('startDate', e.target.value)} 
                                        style={{ width: '100%', padding: '8px' }}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Date fin</label>
                                    <input 
                                        type="date" 
                                        value={newTenant.endDate} 
                                        onChange={(e) => handleNewTenantChange('endDate', e.target.value)} 
                                        style={{ width: '100%', padding: '8px' }}
                                    />
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                <button type="button" className="btn btn-outline" onClick={() => setActiveModal(null)}>Annuler</button>
                                <button type="submit" className="btn btn-primary">Enregistrer</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
