import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AnalysisResult, Hospital, Region, getScoreLevel } from '@/types/ghana';
import { 
  AlertTriangle, TrendingUp, MapPin, Building2, 
  Activity, Shield, ChevronRight, ExternalLink 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';

interface AnalysisCardProps {
  analysis: AnalysisResult;
}

const SCORE_COLORS = {
  critical: 'hsl(0, 84%, 60%)',
  low: 'hsl(25, 95%, 53%)',
  medium: 'hsl(45, 93%, 47%)',
  good: 'hsl(142, 76%, 36%)',
  excellent: 'hsl(173, 80%, 40%)',
};

export function AnalysisCard({ analysis }: AnalysisCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2 bg-muted/30">
        <div className="flex items-center gap-2">
          <AnalysisIcon type={analysis.type} />
          <CardTitle className="text-sm">{analysis.title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {/* Insights */}
        {analysis.insights.length > 0 && (
          <div className="space-y-2">
            {analysis.insights.map((insight, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm">
                <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-muted-foreground">{insight}</span>
              </div>
            ))}
          </div>
        )}
        
        {/* Type-specific visualizations */}
        {analysis.type === 'region_overview' && analysis.data.topRegions && (
          <RegionOverviewChart regions={analysis.data.topRegions} />
        )}
        
        {analysis.type === 'threat_analysis' && analysis.data.threatData && (
          <ThreatChart threatData={analysis.data.threatData} />
        )}
        
        {analysis.type === 'hospital_comparison' && analysis.data.hospitals && (
          <HospitalList hospitals={analysis.data.hospitals} />
        )}
        
        {analysis.type === 'recommendations' && analysis.data.priorityRegions && (
          <PriorityChart regions={analysis.data.priorityRegions} />
        )}
        
        {/* Region detail */}
        {analysis.type === 'region_overview' && analysis.data.region && (
          <RegionDetailCard region={analysis.data.region} />
        )}
      </CardContent>
    </Card>
  );
}

function AnalysisIcon({ type }: { type: AnalysisResult['type'] }) {
  const iconClass = "w-4 h-4 text-primary";
  switch (type) {
    case 'region_overview': return <MapPin className={iconClass} />;
    case 'hospital_comparison': return <Building2 className={iconClass} />;
    case 'threat_analysis': return <AlertTriangle className={iconClass} />;
    case 'recommendations': return <TrendingUp className={iconClass} />;
    default: return <Activity className={iconClass} />;
  }
}

function RegionOverviewChart({ regions }: { regions: Region[] }) {
  const data = regions.map(r => ({
    name: r.canonicalName,
    population: Math.round((r.population2021 || 0) / 1000),
    gap: Math.round(r.policyCompositeGapScore),
  }));
  
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis type="number" tick={{ fontSize: 10 }} />
          <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 10 }} />
          <Tooltip 
            contentStyle={{ fontSize: 12, background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
            formatter={(value: number, name: string) => [
              name === 'population' ? `${value}k people` : `${value} gap score`,
              name === 'population' ? 'Population' : 'Gap Score'
            ]}
          />
          <Bar dataKey="gap" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ThreatChart({ threatData }: { threatData: any[] }) {
  const data = threatData.slice(0, 8).map(t => ({
    name: t.region.length > 12 ? t.region.substring(0, 12) + '...' : t.region,
    threats: t.threats.length,
    score: Math.round(t.compositeGap),
  }));
  
  const colors = ['hsl(var(--destructive))', 'hsl(var(--warning))', 'hsl(var(--primary))'];
  
  return (
    <div className="space-y-3">
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={{ fontSize: 12, background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
            <Bar dataKey="score" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="Gap Score" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-1">
        {threatData.slice(0, 5).map((t, idx) => (
          <Badge key={idx} variant={t.threats.includes('High Risk Flag') ? 'destructive' : 'outline'} className="text-xs">
            {t.region}: {t.threats.length} threats
          </Badge>
        ))}
      </div>
    </div>
  );
}

function HospitalList({ hospitals }: { hospitals: Hospital[] }) {
  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {hospitals.slice(0, 10).map((hospital, idx) => {
        const level = getScoreLevel(hospital.averageScore);
        return (
          <div key={hospital.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold',
              level === 'critical' && 'bg-score-critical/20 text-score-critical',
              level === 'low' && 'bg-score-low/20 text-score-low',
              level === 'medium' && 'bg-score-medium/20 text-score-medium',
              level === 'good' && 'bg-score-good/20 text-score-good',
              level === 'excellent' && 'bg-score-excellent/20 text-score-excellent',
            )}>
              {hospital.averageScore.toFixed(1)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{hospital.name}</p>
              <p className="text-xs text-muted-foreground truncate">{hospital.address || hospital.region}</p>
            </div>
            {hospital.facilityType && (
              <Badge variant="secondary" className="text-xs">{hospital.facilityType}</Badge>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PriorityChart({ regions }: { regions: Region[] }) {
  const data = regions.map(r => ({
    name: r.canonicalName,
    maternal: Math.round(r.policyMaternalRiskScore),
    staff: Math.round(r.policyStaffGapProxy),
    ngo: Math.round(r.policyNgoPriorityMaternal),
  }));
  
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data}>
          <PolarGrid strokeDasharray="3 3" />
          <PolarAngleAxis dataKey="name" tick={{ fontSize: 9 }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
          <Radar name="Maternal Risk" dataKey="maternal" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive))" fillOpacity={0.3} />
          <Radar name="Staff Gap" dataKey="staff" stroke="hsl(var(--warning))" fill="hsl(var(--warning))" fillOpacity={0.3} />
          <Tooltip contentStyle={{ fontSize: 11, background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

function RegionDetailCard({ region }: { region: Region }) {
  const metrics = [
    { label: 'Skilled Delivery', value: region.deliverySkilledPct, max: 100 },
    { label: 'Basic Vaccination', value: region.childVaccBasicPct, max: 100 },
    { label: 'Antenatal Care', value: region.antenatalSkilledPct, max: 100 },
  ];
  
  return (
    <div className="space-y-3 pt-2 border-t">
      <div className="grid grid-cols-2 gap-4 text-sm">
        {region.population2021 && (
          <div>
            <span className="text-muted-foreground">Population:</span>
            <span className="ml-2 font-medium">{region.population2021.toLocaleString()}</span>
          </div>
        )}
        {region.populationDensity && (
          <div>
            <span className="text-muted-foreground">Density:</span>
            <span className="ml-2 font-medium">{Math.round(region.populationDensity)}/km²</span>
          </div>
        )}
      </div>
      
      <div className="space-y-2">
        {metrics.map(m => (
          <div key={m.label} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{m.label}</span>
              <span className="font-medium">{m.value}%</span>
            </div>
            <Progress 
              value={m.value} 
              className="h-1.5"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
