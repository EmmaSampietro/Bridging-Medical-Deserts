import { Hospital, Region, ThemeSummary, IndicatorGlossary } from '@/types/ghana';

// Parse CSV line handling quoted fields
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
    i++;
  }
  result.push(current.trim());
  return result;
}

// Parse full CSV to array of records
function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  
  const headers = parseCSVLine(lines[0]);
  const records: Record<string, string>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const record: Record<string, string> = {};
    headers.forEach((h, idx) => {
      record[h.trim()] = values[idx] || '';
    });
    records.push(record);
  }
  
  return records;
}

// Extract region from address
function extractRegion(address: string, hospitalData: string): string {
  const allText = `${address} ${hospitalData}`.toLowerCase();
  
  const regions = [
    'greater accra', 'ashanti', 'western', 'western north', 'central',
    'eastern', 'volta', 'northern', 'upper east', 'upper west',
    'bono', 'bono east', 'ahafo', 'savannah', 'northeast', 'oti'
  ];
  
  for (const region of regions) {
    if (allText.includes(region)) {
      return region.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }
  
  // Try city matching
  const cityToRegion: Record<string, string> = {
    'accra': 'Greater Accra',
    'tema': 'Greater Accra',
    'kumasi': 'Ashanti',
    'takoradi': 'Western',
    'sekondi': 'Western',
    'cape coast': 'Central',
    'tamale': 'Northern',
    'sunyani': 'Bono',
    'ho': 'Volta',
    'koforidua': 'Eastern',
    'bolgatanga': 'Upper East',
    'wa': 'Upper West',
  };
  
  for (const [city, region] of Object.entries(cityToRegion)) {
    if (allText.includes(city)) {
      return region;
    }
  }
  
  return 'Unknown';
}

// Parse uncertainties JSON
function parseUncertainties(value: string): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value.replace(/\\"/g, '"'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return value.split(',').map(s => s.trim()).filter(Boolean);
  }
}

export async function loadHospitals(): Promise<Hospital[]> {
  const response = await fetch('/data/hospitals.csv');
  const content = await response.text();
  const records = parseCSV(content);
  
  return records.map((r, idx) => {
    const medicalScore = parseFloat(r.medical_procedures_score) || 0;
    const equipmentScore = parseFloat(r.medical_equipment_score) || 0;
    const staffScore = parseFloat(r.staff_and_human_capital_score) || 0;
    const infraScore = parseFloat(r.infrastructure_and_capacity_score) || 0;
    const accreditScore = parseFloat(r.accreditation_and_regulation_score) || 0;
    const patientScore = parseFloat(r.patient_experience_and_reputation_score) || 0;
    
    const scores = [medicalScore, equipmentScore, staffScore, infraScore, accreditScore, patientScore].filter(s => s > 0);
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    
    return {
      id: r.hospital_identity_unique_id || `hospital-${idx}`,
      name: r.hospital_identity_name || r.hospital || r.name || 'Unknown',
      inAgentOutput: r.in_agent_output === '1',
      inCategories: r.in_categories === '1',
      address: r.hospital_identity_address || '',
      country: r.hospital_identity_country || 'Ghana',
      organizationType: r.hospital_identity_organization_type || 'facility',
      facilityType: r.facility_type || undefined,
      operatorType: r.operator_type || undefined,
      affiliation: r.affiliation || undefined,
      
      medicalProceduresScore: medicalScore,
      medicalProceduresExplanation: r.medical_procedures_explanation || '',
      medicalEquipmentScore: equipmentScore,
      medicalEquipmentExplanation: r.medical_equipment_explanation || '',
      staffScore: staffScore,
      staffExplanation: r.staff_and_human_capital_explanation || '',
      infrastructureScore: infraScore,
      infrastructureExplanation: r.infrastructure_and_capacity_explanation || '',
      accreditationScore: accreditScore,
      accreditationExplanation: r.accreditation_and_regulation_explanation || '',
      patientExperienceScore: patientScore,
      patientExperienceExplanation: r.patient_experience_and_reputation_explanation || '',
      
      numberDoctors: r.number_doctors ? parseFloat(r.number_doctors) : undefined,
      numberBeds: r.number_beds ? parseFloat(r.number_beds) : undefined,
      onSiteServices: r.on_site_services || undefined,
      
      overallConfidenceSummary: r.overall_confidence_summary || '',
      keyUncertainties: parseUncertainties(r.key_uncertainties),
      
      region: extractRegion(r.hospital_identity_address || '', r.hospital_data || ''),
      averageScore: Math.round(avgScore * 10) / 10,
    };
  });
}

