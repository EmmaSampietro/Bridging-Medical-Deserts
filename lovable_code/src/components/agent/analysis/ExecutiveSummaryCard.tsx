import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExecutiveSummary } from '@/types/analysis';
import { FileText, Target, Users, MapPin } from 'lucide-react';

interface ExecutiveSummaryCardProps {
  data: ExecutiveSummary;
}

export function ExecutiveSummaryCard({ data }: ExecutiveSummaryCardProps) {
  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          <CardTitle className="text-base">{data.title || 'Executive Summary'}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Key Findings */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Key Findings</h4>
          <ul className="space-y-1.5">
            {data.keyFindings.map((finding, idx) => (
              <li key={idx} className="text-sm flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>{finding}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Recommendation */}
        <div className="p-3 bg-primary/10 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4 text-primary" />
            <h4 className="text-sm font-medium">Recommendation</h4>
          </div>
          <p className="text-sm">{data.recommendation}</p>
        </div>

        {/* Impact Metrics */}
        {(data.populationReach || data.investmentImpact) && (
          <div className="flex flex-wrap gap-3">
            {data.populationReach && (
              <div className="flex items-center gap-2 bg-muted p-2 rounded-lg">
                <Users className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Population Reach</p>
                  <p className="text-sm font-semibold">
                    {(data.populationReach / 1000000).toFixed(2)}M people
                  </p>
                </div>
              </div>
            )}
            {data.investmentImpact && (
              <div className="flex-1 min-w-[200px] bg-muted p-2 rounded-lg">
                <p className="text-xs text-muted-foreground">Investment Impact</p>
                <p className="text-sm font-medium">{data.investmentImpact}</p>
              </div>
            )}
          </div>
        )}

        {/* Priority Regions */}
        {data.priorityRegions && data.priorityRegions.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <h4 className="text-sm font-medium text-muted-foreground">Priority Regions</h4>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data.priorityRegions.map((region, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {region}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
