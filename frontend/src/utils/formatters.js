export function formatXOF(amount, { compact = true } = {}) {
  const n = Number(amount) || 0;
  if (compact && n >= 1000000) {
    return (n / 1000000).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' M XOF';
  }
  return n.toLocaleString('fr-FR') + ' XOF';
}

export function formatAmount(amount) {
  return (Number(amount) || 0).toLocaleString('fr-FR');
}

export function formatDate(dateStr, options = { day: "numeric", month: "long", year: "numeric" }) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('fr-FR', options);
}

export function formatDateShort(dateStr) {
  return formatDate(dateStr, { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function transactionSearchDate(transaction) {
  const raw = transaction.date || transaction.createdAt;
  if (!raw) return "";
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? raw : raw + ' ' + d.toLocaleDateString('fr-FR');
}

const METHOD_MAP = {
  cash: "Espèces",
  especes: "Espèces",
  espece: "Espèces",
  espèce: "Espèces",
  espèces: "Espèces",
  mobile_money: "Mobile Money",
  "mobile money": "Mobile Money",
  wave: "Mobile Money",
  orange_money: "Mobile Money",
  mtn: "Mobile Money",
  moov: "Mobile Money",
  transfer: "Virement bancaire",
  bank_transfer: "Virement bancaire",
  virement: "Virement bancaire",
  "virement bancaire": "Virement bancaire",
  cheque: "Chèque",
  check: "Chèque",
  chèque: "Chèque",
};

export function formatMethod(methodKey) {
  if (!methodKey) return "Espèces";
  const normalized = String(methodKey).trim().toLowerCase();
  return METHOD_MAP[normalized] || methodKey;
}

export const formatPaymentMethod = formatMethod;

const STATUS_MAP = {
  paid:         { label: "Payé",          badgeClass: "paid",    twClass: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  processed:    { label: "Traité",        badgeClass: "paid",    twClass: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  partial:      { label: "Partiel",       badgeClass: "partial", twClass: "bg-sky-50 text-sky-700 border-sky-200" },
  pending:      { label: "En attente",    badgeClass: "pending", twClass: "bg-amber-50 text-amber-700 border-amber-200" },
  overdue:      { label: "Impayé",        badgeClass: "overdue", twClass: "bg-rose-50 text-rose-700 border-rose-200" },
  late:         { label: "En retard",     badgeClass: "overdue", twClass: "bg-rose-50 text-rose-700 border-rose-200" },
  cancelled:    { label: "Annulé",        badgeClass: "",        twClass: "bg-slate-50 text-slate-500 border-slate-200" },
  refunded:     { label: "Remboursé",     badgeClass: "",        twClass: "bg-slate-50 text-slate-500 border-slate-200" },
  inactive:     { label: "Inactif",       badgeClass: "",        twClass: "bg-slate-50 text-slate-400 border-slate-200" },
  loue:         { label: "Loué",          badgeClass: "paid",    twClass: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  vacant:       { label: "Vacant",        badgeClass: "overdue", twClass: "bg-rose-50 text-rose-700 border-rose-200" },
  en_renovation:{ label: "En rénovation", badgeClass: "info",    twClass: "bg-sky-50 text-sky-700 border-sky-200" },
  vendu:        { label: "Vendu",         badgeClass: "warning", twClass: "bg-amber-50 text-amber-700 border-amber-200" },
};

const STATUS_FALLBACK = { label: "", badgeClass: "", twClass: "bg-slate-50 text-slate-500 border-slate-200" };

export function formatStatus(statusKey) {
  return STATUS_MAP[statusKey] || Object.assign({}, STATUS_FALLBACK, { label: statusKey || "" });
}
export function formatStatusLabel(statusKey) { return formatStatus(statusKey).label; }
export function formatStatusClass(statusKey) { return formatStatus(statusKey).badgeClass; }
export function formatStatusTw(statusKey)   { return formatStatus(statusKey).twClass; }