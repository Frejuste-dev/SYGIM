import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import AdminDashboard from './AdminDashboard';
import AccountingDashboard from './AccountingDashboard';

export default function Dashboard() {
  const { user } = useAuth();

  if (user?.role === 'comptable' || user?.role === 'accounting') {
    return <AccountingDashboard />;
  }
  
  // Par défaut, l'AdminDashboard gère aussi les autres rôles avec les données globales 
  // (admin, super_admin, etc.)
  return <AdminDashboard />;
}
