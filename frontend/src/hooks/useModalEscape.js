import { useEffect } from 'react';

/**
 * Hook pour gérer la fermeture d'une modale via la touche Échap (Escape)
 * et verrouiller le défilement du document d'arrière-plan (scroll-lock).
 * @param {boolean} isOpen Indicateur d'ouverture
 * @param {Function} onClose Callback de fermeture
 */
export function useModalEscape(isOpen, onClose) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);
}

export default useModalEscape;
