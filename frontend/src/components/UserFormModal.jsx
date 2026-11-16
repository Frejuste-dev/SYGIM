import React, { useState, useEffect } from 'react';
import useModalEscape from '../hooks/useModalEscape';
import { FormField, FormSection } from './ui/forms';

const EMPTY_FORM = {
  username: '', password: '', firstName: '', lastName: '',
  email: '', role: 'collector', active: true
};

const ROLE_DESCRIPTIONS = {
  admin: {
    title: 'Administrateur',
    desc: 'Accès intégral à l\'ensemble du système : gestion des utilisateurs, audit, paramètres de l\'agence et tous les modules comptables & analytiques.',
    icon: 'fa-shield-halved',
    color: 'text-indigo-600 bg-indigo-50 border-indigo-200'
  },
  director: {
    title: 'Directeur Général',
    desc: 'Supervision globale, validation stratégique, consultation des rapports financiers et du compte séquestre mandat sans administration technique.',
    icon: 'fa-briefcase',
    color: 'text-purple-600 bg-purple-50 border-purple-200'
  },
  accounting: {
    title: 'Comptable',
    desc: 'Validation des encaissements de collecte, tenue du grand livre, reversements et préfinancements propriétaires, bilans fiscaux.',
    icon: 'fa-calculator',
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200'
  },
  collector_manager: {
    title: 'Manager des Récolteurs',
    desc: 'Pilotage opérationnel des tournées de collecte, suivi des impayés, analyse du taux d\'effort et génération des situations propriétaires.',
    icon: 'fa-user-tie',
    color: 'text-amber-600 bg-amber-50 border-amber-200'
  },
  collector: {
    title: 'Agent Récolteur (Terrain)',
    desc: 'Interface mobile simplifiée : enregistrement des encaissements sur le terrain, délivrance des reçus et capture de signature locataire.',
    icon: 'fa-motorcycle',
    color: 'text-sky-600 bg-sky-50 border-sky-200'
  }
};

function calculatePasswordStrength(pass) {
  if (!pass) return { score: 0, label: '', color: 'bg-slate-200' };
  let score = 0;
  if (pass.length >= 6) score += 1;
  if (pass.length >= 8) score += 1;
  if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 1;
  if (/[0-9]/.test(pass)) score += 1;
  if (/[^A-Za-z0-9]/.test(pass)) score += 1;

  if (score <= 2) {
    return { score: 1, label: 'Faible', color: 'bg-rose-500', text: 'text-rose-600' };
  } else if (score <= 3) {
    return { score: 2, label: 'Moyen', color: 'bg-amber-500', text: 'text-amber-600' };
  } else {
    return { score: 3, label: 'Robuste', color: 'bg-emerald-500', text: 'text-emerald-600' };
  }
}

