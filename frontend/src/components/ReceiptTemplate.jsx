import React, { useEffect } from 'react';
import { formatXOF, formatDate, formatMethod } from '../utils/formatters';

export default function ReceiptTemplate({ transaction, onClose }) {
  useEffect(() => {
    if (transaction) {
      // Petite temporisation pour s'assurer que le DOM est rendu avant d'imprimer
      const timer = setTimeout(() => {
        window.print();
        if (onClose) onClose();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [transaction, onClose]);

  if (!transaction) return null;

  const clientName = transaction.client_name || transaction.clientName || transaction.client || 'Locataire Inconnu';
  const propertyName = (transaction.property_name && transaction.property_name !== '—')
    ? transaction.property_name
    : (transaction.propertyName || transaction.property || 'Bien non spécifié');
  const tenantSignature = transaction.signature_data || transaction.signatureData || transaction.signature || null;
  const txDescription = transaction.description || 'Paiement de loyer';

  return (
    <div className="fixed inset-0 z-[100] bg-white text-slate-900 overflow-auto flex justify-center py-10 print:py-0 print:block">
      <style>{`
        @media print {
          @page {
            margin: 0;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * { visibility: hidden; }
          #sygim-receipt, #sygim-receipt * { visibility: visible; }
          #sygim-receipt { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 100%; 
            margin: 0;
            border: none;
            box-shadow: none;
            box-sizing: border-box;
          }
        }
      `}</style>

      <div id="sygim-receipt" className="w-full max-w-3xl bg-white p-12 border-t-8 border-primary border-x border-b border-slate-200 shadow-xl rounded-2xl print:w-full print:shadow-none print:m-0 print:p-[15mm] box-border print:border-none print:border-t-8 print:border-primary">
        {/* En-tête du reçu */}
        <div className="flex justify-between items-start border-b-2 border-primary/20 pb-8 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <i className="fas fa-building text-primary text-4xl print:text-primary"></i>
              <span className="text-2xl font-black text-primary tracking-wide print:text-primary">SYGIM</span>
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium">Système de Gestion Immobilière & Recouvrement</p>
          </div>
          <div className="text-right">
            <h1 className="text-2xl font-black text-primary tracking-wider uppercase mb-1.5 print:text-primary">QUITTANCE & REÇU</h1>
            <p className="text-slate-500 text-xs">
              N° Reçu : <span className="text-slate-900 font-bold font-mono">{transaction.reference || transaction.id || `REC-${Math.floor(Math.random() * 10000)}`}</span>
            </p>
            <p className="text-slate-500 text-xs">
              Date : <span className="text-slate-900 font-semibold">{formatDate(transaction.date || transaction.createdAt)}</span>
            </p>
          </div>
        </div>

        {/* Corps - Infos Locataire */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <div className="border-l-4 border-primary pl-4 bg-primary/5 py-3 rounded-r-xl">
            <h3 className="text-[11px] text-primary uppercase font-bold tracking-wider mb-1">Reçu de (Locataire) :</h3>
            <p className="text-sm font-bold text-slate-900">{clientName}</p>
            {transaction.client_phone && (
              <p className="text-xs text-slate-500 mt-0.5">{transaction.client_phone}</p>
            )}
          </div>
          <div className="border-l-4 border-primary pl-4 bg-primary/5 py-3 rounded-r-xl">
            <h3 className="text-[11px] text-primary uppercase font-bold tracking-wider mb-1">Concernant le bien :</h3>
            <p className="text-sm font-bold text-slate-900">{propertyName}</p>
            {transaction.collector_name?.trim() && (
              <p className="text-xs text-slate-500 mt-0.5">Collecteur : {transaction.collector_name.trim()}</p>
            )}
          </div>
        </div>

        {/* Tableau Financier */}
        <div className="mb-8 print:break-inside-avoid">
          <table className="w-full text-left border-collapse rounded-xl overflow-hidden">
            <thead>
              <tr className="bg-primary text-white text-xs uppercase font-bold tracking-wider">
                <th className="py-3 px-4">Désignation</th>
                <th className="py-3 px-4">Méthode de règlement</th>
                <th className="py-3 px-4 text-right">Montant Versé</th>
              </tr>
            </thead>
            <tbody>
              <tr className="even:bg-slate-50 border-b border-slate-200">
                <td className="py-4 px-4 text-sm text-slate-800">
                  <span className="font-bold text-slate-900">{txDescription}</span><br/>
                  <span className="text-xs text-slate-500">Quittance de règlement locatif</span>
                </td>
                <td className="py-4 px-4 text-sm font-semibold text-slate-800">{formatMethod(transaction.method)}</td>
                <td className="py-4 px-4 text-right font-black text-primary text-base">
                  {formatXOF(transaction.amount, { compact: false })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Total & Reste à payer */}
        <div className="flex justify-end mb-12 print:break-inside-avoid">
          <div className="text-right">
            <div className="bg-primary/10 border border-primary/30 px-5 py-3 font-bold text-lg rounded-xl ml-auto w-max flex items-center gap-4 shadow-xs">
              <span className="text-primary text-xs uppercase tracking-wider font-extrabold print:text-primary">Total versé :</span>
              <span className="text-primary font-black text-xl print:text-primary">{formatXOF(transaction.amount, { compact: false })}</span>
            </div>
            {transaction.amountDue && (
              <div className="flex justify-end gap-4 py-2 font-bold text-rose-600 mt-2 pr-4 text-sm">
                <span>Reste à payer :</span>
                <span>{formatXOF(Math.max(0, transaction.amountDue - transaction.amount), { compact: false })}</span>
              </div>
            )}
          </div>
        </div>

        {/* Pied de page - Signatures */}
        <div className="mt-8 pt-6 border-t-2 border-primary/20 print:break-inside-avoid space-y-6">
          <div className="grid grid-cols-2 gap-6 items-start">
            <div className="text-center">
              <p className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">Signature du Locataire</p>
              <div className="border-2 border-dashed border-slate-300 bg-slate-50/70 rounded-xl h-24 w-full flex items-center justify-center p-2 overflow-hidden">
                {tenantSignature ? (
                  <img
                    src={tenantSignature}
                    alt="Signature du locataire"
                    className="max-h-20 max-w-full object-contain mx-auto"
                  />
                ) : (
                  <span className="text-slate-400 text-xs italic">Non signée</span>
                )}
              </div>
            </div>
            <div className="text-center">
              <p className="text-xs font-bold text-primary mb-2 uppercase tracking-wider print:text-primary">Pour l'Agence SYGIM (Cachet &amp; Signature)</p>
              <div className="border-2 border-dashed border-primary/30 bg-primary/5 rounded-xl h-24 w-full flex items-center justify-center text-primary/40 text-xs font-semibold">
                Cachet officiel SYGIM
              </div>
            </div>
          </div>
          <div className="text-xs text-slate-500 text-center">
            <strong className="text-primary print:text-primary">Mentions légales : </strong>
            Ce reçu officiel certifie le règlement libératoire sous réserve d'encaissement effectif. Fait foi devant toute juridiction.
          </div>
        </div>

        <div className="mt-12 text-center print:hidden">
          <button 
            onClick={() => onClose && onClose()} 
            className="px-6 py-2 bg-slate-100 text-slate-600 rounded-lg font-medium hover:bg-slate-200 transition-colors"
          >
            Fermer l'aperçu
          </button>
        </div>
      </div>
    </div>
  );
}
