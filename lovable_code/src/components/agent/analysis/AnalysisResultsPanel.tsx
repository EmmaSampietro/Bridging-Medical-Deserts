import { AnalysisOutput } from '@/types/analysis';
import { ExecutiveSummaryCard } from './ExecutiveSummaryCard';
import { RankingTableCard } from './RankingTableCard';
import { AnalyticalChartCard } from './AnalyticalChartCard';
import { RegionMapCard } from './RegionMapCard';

interface AnalysisResultsPanelProps {
  analysis: AnalysisOutput;
}

export function AnalysisResultsPanel({ analysis }: AnalysisResultsPanelProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
      {/* Map - Top Left */}
      {analysis.mapData && (
        <RegionMapCard data={analysis.mapData} />
      )}
      
      {/* Ranking Table - Top Right */}
      {analysis.rankingTable && (
        <RankingTableCard data={analysis.rankingTable} />
      )}
      
      {/* Analytical Chart - Bottom Left */}
      {analysis.chart && (
        <AnalyticalChartCard data={analysis.chart} />
      )}
      
      {/* Executive Summary - Bottom Right */}
      {analysis.executiveSummary && (
        <ExecutiveSummaryCard data={analysis.executiveSummary} />
      )}
    </div>
  );
}
