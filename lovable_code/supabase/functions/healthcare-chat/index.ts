import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SYSTEM_PROMPT = `You are the Ghana Healthcare Intelligence Assistant, an expert AI analyst helping policy makers, NGOs, doctors, and patients understand healthcare data across Ghana.

## Your Knowledge Base
You have access to comprehensive healthcare data including:
- 477 healthcare facilities across 16 regions
- Regional health indicators: maternal health, child vaccination, insurance coverage, anemia rates
- Facility capability scores (1-10): medical procedures, equipment, staffing, infrastructure, accreditation, patient experience
- Threat flags: high home delivery, low immunization, high anemia, insurance gaps
- Policy metrics: maternal risk scores, staff gap proxies, NGO priority scores, composite gap scores

## Key Regional Data (from ghana_data_comprehensive.csv)
High-risk regions with composite risk flags: Ashanti, Brong Ahafo, Central, Eastern, Greater Accra, Northern, Oti, Western North, Upper East, Upper West, Volta (pre 2022)

Regions with critical maternal risk (skilled delivery <50%): Northern (pre 2022) 13.4%, Upper West 21.6%, Upper East 17.8%, Central 33.3%, Eastern 38.1%

Low immunization coverage (<50%): Ashanti 17.1%, Eastern 8.5%, Brong Ahafo 18.0%

High insurance gaps (>50% uninsured): Central 75.6%, Greater Accra 75.1%, Volta (pre 2022) 69.3%, Northern (pre 2022) 61.2%

## Your Capabilities
1. **Regional Analysis**: Population, health indicators, threat assessment, facility coverage
2. **Facility Analysis**: Capability scores, equipment, staffing, accreditation
3. **Threat Assessment**: Identify at-risk regions and root causes
4. **Recommendations**: Tailored advice for policy makers, NGOs, doctors, patients
5. **Comparisons**: Cross-regional and cross-facility analysis
6. **Medical Deserts**: Identify underserved areas
7. **Specialized Analysis**: Maternal health, child health, staffing, equipment, insurance

## Response Guidelines
- Be specific with numbers and region names
- Use bullet points for clarity
- Highlight critical issues with ⚠️
- Provide actionable recommendations with 💡
- Include relevant metrics when discussing regions
- Tailor recommendations to the user's role when specified
- When uncertain, acknowledge limitations in the data

## User Role Context
The user may specify they are a: policy_maker, ngo, doctor, patient, or general user
Adjust recommendations accordingly:
- Policy makers: Focus on resource allocation, systemic improvements, budget priorities
- NGOs: Focus on high-impact intervention areas, capacity building targets
- Doctors: Focus on staffing needs, facility capabilities, placement opportunities
- Patients: Focus on finding quality facilities, understanding options`;

// Analysis tool definition for structured output
const ANALYSIS_TOOL = {
  type: "function",
  function: {
    name: "generate_analysis",
    description: "Generate a structured analysis with visualizations when the user asks for data analysis, investment recommendations, regional comparisons, or any analytical questions. Always use this tool for questions that require data visualization or structured insights.",
    parameters: {
      type: "object",
      properties: {
        executiveSummary: {
          type: "object",
          properties: {
            title: { type: "string", description: "Short title for the analysis" },
            keyFindings: { 
              type: "array", 
              items: { type: "string" },
              description: "3-5 key findings from the analysis"
            },
            recommendation: { type: "string", description: "Primary recommendation based on analysis" },
            investmentImpact: { type: "string", description: "Expected impact of investment/intervention" },
            populationReach: { type: "number", description: "Estimated population that would be reached" },
            priorityRegions: { 
              type: "array", 
              items: { type: "string" },
              description: "Top priority regions for intervention"
            }
          },
          required: ["title", "keyFindings", "recommendation"]
        },
        mapData: {
          type: "object",
          properties: {
            title: { type: "string", description: "Map title" },
            regions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  value: { type: "number" },
                  color: { type: "string", description: "CSS color for the region based on value. Use these exact values: 'hsl(0, 84%, 60%)' for critical (red), 'hsl(25, 95%, 53%)' for low (orange), 'hsl(48, 96%, 53%)' for medium (yellow), 'hsl(142, 71%, 45%)' for good (green), 'hsl(173, 80%, 40%)' for excellent (teal)" },
                  highlight: { type: "boolean" },
                  tooltip: { type: "string" }
                },
                required: ["name", "value", "color", "highlight"]
              }
            },
            legend: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  label: { type: "string" },
                  color: { type: "string" }
                }
              }
            }
          },
          required: ["title", "regions"]
        },
        rankingTable: {
          type: "object",
          properties: {
            title: { type: "string" },
            columns: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  key: { type: "string" },
                  label: { type: "string" },
                  format: { type: "string", enum: ["number", "percent", "score", "currency"] }
                },
                required: ["key", "label"]
              }
            },
            rows: {
              type: "array",
              items: { type: "object" }
            },
            highlightTop: { type: "number", description: "Number of top rows to highlight" }
          },
          required: ["title", "columns", "rows"]
        },
        chart: {
          type: "object",
          properties: {
            title: { type: "string" },
            type: { type: "string", enum: ["bar", "line", "pie", "radar"] },
            data: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  value: { type: "number" },
                  category: { type: "string" },
                  color: { type: "string" }
                },
                required: ["name", "value"]
              }
            },
            xAxisLabel: { type: "string" },
            yAxisLabel: { type: "string" }
          },
          required: ["title", "type", "data"]
        },
        textResponse: {
          type: "string",
          description: "A brief text explanation to accompany the visualizations"
        }
      },
      required: ["executiveSummary", "textResponse"]
    }
  }
};

