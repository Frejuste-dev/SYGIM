import React, { useState, useMemo } from 'react';
import { usePerformanceDashboard } from '../../../hooks/queries/useReports';
import PerformanceHeaderBar from './PerformanceHeaderBar';
import FinancialKpisRow from './FinancialKpisRow';
import EvolutionComparisonChart from './EvolutionComparisonChart';
import TopCollectorsCard from './TopCollectorsCard';
import PrefinancingPeriodChart from './PrefinancingPeriodChart';
import ComplementaryDetailsSection from './ComplementaryDetailsSection';

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

export default function PerformanceDashboardView() {
  const defaultDates = useMemo(() => getDefaultDates(), []);
  const [granularity, setGranularity] = useState('month');
  const [startDate, setStartDate] = useState(defaultDates.start);
  const [endDate, setEndDate] = useState(defaultDates.end);
  const [isCollectorsModalOpen, setIsCollectorsModalOpen] = useState(false);

  const queryParams = useMemo(() => {
    return {
      granularity,
      startDate,
      endDate,
    };
  }, [granularity, startDate, endDate]);

  const {
    data: dashboardData = {},
    isLoading,
    isFetching,
    refetch,
    error,
  } = usePerformanceDashboard(queryParams);

  const handleReset = () => {
    setGranularity('month');
    setStartDate(defaultDates.start);
    setEndDate(defaultDates.end);
  };

  const {
    period = {},
    financialKpis = {},
    portfolioKpis = {},
    timeSeries = [],
    topCollectors = [],
    prefinancingByPeriod = [],
    complementaryDetails = {},
  } = dashboardData || {};

  return (
    <div className="space-y-6">
      {/* 1. Barre d'en-tête, Granularité & Périodes */}
      <PerformanceHeaderBar
        granularity={granularity}
        setGranularity={setGranularity}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        periodMeta={period}
        onRefresh={() => refetch()}
        onReset={handleReset}
        isLoading={isFetching}
      />

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className="fas fa-triangle-exclamation text-rose-500"></i>
            <span>Impossible de charger certaines métriques comparatives : {error.message || 'Erreur réseau'}</span>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="px-2.5 py-1 bg-white border border-rose-200 text-rose-700 font-semibold rounded-md hover:bg-rose-100"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* 2. Ligne des KPIs Financiers et Portefeuille */}
      <FinancialKpisRow
        financialKpis={financialKpis}
        portfolioKpis={portfolioKpis}
      />

      {/* 3. Section Centrale : Courbe Évolution N vs N-1 & TOP 5 Agents */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-8">
          <EvolutionComparisonChart timeSeries={timeSeries} />
        </div>
        <div className="lg:col-span-4">
          <TopCollectorsCard
            topCollectors={topCollectors}
            onViewAllCollectors={() => setIsCollectorsModalOpen(true)}
          />
        </div>
      </div>

      {/* 4. Section Préfinancements par Période (S1..S5) */}
      <PrefinancingPeriodChart
        prefinancingData={prefinancingByPeriod}
        summary={financialKpis.prefinancing}
      />

      {/* 5. Détails Complémentaires, Répartition par Canaux & Modal Exhaustif Agents */}
      <ComplementaryDetailsSection
        details={complementaryDetails}
        isCollectorsModalOpen={isCollectorsModalOpen}
        setIsCollectorsModalOpen={setIsCollectorsModalOpen}
      />
    </div>
  );
}
