import { Hospital, HospitalSource, CapabilityScore } from '@/types/hospital';

function parseJSON<T>(value: string): T | null {
  try {
    // Handle escaped JSON strings
    const cleaned = value.replace(/^"|"$/g, '').replace(/\\"/g, '"');
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function parseSources(value: string): HospitalSource[] {
  if (!value || value === '[]') return [];
  try {
    const parsed = JSON.parse(value.replace(/\\"/g, '"'));
    if (Array.isArray(parsed)) {
      return parsed.map((s: any) => ({
        url: s.url || '',
        source_type: s.source_type || 'Unknown',
        supports: s.supports || '',
      }));
    }
  } catch {
    // If parsing fails, return empty array
  }
  return [];
}

function parseUncertainties(value: string): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value.replace(/\\"/g, '"'));
    if (Array.isArray(parsed)) {
      return parsed.filter((s: any) => typeof s === 'string');
    }
  } catch {
    // Try splitting by comma if not valid JSON
    return value.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

function createCapabilityScore(
  score: string,
  explanation: string,
  evidenceGaps: string,
  sources: string
): CapabilityScore {
  return {
    score: parseInt(score) || 0,
    explanation: explanation || 'No explanation provided',
    evidence_gaps: evidenceGaps || 'No evidence gaps identified',
    sources: parseSources(sources),
  };
}

export function parseHospitalCSV(csvContent: string): Hospital[] {
  const lines = csvContent.split('\n');
  if (lines.length < 2) {
    throw new Error('CSV file must have a header row and at least one data row');
  }

  const headers = parseCSVLine(lines[0]);
  const hospitals: Hospital[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      const values = parseCSVLine(line);
      const row: Record<string, string> = {};
      
      headers.forEach((header, index) => {
        row[header.trim()] = values[index] || '';
      });

      const hospital: Hospital = {
        id: row['hospital_identity_unique_id'] || `hospital-${i}`,
        name: row['hospital'] || row['hospital_identity_name'] || 'Unknown Hospital',
        identity: {
          name: row['hospital_identity_name'] || row['hospital'] || 'Unknown',
          unique_id: row['hospital_identity_unique_id'] || `hospital-${i}`,
          address: row['hospital_identity_address'] || 'Address not available',
          country: row['hospital_identity_country'] || 'Unknown',
          organization_type: row['hospital_identity_organization_type'] || 'facility',
        },
        rawData: row['hospital_data'] || '',
        
        medicalProcedures: createCapabilityScore(
          row['medical_procedures_score'],
          row['medical_procedures_explanation'],
          row['medical_procedures_evidence_gaps'],
          row['medical_procedures_sources']
        ),
        
        medicalEquipment: createCapabilityScore(
          row['medical_equipment_score'],
          row['medical_equipment_explanation'],
          row['medical_equipment_evidence_gaps'],
          row['medical_equipment_sources']
        ),
        
        staffAndHumanCapital: createCapabilityScore(
          row['staff_and_human_capital_score'],
          row['staff_and_human_capital_explanation'],
          row['staff_and_human_capital_evidence_gaps'],
          row['staff_and_human_capital_sources']
        ),
        
        infrastructureAndCapacity: createCapabilityScore(
          row['infrastructure_and_capacity_score'],
          row['infrastructure_and_capacity_explanation'],
          row['infrastructure_and_capacity_evidence_gaps'],
          row['infrastructure_and_capacity_sources']
        ),
        
        accreditationAndRegulation: createCapabilityScore(
          row['accreditation_and_regulation_score'],
          row['accreditation_and_regulation_explanation'],
          row['accreditation_and_regulation_evidence_gaps'],
          row['accreditation_and_regulation_sources']
        ),
        
        patientExperienceAndReputation: createCapabilityScore(
          row['patient_experience_and_reputation_score'],
          row['patient_experience_and_reputation_explanation'],
          row['patient_experience_and_reputation_evidence_gaps'],
          row['patient_experience_and_reputation_sources']
        ),
        
        overallConfidenceSummary: row['overall_confidence_summary'] || 'No summary available',
        keyUncertainties: parseUncertainties(row['key_uncertainties']),
        recommendedNextDataSources: parseUncertainties(row['recommended_next_data_sources']),
      };

      hospitals.push(hospital);
    } catch (error) {
      console.error(`Error parsing row ${i}:`, error);
      // Continue with other rows
    }
  }

  return hospitals;
}

// Handle CSV with quoted fields that may contain commas
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
    i++;
  }
  
  result.push(current);
  return result;
}

export function filterHospitals(
  hospitals: Hospital[],
  filters: {
    searchQuery?: string;
    country?: string;
    minScore?: number;
  }
): Hospital[] {
  return hospitals.filter(hospital => {
    // Search query filter
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const matchesName = hospital.name.toLowerCase().includes(query);
      const matchesAddress = hospital.identity.address.toLowerCase().includes(query);
      const matchesCountry = hospital.identity.country.toLowerCase().includes(query);
      if (!matchesName && !matchesAddress && !matchesCountry) {
        return false;
      }
    }

    // Country filter
    if (filters.country && hospital.identity.country !== filters.country) {
      return false;
    }

    // Min score filter
    if (filters.minScore) {
      const avgScore = (
        hospital.medicalProcedures.score +
        hospital.medicalEquipment.score +
        hospital.staffAndHumanCapital.score +
        hospital.infrastructureAndCapacity.score +
        hospital.accreditationAndRegulation.score +
        hospital.patientExperienceAndReputation.score
      ) / 6;
      if (avgScore < filters.minScore) {
        return false;
      }
    }

    return true;
  });
}

export function getUniqueCountries(hospitals: Hospital[]): string[] {
  const countries = new Set<string>();
  hospitals.forEach(h => {
    if (h.identity.country) {
      countries.add(h.identity.country);
    }
  });
  return Array.from(countries).sort();
}
