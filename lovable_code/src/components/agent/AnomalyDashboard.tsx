import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AlertTriangle, AlertCircle, Info, XCircle, 
  Building2, TrendingDown, Search, Filter,
  CheckCircle2, HelpCircle
} from 'lucide-react';
import { Hospital } from '@/types/ghana';
import { AnomalyFlag, DataQualityScore } from '@/types/citations';
import { cn } from '@/lib/utils';

interface AnomalyDashboardProps {
  hospitals: Hospital[];
}

// Detect anomalies in hospital data
function detectAnomalies(hospital: Hospital): AnomalyFlag[] {
  const anomalies: AnomalyFlag[] = [];
  const id = hospital.id;
  const name = hospital.name;
  
  // Missing data checks
  const scoreFields = [
    { field: 'medicalProceduresScore', label: 'Medical Procedures' },
    { field: 'medicalEquipmentScore', label: 'Medical Equipment' },
    { field: 'staffScore', label: 'Staff' },
    { field: 'infrastructureScore', label: 'Infrastructure' },
    { field: 'accreditationScore', label: 'Accreditation' },
    { field: 'patientExperienceScore', label: 'Patient Experience' },
  ];
  
  scoreFields.forEach(({ field, label }) => {
    const value = hospital[field as keyof Hospital] as number;
    if (value === 0 || value === undefined) {
      anomalies.push({
        id: `${id}-${field}-missing`,
        hospitalId: id,
        hospitalName: name,
        field: label,
        issue: 'missing_data',
        severity: 'medium',
        description: `No ${label.toLowerCase()} score recorded`,
        suggestedAction: `Verify and update ${label.toLowerCase()} assessment`,
      });
    }
  });
  
  // Suspicious values - very low or very high scores
  scoreFields.forEach(({ field, label }) => {
    const value = hospital[field as keyof Hospital] as number;
    if (value === 1) {
      anomalies.push({
        id: `${id}-${field}-low`,
        hospitalId: id,
        hospitalName: name,
        field: label,
        issue: 'suspicious_value',
        severity: 'high',
        description: `Critically low ${label.toLowerCase()} score (1/10)`,
        actualValue: value,
        expectedRange: { min: 3, max: 10 },
        suggestedAction: `Urgent review needed for ${label.toLowerCase()}`,
      });
    } else if (value === 10 && hospital.averageScore < 5) {
      anomalies.push({
        id: `${id}-${field}-inconsistent`,
        hospitalId: id,
        hospitalName: name,
        field: label,
        issue: 'inconsistent',
        severity: 'medium',
        description: `Perfect ${label.toLowerCase()} score inconsistent with low overall average`,
        actualValue: value,
        suggestedAction: `Verify ${label.toLowerCase()} assessment accuracy`,
      });
    }
  });
  
  // Incomplete explanations
  const explanationFields = [
    { field: 'medicalProceduresExplanation', label: 'Medical Procedures' },
    { field: 'medicalEquipmentExplanation', label: 'Medical Equipment' },
    { field: 'staffExplanation', label: 'Staff' },
  ];
  
  explanationFields.forEach(({ field, label }) => {
    const value = hospital[field as keyof Hospital] as string;
    if (!value || value.length < 20) {
      anomalies.push({
        id: `${id}-${field}-incomplete`,
        hospitalId: id,
        hospitalName: name,
        field: `${label} Explanation`,
        issue: 'incomplete',
        severity: 'low',
        description: `Insufficient evidence documentation for ${label.toLowerCase()}`,
        suggestedAction: `Add detailed explanation for ${label.toLowerCase()} score`,
      });
    }
  });
  
  // Key uncertainties check
  if (hospital.keyUncertainties.length > 3) {
    anomalies.push({
      id: `${id}-uncertainties`,
      hospitalId: id,
      hospitalName: name,
      field: 'Data Quality',
      issue: 'unverified',
      severity: 'high',
      description: `High uncertainty: ${hospital.keyUncertainties.length} unverified data points`,
      suggestedAction: 'Prioritize for data verification audit',
    });
  }
  
  return anomalies;
}

