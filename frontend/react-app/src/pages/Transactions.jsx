import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTransactions, useTransactionStats } from '../hooks/queries/useTransactions';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ToastContext';
import { API } from '../api/services';
import { CONFIG } from '../api/config';
import StatsCard from '../components/StatsCard';
import { formatXOF, formatDate, formatMethod, formatStatus, formatStatusLabel, formatStatusClass } from '../utils/formatters';
import ReceiptTemplate from '../components/ReceiptTemplate';

const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'processed', label: 'Traité' },
  { value: 'pending', label: 'En attente' },
  { value: 'cancelled', label: 'Annulé' },
  { value: 'refunded', label: 'Remboursé' },
];

const METHOD_OPTIONS = [
  { value: '', label: 'Tous les moyens' },
  { value: 'cash', label: 'Espèces' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'bank_transfer', label: 'Virement' },
  { value: 'check', label: 'Chèque' },
  { value: 'card', label: 'Carte' },
];



const COLUMNS = [
  { key: 'reference', label: 'Réf.' },
  { key: 'date', label: 'Date' },
  { key: 'client', label: 'Client' },
  { key: 'description', label: 'Description' },
  { key: 'amount', label: 'Montant (XOF)' },
  { key: 'method', label: 'Moyen' },
  { key: 'status', label: 'Statut' },
];

