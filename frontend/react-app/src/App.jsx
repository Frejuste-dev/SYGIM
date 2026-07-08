/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║        SYGIM — Point d'Entrée Application React                    ║
 * ║     Configuration du Routage, des Contextes et Route Guards        ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import Login from './pages/Login';
import Admin from './pages/Admin';
import Collector from './pages/Collector';
import Manager from './pages/Manager';
import Dashboard from './pages/Dashboard';

export default function App() {
    return (
        <AuthProvider>
            <DataProvider>
                <BrowserRouter>
                    <Routes>
                        {/* Auth Page */}
                        <Route path="/login" element={<Login />} />

                        {/* Admin Route */}
                        <Route 
                            path="/admin" 
                            element={
                                <ProtectedRoute allowedRoles={['admin']}>
                                    <Admin />
                                </ProtectedRoute>
                            } 
                        />

                        {/* Collector Route */}
                        <Route 
                            path="/collector" 
                            element={
                                <ProtectedRoute allowedRoles={['collector']}>
                                    <Collector />
                                </ProtectedRoute>
                            } 
                        />

                        {/* Collector Manager Route */}
                        <Route 
                            path="/manager" 
                            element={
                                <ProtectedRoute allowedRoles={['collector_manager']}>
                                    <Manager />
                                </ProtectedRoute>
                            } 
                        />

                        {/* General Dashboard (Director & Accountant) Route */}
                        <Route 
                            path="/dashboard" 
                            element={
                                <ProtectedRoute allowedRoles={['director', 'accounting']}>
                                    <Dashboard />
                                </ProtectedRoute>
                            } 
                        />

                        {/* Default Redirection Route */}
                        <Route path="*" element={<Navigate to="/login" replace />} />
                    </Routes>
                </BrowserRouter>
            </DataProvider>
        </AuthProvider>
    );
}
