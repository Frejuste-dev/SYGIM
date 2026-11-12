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

      {/* PARTIE DROITE : TOUTE LA ZONE ILLUSTRATION & BRANDING AVEC ANIMATION DE FOND */}
      <div className="hidden lg:flex lg:w-1/2 min-h-screen bg-gradient-to-br from-indigo-50/70 via-slate-50 to-indigo-100/50 flex-col justify-between p-12 xl:p-16 relative overflow-hidden border-l border-slate-100 select-none">
        
        {/* Animated Mesh Gradient Orbs (Fond fluide et vivant) */}
        <div className="absolute -top-20 -left-20 w-[420px] h-[420px] bg-primary/20 rounded-full blur-[90px] pointer-events-none animate-blob-1"></div>
        <div className="absolute -bottom-20 -right-20 w-[460px] h-[460px] bg-rose-400/20 rounded-full blur-[100px] pointer-events-none animate-blob-2"></div>
        <div className="absolute top-1/2 left-1/4 w-[320px] h-[320px] bg-sky-400/15 rounded-full blur-[80px] pointer-events-none animate-blob-1 [animation-delay:4s]"></div>
        <div className="absolute top-1/3 right-1/4 w-[280px] h-[280px] bg-indigo-400/20 rounded-full blur-[70px] pointer-events-none animate-blob-2 [animation-delay:8s]"></div>

        {/* Trame de points géométrique subtile */}
        <div
          className="absolute inset-0 z-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(#6366f1 1.2px, transparent 1.2px)',
            backgroundSize: '24px 24px'
          }}
        ></div>

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

        {/* Illustration animée avec badges flottants dynamiques */}
        <div className="relative z-10 my-auto w-full max-w-lg mx-auto flex items-center justify-center px-4">
          <div className="relative animate-float-slow">
            <img
              src={loginIllustration}
              alt="Illustration SYGIM"
              className="w-full h-auto max-h-[420px] object-contain drop-shadow-md select-none"
            />

            {/* Badge flottant 1 (haut droite) */}
            <div className="absolute -top-3 -right-2 sm:-right-4 bg-white/90 backdrop-blur-md border border-white/70 shadow-lg shadow-indigo-500/10 rounded-2xl px-3.5 py-2 flex items-center gap-2.5 animate-float-reverse">
              <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs shadow-xs">
                <i className="fas fa-bolt"></i>
              </div>
              <div className="text-left">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block leading-tight">Recouvrement</span>
                <span className="text-xs font-bold text-slate-800">100% Digital</span>
              </div>
            </div>

            {/* Badge flottant 2 (bas gauche) */}
            <div className="absolute -bottom-3 -left-2 sm:-left-4 bg-white/90 backdrop-blur-md border border-white/70 shadow-lg shadow-indigo-500/10 rounded-2xl px-3.5 py-2 flex items-center gap-2.5 animate-float-slow [animation-delay:3s]">
              <div className="w-7 h-7 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-xs shadow-xs">
                <i className="fas fa-shield-alt"></i>
              </div>
              <div className="text-left">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block leading-tight">Sécurité</span>
                <span className="text-xs font-bold text-slate-800">Données Certifiées</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer discret */}
        <div className="relative z-10 text-xs text-slate-400">
          © {new Date().getFullYear()} SYGIM &bull; Plateforme sécurisée de gestion immobilière
        </div>
      </div>

    </div>
  );
}
