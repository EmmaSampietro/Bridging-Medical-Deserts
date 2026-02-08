export interface HospitalSource {
  url: string;
  source_type: string;
  supports: string;
}

export interface HospitalIdentity {
  name: string;
  unique_id: string;
  address: string;
  country: string;
  organization_type: string;
}

export interface CapabilityScore {
  score: number;
  explanation: string;
  evidence_gaps: string;
  sources: HospitalSource[];
}

export interface Hospital {
  id: string;
  name: string;
  identity: HospitalIdentity;
  rawData: string;
  
  // Capability scores (1-10 scale)
  medicalProcedures: CapabilityScore;
  medicalEquipment: CapabilityScore;
  staffAndHumanCapital: CapabilityScore;
  infrastructureAndCapacity: CapabilityScore;
  accreditationAndRegulation: CapabilityScore;
  patientExperienceAndReputation: CapabilityScore;
  
  // Overall assessment
  overallConfidenceSummary: string;
  keyUncertainties: string[];
  recommendedNextDataSources: string[];
}

export interface HospitalFilters {
  country?: string;
  minScore?: number;
  maxScore?: number;
  searchQuery?: string;
  sortBy?: 'name' | 'overallScore' | 'medicalProcedures' | 'equipment' | 'staff';
  sortOrder?: 'asc' | 'desc';
}

export type ScoreLevel = 'critical' | 'low' | 'medium' | 'good' | 'excellent';

export function getScoreLevel(score: number): ScoreLevel {
  if (score <= 2) return 'critical';
  if (score <= 3) return 'low';
  if (score <= 5) return 'medium';
  if (score <= 7) return 'good';
  return 'excellent';
}

export function getOverallScore(hospital: Hospital): number {
  const scores = [
    hospital.medicalProcedures.score,
    hospital.medicalEquipment.score,
    hospital.staffAndHumanCapital.score,
    hospital.infrastructureAndCapacity.score,
    hospital.accreditationAndRegulation.score,
    hospital.patientExperienceAndReputation.score,
  ];
  return Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1));
}

export function getScoreColor(score: number): string {
  const level = getScoreLevel(score);
  const colors: Record<ScoreLevel, string> = {
    critical: 'text-score-critical',
    low: 'text-score-low',
    medium: 'text-score-medium',
    good: 'text-score-good',
    excellent: 'text-score-excellent',
  };
  return colors[level];
}

export function getScoreBgColor(score: number): string {
  const level = getScoreLevel(score);
  const colors: Record<ScoreLevel, string> = {
    critical: 'bg-score-critical/15',
    low: 'bg-score-low/15',
    medium: 'bg-score-medium/15',
    good: 'bg-score-good/15',
    excellent: 'bg-score-excellent/15',
  };
  return colors[level];
}
