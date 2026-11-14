import React from 'react';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';
import { formatAmount } from '../../../utils/formatters';

function EvolutionBadge({ value }) {
  if (value === null || value === undefined) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
        — 0%
      </span>
    );
  }
  const isPositive = Number(value) > 0;
  const isZero = Number(value) === 0;

  if (isZero) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
        — 0%
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${
        isPositive
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : 'bg-rose-50 text-rose-700 border-rose-200'
      }`}
    >
      <i className={`fas ${isPositive ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'}`}></i>
      <span>
        {isPositive ? '+' : ''}
        {Number(value).toFixed(1)}%
      </span>
    </span>
  );
}

function MiniSparkline({ data = [], color = '#0ea5e9' }) {
  if (!data || data.length === 0) return null;
  const chartData = data.map((val, idx) => ({ idx, val: Number(val) || 0 }));

  return (
    <div className="w-20 h-9 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <defs>
            <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="val"
            stroke={color}
            strokeWidth={1.8}
            fill={`url(#spark-${color.replace('#', '')})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function FinancialKpisRow({ financialKpis = {} }) {
  const { revenue = {}, collections = {}, prefinancing = {}, target = {} } = financialKpis;

  const targetAchieved = Number(target.achievedRate || 0);
  const isTargetOver = targetAchieved >= 100;

  return (
    <div className="space-y-4">
      {/* 4 GRANDES CARTES FINANCIÈRES (Shopify Analytics Light Mode) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CARTE 1 : CHIFFRE D'AFFAIRES */}
        <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs p-5 hover:border-slate-300 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-800 border-b border-dashed border-slate-300 pb-0.5 cursor-help" title="Commission agence perçue sur les encaissements locataires">
                Chiffre d'affaires
              </span>
              <EvolutionBadge value={revenue.evolution} />
            </div>

            <div className="mt-3 flex items-baseline justify-between gap-2">
              <div className="text-2xl font-bold text-slate-900 tabular-nums tracking-tight">
                {formatAmount(revenue.current || 0)}{' '}
                <span className="text-xs font-semibold text-slate-500">FCFA</span>
              </div>
              <MiniSparkline data={revenue.sparkline} color="#0284c7" />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Période N-1</span>
            <span className="font-medium text-slate-700 tabular-nums">
              {formatAmount(revenue.previous || 0)} FCFA
            </span>
          </div>
        </div>

        {/* CARTE 2 : RECOUVREMENTS */}
        <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs p-5 hover:border-slate-300 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-800 border-b border-dashed border-slate-300 pb-0.5 cursor-help" title="Total des loyers encaissés par les agents et en agence">
                Recouvrements
              </span>
              <EvolutionBadge value={collections.evolution} />
            </div>

            <div className="mt-3 flex items-baseline justify-between gap-2">
              <div className="text-2xl font-bold text-slate-900 tabular-nums tracking-tight">
                {formatAmount(collections.current || 0)}{' '}
                <span className="text-xs font-semibold text-slate-500">FCFA</span>
              </div>
              <MiniSparkline data={collections.sparkline} color="#0ea5e9" />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Période N-1</span>
            <span className="font-medium text-slate-700 tabular-nums">
              {formatAmount(collections.previous || 0)} FCFA
            </span>
          </div>
        </div>

        {/* CARTE 3 : PRÉFINANCEMENTS */}
        <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs p-5 hover:border-slate-300 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-800 border-b border-dashed border-slate-300 pb-0.5 cursor-help" title="Avances de trésorerie accordées aux propriétaires bailleurs">
                Préfinancements
              </span>
              <EvolutionBadge value={prefinancing.evolution} />
            </div>

            <div className="mt-3 flex items-baseline justify-between gap-2">
              <div className="text-2xl font-bold text-slate-900 tabular-nums tracking-tight">
                {formatAmount(prefinancing.current || 0)}{' '}
                <span className="text-xs font-semibold text-slate-500">FCFA</span>
              </div>
              <MiniSparkline data={prefinancing.sparkline} color="#8b5cf6" />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              {prefinancing.count || 0} dossier{(prefinancing.count || 0) > 1 ? 's' : ''} • N-1
            </span>
            <span className="font-medium text-slate-700 tabular-nums">
              {formatAmount(prefinancing.previous || 0)} FCFA
            </span>
          </div>
        </div>

        {/* CARTE 4 : OBJECTIF ATTEINT */}
        <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs p-5 hover:border-slate-300 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-800 border-b border-dashed border-slate-300 pb-0.5 cursor-help" title="Pourcentage du montant prévisionnel encaissé">
                Objectif de recouvrement
              </span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                  isTargetOver
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                {isTargetOver ? 'Dépassé' : 'En cours'}
              </span>
            </div>

            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 tabular-nums">
                  {targetAchieved.toFixed(1)}%
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {isTargetOver
                    ? `+${formatAmount(Math.abs(target.diffAmount || 0))} FCFA`
                    : `Reste ${formatAmount(Math.abs(target.diffAmount || 0))} FCFA`}
                </span>
              </div>

              {/* Jauge linéaire */}
              <div className="w-full bg-slate-100 rounded-full h-2 mt-2.5 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${
                    isTargetOver ? 'bg-emerald-500' : 'bg-primary'
                  }`}
                  style={{ width: `${Math.min(targetAchieved, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Cible période</span>
            <span className="font-medium text-slate-700 tabular-nums">
              {formatAmount(target.targetAmount || 0)} FCFA
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
