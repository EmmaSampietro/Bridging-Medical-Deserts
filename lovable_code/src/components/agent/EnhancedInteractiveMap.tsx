import { useMemo, useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGhanaData } from '@/hooks/useGhanaData';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, GeoJSON } from 'react-leaflet';
import { LatLngBounds, Layer, PathOptions } from 'leaflet';
import { Hospital, Region, getScoreLevel } from '@/types/ghana';
import { ZoomIn, ZoomOut, Layers, Building2, MapPin, X, ChevronRight, RotateCcw } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Ghana bounds and center
const GHANA_CENTER: [number, number] = [7.9465, -1.0232];
const GHANA_BOUNDS = new LatLngBounds(
  [4.5, -3.5],
  [11.5, 1.5]
);

// Region coordinates for hospital placement
const REGION_COORDS: Record<string, [number, number]> = {
  'greater accra': [5.6037, -0.1870],
  'ashanti': [6.6885, -1.6244],
  'western': [5.0, -2.0],
  'western north': [6.3, -2.5],
  'central': [5.5, -1.2],
  'eastern': [6.5, -0.5],
  'volta': [6.8, 0.5],
  'oti': [7.8, 0.3],
  'northern': [9.4, -0.8],
  'savannah': [9.0, -1.8],
  'north east': [10.5, -0.2],
  'upper east': [10.7, -0.8],
  'upper west': [10.3, -2.3],
  'bono': [7.5, -2.3],
  'bono east': [7.8, -1.5],
  'ahafo': [7.0, -2.5],
};

// Available metrics for region view
const REGION_METRICS = [
  { key: 'healthInsuranceNonePct', label: 'No Health Insurance %', colorScale: 'red' as const, description: 'Population without health insurance coverage' },
  { key: 'deliverySkilledPct', label: 'Skilled Delivery %', colorScale: 'green' as const, description: 'Births attended by skilled health personnel' },
  { key: 'childVaccBasicPct', label: 'Child Vaccination %', colorScale: 'green' as const, description: 'Children with basic vaccinations' },
  { key: 'anemiaWomenAnyPct', label: 'Anemia in Women %', colorScale: 'red' as const, description: 'Women with any level of anemia' },
  { key: 'childDiarrheaPct', label: 'Child Diarrhea %', colorScale: 'red' as const, description: 'Children with recent diarrhea episodes' },
  { key: 'policyCompositeGapScore', label: 'Policy Gap Score', colorScale: 'red' as const, description: 'Composite score of healthcare policy gaps' },
  { key: 'policyMaternalRiskScore', label: 'Maternal Risk Score', colorScale: 'red' as const, description: 'Risk score for maternal health outcomes' },
];

function getHospitalCoords(hospital: Hospital): [number, number] | null {
  const region = hospital.region.toLowerCase();
  const coords = REGION_COORDS[region];
  if (coords) {
    return [
      coords[0] + (Math.random() - 0.5) * 0.15,
      coords[1] + (Math.random() - 0.5) * 0.15,
    ];
  }
  return null;
}

function getScoreColor(score: number): string {
  const level = getScoreLevel(score);
  const colors = {
    critical: '#ef4444',
    low: '#f97316',
    medium: '#eab308',
    good: '#22c55e',
    excellent: '#14b8a6',
  };
  return colors[level];
}

function getMetricColor(value: number, min: number, max: number, colorScale: 'red' | 'green'): string {
  const range = max - min;
  const ratio = range > 0 ? (value - min) / range : 0.5;
  
  if (colorScale === 'red') {
    // Higher is worse - interpolate from green to red
    const r = Math.round(34 + ratio * (239 - 34));
    const g = Math.round(197 - ratio * (197 - 68));
    const b = Math.round(94 - ratio * (94 - 68));
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    // Higher is better - interpolate from red to green
    const r = Math.round(239 - ratio * (239 - 34));
    const g = Math.round(68 + ratio * (197 - 68));
    const b = Math.round(68 + ratio * (94 - 68));
    return `rgb(${r}, ${g}, ${b})`;
  }
}

interface MapControllerProps {
  focusedRegion?: string;
  zoomLevel: number;
}

