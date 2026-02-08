// Structured analysis output from AI agent

export interface AnalysisOutput {
  executiveSummary: ExecutiveSummary;
  mapData?: MapVisualization;
  rankingTable?: RankingTable;
  chart?: ChartVisualization;
}

export interface ExecutiveSummary {
  title: string;
  keyFindings: string[];
  recommendation: string;
  investmentImpact?: string;
  populationReach?: number;
  priorityRegions?: string[];
}

export interface MapVisualization {
  title: string;
  regions: RegionMapData[];
  legend?: { label: string; color: string }[];
}

export interface RegionMapData {
  name: string;
  value: number;
  color: string;
  highlight: boolean;
  tooltip?: string;
}

export interface RankingTable {
  title: string;
  columns: { key: string; label: string; format?: 'number' | 'percent' | 'score' | 'currency' }[];
  rows: Record<string, any>[];
  highlightTop?: number;
}

export interface ChartVisualization {
  title: string;
  type: 'bar' | 'line' | 'pie' | 'scatter' | 'radar';
  data: ChartDataPoint[];
  xAxisLabel?: string;
  yAxisLabel?: string;
}

export interface ChartDataPoint {
  name: string;
  value: number;
  category?: string;
  color?: string;
}
