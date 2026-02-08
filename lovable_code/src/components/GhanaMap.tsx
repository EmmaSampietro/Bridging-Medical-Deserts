import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { Hospital, getOverallScore, getScoreLevel } from '@/types/hospital';
import { 
  GHANA_CENTER, 
  GHANA_BOUNDS, 
  prepareMappableHospitals, 
  getMarkerColor,
  MappableHospital 
} from '@/lib/mapUtils';
import { ScoreBadge } from '@/components/ScoreIndicators';
import { ExternalLink, MapPin, Building2 } from 'lucide-react';

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom marker icon based on score
function createCustomIcon(score: number) {
  const color = getMarkerColor(score);
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: ${color};
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 11px;
      ">${score}</div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

// Map bounds controller
function MapController({ hospitals }: { hospitals: MappableHospital[] }) {
  const map = useMap();
  
  useEffect(() => {
    if (hospitals.length > 0) {
      const bounds = L.latLngBounds(hospitals.map(h => h.coordinates));
      map.fitBounds(bounds, { padding: [50, 50] });
    } else {
      map.fitBounds(GHANA_BOUNDS);
    }
  }, [hospitals, map]);
  
  return null;
}

interface GhanaMapProps {
  hospitals: Hospital[];
  className?: string;
}

export function GhanaMap({ hospitals, className }: GhanaMapProps) {
  const mappableHospitals = useMemo(() => prepareMappableHospitals(hospitals), [hospitals]);

  return (
    <div className={`relative rounded-xl overflow-hidden border shadow-card ${className}`}>
      <MapContainer
        center={GHANA_CENTER}
        zoom={7}
        style={{ height: '500px', width: '100%' }}
        maxBounds={[
          [3, -5],
          [13, 3],
        ]}
        minZoom={6}
        maxZoom={15}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapController hospitals={mappableHospitals} />
        
        {mappableHospitals.map((hospital) => {
          const overallScore = getOverallScore(hospital);
          return (
            <Marker
              key={hospital.id}
              position={hospital.coordinates}
              icon={createCustomIcon(overallScore)}
            >
              <Popup className="hospital-popup" minWidth={280} maxWidth={320}>
                <div className="p-2 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <h3 className="font-semibold text-sm">{hospital.name}</h3>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <MapPin className="w-3 h-3" />
                        {hospital.identity.address}
                      </div>
                    </div>
                    <ScoreBadge score={overallScore} size="sm" />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-1.5 rounded bg-muted/50">
                      <div className="font-semibold">{hospital.medicalProcedures.score}</div>
                      <div className="text-muted-foreground">Procedures</div>
                    </div>
                    <div className="p-1.5 rounded bg-muted/50">
                      <div className="font-semibold">{hospital.medicalEquipment.score}</div>
                      <div className="text-muted-foreground">Equipment</div>
                    </div>
                    <div className="p-1.5 rounded bg-muted/50">
                      <div className="font-semibold">{hospital.staffAndHumanCapital.score}</div>
                      <div className="text-muted-foreground">Staff</div>
                    </div>
                  </div>

                  <a
                    href={hospital.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2 px-3 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    View on Google Maps
                  </a>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-card/95 backdrop-blur-sm rounded-lg p-3 border shadow-lg z-[1000]">
        <div className="text-xs font-medium mb-2">Capability Score</div>
        <div className="flex flex-col gap-1.5">
          {[
            { label: '8-10 Excellent', color: '#14b8a6' },
            { label: '6-7 Good', color: '#22c55e' },
            { label: '4-5 Medium', color: '#eab308' },
            { label: '2-3 Low', color: '#f97316' },
            { label: '1 Critical', color: '#ef4444' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-xs text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Hospital count badge */}
      <div className="absolute top-4 right-4 bg-card/95 backdrop-blur-sm rounded-lg px-3 py-2 border shadow-lg z-[1000]">
        <div className="text-sm font-semibold">{mappableHospitals.length} Facilities</div>
        <div className="text-xs text-muted-foreground">Click markers to view details</div>
      </div>
    </div>
  );
}
