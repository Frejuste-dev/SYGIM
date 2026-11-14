import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { formatAmount } from '../../../utils/formatters';

function CustomChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;

  const dataPoint = payload[0]?.payload || {};
  const currentColl = dataPoint.currentCollections || 0;
  const prevColl = dataPoint.prevCollections || 0;
  const currentRev = dataPoint.currentRevenue || 0;
  const diffColl = currentColl - prevColl;
  const evolColl = prevColl > 0 ? ((diffColl / prevColl) * 100).toFixed(1) : (currentColl > 0 ? '+100' : '0');

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-lg text-xs space-y-2 min-w-[220px]">
      <div className="font-bold text-slate-800 pb-1.5 border-b border-slate-100 flex items-center justify-between">
        <span>{dataPoint.fullLabel || label}</span>
        {dataPoint.currentOperations > 0 && (
          <span className="text-[11px] text-slate-400 font-normal">
            {dataPoint.currentOperations} op.
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span>
            <span className="text-slate-600">Recouvrements N :</span>
          </div>
          <span className="font-bold text-slate-900 tabular-nums">
            {formatAmount(currentColl)} FCFA
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 border-t-2 border-dashed border-slate-400"></span>
            <span className="text-slate-500">Recouvrements N-1 :</span>
          </div>
          <span className="font-medium text-slate-600 tabular-nums">
            {formatAmount(prevColl)} FCFA
          </span>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-slate-100">
          <span className="text-slate-500">Évolution N / N-1 :</span>
          <span
            className={`font-semibold tabular-nums ${
              diffColl >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {diffColl >= 0 ? '+' : ''}
            {formatAmount(diffColl)} FCFA ({diffColl >= 0 ? '+' : ''}{evolColl}%)
          </span>
        </div>

        {currentRev > 0 && (
          <div className="flex items-center justify-between pt-1 border-t border-slate-100">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
              <span className="text-slate-600">CA (Commission) :</span>
            </div>
            <span className="font-bold text-blue-700 tabular-nums">
              {formatAmount(currentRev)} FCFA
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function EvolutionComparisonChart({ timeSeries = [] }) {
  const [showCurrent, setShowCurrent] = useState(true);
  const [showPrevious, setShowPrevious] = useState(true);
  const [showRevenue, setShowRevenue] = useState(true);

  const formatYAxis = (val) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)} M`;
    if (val >= 1000) return `${(val / 1000).toFixed(0)} k`;
    return val;
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs p-5">
      {/* En-tête de section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 border-b border-dashed border-slate-300 pb-0.5 inline-block">
            2. Évolution du chiffre d'affaires et des recouvrements
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Comparaison chronologique des encaissements de la période courante (N) vs période précédente (N-1).
          </p>
        </div>

        {/* Filtres interactifs des séries */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowCurrent(!showCurrent)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 ${
              showCurrent
                ? 'bg-sky-50 text-sky-700 border-sky-300'
                : 'bg-white text-slate-400 border-slate-200 opacity-60'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-sky-500"></span>
            <span>Recouvrements N</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPrevious(!showPrevious)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 ${
              showPrevious
                ? 'bg-slate-100 text-slate-700 border-slate-300'
                : 'bg-white text-slate-400 border-slate-200 opacity-60'
            }`}
          >
            <span className="w-2.5 h-0.5 border-t-2 border-dashed border-slate-500"></span>
            <span>Comparatif N-1</span>
          </button>

          <button
            type="button"
            onClick={() => setShowRevenue(!showRevenue)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 ${
              showRevenue
                ? 'bg-blue-50 text-blue-700 border-blue-300'
                : 'bg-white text-slate-400 border-slate-200 opacity-60'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            <span>CA Commission N</span>
          </button>
        </div>
      </div>

      {/* Graphique Recharts */}
      <div className="mt-4 w-full h-72 sm:h-80">
        {timeSeries.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
            <i className="fas fa-chart-line text-2xl"></i>
            <span>Aucune donnée temporelle sur cette période</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timeSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradCurrentCollections" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="gradCurrentRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="label"
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatYAxis}
              />
              <Tooltip content={<CustomChartTooltip />} />

              {/* Période N-1 en trait pointillé */}
              {showPrevious && (
                <Line
                  type="monotone"
                  dataKey="prevCollections"
                  name="Recouvrements N-1"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 3, fill: '#94a3b8' }}
                  isAnimationActive={true}
                />
              )}

              {/* Période N Recouvrements avec gradient subtil */}
              {showCurrent && (
                <Area
                  type="monotone"
                  dataKey="currentCollections"
                  name="Recouvrements N"
                  stroke="#0ea5e9"
                  strokeWidth={2.5}
                  fill="url(#gradCurrentCollections)"
                  dot={{ r: 4, fill: '#0ea5e9', strokeWidth: 1.5, stroke: '#ffffff' }}
                  isAnimationActive={true}
                />
              )}

              {/* Chiffre d'affaires N */}
              {showRevenue && (
                <Line
                  type="monotone"
                  dataKey="currentRevenue"
                  name="CA Commission N"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#2563eb' }}
                  isAnimationActive={true}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
