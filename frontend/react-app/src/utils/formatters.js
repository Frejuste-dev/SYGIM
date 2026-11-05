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
  cash: "Especes",
  mobile_money: "Mobile Money",
  bank_transfer: "Virement bancaire",
  cheque: "Cheque",
  check: "Cheque",
  card: "Carte bancaire",
};

export function formatMethod(methodKey) {
  if (!methodKey) return "Especes";
  return METHOD_MAP[methodKey] || methodKey;
}

const STATUS_MAP = {
  paid:         { label: "Paye",         badgeClass: "paid",    twClass: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  processed:    { label: "Traite",        badgeClass: "paid",    twClass: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  partial:      { label: "Partiel",       badgeClass: "partial", twClass: "bg-sky-50 text-sky-700 border-sky-200" },
  pending:      { label: "En attente",    badgeClass: "pending", twClass: "bg-amber-50 text-amber-700 border-amber-200" },
  overdue:      { label: "Non paye",      badgeClass: "overdue", twClass: "bg-rose-50 text-rose-700 border-rose-200" },
  late:         { label: "En retard",     badgeClass: "overdue", twClass: "bg-rose-50 text-rose-700 border-rose-200" },
  cancelled:    { label: "Annule",        badgeClass: "",        twClass: "bg-slate-50 text-slate-500 border-slate-200" },
  refunded:     { label: "Rembourse",     badgeClass: "",        twClass: "bg-slate-50 text-slate-500 border-slate-200" },
  inactive:     { label: "Inactif",       badgeClass: "",        twClass: "bg-slate-50 text-slate-400 border-slate-200" },
  loue:         { label: "Loue",          badgeClass: "paid",    twClass: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  vacant:       { label: "Vacant",        badgeClass: "overdue", twClass: "bg-rose-50 text-rose-700 border-rose-200" },
  en_renovation:{ label: "En renovation", badgeClass: "info",    twClass: "bg-sky-50 text-sky-700 border-sky-200" },
  vendu:        { label: "Vendu",         badgeClass: "warning", twClass: "bg-amber-50 text-amber-700 border-amber-200" },
};

const STATUS_FALLBACK = { label: "", badgeClass: "", twClass: "bg-slate-50 text-slate-500 border-slate-200" };

export function formatStatus(statusKey) {
  return STATUS_MAP[statusKey] || Object.assign({}, STATUS_FALLBACK, { label: statusKey || "" });
}
export function formatStatusLabel(statusKey) { return formatStatus(statusKey).label; }
export function formatStatusClass(statusKey) { return formatStatus(statusKey).badgeClass; }
export function formatStatusTw(statusKey)   { return formatStatus(statusKey).twClass; }