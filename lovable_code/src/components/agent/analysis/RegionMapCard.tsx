import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapVisualization } from '@/types/analysis';
import { Map } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RegionMapCardProps {
  data: MapVisualization;
}

// Ghana regions with approximate positions for a simplified SVG map
const REGION_PATHS: Record<string, { path: string; center: [number, number] }> = {
  'Upper West': { 
    path: 'M60 20 L120 20 L120 60 L60 60 Z', 
    center: [90, 40] 
  },
  'Upper East': { 
    path: 'M120 20 L180 20 L180 60 L120 60 Z', 
    center: [150, 40] 
  },
  'North East': { 
    path: 'M180 20 L220 30 L220 70 L180 60 Z', 
    center: [200, 45] 
  },
  'Northern': { 
    path: 'M60 60 L180 60 L180 100 L60 100 Z', 
    center: [120, 80] 
  },
  'Savannah': { 
    path: 'M40 80 L60 60 L60 120 L40 120 Z', 
    center: [50, 90] 
  },
  'Bono East': { 
    path: 'M120 100 L180 100 L180 130 L120 130 Z', 
    center: [150, 115] 
  },
  'Bono': { 
    path: 'M60 100 L120 100 L120 130 L60 130 Z', 
    center: [90, 115] 
  },
  'Oti': { 
    path: 'M180 100 L220 90 L220 150 L180 140 Z', 
    center: [200, 120] 
  },
  'Ahafo': { 
    path: 'M60 130 L100 130 L100 160 L60 160 Z', 
    center: [80, 145] 
  },
  'Ashanti': { 
    path: 'M100 130 L160 130 L160 180 L100 180 Z', 
    center: [130, 155] 
  },
  'Volta': { 
    path: 'M180 140 L220 150 L220 200 L180 190 Z', 
    center: [200, 170] 
  },
  'Eastern': { 
    path: 'M160 160 L180 160 L180 210 L160 210 Z', 
    center: [170, 185] 
  },
  'Western North': { 
    path: 'M40 160 L80 160 L80 200 L40 200 Z', 
    center: [60, 180] 
  },
  'Western': { 
    path: 'M40 200 L80 200 L80 240 L40 240 Z', 
    center: [60, 220] 
  },
  'Central': { 
    path: 'M80 200 L130 200 L130 240 L80 240 Z', 
    center: [105, 220] 
  },
  'Greater Accra': { 
    path: 'M130 200 L170 200 L170 230 L130 230 Z', 
    center: [150, 215] 
  },
};

// Match region names to our map keys
const normalizeRegionName = (name: string): string => {
  const mappings: Record<string, string> = {
    'brong ahafo': 'Bono',
    'brong-ahafo': 'Bono',
    'northern (pre 2022)': 'Northern',
    'volta (pre 2022)': 'Volta',
  };
  return mappings[name.toLowerCase()] || name;
};

export function RegionMapCard({ data }: RegionMapCardProps) {
  // Create a lookup object of region values
  const regionValues: Record<string, typeof data.regions[0]> = {};
  data.regions.forEach(r => {
    regionValues[normalizeRegionName(r.name)] = r;
  });
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Map className="w-5 h-5 text-primary" />
          <CardTitle className="text-base">{data.title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <svg viewBox="0 0 260 260" className="w-full max-h-[300px]">
            {/* Background */}
            <rect x="0" y="0" width="260" height="260" fill="hsl(var(--muted))" rx="8" />
            
            {/* Regions */}
            {Object.entries(REGION_PATHS).map(([name, regionPath]) => {
              const { path, center } = regionPath;
              const regionData = regionValues[name];
              const isHighlighted = regionData?.highlight ?? false;
              const color = regionData?.color || 'hsl(var(--muted-foreground) / 0.3)';
              
              return (
                <g key={name}>
                  <path
                    d={path}
                    fill={color}
                    stroke={isHighlighted ? 'hsl(var(--primary))' : 'hsl(var(--border))'}
                    strokeWidth={isHighlighted ? 2 : 1}
                    className="transition-all duration-200 hover:opacity-80"
                  />
                  <text
                    x={center[0]}
                    y={center[1]}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="text-[6px] fill-foreground font-medium pointer-events-none"
                  >
                    {name.length > 10 ? name.split(' ')[0] : name}
                  </text>
                  {regionData && (
                    <text
                      x={center[0]}
                      y={center[1] + 10}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="text-[8px] fill-foreground font-bold pointer-events-none"
                    >
                      {typeof regionData.value === 'number' ? regionData.value.toFixed(1) : regionData.value}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Legend */}
        {data.legend && data.legend.length > 0 && (
          <div className="flex flex-wrap gap-3 mt-4 justify-center">
            {data.legend.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <div 
                  className="w-3 h-3 rounded-sm" 
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-xs text-muted-foreground">{item.label}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
