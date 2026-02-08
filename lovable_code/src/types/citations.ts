// Citation and evidence tracking types for agentic transparency

export interface DataCitation {
  id: string;
  sourceType: 'hospital' | 'region' | 'theme' | 'computed';
  sourceName: string;
  field: string;
  value: string | number;
  timestamp: Date;
}

export interface ReasoningStep {
  id: string;
  step: number;
  action: string;
  description: string;
  inputData: DataCitation[];
  outputData: string;
  duration?: number;
}

export interface EvidenceTrace {
  id: string;
  query: string;
  totalSteps: number;
  steps: ReasoningStep[];
  finalConclusion: string;
  confidence: number;
  dataPointsUsed: number;
  createdAt: Date;
}

export interface AnomalyFlag {
  id: string;
  hospitalId: string;
  hospitalName: string;
  field: string;
  issue: 'missing_data' | 'suspicious_value' | 'inconsistent' | 'unverified' | 'incomplete';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  expectedRange?: { min: number; max: number };
  actualValue?: string | number;
  suggestedAction: string;
}

export interface DataQualityScore {
  hospitalId: string;
  hospitalName: string;
  overallQuality: number; // 0-100
  completeness: number; // % of fields filled
  consistency: number; // % of fields with logical values
  verification: number; // % of fields with evidence
  anomalyCount: number;
  anomalies: AnomalyFlag[];
}

export interface RoutingRequest {
  medicalNeed: string;
  urgency: 'routine' | 'urgent' | 'emergency';
  preferredRegion?: string;
  requiredCapabilities?: string[];
  maxDistanceKm?: number;
}

export interface RoutingResult {
  recommendedFacility: {
    id: string;
    name: string;
    region: string;
    matchScore: number;
    capabilities: string[];
    estimatedWaitTime?: string;
    reasoning: string;
  };
  alternatives: Array<{
    id: string;
    name: string;
    region: string;
    matchScore: number;
    tradeoff: string;
  }>;
  warnings: string[];
  citations: DataCitation[];
}
