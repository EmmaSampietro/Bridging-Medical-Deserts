import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Navigation, MapPin, Clock, Star, 
  ArrowRight, Building2, AlertCircle,
  CheckCircle2, ExternalLink, Stethoscope
} from 'lucide-react';
import { Hospital, Region } from '@/types/ghana';
import { RoutingRequest, RoutingResult, DataCitation } from '@/types/citations';
import { cn } from '@/lib/utils';

interface PatientRoutingProps {
  hospitals: Hospital[];
  regions: Region[];
}

// Medical needs and their required capabilities
const medicalNeeds = [
  { id: 'emergency', label: 'Emergency Care', capabilities: ['emergency', 'trauma', 'critical'] },
  { id: 'surgery', label: 'Surgery', capabilities: ['operating', 'surgical', 'surgery'] },
  { id: 'maternal', label: 'Maternal/Obstetric', capabilities: ['maternal', 'obstetric', 'delivery', 'labor'] },
  { id: 'pediatric', label: 'Pediatric Care', capabilities: ['pediatric', 'child', 'neonatal'] },
  { id: 'cardiac', label: 'Cardiac Care', capabilities: ['cardiac', 'cardiology', 'heart'] },
  { id: 'cancer', label: 'Oncology/Cancer', capabilities: ['oncology', 'cancer', 'chemotherapy'] },
  { id: 'diagnostic', label: 'Diagnostic/Imaging', capabilities: ['imaging', 'radiology', 'diagnostic', 'lab'] },
  { id: 'general', label: 'General Care', capabilities: [] },
];

function matchHospitalToNeed(hospital: Hospital, need: typeof medicalNeeds[0], urgency: string): number {
  let score = hospital.averageScore * 10; // Base score 0-100
  
  // Check for matching capabilities
  const services = hospital.onSiteServices?.toLowerCase() || '';
  const matchedCapabilities = need.capabilities.filter(cap => services.includes(cap));
  score += matchedCapabilities.length * 15;
  
  // Boost for urgency
  if (urgency === 'emergency') {
    // Prioritize equipment and staff for emergencies
    score += hospital.medicalEquipmentScore * 3;
    score += hospital.staffScore * 3;
  } else if (urgency === 'urgent') {
    score += hospital.medicalEquipmentScore * 2;
  }
  
  // Accreditation bonus
  score += hospital.accreditationScore * 2;
  
  // Patient experience
  score += hospital.patientExperienceScore;
  
  return Math.min(100, Math.round(score));
}

function generateCitations(hospital: Hospital, matchedCapabilities: string[]): DataCitation[] {
  const citations: DataCitation[] = [];
  
  citations.push({
    id: `${hospital.id}-avg`,
    sourceType: 'hospital',
    sourceName: hospital.name,
    field: 'Average Score',
    value: hospital.averageScore,
    timestamp: new Date(),
  });
  
  citations.push({
    id: `${hospital.id}-equip`,
    sourceType: 'hospital',
    sourceName: hospital.name,
    field: 'Equipment Score',
    value: hospital.medicalEquipmentScore,
    timestamp: new Date(),
  });
  
  citations.push({
    id: `${hospital.id}-staff`,
    sourceType: 'hospital',
    sourceName: hospital.name,
    field: 'Staff Score',
    value: hospital.staffScore,
    timestamp: new Date(),
  });
  
  if (matchedCapabilities.length > 0) {
    citations.push({
      id: `${hospital.id}-caps`,
      sourceType: 'hospital',
      sourceName: hospital.name,
      field: 'Matched Services',
      value: matchedCapabilities.join(', '),
      timestamp: new Date(),
    });
  }
  
  return citations;
}

