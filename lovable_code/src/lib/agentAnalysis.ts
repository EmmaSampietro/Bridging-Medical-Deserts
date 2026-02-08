import { Hospital, Region, ThemeSummary, QueryIntent, AnalysisResult, UserRole } from '@/types/ghana';

// ============================================================================
// QUERY PARSING - Enhanced intent detection
// ============================================================================

export function parseUserQuery(query: string): QueryIntent {
  const lowerQuery = query.toLowerCase();
  
  // Detect action with more sophisticated matching
  let action: QueryIntent['action'] = 'overview';
  
  // Priority order for detection
  if (lowerQuery.includes('medical desert') || lowerQuery.includes('underserved') || lowerQuery.includes('coverage gap')) {
    action = 'medical_deserts';
  } else if (lowerQuery.includes('equipment') || lowerQuery.includes('technology') || lowerQuery.includes('device')) {
    action = 'equipment_analysis';
  } else if (lowerQuery.includes('staff') || lowerQuery.includes('doctor') || lowerQuery.includes('nurse') || lowerQuery.includes('personnel') || lowerQuery.includes('workforce')) {
    action = 'staffing_analysis';
  } else if (lowerQuery.includes('maternal') || lowerQuery.includes('pregnancy') || lowerQuery.includes('birth') || lowerQuery.includes('delivery') || lowerQuery.includes('antenatal')) {
    action = 'maternal_health';
  } else if (lowerQuery.includes('child') || lowerQuery.includes('infant') || lowerQuery.includes('pediatric') || lowerQuery.includes('vaccination') || lowerQuery.includes('immunization')) {
    action = 'child_health';
  } else if (lowerQuery.includes('insurance') || lowerQuery.includes('coverage') || lowerQuery.includes('access')) {
    action = 'insurance_analysis';
  } else if (lowerQuery.includes('capacity') || lowerQuery.includes('bed') || lowerQuery.includes('infrastructure')) {
    action = 'capacity_analysis';
  } else if (lowerQuery.includes('accredit') || lowerQuery.includes('certif') || lowerQuery.includes('quality') || lowerQuery.includes('standard')) {
    action = 'accreditation_analysis';
  } else if (lowerQuery.includes('compare') || lowerQuery.includes('versus') || lowerQuery.includes('vs') || lowerQuery.includes('difference')) {
    action = 'compare';
  } else if (lowerQuery.includes('threat') || lowerQuery.includes('risk') || lowerQuery.includes('danger') || lowerQuery.includes('crisis') || lowerQuery.includes('emergency')) {
    action = 'threats';
  } else if (lowerQuery.includes('recommend') || lowerQuery.includes('suggest') || lowerQuery.includes('should') || lowerQuery.includes('priority') || lowerQuery.includes('where to') || lowerQuery.includes('action')) {
    action = 'recommendations';
  } else if (lowerQuery.includes('rank') || lowerQuery.includes('top') || lowerQuery.includes('best') || lowerQuery.includes('worst') || lowerQuery.includes('bottom')) {
    action = 'ranking';
  } else if (lowerQuery.includes('gap') || lowerQuery.includes('missing') || lowerQuery.includes('lack') || lowerQuery.includes('need')) {
    action = 'gap_analysis';
  } else if (lowerQuery.includes('find') || lowerQuery.includes('search') || lowerQuery.includes('list') || (lowerQuery.includes('show') && lowerQuery.includes('hospital'))) {
    action = 'find_hospitals';
  } else if (lowerQuery.includes('region') || lowerQuery.includes('area') || lowerQuery.includes('district')) {
    action = 'regional_analysis';
  } else if (lowerQuery.includes('summary') || lowerQuery.includes('dashboard') || lowerQuery.includes('overview') || lowerQuery.includes('status')) {
    action = 'overview';
  } else if (lowerQuery.includes('help') || lowerQuery.includes('what can') || lowerQuery.includes('how do')) {
    action = 'help';
  }
  
  // Extract regions mentioned
  const regionNames = [
    'greater accra', 'ashanti', 'western', 'western north', 'central',
    'eastern', 'volta', 'northern', 'upper east', 'upper west',
    'bono', 'bono east', 'ahafo', 'savannah', 'northeast', 'oti'
  ];
  const regions = regionNames.filter(r => lowerQuery.includes(r));
  
  // Extract metrics mentioned
  const metrics: string[] = [];
  if (lowerQuery.includes('score')) metrics.push('score');
  if (lowerQuery.includes('population')) metrics.push('population');
  if (lowerQuery.includes('density')) metrics.push('density');
  
  return {
    action,
    regions: regions.length > 0 ? regions : undefined,
    metrics: metrics.length > 0 ? metrics : undefined,
  };
}

// ============================================================================
// ROLE CONTEXT
// ============================================================================

