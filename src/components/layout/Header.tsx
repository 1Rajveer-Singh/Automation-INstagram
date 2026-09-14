import React, { useState } from 'react';
import { Zap, Sparkles, Menu, X, Bell, Trash2, CheckCircle2, AlertCircle, Info, Target, LogIn } from 'lucide-react';
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react';
import { useActivity } from '../../context/ActivityContext';

interface HeaderProps {
  config?: any;
  onOpenTokenModal?: () => void;
  onOpenStrategyModal?: () => void;
  isStrategyConfigured?: boolean;
  onRefreshData?: () => void;
  isRefreshing?: boolean;
  isMobileMenuOpen?: boolean;
  onToggleMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isMobileMenuOpen,
  onToggleMobileMenu,
  onOpenStrategyModal,
  isStrategyConfigured,
}) => {
  const { activities, clearActivities } = useActivity();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b-2 border-slateDark px-3 sm:px-4 md:px-5 py-2.5 sm:py-3 shadow-pop-sm shrink-0">
      <div className="w-full flex items-center justify-between gap-2 sm:gap-3">
        {/* Brand & Mobile Hamburger */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={onToggleMobileMenu}
            aria-label="Toggle Navigation Menu"
            className="md:hidden p-1.5 sm:p-2 rounded-xl border-2 border-slateDark bg-white hover:bg-slate-100 shadow-pop-sm shrink-0"
          >
            {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-violetBrand border-2 border-slateDark flex items-center justify-center shadow-pop-sm rotate-[-3deg] text-white shrink-0">
            <Zap size={18} className="sm:w-[22px] sm:h-[22px]" strokeWidth={3} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="font-heading text-lg sm:text-2xl font-black text-slateDark tracking-tight leading-none truncate">
                InstaGrowth<span className="text-violetBrand">.io</span>
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-heading font-black bg-emerald-400 text-slateDark border border-slateDark rounded-full uppercase">
                <Sparkles size={11} /> LIVE GRAPH API
              </span>
            </div>
            <p className="hidden md:block text-[11px] font-semibold text-slate-500 mt-0.5">
              Instagram Graph API v22.0 + AI Automation Suite
            </p>
          </div>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {onOpenStrategyModal && (
            <button
              onClick={onOpenStrategyModal}
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 border-2 border-slateDark rounded-xl shadow-pop-sm transition-all ${
                isStrategyConfigured
                  ? 'bg-yellowPop/90 hover:bg-yellowPop text-slateDark'
                  : 'bg-gradient-to-r from-yellowPop to-pinkPop text-slateDark animate-pulse'
              }`}
              title="Instagram Growth Strategy Questionnaire & Config"
            >
              <Target size={15} className="shrink-0" strokeWidth={2.5} />
              <span className="text-xs font-heading font-black whitespace-nowrap">
                <span className="hidden sm:inline">
                  {isStrategyConfigured ? 'Growth Strategy' : '⚡ Setup Strategy'}
                </span>
                <span className="sm:hidden">
                  {isStrategyConfigured ? 'Strategy' : '⚡ Setup'}
                </span>
              </span>
            </button>
          )}

          {/* Activity Log Notification Bell (Right Hand Side) */}
          <div className="relative">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 border-2 border-slateDark rounded-xl shadow-pop-sm transition-all"
            >
            <div className="relative">
              <Bell size={18} className="text-slateDark" />
              {activities.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-pinkPop text-slateDark text-[10px] font-extrabold flex items-center justify-center rounded-full border border-slateDark">
                  {activities.length}
                </span>
              )}
            </div>
            <span className="hidden sm:inline text-xs font-bold text-slateDark">Activity Log</span>
          </button>

          {/* Activity Dropdown Menu */}
          {isOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border-3 border-slateDark rounded-2xl shadow-pop-lg z-50 p-4 space-y-3 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-2 border-b-2 border-slate-100">
                <div className="flex items-center gap-2">
                  <Bell size={16} className="text-violetBrand" />
                  <h3 className="font-heading text-sm font-black text-slateDark">System Activity Log</h3>
                </div>
                {activities.length > 0 && (
                  <button
                    onClick={clearActivities}
                    className="text-[11px] font-bold text-rose-600 hover:underline flex items-center gap-1"
                  >
                    <Trash2 size={12} /> Clear
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                {activities.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">No recent activity logged.</p>
                ) : (
                  activities.map(item => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-start gap-2.5 text-xs"
                    >
                      <div className="mt-0.5 shrink-0">
                        {item.type === 'success' && <CheckCircle2 size={15} className="text-emerald-600" />}
                        {item.type === 'error' && <AlertCircle size={15} className="text-rose-600" />}
                        {item.type === 'info' && <Info size={15} className="text-violetBrand" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slateDark leading-snug">{item.title}</p>
                        <span className="text-[10px] text-slate-400 font-semibold">{item.timestamp}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
          </div>

          {/* Clerk Authentication Controls */}
          <div className="flex items-center">
            <SignedIn>
              <div className="p-0.5 border-2 border-slateDark rounded-xl shadow-pop-sm bg-white flex items-center justify-center">
                <UserButton
                  afterSignOutUrl="/"
                  appearance={{
                    elements: {
                      avatarBox: 'w-7 h-7 sm:w-8 sm:h-8 rounded-lg',
                    },
                  }}
                />
              </div>
            </SignedIn>
            <SignedOut>
              <SignInButton mode="modal">
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-3 py-1.5 sm:py-2 bg-violetBrand hover:bg-violetBrand/90 text-white font-heading text-xs font-black rounded-xl border-2 border-slateDark shadow-pop-sm transition-all cursor-pointer"
                >
                  <LogIn size={14} />
                  <span>Sign In</span>
                </button>
              </SignInButton>
            </SignedOut>
          </div>
        </div>
      </div>
    </header>
  );
};