export function PatientRouting({ hospitals, regions }: PatientRoutingProps) {
  const [selectedNeed, setSelectedNeed] = useState<string>('');
  const [urgency, setUrgency] = useState<'routine' | 'urgent' | 'emergency'>('routine');
  const [preferredRegion, setPreferredRegion] = useState<string>('');
  const [result, setResult] = useState<RoutingResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  
  const uniqueRegions = useMemo(() => {
    const regionSet = new Set(hospitals.map(h => h.region));
    return Array.from(regionSet).filter(Boolean).sort();
  }, [hospitals]);
  
  const handleSearch = () => {
    if (!selectedNeed) return;
    
    setIsSearching(true);
    
    // Simulate search delay
    setTimeout(() => {
      const need = medicalNeeds.find(n => n.id === selectedNeed)!;
      
      // Filter by region if specified
      let candidateHospitals = hospitals;
      if (preferredRegion && preferredRegion !== 'any') {
        candidateHospitals = hospitals.filter(h => 
          h.region.toLowerCase().includes(preferredRegion.toLowerCase())
        );
      }
      
      // Score all hospitals
      const scored = candidateHospitals.map(hospital => {
        const services = hospital.onSiteServices?.toLowerCase() || '';
        const matchedCapabilities = need.capabilities.filter(cap => services.includes(cap));
        return {
          hospital,
          score: matchHospitalToNeed(hospital, need, urgency),
          matchedCapabilities,
        };
      }).sort((a, b) => b.score - a.score);
      
      if (scored.length === 0) {
        setResult({
          recommendedFacility: {
            id: '',
            name: 'No facilities found',
            region: '',
            matchScore: 0,
            capabilities: [],
            reasoning: 'No hospitals match your criteria in the selected region.',
          },
          alternatives: [],
          warnings: ['Consider expanding your search to nearby regions.'],
          citations: [],
        });
        setIsSearching(false);
        return;
      }
      
      const top = scored[0];
      const alternatives = scored.slice(1, 4);
      
      // Generate warnings
      const warnings: string[] = [];
      if (top.score < 50) {
        warnings.push('Best match has limited capabilities for your needs. Consider larger regional facilities.');
      }
      if (top.hospital.keyUncertainties.length > 2) {
        warnings.push('Recommended facility has unverified data. Confirm availability before travel.');
      }
      if (urgency === 'emergency' && top.hospital.medicalEquipmentScore < 4) {
        warnings.push('Equipment rating is below recommended for emergency cases.');
      }
      
      const citations = generateCitations(top.hospital, top.matchedCapabilities);
      
      setResult({
        recommendedFacility: {
          id: top.hospital.id,
          name: top.hospital.name,
          region: top.hospital.region,
          matchScore: top.score,
          capabilities: top.matchedCapabilities,
          estimatedWaitTime: urgency === 'emergency' ? '< 30 min' : urgency === 'urgent' ? '1-2 hours' : '2-4 hours',
          reasoning: `Best match based on ${need.label.toLowerCase()} capabilities, equipment score (${top.hospital.medicalEquipmentScore}/10), and staff availability (${top.hospital.staffScore}/10).`,
        },
        alternatives: alternatives.map(alt => ({
          id: alt.hospital.id,
          name: alt.hospital.name,
          region: alt.hospital.region,
          matchScore: alt.score,
          tradeoff: alt.score >= top.score - 10 
            ? 'Similar capability, may have shorter wait times'
            : 'Lower match score but may be closer to you',
        })),
        warnings,
        citations,
      });
      
      setIsSearching(false);
    }, 800);
  };
  
  const handleGoogleMapsSearch = (hospitalName: string, region: string) => {
    const query = encodeURIComponent(`${hospitalName} ${region} Ghana`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };
  
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Navigation className="w-5 h-5 text-primary" />
          Patient-to-Facility Routing
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Search Form */}
        <div className="space-y-4">
          {/* Medical Need */}
          <div className="space-y-2">
            <Label className="text-sm flex items-center gap-2">
              <Stethoscope className="w-4 h-4" />
              What care do you need?
            </Label>
            <Select value={selectedNeed} onValueChange={setSelectedNeed}>
              <SelectTrigger>
                <SelectValue placeholder="Select medical need..." />
              </SelectTrigger>
              <SelectContent>
                {medicalNeeds.map(need => (
                  <SelectItem key={need.id} value={need.id}>
                    {need.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Urgency */}
          <div className="space-y-2">
            <Label className="text-sm">How urgent is this?</Label>
            <RadioGroup 
              value={urgency} 
              onValueChange={(v) => setUrgency(v as typeof urgency)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="routine" id="routine" />
                <Label htmlFor="routine" className="text-sm font-normal cursor-pointer">
                  Routine
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="urgent" id="urgent" />
                <Label htmlFor="urgent" className="text-sm font-normal cursor-pointer text-yellow-600">
                  Urgent
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="emergency" id="emergency" />
                <Label htmlFor="emergency" className="text-sm font-normal cursor-pointer text-red-600">
                  Emergency
                </Label>
              </div>
            </RadioGroup>
          </div>
          
          {/* Region Preference */}
          <div className="space-y-2">
            <Label className="text-sm flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Preferred region (optional)
            </Label>
            <Select value={preferredRegion} onValueChange={setPreferredRegion}>
              <SelectTrigger>
                <SelectValue placeholder="Any region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any region</SelectItem>
                {uniqueRegions.map(region => (
                  <SelectItem key={region} value={region}>
                    {region}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Button 
            onClick={handleSearch} 
            disabled={!selectedNeed || isSearching}
            className="w-full"
          >
            {isSearching ? (
              <>Finding best match...</>
            ) : (
              <>
                <Navigation className="w-4 h-4 mr-2" />
                Find Best Facility
              </>
            )}
          </Button>
        </div>
        
        {/* Results */}
        {result && (
          <ScrollArea className="h-[350px]">
            <div className="space-y-4">
              {/* Warnings */}
              {result.warnings.length > 0 && (
                <div className="space-y-2">
                  {result.warnings.map((warning, idx) => (
                    <div 
                      key={idx}
                      className="flex items-start gap-2 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20"
                    >
                      <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-yellow-700">{warning}</p>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Recommended Facility */}
              <div className="p-4 rounded-xl border-2 border-primary bg-primary/5">
                <div className="flex items-center justify-between mb-3">
                  <Badge className="bg-primary">
                    <Star className="w-3 h-3 mr-1" />
                    Recommended
                  </Badge>
                  <Badge variant="outline" className="text-lg font-bold">
                    {result.recommendedFacility.matchScore}% match
                  </Badge>
                </div>
                
                <h3 className="font-semibold text-lg mb-1">
                  {result.recommendedFacility.name}
                </h3>
                <p className="text-sm text-muted-foreground flex items-center gap-1 mb-3">
                  <MapPin className="w-3 h-3" />
                  {result.recommendedFacility.region}
                </p>
                
                {result.recommendedFacility.capabilities.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {result.recommendedFacility.capabilities.map(cap => (
                      <Badge key={cap} variant="secondary" className="text-xs">
                        {cap}
                      </Badge>
                    ))}
                  </div>
                )}
                
                <p className="text-sm text-muted-foreground mb-3">
                  {result.recommendedFacility.reasoning}
                </p>
                
                <div className="flex items-center justify-between">
                  {result.recommendedFacility.estimatedWaitTime && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Est. wait: {result.recommendedFacility.estimatedWaitTime}
                    </span>
                  )}
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleGoogleMapsSearch(
                      result.recommendedFacility.name, 
                      result.recommendedFacility.region
                    )}
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    View on Map
                  </Button>
                </div>
              </div>
              
              {/* Alternatives */}
              {result.alternatives.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Alternatives
                  </h4>
                  {result.alternatives.map((alt) => (
                    <div 
                      key={alt.id}
                      className="p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{alt.name}</span>
                        <Badge variant="outline">{alt.matchScore}%</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {alt.region}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <ArrowRight className="w-3 h-3" />
                        {alt.tradeoff}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Citations */}
              {result.citations.length > 0 && (
                <div className="pt-2 border-t">
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">
                    Data Sources Used
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {result.citations.map(citation => (
                      <Badge 
                        key={citation.id} 
                        variant="outline" 
                        className="text-xs font-normal"
                      >
                        {citation.field}: {citation.value}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
