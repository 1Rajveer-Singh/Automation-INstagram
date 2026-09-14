import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App';
import { ActivityProvider } from './context/ActivityContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import './index.css';

const CLERK_PUBLISHABLE_KEY = (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '').trim();

function Root() {
  if (!CLERK_PUBLISHABLE_KEY) {
    return (
      <div className="min-h-screen bg-[#FFFDF5] flex items-center justify-center p-6 text-slate-800">
        <div className="max-w-lg w-full bg-white border-4 border-[#1E293B] rounded-3xl p-8 shadow-[8px_8px_0px_#1E293B] text-center space-y-4">
          <div className="w-14 h-14 bg-amber-100 border-2 border-[#1E293B] rounded-2xl mx-auto flex items-center justify-center text-2xl font-black shadow-[3px_3px_0px_#1E293B]">
            🔑
          </div>
          <h2 className="text-2xl font-black text-[#1E293B]">Vercel Deployment Setup</h2>
          <p className="text-sm font-semibold text-slate-600 leading-relaxed">
            Please configure <code className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-mono font-bold">VITE_CLERK_PUBLISHABLE_KEY</code> in your Vercel Project Settings &rarr; Environment Variables, then redeploy.
          </p>
          <div className="text-xs bg-slate-50 border-2 border-slate-200 rounded-xl p-3.5 text-left font-mono space-y-1.5 text-slate-700">
            <div><span className="text-emerald-700 font-bold">Required:</span> VITE_CLERK_PUBLISHABLE_KEY</div>
            <div><span className="text-slate-500 font-bold">Optional:</span> VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
        <ActivityProvider>
          <App />
        </ActivityProvider>
      </ClerkProvider>
    </ErrorBoundary>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);