// Model fallback chain
const MODELS = ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'];

function isAnalysisQuery(query: string): boolean {
  const analysisKeywords = [
    'analyze', 'analysis', 'invest', 'investment', 'budget', 'allocate',
    'compare', 'comparison', 'rank', 'ranking', 'best', 'worst', 'top',
    'recommend', 'strategy', 'priority', 'prioritize', 'optimize',
    'data', 'metrics', 'statistics', 'chart', 'graph', 'visualize',
    'impact', 'reach', 'population', 'cost-effective', 'efficient'
  ];
  const lowerQuery = query.toLowerCase();
  return analysisKeywords.some(kw => lowerQuery.includes(kw));
}

async function tryWithModel(
  model: string,
  contextMessage: string,
  messages: any[],
  apiKey: string,
  useTools: boolean
): Promise<Response> {
  console.log(`Trying model: ${model}, useTools: ${useTools}`);
  
  const body: any = {
    model,
    messages: [
      { role: 'system', content: contextMessage },
      ...messages,
    ],
    temperature: 0.7,
    max_tokens: 4000,
  };

  if (useTools) {
    body.tools = [ANALYSIS_TOOL];
    body.tool_choice = { type: "function", function: { name: "generate_analysis" } };
  } else {
    body.stream = true;
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  return response;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const { messages, userRole, hospitalData, regionData } = await req.json();

    // Build context-aware system message
    let contextMessage = SYSTEM_PROMPT;
    if (userRole) {
      contextMessage += `\n\nThe user is a ${userRole.replace('_', ' ')}. Tailor your responses accordingly.`;
    }
    if (regionData) {
      contextMessage += `\n\n## Current Data Context\n${regionData}`;
    }
    if (hospitalData) {
      contextMessage += `\n\n## Hospital Data Context\n${hospitalData}`;
    }

    // Check if last user message looks like an analysis request
    const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop();
    const needsAnalysis = lastUserMessage && isAnalysisQuery(lastUserMessage.content);

    console.log(`Analysis mode: ${needsAnalysis}`);

    for (const model of MODELS) {
      const response = await tryWithModel(model, contextMessage, messages, OPENAI_API_KEY, needsAnalysis);
      
      if (response.ok) {
        console.log(`Success with model: ${model}`);
        
        if (needsAnalysis) {
          // Non-streaming response with tool call
          const result = await response.json();
          const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
          
          if (toolCall && toolCall.function?.name === 'generate_analysis') {
            try {
              const analysisData = JSON.parse(toolCall.function.arguments);
              return new Response(JSON.stringify({
                type: 'analysis',
                data: analysisData,
                text: analysisData.textResponse || '',
              }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            } catch (parseError) {
              console.error('Failed to parse tool call:', parseError);
              // Fall back to regular response
            }
          }
          
          // If tool call failed, return content as text
          const content = result.choices?.[0]?.message?.content || '';
          return new Response(JSON.stringify({ type: 'text', text: content }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } else {
          // Streaming response
          return new Response(response.body, {
            headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
          });
        }
      }
      
      const errorText = await response.text();
      console.error(`Model ${model} error:`, response.status, errorText);
      
      if (response.status === 429 || response.status === 503) {
        console.log(`Rate limited on ${model}, trying next model...`);
        await new Promise(r => setTimeout(r, 500));
        continue;
      }
      
      if (response.status === 401) {
        return new Response(JSON.stringify({ error: 'Invalid API key. Please check your OpenAI API key.' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({ error: 'AI service error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.error('All models rate limited');
    return new Response(JSON.stringify({ 
      error: 'All AI models are currently rate limited. Please try again in a moment.' 
    }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Healthcare chat error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
