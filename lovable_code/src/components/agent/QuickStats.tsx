import { Card, CardContent } from '@/components/ui/card';
import { useGhanaData } from '@/hooks/useGhanaData';
import { Building2, MapPin, AlertTriangle, Activity, TrendingUp, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export function QuickStats() {
  const { hospitals, regions, isLoading } = useGhanaData();
  
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse bg-card/60">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-muted rounded-xl" />
                <div className="space-y-1.5">
                  <div className="h-6 w-12 bg-muted rounded" />
                  <div className="h-3 w-16 bg-muted/60 rounded" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }
  
  const totalHospitals = hospitals.length;
  const avgScore = hospitals.reduce((acc, h) => acc + h.averageScore, 0) / totalHospitals;
  const criticalFacilities = hospitals.filter(h => h.averageScore < 3).length;
  const threatRegions = regions.filter(r => r.threatSanityRiskFlag).length;
  const totalPopulation = regions.reduce((acc, r) => acc + (r.population2021 || 0), 0);
  const excellentFacilities = hospitals.filter(h => h.averageScore >= 7).length;
  
  const stats = [
    {
      title: 'Total Facilities',
      value: totalHospitals,
      icon: Building2,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      borderColor: 'border-primary/20',
    },
    {
      title: 'Regions Covered',
      value: regions.length,
      icon: MapPin,
      color: 'text-accent',
      bgColor: 'bg-accent/10',
      borderColor: 'border-accent/20',
    },
    {
      title: 'Avg Capability',
      value: avgScore.toFixed(1),
      suffix: '/10',
      icon: TrendingUp,
      color: avgScore >= 5 ? 'text-success' : 'text-warning',
      bgColor: avgScore >= 5 ? 'bg-success/10' : 'bg-warning/10',
      borderColor: avgScore >= 5 ? 'border-success/20' : 'border-warning/20',
    },
    {
      title: 'Critical Need',
      value: criticalFacilities,
      icon: AlertTriangle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      borderColor: 'border-destructive/20',
      alert: criticalFacilities > 0,
    },
    {
      title: 'High Risk Areas',
      value: threatRegions,
      icon: Activity,
      color: threatRegions > 0 ? 'text-warning' : 'text-success',
      bgColor: threatRegions > 0 ? 'bg-warning/10' : 'bg-success/10',
      borderColor: threatRegions > 0 ? 'border-warning/20' : 'border-success/20',
    },
    {
      title: 'Population',
      value: `${(totalPopulation / 1000000).toFixed(1)}`,
      suffix: 'M',
      icon: Users,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted/50',
      borderColor: 'border-border',
    },
  ];
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {stats.map((stat, idx) => {
        const Icon = stat.icon;
        return (
          <Card 
            key={idx} 
            className={cn(
              "hover-lift border bg-card/80 backdrop-blur-sm overflow-hidden",
              stat.borderColor
            )}
          >
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                  stat.bgColor
                )}>
                  <Icon className={cn('w-5 h-5', stat.color)} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-baseline gap-0.5">
                    <p className={cn('text-xl font-bold tracking-tight', stat.color)}>
                      {stat.value}
                    </p>
                    {stat.suffix && (
                      <span className="text-xs text-muted-foreground font-medium">
                        {stat.suffix}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground font-medium truncate">
                    {stat.title}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
