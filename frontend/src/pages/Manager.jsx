import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LabelList,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { useManagerDashboard } from '../hooks/queries/useManagerDashboard';
import { formatDate } from '../utils/formatters';

const GRANULARITIES = [
  { id: 'day', label: 'Jour' },
  { id: 'month', label: 'Mois' },
  { id: 'quarter', label: 'Trimestre' },
  { id: 'year', label: 'Année' },
  { id: 'custom', label: 'Personnalisé' },
];

function getDefaultDates() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
  return {
    start: `${year}-${month}-01`,
    end: `${year}-${month}-${String(lastDay).padStart(2, '0')}`,
  };
}

function TrendBadge({ evolution = 0, trend = 'stable', suffix = '%' }) {
  const num = Number(evolution) || 0;
  const isUp = trend === 'up' || num > 0;
  const isDown = trend === 'down' || num < 0;

  if (num === 0 || (!isUp && !isDown)) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
        — 0%
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${
        isUp
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : 'bg-rose-50 text-rose-700 border-rose-200'
      }`}
    >
      <i className={`fas ${isUp ? 'fa-arrow-up' : 'fa-arrow-down'} text-[10px]`}></i>
      <span>
        {isUp ? '+' : ''}
        {num.toFixed(1)}
        {suffix}
      </span>
    </span>
  );
}

function CustomChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const dataPoint = payload[0]?.payload || {};

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-lg text-xs space-y-1 min-w-[180px]">
      <div className="font-bold text-slate-800 pb-1 border-b border-slate-100">
        {dataPoint.fullLabel || label}
      </div>
      <div className="flex items-center justify-between gap-3 pt-0.5">
        <span className="text-slate-600">Biens enregistrés :</span>
        <span className="font-bold text-sky-600 tabular-nums">
          {dataPoint.count || 0} bien{(dataPoint.count || 0) > 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}

export default function Manager() {
  const defaultDates = useMemo(() => getDefaultDates(), []);

  const [granularity, setGranularity] = useState('month');
  const [startDate, setStartDate] = useState(defaultDates.start);
  const [endDate, setEndDate] = useState(defaultDates.end);
  const [chartView, setChartView] = useState('month'); // 'month' | 'year'

  const queryParams = useMemo(() => {
    return { granularity, startDate, endDate };
  }, [granularity, startDate, endDate]);

  const { data: dashboard = {}, isLoading, isFetching, refetch } = useManagerDashboard(queryParams);

  const handleReset = () => {
    setGranularity('month');
    setStartDate(defaultDates.start);
    setEndDate(defaultDates.end);
  };

  const {
    period = {},
    registeredProperties = {},
    assignedProperties = {},
    collectionRate = {},
    registeredOwners = {},
    propertiesByMonth = [],
    propertiesByYear = [],
    chartYear,
  } = dashboard;

  const histogramData = chartView === 'year' ? propertiesByYear : propertiesByMonth;
  const histogramTotal = histogramData.reduce((acc, p) => acc + (p.count || 0), 0);

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden box-border">
      {/* 1. ZONE DE FILTRAGE SUPÉRIEURE (Shopify Style) */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                TABLEAU DE BORD – MANAGER
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Suivi du Parc & Attributions
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Supervision de l'enregistrement des biens, des mandats bailleurs et du recouvrement effectif.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-2xs disabled:opacity-60"
            >
              <i className={`fas fa-rotate ${isFetching ? 'fa-spin text-primary' : 'text-slate-400'}`}></i>
              <span>Actualiser</span>
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <i className="fas fa-undo text-slate-400"></i>
              <span>Mois en cours</span>
            </button>
          </div>
        </div>

        {/* Barre de contrôle : Granularité et Périodes */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl self-start overflow-x-auto max-w-full">
            {GRANULARITIES.map((g) => {
              const isActive = granularity === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGranularity(g.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  {g.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1 shadow-2xs">
              <span className="text-xs text-slate-400 font-medium">Du :</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setGranularity('custom');
                }}
                className="text-xs text-slate-700 font-medium focus:outline-none bg-transparent cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1 shadow-2xs">
              <span className="text-xs text-slate-400 font-medium">Au :</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setGranularity('custom');
                }}
                className="text-xs text-slate-700 font-medium focus:outline-none bg-transparent cursor-pointer"
              />
            </div>
          </div>
        </div>

        {period?.prevStartDate && (
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 bg-slate-50/80 px-3 py-1.5 rounded-lg border border-slate-200/60 w-fit">
            <i className="fas fa-clock-rotate-left text-slate-400"></i>
            <span>
              Comparatif N-1 :{' '}
              <strong className="text-slate-700 font-medium">
                {formatDate(period.prevStartDate, { day: 'numeric', month: 'short', year: 'numeric' })}
              </strong>{' '}
              au{' '}
              <strong className="text-slate-700 font-medium">
                {formatDate(period.prevEndDate, { day: 'numeric', month: 'short', year: 'numeric' })}
              </strong>{' '}
              ({period.durationDays} jours)
            </span>
          </div>
        )}
      </div>

      {/* 2. UNIQUEMENT LES 4 CARTES KPI EN HAUT (Maquette 1 / Média 5.jpg) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 : Biens enregistrés */}
        <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs p-5 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-sm font-semibold text-slate-800 border-b border-dashed border-slate-300 pb-0.5">
                Biens enregistrés
              </span>
              <div className="mt-3 text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
                {registeredProperties.total || 0}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 border border-sky-100">
              <i className="fas fa-building text-base"></i>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">
              +{registeredProperties.newInPeriod || 0} sur la période
            </span>
            <TrendBadge
              evolution={registeredProperties.evolution}
              trend={registeredProperties.trend}
            />
          </div>
        </div>

        {/* KPI 2 : Biens attribués */}
        <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs p-5 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-sm font-semibold text-slate-800 border-b border-dashed border-slate-300 pb-0.5">
                Biens attribués
              </span>
              <div className="mt-3 text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
                {assignedProperties.total || 0}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
              <i className="fas fa-key text-base"></i>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">
              {assignedProperties.occupancyRate || 0}% attribués
            </span>
            <TrendBadge
              evolution={assignedProperties.evolution}
              trend={assignedProperties.trend}
            />
          </div>
        </div>

        {/* KPI 3 : Taux de recouvrement */}
        <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs p-5 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-sm font-semibold text-slate-800 border-b border-dashed border-slate-300 pb-0.5">
                Taux de recouvrement
              </span>
              <div className="mt-3 text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
                {Number(collectionRate.rate || 0).toFixed(1)}%
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
              <i className="fas fa-percent text-base"></i>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">
              Cible : {collectionRate.target || 95}%
            </span>
            <TrendBadge
              evolution={collectionRate.evolution}
              trend={collectionRate.trend}
              suffix=" pts"
            />
          </div>
        </div>

        {/* KPI 4 : Propriétaires enregistrés */}
        <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs p-5 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-sm font-semibold text-slate-800 border-b border-dashed border-slate-300 pb-0.5">
                Propriétaires enregistrés
              </span>
              <div className="mt-3 text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
                {registeredOwners.total || 0}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
              <i className="fas fa-user-tie text-base"></i>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">
              +{registeredOwners.newInPeriod || 0} sur la période
            </span>
            <TrendBadge
              evolution={registeredOwners.evolution}
              trend={registeredOwners.trend}
            />
          </div>
        </div>
      </div>

      {/* 3. HISTOGRAMME : NOMBRE DE BIENS ENREGISTRÉS PAR MOIS OU PAR ANNÉE */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 border-b border-dashed border-slate-300 pb-0.5 inline-block">
              Nombre de biens enregistrés {chartView === 'year' ? 'par année' : `par mois (${chartYear || new Date().getFullYear()})`}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Répartition des nouveaux biens immobiliers intégrés dans le portefeuille.
            </p>
          </div>
          <div className="flex items-center gap-3 self-start sm:self-auto">
            <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200/70">
              <button
                type="button"
                onClick={() => setChartView('month')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  chartView === 'month'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Par mois
              </button>
              <button
                type="button"
                onClick={() => setChartView('year')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  chartView === 'year'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Par année
              </button>
            </div>
            <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1.5 rounded-lg tabular-nums">
              {histogramTotal} bien{histogramTotal > 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <div className="mt-4 w-full h-72 sm:h-80">
          {histogramData.length === 0 ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
              <i className="fas fa-chart-column text-2xl"></i>
              <span>Aucun enregistrement sur cette plage</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogramData} margin={{ top: 24, right: 12, left: -10, bottom: 4 }}>
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
                  allowDecimals={false}
                />
                <Tooltip content={<CustomChartTooltip />} cursor={{ fill: '#f8fafc' }} />
                <Bar
                  dataKey="count"
                  name="Biens enregistrés"
                  fill="#0284c7"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={48}
                >
                  <LabelList
                    dataKey="count"
                    position="top"
                    fill="#334155"
                    fontSize={11}
                    fontWeight={700}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
