import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScoreBadge, ScoreBar, ScoreRadial } from '@/components/ScoreIndicators';
import { Hospital, getOverallScore, getScoreLevel } from '@/types/hospital';
import { getGoogleMapsUrl } from '@/lib/mapUtils';
import { 
  Building2, 
  MapPin, 
  ChevronDown, 
  ChevronUp, 
  AlertTriangle,
  ExternalLink,
  Stethoscope,
  Cpu,
  Users,
  Building,
  Award,
  Heart,
  Navigation
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface HospitalCardProps {
  hospital: Hospital;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

const capabilityIcons = {
  medicalProcedures: Stethoscope,
  medicalEquipment: Cpu,
  staffAndHumanCapital: Users,
  infrastructureAndCapacity: Building,
  accreditationAndRegulation: Award,
  patientExperienceAndReputation: Heart,
};

const capabilityLabels = {
  medicalProcedures: 'Medical Procedures',
  medicalEquipment: 'Medical Equipment',
  staffAndHumanCapital: 'Staff & Human Capital',
  infrastructureAndCapacity: 'Infrastructure & Capacity',
  accreditationAndRegulation: 'Accreditation & Regulation',
  patientExperienceAndReputation: 'Patient Experience',
};

export function HospitalCard({ hospital, isExpanded, onToggleExpand }: HospitalCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const overallScore = getOverallScore(hospital);
  const scoreLevel = getScoreLevel(overallScore);
  
  const capabilities = [
    { key: 'medicalProcedures', data: hospital.medicalProcedures },
    { key: 'medicalEquipment', data: hospital.medicalEquipment },
    { key: 'staffAndHumanCapital', data: hospital.staffAndHumanCapital },
    { key: 'infrastructureAndCapacity', data: hospital.infrastructureAndCapacity },
    { key: 'accreditationAndRegulation', data: hospital.accreditationAndRegulation },
    { key: 'patientExperienceAndReputation', data: hospital.patientExperienceAndReputation },
  ] as const;

  const lowScoreCapabilities = capabilities.filter(c => c.data.score <= 3);
  const hasGaps = hospital.keyUncertainties.length > 0 || lowScoreCapabilities.length > 0;

  return (
    <Card className={cn(
      'group transition-all duration-300 hover-lift overflow-hidden',
      scoreLevel === 'critical' && 'border-score-critical/30',
      scoreLevel === 'low' && 'border-score-low/30',
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <h3 className="font-semibold text-foreground truncate">{hospital.name}</h3>
            </div>
            <a 
              href={getGoogleMapsUrl(hospital)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-accent transition-colors group/link"
            >
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate group-hover/link:underline">{hospital.identity.address}</span>
              <Navigation className="w-3 h-3 opacity-0 group-hover/link:opacity-100 transition-opacity" />
            </a>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className="text-xs">
                {hospital.identity.organization_type}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {hospital.identity.country}
              </Badge>
              {hasGaps && (
                <Badge variant="destructive" className="text-xs gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Gaps Detected
                </Badge>
              )}
            </div>
          </div>
          <ScoreRadial score={overallScore} size={70} label="Overall" />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Quick Score Overview */}
        <div className="grid grid-cols-3 gap-3">
          {capabilities.slice(0, 6).map(({ key, data }) => {
            const Icon = capabilityIcons[key];
            return (
              <div key={key} className="flex flex-col items-center p-2 rounded-lg bg-secondary/50">
                <Icon className="w-4 h-4 text-muted-foreground mb-1" />
                <ScoreBadge score={data.score} size="sm" />
              </div>
            );
          })}
        </div>

        {/* Expandable Details */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between"
          onClick={() => setShowDetails(!showDetails)}
        >
          <span className="text-muted-foreground">
            {showDetails ? 'Hide Details' : 'View Capability Details'}
          </span>
          {showDetails ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </Button>

        {showDetails && (
          <div className="space-y-4 animate-fade-in">
            {/* Detailed Scores */}
            <div className="space-y-3">
              {capabilities.map(({ key, data }) => {
                const Icon = capabilityIcons[key];
                return (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {capabilityLabels[key]}
                      </span>
                    </div>
                    <ScoreBar score={data.score} />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {data.explanation}
                    </p>
                    {data.evidence_gaps && data.evidence_gaps !== 'No evidence gaps identified' && (
                      <div className="flex items-start gap-2 p-2 rounded bg-destructive/10 text-xs">
                        <AlertTriangle className="w-3 h-3 text-destructive flex-shrink-0 mt-0.5" />
                        <span className="text-destructive/90">{data.evidence_gaps}</span>
                      </div>
                    )}
                    {data.sources.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {data.sources.map((source, idx) => (
                          <a
                            key={idx}
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                          >
                            <ExternalLink className="w-3 h-3" />
                            {source.source_type}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Overall Summary */}
            <div className="p-3 rounded-lg bg-muted/50 space-y-2">
              <h4 className="text-sm font-medium">Confidence Summary</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {hospital.overallConfidenceSummary}
              </p>
            </div>

            {/* Key Uncertainties */}
            {hospital.keyUncertainties.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-destructive">Key Uncertainties</h4>
                <ul className="space-y-1">
                  {hospital.keyUncertainties.map((uncertainty, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <span className="text-destructive">•</span>
                      {uncertainty}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommended Data Sources */}
            {hospital.recommendedNextDataSources.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-accent">Recommended Next Steps</h4>
                <ul className="space-y-1">
                  {hospital.recommendedNextDataSources.map((source, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <span className="text-accent">→</span>
                      {source}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
