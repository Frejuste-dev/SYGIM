import { useState, useEffect } from 'react';

/**
 * Hook de temporisation (Debounce) pour éviter les requêtes réseau intempestives
 * @param {*} value Valeur surveillée
 * @param {number} delay Délai en millisecondes (défaut : 350ms)
 * @returns {*} Valeur debouncée
 */
export function useDebounce(value, delay = 350) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default useDebounce;
