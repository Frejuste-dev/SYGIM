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
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Résumé du logement à attribuer */}
        <div className="bg-emerald-50/80 rounded-2xl border border-emerald-200/90 p-3.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900 text-sm">{property.name}</span>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
              Vacant / Disponible
            </span>
          </div>
          <p className="text-xs text-slate-600 flex items-center gap-1.5">
            <i className="fas fa-location-dot text-slate-400"></i>
            {property.address || 'Sans adresse'} &bull; Loyer de référence : <span className="font-bold text-slate-800">{formatXOF(property.rent || 0)}</span>
          </p>
        </div>

        {/* Sélection Mode d'attribution */}
        <div className="flex rounded-xl border border-slate-200 overflow-hidden p-1 bg-slate-100">
          <button
            type="button"
            onClick={() => setMode('existing')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
              mode === 'existing'
                ? 'bg-white text-primary shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <i className="fas fa-user-check mr-1.5"></i> Locataire existant
          </button>
          <button
            type="button"
            onClick={() => setMode('new')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
              mode === 'new'
                ? 'bg-white text-primary shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <i className="fas fa-user-plus mr-1.5"></i> Nouveau locataire sur place
          </button>
        </div>

        {/* Formulaire selon mode */}
        {mode === 'existing' ? (
          <div className="space-y-3">
            <div className="relative">
              <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
              <input
                type="text"
                placeholder="Rechercher un locataire par nom ou téléphone..."
                value={tenantSearch}
                onChange={(e) => setTenantSearch(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <FormField label="Sélectionner le locataire" required hint="Recherchez un locataire déjà inscrit dans SYGIM">
              <select
                required
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer"
              >
                <option value="">-- Choisir un locataire --</option>
                {clients
                  .filter((c) => {
                    if (!tenantSearch.trim()) return true;
                    const q = tenantSearch.toLowerCase();
                    const fullName = `${c.last_name || c.lastName || ''} ${c.first_name || c.firstName || ''}`.toLowerCase();
                    const phone = (c.phone || '').toLowerCase();
                    return fullName.includes(q) || phone.includes(q);
                  })
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.last_name || c.lastName} {c.first_name || c.firstName} ({c.phone || 'Sans tel'})
                      {c.property_name ? ` - Actuellement : ${c.property_name}` : ' - Sans bien'}
                    </option>
                  ))}
              </select>
            </FormField>
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
            disabled={isSubmitting || !numericRent}
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
