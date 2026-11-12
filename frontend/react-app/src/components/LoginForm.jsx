import React, { useState, useRef, useEffect } from 'react';

export default function LoginForm({ onLogin, loading, error, remembered }) {
  const [username, setUsername] = useState(remembered || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(!!remembered);

  // Validation locale interactive
  const [touched, setTouched] = useState({ username: false, password: false });
  const [fieldErrors, setFieldErrors] = useState({ username: '', password: '' });
  const [shakeTrigger, setShakeTrigger] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const validate = () => {
    const errors = { username: '', password: '' };
    let isValid = true;

    if (!username.trim()) {
      errors.username = 'Veuillez renseigner votre identifiant';
      isValid = false;
    } else if (username.trim().length < 3) {
      errors.username = 'L\'identifiant doit contenir au moins 3 caractères';
      isValid = false;
    }

    if (!password) {
      errors.password = 'Veuillez saisir votre mot de passe';
      isValid = false;
    } else if (password.length < 4) {
      errors.password = 'Le mot de passe doit comporter au moins 4 caractères';
      isValid = false;
    }

    setFieldErrors(errors);
    return isValid;
  };

  const handleUsernameChange = (e) => {
    const val = e.target.value;
    setUsername(val);
    if (touched.username) {
      if (!val.trim()) {
        setFieldErrors(prev => ({ ...prev, username: 'Veuillez renseigner votre identifiant' }));
      } else if (val.trim().length < 3) {
        setFieldErrors(prev => ({ ...prev, username: 'Minimum 3 caractères requis' }));
      } else {
        setFieldErrors(prev => ({ ...prev, username: '' }));
      }
    }
  };

  const handlePasswordChange = (e) => {
    const val = e.target.value;
    setPassword(val);
    if (touched.password) {
      if (!val) {
        setFieldErrors(prev => ({ ...prev, password: 'Veuillez saisir votre mot de passe' }));
      } else if (val.length < 4) {
        setFieldErrors(prev => ({ ...prev, password: 'Minimum 4 caractères requis' }));
      } else {
        setFieldErrors(prev => ({ ...prev, password: '' }));
      }
    }
  };

  const handleUsernameBlur = () => {
    setTouched(prev => ({ ...prev, username: true }));
    if (!username.trim()) {
      setFieldErrors(prev => ({ ...prev, username: 'Veuillez renseigner votre identifiant' }));
    } else if (username.trim().length < 3) {
      setFieldErrors(prev => ({ ...prev, username: 'Minimum 3 caractères requis' }));
    } else {
      setFieldErrors(prev => ({ ...prev, username: '' }));
    }
  };

  const handlePasswordBlur = () => {
    setTouched(prev => ({ ...prev, password: true }));
    if (!password) {
      setFieldErrors(prev => ({ ...prev, password: 'Veuillez saisir votre mot de passe' }));
    } else if (password.length < 4) {
      setFieldErrors(prev => ({ ...prev, password: 'Minimum 4 caractères requis' }));
    } else {
      setFieldErrors(prev => ({ ...prev, password: '' }));
    }
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    setTouched({ username: true, password: true });
    const isValid = validate();

    if (!isValid) {
      setShakeTrigger(true);
      setTimeout(() => setShakeTrigger(false), 500);
      return;
    }

    onLogin(username.trim(), password, remember);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit(e);
  };

  const fillCredentials = (u, p) => {
    setUsername(u);
    setPassword(p);
    setFieldErrors({ username: '', password: '' });
    setTouched({ username: true, password: true });
  };

  const isUsernameValid = username.trim().length >= 3 && !fieldErrors.username;
  const isPasswordValid = password.length >= 4 && !fieldErrors.password;

  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${shakeTrigger ? 'animate-shake' : ''}`}>
      
      {/* Alerte Erreur Serveur */}
      {error && (
        <div className="bg-rose-50/90 border border-rose-200 text-rose-700 px-4 py-3 rounded-2xl flex items-center gap-3 animate-fade-in-up text-xs font-semibold shadow-xs">
          <i className="fas fa-exclamation-triangle text-rose-500 text-sm shrink-0"></i>
          <span>{error}</span>
        </div>
      )}

      {/* CHAMP NOM D'UTILISATEUR */}
      <div className="space-y-1.5">
        <label htmlFor="loginUsername" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
          Nom d'utilisateur <span className="text-rose-500">*</span>
        </label>
        <div className="relative group">
          <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-200 ${
            fieldErrors.username
              ? 'text-rose-500'
              : isUsernameValid
                ? 'text-emerald-500'
                : 'text-slate-400 group-focus-within:text-primary'
          }`}>
            <i className="fas fa-user-circle text-base"></i>
          </div>
          <input
            ref={inputRef}
            type="text"
            id="loginUsername"
            placeholder="ex. manager, korede ou admin"
            value={username}
            onChange={handleUsernameChange}
            onBlur={handleUsernameBlur}
            onKeyDown={handleKeyDown}
            autoComplete="username"
            disabled={loading}
            className={`w-full pl-11 pr-11 py-3 bg-slate-50/60 border rounded-2xl text-sm font-semibold text-slate-900 transition-all duration-200 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:bg-white ${
              fieldErrors.username
                ? 'border-rose-400 bg-rose-50/20 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/15'
                : isUsernameValid
                  ? 'border-emerald-300 bg-emerald-50/15 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15'
                  : 'border-slate-200 hover:border-slate-300 focus:border-primary focus:ring-4 focus:ring-primary/15 shadow-2xs focus:shadow-md'
            }`}
          />
          {/* Badge Valid / Invalide */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center">
            {isUsernameValid && !fieldErrors.username && (
              <span className="text-emerald-500 animate-fade-in-up" title="Identifiant valide">
                <i className="fas fa-check-circle text-sm"></i>
              </span>
            )}
            {fieldErrors.username && (
              <span className="text-rose-500 animate-shake" title={fieldErrors.username}>
                <i className="fas fa-exclamation-circle text-sm"></i>
              </span>
            )}
          </div>
        </div>
        {fieldErrors.username && (
          <p className="text-xs text-rose-500 font-medium flex items-center gap-1.5 pl-1 animate-fade-in-up">
            <i className="fas fa-info-circle text-[11px]"></i> {fieldErrors.username}
          </p>
        )}
      </div>

      {/* CHAMP MOT DE PASSE */}
      <div className="space-y-1.5">
        <label htmlFor="loginPassword" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
          Mot de passe <span className="text-rose-500">*</span>
        </label>
        <div className="relative group">
          <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-200 ${
            fieldErrors.password
              ? 'text-rose-500'
              : isPasswordValid
                ? 'text-emerald-500'
                : 'text-slate-400 group-focus-within:text-primary'
          }`}>
            <i className="fas fa-lock text-base"></i>
          </div>
          <input
            type={showPassword ? 'text' : 'password'}
            id="loginPassword"
            placeholder="••••••••••••"
            value={password}
            onChange={handlePasswordChange}
            onBlur={handlePasswordBlur}
            onKeyDown={handleKeyDown}
            autoComplete="current-password"
            disabled={loading}
            className={`w-full pl-11 pr-20 py-3 bg-slate-50/60 border rounded-2xl text-sm font-semibold text-slate-900 transition-all duration-200 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:bg-white ${
              fieldErrors.password
                ? 'border-rose-400 bg-rose-50/20 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/15'
                : isPasswordValid
                  ? 'border-emerald-300 bg-emerald-50/15 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15'
                  : 'border-slate-200 hover:border-slate-300 focus:border-primary focus:ring-4 focus:ring-primary/15 shadow-2xs focus:shadow-md'
            }`}
          />
          {/* Actions à droite : Validation + Eye */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {isPasswordValid && !fieldErrors.password && (
              <span className="text-emerald-500 mr-1 animate-fade-in-up" title="Mot de passe valide">
                <i className="fas fa-check-circle text-sm"></i>
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none cursor-pointer"
              title={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              tabIndex={-1}
            >
              <i className={showPassword ? 'fas fa-eye-slash text-xs' : 'fas fa-eye text-xs'}></i>
            </button>
          </div>
        </div>
        {fieldErrors.password && (
          <p className="text-xs text-rose-500 font-medium flex items-center gap-1.5 pl-1 animate-fade-in-up">
            <i className="fas fa-info-circle text-[11px]"></i> {fieldErrors.password}
          </p>
        )}
      </div>

      {/* MÉMORISER MON IDENTIFIANT */}
      <div className="flex items-center justify-between pt-1">
        <label className="flex items-center gap-2.5 cursor-pointer select-none group">
          <input
            type="checkbox"
            id="loginRemember"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            disabled={loading}
            className="w-4 h-4 text-primary bg-white border-slate-300 rounded focus:ring-primary/20 focus:ring-2 cursor-pointer transition"
          />
          <span className="text-xs font-semibold text-slate-600 group-hover:text-slate-900 transition-colors">
            Mémoriser mon identifiant
          </span>
        </label>
      </div>

      {/* BOUTON SE CONNECTER */}
      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-primary to-primary-dark hover:from-primary-dark hover:to-indigo-700 shadow-md shadow-primary/25 hover:shadow-xl hover:shadow-primary/35 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] transition-all duration-200 mt-5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none cursor-pointer group"
      >
        {loading ? (
          <>
            <i className="fas fa-spinner fa-spin text-sm"></i>
            <span>Connexion en cours...</span>
          </>
        ) : (
          <>
            <span>Se connecter</span>
            <i className="fas fa-arrow-right text-xs transition-transform group-hover:translate-x-1"></i>
          </>
        )}
      </button>

      {/* COMPTES DE DÉMONSTRATION (1-CLIC) */}
      <div className="pt-4 border-t border-slate-100 text-center">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
          Comptes de Démonstration (1-clic)
        </p>
        <div className="flex flex-wrap gap-1.5 justify-center">
          <button
            type="button"
            onClick={() => fillCredentials('admin', 'Admin2026!')}
            className="px-2.5 py-1 text-xs rounded-xl bg-indigo-50/80 hover:bg-indigo-100 text-indigo-700 font-semibold transition-all hover:scale-105 active:scale-95 cursor-pointer border border-indigo-100"
          >
            👤 Admin
          </button>
          <button
            type="button"
            onClick={() => fillCredentials('manager', 'Mgr2026!')}
            className="px-2.5 py-1 text-xs rounded-xl bg-emerald-50/80 hover:bg-emerald-100 text-emerald-700 font-semibold transition-all hover:scale-105 active:scale-95 cursor-pointer border border-emerald-100"
          >
            👔 Gestionnaire
          </button>
          <button
            type="button"
            onClick={() => fillCredentials('korede', 'Korede2026!')}
            className="px-2.5 py-1 text-xs rounded-xl bg-amber-50/80 hover:bg-amber-100 text-amber-800 font-semibold transition-all hover:scale-105 active:scale-95 cursor-pointer border border-amber-100"
          >
            📱 Korédé
          </button>
          <button
            type="button"
            onClick={() => fillCredentials('leonce', 'Leonce2026!')}
            className="px-2.5 py-1 text-xs rounded-xl bg-amber-50/80 hover:bg-amber-100 text-amber-800 font-semibold transition-all hover:scale-105 active:scale-95 cursor-pointer border border-amber-100"
          >
            📱 Léonce
          </button>
          <button
            type="button"
            onClick={() => fillCredentials('comptable', 'Comptable2026!')}
            className="px-2.5 py-1 text-xs rounded-xl bg-blue-50/80 hover:bg-blue-100 text-blue-700 font-semibold transition-all hover:scale-105 active:scale-95 cursor-pointer border border-blue-100"
          >
            💰 Comptable
          </button>
        </div>
      </div>
    </form>
  );
}
