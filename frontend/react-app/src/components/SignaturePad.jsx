import React, { useRef, useState, useEffect } from 'react';
import { formatXOF } from '../utils/formatters';

const METHOD_LABELS = {
  mobile_money: 'Mobile Money',
  cash: 'Espèces',
  check: 'Chèque',
  bank_transfer: 'Virement'
};

export default function SignaturePad({ isOpen, onClose, onConfirm, client, payment }) {
  const canvasRef = useRef(null);
  const submittingRef = useRef(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureImg, setSignatureImg] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState('');

  // Reset + canvas resize
  useEffect(() => {
    if (!isOpen) {
      setSignatureImg(null);
      setIsDrawing(false);
      setIsSubmitting(false);
      setSubmissionError('');
      submittingRef.current = false;
      return undefined;
    }

    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.round(rect.width * ratio));
      const height = Math.max(1, Math.round(rect.height * ratio));
      if (canvas.width === width && canvas.height === height) return;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.lineWidth = Math.max(2.5, 2.5 * ratio);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#0f172a';
      setSignatureImg(null);
    };

    resizeCanvas();
    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [isOpen]);

  // Fermeture Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height)
    };
  };

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || isSubmitting) return;
    try { canvas.setPointerCapture?.(e.pointerId); } catch { /* optional */ }
    const ctx = canvas.getContext('2d');
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setSubmissionError('');
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = (e) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      try {
        if (e?.pointerId !== undefined && canvas.hasPointerCapture?.(e.pointerId)) {
          canvas.releasePointerCapture(e.pointerId);
        }
      } catch { /* already released */ }
      setSignatureImg(canvas.toDataURL('image/png'));
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setSignatureImg(null);
      setSubmissionError('');
    }
  };

  const handleConfirm = async () => {
    if (!signatureImg) {
      setSubmissionError('Veuillez faire signer le locataire dans le cadre ci-dessous.');
      return;
    }
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setSubmissionError('');
    try {
      const result = await onConfirm(signatureImg);
      if (result?.success === false) {
        setSubmissionError(result.message || 'Le paiement n\'a pas pu être enregistré.');
      }
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const lastName = client?.last_name ?? client?.lastName ?? '';
  const firstName = client?.first_name ?? client?.firstName ?? '';

  return (
    <div
      className="fixed inset-0 z-[1001] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-opacity"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[92dvh] animate-in slide-in-from-bottom duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <i className="fas fa-signature text-base"></i>
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">Signature locataire</h2>
              <p className="text-xs text-slate-500">Validation de reçu</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Retour"
          >
            <i className="fas fa-arrow-left text-sm"></i>
          </button>
        </div>

        {/* Corps */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">

          {/* Récapitulatif paiement */}
          <div className="bg-slate-50/90 rounded-2xl border border-slate-200 p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <span className="text-slate-500 font-medium">Locataire</span>
              <span className="font-bold text-slate-900">{lastName} {firstName}</span>
            </div>
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <span className="text-slate-500 font-medium">Mode choisi</span>
              <span className="font-semibold text-slate-700">{METHOD_LABELS[payment?.method] || payment?.method || '—'}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Montant encaissé</span>
              <span className="text-base font-black text-emerald-600">
                {formatXOF(payment?.amount ?? 0, { compact: false })}
              </span>
            </div>
          </div>

          {/* Instruction tactile */}
          <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-2.5 text-center">
            <p className="text-xs sm:text-sm text-indigo-900 font-medium flex items-center justify-center gap-1.5">
              <i className="fas fa-hand-pointer text-indigo-500"></i>
              Faites signer le locataire avec son doigt ci-dessous
            </p>
          </div>

          {/* Zone de signature spacieuse pour smartphone */}
          <div className={`relative rounded-2xl border-2 transition-colors overflow-hidden bg-white shadow-inner ${
            signatureImg ? 'border-emerald-400' : isDrawing ? 'border-indigo-400' : 'border-slate-300 border-dashed'
          }`} style={{ height: '200px' }}>
            <canvas
              ref={canvasRef}
              onPointerDown={startDrawing}
              onPointerMove={draw}
              onPointerUp={stopDrawing}
              onPointerLeave={stopDrawing}
              onPointerCancel={stopDrawing}
              className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
              aria-label="Zone de signature du locataire"
            />
            {!signatureImg && !isDrawing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none select-none">
                <i className="fas fa-pen text-slate-300 text-2xl"></i>
                <span className="text-xs text-slate-400 font-medium">Signer ici avec le doigt</span>
              </div>
            )}
          </div>

          {/* Statut + Bouton Effacer */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              {signatureImg ? (
                <>
                  <i className="fas fa-check-circle text-emerald-500"></i>
                  <span className="text-emerald-600 font-bold">Signature enregistrée</span>
                </>
              ) : (
                <>
                  <i className="fas fa-circle text-slate-300 text-[10px]"></i>
                  <span className="text-slate-400">En attente de signature...</span>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={clearSignature}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 active:scale-95 transition-all disabled:opacity-50"
            >
              <i className="fas fa-eraser text-[10px]"></i>
              Effacer
            </button>
          </div>

          {/* Erreur */}
          {submissionError && (
            <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs sm:text-sm text-rose-700 font-medium" role="alert">
              <i className="fas fa-exclamation-circle mt-0.5 shrink-0"></i>
              <span>{submissionError}</span>
            </div>
          )}

        </div>

        {/* Footer tactile */}
        <div className="bg-slate-50/95 px-4 sm:px-6 py-3.5 sm:py-4 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 sm:flex-initial px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-60"
          >
            Retour
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!signatureImg || isSubmitting}
            className="flex-[2] sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-primary rounded-xl hover:bg-primary-dark transition-colors shadow-md shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          >
            <i className={`fas ${isSubmitting ? 'fa-spinner fa-spin' : 'fa-check'} text-xs`}></i>
            {isSubmitting ? 'Enregistrement...' : 'Finaliser le paiement'}
          </button>
        </div>
      </div>
    </div>
  );
}
