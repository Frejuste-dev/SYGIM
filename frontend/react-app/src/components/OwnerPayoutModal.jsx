import React, { useState, useEffect, useMemo } from 'react';
import { API } from '../api/services';
import { formatXOF } from '../utils/formatters';

const PAYMENT_METHODS = [
  { id: 'bank_transfer', label: 'Virement bancaire', icon: 'fa-university' },
  { id: 'mobile_money',  label: 'Mobile Money (Wave/OM)', icon: 'fa-mobile-screen-button' },
  { id: 'cheque',        label: 'Chèque bancaire', icon: 'fa-money-check' },
  { id: 'cash',          label: 'Espèces', icon: 'fa-money-bill-wave' },
];

const PAYOUT_MODES = [
  { id: 'full',         label: 'Paiement intégral',  desc: 'Règlement complet de la période', icon: 'fa-check-double', color: 'emerald' },
  { id: 'installment',  label: 'Paiement échelonné', desc: 'Versement par tranches / acompte', icon: 'fa-layer-group', color: 'blue' },
  { id: 'prefinancing', label: 'Préfinancement',     desc: 'Avance agence (locataire impayé)', icon: 'fa-bolt', color: 'amber' },
];

const EMPTY_LIST = [];

export default function OwnerPayoutModal({ isOpen, onClose, preselectedOwner = null, ownersSummary = null, onSuccess }) {
  const [fetchedOwners, setFetchedOwners] = useState(EMPTY_LIST);
  const effectiveOwners = (Array.isArray(ownersSummary) && ownersSummary.length > 0) ? ownersSummary : fetchedOwners;
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const todayStr = now.toISOString().slice(0, 10);

  const [ownerId, setOwnerId] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [payoutMode, setPayoutMode] = useState('full');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [periodStart, setPeriodStart] = useState(defaultStart);
  const [periodEnd, setPeriodEnd] = useState(defaultEnd);
  const [scheduledDate, setScheduledDate] = useState(todayStr);
  const [commissionRate, setCommissionRate] = useState(10);
  const [maintenanceDeductions, setMaintenanceDeductions] = useState(0);
  const [amountPaid, setAmountPaid] = useState(0);
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const hasPassedOwners = Array.isArray(ownersSummary) && ownersSummary.length > 0;

  useEffect(() => {
    if (!isOpen || hasPassedOwners) return;
    let cancelled = false;
    API.Financial.getOwnersSummary()
      .then(res => {
        if (cancelled) return;
        const list = Array.isArray(res) ? res : (res?.data || EMPTY_LIST);
        setFetchedOwners(list);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isOpen, hasPassedOwners]);

  const selectedOwner = useMemo(() => {
    if (!ownerId) return null;
    return effectiveOwners.find(o => String(o.id) === String(ownerId)) || preselectedOwner || null;
  }, [ownerId, effectiveOwners, preselectedOwner]);

  const ownerProperties = useMemo(() => {
    return selectedOwner?.properties || [];
  }, [selectedOwner]);

  const selectedProperty = useMemo(() => {
    if (!propertyId) return null;
    return ownerProperties.find(p => String(p.id) === String(propertyId)) || null;
  }, [propertyId, ownerProperties]);

  // Calcul des montants de référence selon le propriétaire ou le bien choisi
  const financialMetrics = useMemo(() => {
    if (!selectedOwner) {
      return { expectedRent: 0, collectedRent: 0, unpaidRent: 0, baseAmount: 0, commission: 0, netDue: 0 };
    }

    let expectedRent = 0;
    let collectedRent = 0;

    if (selectedProperty) {
      expectedRent = parseFloat(selectedProperty.tenantDue || selectedProperty.rent || 0);
      collectedRent = parseFloat(selectedProperty.tenantPaid || 0);
    } else {
      expectedRent = parseFloat(selectedOwner.expectedRent || selectedOwner.totalMonthlyRent || 0);
      collectedRent = parseFloat(selectedOwner.collectedFromTenants || 0);
    }

    const unpaidRent = Math.max(0, expectedRent - collectedRent);
    const isPref = payoutMode === 'prefinancing';

    // Si préfinancement ou si aucun loyer encaissé renseigné mais loyer attendu > 0, on se base sur le loyer attendu
    const baseAmount = isPref
      ? Math.max(expectedRent, collectedRent)
      : (collectedRent > 0 ? collectedRent : expectedRent);

    const rate = parseFloat(commissionRate || 0);
    const commission = Math.round((baseAmount * rate) / 100);
    const deductions = parseFloat(maintenanceDeductions || 0);
    const netDue = Math.max(0, Math.round(baseAmount - commission - deductions));

    return {
      expectedRent,
      collectedRent,
      unpaidRent,
      baseAmount,
      commission,
      netDue
    };
  }, [selectedOwner, selectedProperty, payoutMode, commissionRate, maintenanceDeductions]);

  // Initialisation à l'ouverture
  useEffect(() => {
    if (!isOpen) return;
    setError('');
    const initialOwner = preselectedOwner || effectiveOwners[0] || null;
    if (initialOwner) {
      setOwnerId(String(initialOwner.id));
      setPaymentMethod(initialOwner.preferred_payment_method || 'bank_transfer');
      const sched = initialOwner.payout_schedule === 'installment' ? 'installment' : 'full';
      setPayoutMode(sched);
      setCommissionRate(initialOwner.commission_rate ?? 10);
    } else {
      setOwnerId('');
    }
    setPropertyId('');
    setMaintenanceDeductions(0);
    setReference('');
    setNotes('');
  }, [isOpen, preselectedOwner, effectiveOwners]);

  // Mettre à jour les préférences quand on change de propriétaire
  const handleOwnerChange = (newId) => {
    setOwnerId(newId);
    setPropertyId('');
    const found = effectiveOwners.find(o => String(o.id) === String(newId));
    if (found) {
      setPaymentMethod(found.preferred_payment_method || 'bank_transfer');
      if (found.payout_schedule === 'installment') {
        setPayoutMode('installment');
      } else if (found.unpaidByTenants > 0 && found.collectedFromTenants === 0) {
        setPayoutMode('prefinancing');
      } else {
        setPayoutMode('full');
      }
      setCommissionRate(found.commission_rate ?? 10);
    }
  };

  // Mettre à jour automatiquement le montant à verser quand le netDue ou le mode change
  useEffect(() => {
    if (payoutMode === 'installment') {
      setAmountPaid(Math.round(financialMetrics.netDue / 2));
    } else {
      setAmountPaid(financialMetrics.netDue);
    }
  }, [financialMetrics.netDue, payoutMode]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!ownerId) {
      setError('Veuillez sélectionner un propriétaire.');
      return;
    }
    if (!amountPaid || amountPaid <= 0) {
      setError('Le montant à verser doit être supérieur à 0 FCFA.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await API.Financial.recordOwnerPayment({
        owner_id: parseInt(ownerId, 10),
        property_id: propertyId ? parseInt(propertyId, 10) : null,
        period_start: periodStart,
        period_end: periodEnd,
        expected_rent: financialMetrics.expectedRent,
        total_collected: financialMetrics.collectedRent,
        commission_rate: parseFloat(commissionRate || 0),
        maintenance_deductions: parseFloat(maintenanceDeductions || 0),
        amount_paid: parseFloat(amountPaid),
        payment_method: paymentMethod,
        payout_mode: payoutMode,
        is_prefinanced: payoutMode === 'prefinancing',
        scheduled_date: scheduledDate,
        payout_reference: reference.trim() || undefined,
        notes: notes.trim() || (
          payoutMode === 'prefinancing'
            ? 'Préfinancement agence en attente du règlement locataire'
            : payoutMode === 'installment'
              ? 'Versement échelonné propriétaire'
              : 'Reversement mensuel propriétaire'
        )
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || "Erreur lors de l'enregistrement du paiement propriétaire.");
    } finally {
      setSubmitting(false);
    }
  };

  const remainingAfterPayout = Math.max(0, financialMetrics.netDue - (parseFloat(amountPaid) || 0));

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92dvh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <i className="fas fa-hand-holding-dollar text-lg"></i>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Enregistrer un paiement propriétaire</h2>
              <p className="text-xs text-slate-500">Reversement de loyer, paiement échelonné ou préfinancement comptable</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-2">
              <i className="fas fa-exclamation-circle"></i>
              <span>{error}</span>
            </div>
          )}

          {/* 1. Sélection Propriétaire & Bien */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Propriétaire bénéficiaire <span className="text-rose-500">*</span>
              </label>
              <select
                value={ownerId}
                onChange={(e) => handleOwnerChange(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="">-- Sélectionner un propriétaire --</option>
                {effectiveOwners.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.first_name} {o.last_name} ({o.propertiesCount ?? (o.properties?.length || 0)} bien{(o.propertiesCount ?? (o.properties?.length || 0)) > 1 ? 's' : ''})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Périmètre des biens
              </label>
              <select
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Tous les biens du propriétaire ({ownerProperties.length})</option>
                {ownerProperties.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} — Loyer : {formatXOF(p.rent)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. Alerte & Synthèse Locative (Détection Impayé / Préfinancement) */}
          {selectedOwner && (
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                <div className="text-xs font-bold text-slate-700 flex items-center gap-2">
                  <i className="fas fa-building text-primary"></i>
                  <span>Patrimoine : {ownerProperties.length} bien(s)</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200">
                    Préférence : {PAYMENT_METHODS.find(m => m.id === selectedOwner.preferred_payment_method)?.label || 'Virement'}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-200/70 text-slate-700 font-semibold">
                    Jour souhaité : le {selectedOwner.preferred_payout_day || '5'} du mois
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200/80">
                  <div className="text-[11px] text-slate-500 font-medium">Loyers attendus</div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">{formatXOF(financialMetrics.expectedRent)}</div>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200/80">
                  <div className="text-[11px] text-slate-500 font-medium">Encaissé (Locataires)</div>
                  <div className="text-sm font-bold text-emerald-600 mt-0.5">{formatXOF(financialMetrics.collectedRent)}</div>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200/80">
                  <div className="text-[11px] text-slate-500 font-medium">Impayés Locataires</div>
                  <div className={`text-sm font-bold mt-0.5 ${financialMetrics.unpaidRent > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                    {formatXOF(financialMetrics.unpaidRent)}
                  </div>
                </div>
              </div>

              {financialMetrics.unpaidRent > 0 && payoutMode !== 'prefinancing' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="text-xs text-amber-900">
                    <i className="fas fa-triangle-exclamation text-amber-600 mr-1.5"></i>
                    <strong>Retard locataire détecté ({formatXOF(financialMetrics.unpaidRent)}) :</strong> Vous pouvez effectuer un <strong>Préfinancement</strong> pour régler le propriétaire sans attendre le locataire.
                  </div>
                  <button
                    type="button"
                    onClick={() => setPayoutMode('prefinancing')}
                    className="shrink-0 px-3 py-1.5 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700 transition"
                  >
                    Activer Préfinancement
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 3. Choix de la Méthode de Règlement (Intégral, Échelonné, Préfinancement) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              Méthode de règlement <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {PAYOUT_MODES.map(m => {
                const active = payoutMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPayoutMode(m.id)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      active
                        ? m.id === 'prefinancing'
                          ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/20 text-amber-900'
                          : 'bg-primary/10 border-primary ring-2 ring-primary/20 text-primary'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center justify-between">
                      <span>{m.label}</span>
                      {active && <i className="fas fa-check-circle"></i>}
                    </div>
                    <div className="text-[11px] opacity-80 mt-1">{m.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Moyen de Paiement & Dates/Période */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Moyen de paiement choisi <span className="text-rose-500">*</span>
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-primary"
              >
                {PAYMENT_METHODS.map(pm => (
                  <option key={pm.id} value={pm.id}>{pm.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Date de versement / échéance
              </label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Début de période</label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Fin de période</label>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900"
              />
            </div>
          </div>

          {/* 5. Calcul Commission & Montant versé */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Commission Agence (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={commissionRate}
                onChange={(e) => setCommissionRate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900"
              />
              <span className="text-[11px] text-slate-400">Retenue : {formatXOF(financialMetrics.commission)}</span>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Retenue Travaux / Frais</label>
              <input
                type="number"
                min="0"
                step="1000"
                value={maintenanceDeductions}
                onChange={(e) => setMaintenanceDeductions(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900"
              />
              <span className="text-[11px] text-slate-400">Net à reverser : {formatXOF(financialMetrics.netDue)}</span>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-emerald-700 mb-1.5">
                Montant versé (XOF) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                required
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-emerald-50/50 border-2 border-emerald-500 rounded-xl text-base font-black text-slate-900"
              />
              <div className="flex gap-1.5 mt-1">
                <button
                  type="button"
                  onClick={() => setAmountPaid(financialMetrics.netDue)}
                  className="text-[10px] px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded font-semibold text-slate-700"
                >
                  100% ({formatXOF(financialMetrics.netDue)})
                </button>
                <button
                  type="button"
                  onClick={() => { setPayoutMode('installment'); setAmountPaid(Math.round(financialMetrics.netDue / 2)); }}
                  className="text-[10px] px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded font-semibold text-slate-700"
                >
                  50% Échelonné
                </button>
              </div>
            </div>
          </div>

          {remainingAfterPayout > 0 && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 flex items-center justify-between">
              <span>
                <i className="fas fa-clock mr-1.5"></i>
                <strong>Paiement échelonné :</strong> Solde restant à verser au propriétaire après cette tranche :
              </span>
              <span className="font-black text-sm">{formatXOF(remainingAfterPayout)}</span>
            </div>
          )}

          {/* 6. Référence & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Référence Virement / Reçu</label>
              <input
                type="text"
                placeholder="Ex: VIR-SGBCI-88310 ou Wave #9921"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Observation comptable</label>
              <input
                type="text"
                placeholder="Ex: 1ère tranche échelonnée / Préfinancement loyer nov."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`px-5 py-2.5 text-sm font-bold text-white rounded-xl shadow-md transition flex items-center gap-2 ${
                payoutMode === 'prefinancing'
                  ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                  : 'bg-primary hover:bg-primary-dark shadow-primary/20'
              }`}
            >
              <i className={`fas ${submitting ? 'fa-spinner fa-spin' : 'fa-check-circle'}`}></i>
              {submitting
                ? 'Enregistrement...'
                : payoutMode === 'prefinancing'
                  ? 'Valider le Préfinancement'
                  : 'Enregistrer le Paiement Propriétaire'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