export function generateRoleContext(role: UserRole): string {
  const contexts = {
    policy_maker: "As a policy maker, you'll want to focus on regional disparities, resource allocation, and systemic improvements.",
    ngo: "As an NGO representative, we'll highlight areas with the highest need and greatest potential for impact.",
    doctor: "As a healthcare professional, we'll show you facility capabilities, staffing needs, and service gaps.",
    patient: "We'll help you find the most suitable healthcare facilities based on your needs.",
    general: "We'll provide comprehensive healthcare insights across all dimensions.",
  };
  return contexts[role];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculatePercentile(values: number[], percentile: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function getQuartiles(values: number[]) {
  return {
    q1: calculatePercentile(values, 25),
    median: calculatePercentile(values, 50),
    q3: calculatePercentile(values, 75),
  };
}

function correlate(x: number[], y: number[]): number {
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
  const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);
  const sumY2 = y.reduce((acc, yi) => acc + yi * yi, 0);
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  return denominator === 0 ? 0 : numerator / denominator;
}

// ============================================================================
// ANALYSIS FUNCTIONS
// ============================================================================

// Overview analysis
export function generateOverview(hospitals: Hospital[], regions: Region[]): AnalysisResult {
  const totalHospitals = hospitals.length;
  const avgScore = hospitals.reduce((acc, h) => acc + h.averageScore, 0) / totalHospitals;
  const scores = hospitals.map(h => h.averageScore);
  const quartiles = getQuartiles(scores);
  
  const criticalHospitals = hospitals.filter(h => h.averageScore < 3);
  const excellentHospitals = hospitals.filter(h => h.averageScore >= 7);
  
  const threatRegions = regions.filter(r => r.threatSanityRiskFlag);
  const lowImmunization = regions.filter(r => r.threatLowImmunization);
  const highAnemia = regions.filter(r => r.threatHighAnemia);
  
  const totalPopulation = regions.reduce((acc, r) => acc + (r.population2021 || 0), 0);
  const hospitalsPerMillion = totalHospitals / (totalPopulation / 1000000);
  
  return {
    type: 'region_overview',
    title: 'Ghana Healthcare System Overview',
    data: {
      totalHospitals,
      averageScore: Math.round(avgScore * 10) / 10,
      quartiles,
      criticalHospitals: criticalHospitals.length,
      excellentHospitals: excellentHospitals.length,
      totalRegions: regions.length,
      threatRegions: threatRegions.length,
      lowImmunizationRegions: lowImmunization.length,
      highAnemiaRegions: highAnemia.length,
      totalPopulation,
      hospitalsPerMillion: Math.round(hospitalsPerMillion * 10) / 10,
      topRegions: regions
        .filter(r => r.population2021)
        .sort((a, b) => (b.population2021 || 0) - (a.population2021 || 0))
        .slice(0, 5),
      scoreDistribution: {
        critical: hospitals.filter(h => h.averageScore <= 2).length,
        low: hospitals.filter(h => h.averageScore > 2 && h.averageScore <= 3).length,
        medium: hospitals.filter(h => h.averageScore > 3 && h.averageScore <= 5).length,
        good: hospitals.filter(h => h.averageScore > 5 && h.averageScore <= 7).length,
        excellent: hospitals.filter(h => h.averageScore > 7).length,
      },
    },
    insights: [
      `📊 **${totalHospitals} healthcare facilities** across ${regions.length} regions serving ${(totalPopulation / 1000000).toFixed(1)}M people`,
      `📈 Average capability score: **${avgScore.toFixed(1)}/10** (Median: ${quartiles.median.toFixed(1)})`,
      `🏥 ${hospitalsPerMillion.toFixed(1)} facilities per million population`,
      criticalHospitals.length > 0 ? `⚠️ **${criticalHospitals.length} facilities** (${((criticalHospitals.length/totalHospitals)*100).toFixed(1)}%) with critical scores need urgent attention` : '✅ No facilities with critical scores',
      excellentHospitals.length > 0 ? `🌟 **${excellentHospitals.length} facilities** rated excellent (7+)` : '',
      threatRegions.length > 0 ? `🚨 **${threatRegions.length} high-risk regions**: ${threatRegions.slice(0, 3).map(r => r.canonicalName).join(', ')}${threatRegions.length > 3 ? '...' : ''}` : '✅ No regions flagged as high-risk',
    ].filter(Boolean),
  };
}

// Medical Deserts Analysis
export function analyzeMedicalDeserts(hospitals: Hospital[], regions: Region[]): AnalysisResult {
  const regionData = regions
    .filter(r => r.population2021 && r.areaKm2)
    .map(r => {
      const regionHospitals = hospitals.filter(h => 
        h.region.toLowerCase().includes(r.canonicalName.toLowerCase())
      );
      const hospitalsPerCapita = regionHospitals.length / (r.population2021! / 100000);
      const avgScore = regionHospitals.length > 0 
        ? regionHospitals.reduce((acc, h) => acc + h.averageScore, 0) / regionHospitals.length 
        : 0;
      
      // Desert score: lower is worse (fewer hospitals, lower quality, larger area)
      const desertScore = hospitalsPerCapita * avgScore / Math.log(r.areaKm2! + 1);
      
      return {
        region: r.canonicalName,
        population: r.population2021!,
        area: r.areaKm2!,
        hospitalCount: regionHospitals.length,
        hospitalsPerCapita: Math.round(hospitalsPerCapita * 100) / 100,
        avgScore: Math.round(avgScore * 10) / 10,
        density: r.populationDensity || 0,
        desertScore: Math.round(desertScore * 1000) / 1000,
        isDesert: hospitalsPerCapita < 0.5 || avgScore < 3,
      };
    })
    .sort((a, b) => a.desertScore - b.desertScore);
  
  const deserts = regionData.filter(r => r.isDesert);
  const underserved = regionData.slice(0, 5);
  
  return {
    type: 'chart',
    title: 'Medical Desert Analysis',
    data: {
      regionData,
      deserts,
      underserved,
      chartData: regionData.map(r => ({
        name: r.region.length > 10 ? r.region.substring(0, 10) + '...' : r.region,
        hospitalsPerCapita: r.hospitalsPerCapita,
        avgScore: r.avgScore,
        isDesert: r.isDesert,
      })),
    },
    insights: [
      `🏜️ **${deserts.length} regions** identified as medical deserts`,
      `📍 Most underserved: **${underserved[0]?.region}** (${underserved[0]?.hospitalsPerCapita.toFixed(2)} hospitals per 100k people)`,
      `👥 Population at risk in medical deserts: **${deserts.reduce((acc, d) => acc + d.population, 0).toLocaleString()}**`,
      `📊 Average coverage nationally: ${(regionData.reduce((acc, r) => acc + r.hospitalsPerCapita, 0) / regionData.length).toFixed(2)} hospitals per 100k`,
      `🎯 Priority intervention areas: ${underserved.slice(0, 3).map(r => r.region).join(', ')}`,
      `💡 Recommendation: Focus new facility construction in ${underserved[0]?.region} and ${underserved[1]?.region}`,
    ],
  };
}

// Staffing Analysis
export function analyzeStaffing(hospitals: Hospital[], regions: Region[]): AnalysisResult {
  const staffScores = hospitals.map(h => h.staffScore).filter(s => s > 0);
  const avgStaffScore = staffScores.reduce((a, b) => a + b, 0) / staffScores.length;
  const quartiles = getQuartiles(staffScores);
  
  const understaffed = hospitals.filter(h => h.staffScore <= 3).sort((a, b) => a.staffScore - b.staffScore);
  const wellStaffed = hospitals.filter(h => h.staffScore >= 6).sort((a, b) => b.staffScore - a.staffScore);
  
  const regionStaffing = regions
    .filter(r => r.population2021)
    .map(r => {
      const regionHospitals = hospitals.filter(h => 
        h.region.toLowerCase().includes(r.canonicalName.toLowerCase())
      );
      const avgRegionStaff = regionHospitals.length > 0
        ? regionHospitals.reduce((acc, h) => acc + h.staffScore, 0) / regionHospitals.length
        : 0;
      return {
        region: r.canonicalName,
        population: r.population2021!,
        avgStaffScore: Math.round(avgRegionStaff * 10) / 10,
        staffGapProxy: r.policyStaffGapProxy,
        hospitalCount: regionHospitals.length,
        understaffedCount: regionHospitals.filter(h => h.staffScore <= 3).length,
      };
    })
    .sort((a, b) => b.staffGapProxy - a.staffGapProxy);
  
  const hospitalsWithDoctorData = hospitals.filter(h => h.numberDoctors !== undefined);
  const totalDoctors = hospitalsWithDoctorData.reduce((acc, h) => acc + (h.numberDoctors || 0), 0);
  
  return {
    type: 'chart',
    title: 'Healthcare Staffing Analysis',
    data: {
      avgStaffScore: Math.round(avgStaffScore * 10) / 10,
      quartiles,
      understaffed,
      wellStaffed,
      regionStaffing,
      totalDoctors,
      facilitiesWithData: hospitalsWithDoctorData.length,
    },
    insights: [
      `👨‍⚕️ Average staff capability score: **${avgStaffScore.toFixed(1)}/10**`,
      `⚠️ **${understaffed.length} facilities** (${((understaffed.length/hospitals.length)*100).toFixed(1)}%) critically understaffed`,
      `✅ **${wellStaffed.length} facilities** with strong staffing (6+)`,
      `📍 Highest staffing gaps: **${regionStaffing.slice(0, 3).map(r => r.region).join(', ')}**`,
      hospitalsWithDoctorData.length > 0 ? `🩺 ${totalDoctors} doctors recorded across ${hospitalsWithDoctorData.length} facilities with data` : '',
      `🎯 Priority staff deployment: ${regionStaffing[0]?.region} (${regionStaffing[0]?.understaffedCount} understaffed facilities)`,
      `💡 Recommendation: Establish training programs in ${regionStaffing.slice(0, 2).map(r => r.region).join(' and ')}`,
    ].filter(Boolean),
  };
}

// Equipment Analysis
export function analyzeEquipment(hospitals: Hospital[], regions: Region[]): AnalysisResult {
  const equipmentScores = hospitals.map(h => h.medicalEquipmentScore).filter(s => s > 0);
  const avgEquipScore = equipmentScores.reduce((a, b) => a + b, 0) / equipmentScores.length;
  
  const poorlyEquipped = hospitals.filter(h => h.medicalEquipmentScore <= 2).sort((a, b) => a.medicalEquipmentScore - b.medicalEquipmentScore);
  const wellEquipped = hospitals.filter(h => h.medicalEquipmentScore >= 5).sort((a, b) => b.medicalEquipmentScore - a.medicalEquipmentScore);
  
  const regionEquipment = regions
    .filter(r => r.population2021)
    .map(r => {
      const regionHospitals = hospitals.filter(h => 
        h.region.toLowerCase().includes(r.canonicalName.toLowerCase())
      );
      const avgEquip = regionHospitals.length > 0
        ? regionHospitals.reduce((acc, h) => acc + h.medicalEquipmentScore, 0) / regionHospitals.length
        : 0;
      return {
        region: r.canonicalName,
        avgEquipmentScore: Math.round(avgEquip * 10) / 10,
        hospitalCount: regionHospitals.length,
        poorlyEquippedCount: regionHospitals.filter(h => h.medicalEquipmentScore <= 2).length,
        wellEquippedCount: regionHospitals.filter(h => h.medicalEquipmentScore >= 5).length,
      };
    })
    .sort((a, b) => a.avgEquipmentScore - b.avgEquipmentScore);
  
  // Find facilities with specific services
  const withSurgery = hospitals.filter(h => h.onSiteServices?.toLowerCase().includes('operating'));
  const withImaging = hospitals.filter(h => h.onSiteServices?.toLowerCase().includes('imaging'));
  const withLab = hospitals.filter(h => h.onSiteServices?.toLowerCase().includes('lab'));
  const withICU = hospitals.filter(h => h.onSiteServices?.toLowerCase().includes('intensive'));
  
  return {
    type: 'chart',
    title: 'Medical Equipment Analysis',
    data: {
      avgEquipScore: Math.round(avgEquipScore * 10) / 10,
      poorlyEquipped,
      wellEquipped,
      regionEquipment,
      serviceCapabilities: {
        surgery: withSurgery.length,
        imaging: withImaging.length,
        laboratory: withLab.length,
        icu: withICU.length,
      },
    },
    insights: [
      `🔬 Average equipment score: **${avgEquipScore.toFixed(1)}/10**`,
      `⚠️ **${poorlyEquipped.length} facilities** severely lacking equipment (score ≤2)`,
      `✅ **${wellEquipped.length} facilities** well-equipped (score ≥5)`,
      `📍 Regions needing equipment investment: **${regionEquipment.slice(0, 3).map(r => r.region).join(', ')}**`,
      `🏥 Surgical capability: ${withSurgery.length} facilities | Advanced imaging: ${withImaging.length} | ICU: ${withICU.length}`,
      `💡 Equipment gap is most severe in ${regionEquipment[0]?.region} (${regionEquipment[0]?.poorlyEquippedCount} poorly equipped)`,
    ],
  };
}

// Maternal Health Analysis
export function analyzeMaternalHealth(hospitals: Hospital[], regions: Region[]): AnalysisResult {
  const maternalData = regions
    .filter(r => r.population2021)
    .map(r => ({
      region: r.canonicalName,
      population: r.population2021!,
      antenatalSkilled: r.antenatalSkilledPct,
      deliverySkilled: r.deliverySkilledPct,
      deliveryCesarean: r.deliveryCesareanPct,
      deliveryNoOne: r.deliveryNoOnePct,
      deliveryTraditional: r.deliveryTraditionalPct,
      maternalRiskScore: r.policyMaternalRiskScore,
      threatHighHomeDelivery: r.threatHighHomeDelivery,
    }))
    .sort((a, b) => b.maternalRiskScore - a.maternalRiskScore);
  
  const avgSkilledDelivery = maternalData.reduce((acc, r) => acc + r.deliverySkilled, 0) / maternalData.length;
  const avgAntenatal = maternalData.reduce((acc, r) => acc + r.antenatalSkilled, 0) / maternalData.length;
  
  const highRiskRegions = maternalData.filter(r => r.maternalRiskScore > 50);
  const homeDeliveryRisk = maternalData.filter(r => r.threatHighHomeDelivery);
  
  // Estimate affected population
  const populationAtRisk = highRiskRegions.reduce((acc, r) => acc + r.population, 0);
  
  return {
    type: 'chart',
    title: 'Maternal Health Analysis',
    data: {
      maternalData,
      avgSkilledDelivery: Math.round(avgSkilledDelivery * 10) / 10,
      avgAntenatal: Math.round(avgAntenatal * 10) / 10,
      highRiskRegions,
      homeDeliveryRisk,
      populationAtRisk,
      chartData: maternalData.map(r => ({
        name: r.region.length > 12 ? r.region.substring(0, 12) + '...' : r.region,
        skilled: r.deliverySkilled,
        cesarean: r.deliveryCesarean,
        riskScore: r.maternalRiskScore,
      })),
    },
    insights: [
      `🤰 Average skilled delivery rate: **${avgSkilledDelivery.toFixed(1)}%**`,
      `👩‍⚕️ Average antenatal care access: **${avgAntenatal.toFixed(1)}%**`,
      `⚠️ **${highRiskRegions.length} regions** with high maternal risk scores (>50)`,
      `🏠 ${homeDeliveryRisk.length} regions with dangerous home delivery rates`,
      `👥 Estimated **${(populationAtRisk / 1000000).toFixed(2)}M people** in high-risk areas`,
      `📍 Highest risk: **${maternalData[0]?.region}** (${maternalData[0]?.deliverySkilled.toFixed(1)}% skilled delivery)`,
      `💡 Priority: Establish birthing centers in ${maternalData.slice(0, 2).map(r => r.region).join(' and ')}`,
    ],
  };
}

// Child Health Analysis
export function analyzeChildHealth(hospitals: Hospital[], regions: Region[]): AnalysisResult {
  const childData = regions
    .filter(r => r.population2021)
    .map(r => ({
      region: r.canonicalName,
      population: r.population2021!,
      vaccBasic: r.childVaccBasicPct,
      vaccBcg: r.childVaccBcgPct,
      diarrhea: r.childDiarrheaPct,
      lowImmunization: r.threatLowImmunization,
    }))
    .sort((a, b) => a.vaccBasic - b.vaccBasic);
  
  const avgVaccination = childData.reduce((acc, r) => acc + r.vaccBasic, 0) / childData.length;
  const lowImmunizationRegions = childData.filter(r => r.lowImmunization);
  const highDiarrhea = childData.filter(r => r.diarrhea > 20);
  
  const populationAtRisk = lowImmunizationRegions.reduce((acc, r) => acc + r.population, 0);
  
  return {
    type: 'chart',
    title: 'Child Health Analysis',
    data: {
      childData,
      avgVaccination: Math.round(avgVaccination * 10) / 10,
      lowImmunizationRegions,
      highDiarrhea,
      populationAtRisk,
      chartData: childData.map(r => ({
        name: r.region.length > 12 ? r.region.substring(0, 12) + '...' : r.region,
        vaccination: r.vaccBasic,
        bcg: r.vaccBcg,
        diarrhea: r.diarrhea,
      })),
    },
    insights: [
      `💉 Average basic vaccination rate: **${avgVaccination.toFixed(1)}%**`,
      `⚠️ **${lowImmunizationRegions.length} regions** below 80% immunization threshold`,
      `🚰 ${highDiarrhea.length} regions with high childhood diarrhea (>20%)`,
      `👶 **${(populationAtRisk / 1000000).toFixed(2)}M people** in low-immunization areas`,
      `📍 Lowest vaccination: **${childData[0]?.region}** (${childData[0]?.vaccBasic.toFixed(1)}%)`,
      `🎯 Priority vaccination campaigns needed in: ${childData.slice(0, 3).map(r => r.region).join(', ')}`,
      `💡 Also address water/sanitation in high-diarrhea regions`,
    ],
  };
}

// Insurance & Access Analysis
export function analyzeInsurance(hospitals: Hospital[], regions: Region[]): AnalysisResult {
  const insuranceData = regions
    .filter(r => r.population2021)
    .map(r => ({
      region: r.canonicalName,
      population: r.population2021!,
      noInsurancePct: r.healthInsuranceNonePct,
      hasInsuranceGap: r.threatNoInsuranceGap,
    }))
    .sort((a, b) => b.noInsurancePct - a.noInsurancePct);
  
  const avgUninsured = insuranceData.reduce((acc, r) => acc + r.noInsurancePct, 0) / insuranceData.length;
  const criticalGaps = insuranceData.filter(r => r.hasInsuranceGap);
  const uninsuredPopulation = insuranceData.reduce((acc, r) => 
    acc + (r.population * r.noInsurancePct / 100), 0
  );
  
  return {
    type: 'chart',
    title: 'Health Insurance & Access Analysis',
    data: {
      insuranceData,
      avgUninsured: Math.round(avgUninsured * 10) / 10,
      criticalGaps,
      uninsuredPopulation,
      chartData: insuranceData.map(r => ({
        name: r.region.length > 12 ? r.region.substring(0, 12) + '...' : r.region,
        uninsured: r.noInsurancePct,
      })),
    },
    insights: [
      `📊 Average uninsured rate: **${avgUninsured.toFixed(1)}%**`,
      `⚠️ **${criticalGaps.length} regions** with critical insurance gaps (>60% uninsured)`,
      `👥 Estimated **${(uninsuredPopulation / 1000000).toFixed(2)}M people** without health insurance`,
      `📍 Highest uninsured: **${insuranceData[0]?.region}** (${insuranceData[0]?.noInsurancePct.toFixed(1)}%)`,
      `💰 Universal coverage priority regions: ${insuranceData.slice(0, 3).map(r => r.region).join(', ')}`,
      `💡 Consider community health insurance pilots in ${insuranceData[0]?.region}`,
    ],
  };
}

// Capacity Analysis
export function analyzeCapacity(hospitals: Hospital[], regions: Region[]): AnalysisResult {
  const infrastructureScores = hospitals.map(h => h.infrastructureScore).filter(s => s > 0);
  const avgInfraScore = infrastructureScores.reduce((a, b) => a + b, 0) / infrastructureScores.length;
  
  const hospitalsWithBeds = hospitals.filter(h => h.numberBeds !== undefined);
  const totalBeds = hospitalsWithBeds.reduce((acc, h) => acc + (h.numberBeds || 0), 0);
  const totalPopulation = regions.reduce((acc, r) => acc + (r.population2021 || 0), 0);
  const bedsPerThousand = (totalBeds / totalPopulation) * 1000;
  
  const lowCapacity = hospitals.filter(h => h.infrastructureScore <= 3);
  const highCapacity = hospitals.filter(h => h.infrastructureScore >= 6);
  
  const largestFacilities = hospitalsWithBeds
    .sort((a, b) => (b.numberBeds || 0) - (a.numberBeds || 0))
    .slice(0, 10);
  
  return {
    type: 'chart',
    title: 'Infrastructure & Capacity Analysis',
    data: {
      avgInfraScore: Math.round(avgInfraScore * 10) / 10,
      totalBeds,
      bedsPerThousand: Math.round(bedsPerThousand * 100) / 100,
      lowCapacity,
      highCapacity,
      largestFacilities,
    },
    insights: [
      `🏗️ Average infrastructure score: **${avgInfraScore.toFixed(1)}/10**`,
      `🛏️ Total beds recorded: **${totalBeds.toLocaleString()}** across ${hospitalsWithBeds.length} facilities with data`,
      `📊 Beds per 1,000 population: **${bedsPerThousand.toFixed(2)}** (WHO recommends 3-5)`,
      `⚠️ **${lowCapacity.length} facilities** with critical infrastructure gaps`,
      `✅ **${highCapacity.length} facilities** with strong infrastructure`,
      `🏥 Largest facility: **${largestFacilities[0]?.name}** (${largestFacilities[0]?.numberBeds} beds)`,
      `💡 Infrastructure investment needed: ${((3 - bedsPerThousand) * totalPopulation / 1000).toFixed(0)} additional beds to meet minimum WHO standards`,
    ],
  };
}

// Accreditation Analysis
export function analyzeAccreditation(hospitals: Hospital[], regions: Region[]): AnalysisResult {
  const accreditScores = hospitals.map(h => h.accreditationScore).filter(s => s > 0);
  const avgAccreditScore = accreditScores.reduce((a, b) => a + b, 0) / accreditScores.length;
  
  const unaccredited = hospitals.filter(h => h.accreditationScore <= 2);
  const accredited = hospitals.filter(h => h.accreditationScore >= 5);
  
  const publicFacilities = hospitals.filter(h => h.operatorType?.toLowerCase().includes('public'));
  const privateFacilities = hospitals.filter(h => h.operatorType?.toLowerCase().includes('private'));
  
  const avgPublicAccredit = publicFacilities.length > 0
    ? publicFacilities.reduce((acc, h) => acc + h.accreditationScore, 0) / publicFacilities.length
    : 0;
  const avgPrivateAccredit = privateFacilities.length > 0
    ? privateFacilities.reduce((acc, h) => acc + h.accreditationScore, 0) / privateFacilities.length
    : 0;
  
  return {
    type: 'chart',
    title: 'Accreditation & Quality Standards',
    data: {
      avgAccreditScore: Math.round(avgAccreditScore * 10) / 10,
      unaccredited,
      accredited,
      publicStats: {
        count: publicFacilities.length,
        avgScore: Math.round(avgPublicAccredit * 10) / 10,
      },
      privateStats: {
        count: privateFacilities.length,
        avgScore: Math.round(avgPrivateAccredit * 10) / 10,
      },
    },
    insights: [
      `⭐ Average accreditation score: **${avgAccreditScore.toFixed(1)}/10**`,
      `⚠️ **${unaccredited.length} facilities** with poor/no accreditation evidence`,
      `✅ **${accredited.length} facilities** with good accreditation standing`,
      `🏛️ Public facilities: ${publicFacilities.length} (avg score: ${avgPublicAccredit.toFixed(1)})`,
      `🏢 Private facilities: ${privateFacilities.length} (avg score: ${avgPrivateAccredit.toFixed(1)})`,
      `💡 Priority: Establish accreditation pathways for ${unaccredited.length} unaccredited facilities`,
    ],
  };
}

// Threat analysis
export function analyzeThreats(regions: Region[], hospitals: Hospital[]): AnalysisResult {
  const threatData = regions.map(r => ({
    region: r.canonicalName,
    threats: [
      r.threatHighHomeDelivery && 'High Home Delivery',
      r.threatLowImmunization && 'Low Immunization',
      r.threatHighAnemia && 'High Anemia',
      r.threatNoInsuranceGap && 'No Insurance Gap',
      r.threatSanityRiskFlag && 'Composite Risk Flag',
    ].filter(Boolean),
    maternalRisk: r.policyMaternalRiskScore,
    compositeGap: r.policyCompositeGapScore,
    population: r.population2021 || 0,
  })).filter(r => r.threats.length > 0).sort((a, b) => b.compositeGap - a.compositeGap);
  
  const criticalRegions = threatData.filter(r => r.threats.includes('Composite Risk Flag'));
  const totalAtRiskPop = threatData.reduce((acc, r) => acc + r.population, 0);
  
  // Threat frequency analysis
  const threatFrequency = {
    lowImmunization: regions.filter(r => r.threatLowImmunization).length,
    highHomeDelivery: regions.filter(r => r.threatHighHomeDelivery).length,
    highAnemia: regions.filter(r => r.threatHighAnemia).length,
    noInsurance: regions.filter(r => r.threatNoInsuranceGap).length,
    compositeRisk: regions.filter(r => r.threatSanityRiskFlag).length,
  };
  
  return {
    type: 'threat_analysis',
    title: 'Healthcare Threat Assessment',
    data: {
      threatData,
      criticalRegions,
      totalAtRiskPop,
      threatFrequency,
      regionsByThreatCount: threatData.sort((a, b) => b.threats.length - a.threats.length),
    },
    insights: [
      `🚨 **${criticalRegions.length} regions** flagged as critical (composite risk)`,
      `⚠️ **${threatData.length} regions** with at least one health threat`,
      `👥 Population at risk: **${(totalAtRiskPop / 1000000).toFixed(2)}M people**`,
      `📊 Most common threat: **Low Immunization** (${threatFrequency.lowImmunization} regions)`,
      `📍 Highest composite gap: **${threatData[0]?.region}** (score: ${threatData[0]?.compositeGap.toFixed(1)})`,
      `🎯 Regions with multiple threats: ${threatData.filter(r => r.threats.length >= 3).map(r => r.region).join(', ') || 'None'}`,
      `💡 Immediate action required in: ${criticalRegions.slice(0, 3).map(r => r.region).join(', ')}`,
    ],
  };
}

// Gap Analysis
export function analyzeGaps(hospitals: Hospital[], regions: Region[]): AnalysisResult {
  const gapCategories = [
    { name: 'Medical Procedures', scores: hospitals.map(h => h.medicalProceduresScore), key: 'procedures' },
    { name: 'Equipment', scores: hospitals.map(h => h.medicalEquipmentScore), key: 'equipment' },
    { name: 'Staffing', scores: hospitals.map(h => h.staffScore), key: 'staff' },
    { name: 'Infrastructure', scores: hospitals.map(h => h.infrastructureScore), key: 'infrastructure' },
    { name: 'Accreditation', scores: hospitals.map(h => h.accreditationScore), key: 'accreditation' },
    { name: 'Patient Experience', scores: hospitals.map(h => h.patientExperienceScore), key: 'experience' },
  ];
  
  const gapAnalysis = gapCategories.map(cat => {
    const validScores = cat.scores.filter(s => s > 0);
    const avg = validScores.reduce((a, b) => a + b, 0) / validScores.length;
    const criticalCount = cat.scores.filter(s => s <= 2).length;
    return {
      category: cat.name,
      key: cat.key,
      avgScore: Math.round(avg * 10) / 10,
      criticalCount,
      criticalPct: Math.round((criticalCount / hospitals.length) * 100),
    };
  }).sort((a, b) => a.avgScore - b.avgScore);
  
  const biggestGap = gapAnalysis[0];
  const strongestArea = gapAnalysis[gapAnalysis.length - 1];
  
  return {
    type: 'chart',
    title: 'Capability Gap Analysis',
    data: {
      gapAnalysis,
      biggestGap,
      strongestArea,
      chartData: gapAnalysis.map(g => ({
        name: g.category,
        score: g.avgScore,
        critical: g.criticalCount,
      })),
    },
    insights: [
      `📊 **Biggest capability gap: ${biggestGap.category}** (avg: ${biggestGap.avgScore}/10)`,
      `✅ **Strongest area: ${strongestArea.category}** (avg: ${strongestArea.avgScore}/10)`,
      `⚠️ ${biggestGap.criticalCount} facilities (${biggestGap.criticalPct}%) critically weak in ${biggestGap.category.toLowerCase()}`,
      ...gapAnalysis.slice(0, 3).map(g => 
        `• ${g.category}: ${g.avgScore}/10 (${g.criticalCount} critical)`
      ),
      `💡 Prioritize ${gapAnalysis.slice(0, 2).map(g => g.category.toLowerCase()).join(' and ')} interventions`,
    ],
  };
}

// Ranking Analysis
export function generateRanking(hospitals: Hospital[], regions: Region[], criteria: string = 'overall'): AnalysisResult {
  let sortedHospitals: Hospital[];
  let title = '';
  
  switch (criteria) {
    case 'equipment':
      sortedHospitals = [...hospitals].sort((a, b) => b.medicalEquipmentScore - a.medicalEquipmentScore);
      title = 'Hospitals Ranked by Equipment';
      break;
    case 'staff':
      sortedHospitals = [...hospitals].sort((a, b) => b.staffScore - a.staffScore);
      title = 'Hospitals Ranked by Staffing';
      break;
    case 'infrastructure':
      sortedHospitals = [...hospitals].sort((a, b) => b.infrastructureScore - a.infrastructureScore);
      title = 'Hospitals Ranked by Infrastructure';
      break;
    default:
      sortedHospitals = [...hospitals].sort((a, b) => b.averageScore - a.averageScore);
      title = 'Top Ranked Healthcare Facilities';
  }
  
  const top10 = sortedHospitals.slice(0, 10);
  const bottom10 = sortedHospitals.slice(-10).reverse();
  
  return {
    type: 'hospital_comparison',
    title,
    data: {
      topHospitals: top10,
      bottomHospitals: bottom10,
      hospitals: top10,
    },
    insights: [
      `🏆 **#1: ${top10[0]?.name}** (Score: ${top10[0]?.averageScore.toFixed(1)})`,
      `🥈 **#2: ${top10[1]?.name}** (Score: ${top10[1]?.averageScore.toFixed(1)})`,
      `🥉 **#3: ${top10[2]?.name}** (Score: ${top10[2]?.averageScore.toFixed(1)})`,
      `📊 Top 10 average: ${(top10.reduce((a, h) => a + h.averageScore, 0) / 10).toFixed(1)}`,
      `⚠️ Bottom performer: ${bottom10[0]?.name} (${bottom10[0]?.averageScore.toFixed(1)})`,
      `📍 Top facilities concentrated in: ${[...new Set(top10.map(h => h.region))].slice(0, 3).join(', ')}`,
    ],
  };
}

// Generate recommendations based on role
export function generateRecommendations(
  role: UserRole,
  regions: Region[],
  hospitals: Hospital[]
): AnalysisResult {
  let title = 'Strategic Recommendations';
  const recommendations: string[] = [];
  let data: any = {};
  
  if (role === 'policy_maker') {
    const priorityRegions = regions
      .filter(r => r.population2021)
      .sort((a, b) => b.policyCompositeGapScore - a.policyCompositeGapScore)
      .slice(0, 5);
    
    const staffingNeeds = regions
      .filter(r => r.population2021)
      .sort((a, b) => b.policyStaffGapProxy - a.policyStaffGapProxy)
      .slice(0, 5);
    
    const budgetAllocation = priorityRegions.map(r => ({
      region: r.canonicalName,
      share: Math.round((r.policyCompositeGapScore / priorityRegions.reduce((a, p) => a + p.policyCompositeGapScore, 0)) * 100),
    }));
    
    data = { priorityRegions, staffingNeeds, budgetAllocation };
    recommendations.push(
      `🎯 **Investment priorities** (by composite gap): ${priorityRegions.map(r => r.canonicalName).join(', ')}`,
      `👨‍⚕️ **Staff deployment targets**: ${staffingNeeds.map(r => r.canonicalName).join(', ')}`,
      `⚠️ **${regions.filter(r => r.threatSanityRiskFlag).length} regions** require emergency intervention`,
      `📊 Suggested budget allocation: ${budgetAllocation.slice(0, 3).map(b => `${b.region} (${b.share}%)`).join(', ')}`,
      `💡 **Quick wins**: Focus on immunization campaigns (cheapest intervention per life saved)`,
      `🏗️ **Infrastructure priority**: Build birthing centers in ${priorityRegions.slice(0, 2).map(r => r.canonicalName).join(' and ')}`,
    );
  } else if (role === 'ngo') {
    const maternalPriority = regions
      .filter(r => r.population2021)
      .sort((a, b) => b.policyNgoPriorityMaternal - a.policyNgoPriorityMaternal)
      .slice(0, 5);
    
    const underservedHospitals = hospitals
      .filter(h => h.averageScore < 4)
      .sort((a, b) => a.averageScore - b.averageScore)
      .slice(0, 10);
    
    const impactMetrics = {
      potentialBeneficiaries: maternalPriority.reduce((a, r) => a + (r.population2021 || 0), 0),
      facilitiesNeedingSupport: underservedHospitals.length,
      regionsWithMultipleThreats: regions.filter(r => 
        [r.threatHighHomeDelivery, r.threatLowImmunization, r.threatHighAnemia, r.threatNoInsuranceGap].filter(Boolean).length >= 2
      ).length,
    };
    
    data = { maternalPriority, underservedHospitals, impactMetrics };
    recommendations.push(
      `🤰 **Maternal health focus**: ${maternalPriority.map(r => r.canonicalName).join(', ')}`,
      `🏥 **${underservedHospitals.length} facilities** need capacity building support`,
      `💉 **Immunization campaigns**: Target ${regions.filter(r => r.threatLowImmunization).map(r => r.canonicalName).join(', ')}`,
      `🩸 **Anemia intervention** needed in: ${regions.filter(r => r.threatHighAnemia).map(r => r.canonicalName).join(', ')}`,
      `👥 **Potential beneficiaries**: ${(impactMetrics.potentialBeneficiaries / 1000000).toFixed(2)}M people`,
      `💡 **High-impact programs**: Mobile clinics, community health workers, and prenatal care kits`,
    );
  } else if (role === 'doctor') {
    const staffingGaps = regions
      .filter(r => r.population2021)
      .sort((a, b) => b.policyStaffGapProxy - a.policyStaffGapProxy)
      .slice(0, 5);
    
    const wellEquippedFacilities = hospitals
      .filter(h => h.medicalEquipmentScore >= 5)
      .sort((a, b) => b.medicalEquipmentScore - a.medicalEquipmentScore)
      .slice(0, 10);
    
    const hospitalsByType = {
      hospitals: hospitals.filter(h => h.facilityType?.toLowerCase().includes('hospital')).length,
      clinics: hospitals.filter(h => h.facilityType?.toLowerCase().includes('clinic')).length,
      other: hospitals.filter(h => !h.facilityType?.toLowerCase().includes('hospital') && !h.facilityType?.toLowerCase().includes('clinic')).length,
    };
    
    data = { staffingGaps, wellEquippedFacilities, hospitalsByType };
    recommendations.push(
      `📍 **Areas needing professionals**: ${staffingGaps.map(r => r.canonicalName).join(', ')}`,
      `🏥 **Best-equipped facilities**: ${wellEquippedFacilities.slice(0, 5).map(h => h.name).join(', ')}`,
      `⚠️ **High maternal risk** needing obstetric support: ${regions.filter(r => r.policyMaternalRiskScore > 50).map(r => r.canonicalName).join(', ')}`,
      `📊 Facility breakdown: ${hospitalsByType.hospitals} hospitals, ${hospitalsByType.clinics} clinics`,
      `💡 **Career opportunity**: Underserved regions offer higher impact and potential incentives`,
    );
  } else {
    // General or patient
    const topFacilities = hospitals
      .sort((a, b) => b.averageScore - a.averageScore)
      .slice(0, 10);
    
    const facilitiesByRegion = [...new Set(hospitals.map(h => h.region))].map(region => ({
      region,
      count: hospitals.filter(h => h.region === region).length,
      avgScore: hospitals.filter(h => h.region === region).reduce((a, h) => a + h.averageScore, 0) / hospitals.filter(h => h.region === region).length,
    })).sort((a, b) => b.avgScore - a.avgScore);
    
    data = { topFacilities, facilitiesByRegion };
    recommendations.push(
      `🏆 **Top-rated facilities**: ${topFacilities.slice(0, 5).map(h => h.name).join(', ')}`,
      `📊 **Average capability**: ${(hospitals.reduce((acc, h) => acc + h.averageScore, 0) / hospitals.length).toFixed(1)}/10`,
      `📍 **Best regions for care**: ${facilitiesByRegion.slice(0, 3).map(r => `${r.region} (${r.avgScore.toFixed(1)})`).join(', ')}`,
      `💡 For specialized care, consider facilities in Greater Accra or Ashanti regions`,
    );
  }
  
  return {
    type: 'recommendations',
    title,
    data,
    insights: recommendations,
  };
}

// Regional analysis
export function analyzeRegion(regionName: string, regions: Region[], hospitals: Hospital[]): AnalysisResult {
  const region = regions.find(r => 
    r.canonicalName.toLowerCase() === regionName.toLowerCase() ||
    r.name.toLowerCase().includes(regionName.toLowerCase())
  );
  
  const regionHospitals = hospitals.filter(h => 
    h.region.toLowerCase().includes(regionName.toLowerCase())
  );
  
  if (!region) {
    return {
      type: 'region_overview',
      title: `Region: ${regionName}`,
      data: { hospitals: regionHospitals },
      insights: [`Found ${regionHospitals.length} facilities in this area, but detailed regional data not available.`],
    };
  }
  
  const avgHospitalScore = regionHospitals.length > 0 
    ? regionHospitals.reduce((acc, h) => acc + h.averageScore, 0) / regionHospitals.length 
    : 0;
  
  const scoreBreakdown = {
    procedures: regionHospitals.reduce((a, h) => a + h.medicalProceduresScore, 0) / regionHospitals.length,
    equipment: regionHospitals.reduce((a, h) => a + h.medicalEquipmentScore, 0) / regionHospitals.length,
    staff: regionHospitals.reduce((a, h) => a + h.staffScore, 0) / regionHospitals.length,
    infrastructure: regionHospitals.reduce((a, h) => a + h.infrastructureScore, 0) / regionHospitals.length,
    accreditation: regionHospitals.reduce((a, h) => a + h.accreditationScore, 0) / regionHospitals.length,
    experience: regionHospitals.reduce((a, h) => a + h.patientExperienceScore, 0) / regionHospitals.length,
  };
  
  const threats = [
    region.threatHighHomeDelivery && 'High Home Delivery Rate',
    region.threatLowImmunization && 'Low Immunization Coverage',
    region.threatHighAnemia && 'High Anemia Prevalence',
    region.threatNoInsuranceGap && 'Insurance Coverage Gap',
    region.threatSanityRiskFlag && 'Critical Risk Flag',
  ].filter(Boolean);
  
  return {
    type: 'region_overview',
    title: `${region.canonicalName} Region Analysis`,
    data: {
      region,
      hospitals: regionHospitals,
      hospitalCount: regionHospitals.length,
      avgHospitalScore: Math.round(avgHospitalScore * 10) / 10,
      scoreBreakdown,
      threats,
    },
    insights: [
      region.population2021 ? `👥 **Population**: ${region.population2021.toLocaleString()} (${region.populationPercentage}% of Ghana)` : '',
      region.areaKm2 ? `📐 **Area**: ${region.areaKm2.toLocaleString()} km² | Density: ${region.populationDensity?.toFixed(0)}/km²` : '',
      `🏥 **${regionHospitals.length} healthcare facilities** (avg score: ${avgHospitalScore.toFixed(1)}/10)`,
      `🤰 Skilled delivery: **${region.deliverySkilledPct}%** | Antenatal: **${region.antenatalSkilledPct}%**`,
      `💉 Basic vaccination: **${region.childVaccBasicPct}%**`,
      `📊 Composite gap score: **${region.policyCompositeGapScore.toFixed(1)}** (higher = more need)`,
      threats.length > 0 ? `⚠️ **Active threats**: ${threats.join(', ')}` : '✅ No major threat flags',
    ].filter(Boolean),
  };
}

// Find hospitals based on criteria
export function findHospitals(
  hospitals: Hospital[],
  criteria: {
    minScore?: number;
    maxScore?: number;
    region?: string;
    facilityType?: string;
    limit?: number;
  }
): AnalysisResult {
  let filtered = [...hospitals];
  
  if (criteria.minScore !== undefined) {
    filtered = filtered.filter(h => h.averageScore >= criteria.minScore!);
  }
  if (criteria.maxScore !== undefined) {
    filtered = filtered.filter(h => h.averageScore <= criteria.maxScore!);
  }
  if (criteria.region) {
    filtered = filtered.filter(h => 
      h.region.toLowerCase().includes(criteria.region!.toLowerCase())
    );
  }
  if (criteria.facilityType) {
    filtered = filtered.filter(h => 
      h.facilityType?.toLowerCase().includes(criteria.facilityType!.toLowerCase())
    );
  }
  
  const sorted = filtered.sort((a, b) => b.averageScore - a.averageScore);
  const limited = sorted.slice(0, criteria.limit || 20);
  
  return {
    type: 'hospital_comparison',
    title: `Found ${filtered.length} Facilities`,
    data: {
      hospitals: limited,
      totalCount: filtered.length,
      shownCount: limited.length,
    },
    insights: [
      `🔍 **${filtered.length} facilities** match your criteria`,
      limited.length > 0 ? `🏆 Top match: **${limited[0].name}** (Score: ${limited[0].averageScore.toFixed(1)})` : '',
      limited.length > 0 ? `📊 Score range: ${limited[limited.length - 1].averageScore.toFixed(1)} - ${limited[0].averageScore.toFixed(1)}` : '',
      limited.length > 1 ? `📍 Regions represented: ${[...new Set(limited.map(h => h.region))].slice(0, 5).join(', ')}` : '',
    ].filter(Boolean),
  };
}

// ============================================================================
// MAIN AGENT RESPONSE GENERATOR
// ============================================================================

export function generateAgentResponse(
  query: string,
  role: UserRole,
  hospitals: Hospital[],
  regions: Region[],
  themeSummaries: ThemeSummary[]
): { message: string; analysis?: AnalysisResult } {
  const intent = parseUserQuery(query);
  
  let message = '';
  let analysis: AnalysisResult | undefined;
  
  switch (intent.action) {
    case 'help':
      message = `I'm your **Ghana Healthcare Intelligence Assistant**. Here's what I can analyze:

**📊 General**
• "Show me an overview" - System-wide statistics
• "What are the health threats?" - Risk assessment
• "Give me recommendations" - Role-specific action items

**🗺️ Geographic**
• "Analyze Greater Accra region" - Regional deep-dive
• "Show me medical deserts" - Underserved area mapping
• "Compare Northern and Ashanti" - Regional comparison

**🏥 Facilities**
• "Find hospitals in Kumasi" - Location search
• "Top rated facilities" - Rankings
• "Which facilities need help?" - Gap analysis

**🔬 Specialized Analysis**
• "Staff and workforce analysis" - Staffing gaps
• "Equipment assessment" - Technology gaps
• "Maternal health status" - Pregnancy & birth care
• "Child health and vaccination" - Pediatric metrics
• "Insurance coverage" - Access analysis
• "Infrastructure capacity" - Beds & facilities
• "Accreditation status" - Quality standards

${generateRoleContext(role)}`;
      break;
      
    case 'overview':
      analysis = generateOverview(hospitals, regions);
      message = `Here's a comprehensive overview of Ghana's healthcare landscape:`;
      break;
    
    case 'medical_deserts':
      analysis = analyzeMedicalDeserts(hospitals, regions);
      message = `I've identified medical deserts and underserved areas across Ghana:`;
      break;
    
    case 'staffing_analysis':
      analysis = analyzeStaffing(hospitals, regions);
      message = `Here's my analysis of healthcare workforce and staffing:`;
      break;
    
    case 'equipment_analysis':
      analysis = analyzeEquipment(hospitals, regions);
      message = `I've assessed medical equipment availability across facilities:`;
      break;
    
    case 'maternal_health':
      analysis = analyzeMaternalHealth(hospitals, regions);
      message = `Here's the maternal health situation analysis:`;
      break;
    
    case 'child_health':
      analysis = analyzeChildHealth(hospitals, regions);
      message = `I've analyzed child health and vaccination coverage:`;
      break;
    
    case 'insurance_analysis':
      analysis = analyzeInsurance(hospitals, regions);
      message = `Here's the health insurance and access analysis:`;
      break;
    
    case 'capacity_analysis':
      analysis = analyzeCapacity(hospitals, regions);
      message = `I've assessed infrastructure and capacity:`;
      break;
    
    case 'accreditation_analysis':
      analysis = analyzeAccreditation(hospitals, regions);
      message = `Here's the accreditation and quality standards analysis:`;
      break;
      
    case 'threats':
      analysis = analyzeThreats(regions, hospitals);
      message = `I've conducted a comprehensive threat assessment:`;
      break;
    
    case 'gap_analysis':
      analysis = analyzeGaps(hospitals, regions);
      message = `I've identified capability gaps across all dimensions:`;
      break;
    
    case 'ranking':
      analysis = generateRanking(hospitals, regions, 'overall');
      message = `Here are the top-ranked healthcare facilities:`;
      break;
      
    case 'recommendations':
      analysis = generateRecommendations(role, regions, hospitals);
      message = `Based on your role as a **${role.replace('_', ' ')}**, here are my strategic recommendations:`;
      break;
      
    case 'regional_analysis':
      if (intent.regions && intent.regions.length > 0) {
        analysis = analyzeRegion(intent.regions[0], regions, hospitals);
        message = `Here's my detailed analysis of the ${intent.regions[0]} region:`;
      } else {
        analysis = generateOverview(hospitals, regions);
        message = `Which region would you like to analyze? Available regions: Greater Accra, Ashanti, Northern, Western, Eastern, Central, Volta, Upper East, Upper West, Bono, Oti, Savannah, and more.`;
      }
      break;
      
    case 'find_hospitals':
      const criteria: any = { limit: 15 };
      if (intent.regions && intent.regions.length > 0) {
        criteria.region = intent.regions[0];
      }
      analysis = findHospitals(hospitals, criteria);
      message = `I found ${analysis.data.totalCount} facilities matching your criteria:`;
      break;
      
    case 'compare':
      if (intent.regions && intent.regions.length >= 2) {
        const region1 = analyzeRegion(intent.regions[0], regions, hospitals);
        const region2 = analyzeRegion(intent.regions[1], regions, hospitals);
        analysis = {
          type: 'hospital_comparison',
          title: `Comparing ${intent.regions[0]} vs ${intent.regions[1]}`,
          data: { region1: region1.data, region2: region2.data },
          insights: [
            `**${intent.regions[0].toUpperCase()}**`,
            ...region1.insights.slice(0, 4),
            '',
            `**${intent.regions[1].toUpperCase()}**`,
            ...region2.insights.slice(0, 4),
          ],
        };
        message = `Here's a comparison of the two regions:`;
      } else {
        message = `To compare regions, please mention two regions. For example: "Compare Greater Accra and Ashanti"`;
      }
      break;
      
    default:
      analysis = generateOverview(hospitals, regions);
      message = `I'll help you explore Ghana's healthcare data. Here's an overview to get started:`;
  }
  
  return { message, analysis };
}
