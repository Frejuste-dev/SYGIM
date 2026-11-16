/**
 * SYGIM — Conversion fidèle des montants numériques en lettres françaises (Majuscules)
 * Respecte les règles d'accord grammaticales françaises et le formatage légal ivoirien/OHADA
 */

const UNITS = [
  '', 'UN', 'DEUX', 'TROIS', 'QUATRE', 'CINQ', 'SIX', 'SEPT', 'HUIT', 'NEUF',
  'DIX', 'ONZE', 'DOUZE', 'TREIZE', 'QUATORZE', 'QUINZE', 'SEIZE', 'DIX-SEPT', 'DIX-HUIT', 'DIX-NEUF'
];

const TENS = [
  '', '', 'VINGT', 'TRENTE', 'QUARANTE', 'CINQUANTE', 'SOIXANTE', 'SOIXANTE', 'QUATRE-VINGT', 'QUATRE-VINGT'
];

/**
 * Convertit un nombre entier de 0 à 99 en lettres
 */
function convertBelowHundred(n) {
  if (n < 20) return UNITS[n];

  const ten = Math.floor(n / 10);
  const unit = n % 10;

  if (ten === 7) {
    if (unit === 1) return 'SOIXANTE ET ONZE';
    return `SOIXANTE-${UNITS[10 + unit]}`;
  }

  if (ten === 9) {
    return `QUATRE-VINGT-${UNITS[10 + unit]}`;
  }

  if (unit === 0) {
    if (ten === 8) return 'QUATRE-VINGTS';
    return TENS[ten];
  }

  if (unit === 1 && ten < 8) {
    return `${TENS[ten]} ET UN`;
  }

  return `${TENS[ten]}-${UNITS[unit]}`;
}

/**
 * Convertit un nombre entier de 0 à 999 en lettres
 */
function convertBelowThousand(n) {
  if (n === 0) return '';
  if (n < 100) return convertBelowHundred(n);

  const hundred = Math.floor(n / 100);
  const remainder = n % 100;

  let hundredPart = '';
  if (hundred === 1) {
    hundredPart = 'CENT';
  } else {
    hundredPart = remainder === 0 ? `${UNITS[hundred]} CENTS` : `${UNITS[hundred]} CENT`;
  }

  if (remainder === 0) return hundredPart;
  return `${hundredPart} ${convertBelowHundred(remainder)}`;
}

/**
 * Convertit un nombre entier positif en lettres françaises (Majuscules)
 * @param {number|string} value - Montant entier
 * @returns {string} - Montant en toutes lettres
 */
export function integerToFrenchWords(value) {
  const num = Math.round(Number(value) || 0);
  if (num === 0) return 'ZERO';
  if (num < 0) return `MOINS ${integerToFrenchWords(Math.abs(num))}`;

  if (num < 1000) {
    return convertBelowThousand(num);
  }

  // Milliards
  if (num >= 1000000000) {
    const billions = Math.floor(num / 1000000000);
    const remainder = num % 1000000000;
    const billPart = billions === 1 ? 'UN MILLIARD' : `${convertBelowThousand(billions)} MILLIARDS`;
    if (remainder === 0) return billPart;
    return `${billPart} ${integerToFrenchWords(remainder)}`;
  }

  // Millions
  if (num >= 1000000) {
    const millions = Math.floor(num / 1000000);
    const remainder = num % 1000000;
    const millPart = millions === 1 ? 'UN MILLION' : `${convertBelowThousand(millions)} MILLIONS`;
    if (remainder === 0) return millPart;
    return `${millPart} ${integerToFrenchWords(remainder)}`;
  }

  // Milliers
  const thousands = Math.floor(num / 1000);
  const remainder = num % 1000;

  let thouPart = '';
  if (thousands === 1) {
    thouPart = 'MILLE';
  } else {
    thouPart = `${convertBelowThousand(thousands)} MILLE`;
  }

  if (remainder === 0) return thouPart;
  return `${thouPart} ${convertBelowThousand(remainder)}`;
}

/**
 * Formate un nombre avec séparateurs de milliers (espace insécable)
 * Ex: 1480000 -> "1 480 000"
 */
export function formatNumberWithSpaces(value) {
  const num = Math.round(Number(value) || 0);
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Formate le montant complet avec conversion en lettres et rappel en chiffres
 * Format officiel : "[MONTANT EN LETTRES] ([CHIFFRES]) [DEVISE]"
 *
 * @param {number|string} amount - Montant
 * @param {string} currency - Devise (défaut "FCFA", ou "FRANCS CFA", ou "F CFA")
 * @returns {string} - Ex: "UN MILLION QUATRE CENT QUATRE-VINGT MILLE (1 480 000) FCFA"
 */
export function formatAmountInFrenchWords(amount, currency = 'FCFA') {
  const num = Math.round(Number(amount) || 0);
  const words = integerToFrenchWords(num)
    .replace(/-/g, ' ')
    .replace(/QUATRE VINGTS MILLE/g, 'QUATRE VINGT MILLE')
    .replace(/\s+/g, ' ')
    .trim();
  const formattedNum = formatNumberWithSpaces(num);
  const cur = currency ? ` ${currency}` : '';
  return `${words} (${formattedNum})${cur}`;
}

export default formatAmountInFrenchWords;