function calculateQualityScore(hospital: Hospital): DataQualityScore {
  const anomalies = detectAnomalies(hospital);
  
  // Calculate completeness (% of non-zero scores)
  const scores = [
    hospital.medicalProceduresScore,
    hospital.medicalEquipmentScore,
    hospital.staffScore,
    hospital.infrastructureScore,
    hospital.accreditationScore,
    hospital.patientExperienceScore,
  ];
  const completeness = (scores.filter(s => s > 0).length / scores.length) * 100;
  
  // Calculate consistency (no critical anomalies)
  const criticalCount = anomalies.filter(a => a.severity === 'critical' || a.severity === 'high').length;
  const consistency = Math.max(0, 100 - (criticalCount * 20));
  
  // Verification based on uncertainties
  const maxUncertainties = 5;
  const verification = Math.max(0, ((maxUncertainties - hospital.keyUncertainties.length) / maxUncertainties) * 100);
  
  const overallQuality = Math.round((completeness * 0.4 + consistency * 0.35 + verification * 0.25));
  
  return {
    hospitalId: hospital.id,
    hospitalName: hospital.name,
    overallQuality,
    completeness: Math.round(completeness),
    consistency: Math.round(consistency),
    verification: Math.round(verification),
    anomalyCount: anomalies.length,
    anomalies,
  };
}

function SeverityIcon({ severity }: { severity: AnomalyFlag['severity'] }) {
  switch (severity) {
    case 'critical': return <XCircle className="w-4 h-4 text-red-600" />;
    case 'high': return <AlertCircle className="w-4 h-4 text-orange-500" />;
    case 'medium': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    case 'low': return <Info className="w-4 h-4 text-blue-500" />;
  }
}

function QualityBadge({ score }: { score: number }) {
  const color = score >= 80 
    ? 'bg-green-500/10 text-green-600 border-green-500/20'
    : score >= 60 
      ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
      : score >= 40
        ? 'bg-orange-500/10 text-orange-600 border-orange-500/20'
        : 'bg-red-500/10 text-red-600 border-red-500/20';
  
  return (
    <Badge variant="outline" className={cn("font-mono", color)}>
      {score}%
    </Badge>
  );
}

