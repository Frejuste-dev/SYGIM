import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import LoginForm from '../components/LoginForm';
import loginIllustration from '../assets/login_illustration.svg';

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
    <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center p-4 sm:p-6 lg:p-10 font-sans">
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden grid grid-cols-1 lg:grid-cols-2 min-h-[580px]">
        
        {/* SECTION GAUCHE : LOGO & ILLUSTRATION */}
        <div className="bg-gradient-to-br from-indigo-50/80 via-slate-50 to-indigo-100/40 p-8 sm:p-10 lg:p-12 flex flex-col justify-between items-center text-center relative overflow-hidden border-b lg:border-b-0 lg:border-r border-slate-100">
          {/* Ambient Glow */}
          <div className="absolute top-10 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-10 right-10 w-72 h-72 bg-indigo-300/15 rounded-full blur-3xl pointer-events-none"></div>

          {/* Logo SYGIM */}
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center text-lg shadow-md shadow-primary/30">
              <i className="fas fa-building"></i>
            </div>
            <div className="text-left">
              <span className="text-2xl font-black text-slate-900 tracking-tight block leading-none">SYGIM</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Gestion Immobilière</span>
            </div>
          </div>

          {/* Illustration SVG */}
          <div className="relative z-10 my-6 sm:my-8 w-full max-w-sm flex items-center justify-center">
            <img
              src={loginIllustration}
              alt="Illustration SYGIM"
              className="w-full h-auto max-h-[280px] object-contain drop-shadow-sm select-none"
            />
          </div>

          {/* Footer discret */}
          <div className="relative z-10 text-xs text-slate-400">
            © {new Date().getFullYear()} SYGIM &bull; Plateforme sécurisée
          </div>
        </div>

        {/* SECTION DROITE : FORMULAIRE DE CONNEXION */}
        <div className="p-8 sm:p-10 lg:p-12 flex flex-col justify-center bg-white">
          <div className="w-full max-w-md mx-auto">
            {/* Titre & Sous-titre épurés (sans texte superflu) */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Connexion</h2>
              <p className="text-xs text-slate-500 mt-1">Accédez à votre espace de travail</p>
            </div>

            {/* Formulaire */}
            <LoginForm
              onLogin={handleLogin}
              loading={loading}
              error={error}
              remembered={remembered}
            />
          </div>
        </div>

      </div>
    </div>
  );
}
