import React, { useState, useEffect } from 'react';
import { API } from '../api/services';
import { formatXOF, formatDate, formatMethod } from '../utils/formatters';
import { printOwnerSettlementReceipt } from '../utils/exportUtils';
import { useToast } from './ToastContext';

export default function InstallmentHistoryModal({ settlement, onClose, onSuccess }) {
  const { showToast } = useToast();
  const remaining = Math.max(0, Number(settlement?.remaining_to_pay || 0));

  const [amount, setAmount] = useState(remaining > 0 ? remaining : 0);
  const [paymentMethod, setPaymentMethod] = useState(settlement?.payment_method || 'bank_transfer');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (settlement) {
      setAmount(Math.max(0, Number(settlement.remaining_to_pay || 0)));
      setPaymentMethod(settlement.payment_method || 'bank_transfer');
      setReference('');
      setNotes('');
    }
  }, [settlement]);

  if (!settlement) return null;

  const installments = Array.isArray(settlement.installments) && settlement.installments.length > 0
    ? settlement.installments
    : [{
        id: 'init-1',
        installment_number: 1,
        amount: settlement.amount_paid || settlement.net_amount,
        payment_method: settlement.payment_method || 'bank_transfer',
        payment_date: settlement.payout_date || settlement.created_at,
        reference: settlement.transaction_reference || settlement.payout_reference || `TR1-${settlement.id}`,
        notes: settlement.notes || '1er versement'
      }];

  const handleAddInstallment = async (e) => {
    e.preventDefault();
    const numAmt = parseFloat(amount);
    if (!numAmt || numAmt <= 0) {
      showToast({ type: 'error', message: 'Veuillez saisir un montant de tranche valide (> 0 FCFA).' });
      return;
    }
    setSubmitting(true);
    try {
      await API.Financial.paySettlement(settlement.id, {
        additional_amount: numAmt,
        payment_method: paymentMethod,
        payout_reference: reference.trim() || undefined,
        notes: notes.trim() || `Versement tranche N°${installments.length + 1}`
      });
      showToast({ type: 'success', message: `Tranche de ${formatXOF(numAmt, { compact: false })} enregistrée avec succès.` });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Erreur lors de l\'enregistrement de la tranche.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1050] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <i className="fas fa-layer-group text-primary"></i>
              Suivi des Tranches & Versements — {settlement.owner_name || `Propriétaire #${settlement.owner_id}`}
            </h3>
            <p className="text-xs text-slate-500">
              Réf : <span className="font-mono font-semibold">{settlement.transaction_reference || `REV-${settlement.id}`}</span> &bull; Bien(s) : {settlement.property_name || 'Tous les biens'}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60">
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Synthèse des montants */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="text-[11px] uppercase font-bold text-slate-500">Net Total à Reverser</div>
              <div className="text-base font-extrabold text-slate-900 mt-1">{formatXOF(settlement.net_amount, { compact: false })}</div>
            </div>
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <div className="text-[11px] uppercase font-bold text-emerald-700">Total Déjà Versé ({installments.length} tranche{installments.length > 1 ? 's' : ''})</div>
              <div className="text-base font-extrabold text-emerald-700 mt-1">{formatXOF(settlement.amount_paid, { compact: false })}</div>
            </div>
            <div className={`p-3 rounded-xl border ${remaining > 0 ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'}`}>
              <div className={`text-[11px] uppercase font-bold ${remaining > 0 ? 'text-rose-700' : 'text-slate-500'}`}>Reste à Payer</div>
              <div className={`text-base font-extrabold mt-1 ${remaining > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                {formatXOF(remaining, { compact: false })}
              </div>
            </div>
          </div>

          {/* Tableau historique des tranches */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5 flex items-center gap-1.5">
              <i className="fas fa-history text-primary"></i>
              Historique Détaillé des Versements Partiels
            </h4>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 uppercase font-semibold">
                    <th className="py-2.5 px-3">N° Tranche</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Moyen</th>
                    <th className="py-2.5 px-3">Référence</th>
                    <th className="py-2.5 px-3">Observation</th>
                    <th className="py-2.5 px-3 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {installments.map((inst) => (
                    <tr key={inst.id || inst.installment_number} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold text-primary">Tranche #{inst.installment_number}</td>
                      <td className="py-2.5 px-3 text-slate-600">{formatDate(inst.payment_date || inst.created_at)}</td>
                      <td className="py-2.5 px-3 text-slate-700">{formatMethod(inst.payment_method)}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{inst.reference || '—'}</td>
                      <td className="py-2.5 px-3 text-slate-600">{inst.notes || '—'}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-700">{formatXOF(inst.amount, { compact: false })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Formulaire d'ajout d'une nouvelle tranche si remaining > 0 */}
          {remaining > 0 && (
            <form onSubmit={handleAddInstallment} className="bg-blue-50/60 border border-blue-200 rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-2">
                  <i className="fas fa-plus-circle text-blue-600"></i>
                  Enregistrer un Nouveau Versement (Tranche N°{installments.length + 1})
                </h4>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAmount(Math.round(remaining / 2))}
                    className="px-2 py-0.5 bg-white border border-blue-200 rounded text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
                  >
                    50% du reste ({formatXOF(Math.round(remaining / 2))})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmount(remaining)}
                    className="px-2 py-0.5 bg-blue-600 text-white rounded text-[11px] font-semibold hover:bg-blue-700"
                  >
                    Solder 100% ({formatXOF(remaining)})
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Montant de la tranche (FCFA) *</label>
                  <input
                    type="number"
                    min="1"
                    max={remaining}
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-white border-2 border-blue-400 rounded-xl text-sm font-extrabold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Moyen de paiement *</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900"
                  >
                    <option value="bank_transfer">Virement bancaire</option>
                    <option value="mobile_money">Mobile Money (Wave/OM/MTN)</option>
                    <option value="cheque">Chèque bancaire</option>
                    <option value="cash">Espèces</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Référence du versement</label>
                  <input
                    type="text"
                    placeholder="Ex: VIR-TR2-9012"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Note / Observation</label>
                  <input
                    type="text"
                    placeholder={`Ex: Versement tranche N°${installments.length + 1}`}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-2"
                >
                  <i className={`fas ${submitting ? 'fa-spinner fa-spin' : 'fa-check-circle'}`}></i>
                  {submitting ? 'Enregistrement...' : `Valider la Tranche N°${installments.length + 1}`}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={() => printOwnerSettlementReceipt(settlement)}
            className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors"
          >
            <i className="fas fa-print"></i> Imprimer le Bordereau / Reçu PDF
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

