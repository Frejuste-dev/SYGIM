import React, { useState, useEffect } from 'react';
import { useToast } from './ToastContext';

const EMPTY_FORM = {
  lastName: '', firstName: '', phone: '', email: '', address: '',
  propertyId: '', rent: 0, deposit: 0,
  startDate: new Date().toISOString().split('T')[0],
  endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]
};

// Classes partagées
const INPUT_CLS = 'w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 shadow-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder-slate-400';
const LABEL_CLS = 'block text-sm font-medium text-slate-700 mb-1.5';

function Field({ label, required, children }) {
  return (
    <div>
      <label className={LABEL_CLS}>
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

export default function NewTenantModal({ isOpen, onClose, properties = [], onSubmit }) {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (!isOpen) return;
    setForm({ ...EMPTY_FORM });
    setIsSubmitting(false);
  }, [isOpen]);

  // Fermeture sur Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const handleChange = (field, value) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'propertyId') {
        const p = properties.find(p => p.id === parseInt(value));
        if (p) {
          next.rent = p.rent || Math.round((p.value || 0) * 0.003) || 50000;
          next.address = p.address || '';
        }
      }
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const pId = parseInt(form.propertyId);
    if (!form.lastName.trim() || !form.firstName.trim() || !form.phone.trim() || !pId || !form.rent) {
      showToast({ type: 'warning', message: 'Veuillez remplir tous les champs obligatoires.' });
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit(form);
      onClose();
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Erreur lors de la creation du locataire.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Proprietes disponibles : vacantes, en renovation, ou sans locataire
  const availableProperties = properties.filter(
    p => p.status === 'vacant' || p.status === 'en_renovation' || !p.tenantId
  );

  return (
    /* Overlay */
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Panneau */}
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90dvh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <i className="fas fa-user-plus text-primary text-sm"></i>
            </div>
            <h2 className="text-lg font-bold text-slate-900">Ajouter un locataire</h2>
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

        {/* Corps du formulaire */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-6 space-y-5 overflow-y-auto flex-1">

            {/* Nom / Prenom */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field label="Prénom" required>
                <input
                  id="tenantFirstName"
                  type="text"
                  required
                  placeholder="Ex : Kofi"
                  value={form.firstName}
                  onChange={e => handleChange('firstName', e.target.value)}
                  className={INPUT_CLS}
                />
              </Field>
              <Field label="Nom de famille" required>
                <input
                  id="tenantLastName"
                  type="text"
                  required
                  placeholder="Ex : Mensah"
                  value={form.lastName}
                  onChange={e => handleChange('lastName', e.target.value)}
                  className={INPUT_CLS}
                />
              </Field>
            </div>

            {/* Telephone / Email */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field label="Téléphone" required>
                <input
                  id="tenantPhone"
                  type="tel"
                  required
                  placeholder="Ex : +225 07 XX XX XX"
                  value={form.phone}
                  onChange={e => handleChange('phone', e.target.value)}
                  className={INPUT_CLS}
                />
              </Field>
              <Field label="Email">
                <input
                  id="tenantEmail"
                  type="email"
                  placeholder="Ex : kofi@email.com"
                  value={form.email}
                  onChange={e => handleChange('email', e.target.value)}
                  className={INPUT_CLS}
                />
              </Field>
            </div>

            {/* Bien immobilier */}
            <Field label="Bien disponible" required>
              <select
                id="tenantPropertyId"
                required
                value={form.propertyId}
                onChange={e => handleChange('propertyId', e.target.value)}
                className={INPUT_CLS}
              >
                <option value="">-- Choisir un bien disponible --</option>
                {availableProperties.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} â€” {p.address} ({p.type || 'N/A'})
                  </option>
                ))}
              </select>
              {availableProperties.length === 0 && (
                <p className="text-xs text-amber-600 mt-1.5">
                  <i className="fas fa-exclamation-triangle mr-1"></i>
                  Aucun bien disponible. Vérifiez le statut de vos biens.
                </p>
              )}
            </Field>

            {/* Adresse (auto-remplie, modifiable) */}
            <Field label="Adresse du bien">
              <input
                id="tenantAddress"
                type="text"
                placeholder="Adresse renseignée automatiquement"
                value={form.address}
                onChange={e => handleChange('address', e.target.value)}
                className={`${INPUT_CLS} bg-slate-50`}
              />
            </Field>

            {/* Loyer / Caution */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field label="Loyer mensuel (XOF)" required>
                <input
                  id="tenantRent"
                  type="number"
                  required
                  min="0"
                  step="1000"
                  placeholder="Ex : 150 000"
                  value={form.rent}
                  onChange={e => handleChange('rent', parseInt(e.target.value) || 0)}
                  className={INPUT_CLS}
                />
              </Field>
              <Field label="Caution (XOF)">
                <input
                  id="tenantDeposit"
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="Ex : 300 000"
                  value={form.deposit}
                  onChange={e => handleChange('deposit', parseInt(e.target.value) || 0)}
                  className={INPUT_CLS}
                />
              </Field>
            </div>

            {/* Dates de contrat */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field label="Date de début" required>
                <input
                  id="tenantStartDate"
                  type="date"
                  required
                  value={form.startDate}
                  onChange={e => handleChange('startDate', e.target.value)}
                  className={INPUT_CLS}
                />
              </Field>
              <Field label="Date de fin (optionnelle)">
                <input
                  id="tenantEndDate"
                  type="date"
                  value={form.endDate}
                  onChange={e => handleChange('endDate', e.target.value)}
                  className={INPUT_CLS}
                />
              </Field>
            </div>

          </div>

          {/* Footer - boutons */}
          <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-60"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark transition-colors shadow-sm shadow-primary/20 disabled:opacity-60"
            >
              {isSubmitting && <i className="fas fa-spinner fa-spin text-xs"></i>}
              {isSubmitting ? 'Enregistrement...' : 'Enregistrer le locataire'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


