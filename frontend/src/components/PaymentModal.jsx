import React, { useState, useEffect } from 'react';
import { formatXOF } from '../utils/formatters';
import { FormField, MoneyInput } from './ui/forms';

const PAYMENT_METHODS = [
  { id: 'cash',         name: 'Espèces',           sub: 'Main à main',          icon: 'fa-money-bill-wave',       color: 'text-emerald-600 bg-emerald-50' },
  { id: 'mobile_money', name: 'Mobile Money',      sub: 'Wave / OM / Moov',     icon: 'fa-mobile-screen-button', color: 'text-amber-600 bg-amber-50' },
  { id: 'check',        name: 'Chèque',            sub: 'Bancaire / Certifié',  icon: 'fa-money-check',          color: 'text-purple-600 bg-purple-50' },
  { id: 'bank_transfer',name: 'Virement bancaire', sub: 'Direct compte',       icon: 'fa-university',           color: 'text-sky-600 bg-sky-50' },
];

export default function PaymentModal({ isOpen, onClose, client, onProceedToSignature }) {
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState('mobile_money');
  const [reference, setReference] = useState('');
  const [validationError, setValidationError] = useState('');

  const due = client?.amount_due ?? client?.amountDue ?? 0;
  const paid = client?.amount_paid ?? client?.amountPaid ?? 0;
  const remaining = Math.max(0, due - paid);
  const pendingAmount = parseFloat(client?.pendingAmount || 0);
  const effectiveRemaining = Math.max(0, remaining - pendingAmount);
  const activeRepairRemaining = parseFloat(client?.active_repair_remaining || 0);
  const activeRepairDeduction = parseFloat(client?.active_repair_deduction || 0);
  const isRepairImmediate = client?.active_repair_mode === 'immediate';

  const repairDeduction = activeRepairRemaining > 0
    ? (isRepairImmediate
        ? Math.min(effectiveRemaining, activeRepairRemaining)
        : Math.min(effectiveRemaining, activeRepairDeduction > 0 ? activeRepairDeduction : activeRepairRemaining))
    : 0;

  const netCollectible = Math.max(0, effectiveRemaining - repairDeduction);

  useEffect(() => {
    if (!isOpen || !client) return;
    const clientDue = client.amount_due ?? client.amountDue ?? 0;
    const clientPaid = client.amount_paid ?? client.amountPaid ?? 0;
    const clientRem = Math.max(0, clientDue - clientPaid);
    const clientPend = parseFloat(client.pendingAmount || 0);
    const effRem = Math.max(0, clientRem - clientPend);

    const remRepair = parseFloat(client.active_repair_remaining || 0);
    const dedRepair = parseFloat(client.active_repair_deduction || 0);
    const isImm = client.active_repair_mode === 'immediate';
    const repDed = remRepair > 0 ? (isImm ? Math.min(effRem, remRepair) : Math.min(effRem, dedRepair > 0 ? dedRepair : remRepair)) : 0;
    const net = Math.max(0, effRem - repDed);

    if (client.suggestedAmount !== undefined) {
      setAmount(Number(client.suggestedAmount) || 0);
    } else {
      setAmount(net > 0 ? net : (effRem > 0 ? effRem : clientRem));
    }
    setMethod('mobile_money');
    setReference('');
    setValidationError('');
  }, [isOpen, client]);

  // Fermeture Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !client) return null;

  const lastName = client.last_name ?? client.lastName ?? '';
  const firstName = client.first_name ?? client.firstName ?? '';
  const property = client.property ?? client.propertyName ?? client.property_title ?? client.address ?? 'Bien non renseigné';

  const numericAmount = Number(amount) || 0;
  const isValidAmount = Boolean(numericAmount > 0);

  const handleValidate = () => {
    if (!method) {
      setValidationError('Sélectionnez un mode de paiement pour continuer.');
      return;
    }
    if (!isValidAmount) {
      setValidationError('Le montant doit être supérieur à 0 FCFA.');
      return;
    }
    setValidationError('');
    onProceedToSignature({ amount: numericAmount, method, reference: reference.trim() || `REC-${Date.now()}` });
  };

  // Presets pour MoneyInput
  const presets = [];
  if (repairDeduction > 0 && netCollectible > 0) {
    presets.push({ label: 'Loyer net', value: netCollectible });
  }
  if (remaining > 0) {
    presets.push({ label: 'Tout solder', value: remaining });
    if (remaining >= 20000) {
      presets.push({ label: '50%', value: Math.round(remaining / 2) });
    }
  }

  const calculatedBalanceAfter = Math.max(0, remaining - numericAmount);

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm transition-opacity"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[92dvh] animate-in slide-in-from-bottom duration-200">

        {/* Header tactile */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
              <i className="fas fa-receipt text-base"></i>
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">Enregistrer paiement</h2>
              <p className="text-xs text-slate-500">Collecte de loyer &amp; signature</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Fermer"
          >
            <i className="fas fa-times text-base"></i>
          </button>
        </div>

        {/* Corps de saisie */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">

          {/* Fiche locataire résumée */}
          <div className="bg-slate-50/90 rounded-2xl border border-slate-200/90 p-3.5 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Locataire</span>
              <span className="font-bold text-slate-900">{lastName} {firstName}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Bien loué</span>
              <span className="font-medium text-slate-700 text-right max-w-[65%] truncate" title={property}>{property}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Loyer dû</span>
              <span className={`text-base font-extrabold ${remaining > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {formatXOF(remaining, { compact: false })}
              </span>
            </div>
            {paid > 0 && (
              <div className="flex items-center justify-between text-xs text-emerald-600 font-semibold pt-1">
                <span>Déjà validé en caisse :</span>
                <span>{formatXOF(paid, { compact: false })}</span>
              </div>
            )}
          </div>

          {/* Bannière encaissement terrain en attente si existant */}
          {pendingAmount > 0 && (
            <div className="bg-amber-50 rounded-2xl border border-amber-200/90 p-3 space-y-1 text-xs">
              <div className="flex items-center justify-between font-bold text-amber-900">
                <span className="flex items-center gap-1.5">
                  <i className="fas fa-clock text-amber-500 animate-pulse"></i>
                  Déjà collecté sur le terrain :
                </span>
                <span className="text-amber-900 font-black">+{formatXOF(pendingAmount, { compact: false })}</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-tight">
                Transmis à la comptabilité &bull; Reste suggéré : <strong className="text-slate-900">{formatXOF(netCollectible)}</strong>
              </p>
            </div>
          )}

          {/* Bannière déduction réparation si active */}
          {repairDeduction > 0 && (
            <div className="bg-amber-50/90 rounded-2xl border border-amber-200 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                <span className="flex items-center gap-1.5">
                  <i className="fas fa-wrench text-amber-600"></i>
                  Réparation imputée au loyer
                </span>
                <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 font-bold">
                  -{formatXOF(repairDeduction, { compact: false })}
                </span>
              </div>
              <p className="text-[11px] text-amber-800 leading-tight">
                {client.active_repair_desc || 'Travaux locataire'} &bull; Reste à éponger : <span className="font-semibold">{formatXOF(activeRepairRemaining)}</span>
              </p>
              <div className="flex items-center justify-between pt-1.5 border-t border-amber-200/80 font-bold text-xs">
                <span className="text-slate-700">Loyer net à percevoir :</span>
                <span className="text-emerald-700 text-sm font-black">{formatXOF(netCollectible, { compact: false })}</span>
              </div>
            </div>
          )}

          {/* Saisie montant avec MoneyInput standardisé et raccourcis rapides */}
          <FormField
            label="Montant encaissé"
            required
            error={validationError && !amount ? validationError : ''}
            hint={
              numericAmount > 0 ? (
                calculatedBalanceAfter > 0 ? (
                  <span className="text-amber-600 font-medium">
                    Paiement partiel : solde restant de <strong>{formatXOF(calculatedBalanceAfter)}</strong> après cette opération.
                  </span>
                ) : (
                  <span className="text-emerald-600 font-bold">
                    Paiement intégral : solde locataire entièrement apuré (0 FCFA).
                  </span>
                )
              ) : 'Saisissez le montant perçu ou utilisez un raccourci.'
            }
          >
            <MoneyInput
              value={amount}
              onChange={(e, num) => {
                const val = typeof num === 'number' ? num : Number(e?.target?.value) || 0;
                setAmount(val);
                setValidationError('');
              }}
              presets={presets}
              hasError={Boolean(validationError && !amount)}
              size="lg"
              placeholder="0"
              currency="FCFA"
              autoFocus
            />
          </FormField>

          {/* Mode de paiement tactile en tuiles */}
          <div>
            <label className="block text-xs uppercase tracking-wider font-bold text-slate-600 mb-1.5">
              Mode de paiement <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {PAYMENT_METHODS.map(m => {
                const isSelected = method === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => { setMethod(m.id); setValidationError(''); }}
                    className={`flex items-center gap-2.5 p-3 rounded-2xl border text-left transition-all active:scale-95 cursor-pointer ${
                      isSelected
                        ? 'bg-primary/10 border-primary text-primary ring-2 ring-primary/20 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isSelected ? 'bg-primary text-white' : m.color}`}>
                      <i className={`fas ${m.icon} text-sm`}></i>
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate leading-tight">{m.name}</div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">{m.sub}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            {validationError && !method ? (
              <p className="text-xs text-rose-600 mt-2 flex items-center gap-1 font-semibold">
                <i className="fas fa-exclamation-circle"></i> {validationError}
              </p>
            ) : null}
          </div>

          {/* Référence ou Note optionnelle */}
          <FormField label="Référence / Reçu" optional hint="Ex: Wave Ref #89324 ou N° Chèque">
            <input
              type="text"
              value={reference}
              onChange={e => setReference(e.target.value)}
              placeholder="Ex : Wave Ref #89324"
              className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </FormField>

        </div>

        {/* Footer actions pouce mobile */}
        <div className="bg-slate-50/95 px-4 sm:px-6 py-3.5 sm:py-4 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 sm:flex-initial px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleValidate}
            disabled={!method || !isValidAmount}
            className="flex-[2] sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-600/25 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          >
            <i className="fas fa-pen-nib text-xs"></i>
            Valider et signer
          </button>
        </div>
      </div>
    </div>
  );
}
