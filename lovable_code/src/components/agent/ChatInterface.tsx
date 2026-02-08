import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ChatMessage, UserRole } from '@/types/ghana';
import { AnalysisOutput } from '@/types/analysis';
import { useGhanaData } from '@/hooks/useGhanaData';
import { generateAgentResponse } from '@/lib/agentAnalysis';
import { streamHealthcareChat, generateDataContext } from '@/lib/aiChat';
import { AnalysisCard } from './AnalysisCard';
import { AnalysisResultsPanel } from './analysis/AnalysisResultsPanel';
import { Send, Bot, User, Sparkles, Loader2, Zap, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

const suggestionsByRole: Record<UserRole, string[]> = {
  policy_maker: [
    "I want to invest $10M in Ghana healthcare, how can I reach the most people?",
    "Analyze regional healthcare gaps and recommend budget allocation",
    "Which regions need the most investment?",
    "Compare healthcare metrics across all regions",
    "What are the critical threats we need to address?",
    "Rank regions by intervention priority",
  ],
  ngo: [
    "Analyze where maternal health programs will have the most impact",
    "Which facilities need capacity building support?",
    "Show me medical deserts and underserved areas",
    "What immunization campaigns should we prioritize?",
    "How can we address anemia in high-risk regions?",
    "What's the most cost-effective intervention strategy?",
  ],
  doctor: [
    "Analyze where medical professionals are most needed",
    "Which hospitals have the best equipment?",
    "What regions have the worst staffing?",
    "Where can I make the biggest impact?",
    "Rank teaching hospitals by quality",
    "Analyze surgical capacity across Ghana",
  ],
  patient: [
    "What are the best hospitals in Accra?",
    "Which facilities have emergency services?",
    "Where can I get specialized care?",
    "What hospitals are well-equipped?",
    "How does healthcare vary by region?",
    "What should I know about my local hospitals?",
  ],
  general: [
    "Give me a complete analysis of Ghana healthcare",
    "Analyze the biggest health challenges by region",
    "Which regions need the most help?",
    "How do hospitals compare across regions?",
    "What progress has been made in maternal health?",
    "What investment strategy would improve healthcare the most?",
  ],
};

interface ExtendedChatMessage extends ChatMessage {
  analysisOutput?: AnalysisOutput;
}

export function ChatInterface() {
  const { hospitals, regions, themeSummaries, userRole, messages, addMessage } = useGhanaData();
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [useAI, setUseAI] = useState(true);
  const [streamingContent, setStreamingContent] = useState('');
  const [extendedMessages, setExtendedMessages] = useState<ExtendedChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const suggestions = suggestionsByRole[userRole];
  
  // Sync messages with extended messages
  useEffect(() => {
    setExtendedMessages(prev => {
      const newMessages: ExtendedChatMessage[] = messages.map(m => {
        const existing = prev.find(em => em.id === m.id);
        return existing || m;
      });
      return newMessages;
    });
  }, [messages]);
  
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [extendedMessages, streamingContent]);
  
  const handleSend = async (text?: string) => {
    const query = text || input.trim();
    if (!query || isProcessing) return;
    
    setInput('');
    setIsProcessing(true);
    setStreamingContent('');
    
    // Add user message
    addMessage({
      role: 'user',
      content: query,
    });
    
    if (useAI) {
      // Use OpenAI-powered chat with streaming
      const { hospitalData, regionData } = generateDataContext(hospitals, regions);
      
      // Build message history for context
      const messageHistory = messages.slice(-10).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));
      messageHistory.push({ role: 'user', content: query });
      
      let fullResponse = '';
      
      await streamHealthcareChat({
        messages: messageHistory,
        userRole,
        hospitalData,
        regionData,
        onDelta: (chunk) => {
          fullResponse += chunk;
          setStreamingContent(fullResponse);
        },
        onDone: () => {
          if (fullResponse) {
            addMessage({
              role: 'assistant',
              content: fullResponse,
            });
          }
          setStreamingContent('');
          setIsProcessing(false);
          inputRef.current?.focus();
        },
        onAnalysis: (analysisData: AnalysisOutput, textResponse: string) => {
          const messageId = `msg-${Date.now()}`;
          const newMessage: ExtendedChatMessage = {
            id: messageId,
            role: 'assistant',
            content: textResponse || analysisData.executiveSummary?.recommendation || 'Analysis complete.',
            timestamp: new Date(),
            analysisOutput: analysisData,
          };
          
          // Add to context messages
          addMessage({
            role: 'assistant',
            content: newMessage.content,
          });
          
          // Update extended messages with analysis
          setExtendedMessages(prev => {
            const lastIndex = prev.length - 1;
            if (lastIndex >= 0 && prev[lastIndex].role === 'assistant' && !prev[lastIndex].analysisOutput) {
              const updated = [...prev];
              updated[lastIndex] = { ...updated[lastIndex], analysisOutput: analysisData };
              return updated;
            }
            return prev;
          });
          
          setIsProcessing(false);
          inputRef.current?.focus();
        },
        onError: (error) => {
          toast.error(error);
          setIsProcessing(false);
          setStreamingContent('');
        },
      });
    } else {
      // Use local rule-based analysis
      await new Promise(r => setTimeout(r, 600));
      
      const response = generateAgentResponse(
        query,
        userRole,
        hospitals,
        regions,
        themeSummaries
      );
      
      addMessage({
        role: 'assistant',
        content: response.message,
        analysis: response.analysis,
      });
      
      setIsProcessing(false);
      inputRef.current?.focus();
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  return (
    <Card className="flex flex-col h-[700px] overflow-hidden">
      <CardHeader className="border-b bg-muted/30 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-primary/10">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Healthcare Intelligence Agent</CardTitle>
              <p className="text-xs text-muted-foreground">
                {hospitals.length} facilities • {regions.length} regions • Analysis enabled
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Label htmlFor="ai-mode" className="text-xs text-muted-foreground flex items-center gap-1">
              {useAI ? <Brain className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
              {useAI ? 'AI' : 'Fast'}
            </Label>
            <Switch
              id="ai-mode"
              checked={useAI}
              onCheckedChange={setUseAI}
              className="scale-75"
            />
          </div>
        </div>
      </CardHeader>
      
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {extendedMessages.length === 0 && !streamingContent ? (
          <div className="space-y-6">
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Ghana Healthcare Intelligence</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mt-2">
                {useAI 
                  ? "Ask me to analyze data, recommend investments, or compare regions. I'll generate visualizations with maps, charts, rankings, and executive summaries."
                  : "Using fast rule-based analysis. Switch to AI mode for full analysis with visualizations."}
              </p>
              {useAI && (
                <Badge variant="secondary" className="mt-3">
                  <Brain className="w-3 h-3 mr-1" />
                  OpenAI GPT-4 + Visualizations
                </Badge>
              )}
            </div>
            
            <div className="flex flex-wrap gap-2 justify-center">
              {suggestions.slice(0, 4).map((suggestion, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  onClick={() => handleSend(suggestion)}
                  className="text-xs"
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {extendedMessages.map((message) => (
              <div key={message.id}>
                <div className={cn(
                  'flex gap-3',
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}>
                  {message.role === 'assistant' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <div className={cn(
                    'max-w-[85%] space-y-3',
                    message.role === 'user' && 'order-first'
                  )}>
                    <div className={cn(
                      'rounded-2xl px-4 py-2.5',
                      message.role === 'user' 
                        ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                        : 'bg-muted rounded-tl-sm'
                    )}>
                      <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                    </div>
                    
                    {message.analysis && (
                      <AnalysisCard analysis={message.analysis} />
                    )}
                  </div>
                  {message.role === 'user' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
                
                {/* Analysis Visualizations Panel */}
                {message.analysisOutput && (
                  <div className="mt-4 ml-11">
                    <AnalysisResultsPanel analysis={message.analysisOutput} />
                  </div>
                )}
              </div>
            ))}
            
            {/* Streaming response */}
            {streamingContent && (
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <div className="max-w-[85%]">
                  <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-2.5">
                    <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{streamingContent}</ReactMarkdown>
                      <span className="inline-block w-2 h-4 bg-primary/50 animate-pulse ml-1" />
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {isProcessing && !streamingContent && (
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Analyzing data...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>
      
      <CardContent className="border-t pt-4 pb-4">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={useAI ? "Ask for analysis, investment recommendations, or comparisons..." : "Ask about healthcare data..."}
            disabled={isProcessing}
            className="flex-1"
          />
          <Button 
            onClick={() => handleSend()} 
            disabled={!input.trim() || isProcessing}
            size="icon"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        
        {extendedMessages.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {suggestions.slice(0, 3).map((suggestion, idx) => (
              <Badge
                key={idx}
                variant="outline"
                className="cursor-pointer hover:bg-muted text-xs"
                onClick={() => handleSend(suggestion)}
              >
                {suggestion}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