export default function Transactions() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [printTransaction, setPrintTransaction] = useState(null);
  const [viewTransaction, setViewTransaction] = useState(null);
  const [reversingTransaction, setReversingTransaction] = useState(null);
  const [reversalReason, setReversalReason] = useState('');
  const [isSubmittingReversal, setIsSubmittingReversal] = useState(false);

  // Seuls admin, director et accounting peuvent extourner un paiement (FIN-006)
  const canReverse = ['admin', 'director', 'accounting'].includes(user?.role);
  const [searchParams, setSearchParams] = useSearchParams();
  const searchTerm = searchParams.get('search') || '';
  const statusFilter = searchParams.get('status') || '';
  const methodFilter = searchParams.get('method') || '';
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = 25;

  const handleFilterChange = (key, value) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    if (key !== 'page') newParams.delete('page');
    setSearchParams(newParams);
  };

  const filters = {
    page, limit,
    search: searchTerm,
    status: statusFilter,
    method: methodFilter,
    dateFrom, dateTo
  };

  const { data: queryResult = {}, isLoading: loading, error: listError } = useTransactions(filters);
  const transactions = Array.isArray(queryResult) ? queryResult : (queryResult?.data || []);
  const pagination = queryResult?.pagination || {};
  const isLastPage = pagination.hasNextPage === false;

  const { data: stats = {} } = useTransactionStats(filters);

  const totalCollected = stats.totalCollected || 0;
  const totalPending = stats.totalPending || 0;
  const processedCount = stats.processedCount || 0;
  const transactionCount = stats.transactionCount || 0;
  const hasActiveFilters = Boolean(searchTerm || statusFilter || methodFilter || dateFrom || dateTo);
  const transactionsEmptyMessage = loading
    ? 'Chargement des transactions...'
    : listError || (hasActiveFilters
      ? 'Aucune transaction ne correspond aux filtres.'
      : 'Aucune transaction enregistrée pour le moment.');

  const inputStyle = {
    padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)',
    fontSize: '13px', background: 'var(--bg)', color: 'inherit'
  };

  const handleExportCsv = async () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (methodFilter) params.set('method', methodFilter);
    if (searchTerm) params.set('search', searchTerm);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    const qs = params.toString();
    const res = await fetch(`/api/transactions/export/csv${qs ? '?' + qs : ''}`, {
      credentials: 'include'
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `transactions_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <i className="fas fa-exchange-alt text-primary"></i> Transactions
          </h1>
          <p className="text-slate-500 text-sm mt-1">Consultez et exportez l'historique financier des paiements et versements.</p>
        </div>
        <button 
          className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm flex items-center gap-2" 
          onClick={handleExportCsv}
        >
          <i className="fas fa-download text-primary"></i> Exporter en CSV
        </button>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard label="Total encaissé" value={formatXOF(totalCollected, { compact: false })} icon="fa-wallet" color="var(--success)" />
        <StatsCard label="En attente" value={formatXOF(totalPending, { compact: false })} icon="fa-clock" color="var(--warning)" />
        <StatsCard label="Transactions" value={transactionCount} icon="fa-list" color="var(--primary)" />
        <StatsCard label="Traitées" value={processedCount} icon="fa-check-circle" color="#3B82F6" />
      </div>

      {/* OUTILS ET FILTRES */}
      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div className="relative w-full lg:w-96">
          <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
          <input type="text" placeholder="Rechercher par référence, client..." value={searchTerm}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white hover:bg-slate-100 transition-all placeholder:text-slate-400" 
          />
        </div>
        
        <div className="w-full lg:w-auto flex flex-wrap md:flex-nowrap items-center gap-3">
          <div className="relative w-full md:w-auto shrink-0">
            <select value={statusFilter} onChange={(e) => handleFilterChange('status', e.target.value)} 
              className="w-full md:w-auto appearance-none pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white hover:bg-slate-100 transition-all cursor-pointer">
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <i className="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs"></i>
          </div>

          <div className="relative w-full md:w-auto shrink-0">
            <select value={methodFilter} onChange={(e) => handleFilterChange('method', e.target.value)} 
              className="w-full md:w-auto appearance-none pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white hover:bg-slate-100 transition-all cursor-pointer">
              {METHOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <i className="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs"></i>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
            <input type="date" value={dateFrom} onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              className="w-full md:w-36 pl-3 pr-2 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white hover:bg-slate-100 transition-all cursor-pointer" 
            />
            <span className="text-slate-400 text-sm font-medium">-</span>
            <input type="date" value={dateTo} onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              className="w-full md:w-36 pl-3 pr-2 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white hover:bg-slate-100 transition-all cursor-pointer" 
            />
          </div>
        </div>
      </div>

      {/* TABLEAU */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto min-w-0">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                <th className="py-3 px-6 font-semibold">Réf.</th>
                <th className="py-3 px-6 font-semibold">Client</th>
                <th className="py-3 px-6 font-semibold">Montant</th>
                <th className="py-3 px-6 font-semibold">Moyen</th>
                <th className="py-3 px-6 font-semibold">Statut</th>
                <th className="py-3 px-6 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-500">
                    <i className="fas fa-spinner fa-spin text-primary text-xl mb-3 block"></i>
                    Chargement des transactions...
                  </td>
                </tr>
              ) : transactions.length > 0 ? (
                transactions.map(t => (
                  <tr key={t.id || t.reference || Math.random()} className="group hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-6 text-sm text-slate-700 font-mono text-xs">{t.reference || '-'}</td>
                    <td className="py-4 px-6 text-sm text-slate-900 font-medium">{t.client_name || '-'}</td>
                    <td className="py-4 px-6 text-sm text-slate-900 font-bold">{formatXOF(t.amount, { compact: false })}</td>
                    <td className="py-4 px-6 text-sm text-slate-700">{formatMethod(t.method)}</td>
                    <td className="py-4 px-6">
                      {(() => { const s = formatStatus(t.status); return (
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${s.twClass}`}>
                          {t.status === 'processed' || t.status === 'paid' ? <i className="fas fa-check-circle mr-1.5 text-[10px]"></i> : null}
                          {t.status === 'pending' ? <i className="fas fa-clock mr-1.5 text-[10px]"></i> : null}
                          {t.status === 'refunded' ? <i className="fas fa-undo mr-1.5 text-[10px]"></i> : null}
                          {s.label || t.status || 'Annulé'}
                        </span>
                      ); })()}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-end gap-2">
                        {canReverse && t.status !== 'cancelled' && t.status !== 'refunded' && !t.is_reversed && (
                          <button 
                            onClick={() => { setReversingTransaction(t); setReversalReason(''); }}
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent transition-all"
                            title="Extourner / Annuler cette transaction (FIN-006)"
                          >
                            <i className="fas fa-undo"></i>
                          </button>
                        )}
                        <button 
                          onClick={() => setViewTransaction(t)}
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent transition-all"
                          title="Voir les détails"
                        >
                          <i className="fas fa-eye"></i>
                        </button>
                        <button 
                          onClick={() => setPrintTransaction(t)}
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/5 border border-transparent transition-all"
                          title="Imprimer le reçu"
                        >
                          <i className="fas fa-print"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-500">
                    <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                      <i className="fas fa-file-invoice text-slate-400 text-xl"></i>
                    </div>
                    {transactionsEmptyMessage}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* PAGINATION */}
        {transactions.length > 0 && (
          <div className="flex justify-between items-center px-6 py-4 border-t border-slate-100 bg-slate-50/50">
            <p className="text-sm text-slate-500">Page {page}</p>
            <div className="flex gap-2">
              <button 
                disabled={page <= 1} onClick={() => handleFilterChange('page', page - 1)}
                className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm disabled:opacity-50 hover:bg-slate-50 transition-colors"
              >
                Précédent
              </button>
              <button 
                disabled={isLastPage} onClick={() => handleFilterChange('page', page + 1)}
                className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm disabled:opacity-50 hover:bg-slate-50 transition-colors"
              >
                Suivant
              </button>
            </div>
          </div>
        )}

        {/* Impression de reçu */}
        <ReceiptTemplate 
          transaction={printTransaction} 
          onClose={() => setPrintTransaction(null)} 
        />

        {/* Modal de détails */}
        {viewTransaction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <i className="fas fa-file-invoice-dollar text-primary"></i> Détails de la transaction
                </h3>
                <button onClick={() => setViewTransaction(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <i className="fas fa-times text-lg"></i>
                </button>
              </div>
              <div className="p-6 overflow-y-auto space-y-6">
                
                <div className="flex justify-between items-start bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Montant payé</p>
                    <p className="text-3xl font-extrabold text-slate-900">{formatXOF(viewTransaction.amount, { compact: false })}</p>
                  </div>
                  <div className="text-right">
                    {(() => { const s = formatStatus(viewTransaction.status); return (
                      <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold border ${s.twClass}`}>
                        {s.label || viewTransaction.status || 'Annulé'}
                      </span>
                    ); })()}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Informations générales</h4>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-slate-500">Référence</p>
                        <p className="text-sm font-mono text-slate-900">{viewTransaction.reference || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Date de la transaction</p>
                        <p className="text-sm text-slate-900 font-medium">{viewTransaction.date ? String(viewTransaction.date).substring(0, 10) : (viewTransaction.date_display || '-')}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Moyen de paiement</p>
                        <p className="text-sm text-slate-900 font-medium">{formatMethod(viewTransaction.method)}</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Acteurs</h4>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-slate-500">Client / Locataire</p>
                        <p className="text-sm text-slate-900 font-bold">{viewTransaction.client_name || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Encaissé par (Récolteur)</p>
                        <p className="text-sm text-slate-900 font-medium">{viewTransaction.collector_name || viewTransaction.username || 'Non renseigné'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Description et détails</h4>
                  <p className="text-sm text-slate-700 bg-slate-50 p-4 rounded-lg border border-slate-100">
                    {viewTransaction.description || 'Aucune description fournie pour cette transaction.'}
                  </p>
                </div>

              </div>
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                <button 
                  onClick={() => setPrintTransaction(viewTransaction)}
                  className="px-4 py-2 border border-primary text-primary hover:bg-primary hover:text-white font-medium text-sm rounded-lg transition-colors flex items-center gap-2"
                >
                  <i className="fas fa-print"></i> Imprimer le reçu
                </button>
                <button onClick={() => setViewTransaction(null)} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium text-sm rounded-lg transition-colors">
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL D'EXTOURNE COMPTABLE (FIN-006, FIN-007) */}
        {reversingTransaction && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-rose-50/50">
                <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <i className="fas fa-undo text-lg"></i>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">Extourne comptable</h3>
                  <p className="text-xs text-slate-500">Annulation officielle avec écriture compensatoire (FIN-007)</p>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                  <p><span className="font-semibold text-slate-700">Réf :</span> <span className="font-mono">{reversingTransaction.reference}</span></p>
                  <p><span className="font-semibold text-slate-700">Client :</span> {reversingTransaction.client_name || '-'}</p>
                  <p><span className="font-semibold text-slate-700">Montant :</span> <span className="font-bold text-slate-900">{formatXOF(reversingTransaction.amount)}</span></p>
                </div>

                <div>
                  <label htmlFor="reversalReason" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Motif obligatoire de l'extourne <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    id="reversalReason"
                    rows="3"
                    value={reversalReason}
                    onChange={(e) => setReversalReason(e.target.value)}
                    placeholder="Ex: Erreur de saisie caisse, chèque rejeté par la banque, virement doublon..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Cette écriture sera archivée de façon immuable dans le Grand Livre.</p>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setReversingTransaction(null)}
                  className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium text-sm rounded-lg transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={isSubmittingReversal || !reversalReason.trim() || reversalReason.trim().length < 5}
                  onClick={async () => {
                    setIsSubmittingReversal(true);
                    try {
                      // Appel du endpoint d'extourne
                      const res = await API.Financial.reversePayment(reversingTransaction.id, {
                        reason: reversalReason.trim()
                      });
                      if (res?.success) {
                        showToast({ type: 'success', message: 'Transaction extournée avec succès.' });
                        setReversingTransaction(null);
                        window.location.reload();
                      } else {
                        showToast({ type: 'error', message: res?.error || 'Erreur lors de l\'extourne.' });
                      }
                    } catch (err) {
                      showToast({ type: 'error', message: err?.response?.data?.error || err.message || 'Erreur lors de l\'extourne.' });
                    } finally {
                      setIsSubmittingReversal(false);
                    }
                  }}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium text-sm rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmittingReversal ? <><i className="fas fa-spinner fa-spin"></i> Traitement...</> : 'Confirmer l\'extourne'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
