import React, { useState } from 'react';
import Modal from './Modal';
import { useToast } from './ToastContext';
import { API } from '../api/services';
import { formatXOF } from '../utils/formatters';
import { FormField, MoneyInput, FormSection } from './ui/forms';

export default function TenantRepairModal({ isOpen, onClose, client, onSuccess }) {
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    description: '',
    totalCost: 0,
    deductionMode: 'monthly', // 'monthly' | 'immediate'
    monthlyDeduction: 0,
    repairDate: new Date().toISOString().slice(0, 10),
    receiptRef: '',
    notes: ''
  });

  if (!isOpen || !client) return null;

  const clientName = `${client.last_name ?? client.lastName ?? ''} ${client.first_name ?? client.firstName ?? ''}`.trim() || 'Locataire';
  const propertyTitle = client.property_title || client.propertyName || client.address || 'Logement';
  const rentDue = client.amount_due ?? client.amountDue ?? 0;

  const totalCostNum = Number(formData.totalCost) || 0;
  const monthlyDedNum = formData.deductionMode === 'immediate'
    ? totalCostNum
    : (Number(formData.monthlyDeduction) || 0);

  const monthsDuration = (totalCostNum > 0 && monthlyDedNum > 0)
    ? Math.ceil(totalCostNum / monthlyDedNum)
    : 1;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.description.trim()) {
      showToast({ type: 'error', message: 'Veuillez saisir une description de la réparation.' });
      return;
    }
    if (totalCostNum <= 0) {
      showToast({ type: 'error', message: 'Le montant total des réparations doit être supérieur à 0 FCFA.' });
      return;
    }
    if (formData.deductionMode === 'monthly' && monthlyDedNum <= 0) {
      showToast({ type: 'error', message: 'Veuillez définir un montant de déduction mensuelle valide.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        clientId: client.id,
        propertyId: client.property_id || null,
        description: formData.description.trim(),
        totalCost: totalCostNum,
        deductionMode: formData.deductionMode,
        monthlyDeduction: monthlyDedNum,
        repairDate: formData.repairDate,
        receiptRef: formData.receiptRef.trim() || null,
        notes: formData.notes.trim() || null
      };

      const res = await API.Repairs.create(payload);
      if (res?.success || res?.data) {
        showToast({
          type: 'success',
          message: `Réparation de ${formatXOF(totalCostNum)} enregistrée ! Déduction de ${formatXOF(monthlyDedNum)} activée sur le loyer.`
        });
        if (onSuccess) onSuccess();
        onClose();
      } else {
        showToast({
          type: 'error',
          message: res?.error || 'Erreur lors de l\'enregistrement de la réparation.'
        });
      }
    } catch (err) {
      showToast({
        type: 'error',
        message: err.message || 'Impossible d\'enregistrer la réparation.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const deductionPresets = [];
  if (totalCostNum > 0) {
    deductionPresets.push({ label: '50% (2 mois)', value: Math.round(totalCostNum / 2) });
    deductionPresets.push({ label: '100% (1 mois)', value: totalCostNum });
    if (totalCostNum >= 60000) {
      deductionPresets.push({ label: '33% (3 mois)', value: Math.round(totalCostNum / 3) });
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Enregistrer une réparation locataire"
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* En-tête informatif */}
        <div className="bg-blue-50/80 rounded-2xl border border-blue-200/90 p-3.5 space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center text-base shrink-0">
              <i className="fas fa-wrench"></i>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm">{clientName}</h4>
              <p className="text-xs text-slate-600">
                Logement : <span className="font-semibold">{propertyTitle}</span> &bull; Loyer contractuel : <span className="font-bold text-slate-800">{formatXOF(rentDue)}</span>
              </p>
            </div>
          </div>
          <p className="text-xs text-blue-800">
            Les dépenses engagées par le locataire pour ces travaux seront déduites de son loyer jusqu'à épongement total du montant.
          </p>
        </div>

        <FormSection
          icon="fa-screwdriver-wrench"
          title="Détails des Travaux"
          subtitle="Description, montant total et date d'exécution"
        >
          <FormField label="Nature des travaux / Description" required>
            <input
              type="text"
              required
              placeholder="Ex : Réfection plomberie, serrure, étanchéité toiture..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
            <FormField label="Montant total des travaux" required hint="Dépense totale engagée">
              <MoneyInput
                value={formData.totalCost}
                onChange={(e, num) => {
                  const cost = (num ?? Number(e?.target?.value)) || 0;
                  setFormData({
                    ...formData,
                    totalCost: cost,
                    monthlyDeduction: formData.monthlyDeduction || Math.round(cost / 2)
                  });
                }}
                currency="FCFA"
                size="md"
              />
            </FormField>

            <FormField label="Date des travaux" required hint="Date d'intervention">
              <input
                type="date"
                required
                value={formData.repairDate}
                onChange={(e) => setFormData({ ...formData, repairDate: e.target.value })}
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-primary"
              />
            </FormField>
          </div>
        </FormSection>

        {/* Mode d'imputation / déduction */}
        <FormSection
          icon="fa-scale-balanced"
          title="Modalité d'Imputation sur Loyer"
          subtitle="Étalement mensuel ou déduction intégrale immédiate"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <label
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                formData.deductionMode === 'monthly'
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="deductionMode"
                value="monthly"
                checked={formData.deductionMode === 'monthly'}
                onChange={() => setFormData({ ...formData, deductionMode: 'monthly' })}
                className="mt-0.5 text-primary focus:ring-primary"
              />
              <div className="text-xs">
                <span className="font-bold block">Déduction mensuelle étalée</span>
                <span className="text-slate-500">Imputer un montant fixe chaque mois sur plusieurs loyers.</span>
              </div>
            </label>

            <label
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                formData.deductionMode === 'immediate'
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="deductionMode"
                value="immediate"
                checked={formData.deductionMode === 'immediate'}
                onChange={() => setFormData({ ...formData, deductionMode: 'immediate' })}
                className="mt-0.5 text-primary focus:ring-primary"
              />
              <div className="text-xs">
                <span className="font-bold block">Déduction intégrale immédiate</span>
                <span className="text-slate-500">Imputer la totalité des dépenses dès le prochain loyer.</span>
              </div>
            </label>
          </div>

          {formData.deductionMode === 'monthly' && (
            <FormField label="Montant de déduction par mois" required hint="Retenu sur chaque appel de loyer">
              <MoneyInput
                value={formData.monthlyDeduction}
                onChange={(e, num) => setFormData({ ...formData, monthlyDeduction: (num ?? Number(e?.target?.value)) || 0 })}
                presets={deductionPresets}
                currency="FCFA"
                size="md"
              />
              {totalCostNum > 0 && monthlyDedNum > 0 && (
                <p className="text-xs text-slate-600 mt-2 flex items-center justify-between p-2.5 bg-slate-100 rounded-xl border border-slate-200">
                  <span>Durée d'amortissement :</span>
                  <span className="font-bold text-slate-800">
                    {monthsDuration} mois &bull; Net à payer chaque mois :{' '}
                    <span className="text-emerald-700 font-extrabold">{formatXOF(Math.max(0, rentDue - monthlyDedNum))}</span>
                  </span>
                </p>
              )}
            </FormField>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Réf. Facture / Reçu artisan" optional hint="Ex : FACT-PLOMB-2026">
              <input
                type="text"
                placeholder="Ex : FACT-PLOMB-2026"
                value={formData.receiptRef}
                onChange={(e) => setFormData({ ...formData, receiptRef: e.target.value })}
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-primary"
              />
            </FormField>

            <FormField label="Notes & Commentaires" optional hint="Observations agence">
              <input
                type="text"
                placeholder="Ex : Validé avec le propriétaire"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-primary"
              />
            </FormField>
          </div>
        </FormSection>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isSubmitting || totalCostNum <= 0}
            className="px-5 py-2.5 text-sm font-bold text-white bg-primary hover:bg-primary-dark rounded-xl shadow-sm transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <i className="fas fa-spinner fa-spin"></i> Enregistrement...
              </>
            ) : (
              <>
                <i className="fas fa-check"></i> Activer la déduction sur le loyer
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
