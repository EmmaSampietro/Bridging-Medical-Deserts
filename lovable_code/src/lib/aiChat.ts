import { Hospital, Region } from '@/types/ghana';
import { AnalysisOutput } from '@/types/analysis';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/healthcare-chat`;

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface StreamChatOptions {
  messages: Message[];
  userRole: string;
  hospitalData?: string;
  regionData?: string;
  onDelta: (text: string) => void;
  onDone: () => void;
  onAnalysis?: (analysis: AnalysisOutput, text: string) => void;
  onError: (error: string) => void;
}

export async function streamHealthcareChat({
  messages,
  userRole,
  hospitalData,
  regionData,
  onDelta,
  onDone,
  onAnalysis,
  onError,
}: StreamChatOptions) {
  // Default no-op for onAnalysis if not provided
  const handleAnalysis = onAnalysis || ((analysis: AnalysisOutput, text: string) => {
    // If no onAnalysis handler, just emit the text via onDelta
    onDelta(text || analysis.executiveSummary?.recommendation || 'Analysis complete.');
  });
  try {
    const response = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ 
        messages, 
        userRole,
        hospitalData,
        regionData,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
      onError(errorData.error || `Error: ${response.status}`);
      return;
    }

    const contentType = response.headers.get('Content-Type') || '';
    
    // Check if it's a JSON response (analysis) or streaming
    if (contentType.includes('application/json')) {
      const result = await response.json();
      
      if (result.type === 'analysis' && result.data) {
        handleAnalysis(result.data as AnalysisOutput, result.text || '');
        onDone();
        return;
      } else if (result.type === 'text') {
        onDelta(result.text);
        onDone();
        return;
      } else if (result.error) {
        onError(result.error);
        return;
      }
    }

    // Handle streaming response
    if (!response.body) {
      onError('No response stream');
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete lines
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        let line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);

        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (line.startsWith(':') || line.trim() === '') continue;
        if (!line.startsWith('data: ')) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') {
          onDone();
          return;
        }

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) onDelta(content);
        } catch {
          // Partial JSON, put back and wait for more
          buffer = line + '\n' + buffer;
          break;
        }
      }
    }

    // Flush remaining buffer
    if (buffer.trim()) {
      for (let raw of buffer.split('\n')) {
        if (!raw || raw.startsWith(':')) continue;
        if (!raw.startsWith('data: ')) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) onDelta(content);
        } catch {}
      }
    }

    onDone();
  } catch (error) {
    console.error('Stream chat error:', error);
    onError(error instanceof Error ? error.message : 'Connection failed');
  }
}

// Generate data context for the AI
export function generateDataContext(hospitals: Hospital[], regions: Region[]): { hospitalData: string; regionData: string } {
  // Summarize hospital data
  const hospitalsByRegion = hospitals.reduce((acc, h) => {
    acc[h.region] = (acc[h.region] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const avgScores = {
    overall: (hospitals.reduce((a, h) => a + h.averageScore, 0) / hospitals.length).toFixed(1),
    equipment: (hospitals.reduce((a, h) => a + h.medicalEquipmentScore, 0) / hospitals.length).toFixed(1),
    staff: (hospitals.reduce((a, h) => a + h.staffScore, 0) / hospitals.length).toFixed(1),
  };
  
  const topHospitals = [...hospitals]
    .sort((a, b) => b.averageScore - a.averageScore)
    .slice(0, 10)
    .map(h => `${h.name} (${h.region}): ${h.averageScore.toFixed(1)}`)
    .join('\n');
    
  const bottomHospitals = [...hospitals]
    .sort((a, b) => a.averageScore - b.averageScore)
    .slice(0, 5)
    .map(h => `${h.name} (${h.region}): ${h.averageScore.toFixed(1)}`)
    .join('\n');

  const hospitalData = `
Total facilities: ${hospitals.length}
Distribution by region: ${Object.entries(hospitalsByRegion).map(([r, c]) => `${r}: ${c}`).join(', ')}

Average scores:
- Overall: ${avgScores.overall}/10
- Equipment: ${avgScores.equipment}/10
- Staffing: ${avgScores.staff}/10

Top 10 facilities:
${topHospitals}

Bottom 5 facilities needing attention:
${bottomHospitals}
`.trim();

  // Summarize region data
  const regionSummaries = regions
    .filter(r => r.population2021)
    .map(r => {
      const threats = [
        r.threatHighHomeDelivery && 'high_home_delivery',
        r.threatLowImmunization && 'low_immunization',
        r.threatHighAnemia && 'high_anemia',
        r.threatNoInsuranceGap && 'no_insurance',
        r.threatSanityRiskFlag && 'CRITICAL',
      ].filter(Boolean);
      
      return `${r.canonicalName}: Pop ${(r.population2021! / 1000000).toFixed(2)}M, Skilled delivery ${r.deliverySkilledPct}%, Vaccination ${r.childVaccBasicPct}%, Gap score ${r.policyCompositeGapScore.toFixed(1)}, Threats: ${threats.join(', ') || 'none'}`;
    })
    .join('\n');

  const regionData = `
Regions with data (${regions.filter(r => r.population2021).length}):
${regionSummaries}
`.trim();

  return { hospitalData, regionData };
}
