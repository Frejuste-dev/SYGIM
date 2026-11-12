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
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-white font-sans">
      
      {/* PARTIE GAUCHE : FORMULAIRE DE CONNEXION CENTRÉ */}
      <div className="w-full lg:w-1/2 min-h-screen flex flex-col justify-center items-center px-6 sm:px-12 lg:px-16 xl:px-24 py-12 bg-white">
        {/* Logo affiché uniquement sur mobile */}
        <div className="flex lg:hidden items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center text-lg shadow-md shadow-primary/30">
            <i className="fas fa-building"></i>
          </div>
          <div>
            <span className="text-2xl font-black text-slate-900 tracking-tight block leading-none">SYGIM</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Gestion Immobilière</span>
          </div>
        </div>

        <div className="w-full max-w-md">
          {/* Titre & Sous-titre épurés */}
          <div className="mb-8">
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Connexion</h2>
            <p className="text-sm text-slate-500 mt-1.5">Accédez à votre espace de travail</p>
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

      {/* PARTIE DROITE : TOUTE LA ZONE ILLUSTRATION & BRANDING */}
      <div className="hidden lg:flex lg:w-1/2 min-h-screen bg-gradient-to-br from-indigo-50/70 via-slate-50 to-indigo-100/50 flex-col justify-between p-12 xl:p-16 relative overflow-hidden border-l border-slate-100">
        {/* Lueur d'ambiance subtile */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-300/15 rounded-full blur-3xl pointer-events-none"></div>

        {/* Logo SYGIM en haut à droite */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-primary text-white flex items-center justify-center text-xl shadow-lg shadow-primary/25">
            <i className="fas fa-building"></i>
          </div>
          <div>
            <span className="text-2xl font-black text-slate-900 tracking-tight block leading-none">SYGIM</span>
            <span className="text-xs font-bold uppercase tracking-wider text-primary">Gestion Immobilière</span>
          </div>
        </div>

        {/* Illustration occupant généreusement tout le centre droit */}
        <div className="relative z-10 my-auto w-full max-w-lg mx-auto flex items-center justify-center px-4">
          <img
            src={loginIllustration}
            alt="Illustration SYGIM"
            className="w-full h-auto max-h-[440px] object-contain drop-shadow-md select-none transition-transform hover:scale-[1.02] duration-300"
          />
        </div>

        {/* Footer discret */}
        <div className="relative z-10 text-xs text-slate-400">
          © {new Date().getFullYear()} SYGIM &bull; Plateforme sécurisée de gestion immobilière
        </div>
      </div>

    </div>
  );
}
