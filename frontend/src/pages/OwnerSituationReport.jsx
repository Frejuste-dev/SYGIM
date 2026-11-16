import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useOwners } from '../hooks/queries/useOwners';
import { useOwnerSituation } from '../hooks/queries/useReports';
import { formatNumberWithSpaces, formatAmountInFrenchWords } from '../utils/numberToFrenchWords';

const MONTH_NAMES = [
  { value: 1, label: 'Janvier' },
  { value: 2, label: 'Février' },
  { value: 3, label: 'Mars' },
  { value: 4, label: 'Avril' },
  { value: 5, label: 'Mai' },
  { value: 6, label: 'Juin' },
  { value: 7, label: 'Juillet' },
  { value: 8, label: 'Août' },
  { value: 9, label: 'Septembre' },
  { value: 10, label: 'Octobre' },
  { value: 11, label: 'Novembre' },
  { value: 12, label: 'Décembre' }
];

export default function OwnerSituationReport({ embedded = false }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Paramètres URL ou valeurs par défaut
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const urlOwnerId = searchParams.get('ownerId') || '';
  const urlMonth = parseInt(searchParams.get('month') || currentMonth, 10);
  const urlYear = parseInt(searchParams.get('year') || currentYear, 10);
  const urlRate = searchParams.get('commissionRate') || '10';

  // Liste de tous les propriétaires pour le sélecteur
  const { data: ownersData = {}, isLoading: ownersLoading } = useOwners({ limit: 100 });
  const owners = Array.isArray(ownersData) ? ownersData : (ownersData?.data || []);

  const [selectedOwnerId, setSelectedOwnerId] = useState(urlOwnerId);
  const [selectedMonth, setSelectedMonth] = useState(urlMonth);
  const [selectedYear, setSelectedYear] = useState(urlYear);
  const [commissionRate, setCommissionRate] = useState(urlRate);
  const [customZone, setCustomZone] = useState('');
  const [customObservations, setCustomObservations] = useState({});

  // Met à jour le propriétaire si le paramètre d'URL change
  useEffect(() => {
    if (urlOwnerId && urlOwnerId !== selectedOwnerId) {
      setSelectedOwnerId(urlOwnerId);
    }
  }, [urlOwnerId]);

  // Sélectionne le premier propriétaire par défaut si aucun n'est spécifié
  useEffect(() => {
    if (!selectedOwnerId && owners.length > 0) {
      setSelectedOwnerId(String(owners[0].id));
    }
  }, [owners, selectedOwnerId]);

  // Synchronise l'URL avec les sélections
  const handleFilterChange = (key, val) => {
    const nextParams = new URLSearchParams(searchParams);
    if (val !== undefined && val !== null && val !== '') {
      nextParams.set(key, val);
    } else {
      nextParams.delete(key);
    }
    setSearchParams(nextParams, { replace: true });
  };

  // Requête API dédiée pour la situation du propriétaire
  const {
    data: situationData,
    isLoading: situationLoading,
    error: situationError
  } = useOwnerSituation(
    selectedOwnerId,
    {
      month: selectedMonth,
      year: selectedYear,
      commissionRate: commissionRate
    },
    { enabled: Boolean(selectedOwnerId) }
  );

  const owner = situationData?.owner || {};
  const period = situationData?.period || {};
  const units = situationData?.units || [];
  const summary = situationData?.summary || {};

  // Initialisation de la zone géographique
  useEffect(() => {
    if (owner?.zone && !customZone) {
      setCustomZone(owner.zone);
    }
  }, [owner?.zone]);

  // Regroupement des unités par étage
  const groupedUnits = useMemo(() => {
    const groups = {};
    for (const unit of units) {
      const floor = unit.floorLevel || 'REZ-DE-CHAUSSEE';
      if (!groups[floor]) {
        groups[floor] = [];
      }
      groups[floor].push(unit);
    }
    return groups;
  }, [units]);

  // Gestion des observations éditables localement
  const handleObservationChange = (unitId, value) => {
    setCustomObservations(prev => ({
      ...prev,
      [unitId]: value
    }));
  };

  const getObservation = (unit) => {
    if (customObservations[unit.id] !== undefined) {
      return customObservations[unit.id];
    }
    return unit.observation || '—';
  };

  // Date du jour formatée en lettres pour le pied de page
  const todayFormattedInWords = useMemo(() => {
    const now = new Date();
    const day = now.getDate();
    const mName = MONTH_NAMES[now.getMonth()]?.label?.toUpperCase() || 'NOVEMBRE';
    const yr = now.getFullYear();
    return `${day} ${mName} ${yr}`;
  }, []);

  const monthLabel = useMemo(() => {
    const found = MONTH_NAMES.find(m => m.value === selectedMonth);
    return found?.label || 'Novembre';
  }, [selectedMonth]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={embedded ? "w-full py-2 print:p-0 text-slate-900 font-sans" : "min-h-screen bg-slate-100 py-6 px-3 sm:px-6 print:p-0 print:bg-white text-slate-900 font-sans"}>
      {/* 1. BARRE DE CONTRÔLE SUPÉRIEURE (MASQUÉE À L'IMPRESSION) */}
      <div className="max-w-[960px] mx-auto mb-6 bg-white border border-slate-200/90 rounded-2xl shadow-sm p-4 sm:p-5 print:hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            {!embedded && (
              <button
                type="button"
                onClick={() => navigate('/admin/owners')}
                className="w-9 h-9 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center transition-colors"
                title="Retour aux propriétaires"
              >
                <i className="fas fa-arrow-left text-sm"></i>
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-100">
                  Document Officiel
                </span>
                <span className="text-xs text-slate-400">Cabinet Me DOUHO MAXIME</span>
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900">
                Situation Mensuelle du Propriétaire
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handlePrint}
              disabled={situationLoading || !selectedOwnerId || units.length === 0}
              className="px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-bold shadow-sm hover:bg-primary-dark transition-all inline-flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <i className="fas fa-print"></i>
              <span>Imprimer / Exporter en PDF</span>
            </button>
          </div>
        </div>

        {/* Filtres de configuration */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4">
          {/* Sélection Propriétaire */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Propriétaire <span className="text-rose-600">*</span>
            </label>
            <select
              value={selectedOwnerId}
              onChange={(e) => {
                setSelectedOwnerId(e.target.value);
                handleFilterChange('ownerId', e.target.value);
              }}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              {owners.map(o => (
                <option key={o.id} value={o.id}>
                  {o.display_name || `${o.first_name || ''} ${o.last_name || ''}`.trim() || `Propriétaire #${o.id}`}
                </option>
              ))}
            </select>
          </div>

          {/* Mois & Année */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Mois
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setSelectedMonth(val);
                  handleFilterChange('month', val);
                }}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {MONTH_NAMES.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Année
              </label>
              <input
                type="number"
                value={selectedYear}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setSelectedYear(val);
                  handleFilterChange('year', val);
                }}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* Quartier / Zone */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Quartier / Zone (Titre)
            </label>
            <input
              type="text"
              placeholder="Ex : SOWETO, RIVIERA"
              value={customZone}
              onChange={(e) => setCustomZone(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 uppercase focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Taux de commission (%) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Taux Commission (%)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.5"
                min="0"
                max="100"
                value={commissionRate}
                onChange={(e) => {
                  setCommissionRate(e.target.value);
                  handleFilterChange('commissionRate', e.target.value);
                }}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">%</span>
            </div>
          </div>
        </div>

        <div className="mt-3 text-[11px] text-slate-500 flex items-center gap-1.5">
          <i className="fas fa-info-circle text-primary"></i>
          <span>
            Les observations sur chaque ligne du tableau peuvent être modifiées directement à l'écran avant impression.
          </span>
        </div>
      </div>

      {/* ÉTAT DE CHARGEMENT OU D'ERREUR */}
      {situationLoading && (
        <div className="max-w-[960px] mx-auto p-12 bg-white rounded-2xl border border-slate-200 text-center print:hidden">
          <i className="fas fa-circle-notch fa-spin text-3xl text-primary mb-3"></i>
          <p className="text-sm font-semibold text-slate-700">Génération de la situation officielle...</p>
        </div>
      )}

      {situationError && (
        <div className="max-w-[960px] mx-auto p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-sm print:hidden">
          <i className="fas fa-exclamation-triangle mr-2"></i>
          {situationError.message || 'Erreur lors du chargement de la situation du propriétaire.'}
        </div>
      )}

      {/* 2. DOCUMENT OFFICIEL A4 (FIDÈLE À 100 % AUX MODÈLES DU CABINET) */}
      {!situationLoading && !situationError && (
        <div
          id="official-owner-situation-document"
          className="bg-white mx-auto max-w-[960px] p-6 sm:p-10 shadow-lg border border-slate-200/80 rounded-2xl text-slate-900 print:shadow-none print:border-none print:p-0 print:max-w-none print:w-full print:m-0 print:rounded-none"
        >
          {/* EN-TÊTE OFFICIEL DU CABINET */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b-2 border-slate-900">
            {/* Colonne Gauche : Logo + Titre Cabinet */}
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 border-2 border-slate-900 rounded-lg flex items-center justify-center shrink-0">
                <i className="fas fa-balance-scale text-slate-900 text-xl"></i>
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 uppercase">
                  CABINET Maître DOUHO MAXIME
                </h2>
                <p className="text-[11px] font-semibold text-slate-700 italic">
                  Près le Tribunal de Première Instance d'Abidjan Plateau
                </p>
                <p className="text-[10px] font-bold tracking-wider text-slate-800 uppercase mt-0.5">
                  Agent d'Affaires Judiciaires
                </p>
              </div>
            </div>

            {/* Colonne Droite : Activités du Cabinet */}
            <div className="sm:text-right max-w-sm">
              <p className="text-[10px] sm:text-[11px] text-slate-700 leading-tight italic">
                Cabinet de Recouvrement de Créances, de Transactions, de Courtages,
                d'Administration d'Immeubles, de Conseils et Assistances Juridiques.
              </p>
            </div>
          </div>

          {/* TITRE OFFICIEL ENCADRÉ & SOULIGNÉ */}
          <div className="my-6 text-center">
            <span className="inline-block border-2 border-slate-900 px-4 sm:px-8 py-2 font-black text-xs sm:text-sm md:text-base tracking-wider uppercase underline underline-offset-4 bg-slate-50/50 print:bg-transparent">
              SITUATION DE {owner?.name || 'PROPRIÉTAIRE'} AU MOIS DE {monthLabel.toUpperCase()} {selectedYear} ({customZone || owner?.zone || 'SOWETO'})
            </span>
          </div>

          {/* TABLEAU OFFICIEL À BORDURES NOIRES NETTES */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-slate-900 text-xs text-slate-900">
              <thead>
                <tr className="bg-slate-100 print:bg-slate-100/60 font-black text-center border-b border-slate-900 uppercase">
                  <th className="border border-slate-900 py-2 px-1 w-8">N°</th>
                  <th className="border border-slate-900 py-2 px-2 text-left">NOM &amp; PRENOMS</th>
                  <th className="border border-slate-900 py-2 px-2 text-left">TYPE DE MAISON</th>
                  <th className="border border-slate-900 py-2 px-2 text-right">LOYER</th>
                  <th className="border border-slate-900 py-2 px-2 text-right">SOMME VERSEE</th>
                  <th className="border border-slate-900 py-2 px-2 text-right">ARRIERES</th>
                  <th className="border border-slate-900 py-2 px-2 text-center">CONTACTS</th>
                  <th className="border border-slate-900 py-2 px-2 text-left">OBSERVATIONS</th>
                </tr>
              </thead>
              <tbody>
                {units.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500 italic border border-slate-900">
                      Aucun bien rattaché à ce propriétaire.
                    </td>
                  </tr>
                ) : (
                  Object.entries(groupedUnits).map(([floor, floorUnits]) => (
                    <React.Fragment key={floor}>
                      {/* LIGNE DE SÉPARATION PLEINE LARGEUR PAR ÉTAGE */}
                      <tr className="bg-slate-100 print:bg-slate-100/80 font-black text-center uppercase tracking-wide border-t border-b border-slate-900">
                        <td colSpan={8} className="py-1 px-2 border border-slate-900 text-slate-900 text-[11px]">
                          {floor.startsWith('AU ') ? floor : `AU ${floor}`}
                        </td>
                      </tr>

                      {/* LIGNES DE DÉTAIL DES UNITÉS */}
                      {floorUnits.map((u) => {
                        const obs = getObservation(u);
                        const isVacant = u.tenantName === 'VACANT';
                        return (
                          <tr key={u.id} className="hover:bg-slate-50/70 transition-colors border-b border-slate-900">
                            {/* N° */}
                            <td className="border border-slate-900 py-1.5 px-1 text-center font-bold tabular-nums">
                              {u.index}
                            </td>

                            {/* NOM & PRENOMS */}
                            <td className={`border border-slate-900 py-1.5 px-2 font-medium ${isVacant ? 'text-rose-700 font-bold italic' : 'text-slate-900'}`}>
                              {u.tenantName}
                            </td>

                            {/* TYPE DE MAISON */}
                            <td className="border border-slate-900 py-1.5 px-2 uppercase font-medium text-slate-800">
                              {u.unitType}
                            </td>

                            {/* LOYER */}
                            <td className="border border-slate-900 py-1.5 px-2 text-right font-bold tabular-nums">
                              {formatNumberWithSpaces(u.rentAmount)}
                            </td>

                            {/* SOMME VERSEE */}
                            <td className={`border border-slate-900 py-1.5 px-2 text-right font-bold tabular-nums ${u.amountPaid > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
                              {formatNumberWithSpaces(u.amountPaid)}
                            </td>

                            {/* ARRIERES */}
                            <td className={`border border-slate-900 py-1.5 px-2 text-right font-bold tabular-nums ${u.arrears > 0 ? 'text-rose-700 font-black' : 'text-slate-400'}`}>
                              {formatNumberWithSpaces(u.arrears)}
                            </td>

                            {/* CONTACTS */}
                            <td className="border border-slate-900 py-1.5 px-2 text-center text-[11px] tabular-nums">
                              {u.contacts}
                            </td>

                            {/* OBSERVATIONS (Éditable à l'écran, affiché en texte brut à l'impression) */}
                            <td className="border border-slate-900 py-1.5 px-2">
                              <span className="print:inline hidden font-medium text-slate-800">
                                {obs}
                              </span>
                              <input
                                type="text"
                                value={obs}
                                onChange={(e) => handleObservationChange(u.id, e.target.value)}
                                className="print:hidden w-full bg-transparent border-0 border-b border-transparent hover:border-slate-300 focus:border-primary focus:bg-sky-50/50 px-1 py-0.5 text-xs text-slate-900 outline-none rounded transition-colors"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))
                )}

                {/* LIGNE DES TOTAUX GLOBAUX */}
                <tr className="bg-slate-100 print:bg-slate-100/90 font-black border-t-2 border-b-2 border-slate-900 text-slate-900 uppercase">
                  <td colSpan={3} className="border border-slate-900 py-2 px-3 text-center tracking-wider">
                    TOTAL
                  </td>
                  <td className="border border-slate-900 py-2 px-2 text-right tabular-nums font-black text-slate-900">
                    {formatNumberWithSpaces(summary?.totalRent || 0)}
                  </td>
                  <td className="border border-slate-900 py-2 px-2 text-right tabular-nums font-black text-emerald-800">
                    {formatNumberWithSpaces(summary?.totalCollected || 0)}
                  </td>
                  <td className="border border-slate-900 py-2 px-2 text-right tabular-nums font-black text-rose-800">
                    {formatNumberWithSpaces(summary?.totalArrears || 0)}
                  </td>
                  <td colSpan={2} className="border border-slate-900 py-2 px-2 bg-slate-50 print:bg-transparent"></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 3. BLOC OBSERVATIONS & CONVERSION EN LETTRES (OHADA / CI) */}
          <div className="mt-6 border border-slate-900 p-4 rounded-lg bg-slate-50/40 print:bg-transparent text-xs space-y-2 leading-relaxed">
            <h4 className="font-black underline uppercase text-slate-900 tracking-wider">
              OBSERVATIONS :
            </h4>

            {/* Total perçu */}
            <p className="font-semibold text-slate-900">
              <span className="font-black mr-1">- TOTAL PERÇU AU MOIS DE {monthLabel.toUpperCase()} {selectedYear} :</span>
              <span className="font-bold underline">
                {formatAmountInFrenchWords(summary?.totalCollected || 0, 'FCFA')}
              </span>
            </p>

            {/* Commission du Cabinet */}
            <p className="font-semibold text-slate-900">
              <span className="font-black mr-1">- COMMISSION DU CABINET :</span>
              <span>{formatNumberWithSpaces(summary?.totalCollected || 0)} F &times; {summary?.commissionRate || commissionRate} % = </span>
              <span className="font-bold underline">
                {formatAmountInFrenchWords(summary?.commissionAmount || 0, 'F CFA')}
              </span>
            </p>

            {/* Montant net à reverser au propriétaire */}
            <p className="font-semibold text-slate-900">
              <span className="font-black mr-1">- MONTANT TOTAL A REVERSER AU PROPRIETAIRE :</span>
              <span>
                {formatNumberWithSpaces(summary?.totalCollected || 0)} F &minus; {formatNumberWithSpaces(summary?.commissionAmount || 0)} F = </span>
              <span className="font-black underline text-slate-950">
                {formatAmountInFrenchWords(summary?.netToPayOwner || 0, 'FRANCS CFA')}
              </span>
            </p>
          </div>

          {/* 4. PIED DE PAGE OFFICIEL (3 COLONNES) */}
          <div className="mt-10 pt-4 grid grid-cols-1 sm:grid-cols-3 gap-6 items-start text-xs border-t border-slate-300 print:border-slate-900">
            {/* Colonne 1 : Signature Propriétaire */}
            <div className="space-y-1">
              <p className="font-black uppercase text-slate-900">
                PROPRIETAIRE :
              </p>
              <p className="font-bold text-slate-800">
                {owner?.name || 'M. LE PROPRIÉTAIRE'}
              </p>
              <div className="pt-12 text-[10px] text-slate-400 italic">
                (Signature &amp; Décharge)
              </div>
            </div>

            {/* Colonne 2 : Date du jour en lettres */}
            <div className="sm:text-center space-y-1">
              <p className="font-black uppercase tracking-wide text-slate-900">
                FAIT A ABIDJAN LE {todayFormattedInWords}
              </p>
            </div>

            {/* Colonne 3 : Cachet officiel Cabinet */}
            <div className="sm:text-right space-y-0.5">
              <p className="font-black uppercase text-slate-900">
                CABINET de Maître DOUHO MAXIME
              </p>
              <p className="text-[10px] text-slate-700 italic">
                Arrêté N° 184/MJDH/DSJRH du 7 Juin 2017
              </p>
              <p className="text-[10px] text-slate-600">
                12 BP 1145 Abidjan 12
              </p>
              <p className="text-[10px] text-slate-600">
                Cel : 07 59 69 70 22 - 05 05 57 09
              </p>
              <p className="text-[10px] text-slate-500 font-mono">
                Email : cabinetmaitredouhom@gmail.com
              </p>
              <div className="pt-8 text-[10px] text-slate-400 italic">
                (Cachet &amp; Signature)
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
