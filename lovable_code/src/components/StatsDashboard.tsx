import { Hospital, getOverallScore, getScoreLevel } from '@/types/hospital';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, AlertTriangle, TrendingUp, MapPin } from 'lucide-react';

interface StatsDashboardProps {
  hospitals: Hospital[];
}

export function StatsDashboard({ hospitals }: StatsDashboardProps) {
  if (hospitals.length === 0) return null;

  const totalHospitals = hospitals.length;
  const countries = new Set(hospitals.map(h => h.identity.country)).size;
  
  const avgOverallScore = hospitals.reduce((acc, h) => acc + getOverallScore(h), 0) / totalHospitals;
  
  const criticalHospitals = hospitals.filter(h => {
    const score = getOverallScore(h);
    return getScoreLevel(score) === 'critical' || getScoreLevel(score) === 'low';
  }).length;

  const gapsDetected = hospitals.reduce((acc, h) => {
    return acc + h.keyUncertainties.length;
  }, 0);

  const stats = [
    {
      title: 'Total Facilities',
      value: totalHospitals,
      icon: Building2,
      description: `Across ${countries} ${countries === 1 ? 'country' : 'countries'}`,
      color: 'text-accent',
      bgColor: 'bg-accent/10',
    },
    {
      title: 'Average Score',
      value: avgOverallScore.toFixed(1),
      icon: TrendingUp,
      description: 'Capability confidence',
      color: avgOverallScore >= 5 ? 'text-success' : 'text-warning',
      bgColor: avgOverallScore >= 5 ? 'bg-success/10' : 'bg-warning/10',
    },
    {
      title: 'Critical Facilities',
      value: criticalHospitals,
      icon: AlertTriangle,
      description: 'Require urgent attention',
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
    },
    {
      title: 'Evidence Gaps',
      value: gapsDetected,
      icon: MapPin,
      description: 'Data uncertainties found',
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, idx) => {
        const Icon = stat.icon;
        return (
          <Card key={idx} className="hover-lift">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <Icon className={`w-4 h-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${stat.color}`}>
                {stat.value}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
