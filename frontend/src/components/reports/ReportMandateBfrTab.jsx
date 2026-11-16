import React from 'react';
import { useMandateBfr } from '../../hooks/queries/useReports';
import TableSkeleton from '../ui/TableSkeleton';
import { formatXOF } from '../../utils/formatters';

export default function ReportMandateBfrTab() {
  const { data: bfrData = {}, isLoading } = useMandateBfr();

  const summary = bfrData?.summary || {};
  const breakdown = bfrData?.breakdown || {};
  const needs = breakdown?.needs || {};
  const resources = breakdown?.resources || {};

  const riskLevel = summary.riskLevel || 'OPTIMAL';

  return (
    <div className="space-y-6">
      {/* 1. BANNIÈRE PRINCIPALE DU BFR MANDAT */}
      <div className={`p-6 rounded-2xl border shadow-sm transition-all ${
        riskLevel === 'OPTIMAL'
          ? 'bg-emerald-50/50 border-emerald-200'
          : riskLevel === 'MODERATE'
            ? 'bg-amber-50/50 border-amber-200'
            : 'bg-rose-50/50 border-rose-200'
      }`}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                riskLevel === 'OPTIMAL'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : riskLevel === 'MODERATE'
                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                    : 'bg-rose-100 text-rose-800 border-rose-300'
              }`}>
                <i className={`fas ${
                  riskLevel === 'OPTIMAL' ? 'fa-check-circle' : riskLevel === 'MODERATE' ? 'fa-exclamation-circle' : 'fa-exclamation-triangle'
                }`}></i>
                Équilibre Mandat : {riskLevel === 'OPTIMAL' ? 'OPTIMAL' : riskLevel === 'MODERATE' ? 'SOUS VIGILANCE' : 'EN TENSION'}
              </span>
              <span className="text-xs text-slate-500 font-medium">Besoin en Fonds de Roulement</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900">
              Analyse du BFR &amp; Équilibre Financier du Compte Mandat
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl">
              {summary.riskMessage || 'Surveillance du décalage de trésorerie entre les avances consenties aux propriétaires et les encaissements locataires.'}
            </p>
          </div>

          <div className="flex flex-row md:flex-col items-end gap-3 self-stretch md:self-auto bg-white/80 p-4 rounded-xl border border-slate-200/80">
            <div className="text-right">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                BFR Net Mandat
              </span>
              <span className={`text-xl sm:text-2xl font-black tabular-nums ${
                (summary.netBfr || 0) <= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}>
                {formatXOF(summary.netBfr || 0, { compact: false })}
              </span>
            </div>
            <div className="text-right border-l md:border-l-0 md:border-t border-slate-200 pl-3 md:pl-0 md:pt-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                Taux de Couverture
              </span>
              <span className="text-base font-extrabold text-slate-800 tabular-nums">
                {summary.coverageRatio || 0} %
              </span>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4 animate-pulse">
            <div className="h-6 bg-slate-200 rounded w-1/2"></div>
            <div className="space-y-3">
              <div className="h-14 bg-slate-100 rounded-xl"></div>
              <div className="h-14 bg-slate-100 rounded-xl"></div>
              <div className="h-14 bg-slate-100 rounded-xl"></div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4 animate-pulse">
            <div className="h-6 bg-slate-200 rounded w-1/2"></div>
            <div className="space-y-3">
              <div className="h-14 bg-slate-100 rounded-xl"></div>
              <div className="h-14 bg-slate-100 rounded-xl"></div>
              <div className="h-14 bg-slate-100 rounded-xl"></div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* 2. CONFRONTATION EMPLOIS (BESOINS) VS RESSOURCES */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* COLONNE GAUCHE : EMPLOIS / BESOINS DE FINANCEMENT */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-rose-100 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-sm">
                    <i className="fas fa-arrow-down"></i>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Emplois &amp; Besoins de Financement</h3>
                    <p className="text-[11px] text-slate-500">Créances à recouvrer et avances engagées</p>
                  </div>
                </div>
                <span className="text-lg font-black text-rose-700 tabular-nums">
                  {formatXOF(needs.total || 0, { compact: false })}
                </span>
              </div>

              <div className="space-y-3">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-800 text-xs">Créances Locataires Échues</div>
                    <div className="text-[11px] text-slate-500">Arriérés de loyers échus en attente de paiement</div>
                  </div>
                  <div className="text-right">
                    <span className="font-extrabold text-slate-900 text-sm tabular-nums block">
                      {formatXOF(needs.activeOverdueReceivables || 0, { compact: false })}
                    </span>
                    <span className="text-[10px] text-rose-600 font-semibold">Exposition directe</span>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-800 text-xs">Avances de Préfinancement Actives</div>
                    <div className="text-[11px] text-slate-500">Fonds déjà versés aux bailleurs sur loyers non perçus</div>
                  </div>
                  <div className="text-right">
                    <span className="font-extrabold text-amber-700 text-sm tabular-nums block">
                      {formatXOF(needs.activePrefinancingAdvances || 0, { compact: false })}
                    </span>
                    <span className="text-[10px] text-amber-700 font-semibold">Trésorerie immobilisée</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-100 text-xs text-rose-800 flex items-center gap-2">
                <i className="fas fa-info-circle text-rose-600 shrink-0"></i>
                <span>
                  Chaque franc d'avance consenti augmente le BFR tant que le locataire n'a pas réglé son loyer.
                </span>
              </div>
            </div>

            {/* COLONNE DROITE : RESSOURCES / DISPONIBILITÉS MANDAT */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-emerald-100 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
                    <i className="fas fa-arrow-up"></i>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Ressources &amp; Dépôts Disponibles</h3>
                    <p className="text-[11px] text-slate-500">Séquestres, reversements et encaissements</p>
                  </div>
                </div>
                <span className="text-lg font-black text-emerald-700 tabular-nums">
                  {formatXOF(resources.total || 0, { compact: false })}
                </span>
              </div>

              <div className="space-y-3">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-800 text-xs">Cautions &amp; Dépôts de Garantie Séquestrés</div>
                    <div className="text-[11px] text-slate-500">Cautions locataires garantissant le parc</div>
                  </div>
                  <div className="text-right">
                    <span className="font-extrabold text-slate-900 text-sm tabular-nums block">
                      {formatXOF(resources.totalDepositsHeld || 0, { compact: false })}
                    </span>
                    <span className="text-[10px] text-sky-600 font-semibold">Garanties en compte</span>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-800 text-xs">Encaissements du Mois en Cours</div>
                    <div className="text-[11px] text-slate-500">Loyers validés encaissés depuis le 1er du mois</div>
                  </div>
                  <div className="text-right">
                    <span className="font-extrabold text-emerald-700 text-sm tabular-nums block">
                      {formatXOF(resources.currentMonthCollections || 0, { compact: false })}
                    </span>
                    <span className="text-[10px] text-emerald-600 font-semibold">Flux frais</span>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-800 text-xs">Reversements Bailleurs en Attente</div>
                    <div className="text-[11px] text-slate-500">Fonds calculés en instance de virement bancaire</div>
                  </div>
                  <div className="text-right">
                    <span className="font-extrabold text-slate-700 text-sm tabular-nums block">
                      {formatXOF(resources.pendingOwnerSettlements || 0, { compact: false })}
                    </span>
                    <span className="text-[10px] text-slate-500 font-semibold">Dettes mandants</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 text-xs text-emerald-800 flex items-center gap-2">
                <i className="fas fa-shield-alt text-emerald-600 shrink-0"></i>
                <span>
                  Les fonds mandats séquestrés garantissent la solvabilité immédiate de l'agence.
                </span>
              </div>
            </div>
          </div>

          {/* 3. RECOMMANDATIONS OPÉRATIONNELLES DE TRÉSORERIE */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <i className="fas fa-lightbulb text-amber-500"></i>
              Recommandations &amp; Actions Prioritaires
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="font-bold text-slate-800 mb-1">1. Accélérer le Recouvrement Terrain</div>
                <p className="text-slate-600">
                  Prioriser les visites des collecteurs sur les créances de la tranche 0-30j pour éviter le glissement vers le pré-contentieux.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="font-bold text-slate-800 mb-1">2. Apurer les Préfinancements Échus</div>
                <p className="text-slate-600">
                  Imputer immédiatement les encaissements locataires reçus sur les dossiers préfinancés pour libérer le fonds de roulement.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="font-bold text-slate-800 mb-1">3. Maîtriser le Plafond d'Avances</div>
                <p className="text-slate-600">
                  Ne préfinancer que les propriétaires dont les locataires ont un historique d'apurement inférieur à 60 jours.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
