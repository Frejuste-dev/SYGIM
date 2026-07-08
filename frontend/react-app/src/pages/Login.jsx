/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║        SYGIM — Page de Connexion (React)                          ║
 * ║     Authentification des utilisateurs et routage par rôle          ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */

import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleLogin = async () => {
        if (!username.trim() || !password) {
            setError('Veuillez entrer votre nom et votre mot de passe.');
            return;
        }

        setError('');
        setLoading(true);

        try {
            const result = await login(username.trim(), password);
            setLoading(false);

            if (result.success) {
                const userType = result.user.role;
                if (userType === 'admin') {
                    navigate('/admin');
                } else if (userType === 'collector') {
                    navigate('/collector');
                } else if (userType === 'collector_manager') {
                    navigate('/manager');
                } else {
                    navigate('/dashboard');
                }
            } else {
                setError(result.error || 'Identifiants incorrects.');
            }
        } catch (err) {
            setLoading(false);
            setError(err.message || 'Erreur lors de la connexion.');
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleLogin();
        }
    };

    return (
        <div className="auth-container" id="authContainer">
            <div className="auth-section auth-left">
                <div className="auth-logo-large">
                    <i className="fas fa-building"></i>
                </div>
                <h1 className="auth-title-large">SYGIM</h1>
                <p className="auth-subtitle" style={{ marginTop: '12px' }}>Système de Gestion Immobilière</p>
                <p style={{ opacity: 0.85, fontSize: '14px', marginTop: '60px', maxWidth: '320px', lineHeight: 1.7 }}>
                    Gerez vos proprietes, clients et finances en toute simplicite
                </p>
            </div>

            <div className="auth-section auth-right">
                <div className="auth-form">
                    <h2>Bienvenue</h2>
                    <p className="subtitle">Connectez-vous à votre compte</p>

                    {error && (
                        <div className="alert-error show" id="alertError" style={{ display: 'block', marginBottom: '16px' }}>
                            <i className="fas fa-exclamation-circle" style={{ marginRight: '8px' }}></i>
                            {error}
                        </div>
                    )}

                    <div className="form-group">
                        <label htmlFor="loginUsername">Nom</label>
                        <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', fontSize: '15px', pointerEvents: 'none' }}>
                                <i className="fas fa-user"></i>
                            </span>
                            <input 
                                type="text" 
                                id="loginUsername" 
                                placeholder="Votre nom" 
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                onKeyDown={handleKeyDown}
                                autoComplete="username" 
                                style={{ paddingLeft: '38px' }} 
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="loginPassword">Mot de passe</label>
                        <div style={{ position: 'relative' }}>
                            <input 
                                type={showPassword ? "text" : "password"} 
                                id="loginPassword" 
                                placeholder="Mot de passe"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyDown={handleKeyDown}
                                style={{ paddingRight: '44px' }} 
                            />
                            <button 
                                type="button" 
                                onClick={() => setShowPassword(!showPassword)}
                                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', fontSize: '16px' }}
                            >
                                <i className={showPassword ? "fas fa-eye-slash" : "fas fa-eye"}></i>
                            </button>
                        </div>
                    </div>

                    <button 
                        className="btn btn-primary" 
                        onClick={handleLogin} 
                        disabled={loading}
                        style={{ width: '100%', marginTop: '8px' }}
                    >
                        {loading ? (
                            <>
                                <i className="fas fa-spinner fa-spin" style={{ marginRight: '8px' }}></i> Connexion...
                            </>
                        ) : (
                            <>
                                <i className="fas fa-sign-in-alt" style={{ marginRight: '8px' }}></i> Se connecter
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
