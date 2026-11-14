import React, { useState, useEffect } from 'react';
import useModalEscape from '../hooks/useModalEscape';

const EMPTY_FORM = {
  username: '', password: '', firstName: '', lastName: '',
  email: '', role: 'collector', active: true
};

export default function UserFormModal({ isOpen, onClose, onSubmit }) {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useModalEscape(isOpen, onClose);

  useEffect(() => {
    if (!isOpen) return;
    setForm({ ...EMPTY_FORM });
    setError('');
    setSubmitting(false);
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username || !form.password || !form.role) {
      setError('Nom d\'utilisateur, mot de passe et rôle obligatoires.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await onSubmit(form);
      onClose();
    } catch (err) {
      setError(err.message || 'Erreur serveur.');
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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90dvh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <i className="fas fa-user-plus text-primary text-sm"></i>
            </div>
            <h2 className="text-lg font-bold text-slate-900">Nouvel utilisateur</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Fermer"
          >
            <i className="fas fa-times text-sm"></i>
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700">
            <i className="fas fa-exclamation-circle shrink-0"></i>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Identifiant <span className="text-rose-600">*</span></label>
              <input type="text" required value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 shadow-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Mot de passe <span className="text-rose-600">*</span></label>
              <input type="password" required value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 shadow-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Prénom</label>
              <input type="text" value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 shadow-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Nom</label>
              <input type="text" value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 shadow-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input type="email" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 shadow-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Rôle <span className="text-rose-600">*</span></label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 shadow-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all">
                <option value="admin">Administrateur</option>
                <option value="director">Directeur</option>
                <option value="accounting">Comptable</option>
                <option value="collector_manager">Manager des Récolteurs</option>
                <option value="collector">Récolteur</option>
              </select>
            </div>
          </div>
          </div>

          {/* Footer */}
          <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-60"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark transition-colors shadow-sm shadow-primary/20 disabled:opacity-60"
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
