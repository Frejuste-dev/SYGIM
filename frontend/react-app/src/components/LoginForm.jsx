import React, { useState, useRef, useEffect } from 'react';

export default function LoginForm({ onLogin, loading, error, remembered }) {
  const [username, setUsername] = useState(remembered || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(!!remembered);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    if (!username.trim() || !password) return;
    onLogin(username.trim(), password, remember);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit();
  };

  const isSubmitDisabled = loading || !username.trim() || !password;
  const errorIcon = error?.includes('Trop de tentatives') ? 'fa-clock' : 'fa-exclamation-circle';

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-md mb-4 animate-fade-in-up [animation-delay:150ms]">
          <p className="text-sm text-rose-700 font-medium">{error}</p>
        </div>
      )}

      <div className="animate-fade-in-up [animation-delay:200ms]">
        <label htmlFor="loginUsername" className="block text-sm font-medium text-slate-700 mb-1.5">Nom d'utilisateur</label>
        <input
          ref={inputRef}
          type="text"
          id="loginUsername"
          placeholder="ex. jdupont"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="username"
          autoFocus
          className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10 transition-all"
          disabled={loading}
        />
      </div>

      <div className="animate-fade-in-up [animation-delay:250ms]">
        <label htmlFor="loginPassword" className="block text-sm font-medium text-slate-700 mb-1.5">Mot de passe</label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            id="loginPassword"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="current-password"
            className="w-full px-4 py-3 pr-10 bg-slate-50/50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10 transition-all"
            disabled={loading}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
            disabled={loading}
          >
            <i className={showPassword ? 'fas fa-eye-slash' : 'fas fa-eye'}></i>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 animate-fade-in-up [animation-delay:300ms]">
        <input
          type="checkbox"
          id="loginRemember"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          disabled={loading}
          className="w-4 h-4 text-primary bg-white border-slate-300 rounded focus:ring-primary/20 focus:ring-2 cursor-pointer"
        />
        <label htmlFor="loginRemember" className="text-sm text-slate-600 cursor-pointer">
          Mémoriser mon identifiant
        </label>
      </div>

      <button
        type="button"
        className="w-full flex items-center justify-center py-3 px-4 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-primary-dark shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-all duration-200 mt-6 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none animate-fade-in-up [animation-delay:350ms]"
        onClick={handleSubmit}
        disabled={isSubmitDisabled}
      >
        {loading ? (
          <><i className="fas fa-spinner fa-spin mr-2"></i> Connexion...</>
        ) : (
          'Se connecter'
        )}
      </button>

      {/* Raccourcis Démo pour Présentation */}
      <div className="pt-4 border-t border-slate-100 text-center animate-fade-in-up [animation-delay:400ms]">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Comptes de Démonstration (1-clic)</p>
        <div className="flex flex-wrap gap-2 justify-center">
          <button
            type="button"
            onClick={() => { setUsername('admin'); setPassword('Admin2026!'); }}
            className="px-2.5 py-1 text-xs rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-medium transition-colors cursor-pointer"
          >
            👤 Admin
          </button>
          <button
            type="button"
            onClick={() => { setUsername('manager'); setPassword('Mgr2026!'); }}
            className="px-2.5 py-1 text-xs rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium transition-colors cursor-pointer"
          >
            👔 Gestionnaire
          </button>
          <button
            type="button"
            onClick={() => { setUsername('leonce'); setPassword('Leonce2026!'); }}
            className="px-2.5 py-1 text-xs rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 font-semibold border border-amber-200 transition-colors cursor-pointer"
          >
            📱 Collecteur Léonce
          </button>
          <button
            type="button"
            onClick={() => { setUsername('korede'); setPassword('Korede2026!'); }}
            className="px-2.5 py-1 text-xs rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 font-medium transition-colors cursor-pointer"
          >
            📱 Collecteur Korédé
          </button>
          <button
            type="button"
            onClick={() => { setUsername('comptable'); setPassword('Comptable2026!'); }}
            className="px-2.5 py-1 text-xs rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium transition-colors cursor-pointer"
          >
            💰 Comptable
          </button>
        </div>
      </div>
    </div>
  );
}
