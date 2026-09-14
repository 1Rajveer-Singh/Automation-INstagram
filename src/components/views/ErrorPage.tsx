import React from 'react';
import { SignInButton } from '@clerk/clerk-react';
import { Ghost, Home, RefreshCw, WifiOff, ShieldOff, ServerCrash, AlertOctagon } from 'lucide-react';
import { PatternBackground } from '../common/PatternBackground';

type ErrorType = '404' | '403' | '500' | 'network' | 'api' | 'auth' | 'generic';

interface ErrorPageProps {
  type?: ErrorType;
  title?: string;
  description?: string;
  onRetry?: () => void;
}

interface ErrorConfig {
  icon: React.ReactNode;
  title: string;
  description: string;
  bg: string;
}

function getConfig(type: ErrorType): ErrorConfig {
  switch (type) {
    case '404': return {
      icon: <Ghost size={28} className="text-violetBrand" />,
      title: 'Page Not Found',
      description: 'Oops! This page vanished into the algorithm. It may have been moved or never existed.',
      bg: 'bg-violet-100',
    };
    case '403': return {
      icon: <ShieldOff size={28} className="text-rose-600" />,
      title: 'Access Denied',
      description: 'You do not have permission to access this resource. Please check your credentials.',
      bg: 'bg-rose-100',
    };
    case '500': return {
      icon: <ServerCrash size={28} className="text-orange-600" />,
      title: 'Server Error',
      description: 'Something went wrong on our end. We are on it! Please try again in a moment.',
      bg: 'bg-orange-100',
    };
    case 'network': return {
      icon: <WifiOff size={28} className="text-slate-600" />,
      title: 'No Connection',
      description: 'Could not reach the server. Check your internet connection and try again.',
      bg: 'bg-slate-100',
    };
    case 'api': return {
      icon: <AlertOctagon size={28} className="text-yellow-700" />,
      title: 'API Error',
      description: 'The Meta Graph API returned an unexpected response. Your access token may be expired or invalid.',
      bg: 'bg-yellow-100',
    };
    case 'auth': return {
      icon: <ShieldOff size={28} className="text-pinkPop" />,
      title: 'Authentication Required',
      description: 'Your session has expired or you are not logged in. Please sign in to continue.',
      bg: 'bg-pink-100',
    };
    default: return {
      icon: <AlertOctagon size={28} className="text-slate-600" />,
      title: 'Something Went Wrong',
      description: 'An unexpected error occurred. Please try again or contact support if this persists.',
      bg: 'bg-slate-100',
    };
  }
}

export const ErrorPage: React.FC<ErrorPageProps> = ({
  type = 'generic',
  title,
  description,
  onRetry,
}) => {
  const config = getConfig(type);
  const displayTitle = title ?? config.title;
  const displayDesc = description ?? config.description;

  const numericCode = type === '404' || type === '403' || type === '500' ? type : null;

  return (
    <PatternBackground className="h-screen w-screen flex flex-col items-center justify-center p-4">
      <div className="bg-white border-4 border-slateDark rounded-3xl p-8 sm:p-10 max-w-md w-full text-center shadow-[6px_6px_0_#1E293B] space-y-5 animate-in fade-in zoom-in-95">

        {/* Numeric code (404 / 403 / 500) */}
        {numericCode && (
          <div className="font-heading font-black text-7xl text-slate-100 select-none leading-none tracking-tighter">
            {numericCode}
          </div>
        )}

        {/* Icon */}
        <div className={`w-16 h-16 rounded-2xl ${config.bg} border-[3px] border-slateDark mx-auto flex items-center justify-center shadow-[3px_3px_0_#1E293B] ${numericCode ? '-mt-4' : ''}`}>
          {config.icon}
        </div>

        {/* Text */}
        <div className="space-y-2">
          <h2 className="font-heading font-black text-2xl text-slateDark tracking-tight">{displayTitle}</h2>
          <p className="text-sm text-slate-500 font-semibold leading-relaxed">{displayDesc}</p>
        </div>

        {/* Divider */}
        <hr className="border-t-2 border-slateDark" />

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          {type === 'auth' ? (
            <SignInButton mode="modal">
              <button
                type="button"
                className="flex-1 px-5 py-3 bg-violetBrand hover:bg-violet-700 text-white font-heading font-black text-sm rounded-xl border-2 border-slateDark shadow-[2px_2px_0_#1E293B] hover:-translate-y-0.5 transition-all cursor-pointer"
              >
                Sign In
              </button>
            </SignInButton>
          ) : onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="flex-1 px-5 py-3 bg-violetBrand hover:bg-violet-700 text-white font-heading font-black text-sm rounded-xl border-2 border-slateDark shadow-[2px_2px_0_#1E293B] hover:-translate-y-0.5 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <RefreshCw size={14} />
              <span>Try Again</span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => { window.location.href = '/'; }}
            className="flex-1 px-5 py-3 bg-white hover:bg-slate-50 text-slateDark font-heading font-black text-sm rounded-xl border-2 border-slateDark shadow-[2px_2px_0_#1E293B] hover:-translate-y-0.5 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Home size={14} />
            <span>Go Home</span>
          </button>
        </div>

        {/* Footer note */}
        <p className="text-[10px] font-mono text-slate-400">InstaGrowth.io — Meta Graph API v22.0</p>
      </div>
    </PatternBackground>
  );
};
