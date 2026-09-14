import React, { useState, useEffect } from 'react';
import { ApiConfig, GrowthStrategyProfile } from '../../types/instagram';
import { HashtagGeneratorView } from './HashtagGeneratorView';
import { HashtagScannerView } from './HashtagScannerView';
import { Hash, Sparkles, Search, Layers } from 'lucide-react';

interface HashtagHubViewProps {
  config: ApiConfig;
  profile?: GrowthStrategyProfile | null;
  onOpenStrategyModal?: () => void;
  activeSubTab?: 'generator' | 'scanner';
  onSubTabChange?: (tab: 'generator' | 'scanner') => void;
  userId?: string;
}

export const HashtagHubView: React.FC<HashtagHubViewProps> = ({
  config,
  profile,
  onOpenStrategyModal,
  activeSubTab = 'generator',
  onSubTabChange,
  userId,
}) => {
  const [subTab, setSubTab] = useState<'generator' | 'scanner'>(activeSubTab);

  useEffect(() => {
    if (activeSubTab) {
      setSubTab(activeSubTab);
    }
  }, [activeSubTab]);

  const handleSelectTab = (tab: 'generator' | 'scanner') => {
    setSubTab(tab);
    if (onSubTabChange) {
      onSubTabChange(tab);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-Tab Switcher Bar */}
      <div className="bg-white border-2 border-slateDark rounded-2xl p-2 shadow-pop-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => handleSelectTab('generator')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-heading font-black border-2 transition-all cursor-pointer ${
              subTab === 'generator'
                ? 'bg-yellowPop text-slateDark border-slateDark shadow-pop-sm'
                : 'bg-slate-50 text-slate-600 border-transparent hover:border-slate-300'
            }`}
          >
            <Sparkles size={16} />
            <span>Niche Hashtag Generator</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectTab('scanner')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-heading font-black border-2 transition-all cursor-pointer ${
              subTab === 'scanner'
                ? 'bg-yellowPop text-slateDark border-slateDark shadow-pop-sm'
                : 'bg-slate-50 text-slate-600 border-transparent hover:border-slate-300'
            }`}
          >
            <Search size={16} />
            <span>Hashtag Search & Scanner</span>
          </button>
        </div>

        <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-slate-100 border border-slate-300 rounded-xl text-[11px] font-bold text-slate-600">
          <Layers size={13} className="text-violetBrand" />
          <span>Unified Hashtag Intelligence Engine</span>
        </div>
      </div>

      {/* Render Selected View */}
      {subTab === 'generator' ? (
        <HashtagGeneratorView
          profile={profile}
          onOpenStrategyModal={onOpenStrategyModal}
          userId={userId}
        />
      ) : (
        <HashtagScannerView
          config={config}
          profile={profile}
          onOpenStrategyModal={onOpenStrategyModal}
          userId={userId}
        />
      )}
    </div>
  );
};
