import React, { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { API } from '../../api/services';
import useModalEscape from '../../hooks/useModalEscape';
import { formatXOF } from '../../utils/formatters';

export default function ImportPortfolioModal({ isOpen, onClose }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);

  const [step, setStep] = useState(1); // 1 = Upload, 2 = Preview, 3 = Result
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [importResult, setImportResult] = useState(null);

  useModalEscape(isOpen, onClose);

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setDragActive(false);
    setSelectedFile(null);
    setAnalyzing(false);
    setExecuting(false);
    setError('');
    setPreviewData(null);
    setImportResult(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDownloadTemplate = async () => {
    setError('');
    setDownloadingTemplate(true);
    try {
      await API.Import.downloadTemplate();
    } catch (err) {
      setError(err.message || 'Erreur lors du téléchargement du modèle.');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const processFile = async (file) => {
    if (!file) return;
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      setError('Format de fichier non supporté. Veuillez déposer un fichier .xlsx, .xls ou .csv.');
      return;
    }

    setError('');
    setSelectedFile(file);
    setAnalyzing(true);
    try {
      const resp = await API.Import.previewPortfolio(file);
      const data = resp?.data || resp;
      setPreviewData(data);
      setStep(2);
    } catch (err) {
      setError(err.message || 'Impossible d\'analyser le fichier.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleExecuteImport = async () => {
    if (!previewData?.validRows?.length) return;
    setError('');
    setExecuting(true);
    setStep(3);

    try {
      const resp = await API.Import.executePortfolio(previewData.validRows);
      const result = resp?.data || resp;
      setImportResult(result);

      // Rafraîchir tout le cache métier TanStack Query
      queryClient.invalidateQueries({ queryKey: ['owners'] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Erreur lors de l\'importation.');
      setStep(2);
    } finally {
      setExecuting(false);
    }
  };

  const summary = previewData?.summary || {};
  const validRows = previewData?.validRows || [];
  const errorRows = previewData?.errorRows || [];

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget && !executing) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[92dvh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <i className="fas fa-file-excel text-lg"></i>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">Importation Massive du Portefeuille</h2>
              <p className="text-xs text-slate-500">Propriétaires, Biens, Locataires, Loyers & Cautions depuis Excel / CSV</p>
            </div>
          </div>
          {!executing && (
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Fermer"
            >
              <i className="fas fa-times text-sm"></i>
            </button>
          )}
        </div>

        {/* Stepper */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs font-semibold shrink-0">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-primary' : 'text-slate-400'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${step > 1 ? 'bg-emerald-500 text-white' : step === 1 ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'}`}>
              {step > 1 ? <i className="fas fa-check"></i> : '1'}
            </span>
            <span>Modèle & Fichier</span>
          </div>
          <div className="flex-1 h-px bg-slate-200 mx-4"></div>
          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-primary' : 'text-slate-400'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${step > 2 ? 'bg-emerald-500 text-white' : step === 2 ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'}`}>
              {step > 2 ? <i className="fas fa-check"></i> : '2'}
            </span>
            <span>Prévisualisation & Contrôle</span>
          </div>
          <div className="flex-1 h-px bg-slate-200 mx-4"></div>
          <div className={`flex items-center gap-2 ${step === 3 ? 'text-primary' : 'text-slate-400'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${step === 3 && importResult ? 'bg-emerald-500 text-white' : step === 3 ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'}`}>
              {importResult ? <i className="fas fa-check"></i> : '3'}
            </span>
            <span>Importation & Bilan</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {error && (
            <div className="flex items-center gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold">
              <i className="fas fa-exclamation-circle text-rose-500 text-sm shrink-0"></i>
              <span>{error}</span>
            </div>
          )}

          {/* ÉTAPE 1 : TÉLÉCHARGEMENT MODÈLE & DÉPÔT */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-sm font-bold text-indigo-950 flex items-center gap-2">
                    <i className="fas fa-download text-indigo-600"></i>
                    Besoin du fichier modèle prêt à remplir ?
                  </div>
                  <p className="text-xs text-indigo-800/80">
                    Téléchargez le gabarit Excel officiel contenant les colonnes exactes, les formats attendus et 3 exemples pré-remplis.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  disabled={downloadingTemplate}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shrink-0 transition-colors shadow-sm cursor-pointer disabled:opacity-60"
                >
                  {downloadingTemplate
                    ? <><i className="fas fa-spinner fa-spin"></i> Téléchargement...</>
                    : <><i className="fas fa-file-download"></i> Télécharger le modèle Excel (.xlsx)</>
                  }
                </button>
              </div>

              {/* Zone Drag & Drop */}
              <div
                onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
                onDrop={handleDrop}
                onClick={() => !analyzing && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer ${
                  dragActive
                    ? 'border-primary bg-primary/5'
                    : 'border-slate-300 hover:border-primary/60 hover:bg-slate-50/70'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) processFile(e.target.files[0]);
                    e.target.value = '';
                  }}
                />
                {analyzing ? (
                  <div className="space-y-3 py-4">
                    <i className="fas fa-spinner fa-spin text-3xl text-primary"></i>
                    <div className="text-sm font-bold text-slate-800">Analyse et déduplication en cours...</div>
                    <p className="text-xs text-slate-500">Vérification des propriétaires existants, références et formats numériques.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center text-2xl">
                      <i className="fas fa-cloud-upload-alt"></i>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        Glissez-déposez votre fichier Excel ou CSV ici
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        ou <span className="text-primary font-semibold underline">cliquez pour parcourir</span> (.xlsx, .xls, .csv — max 5 Mo)
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ÉTAPE 2 : PRÉVISUALISATION & CONTRÔLE QUALITÉ */}
          {step === 2 && previewData && (
            <div className="space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="text-xs text-slate-600">
                  Fichier analysé : <span className="font-bold text-slate-900">{selectedFile?.name}</span> ({summary.totalRows} lignes détectées)
                </div>
                <button
                  type="button"
                  onClick={() => { setStep(1); setPreviewData(null); }}
                  className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                >
                  <i className="fas fa-arrow-left mr-1"></i> Changer de fichier
                </button>
              </div>

              {/* Cartes de synthèse */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div className="text-[11px] font-semibold text-emerald-700 uppercase">Lignes valides</div>
                  <div className="text-xl font-extrabold text-emerald-900 mt-0.5">{summary.validCount || 0}</div>
                </div>
                <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200">
                  <div className="text-[11px] font-semibold text-indigo-700 uppercase">Nouv. proprios</div>
                  <div className="text-xl font-extrabold text-indigo-900 mt-0.5">{summary.newOwnersCount || 0}</div>
                </div>
                <div className="p-3 rounded-xl bg-sky-50 border border-sky-200">
                  <div className="text-[11px] font-semibold text-sky-700 uppercase">Proprios rattachés</div>
                  <div className="text-xl font-extrabold text-sky-900 mt-0.5">{summary.existingOwnersLinkedCount || 0}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] font-semibold text-slate-600 uppercase">Biens à créer</div>
                  <div className="text-xl font-extrabold text-slate-900 mt-0.5">{summary.propertiesToCreateCount || 0}</div>
                </div>
                <div className="p-3 rounded-xl bg-purple-50 border border-purple-200">
                  <div className="text-[11px] font-semibold text-purple-700 uppercase">Locataires</div>
                  <div className="text-xl font-extrabold text-purple-900 mt-0.5">{summary.tenantsToAssignCount || 0}</div>
                </div>
                <div className={`p-3 rounded-xl border ${summary.errorCount > 0 ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'}`}>
                  <div className={`text-[11px] font-semibold uppercase ${summary.errorCount > 0 ? 'text-rose-700' : 'text-slate-500'}`}>En erreur</div>
                  <div className={`text-xl font-extrabold mt-0.5 ${summary.errorCount > 0 ? 'text-rose-900' : 'text-slate-700'}`}>{summary.errorCount || 0}</div>
                </div>
              </div>

              {/* Tableau des erreurs s'il y en a */}
              {errorRows.length > 0 && (
                <div className="rounded-xl border border-rose-200 bg-rose-50/50 overflow-hidden">
                  <div className="px-4 py-2.5 bg-rose-100/70 border-b border-rose-200 text-xs font-bold text-rose-800 flex items-center gap-2">
                    <i className="fas fa-exclamation-triangle"></i>
                    Lignes ignorées pour cause d'erreur ({errorRows.length}) — les lignes valides seront tout de même importées
                  </div>
                  <div className="max-h-40 overflow-y-auto divide-y divide-rose-100">
                    {errorRows.map((errItem) => (
                      <div key={errItem.rowNumber} className="px-4 py-2 text-xs flex items-start gap-3">
                        <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-bold shrink-0">
                          Ligne {errItem.rowNumber}
                        </span>
                        <span className="text-rose-800 font-medium">{errItem.errors.join(' • ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tableau de prévisualisation des lignes valides */}
              {validRows.length > 0 && (
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700">
                    Aperçu des lignes prêtes à l'importation ({validRows.length})
                  </div>
                  <div className="overflow-x-auto max-h-64">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3 font-semibold text-slate-500">Ligne</th>
                          <th className="py-2 px-3 font-semibold text-slate-500">Statut</th>
                          <th className="py-2 px-3 font-semibold text-slate-500">Propriétaire</th>
                          <th className="py-2 px-3 font-semibold text-slate-500">Bien</th>
                          <th className="py-2 px-3 font-semibold text-slate-500 text-right">Loyer</th>
                          <th className="py-2 px-3 font-semibold text-slate-500">Locataire</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {validRows.map((row) => (
                          <tr key={row.rowNumber} className="hover:bg-slate-50/70">
                            <td className="py-2 px-3 font-mono text-slate-500">#{row.rowNumber}</td>
                            <td className="py-2 px-3">
                              {row.ownerStatus === 'EXISTING' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800">
                                  <i className="fas fa-link text-[9px]"></i> Propriétaire existant
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                                  <i className="fas fa-check text-[9px]"></i> Prêt
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              <div className="font-semibold text-slate-900">{row.proprietaire_nom}</div>
                              <div className="text-[11px] text-slate-500">{row.proprietaire_telephone || 'Sans tél.'}</div>
                            </td>
                            <td className="py-2 px-3">
                              <div className="font-semibold text-slate-900">{row.bien_titre}</div>
                              <div className="text-[11px] text-slate-500">
                                {row.bien_reference || 'Réf. auto'} • {row.bien_type}{row.bien_zone ? ` • ${row.bien_zone}` : ''}
                              </div>
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-slate-900 tabular-nums">
                              {formatXOF(row.loyer_mensuel)}
                            </td>
                            <td className="py-2 px-3">
                              {row.locataire_nom ? (
                                <div>
                                  <div className="font-medium text-slate-900">{row.locataire_nom}</div>
                                  <div className="text-[11px] text-slate-500">
                                    Caution : {formatXOF(row.caution_versee)}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">Bien vacant</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ÉTAPE 3 : EXÉCUTION & RAPPORT FINAL */}
          {step === 3 && (
            <div className="py-6 text-center space-y-5">
              {executing ? (
                <div className="space-y-4 py-8">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-3xl">
                    <i className="fas fa-spinner fa-spin"></i>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Importation transactionnelle en cours...</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Création des fiches propriétaires, biens, baux et mise à jour des soldes en base de données.
                    </p>
                  </div>
                </div>
              ) : importResult ? (
                <div className="space-y-5 max-w-xl mx-auto">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-3xl">
                    <i className="fas fa-check-circle"></i>
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900">Importation terminée avec succès !</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Toutes les données valides ont été enregistrées et les tableaux ont été actualisés.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
                    <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200">
                      <div className="text-[11px] font-semibold text-indigo-700">Nouv. propriétaires</div>
                      <div className="text-2xl font-extrabold text-indigo-950">{importResult.ownersCreated}</div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200">
                      <div className="text-[11px] font-semibold text-sky-700">Proprios rattachés</div>
                      <div className="text-2xl font-extrabold text-sky-950">{importResult.ownersLinked}</div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                      <div className="text-[11px] font-semibold text-emerald-700">Biens créés</div>
                      <div className="text-2xl font-extrabold text-emerald-950">{importResult.propertiesCreated}</div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200">
                      <div className="text-[11px] font-semibold text-purple-700">Locataires attribués</div>
                      <div className="text-2xl font-extrabold text-purple-950">{importResult.tenantsCreated}</div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
          {step === 1 && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 cursor-pointer"
            >
              Fermer
            </button>
          )}
          {step === 2 && (
            <>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 cursor-pointer"
              >
                Retour
              </button>
              <button
                type="button"
                disabled={validRows.length === 0}
                onClick={handleExecuteImport}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
              >
                <i className="fas fa-file-import"></i>
                Importer {validRows.length} ligne{validRows.length > 1 ? 's' : ''} valide{validRows.length > 1 ? 's' : ''}
              </button>
            </>
          )}
          {step === 3 && !executing && (
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-xs font-bold text-white bg-primary hover:bg-primary-dark rounded-xl shadow-sm cursor-pointer"
            >
              Terminer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
