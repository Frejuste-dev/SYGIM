import React, { useState } from 'react';
import Modal from './Modal';
import { useToast } from './ToastContext';
import { API } from '../api/services';
import { formatXOF } from '../utils/formatters';

export default function AssignPropertyModal({ isOpen, onClose, property, clients = [], onSuccess }) {
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mode, setMode] = useState('existing'); // 'existing' | 'new'

  const [selectedClientId, setSelectedClientId] = useState('');
  const [rent, setRent] = useState('');
  const [deposit, setDeposit] = useState('');
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
      setRent(property.rent || '');
      setDeposit(property.deposit || (property.rent ? property.rent * 2 : ''));
      setStartDate(new Date().toISOString().slice(0, 10));
      setSelectedClientId('');
    }
  }, [isOpen, property]);

  if (!isOpen || !property) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let payload = {
        rent: parseFloat(rent || property.rent || 0),
        deposit: parseFloat(deposit || 0),
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
        payload.newTenant = {
          firstName: newTenant.firstName.trim(),
          lastName: newTenant.lastName.trim(),
          phone: newTenant.phone.trim(),
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
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
              mode === 'existing'
                ? 'bg-white text-primary shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <i className="fas fa-user-check mr-1.5"></i> Locataire existant
          </button>
          <button
            type="button"
            onClick={() => setMode('new')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
              mode === 'new'
                ? 'bg-white text-primary shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <i className="fas fa-user-plus mr-1.5"></i> Nouveau locataire sur place
          </button>
        </div>

        {/* Formulaire selon mode */}
        {mode === 'existing' ? (
          <div>
            <label className="block text-xs uppercase tracking-wider font-bold text-slate-600 mb-1.5">
              Sélectionner le locataire <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="">-- Choisir un locataire --</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.last_name || c.lastName} {c.first_name || c.firstName} ({c.phone || 'Sans tel'})
                  {c.property_name ? ` - Actuellement : ${c.property_name}` : ' - Sans bien'}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="space-y-3 bg-slate-50/80 rounded-2xl p-3.5 border border-slate-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs uppercase tracking-wider font-bold text-slate-600 mb-1">
                  Nom <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex : KOUAME"
                  value={newTenant.lastName}
                  onChange={(e) => setNewTenant({ ...newTenant, lastName: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider font-bold text-slate-600 mb-1">
                  Prénom
                </label>
                <input
                  type="text"
                  placeholder="Ex : Jean-Luc"
                  value={newTenant.firstName}
                  onChange={(e) => setNewTenant({ ...newTenant, firstName: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs uppercase tracking-wider font-bold text-slate-600 mb-1">
                  Téléphone <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="Ex : 0707070707"
                  value={newTenant.phone}
                  onChange={(e) => setNewTenant({ ...newTenant, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider font-bold text-slate-600 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="Ex : jean@example.com"
                  value={newTenant.email}
                  onChange={(e) => setNewTenant({ ...newTenant, email: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>
        )}

        {/* Modalités contractuelles du bien attribué */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs uppercase tracking-wider font-bold text-slate-600 mb-1.5">
              Loyer convenu (FCFA) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              required
              min="0"
              step="1000"
              value={rent}
              onChange={(e) => setRent(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider font-bold text-slate-600 mb-1.5">
              Caution versée (FCFA)
            </label>
            <input
              type="number"
              min="0"
              step="1000"
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider font-bold text-slate-600 mb-1.5">
              Date d'entrée <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <i className="fas fa-spinner fa-spin"></i> Attribution...
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

