import { useState } from 'react';
import { GhanaDataProvider, useGhanaData } from '@/hooks/useGhanaData';
import { ChatInterface } from '@/components/agent/ChatInterface';
import { QuickStats } from '@/components/agent/QuickStats';
import { EnhancedInteractiveMap } from '@/components/agent/EnhancedInteractiveMap';
import { ImpactCalculator } from '@/components/agent/ImpactCalculator';
import { AnomalyDashboard } from '@/components/agent/AnomalyDashboard';
import { PatientRouting } from '@/components/agent/PatientRouting';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { generateAgentResponse } from '@/lib/agentAnalysis';
import { 
  Bot, MapPin, BarChart3, Building2, 
  RefreshCw, Sparkles, Calculator, AlertTriangle,
  Navigation, Activity, Shield, Loader2, 
  Heart, Users, Globe
} from 'lucide-react';

function AgentDashboard() {
  const { isLoading, error, clearMessages, hospitals, regions } = useGhanaData();
  const [activeTab, setActiveTab] = useState('map');
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background bg-grid-subtle">
        <div className="text-center space-y-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-accent flex items-center justify-center">
              <Activity className="w-3 h-3 text-accent-foreground" />
            </div>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">Loading Healthcare Intelligence</h2>
            <p className="text-sm text-muted-foreground mt-1">Analyzing 477 facilities across 16 regions</p>
          </div>
          <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              Facilities
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              Regions
            </span>
            <span className="flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" />
              Metrics
            </span>
          </div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md glass-card">
          <CardContent className="pt-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <p className="text-destructive font-medium">Failed to load data</p>
            <p className="text-sm text-muted-foreground mt-2">{error}</p>
            <Button onClick={() => window.location.reload()} className="mt-4">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background">
      {/* Premium Header */}
      <header className="border-b bg-card/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-11 h-11 rounded-xl overflow-hidden shadow-lg">
                  <img src="/favicon.png" alt="CareConnect" className="w-full h-full object-cover" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-accent flex items-center justify-center border-2 border-background">
                  <Activity className="w-2 h-2 text-accent-foreground" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold text-foreground tracking-tight">CareConnect</h1>
                  <Badge variant="secondary" className="text-[10px] font-medium tracking-wide uppercase">
                    Intelligence
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">Ghana Healthcare Analytics Platform</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground mr-4">
                <span className="flex items-center gap-1.5">
                  <div className="status-dot status-dot-active" />
                  Live Data
                </span>
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  {hospitals.length} Facilities
                </span>
                <span className="flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" />
                  {regions.length} Regions
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={clearMessages}
                className="text-xs"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Reset
              </Button>
            </div>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Quick Stats */}
        <QuickStats />
        
        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chat Interface */}
          <div className="lg:row-span-2">
            <ChatInterface />
          </div>
          
          {/* Interactive Panels with Premium Tabs */}
          <div className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4 p-1 h-12 bg-muted/60">
                <TabsTrigger 
                  value="map" 
                  className="flex items-center gap-1.5 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Map</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="routing" 
                  className="flex items-center gap-1.5 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Routing</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="anomalies" 
                  className="flex items-center gap-1.5 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Quality</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="impact" 
                  className="flex items-center gap-1.5 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm"
                >
                  <Calculator className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Impact</span>
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="map" className="mt-4 animate-fade-in">
                <EnhancedInteractiveMap />
              </TabsContent>
              
              <TabsContent value="routing" className="mt-4 animate-fade-in">
                <PatientRouting hospitals={hospitals} regions={regions} />
              </TabsContent>
              
              <TabsContent value="anomalies" className="mt-4 animate-fade-in">
                <AnomalyDashboard hospitals={hospitals} />
              </TabsContent>
              
              <TabsContent value="impact" className="mt-4 animate-fade-in">
                <ImpactCalculator />
              </TabsContent>
            </Tabs>
          </div>
          
          {/* Quick Actions - Premium Card */}
          <Card className="glass-card-hover overflow-hidden">
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2 text-sm">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                Quick Analysis Actions
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <QuickActionButton 
                  icon={MapPin} 
                  label="Regional Overview" 
                  query="Show me regional health overview"
                  color="bg-accent/10 text-accent"
                />
                <QuickActionButton 
                  icon={Building2} 
                  label="Top Hospitals" 
                  query="Show me the top-rated hospitals"
                  color="bg-primary/10 text-primary"
                />
                <QuickActionButton 
                  icon={AlertTriangle} 
                  label="Threat Analysis" 
                  query="What are the major health threats?"
                  color="bg-warning/10 text-warning"
                />
                <QuickActionButton 
                  icon={Sparkles} 
                  label="Recommendations" 
                  query="Give me priority recommendations"
                  color="bg-success/10 text-success"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      
      {/* Premium Footer */}
      <footer className="border-t bg-muted/30 mt-12">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl overflow-hidden">
                <img src="/favicon.png" alt="CareConnect" className="w-full h-full object-cover" />
              </div>
              <div>
                <p className="font-semibold text-foreground">CareConnect Pipeline</p>
                <p className="text-xs text-muted-foreground">Ghana Healthcare Intelligence</p>
              </div>
            </div>
            
            <div className="flex items-center gap-6 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Emma Sampatata, Arturo Favivi
              </span>
              <span>HackNation 2026 Databricks Challenge</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

interface QuickActionButtonProps {
  icon: React.ElementType;
  label: string;
  query: string;
  color?: string;
}

function QuickActionButton({ icon: Icon, label, query, color = "bg-primary/10 text-primary" }: QuickActionButtonProps) {
  const { addMessage, hospitals, regions, themeSummaries, userRole } = useGhanaData();
  
  const handleClick = () => {
    addMessage({ role: 'user', content: query });
    
    setTimeout(() => {
      const response = generateAgentResponse(query, userRole, hospitals, regions, themeSummaries);
      addMessage({
        role: 'assistant',
        content: response.message,
        analysis: response.analysis,
      });
    }, 500);
  };
  
  return (
    <Button 
      variant="outline" 
      className="justify-start h-auto py-3 px-3 hover-lift border-border/50 bg-card/50" 
      onClick={handleClick}
    >
      <div className={`w-7 h-7 rounded-lg ${color} flex items-center justify-center mr-2.5`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <span className="text-xs font-medium">{label}</span>
    </Button>
  );
}

export default function Index() {
  return (
    <GhanaDataProvider>
      <AgentDashboard />
    </GhanaDataProvider>
  );
}
