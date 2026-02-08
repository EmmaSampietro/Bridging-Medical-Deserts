import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { Hospital, Region, ThemeSummary, IndicatorGlossary, UserRole, ChatMessage } from '@/types/ghana';
import { loadAllData } from '@/lib/dataLoader';

interface GhanaDataContextType {
  hospitals: Hospital[];
  regions: Region[];
  themeSummaries: ThemeSummary[];
  glossary: IndicatorGlossary[];
  isLoading: boolean;
  error: string | null;
  
  // User state
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  
  // Chat state
  messages: ChatMessage[];
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;
}

const GhanaDataContext = createContext<GhanaDataContextType | undefined>(undefined);

export function GhanaDataProvider({ children }: { children: ReactNode }) {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [themeSummaries, setThemeSummaries] = useState<ThemeSummary[]>([]);
  const [glossary, setGlossary] = useState<IndicatorGlossary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('general');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const data = await loadAllData();
        setHospitals(data.hospitals);
        setRegions(data.regions);
        setThemeSummaries(data.themeSummaries);
        setGlossary(data.glossary);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  const addMessage = (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    setMessages(prev => [...prev, {
      ...message,
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    }]);
  };
  
  const clearMessages = () => {
    setMessages([]);
  };
  
  return (
    <GhanaDataContext.Provider value={{
      hospitals,
      regions,
      themeSummaries,
      glossary,
      isLoading,
      error,
      userRole,
      setUserRole,
      messages,
      addMessage,
      clearMessages,
    }}>
      {children}
    </GhanaDataContext.Provider>
  );
}

export function useGhanaData() {
  const context = useContext(GhanaDataContext);
  if (!context) {
    throw new Error('useGhanaData must be used within GhanaDataProvider');
  }
  return context;
}
