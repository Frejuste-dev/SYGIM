import React, { useState } from 'react';
import Modal from './Modal';
import { useToast } from './ToastContext';
import { API } from '../api/services';
import { formatXOF } from '../utils/formatters';

export default function TenantRepairModal({ isOpen, onClose, client, onSuccess }) {
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    description: '',
    totalCost: '',
    deductionMode: 'monthly', // 'monthly' | 'immediate'
    monthlyDeduction: '',
    repairDate: new Date().toISOString().slice(0, 10),
    receiptRef: '',
    notes: ''
  });

  if (!isOpen || !client) return null;

  const clientName = `${client.last_name ?? client.lastName ?? ''} ${client.first_name ?? client.firstName ?? ''}`.trim() || 'Locataire';
  const propertyTitle = client.property_title || client.propertyName || client.address || 'Logement';
  const rentDue = client.amount_due ?? client.amountDue ?? 0;

  const totalCostNum = parseFloat(formData.totalCost || 0);
  const monthlyDedNum = formData.deductionMode === 'immediate'
    ? totalCostNum
    : parseFloat(formData.monthlyDeduction || 0);

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
      showToast({ type: 'error', message: 'Le montant total des réparations doit être supérieur à 0.' });
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

        <div>
          <label className="block text-xs uppercase tracking-wider font-bold text-slate-600 mb-1.5">
            Nature des travaux / Description <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="Ex : Réfection plomberie, serrure, étanchéité toiture, électricité..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs uppercase tracking-wider font-bold text-slate-600 mb-1.5">
              Montant total des travaux (FCFA) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              required
              min="1000"
              step="500"
              placeholder="Ex : 60000"
              value={formData.totalCost}
              onChange={(e) => {
                const cost = e.target.value;
                setFormData({
                  ...formData,
                  totalCost: cost,
                  // Pré-remplir la déduction mensuelle par défaut avec la moitié ou le tiers si vide
                  monthlyDeduction: formData.monthlyDeduction || (cost ? String(Math.round(cost / 2)) : '')
                });
              }}
              className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider font-bold text-slate-600 mb-1.5">
              Date des travaux <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={formData.repairDate}
              onChange={(e) => setFormData({ ...formData, repairDate: e.target.value })}
              className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* Mode d'imputation / déduction */}
        <div className="space-y-2">
          <label className="block text-xs uppercase tracking-wider font-bold text-slate-600">
            Modalité de remboursement sur le loyer <span className="text-rose-500">*</span>
          </label>
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
        </div>

        {formData.deductionMode === 'monthly' && (
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2">
            <label className="block text-xs uppercase tracking-wider font-bold text-slate-700">
              Montant de la déduction par mois (FCFA) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min="1000"
              step="500"
              placeholder="Ex : 20000"
              value={formData.monthlyDeduction}
              onChange={(e) => setFormData({ ...formData, monthlyDeduction: e.target.value })}
              className="w-full px-4 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-primary"
            />
            {totalCostNum > 0 && monthlyDedNum > 0 && (
              <p className="text-xs text-slate-500 flex items-center justify-between">
                <span>Durée d'amortissement estimée :</span>
                <span className="font-bold text-slate-800">
                  {monthsDuration} mois &bull; Net à payer chaque mois :{' '}
                  <span className="text-emerald-700">{formatXOF(Math.max(0, rentDue - monthlyDedNum))}</span>
                </span>
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs uppercase tracking-wider font-bold text-slate-600 mb-1.5">
              Réf. Facture / Reçu artisan (facultatif)
            </label>
            <input
              type="text"
              placeholder="Ex : FACT-PLOMB-2026"
              value={formData.receiptRef}
              onChange={(e) => setFormData({ ...formData, receiptRef: e.target.value })}
              className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider font-bold text-slate-600 mb-1.5">
              Notes & Commentaires
            </label>
            <input
              type="text"
              placeholder="Ex : Validé avec le propriétaire"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-primary"
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
            className="px-5 py-2.5 text-sm font-bold text-white bg-primary hover:bg-primary-dark rounded-xl shadow-sm transition disabled:opacity-50 flex items-center gap-2"
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
