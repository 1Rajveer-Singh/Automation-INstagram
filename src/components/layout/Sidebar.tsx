import React from 'react';
import {
  LayoutDashboard,
  Send,
  MessageSquareCode,
  Search,
  Hash,
  Sparkles,
  BarChart3,
  Rocket,
  Plug,
  X,
} from 'lucide-react';

export type NavTab =
  | 'dashboard'
  | 'publisher'
  | 'auto-responder'
  | 'competitors'
  | 'hashtag-generator'
  | 'hashtags'
  | 'insights'
  | 'growth-rules'
  | 'plugins';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  growthScore?: number;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  growthScore = 0,
  isMobileOpen,
  onCloseMobile,
}) => {
  const navItems = [
    {
      id: 'dashboard' as NavTab,
      label: 'Growth Dashboard',
      subtitle: 'Popularity Scorecard',
      icon: LayoutDashboard,
      badge: growthScore > 0 ? `Score: ${growthScore}` : undefined,
      badgeColor: 'bg-yellowPop text-slateDark',
    },
    {
      id: 'publisher' as NavTab,
      label: 'Publisher Queue',
      subtitle: 'Instant & Peak Hour Scheduling',
      icon: Send,
      badge: 'Live',
      badgeColor: 'bg-mintPop text-slateDark',
    },
    {
      id: 'auto-responder' as NavTab,
      label: 'Comment Responder',
      subtitle: 'Auto-Reply & AI Lead DM',
      icon: MessageSquareCode,
      badge: 'AI',
      badgeColor: 'bg-pinkPop text-slateDark',
    },
    {
      id: 'competitors' as NavTab,
      label: 'Business Discovery',
      subtitle: 'Competitor Analysis',
      icon: Search,
    },
    {
      id: 'hashtags' as NavTab,
      label: 'Hashtag Engine',
      subtitle: 'Generator Matrix & Search',
      icon: Hash,
      badge: '2-in-1',
      badgeColor: 'bg-yellowPop text-slateDark',
    },
    {
      id: 'insights' as NavTab,
      label: 'Audience Insights',
      subtitle: 'Post Analytics & Graphs',
      icon: BarChart3,
    },
    {
      id: 'growth-rules' as NavTab,
      label: 'Growth Automation',
      subtitle: 'Account Acceleration Rules',
      icon: Rocket,
      badge: '🔥 Active',
      badgeColor: 'bg-pinkPop text-slateDark',
    },
    {
      id: 'plugins' as NavTab,
      label: 'Plugins AI',
      subtitle: 'Gemini, OpenRouter & Tools',
      icon: Plug,
      badge: 'AI Pool',
      badgeColor: 'bg-violetBrand text-white',
    },
  ];

  const handleNavClick = (tab: NavTab) => {
    onSelectTab(tab);
    if (onCloseMobile) onCloseMobile();
  };

  const sidebarContent = (
    <div className="py-4 px-3 space-y-1">
      {navItems.map(item => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;

        return (
          <button
            key={item.id}
            onClick={() => handleNavClick(item.id)}
            className={`w-full flex items-center justify-between p-3 rounded-2xl border-2 transition-all duration-200 text-left cursor-pointer ${
              isActive
                ? 'bg-yellowPop border-slateDark shadow-pop-sm font-bold text-slateDark translate-x-1'
                : 'bg-white border-slateDark/10 hover:border-slateDark hover:bg-slate-50 text-slate-700'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-xl border-2 border-slateDark flex items-center justify-center shadow-pop-sm shrink-0 ${
                  isActive ? 'bg-violetBrand text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                <Icon size={16} strokeWidth={2.5} />
              </div>
              <div>
                <div className="font-heading text-xs font-bold leading-tight">{item.label}</div>
                <div className="text-[10px] text-slate-500 font-medium">{item.subtitle}</div>
              </div>
            </div>

            {item.badge && (
              <span
                className={`text-[9px] font-heading font-black px-1.5 py-0.5 rounded-full border border-slateDark ${item.badgeColor}`}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      <aside className="hidden md:block w-72 shrink-0 bg-white border-r-2 border-slateDark h-full overflow-y-auto shadow-pop-sm">
        {sidebarContent}
      </aside>

      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="fixed inset-0 bg-slateDark/60 backdrop-blur-sm" onClick={onCloseMobile} />
          <div className="relative w-80 max-w-[85vw] bg-cream h-full p-4 border-r-2 border-slateDark overflow-y-auto shadow-pop-lg z-10 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b-2 border-slate-200">
              <span className="font-heading text-base font-black text-slateDark">InstaGrowth.io Menu</span>
              <button onClick={onCloseMobile} className="p-1 rounded-lg border border-slateDark hover:bg-slate-200">
                <X size={18} />
              </button>
            </div>
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
