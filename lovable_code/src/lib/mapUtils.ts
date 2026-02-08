import { Hospital, getOverallScore, getScoreLevel } from '@/types/hospital';

// Ghana bounding box and center
export const GHANA_CENTER: [number, number] = [7.9465, -1.0232];
export const GHANA_BOUNDS: [[number, number], [number, number]] = [
  [4.5, -3.5], // Southwest corner
  [11.5, 1.5], // Northeast corner
];

// Known Ghana city coordinates for approximate hospital locations
const GHANA_CITIES: Record<string, [number, number]> = {
  'accra': [5.6037, -0.1870],
  'kumasi': [6.6885, -1.6244],
  'tamale': [9.4034, -0.8424],
  'takoradi': [4.8845, -1.7554],
  'sekondi': [4.9340, -1.7137],
  'cape coast': [5.1315, -1.2795],
  'koforidua': [6.0940, -0.2574],
  'sunyani': [7.3349, -2.3123],
  'ho': [6.6000, 0.4700],
  'wa': [10.0601, -2.5099],
  'bolgatanga': [10.7855, -0.8514],
  'techiman': [7.5833, -1.9333],
  'tema': [5.6698, -0.0166],
  'obuasi': [6.2000, -1.6667],
  'teshie': [5.5833, -0.1000],
  'madina': [5.6772, -0.1647],
  'bibiani': [6.4667, -2.3333],
  'bimbilla': [8.8576, -0.0556],
  'northern': [9.5, -1.0],
  'ashanti': [6.75, -1.5],
  'greater accra': [5.6, -0.2],
  'western': [5.0, -2.0],
  'eastern': [6.5, -0.5],
  'volta': [6.8, 0.5],
  'central': [5.5, -1.2],
  'brong ahafo': [7.5, -2.0],
  'upper east': [10.7, -0.8],
  'upper west': [10.3, -2.3],
};

// Extract coordinates from hospital address/city
export function getHospitalCoordinates(hospital: Hospital): [number, number] | null {
  const address = hospital.identity.address.toLowerCase();
  const name = hospital.name.toLowerCase();
  
  // Try to find matching city in address
  for (const [city, coords] of Object.entries(GHANA_CITIES)) {
    if (address.includes(city) || name.includes(city)) {
      // Add slight random offset to prevent marker overlap
      return [
        coords[0] + (Math.random() - 0.5) * 0.02,
        coords[1] + (Math.random() - 0.5) * 0.02,
      ];
    }
  }
  
  // Try to match region names
  for (const [region, coords] of Object.entries(GHANA_CITIES)) {
    if (address.includes(region)) {
      return [
        coords[0] + (Math.random() - 0.5) * 0.1,
        coords[1] + (Math.random() - 0.5) * 0.1,
      ];
    }
  }
  
  // Default to Ghana center with random offset if no match
  return [
    GHANA_CENTER[0] + (Math.random() - 0.5) * 2,
    GHANA_CENTER[1] + (Math.random() - 0.5) * 2,
  ];
}

// Generate Google Maps search URL for a hospital
export function getGoogleMapsUrl(hospital: Hospital): string {
  const query = encodeURIComponent(`${hospital.name}, ${hospital.identity.address}, Ghana`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

// Get marker color based on score
export function getMarkerColor(score: number): string {
  const level = getScoreLevel(score);
  const colors = {
    critical: '#ef4444', // red
    low: '#f97316', // orange
    medium: '#eab308', // yellow
    good: '#22c55e', // green
    excellent: '#14b8a6', // teal
  };
  return colors[level];
}

// Hospital with coordinates for mapping
export interface MappableHospital extends Hospital {
  coordinates: [number, number];
  googleMapsUrl: string;
}

export function prepareMappableHospitals(hospitals: Hospital[]): MappableHospital[] {
  return hospitals
    .map((hospital) => {
      const coordinates = getHospitalCoordinates(hospital);
      return coordinates
        ? {
            ...hospital,
            coordinates,
            googleMapsUrl: getGoogleMapsUrl(hospital),
          }
        : null;
    })
    .filter((h): h is MappableHospital => h !== null);
}
