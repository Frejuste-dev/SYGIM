/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║        SYGIM — Route Protégée (Rôle-based Access Control)         ║
 * ║     Filtre l'accès aux pages selon l'état de connexion et le rôle  ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children, allowedRoles }) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div style={{ 
                display: 'flex', 
                flexDirection: 'column',
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '100vh', 
                background: '#0f172a', // var(--dark)
                color: 'white',
                fontFamily: 'Poppins, sans-serif'
            }}>
                <i className="fas fa-building fa-bounce fa-3x" style={{ color: '#6366f1', marginBottom: '20px' }}></i>
                <div style={{ fontSize: '18px', fontWeight: '500' }}>Chargement de SYGIM...</div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        // Redirection vers la page appropriée selon le rôle
        if (user.role === 'admin') {
            return <Navigate to="/admin" replace />;
        } else if (user.role === 'collector') {
            return <Navigate to="/collector" replace />;
        } else if (user.role === 'collector_manager') {
            return <Navigate to="/manager" replace />;
        } else {
            return <Navigate to="/dashboard" replace />;
        }
    }

    return children;
}
