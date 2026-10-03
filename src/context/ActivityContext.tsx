import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { CheckCircle2, AlertCircle, Sparkles, X } from 'lucide-react';
import { logSupabaseActivity, fetchSupabaseActivityLogs } from '../services/supabaseService';

export interface ActivityItem {
  id: string;
  title: string;
  type: 'success' | 'error' | 'info';
  timestamp: string;
}

export interface FlashCardNotification {
  id: string;
  title: string;
  type: 'success' | 'error' | 'info';
}

interface ActivityContextType {
  activities: ActivityItem[];
  flashCard: FlashCardNotification | null;
  addActivity: (title: string, type?: 'success' | 'error' | 'info') => void;
  showFlashCard: (title: string, type?: 'success' | 'error' | 'info') => void;
  clearActivities: () => void;
  setUserScope: (userId: string) => void;
}

const ActivityContext = createContext<ActivityContextType | undefined>(undefined);

let _globalActivityUserId = 'default';

export function setActivityUserScope(userId: string | null | undefined): void {
  _globalActivityUserId = userId && userId.trim() ? userId.trim() : 'default';
}

export const ActivityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activities, setActivities] = useState<ActivityItem[]>([
    {
      id: '1',
      title: 'Instagram Graph Automation workspace ready',
      type: 'info',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [flashCard, setFlashCard] = useState<FlashCardNotification | null>(null);
  const [activeUserId, setActiveUserId] = useState<string>('default');

  const setUserScope = (userId: string) => {
    if (!userId || userId === activeUserId) return;
    setActiveUserId(userId);
    _globalActivityUserId = userId;

    if (userId !== 'default') {
      fetchSupabaseActivityLogs(userId)
        .then(logs => {
          if (Array.isArray(logs) && logs.length > 0) {
            setActivities(logs);
          }
        })
        .catch(console.warn);
    }
  };

  const addActivity = (title: string, type: 'success' | 'error' | 'info' = 'info') => {
    const item: ActivityItem = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 4),
      title,
      type,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setActivities(prev => [item, ...prev].slice(0, 30));
    setFlashCard({ id: item.id, title, type });

    // Store activity log in Supabase DB for this user
    const currentId = activeUserId !== 'default' ? activeUserId : _globalActivityUserId;
    if (currentId && currentId !== 'default') {
      logSupabaseActivity(currentId, title, type).catch(console.warn);
    }

    setTimeout(() => {
      setFlashCard(current => (current?.id === item.id ? null : current));
    }, 3500);
  };

  const showFlashCard = (title: string, type: 'success' | 'error' | 'info' = 'info') => {
    addActivity(title, type);
  };

  const clearActivities = () => {
    setActivities([]);
  };

  return (
    <ActivityContext.Provider value={{ activities, flashCard, addActivity, showFlashCard, clearActivities, setUserScope }}>
      {children}
      {/* Global Animated Flash Card / Toast Component (Mobile-Responsive) */}
      {flashCard && (
        <div className="fixed top-3 inset-x-3 sm:inset-x-auto sm:top-5 sm:right-5 sm:w-full sm:max-w-md z-50 animate-pop-in p-3 sm:p-4 bg-white border-3 sm:border-4 border-slateDark rounded-2xl shadow-[4px_4px_0_#1E293B] sm:shadow-pop-lg flex items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <div className={`p-2 rounded-xl border-2 border-slateDark shrink-0 ${
              flashCard.type === 'success' ? 'bg-emerald-200 text-emerald-900' :
              flashCard.type === 'error' ? 'bg-rose-200 text-rose-900' :
              'bg-violet-200 text-violet-900'
            }`}>
              {flashCard.type === 'success' && <CheckCircle2 size={18} className="sm:w-5 sm:h-5" />}
              {flashCard.type === 'error' && <AlertCircle size={18} className="sm:w-5 sm:h-5" />}
              {flashCard.type === 'info' && <Sparkles size={18} className="sm:w-5 sm:h-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-heading text-[10px] sm:text-xs font-black text-slateDark uppercase tracking-wider">
                {flashCard.type === 'success' ? 'Success Flash' : flashCard.type === 'error' ? 'Alert Flash' : 'System Activity'}
              </h4>
              <p className="text-xs font-semibold text-slate-700 mt-0.5 break-words line-clamp-2 leading-tight">{flashCard.title}</p>
            </div>
          </div>
          <button
            onClick={() => setFlashCard(null)}
            className="p-1.5 text-slate-400 hover:text-slateDark rounded-lg border border-transparent hover:border-slateDark shrink-0 touch-manipulation cursor-pointer"
            aria-label="Close notification"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </ActivityContext.Provider>
  );
};

export function useActivity() {
  const context = useContext(ActivityContext);
  if (!context) {
    throw new Error('useActivity must be used within ActivityProvider');
  }
  return context;
}
