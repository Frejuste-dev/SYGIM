import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import LoginForm from '../components/LoginForm';

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
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-white font-sans antialiased text-slate-900">
      
      {/* PARTIE GAUCHE : FORMULAIRE DE CONNEXION CENTRÉ */}
      <div className="w-full lg:w-1/2 min-h-screen flex flex-col justify-center items-center px-6 sm:px-12 lg:px-16 xl:px-24 py-12 bg-white">
        {/* Logo affiché sur mobile */}
        <div className="flex lg:hidden items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center text-lg shadow-sm">
            <i className="fas fa-building"></i>
          </div>
          <div>
            <span className="text-2xl font-black text-slate-900 tracking-tight block leading-none">SYGIM</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">Gestion Immobilière</span>
          </div>
        </div>

        <div className="w-full max-w-md">
          {/* Titre & Sous-titre épurés style Linear / Stripe */}
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Connexion</h1>
            <p className="text-sm text-slate-500 mt-2">Accédez à votre espace de gestion et comptabilité locative</p>
          </div>

          {/* Formulaire */}
          <LoginForm
            onLogin={handleLogin}
            loading={loading}
            error={error}
            remembered={remembered}
          />

          <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>Environnement sécurisé SSL &bull; TLS 1.3</span>
            <span className="font-medium text-slate-500">v2.0</span>
          </div>
        </div>
      </div>

      {/* PARTIE DROITE : PANNEAU INSTITUTIONNEL CORPORATE (Style Mercury / Stripe) */}
      <div className="hidden lg:flex lg:w-1/2 min-h-screen bg-slate-900 text-white flex-col justify-between p-12 xl:p-16 border-l border-slate-800 select-none relative overflow-hidden">
        
        {/* Trame géométrique corporate subtile */}
        <div
          className="absolute inset-0 z-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)',
            backgroundSize: '24px 24px'
          }}
        ></div>

        {/* En-tête de marque */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center text-lg shadow-sm">
              <i className="fas fa-building"></i>
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white block leading-none">SYGIM</span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Système de Gestion Immobilière</span>
            </div>
          </div>
          <span className="text-xs px-2.5 py-1 bg-slate-800/80 border border-slate-700/60 rounded-full font-medium text-slate-300">
            ERP B2B &bull; Édition Pro
          </span>
        </div>

        {/* Corps central : Cartes de valeur métier */}
        <div className="relative z-10 my-auto max-w-lg space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl xl:text-3xl font-extrabold text-white tracking-tight leading-snug">
              La plateforme de référence pour le recouvrement et la gestion de parcs immobiliers.
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Supervisez les encaissements terrain, automatisez la reddition de comptes propriétaires et pilotez les préfinancements avec une rigueur comptable absolue.
            </p>
          </div>

          {/* Grille de cartes fonctionnelles sobres */}
          <div className="grid grid-cols-1 gap-3.5 pt-2">
            <div className="p-4 bg-slate-800/60 border border-slate-700/60 rounded-xl shadow-xs flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 text-sm">
                <i className="fas fa-receipt"></i>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Encaissement Terrain & Quittance Instantanée</h3>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                  Collecte en 3 étapes avec signature tactile locataire, imputation des déductions travaux et reçu PDF horodaté.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-800/60 border border-slate-700/60 rounded-xl shadow-xs flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 text-sm">
                <i className="fas fa-hand-holding-dollar"></i>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Reversements Propriétaires & Préfinancements</h3>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                  Calculs FIFO de commissions, paiements échelonnés sécurisés et réconciliation automatique sur impayés locataires.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-800/60 border border-slate-700/60 rounded-xl shadow-xs flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/25 text-primary-300 flex items-center justify-center shrink-0 text-sm">
                <i className="fas fa-shield-halved"></i>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Grand Livre & Traçabilité Intégrale</h3>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                  Immuabilité des écritures comptables traitées, verrouillage transactionnel SQL et conformité des accès RBAC.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Pied de page institutionnel */}
        <div className="relative z-10 flex items-center justify-between text-xs text-slate-500 border-t border-slate-800/80 pt-6">
          <span>&copy; {new Date().getFullYear()} SYGIM. Tous droits réservés.</span>
          <div className="flex items-center gap-4 text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Systèmes opérationnels
            </span>
          </div>
        </div>
      </div>

    </div>
  );
}
