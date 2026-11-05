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

      <div id="sygim-receipt" className="w-full max-w-3xl bg-white p-12 border border-slate-200 shadow-xl rounded-2xl print:w-full print:shadow-none print:m-0 print:p-[15mm] box-border print:border-none">
        {/* En-tête du reçu */}
        <div className="flex justify-between items-start border-b border-slate-200 pb-8 mb-10">
          <div>
            <div className="flex items-center gap-3">
              <i className="fas fa-building text-primary text-4xl print:text-primary"></i>
              <span className="text-xl font-bold text-primary tracking-wide print:text-primary">SYGIM</span>
            </div>
          </div>
          <div className="text-right">
            <h1 className="text-2xl font-semibold text-primary tracking-wider uppercase mb-2 print:text-primary">REÇU DE PAIEMENT</h1>
            <p className="text-slate-500 text-sm">
              N° Reçu : <span className="text-slate-900 font-medium">{transaction.reference || transaction.id || `REC-${Math.floor(Math.random() * 10000)}`}</span>
            </p>
            <p className="text-slate-500 text-sm">
              Date : <span className="text-slate-900 font-medium">{formatDate(transaction.date || transaction.createdAt)}</span>
            </p>
          </div>
        </div>

        {/* Corps - Infos Locataire */}
        <div className="grid grid-cols-2 gap-8 mb-12">
          <div className="border-l-4 border-slate-300 pl-3 mb-6">
            <h3 className="text-xs text-slate-400 uppercase font-bold mb-1">Reçu de :</h3>
            <p className="text-sm font-semibold text-slate-900">{transaction.client || 'Locataire Inconnu'}</p>
          </div>
          <div className="border-l-4 border-slate-300 pl-3 mb-6">
            <h3 className="text-xs text-slate-400 uppercase font-bold mb-1">Concernant le bien :</h3>
            <p className="text-sm font-semibold text-slate-900">{transaction.property || 'Bien non spécifié'}</p>
          </div>
        </div>

        {/* Tableau Financier */}
        <div className="mb-10 print:break-inside-avoid">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-800 text-slate-800 text-xs uppercase font-bold tracking-wider">
                <th className="py-3 px-2">Désignation</th>
                <th className="py-3 px-2">Méthode</th>
                <th className="py-3 px-2 text-right">Montant Versé</th>
              </tr>
            </thead>
            <tbody>
              <tr className="even:bg-slate-50">
                <td className="py-4 px-2 border-b border-slate-200 text-sm text-slate-800">
                  Paiement de loyer<br/>
                  <span className="text-xs text-slate-500">Période en cours</span>
                </td>
                <td className="py-4 px-2 border-b border-slate-200 text-sm text-slate-800">{formatMethod(transaction.method)}</td>
                <td className="py-4 px-2 border-b border-slate-200 text-right font-semibold text-slate-900 text-base">
                  {formatXOF(transaction.amount, { compact: false })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Total & Reste à payer */}
        <div className="flex justify-end mb-16 print:break-inside-avoid">
          <div className="text-right">
            <div className="bg-slate-100 px-4 py-2 font-bold text-lg rounded ml-auto w-max flex items-center gap-4">
              <span className="text-primary text-sm uppercase print:text-primary">Total versé :</span>
              <span className="text-primary print:text-primary">{formatXOF(transaction.amount, { compact: false })}</span>
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
        <div className="flex justify-between items-end mt-8 pt-8 border-t border-slate-200 print:break-inside-avoid">
          <div className="text-xs text-slate-500 max-w-sm">
            <p className="mb-1"><strong className="text-primary print:text-primary">Mentions légales :</strong></p>
            <p>Ce reçu annule et remplace tout reçu précédent. Il ne libère le locataire qu'après encaissement effectif des valeurs remises.</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-primary mb-2 print:text-primary">Cachet et Signature</p>
            <div className="border-2 border-dashed border-slate-300 h-24 w-48 mx-auto flex items-center justify-center text-slate-300 text-xs">
              Cachet de l'agence
            </div>
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
