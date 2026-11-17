import React, { useState } from 'react';
import Modal from './Modal';
import { useToast } from './ToastContext';
import { API } from '../api/services';
import { formatXOF } from '../utils/formatters';
import { FormField, MoneyInput, PhoneInput, FormSection } from './ui/forms';

export default function AssignPropertyModal({ isOpen, onClose, property, clients = [], onSuccess }) {
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mode, setMode] = useState('existing'); // 'existing' | 'new'

  const [selectedClientId, setSelectedClientId] = useState('');
  const [tenantSearch, setTenantSearch] = useState('');
  const [rent, setRent] = useState(0);
  const [deposit, setDeposit] = useState(0);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));

  const [newTenant, setNewTenant] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    address: ''
  });

  // Initialisation à l'ouverture
  React.useEffect(() => {
    if (isOpen && property) {
      const initialRent = Number(property.rent || 0);
      setRent(initialRent);
      setDeposit(property.deposit ? Number(property.deposit) : initialRent * 2);
      setStartDate(new Date().toISOString().slice(0, 10));
      setSelectedClientId('');
      setTenantSearch('');
    }
  }, [isOpen, property]);

  if (!isOpen || !property) return null;

  const numericRent = Number(rent) || 0;
  const numericDeposit = Number(deposit) || 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let payload = {
        rent: numericRent || parseFloat(property.rent || 0),
        deposit: numericDeposit,
        startDate
      };

      if (mode === 'existing') {
        if (!selectedClientId) {
          showToast({ type: 'error', message: 'Veuillez sélectionner un locataire existant.' });
          setIsSubmitting(false);
          return;
        }
        payload.clientId = parseInt(selectedClientId, 10);
      } else {
        if (!newTenant.lastName.trim() || !newTenant.phone.trim()) {
          showToast({ type: 'error', message: 'Le nom et le numéro de téléphone sont obligatoires pour le nouveau locataire.' });
          setIsSubmitting(false);
          return;
        }
        const cleanPhone = String(newTenant.phone).replace(/\D/g, '');
        const actualDigits = cleanPhone.startsWith('225') ? cleanPhone.slice(3) : cleanPhone;
        if (actualDigits.length < 10) {
          showToast({ type: 'error', message: 'Le numéro de téléphone ivoirien doit comporter 10 chiffres (ex: 07 09 88 14 42).' });
          setIsSubmitting(false);
          return;
        }

        payload.newTenant = {
          firstName: newTenant.firstName.trim(),
          lastName: newTenant.lastName.trim(),
          phone: cleanPhone.startsWith('225') ? `+${cleanPhone}` : cleanPhone,
          email: newTenant.email.trim() || null,
          address: newTenant.address.trim() || property.address || null
        };
      }

      const res = await API.Properties.assignTenant(property.id, payload);
      if (res?.success) {
        showToast({
          type: 'success',
          message: `Le bien "${property.name}" a été attribué avec succès ! Statut mis à jour : LOUÉ.`
        });
        if (onSuccess) onSuccess();
        onClose();
      } else {
        showToast({
          type: 'error',
          message: res?.error || 'Erreur lors de l\'attribution du bien.'
        });
      }
    } catch (err) {
      showToast({
        type: 'error',
        message: err.message || 'Impossible d\'attribuer le logement.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const depositPresets = [];
  if (numericRent > 0) {
    depositPresets.push({ label: '2 mois (recommandé)', value: numericRent * 2 });
    depositPresets.push({ label: '1 mois', value: numericRent });
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Attribuer un logement vacant"
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Résumé du logement à attribuer */}
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50/60 rounded-2xl border border-emerald-200/90 p-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <i className="fas fa-building text-sm"></i>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-900 text-sm truncate">{property.name}</span>
                {property.reference_code && (
                  <span className="font-mono text-[11px] font-semibold bg-white/80 text-slate-600 px-2 py-0.5 rounded-md border border-emerald-200">
                    {property.reference_code}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 flex items-center gap-1.5 mt-1 truncate">
                <i className="fas fa-location-dot text-emerald-600"></i>
                <span>{property.zone || property.address || 'Adresse non renseignée'}</span>
                <span>&bull;</span>
                <span className="font-bold text-slate-900">Réf. {formatXOF(property.rent || 0)}/mois</span>
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold text-emerald-700 bg-white px-2.5 py-1 rounded-full border border-emerald-200 shrink-0 shadow-2xs">
            Vacant
          </span>
        </div>

        {/* Sélection Mode d'attribution */}
        <div className="grid grid-cols-2 rounded-xl border border-slate-200 p-1 bg-slate-100 gap-1">
          <button
            type="button"
            onClick={() => setMode('existing')}
            className={`py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
              mode === 'existing'
                ? 'bg-white text-primary shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <i className="fas fa-user-check"></i>
            <span>Locataire existant</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('new')}
            className={`py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
              mode === 'new'
                ? 'bg-white text-primary shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <i className="fas fa-user-plus"></i>
            <span>Nouveau locataire</span>
          </button>
        </div>

        {/* Formulaire selon mode */}
        {mode === 'existing' ? (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Choisir le locataire <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400">
                {clients.length} locataire{clients.length > 1 ? 's' : ''} enregistré{clients.length > 1 ? 's' : ''}
              </span>
            </div>

            <div className="relative">
              <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
              <input
                type="text"
                placeholder="Rechercher par nom, prénom ou téléphone..."
                value={tenantSearch}
                onChange={(e) => setTenantSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
              {tenantSearch && (
                <button
                  type="button"
                  onClick={() => setTenantSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <i className="fas fa-times text-xs"></i>
                </button>
              )}
            </div>

            <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-2 pr-1">
              {clients
                .filter((c) => {
                  if (!tenantSearch.trim()) return true;
                  const q = tenantSearch.toLowerCase();
                  const fullName = `${c.last_name || c.lastName || ''} ${c.first_name || c.firstName || ''}`.toLowerCase();
                  const phone = (c.phone || '').toLowerCase();
                  return fullName.includes(q) || phone.includes(q);
                })
                .map((c) => {
                  const fullName = `${c.last_name || c.lastName || ''} ${c.first_name || c.firstName || ''}`.trim() || 'Locataire';
                  const initials = fullName.split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || 'L';
                  const isChecked = String(selectedClientId) === String(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedClientId(String(c.id))}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                        isChecked
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-2xs'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          isChecked ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">{fullName}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 truncate">
                            <span>{c.phone || 'Sans tél.'}</span>
                            <span>&bull;</span>
                            {c.property_name ? (
                              <span className="text-amber-700 font-medium truncate">Actuellement : {c.property_name}</span>
                            ) : (
                              <span className="text-emerald-700 font-semibold">Disponible (sans bien)</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                        isChecked ? 'bg-primary border-primary text-white' : 'border-slate-300 bg-white'
                      }`}>
                        {isChecked && <i className="fas fa-check text-[10px]"></i>}
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        ) : (
          <FormSection
            icon="fa-user-plus"
            title="Nouveau Locataire"
            subtitle="Création immédiate de la fiche locataire lors de la prise à bail"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Nom de famille" required>
                <input
                  type="text"
                  required
                  placeholder="Ex : KOUAME"
                  value={newTenant.lastName}
                  onChange={(e) => setNewTenant({ ...newTenant, lastName: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-primary"
                />
              </FormField>
              <FormField label="Prénom" optional>
                <input
                  type="text"
                  placeholder="Ex : Jean-Luc"
                  value={newTenant.firstName}
                  onChange={(e) => setNewTenant({ ...newTenant, firstName: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-primary"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Téléphone portable" required hint="10 chiffres (CI)">
                <PhoneInput
                  value={newTenant.phone}
                  onChange={(e, clean) => setNewTenant({ ...newTenant, phone: clean ?? e?.target?.value })}
                  placeholder="07 09 88 14 42"
                />
              </FormField>
              <FormField label="Email" optional>
                <input
                  type="email"
                  placeholder="Ex : jean@example.com"
                  value={newTenant.email}
                  onChange={(e) => setNewTenant({ ...newTenant, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-primary"
                />
              </FormField>
            </div>
          </FormSection>
        )}

        {/* Modalités contractuelles du bien attribué */}
        <FormSection
          icon="fa-file-signature"
          title="Conditions Contractuelles du Bail"
          subtitle="Loyer convenu, dépôt de garantie (caution séquestre) et date d'effet"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
            <FormField label="Loyer convenu" required hint="Appelé mensuellement">
              <MoneyInput
                value={rent}
                onChange={(e, num) => {
                  const newRent = (num ?? Number(e?.target?.value)) || 0;
                  setRent(newRent);
                  // Met à jour la suggestion de caution si caution égale à 2x l'ancien loyer
                  if (deposit === 0 || deposit === numericRent * 2) {
                    setDeposit(newRent * 2);
                  }
                }}
                currency="FCFA"
                size="md"
              />
            </FormField>

            <FormField label="Caution versée" optional hint="Dépôt de garantie séquestre">
              <MoneyInput
                value={deposit}
                onChange={(e, num) => setDeposit((num ?? Number(e?.target?.value)) || 0)}
                presets={depositPresets}
                currency="FCFA"
                size="md"
              />
            </FormField>

            <FormField label="Date d'entrée" required hint="Début d'effet du contrat">
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-primary"
              />
            </FormField>
          </div>

          <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium">
              <i className="fas fa-calculator text-primary mr-1.5"></i>
              Total à prévoir à l'entrée (1er loyer + caution) :
            </span>
            <span className="text-sm font-extrabold text-slate-900 tabular-nums">
              {formatXOF(numericRent + numericDeposit)}
            </span>
          </div>
        </FormSection>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !numericRent || (mode === 'existing' && !selectedClientId)}
            className="px-5 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <i className="fas fa-spinner fa-spin"></i> Attribution en cours...
              </>
            ) : (
              <>
                <i className="fas fa-key"></i> Valider l'attribution du logement
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
