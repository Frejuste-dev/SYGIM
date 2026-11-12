import React, { useState } from 'react';
import Modal from './Modal';
import { useToast } from './ToastContext';
import { API } from '../api/services';

export default function TenantDepartureModal({ isOpen, onClose, client, onSuccess }) {
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    departureDate: new Date().toISOString().slice(0, 10),
    departureReason: 'Fin de bail / Départ volontaire',
    departureNotes: ''
  });

  if (!isOpen || !client) return null;

  const clientName = `${client.last_name ?? client.lastName ?? ''} ${client.first_name ?? client.firstName ?? ''}`.trim() || 'Locataire';
  const propertyTitle = client.property_title || client.propertyName || client.address || 'Logement';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await API.Clients.depart(client.id, formData);
      if (res?.success) {
        showToast({
          type: 'success',
          message: `Départ de ${clientName} enregistré. Le bien "${propertyTitle}" est désormais VACANT.`
        });
        if (onSuccess) onSuccess();
        onClose();
      } else {
        showToast({
          type: 'error',
          message: res?.error || 'Erreur lors de l\'enregistrement du départ.'
        });
      }
    } catch (err) {
      showToast({
        type: 'error',
        message: err.message || 'Impossible de libérer le bien.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Signaler le départ du locataire"
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Résumé du locataire et du bien libéré */}
        <div className="bg-amber-50/80 rounded-2xl border border-amber-200/90 p-4 space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-base shrink-0">
              <i className="fas fa-person-walking-luggage"></i>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm">{clientName}</h4>
              <p className="text-xs text-slate-600">
                Logement : <span className="font-semibold">{propertyTitle}</span>
              </p>
            </div>
          </div>
          <div className="text-xs text-amber-800 bg-amber-100/60 rounded-xl p-2.5 flex items-start gap-2">
            <i className="fas fa-info-circle text-amber-600 text-xs mt-0.5 shrink-0"></i>
            <span>
              En validant, le contrat du locataire sera clôturé et le logement sera automatiquement marqué comme <strong>VACANT (Vide)</strong> pour pouvoir être réattribué.
            </span>
          </div>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wider font-bold text-slate-600 mb-1.5">
            Date de départ effective <span className="text-rose-500">*</span>
          </label>
          <input
            type="date"
            required
            value={formData.departureDate}
            onChange={(e) => setFormData({ ...formData, departureDate: e.target.value })}
            className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wider font-bold text-slate-600 mb-1.5">
            Motif du départ <span className="text-rose-500">*</span>
          </label>
          <select
            value={formData.departureReason}
            onChange={(e) => setFormData({ ...formData, departureReason: e.target.value })}
            className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            <option value="Fin de bail / Départ volontaire">Fin de bail / Départ volontaire</option>
            <option value="Déménagement">Déménagement (mutation / changement de ville)</option>
            <option value="Résiliation anticipée">Résiliation anticipée</option>
            <option value="Non-renouvellement de contrat">Non-renouvellement de contrat</option>
            <option value="Expulsion / Contentieux">Expulsion / Contentieux</option>
            <option value="Autre motif">Autre motif</option>
          </select>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wider font-bold text-slate-600 mb-1.5">
            État des lieux de sortie & Observations
          </label>
          <textarea
            rows="3"
            placeholder="Clés remises, état du logement, dégradations éventuelles, caution..."
            value={formData.departureNotes}
            onChange={(e) => setFormData({ ...formData, departureNotes: e.target.value })}
            className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          ></textarea>
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
            className="px-5 py-2.5 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm transition disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <i className="fas fa-spinner fa-spin"></i> Libération...
              </>
            ) : (
              <>
                <i className="fas fa-door-open"></i> Confirmer départ & Libérer logement
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

