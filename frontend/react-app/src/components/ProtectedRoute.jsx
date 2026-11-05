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
            <div className="flex flex-col justify-center items-center h-screen bg-slate-900 text-white font-sans">
                <i className="fas fa-building fa-bounce fa-3x text-indigo-500 mb-5"></i>
                <div className="text-lg font-medium">Chargement de SYGIM...</div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        // Redirection vers la page appropriee selon le role
        const ROLE_HOME = {
            admin:             '/admin/dashboard',
            super_admin:       '/admin/dashboard',
            director:          '/admin/dashboard',
            accounting:        '/admin/dashboard',
            gestionnaire:      '/admin/dashboard',
            collector_manager: '/admin/manager',
            collector:         '/admin/collector',
        };
        const home = ROLE_HOME[user.role] || '/admin/dashboard';
        return <Navigate to={home} replace />;
    }

    return children;
}
