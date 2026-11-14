import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { formatAmount } from '../../../utils/formatters';

function CustomBarTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;

  const dataPoint = payload[0]?.payload || {};
  const currentAmt = dataPoint.currentAmount || 0;
  const prevAmt = dataPoint.prevAmount || 0;
  const currentCount = dataPoint.currentCount || 0;
  const prevCount = dataPoint.prevCount || 0;
  const diff = currentAmt - prevAmt;
  const evol = prevAmt > 0 ? ((diff / prevAmt) * 100).toFixed(1) : (currentAmt > 0 ? '+100' : '0');

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-lg text-xs space-y-2 min-w-[200px]">
      <div className="font-bold text-slate-800 pb-1 border-b border-slate-100">
        Préfinancement : {label}
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-indigo-600"></span>
            <span className="text-slate-600">Période N :</span>
          </div>
          <span className="font-bold text-slate-900 tabular-nums">
            {formatAmount(currentAmt)} FCFA ({currentCount} dossier{currentCount > 1 ? 's' : ''})
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-slate-300"></span>
            <span className="text-slate-500">Période N-1 :</span>
          </div>
          <span className="font-medium text-slate-600 tabular-nums">
            {formatAmount(prevAmt)} FCFA ({prevCount} dos.)
          </span>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-slate-100">
          <span className="text-slate-500">Différence :</span>
          <span
            className={`font-semibold tabular-nums ${
              diff >= 0 ? 'text-indigo-600' : 'text-slate-600'
            }`}
          >
            {diff >= 0 ? '+' : ''}
            {formatAmount(diff)} FCFA ({diff >= 0 ? '+' : ''}{evol}%)
          </span>
        </div>
      </div>
    </div>
  );
}

export default function PrefinancingPeriodChart({
  prefinancingData = [],
  summary = {},
}) {
  const totalAmount = prefinancingData.reduce((acc, p) => acc + (p.currentAmount || 0), 0);
  const totalCount = prefinancingData.reduce((acc, p) => acc + (p.currentCount || 0), 0);
  const prevTotalAmount = prefinancingData.reduce((acc, p) => acc + (p.prevAmount || 0), 0);

  const formatYAxis = (val) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)} M`;
    if (val >= 1000) return `${(val / 1000).toFixed(0)} k`;
    return val;
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs p-5">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 border-b border-dashed border-slate-300 pb-0.5 inline-block">
            4. Préfinancements par période
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Volume des avances de trésorerie octroyées aux propriétaires par sous-période.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-indigo-600"></span>
            <span className="text-slate-600 font-medium">Période N</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-slate-300"></span>
            <span className="text-slate-500">Période N-1</span>
          </div>
        </div>
      </div>

      {/* Graphique BarChart */}
      <div className="mt-4 w-full h-56 sm:h-64">
        {prefinancingData.length === 0 || (totalAmount === 0 && prevTotalAmount === 0) ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
            <i className="fas fa-hand-holding-dollar text-2xl"></i>
            <span>Aucune avance de préfinancement sur cette période</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={prefinancingData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
              <Tooltip content={<CustomBarTooltip />} />
              <Bar
                dataKey="prevAmount"
                name="Période N-1"
                fill="#cbd5e1"
                radius={[4, 4, 0, 0]}
                barSize={18}
                isAnimationActive={true}
              />
              <Bar
                dataKey="currentAmount"
                name="Période N"
                fill="#6366f1"
                radius={[4, 4, 0, 0]}
                barSize={18}
                isAnimationActive={true}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Bandeau récapitulatif */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-slate-500">Total préfinancé N :</span>{' '}
            <strong className="text-slate-900 font-bold tabular-nums">
              {formatAmount(totalAmount)} FCFA
            </strong>
          </div>
          <div>
            <span className="text-slate-500">Dossiers :</span>{' '}
            <strong className="text-slate-700 font-semibold">{totalCount}</strong>
          </div>
        </div>
        <div className="text-slate-500">
          N-1 :{' '}
          <span className="tabular-nums font-medium text-slate-700">
            {formatAmount(prevTotalAmount)} FCFA
          </span>
        </div>
      </div>
    </div>
  );
}
