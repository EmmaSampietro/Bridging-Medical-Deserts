import { useMemo, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useGhanaData } from '@/hooks/useGhanaData';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { LatLngBounds } from 'leaflet';
import { Hospital, Region, getScoreLevel } from '@/types/ghana';
import 'leaflet/dist/leaflet.css';

// Ghana bounds and center
const GHANA_CENTER: [number, number] = [7.9465, -1.0232];
const GHANA_BOUNDS = new LatLngBounds(
  [4.5, -3.5],
  [11.5, 1.5]
);

// Region coordinates
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
  'northeast': [10.5, -0.2],
  'upper east': [10.7, -0.8],
  'upper west': [10.3, -2.3],
  'bono': [7.5, -2.3],
  'bono east': [7.8, -1.5],
  'ahafo': [7.0, -2.5],
};

function getHospitalCoords(hospital: Hospital): [number, number] | null {
  const region = hospital.region.toLowerCase();
  const coords = REGION_COORDS[region];
  if (coords) {
    return [
      coords[0] + (Math.random() - 0.5) * 0.3,
      coords[1] + (Math.random() - 0.5) * 0.3,
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

function MapController() {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(GHANA_BOUNDS);
  }, [map]);
  return null;
}

export function InteractiveMap() {
  const { hospitals, regions, isLoading } = useGhanaData();
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  const mappableHospitals = useMemo(() => {
    return hospitals
      .map(h => ({
        ...h,
        coords: getHospitalCoords(h),
      }))
      .filter(h => h.coords !== null);
  }, [hospitals]);
  
  // Group by region for clustering display
  const regionStats = useMemo(() => {
    const stats: Record<string, { count: number; avgScore: number; coords: [number, number] }> = {};
    
    for (const [regionKey, coords] of Object.entries(REGION_COORDS)) {
      const regionHospitals = hospitals.filter(h => h.region.toLowerCase() === regionKey);
      if (regionHospitals.length > 0) {
        const avgScore = regionHospitals.reduce((acc, h) => acc + h.averageScore, 0) / regionHospitals.length;
        stats[regionKey] = {
          count: regionHospitals.length,
          avgScore: Math.round(avgScore * 10) / 10,
          coords,
        };
      }
    }
    
    return stats;
  }, [hospitals]);
  
  if (!mounted || isLoading) {
    return (
      <Card className="h-[400px] flex items-center justify-center">
        <p className="text-muted-foreground">Loading map...</p>
      </Card>
    );
  }
  
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Healthcare Facility Distribution</CardTitle>
          <div className="flex gap-2">
            <Badge variant="outline" className="text-xs bg-score-excellent/20">Excellent</Badge>
            <Badge variant="outline" className="text-xs bg-score-good/20">Good</Badge>
            <Badge variant="outline" className="text-xs bg-score-medium/20">Medium</Badge>
            <Badge variant="outline" className="text-xs bg-score-low/20">Low</Badge>
            <Badge variant="outline" className="text-xs bg-score-critical/20">Critical</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="h-[350px]">
          <MapContainer
            center={GHANA_CENTER}
            zoom={7}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
          >
            <MapController />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {/* Region clusters */}
            {Object.entries(regionStats).map(([region, data]) => (
              <CircleMarker
                key={region}
                center={data.coords}
                radius={Math.min(20, 8 + data.count * 0.5)}
                fillColor={getScoreColor(data.avgScore)}
                color={getScoreColor(data.avgScore)}
                weight={2}
                opacity={0.8}
                fillOpacity={0.5}
              >
                <Popup>
                  <div className="text-sm">
                    <p className="font-bold capitalize">{region}</p>
                    <p className="text-muted-foreground">{data.count} facilities</p>
                    <p>Avg Score: <span className="font-medium">{data.avgScore}</span></p>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      </CardContent>
    </Card>
  );
}