export async function loadRegions(): Promise<Region[]> {
  const response = await fetch('/data/ghana_data_comprehensive.csv');
  const content = await response.text();
  const records = parseCSV(content);
  
  return records.map(r => ({
    name: r.region_name || '',
    canonicalName: r.region_name_canonical || r.region_name || '',
    population2021: r.region_population_2021 ? parseFloat(r.region_population_2021) : undefined,
    areaKm2: r.region_area_km2 ? parseFloat(r.region_area_km2) : undefined,
    populationDensity: r.population_density_2021_per_km2 ? parseFloat(r.population_density_2021_per_km2) : undefined,
    populationPercentage: r.region_population_percentage_2021 ? parseFloat(r.region_population_percentage_2021) : undefined,
    
    healthInsuranceNonePct: parseFloat(r.health_insurance_women_none_pct) || 0,
    anemiaWomenAnyPct: parseFloat(r.anemia_women_any_pct) || 0,
    anemiaWomenSeverePct: parseFloat(r.anemia_women_severe_pct) || 0,
    childDiarrheaPct: parseFloat(r.child_diarrhea_pct) || 0,
    childVaccBasicPct: parseFloat(r.child_vacc_basic_pct) || 0,
    childVaccBcgPct: parseFloat(r.child_vacc_bcg_pct) || 0,
    antenatalSkilledPct: parseFloat(r.antenatal_skilled_pct) || 0,
    deliveryCesareanPct: parseFloat(r.delivery_cesarean_pct) || 0,
    deliveryNoOnePct: parseFloat(r.delivery_no_one_pct) || 0,
    deliverySkilledPct: parseFloat(r.delivery_skilled_pct) || 0,
    deliveryTraditionalPct: parseFloat(r.delivery_traditional_attendant_pct) || 0,
    
    policyMaternalRiskScore: parseFloat(r.policy_maternal_risk_score) || 0,
    policyStaffGapProxy: parseFloat(r.policy_staff_gap_proxy) || 0,
    policyNgoPriorityMaternal: parseFloat(r.policy_ngo_priority_maternal) || 0,
    policyCompositeGapScore: parseFloat(r.policy_composite_gap_score) || 0,
    
    threatHighHomeDelivery: r.threat_high_home_delivery === '1',
    threatLowImmunization: r.threat_low_immunization === '1',
    threatHighAnemia: r.threat_high_anemia === '1',
    threatNoInsuranceGap: r.threat_no_insurance_gap === '1',
    threatSanityRiskFlag: r.threat_sanity_risk_flag === '1',
  }));
}

export async function loadThemeSummaries(): Promise<ThemeSummary[]> {
  const response = await fetch('/data/ghana_data_theme_summary.csv');
  const content = await response.text();
  const records = parseCSV(content);
  
  return records.map(r => ({
    regionName: r.region_name || '',
    sourceTheme: r.source_theme || '',
    indicatorCount: parseInt(r.indicator_count) || 0,
    meanValue: parseFloat(r.mean_value) || 0,
    minValue: parseFloat(r.min_value) || 0,
    maxValue: parseFloat(r.max_value) || 0,
  }));
}

export async function loadIndicatorGlossary(): Promise<IndicatorGlossary[]> {
  const response = await fetch('/data/ghana_data_indicator_glossary.csv');
  const content = await response.text();
  const records = parseCSV(content);
  
  return records.map(r => ({
    code: r.indicator_code || '',
    name: r.indicator_name || '',
    theme: r.source_theme || '',
  }));
}

// Load all data at once
export async function loadAllData() {
  const [hospitals, regions, themeSummaries, glossary] = await Promise.all([
    loadHospitals(),
    loadRegions(),
    loadThemeSummaries(),
    loadIndicatorGlossary(),
  ]);
  
  return { hospitals, regions, themeSummaries, glossary };
}
