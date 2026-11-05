import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import AuthBranding from '../components/AuthBranding';
import LoginForm from '../components/LoginForm';
import { CONFIG } from '../api/config';

const ROLE_ROUTES = {
  admin:             '/admin/dashboard',
  super_admin:       '/admin/dashboard',
  director:          '/admin/dashboard',
  accounting:        '/admin/dashboard',
  gestionnaire:      '/admin/dashboard',
  collector_manager: '/admin/manager',
  collector:         '/admin/collector',
};

const ERROR_MAP = {
  LOCKED: 'Compte temporairement indisponible, contactez un administrateur.',
  RATE_LIMIT: 'Trop de tentatives de connexion. Réessayez dans une heure.',
};

const REMEMBER_KEY = 'sygim_remembered_user';

export default function Login() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const remembered = localStorage.getItem(REMEMBER_KEY) || '';

  const handleLogin = async (username, password, remember) => {
    setError('');
    setLoading(true);

    if (remember) {
      localStorage.setItem(REMEMBER_KEY, username);
    } else {
      localStorage.removeItem(REMEMBER_KEY);
    }

    try {
      const result = await login(username, password);

      if (result.success) {
        const route = ROLE_ROUTES[result.user.role] || '/dashboard';
        navigate(route);
      } else {
        setError(ERROR_MAP[result.errorType] || result.error || 'Identifiants invalides.');
      }
    } catch (err) {
      setError('Erreur de connexion au serveur.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-white font-sans">
      
      {/* LEFT COLUMN - Visual/Immersion */}
      <div className="hidden lg:flex lg:col-span-7 bg-gradient-to-br from-indigo-50/50 via-slate-50 to-indigo-100/30 flex-col justify-between p-8 lg:p-12 relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none animate-pulse -z-0"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-200/20 rounded-full blur-3xl pointer-events-none animate-pulse -z-0 [animation-delay:2s]"></div>
        
        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <i className="fas fa-building text-primary text-2xl"></i>
          <span className="text-primary font-bold text-xl tracking-wide">SYGIM</span>
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-2xl animate-fade-in-up">
          <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 leading-tight mb-6">
            Gérez votre parc immobilier et vos collectes en toute sérénité
          </h1>
          <p className="text-lg text-slate-600 mb-8">
            Une plateforme tout-en-un pour centraliser vos opérations, automatiser vos relances et piloter votre activité de gestion locative.
          </p>

          {/* Mockup UI */}
          <div className="mt-8 w-full max-w-lg bg-white/80 backdrop-blur-md rounded-2xl shadow-2xl border border-white/50 p-4 transform lg:translate-x-4 lg:rotate-1 transition-transform hover:rotate-0 duration-500">
            {/* Fake Window Header */}
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-rose-400"></div>
              <div className="w-3 h-3 rounded-full bg-amber-400"></div>
              <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
            </div>
            
            {/* Fake Stats */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-white rounded-lg p-3 shadow-sm border border-slate-100">
                <div className="text-xs text-slate-500 mb-1">Collectes</div>
                <div className="text-sm font-bold text-slate-900">4.5M XOF</div>
              </div>
              <div className="bg-white rounded-lg p-3 shadow-sm border border-slate-100">
                <div className="text-xs text-slate-500 mb-1">Taux Recouv.</div>
                <div className="text-sm font-bold text-emerald-600">98%</div>
              </div>
              <div className="bg-white rounded-lg p-3 shadow-sm border border-slate-100">
                <div className="text-xs text-slate-500 mb-1">Locataires</div>
                <div className="text-sm font-bold text-slate-900">142</div>
              </div>
            </div>

            {/* Fake Chart / Progress */}
            <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-100">
              <div className="flex justify-between text-xs text-slate-500 mb-2">
                <span>Objectif Mensuel</span>
                <span className="text-primary font-medium">85%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-primary h-2 rounded-full" style={{ width: '85%' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-sm text-slate-500">
          © {new Date().getFullYear()} SYGIM. Tous droits réservés.
        </div>
      </div>

      {/* RIGHT COLUMN - Form */}
      <div className="col-span-1 lg:col-span-5 bg-white flex flex-col justify-center px-8 sm:px-12 lg:px-16 py-12 relative">
        {/* Mobile Logo */}
        <div className="flex lg:hidden items-center gap-3 mb-10 justify-center">
          <i className="fas fa-building text-primary text-3xl"></i>
          <span className="text-primary font-bold text-2xl tracking-wide">SYGIM</span>
        </div>

        <div className={`w-full max-w-md mx-auto ${error ? 'animate-shake' : ''}`}>
          <div className="mb-8 animate-fade-in-up [animation-delay:100ms]">
            <h2 className="text-2xl lg:text-3xl font-bold text-slate-900 mb-2">Connectez-vous à votre espace</h2>
            <p className="text-sm text-slate-500">Saisissez vos identifiants pour accéder au back-office SYGIM.</p>
          </div>

          <LoginForm onLogin={handleLogin} loading={loading} error={error} remembered={remembered} />
        </div>
      </div>
    </div>
  );
}