export function AnomalyDashboard({ hospitals }: AnomalyDashboardProps) {
  const [selectedSeverity, setSelectedSeverity] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const qualityScores = useMemo(() => 
    hospitals.map(calculateQualityScore).sort((a, b) => a.overallQuality - b.overallQuality),
    [hospitals]
  );
  
  const allAnomalies = useMemo(() => 
    qualityScores.flatMap(qs => qs.anomalies),
    [qualityScores]
  );
  
  const severityCounts = useMemo(() => ({
    critical: allAnomalies.filter(a => a.severity === 'critical').length,
    high: allAnomalies.filter(a => a.severity === 'high').length,
    medium: allAnomalies.filter(a => a.severity === 'medium').length,
    low: allAnomalies.filter(a => a.severity === 'low').length,
  }), [allAnomalies]);
  
  const filteredAnomalies = useMemo(() => {
    let filtered = allAnomalies;
    if (selectedSeverity) {
      filtered = filtered.filter(a => a.severity === selectedSeverity);
    }
    if (searchQuery) {
      filtered = filtered.filter(a => 
        a.hospitalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.field.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return filtered;
  }, [allAnomalies, selectedSeverity, searchQuery]);
  
  const avgQuality = Math.round(qualityScores.reduce((acc, qs) => acc + qs.overallQuality, 0) / qualityScores.length);
  const lowQualityCount = qualityScores.filter(qs => qs.overallQuality < 50).length;
  
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            Data Quality & Anomaly Detection
          </CardTitle>
          <QualityBadge score={avgQuality} />
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-2">
          <Button
            variant={selectedSeverity === 'critical' ? 'default' : 'outline'}
            size="sm"
            className="flex-col h-auto py-2"
            onClick={() => setSelectedSeverity(selectedSeverity === 'critical' ? null : 'critical')}
          >
            <XCircle className="w-4 h-4 text-red-500 mb-1" />
            <span className="text-lg font-bold">{severityCounts.critical}</span>
            <span className="text-xs text-muted-foreground">Critical</span>
          </Button>
          <Button
            variant={selectedSeverity === 'high' ? 'default' : 'outline'}
            size="sm"
            className="flex-col h-auto py-2"
            onClick={() => setSelectedSeverity(selectedSeverity === 'high' ? null : 'high')}
          >
            <AlertCircle className="w-4 h-4 text-orange-500 mb-1" />
            <span className="text-lg font-bold">{severityCounts.high}</span>
            <span className="text-xs text-muted-foreground">High</span>
          </Button>
          <Button
            variant={selectedSeverity === 'medium' ? 'default' : 'outline'}
            size="sm"
            className="flex-col h-auto py-2"
            onClick={() => setSelectedSeverity(selectedSeverity === 'medium' ? null : 'medium')}
          >
            <AlertTriangle className="w-4 h-4 text-yellow-500 mb-1" />
            <span className="text-lg font-bold">{severityCounts.medium}</span>
            <span className="text-xs text-muted-foreground">Medium</span>
          </Button>
          <Button
            variant={selectedSeverity === 'low' ? 'default' : 'outline'}
            size="sm"
            className="flex-col h-auto py-2"
            onClick={() => setSelectedSeverity(selectedSeverity === 'low' ? null : 'low')}
          >
            <Info className="w-4 h-4 text-blue-500 mb-1" />
            <span className="text-lg font-bold">{severityCounts.low}</span>
            <span className="text-xs text-muted-foreground">Low</span>
          </Button>
        </div>
        
        <Tabs defaultValue="anomalies" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="anomalies">Anomalies</TabsTrigger>
            <TabsTrigger value="quality">Quality Scores</TabsTrigger>
          </TabsList>
          
          <TabsContent value="anomalies" className="mt-3">
            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search hospitals or fields..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm border rounded-md bg-background"
              />
            </div>
            
            <ScrollArea className="h-[280px]">
              <div className="space-y-2">
                {filteredAnomalies.slice(0, 20).map((anomaly) => (
                  <div 
                    key={anomaly.id}
                    className="p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <SeverityIcon severity={anomaly.severity} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm truncate">
                            {anomaly.hospitalName}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {anomaly.field}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {anomaly.description}
                        </p>
                        <p className="text-xs text-primary mt-1 flex items-center gap-1">
                          <HelpCircle className="w-3 h-3" />
                          {anomaly.suggestedAction}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                
                {filteredAnomalies.length > 20 && (
                  <p className="text-xs text-center text-muted-foreground py-2">
                    +{filteredAnomalies.length - 20} more anomalies
                  </p>
                )}
                
                {filteredAnomalies.length === 0 && (
                  <div className="text-center py-8">
                    <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No anomalies found</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="quality" className="mt-3">
            <ScrollArea className="h-[320px]">
              <div className="space-y-2">
                {qualityScores.slice(0, 15).map((qs) => (
                  <div 
                    key={qs.hospitalId}
                    className="p-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium text-sm truncate max-w-[180px]">
                          {qs.hospitalName}
                        </span>
                      </div>
                      <QualityBadge score={qs.overallQuality} />
                    </div>
                    
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="w-20 text-muted-foreground">Completeness</span>
                        <Progress value={qs.completeness} className="h-1.5 flex-1" />
                        <span className="w-8 text-right">{qs.completeness}%</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="w-20 text-muted-foreground">Consistency</span>
                        <Progress value={qs.consistency} className="h-1.5 flex-1" />
                        <span className="w-8 text-right">{qs.consistency}%</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="w-20 text-muted-foreground">Verification</span>
                        <Progress value={qs.verification} className="h-1.5 flex-1" />
                        <span className="w-8 text-right">{qs.verification}%</span>
                      </div>
                    </div>
                    
                    {qs.anomalyCount > 0 && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                        <AlertTriangle className="w-3 h-3" />
                        {qs.anomalyCount} issue{qs.anomalyCount > 1 ? 's' : ''} detected
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
        
        {/* Bottom Summary */}
        <div className="pt-2 border-t flex items-center justify-between text-xs text-muted-foreground">
          <span>{lowQualityCount} facilities with low data quality</span>
          <span>{allAnomalies.length} total issues detected</span>
        </div>
      </CardContent>
    </Card>
  );
}