export default function UserFormModal({ isOpen, onClose, onSubmit }) {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useModalEscape(isOpen, onClose);

  useEffect(() => {
    if (!isOpen) return;
    setForm({ ...EMPTY_FORM });
    setError('');
    setShowPassword(false);
    setSubmitting(false);
  }, [isOpen]);

  const pwStrength = calculatePasswordStrength(form.password);
  const activeRoleInfo = ROLE_DESCRIPTIONS[form.role] || ROLE_DESCRIPTIONS.collector;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username.trim() || !form.password || !form.role) {
      setError('L\'identifiant, le mot de passe et le rôle sont obligatoires.');
      return;
    }
    if (form.password.length < 6) {
      setError('Le mot de passe doit comporter au moins 6 caractères.');
      return;
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('Veuillez renseigner une adresse email valide.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await onSubmit(form);
      onClose();
    } catch (err) {
      setError(err.message || 'Erreur lors de la création de l\'utilisateur.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92dvh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <i className="fas fa-user-plus text-primary text-base"></i>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">Nouvel utilisateur</h2>
              <p className="text-xs text-slate-500">Création de compte collaborateur et attribution des droits</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Fermer"
          >
            <i className="fas fa-times text-sm"></i>
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 flex items-center gap-2 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold">
            <i className="fas fa-exclamation-circle shrink-0 text-rose-500"></i>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-6 space-y-5 overflow-y-auto flex-1">

            {/* Section 1 : Identifiants & Accès */}
            <FormSection
              icon="fa-lock"
              title="1. Identifiants & Sécurité"
              subtitle="Connexion à l'application SYGIM"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Identifiant de connexion" required id="username" hint="Unique, sans espace (ex: j.kouassi)">
                  <input
                    id="username"
                    type="text"
                    required
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().trim() })}
                    placeholder="Ex : p.koffi"
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 shadow-2xs focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                  />
                </FormField>

                <FormField
                  label="Mot de passe"
                  required
                  id="password"
                  hint={
                    form.password ? (
                      <span className="flex items-center gap-1.5 font-semibold">
                        Robustesse : <span className={pwStrength.text}>{pwStrength.label}</span>
                      </span>
                    ) : 'Minimum 6 caractères'
                  }
                >
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="••••••••"
                      className="w-full px-4 py-2.5 pr-10 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 shadow-2xs focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      title={showPassword ? 'Masquer' : 'Afficher'}
                    >
                      <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-xs`}></i>
                    </button>
                  </div>
                  {/* Jauge de mot de passe */}
                  {form.password && (
                    <div className="grid grid-cols-3 gap-1.5 mt-2">
                      <div className={`h-1.5 rounded-full transition-all ${pwStrength.score >= 1 ? pwStrength.color : 'bg-slate-200'}`}></div>
                      <div className={`h-1.5 rounded-full transition-all ${pwStrength.score >= 2 ? pwStrength.color : 'bg-slate-200'}`}></div>
                      <div className={`h-1.5 rounded-full transition-all ${pwStrength.score >= 3 ? pwStrength.color : 'bg-slate-200'}`}></div>
                    </div>
                  )}
                </FormField>
              </div>
            </FormSection>

            {/* Section 2 : Identité Collaborateur */}
            <FormSection
              icon="fa-id-badge"
              title="2. Profil Collaborateur"
              subtitle="Nom complet et coordonnées internes"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Prénom" id="firstName">
                  <input
                    id="firstName"
                    type="text"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    placeholder="Ex : Patricia"
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 shadow-2xs focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </FormField>
                <FormField label="Nom de famille" id="lastName">
                  <input
                    id="lastName"
                    type="text"
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    placeholder="Ex : Koffi"
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 shadow-2xs focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </FormField>
              </div>

              <FormField label="Adresse Email professionnelle" optional id="email" hint="Pour réinitialisation et alertes">
                <input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="Ex : p.koffi@agence.ci"
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 shadow-2xs focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </FormField>
            </FormSection>

            {/* Section 3 : Rôle & Droits d'accès */}
            <FormSection
              icon="fa-user-gear"
              title="3. Rôle Métier & Permissions"
              subtitle="Détermine les vues et actions autorisées dans l'application"
            >
              <FormField label="Rôle attribué" required id="role">
                <select
                  id="role"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 shadow-2xs focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                >
                  <option value="admin">Administrateur (Accès total)</option>
                  <option value="director">Directeur Général (Audit & Décision)</option>
                  <option value="accounting">Comptable (Encaissements, Reversements & Grand Livre)</option>
                  <option value="collector_manager">Manager des Récolteurs (Tournées & Impayés)</option>
                  <option value="collector">Récolteur (Collecte Terrain & Reçus)</option>
                </select>
              </FormField>

              {/* Encadré d'explication dynamique du rôle */}
              <div className={`p-3.5 rounded-xl border flex items-start gap-3 transition-all ${activeRoleInfo.color}`}>
                <div className="w-8 h-8 rounded-lg bg-white/80 flex items-center justify-center shrink-0 shadow-2xs">
                  <i className={`fas ${activeRoleInfo.icon} text-sm`}></i>
                </div>
                <div>
                  <div className="text-xs font-bold leading-tight">{activeRoleInfo.title}</div>
                  <p className="text-[11px] mt-0.5 opacity-90 leading-relaxed">{activeRoleInfo.desc}</p>
                </div>
              </div>
            </FormSection>

          </div>

          {/* Footer */}
          <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-60 cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-primary rounded-xl hover:bg-primary-dark transition-colors shadow-sm shadow-primary/20 disabled:opacity-60 cursor-pointer"
            >
              {submitting
                ? <><i className="fas fa-spinner fa-spin text-xs"></i> Création en cours...</>
                : <><i className="fas fa-user-plus text-xs"></i> Créer l'utilisateur</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
