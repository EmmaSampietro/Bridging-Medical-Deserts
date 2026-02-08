// Hospital data from hospitals.csv
export interface Hospital {
  id: string;
  name: string;
  inAgentOutput: boolean;
  inCategories: boolean;
  address: string;
  country: string;
  organizationType: string;
  facilityType?: string;
  operatorType?: string;
  affiliation?: string;
  
  // Scores (1-10)
  medicalProceduresScore: number;
  medicalProceduresExplanation: string;
  medicalEquipmentScore: number;
  medicalEquipmentExplanation: string;
  staffScore: number;
  staffExplanation: string;
  infrastructureScore: number;
  infrastructureExplanation: string;
  accreditationScore: number;
  accreditationExplanation: string;
  patientExperienceScore: number;
  patientExperienceExplanation: string;
  
  // Additional category data
  numberDoctors?: number;
  numberBeds?: number;
  onSiteServices?: string;
  
  overallConfidenceSummary: string;
  keyUncertainties: string[];
  
  // Derived
  region: string;
  averageScore: number;
}

// Region data from ghana_data_comprehensive.csv
export interface Region {
  name: string;
  canonicalName: string;
  population2021?: number;
  areaKm2?: number;
  populationDensity?: number;
  populationPercentage?: number;
  
  // Health indicators
  healthInsuranceNonePct: number;
  anemiaWomenAnyPct: number;
  anemiaWomenSeverePct: number;
  childDiarrheaPct: number;
  childVaccBasicPct: number;
  childVaccBcgPct: number;
  antenatalSkilledPct: number;
  deliveryCesareanPct: number;
  deliveryNoOnePct: number;
  deliverySkilledPct: number;
  deliveryTraditionalPct: number;
  
  // Policy metrics
  policyMaternalRiskScore: number;
  policyStaffGapProxy: number;
  policyNgoPriorityMaternal: number;
  policyCompositeGapScore: number;
  
  // Threat flags
  threatHighHomeDelivery: boolean;
  threatLowImmunization: boolean;
  threatHighAnemia: boolean;
  threatNoInsuranceGap: boolean;
  threatSanityRiskFlag: boolean;
}

// Theme summary from ghana_data_theme_summary.csv
export interface ThemeSummary {
  regionName: string;
  sourceTheme: string;
  indicatorCount: number;
  meanValue: number;
  minValue: number;
  maxValue: number;
}

// Indicator glossary
export interface IndicatorGlossary {
  code: string;
  name: string;
  theme: string;
}

// User roles for the agent
export type UserRole = 'policy_maker' | 'ngo' | 'doctor' | 'patient' | 'general';

// Chat message types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  
  // Analysis results attached to messages
  analysis?: AnalysisResult;
}

export interface AnalysisResult {
  type: 'region_overview' | 'hospital_comparison' | 'threat_analysis' | 'recommendations' | 'chart' | 'map';
  title: string;
  data: any;
  insights: string[];
}

// Agent query intent - expanded action types
export type QueryAction = 
  | 'overview' 
  | 'compare' 
  | 'find_hospitals' 
  | 'threats' 
  | 'recommendations' 
  | 'regional_analysis' 
  | 'help'
  | 'medical_deserts'
  | 'staffing_analysis'
  | 'equipment_analysis'
  | 'maternal_health'
  | 'child_health'
  | 'insurance_analysis'
  | 'capacity_analysis'
  | 'accreditation_analysis'
  | 'ranking'
  | 'gap_analysis';

export interface QueryIntent {
  action: QueryAction;
  regions?: string[];
  hospitalNames?: string[];
  metrics?: string[];
  filters?: {
    minScore?: number;
    maxScore?: number;
    threatFlags?: string[];
    facilityType?: string;
  };
}

// Score utilities
export function getScoreLevel(score: number): 'critical' | 'low' | 'medium' | 'good' | 'excellent' {
  if (score <= 2) return 'critical';
  if (score <= 3) return 'low';
  if (score <= 5) return 'medium';
  if (score <= 7) return 'good';
  return 'excellent';
}

export function getScoreColor(score: number): string {
  const level = getScoreLevel(score);
  const colors = {
    critical: 'hsl(var(--score-critical))',
    low: 'hsl(var(--score-low))',
    medium: 'hsl(var(--score-medium))',
    good: 'hsl(var(--score-good))',
    excellent: 'hsl(var(--score-excellent))',
  };
  return colors[level];
}

export function getThreatLevel(region: Region): 'none' | 'low' | 'medium' | 'high' | 'critical' {
  const threatCount = [
    region.threatHighHomeDelivery,
    region.threatLowImmunization,
    region.threatHighAnemia,
    region.threatNoInsuranceGap,
    region.threatSanityRiskFlag,
  ].filter(Boolean).length;
  
  if (threatCount === 0) return 'none';
  if (threatCount === 1) return 'low';
  if (threatCount === 2) return 'medium';
  if (threatCount <= 4) return 'high';
  return 'critical';
}
