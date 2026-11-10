/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║        SYGIM — Point d'Entrée Application React                    ║
 * ║     Configuration du Routage, des Contextes et Route Guards        ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './components/ToastContext';
import { ConfirmProvider } from './components/ConfirmContext';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import Login from './pages/Login';
import Admin from './pages/Admin';
import Users from './pages/Users';
import Collector from './pages/Collector';
import Manager from './pages/Manager';
import Dashboard from './pages/Dashboard';
import Properties from './pages/Properties';
import Owners from './pages/Owners';
import Clients from './pages/Clients';
import Transactions from './pages/Transactions';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import Activity from './pages/Activity';

export default function App() {
    return (
        <AuthProvider>
            <ToastProvider>
                <ConfirmProvider>
                    <BrowserRouter>
                        <Routes>
                        {/* Auth Page */}
                        <Route path="/login" element={<Login />} />

                        {/* Admin Route with Nested Pages */}
                        <Route 
                            path="/admin" 
                            element={
                                <ProtectedRoute allowedRoles={['admin', 'super_admin', 'director', 'accounting', 'gestionnaire', 'collector_manager', 'collector']}>
                                    <Admin />
                                </ProtectedRoute>
                            } 
                        >
                            <Route index element={<Navigate to="/admin/dashboard" replace />} />
                            
                            {/* General Dashboard (Director & Accountant) Route */}
                            <Route 
                                path="dashboard" 
                                element={
                                    <ProtectedRoute allowedRoles={['admin', 'super_admin', 'director', 'accounting', 'gestionnaire', 'collector_manager', 'collector']}>
                                        <Dashboard />
                                    </ProtectedRoute>
                                } 
                            />

                            {/* Users Route */}
                            <Route 
                                path="users" 
                                element={
                                    <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                                        {/* Import Users dynamically or statically, we'll assume it's imported at top */}
                                        <Users />
                                    </ProtectedRoute>
                                } 
                            />

                            {/* Properties Route */}
                            <Route 
                                path="properties" 
                                element={
                                    <ProtectedRoute allowedRoles={['admin', 'super_admin', 'director', 'accounting', 'collector_manager', 'gestionnaire']}>
                                        <Properties />
                                    </ProtectedRoute>
                                } 
                            />

                            {/* Owners Route */}
                            <Route 
                                path="owners" 
                                element={
                                    <ProtectedRoute allowedRoles={['admin', 'super_admin', 'director', 'accounting', 'collector_manager', 'gestionnaire']}>
                                        <Owners />
                                    </ProtectedRoute>
                                } 
                            />

                            {/* Clients / Tenants Route */}
                            <Route 
                                path="clients" 
                                element={
                                    <ProtectedRoute allowedRoles={['admin', 'super_admin', 'director', 'accounting', 'collector_manager', 'gestionnaire']}>
                                        <Clients />
                                    </ProtectedRoute>
                                } 
                            />

                            {/* Transactions Route */}
                            <Route 
                                path="transactions" 
                                element={
                                    <ProtectedRoute allowedRoles={['admin', 'super_admin', 'director', 'accounting', 'collector_manager', 'gestionnaire']}>
                                        <Transactions />
                                    </ProtectedRoute>
                                } 
                            />

                            {/* Reports Route */}
                            <Route 
                                path="reports" 
                                element={
                                    <ProtectedRoute allowedRoles={['admin', 'super_admin', 'director', 'accounting']}>
                                        <Reports />
                                    </ProtectedRoute>
                                } 
                            />

                            {/* Settings Route */}
                            <Route 
                                path="settings" 
                                element={
                                    <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                                        <Settings />
                                    </ProtectedRoute>
                                } 
                            />

                            {/* Activity Route */}
                            <Route 
                                path="activity" 
                                element={
                                    <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                                        <Activity />
                                    </ProtectedRoute>
                                } 
                            />

                            {/* Profile Route */}
                            <Route 
                                path="profile" 
                                element={
                                    <ProtectedRoute allowedRoles={['admin', 'super_admin', 'director', 'accounting', 'collector_manager', 'collector', 'gestionnaire']}>
                                        <Profile />
                                    </ProtectedRoute>
                                } 
                            />

                            {/* Collector Route (Legacy / Dedicated layout if any) */}
                            <Route 
                                path="collector" 
                                element={
                                    <ProtectedRoute allowedRoles={['collector', 'collector_manager', 'admin', 'super_admin']}>
                                        <Collector />
                                    </ProtectedRoute>
                                } 
                            />

                            {/* Collector Manager Route (Legacy / Dedicated layout if any) */}
                            <Route 
                                path="manager" 
                                element={
                                    <ProtectedRoute allowedRoles={['collector_manager', 'admin', 'super_admin']}>
                                        <Manager />
                                    </ProtectedRoute>
                                } 
                            />
                        </Route>

                        {/* Default Redirection Route */}
                        <Route path="*" element={<Navigate to="/login" replace />} />
                    </Routes>
                    </BrowserRouter>
                </ConfirmProvider>
            </ToastProvider>
        </AuthProvider>
    );
}
