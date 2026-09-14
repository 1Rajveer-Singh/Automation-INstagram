import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { PatternBackground } from './PatternBackground';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message || 'An unexpected error occurred.' };
  }

  componentDidCatch(_error: Error, _info: React.ErrorInfo) {
    // Intentionally silent: no console leakage in production
  }

  handleReload = () => {
    this.setState({ hasError: false, errorMessage: '' });
    window.location.reload();
  };

  handleHome = () => {
    this.setState({ hasError: false, errorMessage: '' });
    window.location.href = '/';
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <PatternBackground className="h-screen w-screen flex flex-col items-center justify-center p-4">
        <div className="bg-white border-4 border-slateDark rounded-3xl p-8 max-w-md w-full text-center shadow-pop space-y-5 animate-in fade-in zoom-in-95">
          <div className="w-16 h-16 rounded-2xl bg-rose-100 border-3 border-slateDark mx-auto flex items-center justify-center shadow-pop-sm">
            <AlertTriangle size={28} className="text-rose-600" />
          </div>
          <div className="space-y-2">
            <h2 className="font-heading font-black text-2xl text-slateDark tracking-tight">
              Something Went Wrong
            </h2>
            <p className="text-sm text-slate-500 font-semibold leading-relaxed">
              The application encountered an unexpected error. Your data is safe — please refresh and try again.
            </p>
            {this.state.errorMessage && (
              <code className="block text-[11px] font-mono bg-rose-50 text-rose-700 border border-rose-200 rounded-xl px-3 py-2 mt-2 break-all">
                {this.state.errorMessage}
              </code>
            )}
          </div>
          <div className="border-t-2 border-slateDark w-full" />
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={this.handleReload}
              className="flex-1 px-5 py-3 bg-violetBrand hover:bg-violet-700 text-white font-heading font-black text-sm rounded-xl border-2 border-slateDark shadow-pop-sm hover:-translate-y-0.5 active:translate-y-0.5 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <RefreshCw size={15} />
              <span>Reload App</span>
            </button>
            <button
              type="button"
              onClick={this.handleHome}
              className="flex-1 px-5 py-3 bg-white hover:bg-slate-50 text-slateDark font-heading font-black text-sm rounded-xl border-2 border-slateDark shadow-pop-sm hover:-translate-y-0.5 active:translate-y-0.5 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Home size={15} />
              <span>Go Home</span>
            </button>
          </div>
          <div className="text-[10px] font-mono text-slate-400">
            InstaGrowth.io — Error captured safely. No data lost.
          </div>
        </div>
      </PatternBackground>
    );
  }
}
