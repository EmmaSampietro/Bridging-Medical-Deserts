import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  FileText, ChevronDown, ChevronRight, Database, 
  MapPin, Building2, Activity, Clock, CheckCircle2
} from 'lucide-react';
import { EvidenceTrace, ReasoningStep, DataCitation } from '@/types/citations';
import { cn } from '@/lib/utils';

interface CitationsPanelProps {
  trace: EvidenceTrace;
  compact?: boolean;
}

function SourceIcon({ type }: { type: DataCitation['sourceType'] }) {
  switch (type) {
    case 'hospital': return <Building2 className="w-3 h-3" />;
    case 'region': return <MapPin className="w-3 h-3" />;
    case 'theme': return <Activity className="w-3 h-3" />;
    case 'computed': return <Database className="w-3 h-3" />;
  }
}

function CitationBadge({ citation }: { citation: DataCitation }) {
  const colors = {
    hospital: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    region: 'bg-green-500/10 text-green-600 border-green-500/20',
    theme: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
    computed: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  };
  
  return (
    <Badge 
      variant="outline" 
      className={cn("text-xs gap-1 font-normal", colors[citation.sourceType])}
    >
      <SourceIcon type={citation.sourceType} />
      <span className="truncate max-w-[120px]">{citation.sourceName}</span>
      <span className="text-muted-foreground">·</span>
      <span>{citation.field}</span>
    </Badge>
  );
}

function ReasoningStepCard({ step, isLast }: { step: ReasoningStep; isLast: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="relative">
      {/* Connection line */}
      {!isLast && (
        <div className="absolute left-4 top-10 bottom-0 w-0.5 bg-border" />
      )}
      
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button 
            variant="ghost" 
            className="w-full justify-start p-3 h-auto hover:bg-muted/50"
          >
            <div className="flex items-start gap-3 w-full">
              {/* Step number */}
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                {step.step}
              </div>
              
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{step.action}</span>
                  <Badge variant="secondary" className="text-xs">
                    {step.inputData.length} sources
                  </Badge>
                  {step.duration && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {step.duration}ms
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                  {step.description}
                </p>
              </div>
              
              {isOpen ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="ml-11 pl-3 border-l-2 border-muted pb-4 space-y-3">
            {/* Input Data */}
            <div>
              <h5 className="text-xs font-medium text-muted-foreground mb-2">
                Data Sources Used:
              </h5>
              <div className="flex flex-wrap gap-1.5">
                {step.inputData.map((citation) => (
                  <CitationBadge key={citation.id} citation={citation} />
                ))}
              </div>
            </div>
            
            {/* Output */}
            <div>
              <h5 className="text-xs font-medium text-muted-foreground mb-1">
                Result:
              </h5>
              <p className="text-sm bg-muted/30 rounded-lg p-2.5">
                {step.outputData}
              </p>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export function CitationsPanel({ trace, compact }: CitationsPanelProps) {
  const [showAll, setShowAll] = useState(false);
  
  const confidenceColor = trace.confidence >= 80 
    ? 'text-green-600' 
    : trace.confidence >= 60 
      ? 'text-yellow-600' 
      : 'text-red-600';
  
  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Evidence Trace
          </CardTitle>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">
              {trace.dataPointsUsed} data points
            </span>
            <span className={cn("font-medium", confidenceColor)}>
              {trace.confidence}% confidence
            </span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        {compact ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              {trace.totalSteps} reasoning steps completed
            </div>
            <div className="flex flex-wrap gap-1">
              {trace.steps.flatMap(s => s.inputData).slice(0, 6).map((citation) => (
                <CitationBadge key={citation.id} citation={citation} />
              ))}
              {trace.steps.flatMap(s => s.inputData).length > 6 && (
                <Badge variant="outline" className="text-xs">
                  +{trace.steps.flatMap(s => s.inputData).length - 6} more
                </Badge>
              )}
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full text-xs"
              onClick={() => setShowAll(true)}
            >
              View full reasoning chain
            </Button>
          </div>
        ) : (
          <ScrollArea className={cn(showAll ? "h-[400px]" : "h-auto")}>
            <div className="space-y-1">
              {trace.steps.map((step, idx) => (
                <ReasoningStepCard 
                  key={step.id} 
                  step={step} 
                  isLast={idx === trace.steps.length - 1}
                />
              ))}
            </div>
            
            {/* Final conclusion */}
            <div className="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/10">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Conclusion</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {trace.finalConclusion}
              </p>
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