function MapController({ focusedRegion, zoomLevel }: MapControllerProps) {
  const map = useMap();
  
  useEffect(() => {
    if (focusedRegion) {
      const coords = REGION_COORDS[focusedRegion.toLowerCase()];
      if (coords) {
        map.flyTo(coords, 9, { duration: 0.5 });
        return;
      }
    }
    map.fitBounds(GHANA_BOUNDS);
    map.setZoom(zoomLevel);
  }, [focusedRegion, zoomLevel, map]);
  
  return null;
}

interface HospitalDetailPanelProps {
  hospital: Hospital;
  onClose: () => void;
}

function HospitalDetailPanel({ hospital, onClose }: HospitalDetailPanelProps) {
  const scores = [
    { label: 'Medical Procedures', score: hospital.medicalProceduresScore, explanation: hospital.medicalProceduresExplanation },
    { label: 'Equipment', score: hospital.medicalEquipmentScore, explanation: hospital.medicalEquipmentExplanation },
    { label: 'Staffing', score: hospital.staffScore, explanation: hospital.staffExplanation },
    { label: 'Infrastructure', score: hospital.infrastructureScore, explanation: hospital.infrastructureExplanation },
    { label: 'Accreditation', score: hospital.accreditationScore, explanation: hospital.accreditationExplanation },
    { label: 'Patient Experience', score: hospital.patientExperienceScore, explanation: hospital.patientExperienceExplanation },
  ];

  return (
    <div className="absolute top-0 right-0 w-80 h-full bg-card border-l shadow-lg z-[1001] overflow-y-auto">
      <div className="sticky top-0 bg-card border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary" />
          <span className="font-semibold text-sm">Hospital Details</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>
      
      <div className="p-4 space-y-4">
        <div>
          <h3 className="font-bold text-lg">{hospital.name}</h3>
          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
            <MapPin className="w-3 h-3" />
            {hospital.address || hospital.region}
          </div>
          <Badge variant="outline" className="mt-2">{hospital.organizationType}</Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <div 
            className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white"
            style={{ backgroundColor: getScoreColor(hospital.averageScore) }}
          >
            {hospital.averageScore.toFixed(1)}
          </div>
          <div>
            <p className="text-sm font-medium">Overall Score</p>
            <p className="text-xs text-muted-foreground">Average across all metrics</p>
          </div>
        </div>
        
        <div className="space-y-3">
          <h4 className="font-semibold text-sm">Capability Breakdown</h4>
          {scores.map(({ label, score, explanation }) => (
            <div key={label} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{label}</span>
                <Badge 
                  variant="outline" 
                  style={{ 
                    backgroundColor: `${getScoreColor(score)}20`,
                    borderColor: getScoreColor(score),
                    color: getScoreColor(score)
                  }}
                >
                  {score.toFixed(1)}
                </Badge>
              </div>
              {explanation && (
                <p className="text-xs text-muted-foreground line-clamp-2">{explanation}</p>
              )}
            </div>
          ))}
        </div>
        
        {hospital.keyUncertainties.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Key Uncertainties</h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              {hospital.keyUncertainties.slice(0, 3).map((u, i) => (
                <li key={i} className="flex items-start gap-1">
                  <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  {u}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {hospital.overallConfidenceSummary && (
          <div className="p-3 bg-muted rounded-lg">
            <h4 className="font-semibold text-xs mb-1">Confidence Summary</h4>
            <p className="text-xs text-muted-foreground">{hospital.overallConfidenceSummary}</p>
          </div>
        )}
      </div>
    </div>
  );
}



interface GeoJSONFeature {
  type: 'Feature';
  properties: {
    region: string;
    capital?: string;
  };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][];
  };
}

interface GeoJSONData {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

export function EnhancedInteractiveMap() {
  const { hospitals, regions, isLoading } = useGhanaData();
  const [mounted, setMounted] = useState(false);
  const [geoJsonData, setGeoJsonData] = useState<GeoJSONData | null>(null);
  const [selectedMetric, setSelectedMetric] = useState(REGION_METRICS[0].key);
  const [focusedRegion, setFocusedRegion] = useState<string | undefined>();
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
  const [zoomLevel, setZoomLevel] = useState(7);
  const [showHospitals, setShowHospitals] = useState(false);
  
  useEffect(() => {
    setMounted(true);
    fetch('/data/ghana_regions.geojson')
      .then(res => res.json())
      .then(data => setGeoJsonData(data))
      .catch(err => console.error('Failed to load GeoJSON:', err));
  }, []);
  
  const mappableHospitals = useMemo(() => {
    return hospitals
      .map(h => ({
        ...h,
        coords: getHospitalCoords(h),
      }))
      .filter(h => h.coords !== null);
  }, [hospitals]);
  
  const metricStats = useMemo(() => {
    const values = regions.map(r => (r as unknown as Record<string, number>)[selectedMetric] || 0);
    return {
      min: Math.min(...values),
      max: Math.max(...values),
    };
  }, [regions, selectedMetric]);
  
  const getRegionValue = useCallback((regionName: string): number => {
    const normalizedName = regionName.toLowerCase().trim();
    const region = regions.find(r => 
      r.canonicalName.toLowerCase().trim() === normalizedName ||
      r.name.toLowerCase().trim() === normalizedName
    );
    return region ? ((region as unknown as Record<string, number>)[selectedMetric] || 0) : 0;
  }, [regions, selectedMetric]);
  
  const currentMetricInfo = REGION_METRICS.find(m => m.key === selectedMetric);
  
  const geoJsonStyle = useCallback((feature: GeoJSONFeature | undefined): PathOptions => {
    if (!feature) return {};
    
    const regionName = feature.properties.region;
    const value = getRegionValue(regionName);
    const color = getMetricColor(value, metricStats.min, metricStats.max, currentMetricInfo?.colorScale || 'red');
    const isFocused = focusedRegion?.toLowerCase() === regionName.toLowerCase();
    
    return {
      fillColor: color,
      weight: isFocused ? 3 : 1.5,
      opacity: 1,
      color: isFocused ? '#1e3a5f' : '#374151',
      fillOpacity: isFocused ? 0.8 : 0.6,
    };
  }, [getRegionValue, metricStats, currentMetricInfo, focusedRegion]);
  
  const onEachFeature = useCallback((feature: GeoJSONFeature, layer: Layer) => {
    const regionName = feature.properties.region;
    const value = getRegionValue(regionName);
    const hospitalCount = hospitals.filter(h => 
      h.region.toLowerCase() === regionName.toLowerCase()
    ).length;
    
    layer.bindPopup(`
      <div class="text-sm space-y-1 min-w-[180px]">
        <p class="font-bold text-base">${regionName}</p>
        <p class="text-muted-foreground">${currentMetricInfo?.label}: <span class="font-semibold">${value.toFixed(1)}%</span></p>
        <p class="text-muted-foreground">${hospitalCount} healthcare facilities</p>
        <p class="text-xs text-gray-500 mt-1">${currentMetricInfo?.description}</p>
      </div>
    `);
    
    layer.on({
      click: () => {
        if (focusedRegion === regionName.toLowerCase()) {
          setFocusedRegion(undefined);
        } else {
          setFocusedRegion(regionName.toLowerCase());
        }
      },
      mouseover: (e) => {
        const target = e.target;
        target.setStyle({
          weight: 3,
          fillOpacity: 0.8,
        });
      },
      mouseout: (e) => {
        const target = e.target;
        const isFocused = focusedRegion?.toLowerCase() === regionName.toLowerCase();
        target.setStyle({
          weight: isFocused ? 3 : 1.5,
          fillOpacity: isFocused ? 0.8 : 0.6,
        });
      },
    });
  }, [getRegionValue, currentMetricInfo, hospitals, focusedRegion]);
  
  const handleHospitalClick = useCallback((hospital: Hospital) => {
    setSelectedHospital(hospital);
  }, []);
  
  const handleZoomIn = () => setZoomLevel(z => Math.min(z + 1, 12));
  const handleZoomOut = () => setZoomLevel(z => Math.max(z - 1, 6));
  const handleResetView = () => {
    setFocusedRegion(undefined);
    setSelectedHospital(null);
    setZoomLevel(7);
  };
  
  if (!mounted || isLoading) {
    return (
      <Card className="h-[500px] flex items-center justify-center">
        <p className="text-muted-foreground">Loading map...</p>
      </Card>
    );
  }
  
  return (
    <Card className="overflow-hidden relative">
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Layers className="w-4 h-4" />
              Interactive Healthcare Map
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handleZoomIn} title="Zoom in">
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={handleZoomOut} title="Zoom out">
                <ZoomOut className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={handleResetView} title="Reset view">
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedMetric} onValueChange={setSelectedMetric}>
              <SelectTrigger className="w-[220px] h-8 text-xs">
                <SelectValue placeholder="Select metric" />
              </SelectTrigger>
              <SelectContent className="z-[2000]">
                {REGION_METRICS.map(m => (
                  <SelectItem key={m.key} value={m.key} className="text-xs">{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button 
              variant={showHospitals ? 'default' : 'outline'} 
              size="sm"
              className="h-8 text-xs"
              onClick={() => setShowHospitals(!showHospitals)}
            >
              <Building2 className="w-3 h-3 mr-1" />
              {showHospitals ? 'Hide Hospitals' : 'Show Hospitals'}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0 relative">
        <div className="h-[450px]">
          <MapContainer
            center={GHANA_CENTER}
            zoom={zoomLevel}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
          >
            <MapController focusedRegion={focusedRegion} zoomLevel={zoomLevel} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {/* Region polygons - always shown */}
            {geoJsonData && (
              <GeoJSON 
                key={`${selectedMetric}-${focusedRegion || 'all'}`}
                data={geoJsonData}
                style={geoJsonStyle as (feature?: GeoJSON.Feature) => PathOptions}
                onEachFeature={onEachFeature as (feature: GeoJSON.Feature, layer: Layer) => void}
              />
            )}
            
            {/* Hospital markers - toggled separately */}
            {showHospitals && mappableHospitals.map((hospital) => (
              <CircleMarker
                key={hospital.id}
                center={hospital.coords!}
                radius={8}
                fillColor={getScoreColor(hospital.averageScore)}
                color={getScoreColor(hospital.averageScore)}
                weight={2}
                opacity={1}
                fillOpacity={0.7}
                eventHandlers={{
                  click: () => handleHospitalClick(hospital),
                }}
              >
                <Popup>
                  <div className="text-sm space-y-1">
                    <p className="font-bold">{hospital.name}</p>
                    <p className="text-muted-foreground">{hospital.region}</p>
                    <div className="flex items-center gap-1">
                      <span>Score:</span>
                      <Badge 
                        style={{ 
                          backgroundColor: `${getScoreColor(hospital.averageScore)}20`,
                          color: getScoreColor(hospital.averageScore)
                        }}
                      >
                        {hospital.averageScore.toFixed(1)}
                      </Badge>
                    </div>
                    <Button size="sm" className="w-full mt-2 h-7 text-xs" onClick={() => handleHospitalClick(hospital)}>
                      View Details
                    </Button>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
        
        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-card/95 backdrop-blur-sm rounded-lg p-3 border shadow-lg z-[1000] space-y-3">
          {/* Metric Legend */}
          <div>
            <div className="text-xs font-medium mb-2">{currentMetricInfo?.label}</div>
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <div 
                  className="w-24 h-3 rounded" 
                  style={{ 
                    background: currentMetricInfo?.colorScale === 'green' 
                      ? 'linear-gradient(to right, #ef4444, #eab308, #22c55e)' 
                      : 'linear-gradient(to right, #22c55e, #eab308, #ef4444)' 
                  }} 
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{metricStats.min.toFixed(0)}%</span>
                <span>{metricStats.max.toFixed(0)}%</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {currentMetricInfo?.colorScale === 'green' ? 'Higher is better' : 'Lower is better'}
              </p>
            </div>
          </div>
          
          {/* Hospital Legend - only when hospitals are shown */}
          {showHospitals && (
            <div className="border-t pt-2">
              <div className="text-xs font-medium mb-2">Hospital Capability</div>
              <div className="flex flex-col gap-1">
                {[
                  { label: '8-10 Excellent', color: '#14b8a6' },
                  { label: '6-7 Good', color: '#22c55e' },
                  { label: '4-5 Medium', color: '#eab308' },
                  { label: '2-3 Low', color: '#f97316' },
                  { label: '0-1 Critical', color: '#ef4444' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Hospital Detail Panel */}
        {selectedHospital && (
          <HospitalDetailPanel hospital={selectedHospital} onClose={() => setSelectedHospital(null)} />
        )}
      </CardContent>
    </Card>
  );
}
